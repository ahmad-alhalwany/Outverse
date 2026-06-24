'use client';

import { useCallback, useEffect, useState } from 'react';
import AdminShell from '@/components/admin/AdminShell';
import { deleteCommentAdmin, deletePostAdmin, fetchCommentsAdmin, fetchPostsAdmin } from '@/lib/adminApi';
import type { AdminComment, AdminPost } from '@/lib/adminTypes';

export default function AdminPostsPage() {
  const [posts, setPosts] = useState<AdminPost[]>([]);
  const [comments, setComments] = useState<AdminComment[]>([]);
  const [selectedPostId, setSelectedPostId] = useState<number | null>(null);
  const [message, setMessage] = useState('');

  const loadPosts = useCallback(() => {
    fetchPostsAdmin().then(setPosts).catch(() => setMessage('Failed to load posts'));
  }, []);

  const loadComments = useCallback((postId?: number | null) => {
    fetchCommentsAdmin(postId ?? undefined).then(setComments).catch(() => setMessage('Failed to load comments'));
  }, []);

  useEffect(() => {
    loadPosts();
    loadComments(null);
  }, [loadPosts, loadComments]);

  const removePost = async (post: AdminPost) => {
    if (!window.confirm('Delete this post?')) return;
    const res = await deletePostAdmin(post.id);
    if (res.ok) {
      setMessage('Post deleted.');
      loadPosts();
      if (selectedPostId === post.id) loadComments(null);
    }
  };

  const removeComment = async (comment: AdminComment) => {
    if (!window.confirm('Delete this comment?')) return;
    const res = await deleteCommentAdmin(comment.id);
    if (res.ok) {
      setMessage('Comment deleted.');
      loadComments(selectedPostId);
      loadPosts();
    }
  };

  return (
    <AdminShell title="Posts & Comments" subtitle="Moderate posts and comment threads from one place">
      {message ? <div className="admin-alert admin-alert--success">{message}</div> : null}
      <div className="admin-grid-2">
        <div className="admin-panel">
          <div className="admin-toolbar">
            <h3 className="admin-panel__title" style={{ margin: 0 }}>Posts</h3>
          </div>
          <div className="admin-table-wrap admin-table--desktop">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Author</th>
                  <th>Post</th>
                  <th>Comments</th>
                  <th>Likes</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {posts.map((post) => (
                  <tr key={post.id}>
                    <td>@{post.user.username}</td>
                    <td>{post.text || 'Media post'}</td>
                    <td>{post.comments_count}</td>
                    <td>{post.likes_count}</td>
                    <td className="admin-actions-wrap">
                      <button type="button" className="admin-btn admin-btn--ghost" onClick={() => { setSelectedPostId(post.id); loadComments(post.id); }}>Comments</button>
                      <button type="button" className="admin-btn admin-btn--danger" onClick={() => void removePost(post)}>Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="admin-mobile-cards">
            {posts.map((post) => (
              <div key={post.id} className="admin-mobile-card">
                <div className="admin-mobile-card__row"><span className="admin-mobile-card__label">Author</span><span className="admin-mobile-card__value">@{post.user.username}</span></div>
                <div className="admin-mobile-card__row"><span className="admin-mobile-card__label">Post</span><span className="admin-mobile-card__value">{post.text || 'Media post'}</span></div>
                <div className="admin-mobile-card__row"><span className="admin-mobile-card__label">Comments / Likes</span><span className="admin-mobile-card__value">{post.comments_count} / {post.likes_count}</span></div>
                <div className="admin-actions-wrap">
                  <button type="button" className="admin-btn admin-btn--ghost" onClick={() => { setSelectedPostId(post.id); loadComments(post.id); }}>Comments</button>
                  <button type="button" className="admin-btn admin-btn--danger" onClick={() => void removePost(post)}>Delete</button>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="admin-panel">
          <div className="admin-toolbar">
            <h3 className="admin-panel__title" style={{ margin: 0 }}>
              {selectedPostId ? `Comments for post #${selectedPostId}` : 'Recent comments'}
            </h3>
            {selectedPostId ? <button type="button" className="admin-btn admin-btn--ghost" onClick={() => { setSelectedPostId(null); loadComments(null); }}>Clear filter</button> : null}
          </div>
          <div className="admin-stack">
            {comments.map((comment) => (
              <div key={comment.id} className="admin-mobile-card">
                <div className="admin-mobile-card__row"><span className="admin-mobile-card__label">Author</span><span className="admin-mobile-card__value">@{comment.user.username}</span></div>
                <div className="admin-mobile-card__row"><span className="admin-mobile-card__label">Comment</span><span className="admin-mobile-card__value">{comment.text || 'Attachment-only comment'}</span></div>
                <div className="admin-mobile-card__row"><span className="admin-mobile-card__label">Created</span><span className="admin-mobile-card__value">{new Date(comment.created_at).toLocaleString()}</span></div>
                <div className="admin-actions-wrap"><button type="button" className="admin-btn admin-btn--danger" onClick={() => void removeComment(comment)}>Delete</button></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AdminShell>
  );
}