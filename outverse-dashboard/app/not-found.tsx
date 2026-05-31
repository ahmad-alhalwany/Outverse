'use client';

import { motion } from 'framer-motion';

export default function NotFound() {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-6 text-center relative overflow-hidden"
      style={{ background: 'linear-gradient(160deg,#0b0f24 0%,#141a3a 55%,#1b1340 100%)', color: '#fff' }}
    >
      {/* drifting stars */}
      {Array.from({ length: 40 }).map((_, i) => (
        <motion.span
          key={i}
          className="absolute rounded-full"
          style={{
            left: `${(i * 37) % 100}%`,
            top: `${(i * 53) % 100}%`,
            width: 2 + (i % 3),
            height: 2 + (i % 3),
            background: '#fff',
            opacity: 0.5,
          }}
          animate={{ opacity: [0.2, 0.9, 0.2] }}
          transition={{ duration: 2 + (i % 4), repeat: Infinity, delay: i * 0.1 }}
        />
      ))}

      {/* floating astronaut */}
      <motion.div
        animate={{ y: [0, -18, 0], rotate: [-4, 4, -4] }}
        transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
        className="text-8xl mb-6 relative z-10"
      >
        🧑‍🚀
      </motion.div>

      <h1 className="text-6xl font-bold relative z-10 bg-gradient-to-r from-[#00CCFF] to-[#6A00FF] bg-clip-text text-transparent">
        404
      </h1>
      <h2 className="text-2xl font-semibold mt-3 relative z-10">Lost in the Outverse</h2>
      <p className="mt-2 max-w-md relative z-10" style={{ color: '#aab2e0' }}>
        Looks like you&apos;ve drifted into unknown territory. Let&apos;s guide you back to a familiar galaxy.
      </p>

      <a
        href="/"
        className="mt-8 inline-flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-white relative z-10 transition-transform hover:scale-[1.03]"
        style={{ background: 'linear-gradient(90deg,#6A00FF,#00CCFF)', boxShadow: '0 8px 28px #6A00FF55' }}
      >
        🚀 Return to Home
      </a>
    </div>
  );
}
