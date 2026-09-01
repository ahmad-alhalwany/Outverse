import React, { useEffect, useState } from 'react';
import { useFonts } from 'expo-font';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreenExpo from 'expo-splash-screen';
import { AuthProvider, useAuth } from './auth/AuthContext';
import { useTheme } from './hooks/useTheme';
import { INTER_FONTS, applyDefaultInter } from './lib/fonts';
import { LocaleProvider, useLocale } from './i18n/LocaleProvider';

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
import LabHistoryScreen from './screens/Lab/LabHistoryScreen';
import InspirationHistoryScreen from './screens/Lab/InspirationHistoryScreen';
import CapsulesScreen from './screens/Capsules/CapsulesScreen';
import VaultScreen from './screens/Vault/VaultScreen';
import BazaarDetailScreen from './screens/Bazaar/BazaarDetailScreen';
import CommunityDetailScreen from './screens/Communities/CommunityDetailScreen';
import ShopScreen from './screens/Shop/ShopScreen';
import ShopProductScreen from './screens/Shop/ShopProductScreen';
import ShopOrdersScreen from './screens/Shop/ShopOrdersScreen';
import WalletScreen from './screens/Shop/WalletScreen';
import PassportScreen from './screens/Passport/PassportScreen';
import StoryStudioScreen from './screens/Stories/StoryStudioScreen';
import StoryMapScreen from './screens/Stories/StoryMapScreen';
import HighlightsManagerScreen from './screens/Stories/HighlightsManagerScreen';
import OrbitFriendsScreen from './screens/Settings/OrbitFriendsScreen';
import ReelsDiscoverScreen from './screens/Reels/ReelsDiscoverScreen';
import SoundScreen from './screens/Reels/SoundScreen';
import PulseCreatorSettingsScreen from './screens/Settings/PulseCreatorSettingsScreen';
import PrivacyScreen from './screens/Settings/PrivacyScreen';
import BlockedAccountsScreen from './screens/Settings/BlockedAccountsScreen';
import InspirationTasteScreen from './screens/Settings/InspirationTasteScreen';
import AppealsScreen from './screens/Settings/AppealsScreen';
import OrbitListsScreen from './screens/OrbitLists/OrbitListsScreen';
import SignalPublishSettingsScreen from './screens/Settings/SignalPublishSettingsScreen';
import SettingsScreen from './screens/Settings/SettingsScreen';
import LegalScreen from './screens/Settings/LegalScreen';
import InAppWebScreen from './screens/Common/InAppWebScreen';
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
import StudioSessionScreen from './screens/Worlds/StudioSessionScreen';
import ForgeScreen from './screens/Worlds/ForgeScreen';
import ForgeDetailScreen from './screens/Worlds/ForgeDetailScreen';
import AdsScreen from './screens/Worlds/AdsScreen';
import FollowersScreen from './screens/Worlds/FollowersScreen';
import FollowingScreen from './screens/Worlds/FollowingScreen';
import PromptRoomsScreen from './screens/Worlds/PromptRoomsScreen';
import ShopSellerScreen from './screens/Worlds/ShopSellerScreen';
import TwoFactorSetupScreen from './screens/Worlds/TwoFactorSetupScreen';
import AdminScreen from './screens/Worlds/AdminScreen';
import AdminSectionScreen from './screens/Worlds/AdminSectionScreen';
import AdminMarketingScreen from './screens/Worlds/AdminMarketingScreen';
import SavedScreen from './screens/Saved/SavedScreen';
import SearchScreen from './screens/Search/SearchScreen';
import TagFeedScreen from './screens/Tag/TagFeedScreen';
import MoreScreen from './screens/More/MoreScreen';
import CommunityWikiScreen from './screens/Communities/CommunityWikiScreen';

SplashScreenExpo.preventAutoHideAsync();

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const stackScreenOptions = {
  headerShown: false,
};

function MainTabs() {
  const { colors } = useTheme();
  const { t } = useLocale();
  const insets = useSafeAreaInsets();
  const bottomPad = Math.max(insets.bottom, 8);
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarHideOnKeyboard: true,
        tabBarActiveTintColor: colors.iconHover,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarLabelStyle: { fontSize: 10, fontWeight: '600', marginTop: 1 },
        tabBarStyle: {
          backgroundColor: colors.background,
          borderTopWidth: 1,
          borderTopColor: 'rgba(156,39,176,0.15)',
          height: 56 + bottomPad,
          paddingBottom: bottomPad,
          paddingTop: 6,
        },
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          tabBarLabel: t('nav.home'),
          tabBarIcon: ({ color, focused }) => (
            <View style={{ backgroundColor: focused ? 'rgba(124,58,237,0.15)' : 'transparent', borderRadius: 8, padding: 4 }}>
              <Ionicons name={focused ? 'home' : 'home-outline'} size={20} color={color} />
            </View>
          ),
        }}
      />
      <Tab.Screen
        name="Signals"
        component={ReelsScreen}
        options={{
          tabBarLabel: t('nav.reels'),
          tabBarIcon: ({ color, focused }) => (
            <View style={{ backgroundColor: focused ? 'rgba(124,58,237,0.15)' : 'transparent', borderRadius: 8, padding: 4 }}>
              <Ionicons name={focused ? 'play-circle' : 'play-circle-outline'} size={20} color={color} />
            </View>
          ),
        }}
      />
      <Tab.Screen
        name="Daily"
        component={LabScreen}
        options={{
          tabBarLabel: t('nav.lab'),
          tabBarIcon: ({ color, focused }) => (
            <View style={{ backgroundColor: focused ? 'rgba(124,58,237,0.15)' : 'transparent', borderRadius: 8, padding: 4 }}>
              <Ionicons name={focused ? 'flask' : 'flask-outline'} size={20} color={color} />
            </View>
          ),
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          tabBarLabel: t('nav.profile'),
          tabBarIcon: ({ color, focused }) => (
            <View style={{ backgroundColor: focused ? 'rgba(124,58,237,0.15)' : 'transparent', borderRadius: 8, padding: 4 }}>
              <Ionicons name={focused ? 'person-circle' : 'person-circle-outline'} size={20} color={color} />
            </View>
          ),
        }}
      />
      <Tab.Screen
        name="More"
        component={MoreScreen}
        options={{
          tabBarLabel: t('nav.more'),
          tabBarIcon: ({ color, focused }) => (
            <View style={{ backgroundColor: focused ? 'rgba(124,58,237,0.15)' : 'transparent', borderRadius: 8, padding: 4 }}>
              <Ionicons name={focused ? 'grid' : 'grid-outline'} size={20} color={color} />
            </View>
          ),
        }}
      />
    </Tab.Navigator>
  );
}

