'use client';

import { useEffect, useRef } from 'react';
import { PhoneXMarkIcon, MicrophoneIcon } from '@heroicons/react/24/outline';
import { MicrophoneIcon as MicSolid } from '@heroicons/react/24/solid';
import type { CallKind } from '@/hooks/useWebRTCCall';
import type { GroupCallPeer } from '@/hooks/useGroupCall';

type Props = {
  roomName: string;
  callKind: CallKind;
  muted: boolean;
  peers: GroupCallPeer[];
  localVideoRef: React.RefObject<HTMLVideoElement | null>;
  onHangUp: () => void;
  onToggleMute: () => void;
};

function PeerTile({ peer, kind }: { peer: GroupCallPeer; kind: CallKind }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  useEffect(() => {
    if (videoRef.current) videoRef.current.srcObject = peer.stream;
  }, [peer.stream]);
  return (
    <div className="cosmic-call-tile">
      {kind === 'video' ? (
        <video ref={videoRef} autoPlay playsInline className="cosmic-call-tile-video" />
      ) : (
        <div className="cosmic-call-tile-avatar">{peer.name.slice(0, 1).toUpperCase()}</div>
      )}
      <span className="cosmic-call-tile-name">{peer.name}</span>
    </div>
  );
}

export default function GroupCallOverlay({
  roomName,
  callKind,
  muted,
  peers,
  localVideoRef,
  onHangUp,
  onToggleMute,
}: Props) {
  return (
    <div className="cosmic-call-overlay">
      <div className="cosmic-call-panel cosmic-call-panel--group">
        <h2 className="cosmic-call-title">{roomName}</h2>
        <p className="cosmic-call-sub">
          {peers.length === 0
            ? 'Waiting for others to join…'
            : `${peers.length} other${peers.length === 1 ? '' : 's'} on the call`}
        </p>
        <div className="cosmic-call-grid">
          {callKind === 'video' && (
            <div className="cosmic-call-tile cosmic-call-tile--local">
              <video ref={localVideoRef as React.Ref<HTMLVideoElement>} autoPlay playsInline muted className="cosmic-call-tile-video" />
              <span className="cosmic-call-tile-name">You</span>
            </div>
          )}
          {peers.map((peer) => (
            <PeerTile key={peer.userId} peer={peer} kind={callKind} />
          ))}
        </div>
        <div className="cosmic-call-toolbar">
          <button type="button" className="cosmic-call-round" onClick={onToggleMute} title={muted ? 'Unmute' : 'Mute'}>
            {muted ? <MicrophoneIcon className="h-6 w-6" /> : <MicSolid className="h-6 w-6" />}
          </button>
          <button type="button" className="cosmic-call-round cosmic-call-round--end" onClick={onHangUp} title="Leave call">
            <PhoneXMarkIcon className="h-6 w-6" />
          </button>
        </div>
      </div>
    </div>
  );
}
