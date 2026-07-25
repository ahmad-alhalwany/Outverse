import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  Dimensions,
  Image,
  StatusBar,
  Animated,
} from 'react-native';
import Video from 'react-native-video';
import Avatar from './Avatar';
import { mediaUrl } from '../api/config';
import type { Story } from '../types';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const STORY_DURATION = 5000; // 5 seconds

interface StoryViewerProps {
  visible: boolean;
  stories: Story[];
  startIndex: number;
  onClose: () => void;
  onViewStory?: (storyId: string | number) => void;
}

export default function StoryViewer({
  visible,
  stories,
  startIndex,
  onClose,
  onViewStory,
}: StoryViewerProps) {
  const [currentIndex, setCurrentIndex] = useState(startIndex);
  const [progress, setProgress] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const currentStory = stories[currentIndex];

  useEffect(() => {
    if (visible) {
      setCurrentIndex(startIndex);
      setProgress(0);
    }
  }, [visible, startIndex]);

  useEffect(() => {
    if (!visible || !currentStory) return;

    onViewStory?.(currentStory.id);

    setProgress(0);
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => {
      setProgress((p) => {
        const next = p + 100 / (STORY_DURATION / 50);
        if (next >= 100) {
          if (currentIndex < stories.length - 1) {
            setCurrentIndex((i) => i + 1);
            return 0;
          } else {
            onClose();
            return 0;
          }
        }
        return next;
      });
    }, 50);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [visible, currentIndex, currentStory, stories.length, onClose, onViewStory]);

  if (!currentStory) return null;

  const mediaUri = mediaUrl(
    currentStory.media || currentStory.image || currentStory.video || '',
  );
  const isVideo = Boolean(currentStory.video) || currentStory.media_type === 'video';

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <StatusBar barStyle="light-content" />

        {/* Progress bars */}
        <View style={styles.progressBars}>
          {stories.map((_, i) => (
            <View key={i} style={styles.progressTrack}>
              <View
                style={[
                  styles.progressFill,
                  {
                    width: `${i < currentIndex ? 100 : i === currentIndex ? progress : 0}%`,
                  },
                ]}
              />
            </View>
          ))}
        </View>

        {/* Header */}
        <View style={styles.header}>
          <Avatar user={currentStory.user} size="sm" />
          <Text style={styles.username}>{currentStory.user?.username || 'مستخدم'}</Text>
          <Text style={styles.time}>{formatTime(currentStory.created_at)}</Text>
          <Pressable onPress={onClose} style={styles.closeBtn}>
            <Text style={styles.closeText}>✕</Text>
          </Pressable>
        </View>

        {/* Media */}
        {mediaUri ? (
          isVideo ? (
            <Video
              source={{ uri: mediaUri }}
              style={styles.media}
              resizeMode="contain"
              repeat={false}
              paused={false}
              controls={false}
            />
          ) : (
            <Image source={{ uri: mediaUri }} style={styles.media} resizeMode="contain" />
          )
        ) : (
          <View style={[styles.media, styles.mediaPlaceholder]}>
            <Text style={styles.placeholderText}>
              {currentStory.text || 'Story'}
            </Text>
          </View>
        )}

        {/* Tap zones for prev/next */}
        <View style={styles.tapZones}>
          <Pressable
            style={styles.tapLeft}
            onPress={() => currentIndex > 0 && setCurrentIndex((i) => i - 1)}
          />
          <Pressable
            style={styles.tapRight}
            onPress={() =>
              currentIndex < stories.length - 1
                ? setCurrentIndex((i) => i + 1)
                : onClose()
            }
          />
        </View>
      </View>
    </Modal>
  );
}

function formatTime(dateStr: string): string {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}د`;
  return `${Math.floor(mins / 60)}س`;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0c0818',
  },
  progressBars: {
    flexDirection: 'row',
    paddingTop: 50,
    paddingHorizontal: 8,
    gap: 4,
  },
  progressTrack: {
    flex: 1,
    height: 3,
    backgroundColor: 'rgba(167,139,250,0.25)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#A78BFA',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    paddingTop: 60,
  },
  username: {
    color: '#F5F3FF',
    fontSize: 14,
    fontWeight: '700',
    marginLeft: 10,
  },
  time: {
    color: 'rgba(245,243,255,0.65)',
    fontSize: 12,
    marginLeft: 8,
  },
  closeBtn: {
    marginLeft: 'auto',
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(124,58,237,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  media: {
    flex: 1,
    width: '100%',
  },
  mediaPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  placeholderText: {
    color: '#fff',
    fontSize: 18,
    textAlign: 'center',
  },
  tapZones: {
    position: 'absolute',
    top: 110,
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
  },
  tapLeft: {
    width: '40%',
    height: '100%',
  },
  tapRight: {
    width: '60%',
    height: '100%',
  },
});
