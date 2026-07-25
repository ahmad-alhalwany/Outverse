import { useCallback, useRef, useState } from 'react';
import {
  mediaDevices,
  RTCPeerConnection,
  RTCIceCandidate,
  RTCSessionDescription,
  type MediaStream,
} from 'react-native-webrtc';
import { getChatRuntimeConfig } from '@/api/ws';
import type { SignalPayload } from './useSignalWebSocket';
import type { CallKind } from './useWebRTCCall';

// react-native-webrtc defines this interface but doesn't re-export it from
// the package root — mirrors RTCSessionDescription.d.ts (sdp is required).
type RTCSessionDescriptionInit = { sdp: string; type: string | null };

const DEFAULT_ICE: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

export type GroupCallPeer = {
  userId: number;
  name: string;
  streamUrl: string | null;
};

type SendSignal = (payload: SignalPayload) => boolean;

function createCallId() {
  return `room_call_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

function streamUrl(stream: MediaStream | null) {
  return stream ? stream.toURL() : null;
}

export function useGroupCall(meId: number, myName: string, sendSignal: SendSignal) {
  const [active, setActive] = useState(false);
  const [roomId, setRoomId] = useState<number | null>(null);
  const [callKind, setCallKind] = useState<CallKind>('audio');
  const [muted, setMuted] = useState(false);
  const [peers, setPeers] = useState<GroupCallPeer[]>([]);
  const [localStreamUrl, setLocalStreamUrl] = useState<string | null>(null);

  const roomIdRef = useRef<number | null>(null);
  const callIdRef = useRef<string | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const iceConfigRef = useRef<RTCConfiguration>(DEFAULT_ICE);
  const pcsRef = useRef<Map<number, any>>(new Map());
  const namesRef = useRef<Map<number, string>>(new Map());
  const streamsRef = useRef<Map<number, string | null>>(new Map());

  const refreshPeers = useCallback(() => {
    setPeers(
      Array.from(pcsRef.current.keys()).map((uid) => ({
        userId: uid,
        name: namesRef.current.get(uid) || `User ${uid}`,
        streamUrl: streamsRef.current.get(uid) || null,
      })),
    );
  }, []);

  const closePeer = useCallback(
    (uid: number) => {
      pcsRef.current.get(uid)?.close();
      pcsRef.current.delete(uid);
      namesRef.current.delete(uid);
      streamsRef.current.delete(uid);
      refreshPeers();
    },
    [refreshPeers],
  );

  const cleanup = useCallback(() => {
    pcsRef.current.forEach((pc) => pc.close());
    pcsRef.current.clear();
    namesRef.current.clear();
    streamsRef.current.clear();
    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    localStreamRef.current = null;
    roomIdRef.current = null;
    callIdRef.current = null;
    setActive(false);
    setRoomId(null);
    setPeers([]);
    setMuted(false);
    setLocalStreamUrl(null);
  }, []);

  const getMedia = useCallback(async (kind: CallKind) => {
    if (localStreamRef.current) return localStreamRef.current;
    const stream = await mediaDevices.getUserMedia({
      audio: true,
      video: kind === 'video',
    });
    localStreamRef.current = stream;
    setLocalStreamUrl(streamUrl(stream));
    return stream;
  }, []);

  const createPeerConnection = useCallback(
    (targetUserId: number) => {
      const pc = new RTCPeerConnection(iceConfigRef.current as any) as any;
      pcsRef.current.set(targetUserId, pc);

      pc.ontrack = (ev: any) => {
        const [stream] = ev.streams;
        streamsRef.current.set(targetUserId, streamUrl((stream as MediaStream) || null));
        refreshPeers();
      };
      pc.onicecandidate = (ev: any) => {
        if (ev.candidate && roomIdRef.current && callIdRef.current) {
          const candidate =
            typeof ev.candidate.toJSON === 'function' ? ev.candidate.toJSON() : ev.candidate;
          sendSignal({
            type: 'call.room.ice',
            room_id: roomIdRef.current,
            call_id: callIdRef.current,
            to_user_id: targetUserId,
            candidate,
          });
        }
      };
      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
          closePeer(targetUserId);
        }
      };

      const stream = localStreamRef.current;
      if (stream) {
        stream.getTracks().forEach((track) => pc.addTrack(track, stream));
      }
      return pc;
    },
    [sendSignal, refreshPeers, closePeer],
  );

  const offerTo = useCallback(
    async (targetUserId: number) => {
      const pc = createPeerConnection(targetUserId);
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      sendSignal({
        type: 'call.room.offer',
        room_id: roomIdRef.current,
        call_id: callIdRef.current,
        to_user_id: targetUserId,
        from_user_name: myName,
        sdp: offer,
      });
    },
    [createPeerConnection, sendSignal, myName],
  );

  const joinGroupCall = useCallback(
    async (targetRoomId: number, kind: CallKind) => {
      if (active) return;
      try {
        const config = await getChatRuntimeConfig();
        if (config?.ice_servers?.length) iceConfigRef.current = { iceServers: config.ice_servers };
      } catch {
        /* keep default STUN */
      }
      roomIdRef.current = targetRoomId;
      callIdRef.current = createCallId();
      setRoomId(targetRoomId);
      setCallKind(kind);
      try {
        await getMedia(kind);
      } catch {
        cleanup();
        throw new Error('Could not access camera/microphone');
      }
      setActive(true);
      sendSignal({
        type: 'call.room.offer',
        room_id: targetRoomId,
        call_id: callIdRef.current,
        from_user_name: myName,
      });
    },
    [active, getMedia, sendSignal, myName, cleanup],
  );

  const leaveGroupCall = useCallback(() => {
    if (roomIdRef.current && callIdRef.current) {
      sendSignal({
        type: 'call.room.hangup',
        room_id: roomIdRef.current,
        call_id: callIdRef.current,
      });
    }
    cleanup();
  }, [sendSignal, cleanup]);

  const toggleMute = useCallback(() => {
    const stream = localStreamRef.current;
    if (!stream) return;
    stream.getAudioTracks().forEach((track) => {
      track.enabled = !track.enabled;
    });
    setMuted((value) => !value);
  }, []);

  const handleGroupSignal = useCallback(
    async (payload: SignalPayload) => {
      const t = payload.type;
      if (!t.startsWith('call.room.')) return;
      const fromUserId = payload.from_user_id as number;
      if (!fromUserId || fromUserId === meId) return;
      if (!active || Number(payload.room_id) !== roomIdRef.current) return;
      const toUserId = payload.to_user_id as number | undefined;
      if (toUserId && toUserId !== meId) return;

      if (payload.from_user_name) {
        namesRef.current.set(fromUserId, payload.from_user_name as string);
      }

      if (t === 'call.room.offer' && !toUserId && !payload.sdp) {
        if (!pcsRef.current.has(fromUserId)) {
          if (meId < fromUserId) {
            await offerTo(fromUserId);
          } else {
            sendSignal({
              type: 'call.room.offer',
              room_id: roomIdRef.current,
              call_id: callIdRef.current,
              from_user_name: myName,
            });
          }
        }
        return;
      }

      if (t === 'call.room.offer' && toUserId === meId && payload.sdp) {
        const pc = createPeerConnection(fromUserId);
        await pc.setRemoteDescription(
          new RTCSessionDescription(payload.sdp as RTCSessionDescriptionInit),
        );
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        sendSignal({
          type: 'call.room.answer',
          room_id: roomIdRef.current,
          call_id: callIdRef.current,
          to_user_id: fromUserId,
          sdp: answer,
        });
        refreshPeers();
        return;
      }

      if (t === 'call.room.answer' && toUserId === meId && payload.sdp) {
        const pc = pcsRef.current.get(fromUserId);
        if (pc) {
          await pc.setRemoteDescription(
            new RTCSessionDescription(payload.sdp as RTCSessionDescriptionInit),
          );
        }
        return;
      }

      if (t === 'call.room.ice' && toUserId === meId && payload.candidate) {
        const pc = pcsRef.current.get(fromUserId);
        if (pc) {
          try {
            await pc.addIceCandidate(
              new RTCIceCandidate(payload.candidate as RTCIceCandidateInit),
            );
          } catch {
            /* ignore stale ICE */
          }
        }
        return;
      }

      if (t === 'call.room.hangup') {
        closePeer(fromUserId);
      }
    },
    [meId, active, offerTo, createPeerConnection, sendSignal, myName, closePeer, refreshPeers],
  );

  return {
    active,
    roomId,
    callKind,
    muted,
    peers,
    localStreamUrl,
    joinGroupCall,
    leaveGroupCall,
    toggleMute,
    handleGroupSignal,
  };
}
