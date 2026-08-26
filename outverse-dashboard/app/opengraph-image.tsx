import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

// Default share-preview image for every route that doesn't set its own
// (post/reel/profile/community pages already generate a specific one via
// generateMetadata — this only backs the rest, e.g. the homepage, /discover,
// /communities). Built with next/og's built-in ImageResponse instead of a
// static asset so it doesn't need a design tool — matches the app's real
// dark background (rgb(20,16,42), from globals.css's --c-background) and
// the same purple/blue/green gradient FeedHero uses (from-vault via-bazaar
// to-lab in tailwind.config.js).
export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'rgb(20,16,42)',
          fontFamily: 'sans-serif',
        }}
      >
        <div
          style={{
            display: 'flex',
            fontSize: 96,
            fontWeight: 700,
            backgroundImage: 'linear-gradient(90deg, #9C27B0, #2196F3, #4CAF50)',
            backgroundClip: 'text',
            color: 'transparent',
          }}
        >
          Cosonova
        </div>
        <div
          style={{
            display: 'flex',
            marginTop: 24,
            fontSize: 32,
            color: 'rgb(176,166,217)',
          }}
        >
          Discover ideas, join communities, create every day
        </div>
      </div>
    ),
    { ...size }
  );
}
