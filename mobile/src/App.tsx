import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StyleSheet, Text, View } from 'react-native';
import * as SplashScreenExpo from 'expo-splash-screen';
import { AuthProvider, useAuth } from './auth/AuthContext';

// Auth Screens
import LoginScreen from './screens/Auth/LoginScreen';
import RegisterScreen from './screens/Auth/RegisterScreen';

// Main Screens
import HomeScreen from './screens/Home/HomeScreen';
import ExploreScreen from './screens/Explore/ExploreScreen';
import CreateScreen from './screens/Create/CreateScreen';
import NotificationsScreen from './screens/Notifications/NotificationsScreen';
import ProfileScreen from './screens/Profile/ProfileScreen';
import EditProfileScreen from './screens/Profile/EditProfileScreen';
import ChatScreen from './screens/Chat/ChatScreen';
import ConversationScreen from './screens/Chat/ConversationScreen';
import RoomScreen from './screens/Chat/RoomScreen';
import PostDetailScreen from './screens/PostDetailScreen';
import ReelsScreen from './screens/Reels/ReelsScreen';
import BazaarScreen from './screens/Bazaar/BazaarScreen';
import BottlesScreen from './screens/Bottles/BottlesScreen';
import CommunitiesScreen from './screens/Communities/CommunitiesScreen';
import LiveScreen from './screens/Live/LiveScreen';
import LiveViewerScreen from './screens/Live/LiveViewerScreen';
import LabScreen from './screens/Lab/LabScreen';
import CapsulesScreen from './screens/Capsules/CapsulesScreen';
import VaultScreen from './screens/Vault/VaultScreen';
import BazaarDetailScreen from './screens/Bazaar/BazaarDetailScreen';
import CommunityDetailScreen from './screens/Communities/CommunityDetailScreen';
import ShopScreen from './screens/Shop/ShopScreen';
import WalletScreen from './screens/Shop/WalletScreen';
import PassportScreen from './screens/Passport/PassportScreen';
import StoryStudioScreen from './screens/Stories/StoryStudioScreen';
import StoryMapScreen from './screens/Stories/StoryMapScreen';
import HighlightsManagerScreen from './screens/Stories/HighlightsManagerScreen';
import OrbitFriendsScreen from './screens/Settings/OrbitFriendsScreen';
import ReelsDiscoverScreen from './screens/Reels/ReelsDiscoverScreen';
import SoundScreen from './screens/Reels/SoundScreen';
import PulseCreatorSettingsScreen from './screens/Settings/PulseCreatorSettingsScreen';
import OrbitListsScreen from './screens/OrbitLists/OrbitListsScreen';
import SignalPublishSettingsScreen from './screens/Settings/SignalPublishSettingsScreen';
import SettingsScreen from './screens/Settings/SettingsScreen';
import OnboardingScreen from './screens/Onboarding/OnboardingScreen';
import SplashScreen from './screens/SplashScreen';
import CreatorStudioScreen from './screens/Creator/CreatorStudioScreen';
import VideosScreen from './screens/Creator/VideosScreen';
import PlaylistsScreen from './screens/Creator/PlaylistsScreen';
import ExperienceScreen from './screens/Creator/ExperienceScreen';
import PublicBoardScreen from './screens/Boards/PublicBoardScreen';
import WorldsHubScreen from './screens/Worlds/WorldsHubScreen';
import YearScreen from './screens/Worlds/YearScreen';
import LibraryScreen from './screens/Worlds/LibraryScreen';
import MuseumScreen from './screens/Worlds/MuseumScreen';
import GardenScreen from './screens/Worlds/GardenScreen';
import MemoriesScreen from './screens/Worlds/MemoriesScreen';
import CharactersScreen from './screens/Worlds/CharactersScreen';
import SimulatorScreen from './screens/Worlds/SimulatorScreen';
import PremiumScreen from './screens/Worlds/PremiumScreen';
import AchievementsScreen from './screens/Worlds/AchievementsScreen';
import AnalyticsScreen from './screens/Worlds/AnalyticsScreen';
import CollabScreen from './screens/Worlds/CollabScreen';
import DrawStudioScreen from './screens/Worlds/DrawStudioScreen';
import ForgeScreen from './screens/Worlds/ForgeScreen';
import ForgeDetailScreen from './screens/Worlds/ForgeDetailScreen';
import AdsScreen from './screens/Worlds/AdsScreen';
import FollowersScreen from './screens/Worlds/FollowersScreen';
import FollowingScreen from './screens/Worlds/FollowingScreen';
import PromptRoomsScreen from './screens/Worlds/PromptRoomsScreen';
import ShopSellerScreen from './screens/Worlds/ShopSellerScreen';
import TwoFactorSetupScreen from './screens/Worlds/TwoFactorSetupScreen';
import AdminScreen from './screens/Worlds/AdminScreen';
import SavedScreen from './screens/Saved/SavedScreen';
import SearchScreen from './screens/Search/SearchScreen';
import TagFeedScreen from './screens/Tag/TagFeedScreen';

