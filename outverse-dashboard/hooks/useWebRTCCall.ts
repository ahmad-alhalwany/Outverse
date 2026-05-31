'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { apiFetch } from '@/lib/api';
import type { SignalPayload } from './useSignalWebSocket';

const DEFAULT_ICE: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

export type CallKind = 'audio' | 'video';

export type IncomingCall = {
  callId: string;
  fromUserId: number;
  fromName: string;
  fromAvatar: string | null;
  callType: CallKind;
  sdp: RTCSessionDescriptionInit;
};

type SendSignal = (payload: SignalPayload) => boolean;

export function useWebRTCCall(
  meId: number,
  sendSignal: SendSignal,
  onRemoteHangup: () => void,
) {
  const [callActive, setCallActive] = useState(false);
  const [incoming, setIncoming] = useState<IncomingCall | null>(null);
  const [callKind, setCallKind] = useState<CallKind>('audio');
  const [muted, setMuted] = useState(false);
  const [remoteMuted, setRemoteMuted] = useState(false);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const callIdRef = useRef<string | null>(null);
  const peerIdRef = useRef<number | null>(null);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const iceConfigRef = useRef<RTCConfiguration>(DEFAULT_ICE);

  useEffect(() => {
    apiFetch('chat/config/')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.ice_servers?.length) {
          iceConfigRef.current = { iceServers: data.ice_servers };
        }
      })
      .catch(() => {});
  }, []);

  const cleanup = useCallback(() => {
    pcRef.current?.close();
    pcRef.current = null;
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
    callIdRef.current = null;
    peerIdRef.current = null;
    setCallActive(false);
    setIncoming(null);
    if (localVideoRef.current) localVideoRef.current.srcObject = null;
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
  }, []);

  const attachStreams = useCallback((pc: RTCPeerConnection) => {
    pc.ontrack = (ev) => {
      const [stream] = ev.streams;
      if (remoteVideoRef.current && stream) {
        remoteVideoRef.current.srcObject = stream;
      }
    };
  }, []);

  const getMedia = useCallback(async (kind: CallKind) => {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: kind === 'video',
    });
    localStreamRef.current = stream;
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = stream;
    }
    return stream;
  }, []);

  const createPeer = useCallback(
    async (kind: CallKind) => {
      const pc = new RTCPeerConnection(iceConfigRef.current);
      pcRef.current = pc;
      attachStreams(pc);
      const stream = await getMedia(kind);
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));
      pc.onicecandidate = (ev) => {
        if (ev.candidate && peerIdRef.current && callIdRef.current) {
          sendSignal({
            type: 'call.ice',
            to_user_id: peerIdRef.current,
            call_id: callIdRef.current,
            candidate: ev.candidate.toJSON(),
          });
        }
      };
      return pc;
    },
    [attachStreams, getMedia, sendSignal],
  );

  const startCall = useCallback(
    async (
      peerId: number,
      kind: CallKind,
      myName: string,
      myAvatar: string | null,
    ) => {
      if (callActive || incoming) return;
      const callId = crypto.randomUUID();
      callIdRef.current = callId;
      peerIdRef.current = peerId;
      setCallKind(kind);
      try {
        const pc = await createPeer(kind);
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        sendSignal({
          type: 'call.offer',
          to_user_id: peerId,
          call_id: callId,
          call_type: kind,
          from_user_name: myName,
          from_avatar: myAvatar,
          sdp: offer,
        });
        setCallActive(true);
      } catch {
        cleanup();
        throw new Error('Could not access camera/microphone');
      }
    },
    [callActive, incoming, createPeer, sendSignal, cleanup],
  );

  const acceptCall = useCallback(async () => {
    if (!incoming) return;
    const call = incoming;
    setIncoming(null);
    callIdRef.current = call.callId;
    peerIdRef.current = call.fromUserId;
    setCallKind(call.callType);
    try {
      const pc = await createPeer(call.callType);
      await pc.setRemoteDescription(new RTCSessionDescription(call.sdp));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      sendSignal({
        type: 'call.answer',
        to_user_id: call.fromUserId,
        call_id: call.callId,
        sdp: answer,
      });
      setCallActive(true);
    } catch {
      cleanup();
      sendSignal({
        type: 'call.reject',
        to_user_id: call.fromUserId,
        call_id: call.callId,
      });
    }
  }, [incoming, createPeer, sendSignal, cleanup]);

  const rejectCall = useCallback(() => {
    if (!incoming) return;
    sendSignal({
      type: 'call.reject',
      to_user_id: incoming.fromUserId,
      call_id: incoming.callId,
    });
    setIncoming(null);
  }, [incoming, sendSignal]);

  const hangUp = useCallback(() => {
    const peer = peerIdRef.current;
    const callId = callIdRef.current;
    if (peer && callId) {
      sendSignal({ type: 'call.hangup', to_user_id: peer, call_id: callId });
    }
    cleanup();
  }, [sendSignal, cleanup]);

  const handleSignal = useCallback(
    async (payload: SignalPayload) => {
      const t = payload.type as string;
      const callId = payload.call_id as string | undefined;

      if (t === 'call.offer' && payload.from_user_id !== meId) {
        if (callActive || incoming) {
          sendSignal({
            type: 'call.busy',
            to_user_id: payload.from_user_id as number,
            call_id: callId,
          });
          return;
        }
        setIncoming({
          callId: callId || '',
          fromUserId: payload.from_user_id as number,
          fromName: (payload.from_user_name as string) || 'Friend',
          fromAvatar: (payload.from_avatar as string) || null,
          callType: (payload.call_type as CallKind) || 'audio',
          sdp: payload.sdp as RTCSessionDescriptionInit,
        });
        return;
      }

      if (callId && callIdRef.current && callId !== callIdRef.current) return;

      if (t === 'call.answer' && pcRef.current && payload.sdp) {
        await pcRef.current.setRemoteDescription(
          new RTCSessionDescription(payload.sdp as RTCSessionDescriptionInit),
        );
        setCallActive(true);
      } else if (t === 'call.ice' && pcRef.current && payload.candidate) {
        try {
          await pcRef.current.addIceCandidate(
            new RTCIceCandidate(payload.candidate as RTCIceCandidateInit),
          );
        } catch {
          /* ignore */
        }
      } else if (t === 'call.hangup' || t === 'call.reject' || t === 'call.busy') {
        if (incoming) setIncoming(null);
        else {
          cleanup();
          onRemoteHangup();
        }
      }
    },
    [meId, callActive, incoming, sendSignal, cleanup, onRemoteHangup],
  );

  const toggleMute = useCallback(() => {
    const stream = localStreamRef.current;
    if (!stream) return;
    stream.getAudioTracks().forEach((t) => {
      t.enabled = !t.enabled;
    });
    setMuted((m) => !m);
  }, []);

  return {
    callActive,
    incoming,
    callKind,
    muted,
    remoteMuted,
    localVideoRef,
    remoteVideoRef,
    startCall,
    acceptCall,
    rejectCall,
    hangUp,
    handleSignal,
    toggleMute,
    cleanup,
    setRemoteMuted,
  };
}
