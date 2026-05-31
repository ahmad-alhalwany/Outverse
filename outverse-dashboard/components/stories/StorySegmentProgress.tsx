'use client';

export function StorySegmentProgress({
  segmentCount,
  activeIndex,
  progress,
}: {
  segmentCount: number;
  activeIndex: number;
  progress: number;
}) {
  const count = Math.max(1, segmentCount);
  const pct = Math.max(0, Math.min(1, progress)) * 100;

  return (
    <div className="story-progress-row" role="progressbar" aria-valuenow={Math.round(pct)}>
      {Array.from({ length: count }).map((_, i) => {
        let width = '0%';
        if (i < activeIndex) width = '100%';
        else if (i === activeIndex) width = `${pct}%`;
        return (
          <div key={i} className="story-progress-track">
            <div className="story-progress-fill" style={{ width }} />
          </div>
        );
      })}
    </div>
  );
}
