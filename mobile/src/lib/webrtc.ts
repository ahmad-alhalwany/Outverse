import { NativeModules, Platform } from 'react-native';
import { Audio } from 'expo-av';
import * as ImagePicker from 'expo-image-picker';

export function hasNativeWebRTC(): boolean {
  return (
    Platform.OS !== 'web' &&
    !!(NativeModules.WebRTCModule || NativeModules.WebRTCModuleSpec)
  );
}

export async function prepareCallMedia(): Promise<void> {
  try {
    await Audio.requestPermissionsAsync();
  } catch {
    /* Expo Go still allows WebView capture after the OS prompt */
  }
  try {
    await ImagePicker.requestCameraPermissionsAsync();
  } catch {
    /* ignore */
  }
}
