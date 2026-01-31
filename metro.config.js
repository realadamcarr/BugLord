// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Add support for .tflite and other ML model files
config.resolver.assetExts.push(
  'tflite',  // TensorFlow Lite models
  'pt',      // PyTorch models
  'onnx',    // ONNX models
  'txt'      // Label files
);

module.exports = config;
