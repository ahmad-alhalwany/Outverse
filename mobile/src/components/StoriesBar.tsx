import React from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import Avatar from './Avatar';
import { useAuth } from '../auth/AuthContext';
import { useTheme } from '../hooks/useTheme';
import type { Story } from '../types';

interface StoriesBarProps {
  stories: Story[];
  onStoryPress: (story: Story, index: number) => void;
  onAddStory?: () => void;
}

/** Cosmic story rail — lavender rings, not Instagram chrome. */
export default function StoriesBar({ stories, onStoryPress, onAddStory }: StoriesBarProps) {
  const { user } = useAuth();
  const { colors, isDark } = useTheme();

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: isDark ? '#12101F' : colors.surface,
          borderBottomColor: isDark ? 'rgba(167,139,250,0.18)' : 'rgba(124,58,237,0.12)',
        },
      ]}
    >
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <Pressable style={styles.storyItem} onPress={onAddStory}>
          <View style={styles.addWrap}>
            <View style={[styles.ring, styles.ringMine]}>
              <Avatar avatar={user?.avatar} name={user?.username} size="lg" />
            </View>
            <View style={styles.plusBadge}>
              <Text style={styles.plusText}>＋</Text>
            </View>
          </View>
          <Text style={[styles.label, { color: colors.textSecondary }]} numberOfLines={1}>
            إشارتك
          </Text>
        </Pressable>

        {stories.map((story, index) => {
          const storyUser = story.user;
          const closeFriends = (story as { audience?: string }).audience === 'close_friends';
          const viewed = !!story.is_viewed;
          return (
            <Pressable
              key={story.id}
              style={styles.storyItem}
              onPress={() => onStoryPress(story, index)}
            >
              <View
                style={[
                  styles.ring,
                  closeFriends ? styles.ringOrbit : viewed ? styles.ringViewed : styles.ringLive,
                ]}
              >
                <Avatar avatar={storyUser?.avatar} name={storyUser?.username} size="lg" />
              </View>
              <Text style={[styles.label, { color: colors.textSecondary }]} numberOfLines={1}>
                {storyUser?.username || 'مستخدم'}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  scroll: {
    paddingHorizontal: 10,
    paddingVertical: 12,
  },
  storyItem: {
    alignItems: 'center',
    marginRight: 10,
    width: 74,
  },
  addWrap: {
    position: 'relative',
  },
  ring: {
    padding: 2.5,
    borderRadius: 40,
    borderWidth: 2.5,
  },
  ringMine: {
    borderColor: 'rgba(167,139,250,0.45)',
    borderStyle: 'dashed',
  },
  ringLive: {
    borderColor: '#A78BFA',
    shadowColor: '#7C3AED',
    shadowOpacity: 0.45,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
  },
  ringViewed: {
    borderColor: 'rgba(148,163,184,0.45)',
  },
  ringOrbit: {
    borderColor: '#34D399',
  },
  plusBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#7C3AED',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#12101F',
  },
  plusText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 14,
  },
  label: {
    fontSize: 11,
    marginTop: 5,
    textAlign: 'center',
    fontWeight: '600',
  },
});
