import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface ShareBottleAnimationProps {
  onClose: () => void;
}

export default function ShareBottleAnimation({ onClose }: ShareBottleAnimationProps) {
  const [showPlatforms, setShowPlatforms] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setShowPlatforms(true), 1200); // بعد انتهاء أنيميشن الزجاجة
    return () => clearTimeout(timer);
  }, []);

  const platforms = [
    { name: "Twitter", icon: "🐦", color: "#1da1f2" },
    { name: "WhatsApp", icon: "🟢", color: "#25d366" },
    { name: "Facebook", icon: "📘", color: "#1877f3" },
  ];

  // توزيع الأيقونات في نصف دائرة حول الصاروخ
  const radius = 90; // نصف قطر القوس
  const centerX = 0;
  const centerY = 0;
  const angleStep = Math.PI / (platforms.length + 1);

  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center z-50 pointer-events-auto">
      {/* خلفية شفافة مع Blur */}
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ y: 100, opacity: 0, scale: 0.7 }}
        animate={{ y: -80, opacity: 1, scale: 1 }}
        exit={{ y: -200, opacity: 0, scale: 0.5 }}
        transition={{ duration: 1.2, type: "spring" }}
        className="drop-shadow-2xl relative flex flex-col items-center"
      >
        {/* زر إغلاق */}
        <button
          onClick={onClose}
          className="absolute -top-8 right-0 bg-white/80 hover:bg-white text-gray-700 rounded-full w-8 h-8 flex items-center justify-center shadow focus:outline-none z-10 border border-gray-200"
          tabIndex={0}
          aria-label="Close share dialog"
        >
          ×
        </button>
        {/* SVG صاروخ محسّن مع تغبيش عند ظهور الأيقونات */}
        <div className={`transition-all duration-500 ${showPlatforms ? 'blur-sm opacity-70' : ''}`} style={{ zIndex: 2 }}>
          <svg width="100" height="200" viewBox="0 0 100 200" fill="none" xmlns="http://www.w3.org/2000/svg">
            {/* لهب الصاروخ */}
            <ellipse cx="50" cy="185" rx="18" ry="12" fill="url(#flame)" opacity="0.7"/>
            <defs>
              <radialGradient id="flame" cx="0.5" cy="0.5" r="0.5" fx="0.5" fy="0.5">
                <stop offset="0%" stopColor="#fff176"/>
                <stop offset="60%" stopColor="#ff9800"/>
                <stop offset="100%" stopColor="#f44336"/>
              </radialGradient>
              <linearGradient id="body" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#90caf9"/>
                <stop offset="100%" stopColor="#1565c0"/>
              </linearGradient>
            </defs>
            {/* جسم الصاروخ */}
            <rect x="30" y="50" width="40" height="100" rx="20" fill="url(#body)" stroke="#222" strokeWidth="2"/>
            {/* نافذة */}
            <ellipse cx="50" cy="90" rx="10" ry="12" fill="#fff" stroke="#1976d2" strokeWidth="2"/>
            {/* رأس الصاروخ */}
            <ellipse cx="50" cy="40" rx="20" ry="12" fill="#b3e0ff" stroke="#222" strokeWidth="2"/>
            <ellipse cx="50" cy="30" rx="10" ry="10" fill="#fff" stroke="#222" strokeWidth="2"/>
            {/* ظل أسفل */}
            <ellipse cx="50" cy="160" rx="22" ry="10" fill="#b3e0ff" opacity="0.4"/>
          </svg>
        </div>
        {/* أيقونات المنصات في نصف دائرة حول الصاروخ */}
        <AnimatePresence>
          {showPlatforms && (
            <motion.div
              initial="hidden"
              animate="visible"
              exit="hidden"
              variants={{
                visible: { transition: { staggerChildren: 0.15 } },
                hidden: {},
              }}
              className="absolute left-1/2 -translate-x-1/2 top-[140px] w-[220px] h-[120px] flex items-center justify-center pointer-events-auto"
              style={{ zIndex: 3 }}
            >
              {platforms.map((p, i) => {
                // توزيع في نصف دائرة
                const angle = Math.PI + angleStep * (i + 1);
                const x = centerX + radius * Math.cos(angle);
                const y = centerY + radius * Math.sin(angle);
                return (
                  <motion.button
                    key={p.name}
                    initial={{ opacity: 0, scale: 0.7, x: 0, y: 0 }}
                    animate={{ opacity: 1, scale: 1, x, y }}
                    exit={{ opacity: 0, scale: 0.7, x: 0, y: 0 }}
                    transition={{ type: "spring", stiffness: 400, damping: 20 }}
                    style={{ background: p.color, color: "#fff", position: 'absolute', left: '50%', top: '50%', transform: `translate(-50%, -50%)` }}
                    className="rounded-full w-14 h-14 flex flex-col items-center justify-center shadow-xl text-2xl font-bold focus:outline-none hover:scale-110 hover:shadow-2xl transition-all duration-200 border-4 border-white/60"
                    tabIndex={0}
                  >
                    <span>{p.icon}</span>
                    <span className="text-xs mt-1 font-normal">{p.name}</span>
                  </motion.button>
                );
              })}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
