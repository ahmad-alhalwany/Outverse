import { useRef } from "react";

export default function useSound(src: string, volume: number = 1) {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const play = () => {
    if (!audioRef.current) {
      audioRef.current = new Audio(src);
      audioRef.current.volume = volume;
    }
    // إعادة تشغيل الصوت من البداية
    audioRef.current.currentTime = 0;
    audioRef.current.play();
  };

  return play;
} 