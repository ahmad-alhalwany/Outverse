'use client';

import Image from 'next/image';
import Link from 'next/link';
import RelativeTime from './RelativeTime';
import { mediaUrl } from '@/lib/api';

const DEFAULT_AVATAR = 'https://randomuser.me/api/portraits/lego/1.jpg';

interface QuotedPostProps {
  id?: number;
  user?: { id?: number; name?: string; avatar?: string };
  text?: string;
  time?: string;
  images?: string[];
}

/**
 * Compact, read-only rendering of an original post embedded inside a
 * quote / repost card. Clicking navigates to the original post.
 */
export default function QuotedPost({ id, user, text, time, images }: QuotedPostProps) {
  const cover = images?.find((u) => mediaUrl(u));
  const name = user?.name || 'Someone';
  const inner = (
    <div className="quoted-post">
      <div className="quoted-post__head">
        <Image
          src={user?.avatar || DEFAULT_AVATAR}
          alt={`${name} avatar`}
          width={22}
          height={22}
          className="quoted-post__avatar"
          unoptimized
        />
        <span className="quoted-post__name">{name}</span>
        {time && <RelativeTime date={time} className="quoted-post__time" />}
      </div>
      {text && <p className="quoted-post__text">{text}</p>}
      {cover && (
        <div className="quoted-post__media">
          <Image
            src={mediaUrl(cover)}
            alt=""
            width={480}
            height={270}
            className="quoted-post__cover"
            unoptimized
          />
        </div>
      )}
    </div>
  );

  if (id) {
    return (
      <Link href={`/post/${id}`} className="quoted-post__link">
        {inner}
      </Link>
    );
  }
  return inner;
}
