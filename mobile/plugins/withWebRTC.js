const {
  AndroidConfig,
  withAndroidManifest,
  withInfoPlist,
} = require('@expo/config-plugins');

const CAMERA =
  'Cosonova uses the camera for posts, stories, and video calls.';
const MICROPHONE =
  'Cosonova uses the microphone for recording and calls.';

const ANDROID_PERMISSIONS = [
  'android.permission.CAMERA',
  'android.permission.RECORD_AUDIO',
  'android.permission.ACCESS_NETWORK_STATE',
  'android.permission.CHANGE_NETWORK_STATE',
  'android.permission.MODIFY_AUDIO_SETTINGS',
  'android.permission.BLUETOOTH',
  'android.permission.BLUETOOTH_CONNECT',
  'android.permission.BLUETOOTH_ADMIN',
];

function withWebRTC(config) {
  config = withInfoPlist(config, (mod) => {
    mod.modResults.NSCameraUsageDescription =
      mod.modResults.NSCameraUsageDescription || CAMERA;
    mod.modResults.NSMicrophoneUsageDescription = MICROPHONE;
    return mod;
  });

  config = withAndroidManifest(config, (mod) => {
    ANDROID_PERMISSIONS.forEach((permission) => {
      AndroidConfig.Permissions.addPermission(mod.modResults, permission);
    });
    return mod;
  });

  return config;
}

module.exports = withWebRTC;
