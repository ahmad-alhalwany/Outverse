// react-native-webrtc ships raw, untranspiled .ts source with dozens of its
// own pre-existing type errors (not this app's code). Metro already routes
// this import to a platform-specific runtime shim (metro.config.js); this
// tsconfig `paths` redirect makes tsc stop walking the real package's
// internals too. Only the members this app actually imports are declared
// (all as `any`) — add more here if a new import is introduced.
declare module 'react-native-webrtc' {
  export const RTCView: any;
  export const mediaDevices: any;
  export const RTCPeerConnection: any;
  export const RTCIceCandidate: any;
  export const RTCSessionDescription: any;
  export type MediaStream = any;
}
