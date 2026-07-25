'use client';

import Link from 'next/link';
import { Fragment } from 'react';

const TOKEN_RE = /(@\w+|#\w+)/g;

/** Renders @mentions and #hashtags inside plain text as clickable links. */
export default function MentionText({
  text,
  className,
  mentionClassName = 'mention-link',
  hashtagClassName = 'mention-link',
}: {
  text: string;
  className?: string;
  mentionClassName?: string;
  hashtagClassName?: string;
}) {
  if (!text) return null;
  const parts = text.split(TOKEN_RE);

  return (
    <span className={className}>
      {parts.map((part, i) => {
        if (part.startsWith('@') && part.length > 1) {
          return (
            <Link key={i} href={`/u/${encodeURIComponent(part.slice(1))}`} className={mentionClassName}>
              {part}
            </Link>
          );
        }
        if (part.startsWith('#') && part.length > 1) {
          return (
            <Link key={i} href={`/tag/${encodeURIComponent(part.slice(1))}`} className={hashtagClassName}>
              {part}
            </Link>
          );
        }
        return <Fragment key={i}>{part}</Fragment>;
      })}
    </span>
  );
}
