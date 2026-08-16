// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');
const path = require('path');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Add support for .tflite and other ML model files
config.resolver.assetExts.push(
  'tflite',  // TensorFlow Lite models
  'pt',      // PyTorch models
  'onnx',    // ONNX models
  'txt'      // Label files
);

// Stub out @lottiefiles/dotlottie-react (web-only peer dep of lottie-react-native)
// to avoid pulling in framer-motion/tslib which break Metro's module resolution.
config.resolver.extraNodeModules = {
  ...config.resolver.extraNodeModules,
  '@lottiefiles/dotlottie-react': path.resolve(__dirname, 'shims/empty-module.js'),
};

// Redirect tslib ESM entry (modules/index.js) to the CJS entry.
// framer-motion (via moti) imports tslib's ESM path which uses `import default`
// syntax that Metro's CJS resolver can't handle.
const originalResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'tslib' || moduleName.startsWith('tslib/')) {
    const newContext = {
      ...context,
      resolveRequest: originalResolveRequest || undefined,
    };
    return context.resolveRequest(newContext, 'tslib/tslib.js', platform);
  }
  if (originalResolveRequest) {
    return originalResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = withNativeWind(config, { input: './global.css' });