SplashScreenExpo.preventAutoHideAsync();

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

// ── Icon component ── Emojis for now; swap to @expo/vector-icons later
function TabIcon({ name, size, color, focused }: { name: string; size: number; color: string; focused: boolean }) {
  const icons: Record<string, string> = {
    home: '🏠',
    search: '🔍',
    plus: '＋',
    bell: '🔔',
    user: '👤',
    reels: '🎬',
  };
  return (
    <View style={{ transform: [{ scale: focused ? 1.15 : 1 }] }}>
      <Text style={{ fontSize: size * 0.85, color }}>{icons[name] || '●'}</Text>
    </View>
  );
}

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#6366f1',
        tabBarInactiveTintColor: '#9ca3af',
        tabBarStyle: {
          backgroundColor: '#fff',
          borderTopWidth: 0,
          elevation: 8,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.1,
          shadowRadius: 8,
          height: 60,
          paddingBottom: 4,
        },
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          tabBarLabel: 'الرئيسية',
          tabBarIcon: ({ focused, color, size }) => (
            <TabIcon name="home" size={size} color={color} focused={focused} />
          ),
        }}
      />
      <Tab.Screen
        name="Explore"
        component={ExploreScreen}
        options={{
          tabBarLabel: 'استكشاف',
          tabBarIcon: ({ focused, color, size }) => (
            <TabIcon name="search" size={size} color={color} focused={focused} />
          ),
        }}
      />
      <Tab.Screen
        name="Reels"
        component={ReelsScreen}
        options={{
          tabBarLabel: 'ريلز',
          tabBarIcon: ({ focused, color, size }) => (
            <TabIcon name="reels" size={size} color={color} focused={focused} />
          ),
        }}
      />
      <Tab.Screen
        name="Create"
        component={CreateScreen}
        options={{
          tabBarLabel: '',
          tabBarIcon: ({ focused, size }) => (
            <View style={styles.createTabIcon}>
              <TabIcon name="plus" size={size} color="#fff" focused={focused} />
            </View>
          ),
        }}
      />
      <Tab.Screen
        name="Notifications"
        component={NotificationsScreen}
        options={{
          tabBarLabel: 'الإشعارات',
          tabBarIcon: ({ focused, color, size }) => (
            <TabIcon name="bell" size={size} color={color} focused={focused} />
          ),
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          tabBarLabel: 'الملف الشخصي',
          tabBarIcon: ({ focused, color, size }) => (
            <TabIcon name="user" size={size} color={color} focused={focused} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

function AuthStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Register" component={RegisterScreen} />
    </Stack.Navigator>
  );
}

function MainStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="MainTabs" component={MainTabs} />
      <Stack.Screen name="Chat" component={ChatScreen} />
      <Stack.Screen name="Conversation" component={ConversationScreen} />
      <Stack.Screen name="Room" component={RoomScreen} />
      <Stack.Screen name="PostDetail" component={PostDetailScreen} />
      <Stack.Screen name="Bazaar" component={BazaarScreen} />
      <Stack.Screen name="BazaarDetail" component={BazaarDetailScreen} />
      <Stack.Screen name="Bottles" component={BottlesScreen} />
      <Stack.Screen name="Communities" component={CommunitiesScreen} />
      <Stack.Screen name="CommunityDetail" component={CommunityDetailScreen} />
      <Stack.Screen name="Lab" component={LabScreen} />
      <Stack.Screen name="Capsules" component={CapsulesScreen} />
      <Stack.Screen name="Vault" component={VaultScreen} />
      <Stack.Screen name="Shop" component={ShopScreen} />
      <Stack.Screen name="Wallet" component={WalletScreen} />
      <Stack.Screen name="Passport" component={PassportScreen} />
      <Stack.Screen name="Live" component={LiveScreen} />
      <Stack.Screen name="LiveViewer" component={LiveViewerScreen} />
      <Stack.Screen name="StoryStudio" component={StoryStudioScreen} options={{ presentation: 'modal' }} />
      <Stack.Screen name="StoryMap" component={StoryMapScreen} />
      <Stack.Screen name="Highlights" component={HighlightsManagerScreen} />
      <Stack.Screen name="EditProfile" component={EditProfileScreen} />
      <Stack.Screen name="Settings" component={SettingsScreen} />
      <Stack.Screen name="OrbitFriends" component={OrbitFriendsScreen} />
      <Stack.Screen name="ReelsDiscover" component={ReelsDiscoverScreen} />
      <Stack.Screen name="PulseCreator" component={PulseCreatorSettingsScreen} />
      <Stack.Screen name="OrbitLists" component={OrbitListsScreen} />
      <Stack.Screen name="SignalPublish" component={SignalPublishSettingsScreen} />
      <Stack.Screen name="CreatorStudio" component={CreatorStudioScreen} />
      <Stack.Screen name="Videos" component={VideosScreen} />
      <Stack.Screen name="Playlists" component={PlaylistsScreen} />
      <Stack.Screen name="Experience" component={ExperienceScreen} />
      <Stack.Screen name="PublicBoard" component={PublicBoardScreen} />
      <Stack.Screen name="WorldsHub" component={WorldsHubScreen} />
      <Stack.Screen name="Year" component={YearScreen} />
      <Stack.Screen name="Library" component={LibraryScreen} />
      <Stack.Screen name="Museum" component={MuseumScreen} />
      <Stack.Screen name="Garden" component={GardenScreen} />
      <Stack.Screen name="Memories" component={MemoriesScreen} />
      <Stack.Screen name="Characters" component={CharactersScreen} />
      <Stack.Screen name="Simulator" component={SimulatorScreen} />
      <Stack.Screen name="Premium" component={PremiumScreen} />
      <Stack.Screen name="Achievements" component={AchievementsScreen} />
      <Stack.Screen name="Analytics" component={AnalyticsScreen} />
      <Stack.Screen name="Collab" component={CollabScreen} />
      <Stack.Screen name="DrawStudio" component={DrawStudioScreen} />
      <Stack.Screen name="Forge" component={ForgeScreen} />
      <Stack.Screen name="ForgeDetail" component={ForgeDetailScreen} />
      <Stack.Screen name="Ads" component={AdsScreen} />
      <Stack.Screen name="Followers" component={FollowersScreen} />
      <Stack.Screen name="Following" component={FollowingScreen} />
      <Stack.Screen name="Sound" component={SoundScreen} />
      <Stack.Screen name="PromptRooms" component={PromptRoomsScreen} />
      <Stack.Screen name="ShopSeller" component={ShopSellerScreen} />
      <Stack.Screen name="TwoFactorSetup" component={TwoFactorSetupScreen} />
      <Stack.Screen name="Admin" component={AdminScreen} />
      <Stack.Screen name="Saved" component={SavedScreen} />
      <Stack.Screen name="Search" component={SearchScreen} />
      <Stack.Screen name="TagFeed" component={TagFeedScreen} />
    </Stack.Navigator>
  );
}

function RootNavigator() {
  const { isLoading, isAuthenticated, user } = useAuth();
  const [appReady, setAppReady] = useState(false);

  useEffect(() => {
    if (!isLoading) {
      SplashScreenExpo.hideAsync().finally(() => setAppReady(true));
    }
  }, [isLoading]);

  if (!appReady || isLoading) {
    return <SplashScreen />;
  }

  const needsOnboarding = isAuthenticated && user && user.onboarding_completed === false;

  return (
    <NavigationContainer>
      {!isAuthenticated ? (
        <AuthStack />
      ) : needsOnboarding ? (
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Onboarding" component={OnboardingScreen} />
        </Stack.Navigator>
      ) : (
        <MainStack />
      )}
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <RootNavigator />
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  createTabIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#6366f1',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
    marginTop: -8,
  },
});
