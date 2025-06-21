import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface SliderProps {
  images: string[];
  className?: string;
}

export default function Slider({ images, className = '' }: SliderProps) {
  const [imgIdx, setImgIdx] = useState(0);
  const nextImg = () => setImgIdx(i => (i + 1) % images.length);
  const prevImg = () => setImgIdx(i => (i - 1 + images.length) % images.length);
  const surpriseImg = () => setImgIdx(() => Math.floor(Math.random() * images.length));
  useEffect(() => { setImgIdx(0); }, [images]);

  return (
    <div className={`relative w-full flex justify-center items-center mt-2 ${className}`} style={{ minHeight: 220 }}>
      <AnimatePresence mode="wait">
        <motion.div
          key={images[imgIdx]}
          initial={{ opacity: 0, scale: 0.8, rotate: -10 }}
          animate={{ opacity: 1, scale: 1.08, rotate: 0 }}
          exit={{ opacity: 0, scale: 0.8, rotate: 10 }}
          transition={{ duration: 0.7, type: 'spring', stiffness: 120 }}
          className="rounded-2xl shadow-2xl border-4 border-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 p-1 bg-black/60"
          style={{ boxShadow: '0 0 32px 8px #7f5fff55, 0 0 0 4px #fff3' }}
        >
          <img
            src={images[imgIdx]}
            alt={`slider-img-${imgIdx}`}
            className="rounded-xl w-full object-cover max-h-80 transition-all duration-500"
            style={{ filter: 'drop-shadow(0 0 16px #a5b4fc)' }}
          />
        </motion.div>
      </AnimatePresence>
      {images.length > 1 && (
        <>
          <button onClick={prevImg} className="absolute left-2 top-1/2 -translate-y-1/2 bg-gradient-to-br from-indigo-500 to-pink-500 text-white rounded-full p-2 hover:scale-110 shadow-lg transition z-10">&#8592;</button>
          <button onClick={nextImg} className="absolute right-2 top-1/2 -translate-y-1/2 bg-gradient-to-br from-pink-500 to-indigo-500 text-white rounded-full p-2 hover:scale-110 shadow-lg transition z-10">&#8594;</button>
          <button onClick={surpriseImg} className="absolute top-2 right-1/2 translate-x-1/2 bg-black/70 text-lab px-3 py-1 rounded-full text-xs font-bold shadow hover:bg-lab/80 hover:text-white transition z-10 border border-lab">Surprise Me 🚀</button>
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
            {images.map((_, i) => (
              <span key={i} className={`inline-block w-2 h-2 rounded-full ${i === imgIdx ? 'bg-lab' : 'bg-white/60'}`}></span>
            ))}
          </div>
        </>
      )}
    </div>
  );
} 