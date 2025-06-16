export default function DailyChallengeCard() {
  return (
    <div className="bg-surface rounded-xl p-6 flex items-center justify-between mb-6 shadow-sm">
      <div>
        <h2 className="text-lg font-bold text-text mb-1">Daily Creative Challenge</h2>
        <p className="text-text-secondary text-sm">Design a character that represents your inner creative spirit</p>
      </div>
      <button className="bg-lab text-white px-5 py-2 rounded-lg font-semibold shadow hover:bg-lab/90 transition">Join Challenge</button>
    </div>
  );
} 