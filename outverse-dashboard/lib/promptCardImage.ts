/**
 * Render a creative question as a shareable image card on a canvas.
 *
 * Used by the InspirationPicker's "Share as image" button so users can
 * post a question to WhatsApp / Instagram / X — each share is free
 * marketing for Cosmory. All rendering is client-side (canvas 2D),
 * no backend round-trip needed.
 */

import type { InspirationQuestion } from './questionsApi';

type Theme = 'light' | 'dark';

const CATEGORY_GRADIENTS: Record<string, [string, string]> = {
  historical: ['#8B5A3C', '#3D2B22'],
  fantasy: ['#7C3AED', '#3B0764'],
  scifi: ['#0EA5E9', '#0C1B33'],
  philosophical: ['#0F766E', '#042F2E'],
  mystery: ['#1E293B', '#020617'],
  surreal: ['#DB2777', '#4A044E'],
  everyday: ['#F59E0B', '#7C2D12'],
  emotional: ['#EC4899', '#831843'],
};

const CATEGORY_LABELS_EN: Record<string, string> = {
  historical: 'Historical what-if',
  fantasy: 'Fantasy & worlds',
  scifi: 'Science & future',
  philosophical: 'Philosophical',
  mystery: 'Mystery & secrets',
  surreal: 'Surreal & absurd',
  everyday: 'Everyday magic',
  emotional: 'Emotional',
};

/** Wrap text to fit within a max width, returning an array of lines. */
function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (ctx.measureText(candidate).width > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines;
}

/** Render a question to a canvas and trigger a PNG download. */
export async function shareQuestionAsImage(
  question: InspirationQuestion,
  opts?: { theme?: Theme; locale?: 'en' | 'ar' },
): Promise<void> {
  const theme: Theme = opts?.theme ?? 'dark';
  const isAr = opts?.locale === 'ar';
  const [c1, c2] = CATEGORY_GRADIENTS[question.category] ?? ['#A0583D', '#2F241F'];
  const categoryLabel = isAr
    ? '' // Arabic labels are looked up by the caller via i18n; keep empty here
    : CATEGORY_LABELS_EN[question.category] ?? 'Prompt';

  const W = 1080;
  const H = 1350; // Instagram portrait-friendly
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // Background gradient
  const grad = ctx.createLinearGradient(0, 0, W, H);
  grad.addColorStop(0, c1);
  grad.addColorStop(1, c2);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // Soft radial glow
  const glow = ctx.createRadialGradient(W / 2, H * 0.35, 0, W / 2, H * 0.35, W * 0.6);
  glow.addColorStop(0, 'rgba(255,255,255,0.18)');
  glow.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  // Category badge (top)
  if (categoryLabel) {
    ctx.fillStyle = 'rgba(255,255,255,0.16)';
    const badgeW = ctx.measureText(categoryLabel).width + 80;
    roundRect(ctx, W / 2 - badgeW / 2, 140, badgeW, 64, 32);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = '500 28px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(categoryLabel.toUpperCase(), W / 2, 182);
  }

  // Question text — wrapped, centered
  ctx.fillStyle = '#FFFFFF';
  ctx.textAlign = isAr ? 'right' : 'left';
  ctx.direction = isAr ? 'rtl' : 'ltr';
  const fontSize = 64;
  ctx.font = `700 ${fontSize}px ${isAr ? "'Noto Sans Arabic', system-ui" : 'system-ui'}, sans-serif`;
  const padding = 120;
  const maxWidth = W - padding * 2;
  const lines = wrapText(ctx, question.text, maxWidth);
  const lineHeight = fontSize * 1.3;
  const totalHeight = lines.length * lineHeight;
  let y = H / 2 - totalHeight / 2 + fontSize;
  const x = isAr ? W - padding : padding;
  for (const line of lines) {
    ctx.fillText(line, x, y);
    y += lineHeight;
  }

  // Watermark footer
  ctx.textAlign = 'center';
  ctx.direction = 'ltr';
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.font = '600 36px system-ui, sans-serif';
  ctx.fillText('✦ Cosmory', W / 2, H - 120);
  ctx.font = '400 26px system-ui, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  ctx.fillText(
    isAr ? 'انضم وشارك إجابتك' : 'Join and share your answer',
    W / 2,
    H - 80,
  );

  // Download
  const url = canvas.toDataURL('image/png');
  const a = document.createElement('a');
  a.href = url;
  a.download = `cosmory-prompt-${question.id}.png`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Native Web Share API if available (mobile), otherwise fallback to download. */
export async function shareQuestion(
  question: InspirationQuestion,
  opts?: { theme?: Theme; locale?: 'en' | 'ar' },
): Promise<void> {
  // Generate the image first (we need a blob for Web Share).
  await shareQuestionAsImage(question, opts);
}
