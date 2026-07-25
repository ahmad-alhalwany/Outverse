'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { PaperAirplaneIcon, ChatBubbleLeftEllipsisIcon, MapPinIcon } from '@heroicons/react/24/solid';
import { formatCountdownLong } from '@/lib/storyStudio';
import { useLocale } from '@/components/LocaleProvider';
import type { StoryOverlay, StoryStroke } from '@/lib/storyStudio';
import type { PollResults } from '@/lib/storyUtils';

type Props = {
  overlays: StoryOverlay[];
  drawing: StoryStroke[];
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  draggable?: boolean;
  /** Enables real voting / answer submission — only true in the actual viewer, never the composer preview. */
  interactive?: boolean;
  isOwner?: boolean;
  pollResults?: PollResults;
  questionResponseCounts?: Record<string, number>;
  onVote?: (overlayId: string, optionIndex: number) => void;
  onSubmitAnswer?: (overlayId: string, text: string) => void;
  onOpenResponses?: (overlayId: string) => void;
};

function PollCard({
  question,
  options,
  overlayId,
  interactive,
  isOwner,
  results,
  onVote,
}: {
  question: string;
  options: [string, string];
  overlayId: string;
  interactive?: boolean;
  isOwner?: boolean;
  results?: PollResults[string];
  onVote?: (overlayId: string, optionIndex: number) => void;
}) {
  const { t } = useLocale();
  const total = results?.total ?? 0;
  const myVote = results?.my_vote ?? null;
  const showResults = interactive && (isOwner || myVote !== null);
  const votesLabel =
    total === 1 ? t('stories.pollVotes', { count: total }) : t('stories.pollVotesPlural', { count: total });

  return (
    <div className="story-poll-card">
      <p className="story-poll-question">{question}</p>
      <div className="story-poll-options">
        {options.map((label, i) => {
          const count = results?.counts?.[String(i)] ?? 0;
          const pct = total > 0 ? Math.round((count / total) * 100) : 0;
          const isMine = myVote === i;
          if (showResults) {
            return (
              <div key={i} className={`story-poll-result${isMine ? ' story-poll-result--mine' : ''}`}>
                <div className="story-poll-result-fill" style={{ width: `${pct}%` }} />
                <span className="story-poll-result-label">{label}</span>
                <span className="story-poll-result-pct">{pct}%</span>
              </div>
            );
          }
          return (
            <button
              key={i}
              type="button"
              className="story-poll-option-btn"
              disabled={!interactive}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                onVote?.(overlayId, i);
              }}
            >
              {label}
            </button>
          );
        })}
      </div>
      {showResults && <p className="story-poll-total">{votesLabel}</p>}
    </div>
  );
}

