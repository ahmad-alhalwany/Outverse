/**
 * Minimal WHIP publisher for React Native (react-native-webrtc).
 * Gracefully no-ops if the native module is missing (Expo Go).
 */

export type WhipSession = {
  pc: { close: () => void };
  resourceUrl: string | null;
  localStream: { getTracks: () => Array<{ stop: () => void }> } | null;
};

type MediaDevicesLike = {
  getUserMedia: (constraints: object) => Promise<{
    getTracks: () => Array<{ stop: () => void } & object>;
  }>;
};

function loadWebrtc(): {
  RTCPeerConnection: new () => RTCPeerConnection;
  mediaDevices: MediaDevicesLike;
} | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('react-native-webrtc');
    if (!mod?.RTCPeerConnection || !mod?.mediaDevices) return null;
    return mod;
  } catch {
    return null;
  }
}

export function isWhipAvailable(): boolean {
  return loadWebrtc() != null;
}

function waitForIceGatheringComplete(pc: RTCPeerConnection): Promise<void> {
  if (pc.iceGatheringState === 'complete') return Promise.resolve();
  return new Promise((resolve) => {
    const timeout = setTimeout(resolve, 4000);
    const check = () => {
      if (pc.iceGatheringState === 'complete') {
        clearTimeout(timeout);
        pc.removeEventListener('icegatheringstatechange', check);
        resolve();
      }
    };
    pc.addEventListener('icegatheringstatechange', check);
  });
}

export async function publishWhipFromCamera(whipUrl: string): Promise<WhipSession> {
  const webrtc = loadWebrtc();
  if (!webrtc) {
    throw new Error('WHIP unavailable — use a native/dev build with react-native-webrtc, or OBS via RTMP.');
  }
  const localStream = await webrtc.mediaDevices.getUserMedia({
    audio: true,
    video: { facingMode: 'user' },
  });
  const pc = new webrtc.RTCPeerConnection();
  localStream.getTracks().forEach((track: object) => {
    // @ts-expect-error RN webrtc track typing
    pc.addTrack(track, localStream);
  });

  const offer = await pc.createOffer({});
  await pc.setLocalDescription(offer);
  await waitForIceGatheringComplete(pc);

  const res = await fetch(whipUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/sdp' },
    body: pc.localDescription?.sdp ?? offer.sdp,
  });
  if (!res.ok) {
    pc.close();
    localStream.getTracks().forEach((t) => t.stop());
    throw new Error(`WHIP publish failed: ${res.status}`);
  }
  const answerSdp = await res.text();
  await pc.setRemoteDescription({ type: 'answer', sdp: answerSdp });

  const location = res.headers.get('Location');
  const resourceUrl = location ? new URL(location, whipUrl).toString() : null;

  return { pc, resourceUrl, localStream };
}

export async function stopWhip(session: WhipSession | null): Promise<void> {
  if (!session) return;
  try {
    session.localStream?.getTracks().forEach((t) => t.stop());
  } catch {
    /* ignore */
  }
  try {
    session.pc.close();
  } catch {
    /* ignore */
  }
  if (session.resourceUrl) {
    try {
      await fetch(session.resourceUrl, { method: 'DELETE' });
    } catch {
      /* best-effort */
    }
  }
}
