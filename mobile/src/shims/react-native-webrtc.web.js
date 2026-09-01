const React = require('react');
const { View } = require('react-native');

function RTCView(props) {
  return React.createElement(View, props);
}

const mediaDevices = {
  getUserMedia: async () => {
    throw new Error('WEBRTC_NATIVE_BUILD_REQUIRED');
  },
  enumerateDevices: async () => [],
};

class RTCPeerConnection {
  constructor() {
    throw new Error('WEBRTC_NATIVE_BUILD_REQUIRED');
  }
}

class RTCIceCandidate {}
class RTCSessionDescription {}
class MediaStream {
  toURL() {
    return '';
  }
}

module.exports = {
  mediaDevices,
  RTCPeerConnection,
  RTCIceCandidate,
  RTCSessionDescription,
  RTCView,
  MediaStream,
};
