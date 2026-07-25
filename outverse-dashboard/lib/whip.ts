/**
 * Minimal WHIP (WebRTC-HTTP Ingestion Protocol) publisher.
 * Publishes a local MediaStream to a WHIP-compatible ingest endpoint
 * (e.g. Cloudflare Stream's live input `webRTC.url`) with a single
 * offer/answer exchange — no trickle ICE, matching what most WHIP
 * ingest servers expect for a simple one-shot publish.
 */

export type WhipSession = {
  pc: RTCPeerConnection;
  resourceUrl: string | null;
};

function waitForIceGatheringComplete(pc: RTCPeerConnection): Promise<void> {
  if (pc.iceGatheringState === 'complete') return Promise.resolve();
  return new Promise((resolve) => {
    const timeout = setTimeout(resolve, 4000); // don't hang forever on a slow/partial gather
    function check() {
      if (pc.iceGatheringState === 'complete') {
        clearTimeout(timeout);
        pc.removeEventListener('icegatheringstatechange', check);
        resolve();
      }
    }
    pc.addEventListener('icegatheringstatechange', check);
  });
}

export async function publishWhip(stream: MediaStream, whipUrl: string): Promise<WhipSession> {
  const pc = new RTCPeerConnection();
  stream.getTracks().forEach((track) => pc.addTrack(track, stream));

  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  await waitForIceGatheringComplete(pc);

  const res = await fetch(whipUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/sdp' },
    body: pc.localDescription?.sdp ?? offer.sdp,
  });
  if (!res.ok) {
    pc.close();
    throw new Error(`WHIP publish failed: ${res.status}`);
  }
  const answerSdp = await res.text();
  await pc.setRemoteDescription({ type: 'answer', sdp: answerSdp });

  const location = res.headers.get('Location');
  const resourceUrl = location ? new URL(location, whipUrl).toString() : null;

  return { pc, resourceUrl };
}

export async function stopWhip(session: WhipSession | null): Promise<void> {
  if (!session) return;
  session.pc.close();
  if (session.resourceUrl) {
    try {
      await fetch(session.resourceUrl, { method: 'DELETE' });
    } catch {
      // best-effort — the ingest will time the session out on its own either way
    }
  }
}
