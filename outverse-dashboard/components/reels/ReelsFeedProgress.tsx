'use client';

interface ReelsFeedProgressProps {
  total: number;
  activeIndex: number;
}

export default function ReelsFeedProgress({ total, activeIndex }: ReelsFeedProgressProps) {
  if (total <= 1) return null;

  return (
    <div className="reels-feed__rail" aria-hidden>
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          className={`reels-feed__rail-dot${i === activeIndex ? ' reels-feed__rail-dot--on' : ''}`}
        />
      ))}
    </div>
  );
}