function AuthStack() {
  return (
    <Stack.Navigator screenOptions={stackScreenOptions}>
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Register" component={RegisterScreen} />
    </Stack.Navigator>
  );
}

function MainStack() {
  return (
    <Stack.Navigator screenOptions={stackScreenOptions}>
      <Stack.Screen name="MainTabs" component={MainTabs} />
      <Stack.Screen name="UserProfile" component={ProfileScreen} />
      <Stack.Screen name="Create" component={CreateScreen} />
      <Stack.Screen name="Notifications" component={NotificationsScreen} />
      <Stack.Screen name="Explore" component={ExploreScreen} />
      <Stack.Screen name="Reels" component={ReelsScreen} />
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
      <Stack.Screen name="LabHistory" component={LabHistoryScreen} />
      <Stack.Screen name="InspirationHistory" component={InspirationHistoryScreen} />
      <Stack.Screen name="Capsules" component={CapsulesScreen} />
      <Stack.Screen name="Vault" component={VaultScreen} />
      <Stack.Screen name="Shop" component={ShopScreen} />
      <Stack.Screen name="ShopProduct" component={ShopProductScreen} />
      <Stack.Screen name="ShopOrders" component={ShopOrdersScreen} />
      <Stack.Screen name="Wallet" component={WalletScreen} />
      <Stack.Screen name="Passport" component={PassportScreen} />
      <Stack.Screen name="Live" component={LiveScreen} />
      <Stack.Screen name="LiveViewer" component={LiveViewerScreen} />
      <Stack.Screen
        name="StoryStudio"
        component={StoryStudioScreen}
        options={{ presentation: 'modal' }}
      />
      <Stack.Screen name="StoryMap" component={StoryMapScreen} />
      <Stack.Screen name="Highlights" component={HighlightsManagerScreen} />
      <Stack.Screen name="EditProfile" component={EditProfileScreen} />
      <Stack.Screen name="Settings" component={SettingsScreen} />
      <Stack.Screen name="Legal" component={LegalScreen} />
      <Stack.Screen name="InAppWeb" component={InAppWebScreen} />
      <Stack.Screen name="Privacy" component={PrivacyScreen} />
      <Stack.Screen name="BlockedAccounts" component={BlockedAccountsScreen} />
      <Stack.Screen name="InspirationTaste" component={InspirationTasteScreen} />
      <Stack.Screen name="Appeals" component={AppealsScreen} />
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
      <Stack.Screen name="StudioSession" component={StudioSessionScreen} />
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
      <Stack.Screen name="AdminSection" component={AdminSectionScreen} />
      <Stack.Screen name="AdminMarketing" component={AdminMarketingScreen} />
      <Stack.Screen name="CommunityWiki" component={CommunityWikiScreen} />
      <Stack.Screen name="Saved" component={SavedScreen} />
      <Stack.Screen name="Search" component={SearchScreen} />
      <Stack.Screen name="TagFeed" component={TagFeedScreen} />
    </Stack.Navigator>
  );
}

function RootNavigator() {
  const { isLoading, isAuthenticated, user } = useAuth();
  const { isDark } = useTheme();
  const [fontsLoaded, fontError] = useFonts(INTER_FONTS);
  const [appReady, setAppReady] = useState(false);
  const fontsReady = fontsLoaded || !!fontError;

  useEffect(() => {
    if (fontsLoaded) applyDefaultInter();
  }, [fontsLoaded]);

  useEffect(() => {
    if (!isLoading && fontsReady) {
      SplashScreenExpo.hideAsync().finally(() => setAppReady(true));
    }
  }, [isLoading, fontsReady]);

  if (!appReady || isLoading || !fontsReady) {
    return <SplashScreen />;
  }

  const needsOnboarding = isAuthenticated && user && user.onboarding_completed === false;

  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <NavigationContainer>
      {!isAuthenticated ? (
        <AuthStack />
      ) : needsOnboarding ? (
        <Stack.Navigator screenOptions={stackScreenOptions}>
          <Stack.Screen name="Onboarding" component={OnboardingScreen} />
        </Stack.Navigator>
      ) : (
        <MainStack />
      )}
    </NavigationContainer>
    </>
  );
}

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AuthProvider>
          <LocaleProvider>
            <RootNavigator />
          </LocaleProvider>
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

