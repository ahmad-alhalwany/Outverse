import Header from '../components/Header';
import Sidebar from '../components/Sidebar';
import DailyChallengeCard from '../components/DailyChallengeCard';
import PostCard from '../components/PostCard';
import RightSidebar from '../components/RightSidebar';

const posts = [
  {
    user: {
      name: 'Sarah Mitchell',
      avatar: 'https://randomuser.me/api/portraits/women/65.jpg',
    },
    time: '2 hours ago',
    text: 'Just finished my latest digital art piece exploring the concept of dreams and reality. What do you think?',
    image: 'https://images.unsplash.com/photo-1464983953574-0892a716854b?auto=format&fit=crop&w=800&q=80',
    stats: { views: 234, comments: 45, shares: 12 },
  },
  {
    user: {
      name: 'David Chen',
      avatar: 'https://randomuser.me/api/portraits/men/43.jpg',
    },
    time: '2 hours ago',
    text: "Working on a new story about a world where creativity is the main currency. Here's a snippet of the first chapter.",
    image: 'https://images.unsplash.com/photo-1515378791036-0648a3ef77b2?auto=format&fit=crop&w=800&q=80',
    stats: { views: 156, comments: 28, shares: 7 },
  },
  {
    user: {
      name: 'Elena Rodriguez',
      avatar: 'https://randomuser.me/api/portraits/women/68.jpg',
    },
    time: '3 hours ago',
    text: "Sketched this during today's creative challenge. The theme was 'Future Cities'",
    image: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=800&q=80',
    stats: { views: 342, comments: 67, shares: 21 },
  },
];

export default function Home() {
  return (
    <main className="min-h-screen bg-background text-text">
      <Header />
      <div className="pt-20 max-w-7xl mx-auto flex">
        <Sidebar />
        <section className="flex-1 max-w-2xl mx-auto px-4">
          <DailyChallengeCard />
          {posts.map((post, idx) => (
            <PostCard key={idx} {...post} />
          ))}
        </section>
        <RightSidebar />
      </div>
    </main>
  );
}
