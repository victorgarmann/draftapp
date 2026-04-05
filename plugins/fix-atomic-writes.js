const { withDangerousMod } = require("expo/config-plugins");
const fs = require("fs");
const path = require("path");

/**
 * ObjC code injected at the TOP of AppDelegate.mm.
 *
 * Uses __attribute__((constructor)) to run before any +load or application
 * delegate method.  Enumerates ALL loaded ObjC classes to find every concrete
 * implementation of the three "write-to-file" selectors, then replaces each
 * with a wrapper that forces atomically:NO (or strips NSDataWritingAtomic).
 *
 * This is necessary because NSData / NSString are class clusters — the base
 * class may not own the method; a private subclass like __NSCFData or
 * NSConcreteData does.  Swizzling only the base class misses those.
 */
const SWIZZLE_CODE = `
// -------- AtomicWriteFix (injected by fix-atomic-writes plugin) --------
#import <objc/runtime.h>

// Per-IMP originals are stored in a simple linked list (allocated before main).
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

// --- Replacement for -[? writeToFile:atomically:encoding:error:] ---
static BOOL _awf_NSString_writeToFile(id self, SEL _cmd, NSString *path,
    BOOL atomically, NSStringEncoding enc, NSError **err) {
    IMP orig = _awf_lookup(object_getClass(self), _cmd);
    if (!orig) orig = _awf_lookup([NSString class], _cmd);
    typedef BOOL(*Fn)(id,SEL,NSString*,BOOL,NSStringEncoding,NSError**);
    return orig ? ((Fn)orig)(self, _cmd, path, NO, enc, err) : NO;
}

// --- Replacement for -[? writeToFile:atomically:] (NSData) ---
static BOOL _awf_NSData_writeToFile_a(id self, SEL _cmd, NSString *path,
    BOOL atomically) {
    IMP orig = _awf_lookup(object_getClass(self), _cmd);
    if (!orig) orig = _awf_lookup([NSData class], _cmd);
    typedef BOOL(*Fn)(id,SEL,NSString*,BOOL);
    return orig ? ((Fn)orig)(self, _cmd, path, NO) : NO;
}

// --- Replacement for -[? writeToFile:options:error:] (NSData) ---
static BOOL _awf_NSData_writeToFile_o(id self, SEL _cmd, NSString *path,
    NSDataWritingOptions opts, NSError **err) {
    opts &= ~NSDataWritingAtomic;
    IMP orig = _awf_lookup(object_getClass(self), _cmd);
    if (!orig) orig = _awf_lookup([NSData class], _cmd);
    typedef BOOL(*Fn)(id,SEL,NSString*,NSDataWritingOptions,NSError**);
    return orig ? ((Fn)orig)(self, _cmd, path, opts, err) : NO;
}

// --- Replacement for -[? writeToFile:atomically:] (NSDictionary) ---
static BOOL _awf_NSDictionary_writeToFile(id self, SEL _cmd, NSString *path,
    BOOL atomically) {
    IMP orig = _awf_lookup(object_getClass(self), _cmd);
    if (!orig) orig = _awf_lookup([NSDictionary class], _cmd);
    typedef BOOL(*Fn)(id,SEL,NSString*,BOOL);
    return orig ? ((Fn)orig)(self, _cmd, path, NO) : NO;
}

// --- Replacement for -[? writeToFile:atomically:] (NSArray) ---
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

        // Only swizzle classes that are subclasses of (or are) the base class
        Class superIter = cls;
        BOOL isSubclass = NO;
        while (superIter) {
            if (superIter == baseClass) { isSubclass = YES; break; }
            superIter = class_getSuperclass(superIter);
        }
        if (!isSubclass) continue;

        // Only swizzle if this class has its OWN implementation (not inherited)
        Method m = class_getInstanceMethod(cls, sel);
        if (!m) continue;

        // Check that the implementation belongs to this class, not a superclass
        Method superM = class_getSuperclass(cls)
            ? class_getInstanceMethod(class_getSuperclass(cls), sel) : NULL;
        if (superM && method_getImplementation(m) == method_getImplementation(superM)) {
            continue; // Inherited — will be caught when we swizzle the super
        }

        IMP origIMP = method_getImplementation(m);
        if (origIMP == replacement) continue; // Already swizzled

        _awf_store(cls, sel, origIMP);
        method_setImplementation(m, replacement);
    }

    free(classes);
}

__attribute__((constructor))
static void _awf_install(void) {
    if (@available(iOS 26, *)) {
        // NSString -writeToFile:atomically:encoding:error:
        _awf_swizzleSelector(
            @selector(writeToFile:atomically:encoding:error:),
            (IMP)_awf_NSString_writeToFile, [NSString class]);

        // NSData -writeToFile:atomically:
        _awf_swizzleSelector(
            @selector(writeToFile:atomically:),
            (IMP)_awf_NSData_writeToFile_a, [NSData class]);

        // NSData -writeToFile:options:error:
        _awf_swizzleSelector(
            @selector(writeToFile:options:error:),
            (IMP)_awf_NSData_writeToFile_o, [NSData class]);

        // NSDictionary -writeToFile:atomically:
        _awf_swizzleSelector(
            @selector(writeToFile:atomically:),
            (IMP)_awf_NSDictionary_writeToFile, [NSDictionary class]);

        // NSArray -writeToFile:atomically:
        _awf_swizzleSelector(
            @selector(writeToFile:atomically:),
            (IMP)_awf_NSArray_writeToFile, [NSArray class]);

        NSLog(@"[AtomicWriteFix] Swizzled all atomic write methods for iOS 26+");
    }
}
// -------- End AtomicWriteFix --------

`;

/**
 * Expo config plugin: injects atomic-write swizzle code directly into
 * AppDelegate.mm so it is guaranteed to be compiled.  The previous approach
 * (separate .m file + withXcodeProject) silently failed to add the file to
 * Xcode's compile-sources build phase.
 */
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

      // Avoid double-injection on repeated prebuild
      if (source.includes("_awf_install")) {
        return config;
      }

      // Inject right after the first #import block
      const importRegex = /(#import\s+.+\n)+/;
      const match = source.match(importRegex);
      if (match) {
        const insertPos = match.index + match[0].length;
        source =
          source.slice(0, insertPos) + SWIZZLE_CODE + source.slice(insertPos);
      } else {
        // Fallback: prepend
        source = SWIZZLE_CODE + source;
      }

      fs.writeFileSync(appDelegatePath, source);
      console.log("[fix-atomic-writes] Injected atomic write fix into AppDelegate.mm");

      return config;
    },
  ]);

  return config;
};

module.exports = withFixAtomicWrites;
