const {
  withDangerousMod,
  withXcodeProject,
} = require("expo/config-plugins");
const fs = require("fs");
const path = require("path");

const OBJC_FILENAME = "AtomicWriteFix.m";

const OBJC_SOURCE = `\
#import <Foundation/Foundation.h>
#import <objc/runtime.h>

// iOS 26 changed createProtectedTemporaryFile behavior so that atomic file
// writes (writeToFile:atomically:YES) throw NSException.  React Native's
// pre-compiled React.framework uses atomic writes internally, and we cannot
// patch that binary.  Instead we globally swizzle the three Foundation write
// methods at +load time to force atomically:NO on iOS 26+.

#pragma clang diagnostic push
#pragma clang diagnostic ignored "-Wundeclared-selector"

static void swizzle(Class cls, SEL original, IMP replacement, const char *types) {
    Method m = class_getInstanceMethod(cls, original);
    if (m) {
        method_setImplementation(m, replacement);
    }
}

// --- NSString writeToFile:atomically:encoding:error: ---
static BOOL (*orig_NSString_writeToFile)(id, SEL, NSString *, BOOL, NSStringEncoding, NSError **);

static BOOL fix_NSString_writeToFile(id self, SEL _cmd, NSString *filePath, BOOL atomically,
                                      NSStringEncoding encoding, NSError **error) {
    return orig_NSString_writeToFile(self, _cmd, filePath, NO, encoding, error);
}

// --- NSData writeToFile:atomically: ---
static BOOL (*orig_NSData_writeToFile_atomically)(id, SEL, NSString *, BOOL);

static BOOL fix_NSData_writeToFile_atomically(id self, SEL _cmd, NSString *filePath, BOOL atomically) {
    return orig_NSData_writeToFile_atomically(self, _cmd, filePath, NO);
}

// --- NSData writeToFile:options:error: ---
static BOOL (*orig_NSData_writeToFile_options)(id, SEL, NSString *, NSDataWritingOptions, NSError **);

static BOOL fix_NSData_writeToFile_options(id self, SEL _cmd, NSString *filePath,
                                            NSDataWritingOptions options, NSError **error) {
    // Strip the NSDataWritingAtomic flag
    options &= ~NSDataWritingAtomic;
    return orig_NSData_writeToFile_options(self, _cmd, filePath, options, error);
}

#pragma clang diagnostic pop

__attribute__((constructor))
static void installAtomicWriteFix(void) {
    if (@available(iOS 26, *)) {
        // NSString -writeToFile:atomically:encoding:error:
        {
            SEL sel = @selector(writeToFile:atomically:encoding:error:);
            Method m = class_getInstanceMethod([NSString class], sel);
            if (m) {
                orig_NSString_writeToFile = (void *)method_getImplementation(m);
                method_setImplementation(m, (IMP)fix_NSString_writeToFile);
            }
        }
        // NSData -writeToFile:atomically:
        {
            SEL sel = @selector(writeToFile:atomically:);
            Method m = class_getInstanceMethod([NSData class], sel);
            if (m) {
                orig_NSData_writeToFile_atomically = (void *)method_getImplementation(m);
                method_setImplementation(m, (IMP)fix_NSData_writeToFile_atomically);
            }
        }
        // NSData -writeToFile:options:error:
        {
            SEL sel = @selector(writeToFile:options:error:);
            Method m = class_getInstanceMethod([NSData class], sel);
            if (m) {
                orig_NSData_writeToFile_options = (void *)method_getImplementation(m);
                method_setImplementation(m, (IMP)fix_NSData_writeToFile_options);
            }
        }

        NSLog(@"[AtomicWriteFix] Swizzled atomic write methods for iOS 26+ compatibility");
    }
}
`;

/**
 * Expo config plugin that injects an ObjC file to swizzle Foundation's atomic
 * write methods on iOS 26+, preventing the NSException that crashes React
 * Native's pre-compiled old bridge code.
 */
const withFixAtomicWrites = (config) => {
  // Step 1: Write the .m file into the iOS project directory
  config = withDangerousMod(config, [
    "ios",
    async (config) => {
      const projectRoot = config.modRequest.platformProjectRoot;
      const appName = config.modRequest.projectName;
      const targetDir = path.join(projectRoot, appName);

      fs.mkdirSync(targetDir, { recursive: true });
      fs.writeFileSync(path.join(targetDir, OBJC_FILENAME), OBJC_SOURCE);

      return config;
    },
  ]);

  // Step 2: Add the .m file to the Xcode project's compile sources
  config = withXcodeProject(config, async (config) => {
    const xcodeProject = config.modResults;
    const appName = config.modRequest.projectName;
    const filePath = path.join(appName, OBJC_FILENAME);

    // Find the main app group
    const mainGroup = xcodeProject.getFirstProject().firstProject.mainGroup;
    const appGroupKey = Object.keys(xcodeProject.hash.project.objects.PBXGroup).find(
      (key) => {
        const group = xcodeProject.hash.project.objects.PBXGroup[key];
        return group && typeof group === "object" && group.name === appName;
      }
    );

    // Add the file to the project
    xcodeProject.addSourceFile(filePath, null, appGroupKey);

    return config;
  });

  return config;
};

module.exports = withFixAtomicWrites;
