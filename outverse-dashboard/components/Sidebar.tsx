import { HomeIcon, BeakerIcon, ShoppingBagIcon, ArchiveBoxIcon, BookOpenIcon, ShoppingCartIcon, HashtagIcon, FireIcon, BookmarkIcon, UserGroupIcon } from '@heroicons/react/24/outline';

const navLinks = [
  { name: 'Home', icon: HomeIcon },
  { name: 'Lab', icon: BeakerIcon },
  { name: 'Bazaar', icon: ShoppingBagIcon },
  { name: 'Vault', icon: ArchiveBoxIcon },
  { name: 'Story', icon: BookOpenIcon },
  { name: 'Shop', icon: ShoppingCartIcon },
  { name: 'Explore', icon: UserGroupIcon },
  { name: 'Trending', icon: FireIcon },
  { name: 'Following', icon: UserGroupIcon },
  { name: 'Saved', icon: BookmarkIcon },
];

const tags = [
  '#DigitalArt',
  '#CreativeWriting',
  '#Photography',
  '#Illustration',
  '#Animation',
];

export default function Sidebar() {
  return (
    <aside className="w-64 pt-20 px-4 hidden lg:block">
      <nav className="mb-8">
        <ul className="space-y-2">
          {navLinks.map((link) => (
            <li key={link.name}>
              <a href="#" className="flex items-center space-x-3 text-text-secondary hover:text-text font-medium py-2 px-3 rounded-lg transition-colors">
                <link.icon className="h-5 w-5" />
                <span>{link.name}</span>
              </a>
            </li>
          ))}
        </ul>
      </nav>
      <div>
        <h3 className="text-xs font-semibold text-text-secondary mb-2">Popular Tags</h3>
        <div className="flex flex-wrap gap-2">
          {tags.map((tag) => (
            <span key={tag} className="bg-surface text-xs text-text-secondary px-2 py-1 rounded-full">{tag}</span>
          ))}
        </div>
      </div>
    </aside>
  );
} 