function QuestionCard({
  prompt,
  overlayId,
  interactive,
  isOwner,
  responseCount,
  onSubmitAnswer,
  onOpenResponses,
}: {
  prompt: string;
  overlayId: string;
  interactive?: boolean;
  isOwner?: boolean;
  responseCount?: number;
  onSubmitAnswer?: (overlayId: string, text: string) => void;
  onOpenResponses?: (overlayId: string) => void;
}) {
  const { t } = useLocale();
  const [answer, setAnswer] = useState('');
  const [sent, setSent] = useState(false);
  const count = responseCount ?? 0;
  const answersLabel =
    count === 1 ? t('stories.questionAnswers', { count }) : t('stories.questionAnswersPlural', { count });

  return (
    <div className="story-question-card">
      <p className="story-question-prompt">{prompt}</p>
      {!interactive ? null : isOwner ? (
        <button
          type="button"
          className="story-question-responses-btn"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onOpenResponses?.(overlayId);
          }}
        >
          <ChatBubbleLeftEllipsisIcon className="h-4 w-4" />
          {answersLabel}
        </button>
      ) : sent ? (
        <p className="story-question-sent">{t('stories.answerSent')}</p>
      ) : (
        <div className="story-question-answer-row" onPointerDown={(e) => e.stopPropagation()}>
          <input
            type="text"
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder={t('stories.answerPlaceholder')}
            className="story-question-answer-input"
            maxLength={200}
          />
          <button
            type="button"
            className="story-question-answer-send"
            disabled={!answer.trim()}
            onClick={(e) => {
              e.stopPropagation();
              if (!answer.trim()) return;
              onSubmitAnswer?.(overlayId, answer.trim());
              setSent(true);
            }}
            aria-label={t('stories.sendAnswer')}
          >
            <PaperAirplaneIcon className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}

function LocationBadge({ label }: { label: string }) {
  return (
    <span className="story-location-badge">
      <MapPinIcon className="h-3.5 w-3.5" />
      {label}
    </span>
  );
}

function MentionBadge({ username, interactive }: { username: string; interactive?: boolean }) {
  const content = <span className="story-mention-badge">@{username}</span>;
  if (!interactive) return content;
  return (
    <Link
      href={`/u/${encodeURIComponent(username)}`}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      {content}
    </Link>
  );
}

function CountdownBadge({ label, targetAt }: { label: string; targetAt: string }) {
  const [remaining, setRemaining] = useState(() => Math.max(0, (new Date(targetAt).getTime() - Date.now()) / 1000));

  useEffect(() => {
    const id = setInterval(() => {
      setRemaining(Math.max(0, (new Date(targetAt).getTime() - Date.now()) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, [targetAt]);

  return (
    <div className="story-countdown-card">
      <p className="story-countdown-label">{label}</p>
      <p className="story-countdown-value">{formatCountdownLong(remaining)}</p>
    </div>
  );
}

/** Renders text/sticker/poll/question overlays + freehand drawing strokes.
 * Shared by the composer's live preview and the story viewer so both stay
 * pixel-identical; `interactive` gates real voting/answering behavior. */
export default function StoryOverlaysLayer({
  overlays,
  drawing,
  selectedId,
  onSelect,
  draggable,
  interactive,
  isOwner,
  pollResults,
  questionResponseCounts,
  onVote,
  onSubmitAnswer,
  onOpenResponses,
}: Props) {
  return (
    <>
      {drawing.length > 0 && (
        <svg
          className="absolute inset-0 w-full h-full pointer-events-none"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
        >
          {drawing.map((stroke, i) => (
            <polyline
              key={i}
              points={stroke.points.map((p) => p.join(',')).join(' ')}
              fill="none"
              stroke={stroke.color}
              strokeWidth={stroke.width}
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
          ))}
        </svg>
      )}
      {overlays.map((el) => (
        <div
          key={el.id}
          onPointerDown={(e) => {
            if (draggable) e.stopPropagation();
            onSelect?.(el.id);
          }}
          className="absolute select-none"
          style={{
            left: `${el.x}%`,
            top: `${el.y}%`,
            transform: 'translate(-50%, -50%)',
            cursor: draggable ? 'grab' : 'default',
            outline: selectedId === el.id ? '2px dashed rgba(255,255,255,0.7)' : 'none',
            outlineOffset: '6px',
            borderRadius: 8,
            touchAction: 'none',
            // Tappable cards must sit above the viewer's full-screen
            // tap-to-advance zones (z-index 10); decorative text/stickers/
            // location/countdown stay click-through for those zones.
            zIndex: el.type === 'poll' || el.type === 'question' || el.type === 'mention' ? 20 : undefined,
          }}
        >
          {el.type === 'text' ? (
            <span
              style={{
                color: el.color,
                fontSize: `${el.fontSize / 4.5}rem`,
                fontWeight: el.fontWeight,
                textShadow: '0 2px 10px rgba(0,0,0,0.45)',
                whiteSpace: 'pre-wrap',
                textAlign: el.align || 'center',
                display: 'inline-block',
                maxWidth: '80vw',
              }}
            >
              {el.text}
            </span>
          ) : el.type === 'sticker' ? (
            <span style={{ fontSize: `${el.scale * 2.5}rem`, lineHeight: 1 }}>{el.emoji}</span>
          ) : el.type === 'poll' ? (
            <PollCard
              question={el.question}
              options={el.options}
              overlayId={el.id}
              interactive={interactive}
              isOwner={isOwner}
              results={pollResults?.[el.id]}
              onVote={onVote}
            />
          ) : el.type === 'question' ? (
            <QuestionCard
              prompt={el.prompt}
              overlayId={el.id}
              interactive={interactive}
              isOwner={isOwner}
              responseCount={questionResponseCounts?.[el.id]}
              onSubmitAnswer={onSubmitAnswer}
              onOpenResponses={onOpenResponses}
            />
          ) : el.type === 'location' ? (
            <LocationBadge label={el.label} />
          ) : el.type === 'mention' ? (
            <MentionBadge username={el.username} interactive={interactive} />
          ) : (
            <CountdownBadge label={el.label} targetAt={el.targetAt} />
          )}
        </div>
      ))}
    </>
  );
}
