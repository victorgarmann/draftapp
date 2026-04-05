const { withDangerousMod } = require("expo/config-plugins");
const fs = require("fs");
const path = require("path");

/**
 * Two-part injection into AppDelegate.mm:
 *
 * 1. DIAGNOSTIC: installs std::set_terminate handler that captures and logs
 *    the exact NSException (name + reason) before the crash.  This tells us
 *    what React's old bridge is rethrowing.
 *
 * 2. FIX: swizzles all concrete implementations of writeToFile: methods on
 *    iOS 26+ to force atomically:NO, in case that IS the exception source.
 */
const INJECTED_CODE = `
// -------- AtomicWriteFix + Diagnostics (injected by plugin) --------
#import <objc/runtime.h>
#include <exception>
#include <cstdlib>

// ==================== PART 1: EXCEPTION DIAGNOSTICS ====================
// Installs a custom std::terminate handler so that when React.framework's
// old bridge rethrows an NSException and no outer catch exists, we capture
// the exception details via NSLog BEFORE abort() fires.  The output goes
// to the unified OS log visible in Console.app / deviceconsole / crash
// "Application Specific Information" section.

static std::terminate_handler _awf_prev_terminate = nullptr;

static void _awf_terminate_handler() {
    // Try to retrieve the current ObjC exception
    @try {
        @throw;  // rethrow current exception so we can catch it
    } @catch (NSException *exception) {
        NSLog(@"\\n\\n========================================");
        NSLog(@"[AtomicWriteFix] CRASH DIAGNOSTIC");
        NSLog(@"NSException name:   %@", exception.name);
        NSLog(@"NSException reason: %@", exception.reason);
        NSLog(@"NSException info:   %@", exception.userInfo);
        NSLog(@"Call stack:");
        for (NSString *frame in exception.callStackSymbols) {
            NSLog(@"  %@", frame);
        }
        NSLog(@"========================================\\n\\n");
    } @catch (id other) {
        NSLog(@"[AtomicWriteFix] CRASH: non-NSException ObjC object: %@", other);
    } @catch (...) {
        NSLog(@"[AtomicWriteFix] CRASH: unknown C++ exception");
    }
    // Fall through to abort
    abort();
}

// ==================== PART 2: ATOMIC WRITE SWIZZLE ====================
typedef struct _AWF_Entry {
    Class cls;
    SEL sel;
    IMP origIMP;
    struct _AWF_Entry *next;
} AWF_Entry;

static AWF_Entry *_awf_head = NULL;

static IMP _awf_lookup(Class cls, SEL sel) {
    for (AWF_Entry *e = _awf_head; e; e = e->next) {
        if (e->cls == cls && e->sel == sel) return e->origIMP;
    }
    return NULL;
}

static void _awf_store(Class cls, SEL sel, IMP imp) {
    AWF_Entry *e = (AWF_Entry *)calloc(1, sizeof(AWF_Entry));
    e->cls = cls; e->sel = sel; e->origIMP = imp; e->next = _awf_head;
    _awf_head = e;
}

static BOOL _awf_NSString_writeToFile(id self, SEL _cmd, NSString *path,
    BOOL atomically, NSStringEncoding enc, NSError **err) {
    IMP orig = _awf_lookup(object_getClass(self), _cmd);
    if (!orig) orig = _awf_lookup([NSString class], _cmd);
    typedef BOOL(*Fn)(id,SEL,NSString*,BOOL,NSStringEncoding,NSError**);
    return orig ? ((Fn)orig)(self, _cmd, path, NO, enc, err) : NO;
}

static BOOL _awf_NSData_writeToFile_a(id self, SEL _cmd, NSString *path,
    BOOL atomically) {
    IMP orig = _awf_lookup(object_getClass(self), _cmd);
    if (!orig) orig = _awf_lookup([NSData class], _cmd);
    typedef BOOL(*Fn)(id,SEL,NSString*,BOOL);
    return orig ? ((Fn)orig)(self, _cmd, path, NO) : NO;
}

static BOOL _awf_NSData_writeToFile_o(id self, SEL _cmd, NSString *path,
    NSDataWritingOptions opts, NSError **err) {
    opts &= ~NSDataWritingAtomic;
    IMP orig = _awf_lookup(object_getClass(self), _cmd);
    if (!orig) orig = _awf_lookup([NSData class], _cmd);
    typedef BOOL(*Fn)(id,SEL,NSString*,NSDataWritingOptions,NSError**);
    return orig ? ((Fn)orig)(self, _cmd, path, opts, err) : NO;
}

static BOOL _awf_NSDictionary_writeToFile(id self, SEL _cmd, NSString *path,
    BOOL atomically) {
    IMP orig = _awf_lookup(object_getClass(self), _cmd);
    if (!orig) orig = _awf_lookup([NSDictionary class], _cmd);
    typedef BOOL(*Fn)(id,SEL,NSString*,BOOL);
    return orig ? ((Fn)orig)(self, _cmd, path, NO) : NO;
}

static BOOL _awf_NSArray_writeToFile(id self, SEL _cmd, NSString *path,
    BOOL atomically) {
    IMP orig = _awf_lookup(object_getClass(self), _cmd);
    if (!orig) orig = _awf_lookup([NSArray class], _cmd);
    typedef BOOL(*Fn)(id,SEL,NSString*,BOOL);
    return orig ? ((Fn)orig)(self, _cmd, path, NO) : NO;
}

static void _awf_swizzleSelector(SEL sel, IMP replacement, Class baseClass) {
    unsigned int classCount = 0;
    Class *classes = objc_copyClassList(&classCount);
    if (!classes) return;

    for (unsigned int i = 0; i < classCount; i++) {
        Class cls = classes[i];
        Class superIter = cls;
        BOOL isSubclass = NO;
        while (superIter) {
            if (superIter == baseClass) { isSubclass = YES; break; }
            superIter = class_getSuperclass(superIter);
        }
        if (!isSubclass) continue;

        Method m = class_getInstanceMethod(cls, sel);
        if (!m) continue;

        Method superM = class_getSuperclass(cls)
            ? class_getInstanceMethod(class_getSuperclass(cls), sel) : NULL;
        if (superM && method_getImplementation(m) == method_getImplementation(superM))
            continue;

        IMP origIMP = method_getImplementation(m);
        if (origIMP == replacement) continue;

        _awf_store(cls, sel, origIMP);
        method_setImplementation(m, replacement);
    }

    free(classes);
}

// ==================== INSTALLER ====================
__attribute__((constructor))
static void _awf_install(void) {
    // Always install diagnostic handler (works on all iOS versions)
    _awf_prev_terminate = std::set_terminate(_awf_terminate_handler);
    NSLog(@"[AtomicWriteFix] Installed terminate handler for crash diagnostics");

    if (@available(iOS 26, *)) {
        _awf_swizzleSelector(
            @selector(writeToFile:atomically:encoding:error:),
            (IMP)_awf_NSString_writeToFile, [NSString class]);
        _awf_swizzleSelector(
            @selector(writeToFile:atomically:),
            (IMP)_awf_NSData_writeToFile_a, [NSData class]);
        _awf_swizzleSelector(
            @selector(writeToFile:options:error:),
            (IMP)_awf_NSData_writeToFile_o, [NSData class]);
        _awf_swizzleSelector(
            @selector(writeToFile:atomically:),
            (IMP)_awf_NSDictionary_writeToFile, [NSDictionary class]);
        _awf_swizzleSelector(
            @selector(writeToFile:atomically:),
            (IMP)_awf_NSArray_writeToFile, [NSArray class]);
        NSLog(@"[AtomicWriteFix] Swizzled atomic write methods for iOS 26+");
    }
}
// -------- End AtomicWriteFix --------

`;

const withFixAtomicWrites = (config) => {
  config = withDangerousMod(config, [
    "ios",
    async (config) => {
      const projectRoot = config.modRequest.platformProjectRoot;
      const appName = config.modRequest.projectName;
      const appDelegatePath = path.join(projectRoot, appName, "AppDelegate.mm");

      if (!fs.existsSync(appDelegatePath)) {
        console.warn("[fix-atomic-writes] AppDelegate.mm not found at", appDelegatePath);
        return config;
      }

      let source = fs.readFileSync(appDelegatePath, "utf-8");

      if (source.includes("_awf_install")) {
        return config;
      }

      const importRegex = /(#import\s+.+\n)+/;
      const match = source.match(importRegex);
      if (match) {
        const insertPos = match.index + match[0].length;
        source =
          source.slice(0, insertPos) + INJECTED_CODE + source.slice(insertPos);
      } else {
        source = INJECTED_CODE + source;
      }

      fs.writeFileSync(appDelegatePath, source);
      console.log("[fix-atomic-writes] Injected diagnostic + fix into AppDelegate.mm");

      return config;
    },
  ]);

  return config;
};

module.exports = withFixAtomicWrites;
