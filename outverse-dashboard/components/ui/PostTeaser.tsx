import Link from 'next/link';
import type { MappedPost } from '@/utils/postMapper';

export default function PostTeaser({ post }: { post: MappedPost }) {
  return (
    <Link href={`/post/${post.id}`} className="block rounded-xl border border-surface bg-surface/30 p-3 hover:bg-surface/60 transition-colors">
      <div className="flex items-center gap-2 mb-1.5">
        {post.user.avatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={post.user.avatar} alt="" className="w-6 h-6 rounded-full object-cover shrink-0" />
        ) : (
          <span className="w-6 h-6 rounded-full bg-vault/30 shrink-0" />
        )}
        <span className="text-xs font-semibold text-text truncate">{post.user.name}</span>
      </div>
      <p className="text-sm text-text-secondary line-clamp-2">{post.text || (post.images[0] ? '📷' : '')}</p>
    </Link>
  );
}
