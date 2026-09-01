// Excluded from tsc's program in tsconfig.json — see the comment there for why.
const { NativeModules, Platform } = require('react-native');
const stub = require('./react-native-webrtc.web.js');

function loadNativeWebRTC() {
  try {
    return require('../../node_modules/react-native-webrtc/src/index.ts');
  } catch {
    try {
      return require('../../node_modules/react-native-webrtc/lib/commonjs/index.js');
    } catch {
      return stub;
    }
  }
}

const hasNativeModule = Platform.OS !== 'web' && !!(
  NativeModules.WebRTCModule ||
  NativeModules.WebRTCModuleSpec
);

module.exports = hasNativeModule ? loadNativeWebRTC() : stub;
