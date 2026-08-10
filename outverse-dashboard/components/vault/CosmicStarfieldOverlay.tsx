'use client';

/**
 * Cosmory-exclusive cosmic layer: nebulae, galaxies, and orbiting planets
 * sit above the Leaflet basemap without blocking map interaction.
 */
export default function CosmicStarfieldOverlay() {
  return (
    <div className="vault-cosmic-overlay pointer-events-none" aria-hidden>
      <div className="vault-cosmic-void" />
      <div className="vault-cosmic-nebula vault-cosmic-nebula--a" />
      <div className="vault-cosmic-nebula vault-cosmic-nebula--b" />
      <div className="vault-cosmic-nebula vault-cosmic-nebula--c" />
      <div className="vault-cosmic-galaxy vault-cosmic-galaxy--1" />
      <div className="vault-cosmic-galaxy vault-cosmic-galaxy--2" />
      <div className="vault-cosmic-grid" />
      <div className="vault-cosmic-stars vault-cosmic-stars--1" />
      <div className="vault-cosmic-stars vault-cosmic-stars--2" />
      <div className="vault-cosmic-stars vault-cosmic-stars--3" />

      <svg className="vault-cosmic-bodies" viewBox="0 0 1000 600" preserveAspectRatio="xMidYMid slice">
        <defs>
          <radialGradient id="cosmoryPlanetA" cx="35%" cy="30%" r="70%">
            <stop offset="0%" stopColor="#e9d5ff" />
            <stop offset="45%" stopColor="#a78bfa" />
            <stop offset="100%" stopColor="#4c1d95" />
          </radialGradient>
          <radialGradient id="cosmoryPlanetB" cx="40%" cy="35%" r="65%">
            <stop offset="0%" stopColor="#bae6fd" />
            <stop offset="50%" stopColor="#38bdf8" />
            <stop offset="100%" stopColor="#0c4a6e" />
          </radialGradient>
          <radialGradient id="cosmoryPlanetC" cx="38%" cy="32%" r="68%">
            <stop offset="0%" stopColor="#fde68a" />
            <stop offset="55%" stopColor="#f59e0b" />
            <stop offset="100%" stopColor="#7c2d12" />
          </radialGradient>
          <radialGradient id="cosmoryGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(196,181,253,0.55)" />
            <stop offset="100%" stopColor="rgba(196,181,253,0)" />
          </radialGradient>
          <linearGradient id="cosmoryRing" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="rgba(255,255,255,0)" />
            <stop offset="50%" stopColor="rgba(233,213,255,0.85)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0)" />
          </linearGradient>
        </defs>

        {/* Distant galaxy swirl */}
        <g className="vault-cosmic-spiral" opacity="0.35">
          <ellipse cx="820" cy="120" rx="90" ry="28" fill="none" stroke="rgba(196,181,253,0.45)" strokeWidth="2" />
          <ellipse cx="820" cy="120" rx="60" ry="18" fill="none" stroke="rgba(125,211,252,0.4)" strokeWidth="1.5" />
          <circle cx="820" cy="120" r="8" fill="url(#cosmoryGlow)" />
        </g>

        {/* Soft planet — top left */}
        <g className="vault-cosmic-planet vault-cosmic-planet--a">
          <circle cx="140" cy="150" r="42" fill="url(#cosmoryGlow)" opacity="0.7" />
          <circle cx="140" cy="150" r="26" fill="url(#cosmoryPlanetA)" />
          <ellipse cx="140" cy="150" rx="38" ry="8" fill="none" stroke="url(#cosmoryRing)" strokeWidth="2" transform="rotate(-18 140 150)" />
        </g>

        {/* Ice planet — mid right */}
        <g className="vault-cosmic-planet vault-cosmic-planet--b">
          <circle cx="860" cy="380" r="34" fill="url(#cosmoryGlow)" opacity="0.55" />
          <circle cx="860" cy="380" r="18" fill="url(#cosmoryPlanetB)" />
        </g>

        {/* Warm planet — bottom left */}
        <g className="vault-cosmic-planet vault-cosmic-planet--c">
          <circle cx="220" cy="480" r="28" fill="url(#cosmoryGlow)" opacity="0.5" />
          <circle cx="220" cy="480" r="14" fill="url(#cosmoryPlanetC)" />
        </g>

        {/* Brand watermark constellation */}
        <g opacity="0.4">
          <circle cx="500" cy="70" r="2.2" fill="#fff" />
          <circle cx="520" cy="86" r="1.6" fill="#ddd6fe" />
          <circle cx="482" cy="92" r="1.8" fill="#fff" />
          <path d="M500 70 L520 86 L482 92 Z" fill="none" stroke="rgba(196,181,253,0.45)" strokeWidth="1" />
        </g>
      </svg>

      <div className="vault-cosmic-brand">Cosmory Vault</div>
    </div>
  );
}
