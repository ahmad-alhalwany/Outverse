const React = require('react');
const { Video, ResizeMode } = require('expo-av');

const MODE = {
  contain: ResizeMode.CONTAIN,
  cover: ResizeMode.COVER,
  stretch: ResizeMode.STRETCH,
};

function NativeVideo({
  source,
  style,
  paused,
  muted,
  repeat,
  resizeMode = 'cover',
  controls,
  rate = 1,
  poster,
  onProgress,
  onEnd,
  pointerEvents,
}) {
  return React.createElement(Video, {
    source,
    style,
    shouldPlay: !paused,
    isMuted: !!muted,
    isLooping: !!repeat,
    useNativeControls: !!controls,
    resizeMode: MODE[resizeMode] || ResizeMode.COVER,
    rate,
    posterSource: poster ? { uri: poster } : undefined,
    pointerEvents,
    onPlaybackStatusUpdate: (status) => {
      if (!status.isLoaded) return;
      if (onProgress) {
        onProgress({
          currentTime: (status.positionMillis || 0) / 1000,
          playableDuration: (status.durationMillis || 0) / 1000,
        });
      }
      if (status.didJustFinish && onEnd) onEnd();
    },
  });
}

module.exports = NativeVideo;
module.exports.default = NativeVideo;
