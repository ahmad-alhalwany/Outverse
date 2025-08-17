'use client';

import Header from '../components/Header';
import Sidebar from '../components/Sidebar';
import DailyChallengeCard from '../components/DailyChallengeCard';
import PostCard from '../components/PostCard';
import RightSidebar from '../components/RightSidebar';
import CreatePostCard from '../components/CreatePostCard';
import StoriesSidebar from '../components/StoriesSidebar';
import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { formatRelativeTime } from '../utils/dateFormatter';

const API_URL = 'http://localhost:8000/api/posts/';

export default function Home() {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchPosts() {
      try {
        const res = await fetch(API_URL);
        const data = await res.json();
        setPosts(data);
      } catch (err) {
        setPosts([]);
      } finally {
        setLoading(false);
      }
    }
    fetchPosts();
  }, []);

  // بعد جلب البيانات:
  const mappedPosts = posts.map((post: any) => {
    // معالجة user
    const user = post.user
      ? {
          name: userFullName(post.user),
          avatar: post.user.avatar || '',
        }
      : { name: '', avatar: '' };
    // معالجة الصور والفيديوهات
    const images = post.media
      ? post.media.filter((m: any) => m.media_type === 'image').map((m: any) => fullMediaUrl(m.media_file))
      : [];
    const videos = post.media
      ? post.media.filter((m: any) => m.media_type === 'video').map((m: any) => fullMediaUrl(m.media_file))
      : [];
    // معالجة الإحصائيات
    const stats = {
      views: post.views || 0,
      comments: post.comments_count || 0,
      shares: post.shares_count || 0,
    };
    return {
      ...post,
      user,
      images,
      videos,
      stats,
      time: formatRelativeTime(new Date(post.created_at)),
    };
  });

  function userFullName(user: any) {
    if (user.first_name || user.last_name) return `${user.first_name || ''} ${user.last_name || ''}`.trim();
    return user.username || '';
  }
  function fullMediaUrl(url: string) {
    if (!url) return '';
    return url.startsWith('http') ? url : `http://localhost:8000${url}`;
  }

  return (
    <main className="min-h-screen bg-background text-text">
      <StoriesSidebar />
      <Header />
      <div className="pt-20 max-w-7xl mx-auto flex" style={{ marginLeft: 80 }}>
        <Sidebar />
        <section className="flex-1 max-w-2xl mx-auto px-4">
          <DailyChallengeCard />
          <CreatePostCard />
          {loading ? (
            <div className="text-center py-10">Loading...</div>
          ) : (
            <AnimatePresence initial={false}>
              {mappedPosts.map((post, idx) => (
                <motion.div
                  key={post.id || idx}
                  initial={{ opacity: 0, y: 40 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -40 }}
                  transition={{ duration: 0.5, type: 'spring', stiffness: 80 }}
                  className="mb-6"
                >
                  <PostCard {...post} />
                </motion.div>
              ))}
            </AnimatePresence>
          )}
        </section>
        <RightSidebar />
      </div>
    </main>
  );
}
