import React, { useRef, useState } from 'react';

interface CosmicVideoPlayerProps {
  src: string;
  poster?: string;
  className?: string;
  style?: React.CSSProperties;
  isStory?: boolean;
  autoPlay?: boolean;
  muted?: boolean;
  loop?: boolean;
}

const formatTime = (s: number) => {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec < 10 ? '0' : ''}${sec}`;
};

// مكون جزيئات النجوم
const CosmicParticles = () => (
  <div className="pointer-events-none absolute inset-0 z-10">
    {[...Array(18)].map((_, i) => (
      <span
        key={i}
        className="absolute rounded-full bg-white/70 shadow-lg animate-cosmic-particle"
        style={{
          width: `${Math.random() * 3 + 2}px`,
          height: `${Math.random() * 3 + 2}px`,
          left: `${Math.random() * 98}%`,
          top: `${Math.random() * 98}%`,
          opacity: Math.random() * 0.7 + 0.2,
          animationDuration: `${Math.random() * 3 + 2}s`,
          animationDelay: `${Math.random() * 2}s`,
        }}
      />
    ))}
  </div>
);

const CosmicVideoPlayer: React.FC<CosmicVideoPlayerProps> = ({ 
  src, 
  poster, 
  className = '', 
  style,
  isStory = false,
  autoPlay = false,
  muted: initialMuted = false,
  loop = false
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [muted, setMuted] = useState(initialMuted);
  const [seeking, setSeeking] = useState(false);

  // بدء تشغيل الفيديو تلقائياً في الستوري
  React.useEffect(() => {
    if (isStory && autoPlay && videoRef.current) {
      const playVideo = async () => {
        try {
          await videoRef.current?.play();
        } catch (error) {
          console.log('Auto-play prevented by browser');
        }
      };
      playVideo();
    }
  }, [isStory, autoPlay]);

  // ضبط مدة الفيديو في الستوري (حد أقصى 30 ثانية)
  React.useEffect(() => {
    if (isStory && videoRef.current) {
      const handleDurationChange = () => {
        if (videoRef.current && videoRef.current.duration > 30) {
          // إذا كان الفيديو أطول من 30 ثانية، نضبطه
          videoRef.current.currentTime = 0;
          // سنقوم بإيقاف الفيديو عند 30 ثانية
          const timeout = setTimeout(() => {
            if (videoRef.current) {
              videoRef.current.currentTime = 0;
              videoRef.current.play();
            }
          }, 30000);
          
          return () => clearTimeout(timeout);
        }
      };
      
      videoRef.current.addEventListener('loadedmetadata', handleDurationChange);
      return () => {
        videoRef.current?.removeEventListener('loadedmetadata', handleDurationChange);
      };
    }
  }, [isStory]);

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) { v.play(); setPlaying(true); }
    else { v.pause(); setPlaying(false); }
  };
  const handleTimeUpdate = () => {
    if (!seeking) setCurrent(videoRef.current?.currentTime || 0);
  };
  const handleLoaded = () => {
    setDuration(videoRef.current?.duration || 0);
  };
  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Number(e.target.value);
    setCurrent(val);
    if (videoRef.current) videoRef.current.currentTime = val;
  };
  const handleSeekStart = () => setSeeking(true);
  const handleSeekEnd = () => { setSeeking(false); };
  const skip = (sec: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = Math.max(0, Math.min(duration, (videoRef.current.currentTime || 0) + sec));
      setCurrent(videoRef.current.currentTime);
    }
  };
  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !muted;
      setMuted(!muted);
    }
  };

  return (
    <div className={`relative rounded-2xl overflow-hidden shadow-xl bg-black/80 ${className}`} style={style}>
      {/* جزيئات النجوم */}
      <CosmicParticles />
      {/* توهج وتدرج فضائي حول الإطار */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div
          className="w-full h-full rounded-2xl"
          style={{
            boxShadow: '0 0 32px 8px #6a00ff55, 0 0 80px 16px #00ccff33',
            background: 'linear-gradient(120deg, #6a00ff55 0%, #00ccff33 100%)',
            opacity: 0.7,
            filter: 'blur(8px)',
          }}
        />
      </div>
      <video
        ref={videoRef}
        src={src}
        poster={poster}
        className="w-full h-full object-cover relative z-10"
        style={{ minHeight: 320, minWidth: 320, maxHeight: 480 }}
        controls={false}
        preload="metadata"
        autoPlay={autoPlay}
        muted={muted}
        loop={loop}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoaded}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => {
          // في الستوري، لا نعيد تشغيل الفيديو تلقائياً
          // سنترك الستوري ينتقل للوسيط التالي أو القصة التالية
          if (!isStory && loop) {
            // فقط في البوستات العادية مع loop
            if (videoRef.current) {
              videoRef.current.currentTime = 0;
              videoRef.current.play();
            }
          }
        }}
      />
      {/* عناصر التحكم - مخفية في الستوري */}
      {!isStory && (
        <div className="absolute bottom-0 left-0 w-full flex flex-col items-center bg-gradient-to-t from-black/80 via-black/30 to-transparent p-3 z-20">
        {/* شريط التقدم الكوني */}
        <div className="relative w-full flex items-center mb-2" style={{ height: 18 }}>
          {/* الشريط الخلفي */}
          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-2 rounded-full bg-gradient-to-r from-purple-800 via-blue-600 to-cyan-400 opacity-40 blur-sm" />
          {/* الشريط الأمامي */}
          <div
            className="absolute left-0 top-1/2 -translate-y-1/2 h-2 rounded-full"
            style={{
              width: duration ? `${(current / duration) * 100}%` : '0%',
              background: 'linear-gradient(90deg, #a259ff 0%, #00dbde 100%)',
              boxShadow: '0 0 12px 2px #a259ff99, 0 0 24px 4px #00dbde55',
              transition: 'width 0.2s',
            }}
          />
          {/* comet/sparkle */}
          {duration > 0 && (
            <div
              className="absolute top-1/2 -translate-y-1/2"
              style={{
                left: `calc(${(current / duration) * 100}% - 10px)`,
                transition: 'left 0.2s',
              }}
            >
              <div className="w-5 h-5 rounded-full bg-gradient-to-tr from-cyan-300 via-purple-400 to-fuchsia-500 shadow-lg border-2 border-white animate-pulse flex items-center justify-center">
                <div className="w-2 h-2 rounded-full bg-white/90 animate-ping" />
              </div>
            </div>
          )}
          {/* input range الشفاف فوق الشريط */}
          <input
            type="range"
            min={0}
            max={duration}
            step={0.1}
            value={current}
            onChange={handleSeek}
            onMouseDown={handleSeekStart}
            onMouseUp={handleSeekEnd}
            className="w-full h-6 opacity-0 cursor-pointer z-10"
            style={{ position: 'absolute', left: 0, top: 0 }}
          />
        </div>
        <div className="flex items-center justify-between w-full gap-2">
          {/* زر تشغيل/إيقاف */}
          <button
            onClick={togglePlay}
            className="cosmic-btn"
            style={{ boxShadow: playing ? '0 0 16px 4px #a259ff99, 0 0 32px 8px #00dbde55' : '0 0 8px 2px #a259ff55' }}
          >
            {playing ? (
              <svg width="22" height="22" fill="none" viewBox="0 0 24 24"><rect x="6" y="5" width="4" height="14" rx="1" fill="currentColor"/><rect x="14" y="5" width="4" height="14" rx="1" fill="currentColor"/></svg>
            ) : (
              <svg width="22" height="22" fill="none" viewBox="0 0 24 24"><path d="M7 5v14l11-7L7 5z" fill="currentColor"/></svg>
            )}
          </button>
          {/* تقديم/تأخير */}
          <button onClick={() => skip(-10)} className="cosmic-btn text-xs px-2">&#8678; 10s</button>
          <button onClick={() => skip(10)} className="cosmic-btn text-xs px-2">10s &#8680;</button>
          {/* الوقت */}
          <span className="text-xs text-white/80 min-w-[60px] text-center">
            {formatTime(current)} / {formatTime(duration)}
          </span>
          {/* صوت */}
          <button onClick={toggleMute} className="cosmic-btn">
            {muted ? (
              <svg width="20" height="20" fill="none" viewBox="0 0 24 24"><path d="M9 9v6h4l5 5V4l-5 5H9z" fill="currentColor"/><path d="M19 5L5 19" stroke="currentColor" strokeWidth="2"/></svg>
            ) : (
              <svg width="20" height="20" fill="none" viewBox="0 0 24 24"><path d="M9 9v6h4l5 5V4l-5 5H9z" fill="currentColor"/></svg>
            )}
          </button>
        </div>
      </div>
      )}
    </div>
  );
};

export default CosmicVideoPlayer; 