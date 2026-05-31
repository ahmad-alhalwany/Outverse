'use client';

import { PhoneXMarkIcon, MicrophoneIcon } from '@heroicons/react/24/outline';
import { MicrophoneIcon as MicSolid } from '@heroicons/react/24/solid';
import type { CallKind, IncomingCall } from '@/hooks/useWebRTCCall';
import { mediaUrl } from '@/lib/api';

type Props = {
  mode: 'incoming' | 'active';
  callKind: CallKind;
  peerName: string;
  peerAvatar: string | null;
  incoming?: IncomingCall | null;
  muted: boolean;
  localVideoRef: React.RefObject<HTMLVideoElement | null>;
  remoteVideoRef: React.RefObject<HTMLVideoElement | null>;
  onAccept: () => void;
  onReject: () => void;
  onHangUp: () => void;
  onToggleMute: () => void;
};

function avatarSrc(name: string, avatar: string | null) {
  if (avatar) return mediaUrl(avatar);
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=a0563b&color=fff&size=128`;
}

export default function CallOverlay({
  mode,
  callKind,
  peerName,
  peerAvatar,
  incoming,
  muted,
  localVideoRef,
  remoteVideoRef,
  onAccept,
  onReject,
  onHangUp,
  onToggleMute,
}: Props) {
  const name = incoming?.fromName || peerName;
  const avatar = incoming?.fromAvatar ?? peerAvatar;
  const kind = incoming?.callType || callKind;

  return (
    <div className="cosmic-call-overlay">
      <div className="cosmic-call-panel">
        {mode === 'incoming' && incoming ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={avatarSrc(name, avatar)} alt="" className="cosmic-call-avatar" />
            <h2 className="cosmic-call-title">{name}</h2>
            <p className="cosmic-call-sub">
              Incoming {kind === 'video' ? 'video' : 'voice'} call…
            </p>
            <div className="cosmic-call-actions">
              <button type="button" className="cosmic-call-btn cosmic-call-btn--reject" onClick={onReject}>
                Decline
              </button>
              <button type="button" className="cosmic-call-btn cosmic-call-btn--accept" onClick={onAccept}>
                Accept
              </button>
            </div>
          </>
        ) : (
          <>
            <div className={`cosmic-call-videos${kind === 'audio' ? ' cosmic-call-videos--audio' : ''}`}>
              <video ref={remoteVideoRef as React.Ref<HTMLVideoElement>} autoPlay playsInline className="cosmic-call-remote" />
              {kind === 'video' && (
                <video ref={localVideoRef as React.Ref<HTMLVideoElement>} autoPlay playsInline muted className="cosmic-call-local" />
              )}
            </div>
            <p className="cosmic-call-sub">{peerName} · {kind === 'video' ? 'Video' : 'Voice'}</p>
            <div className="cosmic-call-toolbar">
              <button type="button" className="cosmic-call-round" onClick={onToggleMute} title={muted ? 'Unmute' : 'Mute'}>
                {muted ? <MicrophoneIcon className="h-6 w-6" /> : <MicSolid className="h-6 w-6" />}
              </button>
              <button type="button" className="cosmic-call-round cosmic-call-round--end" onClick={onHangUp} title="End call">
                <PhoneXMarkIcon className="h-6 w-6" />
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
