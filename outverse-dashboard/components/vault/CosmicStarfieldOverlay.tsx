'use client';

/** Decorative nebula + stars layer above the Leaflet map (cosmic mode). */
export default function CosmicStarfieldOverlay() {
  return (
    <div className="vault-cosmic-overlay pointer-events-none" aria-hidden>
      <div className="vault-cosmic-nebula vault-cosmic-nebula--a" />
      <div className="vault-cosmic-nebula vault-cosmic-nebula--b" />
      <div className="vault-cosmic-grid" />
      <div className="vault-cosmic-stars vault-cosmic-stars--1" />
      <div className="vault-cosmic-stars vault-cosmic-stars--2" />
      <div className="vault-cosmic-stars vault-cosmic-stars--3" />
    </div>
  );
}
