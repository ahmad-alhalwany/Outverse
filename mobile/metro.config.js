const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

const webStubs = {
  'react-native-maps': path.resolve(__dirname, 'src/shims/react-native-maps.web.js'),
  'react-native-video': path.resolve(__dirname, 'src/shims/react-native-video.web.js'),
  'react-native-webrtc': path.resolve(__dirname, 'src/shims/react-native-webrtc.web.js'),
};

const nativeStubs = {
  'react-native-video': path.resolve(__dirname, 'src/shims/react-native-video.native.js'),
  'react-native-webrtc': path.resolve(__dirname, 'src/shims/react-native-webrtc.native.js'),
};

config.resolver.resolveRequest = (context, moduleName, platform) => {
  const stubs = platform === 'web' ? webStubs : nativeStubs;
  if (stubs[moduleName]) {
    return { type: 'sourceFile', filePath: stubs[moduleName] };
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
