'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { VideoCameraIcon, StopIcon } from '@heroicons/react/24/solid';
import { useLocale } from '../LocaleProvider';

type Props = {
  onRecorded: (file: File) => void;
  maxSeconds?: number;
};

export default function ReelCameraRecorder({ onRecorded, maxSeconds = 60 }: Props) {
  const { t } = useLocale();
  const videoRef = useRef<HTMLVideoElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState('');

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => () => stopStream(), [stopStream]);

  const startCamera = async () => {
    setError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user' },
        audio: true,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
    } catch {
      setError(t('reels.cameraAccessDenied'));
    }
  };

  const startRecording = async () => {
    if (!streamRef.current) await startCamera();
    const stream = streamRef.current;
    if (!stream) return;
    chunksRef.current = [];
    const recorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
    recorderRef.current = recorder;
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: 'video/webm' });
      const file = new File([blob], `signal-${Date.now()}.webm`, { type: 'video/webm' });
      onRecorded(file);
      stopStream();
      setRecording(false);
      setSeconds(0);
    };
    recorder.start(250);
    setRecording(true);
    setSeconds(0);
  };

  const stopRecording = () => {
    recorderRef.current?.stop();
  };

  useEffect(() => {
    if (!recording) return;
    const id = setInterval(() => {
      setSeconds((s) => {
        if (s + 1 >= maxSeconds) {
          stopRecording();
          return maxSeconds;
        }
        return s + 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [recording, maxSeconds]);

  return (
    <div className="reels-create__camera rounded-xl border border-surface p-3 mb-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-text-secondary">{t('reels.cameraRecordTitle')}</span>
        {recording && <span className="text-xs text-red-400">{seconds}s</span>}
      </div>
      <video
        ref={videoRef}
        className="w-full max-h-48 rounded-lg bg-black object-cover"
        muted
        playsInline
      />
      {error && <p className="text-xs text-red-400 mt-2">{error}</p>}
      <div className="flex gap-2 mt-2">
        {!recording ? (
          <>
            <button type="button" className="reels-create__mood flex-1" onClick={() => void startCamera()}>
              {t('reels.cameraPreview')}
            </button>
            <button
              type="button"
              className="reels-create__submit flex-1 !py-2 inline-flex items-center justify-center gap-1"
              onClick={() => void startRecording()}
            >
              <VideoCameraIcon className="h-4 w-4" />
              {t('reels.cameraRecord')}
            </button>
          </>
        ) : (
          <button
            type="button"
            className="reels-create__submit w-full !py-2 inline-flex items-center justify-center gap-1"
            onClick={stopRecording}
          >
            <StopIcon className="h-4 w-4" />
            {t('reels.cameraStop')}
          </button>
        )}
      </div>
    </div>
  );
}
