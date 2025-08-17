const activeFriends = [
  { name: 'Alex', avatar: 'https://randomuser.me/api/portraits/men/32.jpg', mood: 'creative' },
  { name: 'Maria', avatar: 'https://randomuser.me/api/portraits/women/44.jpg', mood: 'inspired' },
  { name: 'John', avatar: 'https://randomuser.me/api/portraits/men/45.jpg', mood: 'focused' },
  { name: 'Lisa', avatar: 'https://randomuser.me/api/portraits/women/46.jpg', mood: 'exploring' },
];

const trendingTopics = [
  { topic: 'Digital Art Evolution', posts: 2400 },
  { topic: 'Creative Writing', posts: 1800 },
  { topic: 'Photography Tips', posts: 1200 },
];

const trendingPosts = [
  { title: 'How I Created a Cosmic Illustration', reactions: 320 },
  { title: 'Top 10 Space Art Tips', reactions: 275 },
  { title: 'Nebula Color Palettes', reactions: 210 },
];

const friendSuggestions = [
  { name: 'Emma', avatar: 'https://randomuser.me/api/portraits/women/65.jpg', mutual: 3 },
  { name: 'Noah', avatar: 'https://randomuser.me/api/portraits/men/66.jpg', mutual: 2 },
  { name: 'Olivia', avatar: 'https://randomuser.me/api/portraits/women/67.jpg', mutual: 1 },
];

export default function RightSidebar() {
  return (
    <aside className="w-80 pt-20 px-4 hidden xl:block">
      <div className="bg-white rounded-xl p-4 mb-6 shadow-sm">
        <h3 className="text-xs font-semibold text-gray-500 mb-2">Global Emotion Map</h3>
        <div className="h-28 bg-gray-100 rounded flex items-center justify-center text-gray-400 text-sm">
          <span>🌍 Map Placeholder</span>
        </div>
        <div className="text-xs text-gray-400 mt-2">1,234 creators active</div>
      </div>
      <div className="bg-white rounded-xl p-4 mb-6 shadow-sm">
        <h3 className="text-xs font-semibold text-gray-500 mb-2">Active Friends</h3>
        <div className="flex -space-x-2 mb-2">
          {activeFriends.map(friend => (
            <img key={friend.name} src={friend.avatar} alt={friend.name} className="w-8 h-8 rounded-full border-2 border-white" title={friend.name} />
          ))}
        </div>
        <ul className="text-xs text-gray-700">
          {activeFriends.map(friend => (
            <li key={friend.name} className="flex items-center space-x-2 mb-1">
              <span className="w-2 h-2 rounded-full bg-green-400 inline-block"></span>
              <span>{friend.name}</span>
              <span className="text-gray-400">({friend.mood})</span>
            </li>
          ))}
        </ul>
      </div>
      <div className="bg-white rounded-xl p-4 mb-6 shadow-sm">
        <h3 className="text-xs font-semibold text-gray-500 mb-2 flex items-center gap-1">
          <span>Friend Suggestions</span>
          <span className="text-blue-400 text-base">✨</span>
        </h3>
        <ul className="text-xs text-gray-700">
          {friendSuggestions.map(friend => (
            <li key={friend.name} className="flex items-center justify-between mb-2">
              <span className="flex items-center gap-2">
                <span className="relative">
                  <img src={friend.avatar} alt={friend.name} className="w-8 h-8 rounded-full border-2 border-blue-200 hover:border-blue-400 transition" />
                  <span className="absolute -bottom-1 -right-1 w-3 h-3 bg-gradient-to-tr from-purple-400 to-blue-400 rounded-full flex items-center justify-center text-white text-xs">+</span>
                </span>
                <span>{friend.name}</span>
                <span className="text-gray-400">({friend.mutual} mutual)</span>
              </span>
              <button className="bg-blue-100 hover:bg-blue-300 text-blue-600 rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold transition" title="Add Friend">+</button>
            </li>
          ))}
        </ul>
      </div>
      <div className="bg-white rounded-xl p-4 mb-6 shadow-sm">
        <h3 className="text-xs font-semibold text-gray-500 mb-2 flex items-center gap-1">
          <span>Trending Posts</span>
          <span className="text-yellow-400 text-base">🌠</span>
        </h3>
        <ul className="text-xs text-gray-700">
          {trendingPosts.map(post => (
            <li key={post.title} className="flex items-center justify-between mb-1">
              <span className="flex items-center gap-1">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-gradient-to-tr from-purple-400 to-blue-400 mr-1"></span>
                {post.title}
              </span>
              <span className="flex items-center gap-1 text-gray-400">
                <span className="text-pink-400">★</span>
                {post.reactions}
              </span>
            </li>
          ))}
        </ul>
      </div>
      <div className="bg-white rounded-xl p-4 shadow-sm">
        <h3 className="text-xs font-semibold text-gray-500 mb-2">Trending Topics</h3>
        <ul className="text-xs text-gray-700">
          {trendingTopics.map(topic => (
            <li key={topic.topic} className="flex items-center justify-between mb-1">
              <span>{topic.topic}</span>
              <span className="text-gray-400">{topic.posts.toLocaleString()} posts</span>
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );
} 