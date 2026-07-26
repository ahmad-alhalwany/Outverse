import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from 'axios';
import * as SecureStore from 'expo-secure-store';
import { API_BASE_URL } from './config';
import type { Post, Reel, Comment, Notification } from '../types';

const TOKEN_KEY = 'auth_token';
const REFRESH_TOKEN_KEY = 'refresh_token'; // legacy key — cleared on logout

export type LoginResult =
  | { requires_2fa: true; pending_token: string }
  | { token: string; user: Record<string, unknown> };

export type FeedPage<T> = {
  results: T[];
  count: number;
  has_more: boolean;
  next?: string | null;
};

export type OrbitListMember = {
  id: number;
  username: string;
  first_name?: string;
  last_name?: string;
  added_at?: string;
};

export type OrbitList = {
  id: number;
  title: string;
  description?: string;
  is_private: boolean;
  member_count: number;
  is_following?: boolean;
  members?: OrbitListMember[];
  owner?: { id?: number; username?: string };
};

function unwrapList<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[];
  if (data && typeof data === 'object') {
    const obj = data as Record<string, unknown>;
    if (Array.isArray(obj.results)) return obj.results as T[];
    if (Array.isArray(obj.messages)) return obj.messages as T[];
  }
  return [];
}

function toFeedPage<T>(data: unknown): FeedPage<T> {
  if (Array.isArray(data)) {
    return { results: data as T[], count: data.length, has_more: false };
  }
  const obj = (data || {}) as Record<string, unknown>;
  const results = unwrapList<T>(data);
  return {
    results,
    count: typeof obj.count === 'number' ? obj.count : results.length,
    has_more: Boolean(obj.has_more ?? obj.next),
    next: (obj.next as string | null | undefined) ?? null,
  };
}

class ApiClient {
  private client: AxiosInstance;
  private onUnauthorized: (() => void) | null = null;

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });
    this.setupInterceptors();
  }

  /** Register a handler for hard 401s (session cleared). */
  setUnauthorizedHandler(handler: (() => void) | null) {
    this.onUnauthorized = handler;
  }

  private setupInterceptors() {
    this.client.interceptors.request.use(
      async (config: InternalAxiosRequestConfig) => {
        const token = await SecureStore.getItemAsync(TOKEN_KEY);
        if (token && config.headers) {
          // Backend uses DRF TokenAuthentication — not JWT Bearer.
          config.headers.Authorization = `Token ${token}`;
        }
        // Let RN set multipart boundary for FormData bodies.
        if (typeof FormData !== 'undefined' && config.data instanceof FormData) {
          if (config.headers) {
            delete (config.headers as Record<string, unknown>)['Content-Type'];
          }
        }
        return config;
      },
      (error) => Promise.reject(error),
    );

    this.client.interceptors.response.use(
      (response) => response,
      async (error: AxiosError) => {
        const status = error.response?.status;
        const url = String(error.config?.url || '');
        const isAuthEndpoint =
          url.includes('/users/login') ||
          url.includes('/users/register') ||
          url.includes('/users/forgot-password') ||
          url.includes('/users/reset-password') ||
          url.includes('/users/login/2fa');

        if (status === 401 && !isAuthEndpoint) {
          await SecureStore.deleteItemAsync(TOKEN_KEY);
          await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
          this.onUnauthorized?.();
        }
        return Promise.reject(error);
      },
    );
  }

  async getStoredToken() {
    return SecureStore.getItemAsync(TOKEN_KEY);
  }

  // ── Auth ──────────────────────────────────────────────────────────
  async login(usernameOrEmail: string, password: string): Promise<LoginResult> {
    const payload = usernameOrEmail.includes('@')
      ? { email: usernameOrEmail, password }
      : { username: usernameOrEmail, password };
    const response = await this.client.post('/users/login/', payload);
    const data = response.data;

    if (data?.requires_2fa && data?.pending_token) {
      return { requires_2fa: true, pending_token: data.pending_token };
    }

    const token = data?.token as string | undefined;
    if (!token) {
      throw new Error(data?.error || 'Login failed.');
    }
    await SecureStore.setItemAsync(TOKEN_KEY, token);
    await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
    return { token, user: data.user };
  }

  async completeTwoFactorLogin(pendingToken: string, code: string) {
    const response = await this.client.post('/users/login/2fa/', {
      pending_token: pendingToken,
      code,
    });
    const token = response.data?.token as string | undefined;
    if (!token) {
      throw new Error(response.data?.error || '2FA verification failed.');
    }
    await SecureStore.setItemAsync(TOKEN_KEY, token);
    await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
    return { token, user: response.data.user };
  }

  async register(data: {
    username: string;
    email: string;
    password: string;
    first_name?: string;
    last_name?: string;
  }) {
    const response = await this.client.post('/users/register/', {
      username: data.username,
      email: data.email,
      password: data.password,
      first_name: data.first_name || '',
      last_name: data.last_name || '',
    });
    // Register may return {token, user} when email verification is off,
    // or a verify-required payload. Persist token when present.
    if (response.data?.token) {
      await SecureStore.setItemAsync(TOKEN_KEY, response.data.token);
    }
    return response.data;
  }

  async loginWithGoogle(idToken: string): Promise<LoginResult> {
    const response = await this.client.post('/users/auth/google/', {
      id_token: idToken,
    });
    const data = response.data;
    if (data?.requires_2fa && data?.pending_token) {
      return { requires_2fa: true, pending_token: data.pending_token };
    }
    const token = data?.token as string | undefined;
    if (!token) {
      throw new Error(data?.error || 'Google sign-in failed.');
    }
    await SecureStore.setItemAsync(TOKEN_KEY, token);
    await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
    return { token, user: data.user };
  }

  async loginWithApple(identityToken: string): Promise<LoginResult> {
    const response = await this.client.post('/users/auth/apple/', {
      identity_token: identityToken,
    });
    const data = response.data;
    if (data?.requires_2fa && data?.pending_token) {
      return { requires_2fa: true, pending_token: data.pending_token };
    }
    const token = data?.token as string | undefined;
    if (!token) {
      throw new Error(data?.error || 'Apple sign-in failed.');
    }
    await SecureStore.setItemAsync(TOKEN_KEY, token);
    await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
    return { token, user: data.user };
  }

  async forgotPassword(email: string) {
    const response = await this.client.post('/users/forgot-password/', { email });
    return response.data;
  }

  async resetPassword(token: string, password: string) {
    const response = await this.client.post('/users/reset-password/', {
      token,
      password,
    });
    return response.data;
  }

  async logout() {
    try {
      await this.client.post('/users/logout/');
    } catch {
      // Ignore logout network errors — always clear local session.
    } finally {
      await SecureStore.deleteItemAsync(TOKEN_KEY);
      await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
    }
  }

  async getMe() {
    const response = await this.client.get('/users/me/');
    return response.data;
  }

  async updateProfile(
    userId: string | number,
    data: FormData | Record<string, unknown>,
  ) {
    const response = await this.client.patch(`/users/${userId}/update/`, data);
    return response.data;
  }

  // ── Posts ─────────────────────────────────────────────────────────
  async getPosts(params?: {
    limit?: number;
    offset?: number;
    ordering?: string;
    author?: string | number;
    feed?: string;
    tag?: string;
    community?: string;
    sort?: string;
  }): Promise<FeedPage<Post>> {
    const response = await this.client.get('/posts/', {
      params: {
        limit: params?.limit ?? 10,
        offset: params?.offset ?? 0,
        ordering: params?.ordering,
        author: params?.author,
        feed: params?.feed,
        tag: params?.tag,
        community: params?.community,
        sort: params?.sort,
      },
    });
    return toFeedPage(response.data);
  }

  async getPost(id: string | number) {
    const response = await this.client.get(`/posts/${id}/`);
    return response.data;
  }

  async createPost(payload: {
    text?: string;
    post_type?: 'normal' | 'poll' | 'question';
    poll_options?: string[];
    location_name?: string;
    location_lat?: number;
    location_lng?: number;
    visibility?: string;
    reply_control?: string;
    thread_parent?: string | number;
    community_id?: string | number;
    flair?: string;
    is_spoiler?: boolean;
    required_tier?: string | number | null;
    media?: Array<{ uri: string; type: 'image' | 'video'; name?: string }>;
  }) {
    const body: Record<string, unknown> = {
      text: payload.text || '',
      visibility: payload.visibility || 'public',
    };
    if (payload.post_type) body.post_type = payload.post_type;
    if (payload.poll_options?.length) body.poll_options = payload.poll_options;
    if (payload.location_name) body.location_name = payload.location_name;
    if (payload.location_lat != null) body.location_lat = payload.location_lat;
    if (payload.location_lng != null) body.location_lng = payload.location_lng;
    if (payload.reply_control) body.reply_control = payload.reply_control;
    if (payload.thread_parent != null) body.thread_parent = payload.thread_parent;
    if (payload.community_id != null) body.community_id = payload.community_id;
    if (payload.flair) body.flair = payload.flair;
    if (payload.is_spoiler) body.is_spoiler = true;
    if (payload.required_tier != null) body.required_tier = payload.required_tier;
    const response = await this.client.post('/posts/', body);
    const post = response.data;
    if (payload.media?.length && post?.id) {
      const formData = new FormData();
      payload.media.forEach((m, i) => {
        formData.append('media', {
          uri: m.uri,
          type: m.type === 'video' ? 'video/mp4' : 'image/jpeg',
          name: m.name || `media_${i}.${m.type === 'video' ? 'mp4' : 'jpg'}`,
        } as unknown as Blob);
      });
      await this.client.post(`/posts/${post.id}/add_media/`, formData);
      return this.getPost(post.id);
    }
    return post;
  }

  async votePoll(postId: string | number, optionId: string | number) {
    const response = await this.client.post(`/posts/${postId}/poll_vote/`, { option_id: optionId });
    return response.data;
  }

  async getThread(postId: string | number) {
    const response = await this.client.get(`/posts/${postId}/thread/`);
    const data = response.data;
    return Array.isArray(data) ? data : data?.results || [];
  }

  async repostPost(id: string | number, text?: string) {
    const trimmed = (text || '').trim();
    const response = await this.client.post(`/posts/${id}/repost/`, trimmed ? { text: trimmed } : {});
    return response.data as {
      reposted?: boolean;
      reposts_count?: number;
      post?: Record<string, unknown>;
      id?: number;
    };
  }

  async toggleSavePost(id: string | number, collectionId?: number) {
    const response = await this.client.post(`/posts/${id}/toggle_save/`, {
      ...(collectionId ? { collection: collectionId } : {}),
    });
    return response.data as { saved: boolean; collection?: number | null };
  }

  async getCollections() {
    const response = await this.client.get('/collections/');
    const data = response.data;
    return (Array.isArray(data) ? data : data?.results || []) as Array<{
      id: number;
      name: string;
      item_count: number;
      is_public?: boolean;
    }>;
  }

  async createCollection(name: string, isPublic = false) {
    const response = await this.client.post('/collections/', {
      name: name.trim(),
      is_public: isPublic,
    });
    return response.data as { id: number; name: string; item_count: number; is_public?: boolean };
  }

  async updateCollection(
    id: string | number,
    payload: { is_public?: boolean; name?: string },
  ) {
    const body: Record<string, unknown> = {};
    if (payload.is_public != null) body.is_public = payload.is_public;
    if (payload.name != null) body.name = payload.name.trim();
    const response = await this.client.patch(`/collections/${id}/`, body);
    return response.data as { id: number; name: string; item_count: number; is_public?: boolean };
  }

  async getPublicBoard(collectionId: string | number) {
    const response = await this.client.get(`/collections/${collectionId}/public/`);
    return response.data as {
      collection?: Record<string, unknown>;
      items?: Record<string, unknown>[];
    };
  }

  async pinProfilePost(id: string | number) {
    try {
      const response = await this.client.post(`/posts/${id}/pin-profile/`, {});
      return response.data as {
        is_profile_pinned: boolean;
        profile_pinned_at?: string | null;
        error?: string;
        max?: number;
      };
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { error?: string; max?: number } } };
      return {
        is_profile_pinned: false,
        error: ax.response?.data?.error || 'Could not pin signal.',
        max: ax.response?.data?.max,
      };
    }
  }

  async getTrendingTags() {
    const response = await this.client.get('/posts/trending_tags/');
    const data = response.data;
    return (Array.isArray(data) ? data : data?.results || []) as Array<{ tag?: string; score?: number }>;
  }

  async getOrbitLists(following = false) {
    const response = await this.client.get('/orbit-lists/', {
      params: following ? { following: 1 } : undefined,
    });
    const data = response.data;
    return (Array.isArray(data) ? data : data?.results || []) as OrbitList[];
  }

  async createOrbitList(payload: { title: string; description?: string; is_private?: boolean }) {
    const response = await this.client.post('/orbit-lists/', payload);
    return response.data as OrbitList;
  }

  async getOrbitList(id: string | number) {
    const response = await this.client.get(`/orbit-lists/${id}/`);
    return response.data as OrbitList;
  }

  async addOrbitListMember(listId: string | number, userId: string | number) {
    const response = await this.client.post(`/orbit-lists/${listId}/members/`, {
      user_id: userId,
    });
    return response.data as OrbitList;
  }

  async removeOrbitListMember(listId: string | number, userId: string | number) {
    await this.client.delete(`/orbit-lists/${listId}/members/${userId}/`);
  }

  async deleteOrbitList(listId: string | number) {
    await this.client.delete(`/orbit-lists/${listId}/`);
  }

  async getOrbitListFeed(listId: string | number, params?: { limit?: number; offset?: number }) {
    const response = await this.client.get(`/orbit-lists/${listId}/feed/`, {
      params: { limit: params?.limit ?? 20, offset: params?.offset ?? 0 },
    });
    return toFeedPage(response.data);
  }

  async votePost(id: string | number, vote: 'boost' | 'dim' | null) {
    const response = await this.client.post(`/posts/${id}/vote/`, { vote });
    return response.data as {
      vote_score: number;
      boost_count: number;
      dim_count: number;
      my_vote: 'boost' | 'dim' | null;
    };
  }

  async reactToPost(id: string | number, reaction: string | null) {
    const response = await this.client.post(`/posts/${id}/react/`, { reaction });
    return response.data as {
      reaction_counts: Record<string, number>;
      my_reaction: string | null;
      total: number;
    };
  }

  async deletePost(id: string | number) {
    const response = await this.client.delete(`/posts/${id}/`);
    return response.data;
  }

  // ── Comments ──────────────────────────────────────────────────────
  async getComments(postId: string | number, params?: { sort?: string }): Promise<FeedPage<Comment>> {
    const response = await this.client.get('/comments/', {
      params: { post: postId, ...params },
    });
    return toFeedPage(response.data);
  }

  async createComment(postId: string | number, text: string, parent?: string | number) {
    const response = await this.client.post('/comments/', {
      post: postId,
      text,
      parent,
    });
    return response.data;
  }

  async reactToComment(id: string | number, reaction: string | null) {
    const response = await this.client.post(`/comments/${id}/react/`, { reaction });
    return response.data as {
      reaction_counts: Record<string, number>;
      my_reaction: string | null;
    };
  }

  // ── Stories ───────────────────────────────────────────────────────
  async getStories() {
    const response = await this.client.get('/stories/');
    return response.data;
  }

  async createStory(formData: FormData) {
    const response = await this.client.post('/stories/', formData);
    return response.data;
  }

  async viewStory(id: string | number) {
    const response = await this.client.post(`/stories/${id}/view/`);
    return response.data;
  }

  async getStoryArchive() {
    const response = await this.client.get('/stories/archive/');
    const data = response.data;
    return Array.isArray(data) ? data : data?.results || [];
  }

  async getSpotlightStories() {
    const response = await this.client.get('/stories/spotlight/');
    const data = response.data;
    return Array.isArray(data) ? data : data?.results || [];
  }

  async submitSpotlight(storyId: string | number) {
    const response = await this.client.post(`/stories/${storyId}/submit_spotlight/`, {});
    return response.data;
  }

  async getStoryMap(params?: {
    min_lat?: number;
    max_lat?: number;
    min_lng?: number;
    max_lng?: number;
  }) {
    const response = await this.client.get('/stories/map/', { params });
    const data = response.data;
    return Array.isArray(data) ? data : data?.results || [];
  }

  async getConstellations(userId?: string | number) {
    const response = await this.client.get('/story-constellations/', {
      params: userId ? { user: userId } : undefined,
    });
    return Array.isArray(response.data) ? response.data : [];
  }

  async createConstellation(title: string) {
    const response = await this.client.post('/story-constellations/', { title });
    return response.data;
  }

  async getConstellation(id: string | number) {
    const response = await this.client.get(`/story-constellations/${id}/`);
    return response.data as { id: number; title: string; cover?: string | null; stories: any[] };
  }

  async addStoryToConstellation(constellationId: string | number, storyId: string | number) {
    const response = await this.client.post(`/story-constellations/${constellationId}/add-story/`, {
      story_id: storyId,
    });
    return response.data;
  }

  async saveStoryToConstellation(storyId: string | number, title?: string) {
    const response = await this.client.post(`/stories/${storyId}/save-to-constellation/`, {
      title: title || '',
    });
    return response.data;
  }

  async sharePostToStory(postId: string | number, imageUri: string) {
    const form = new FormData();
    form.append('image', {
      uri: imageUri,
      name: 'shared-post.jpg',
      type: 'image/jpeg',
    } as any);
    form.append('overlays', '[]');
    form.append('drawing', '[]');
    form.append('shared_post_id', String(postId));
    return this.createStory(form);
  }

  async shareReelToStory(reelId: string | number, videoUri: string, caption?: string) {
    const form = new FormData();
    form.append('video', {
      uri: videoUri,
      name: 'shared-reel.mp4',
      type: 'video/mp4',
    } as any);
    form.append('text', (caption || '').slice(0, 200));
    form.append(
      'overlays',
      JSON.stringify([
        {
          id: `reel-link-${reelId}`,
          type: 'text',
          text: `↗ Signal #${reelId}`,
          x: 50,
          y: 88,
          color: '#ffffff',
          fontSize: 28,
          fontWeight: 600,
          align: 'center',
        },
      ]),
    );
    form.append('drawing', '[]');
    return this.createStory(form);
  }

  async getCloseFriends() {
    const response = await this.client.get('/close-friends/');
    return Array.isArray(response.data) ? response.data : [];
  }

  async addCloseFriend(friendId: string | number) {
    const response = await this.client.post('/close-friends/', { friend_id: friendId });
    return response.data;
  }

  async removeCloseFriend(friendId: string | number) {
    await this.client.delete(`/close-friends/${friendId}/`);
  }

  // ── Reels ─────────────────────────────────────────────────────────
  async getReels(params?: {
    limit?: number;
    offset?: number;
    feed?: 'all' | 'following';
    music_track?: string | number;
    tag?: string;
  }): Promise<FeedPage<Reel>> {
    const response = await this.client.get('/reels/', {
      params: {
        limit: params?.limit ?? 10,
        offset: params?.offset ?? 0,
        ...(params?.feed === 'following' ? { feed: 'following' } : {}),
        ...(params?.music_track != null ? { music_track: params.music_track } : {}),
        ...(params?.tag ? { tag: params.tag } : {}),
      },
    });
    return toFeedPage(response.data);
  }

  async getReelsByMusicTrack(musicTrack: string | number) {
    return this.getReels({ limit: 40, offset: 0, music_track: musicTrack });
  }

  async getReel(id: string | number) {
    const response = await this.client.get(`/reels/${id}/`);
    return response.data;
  }

  async getReelDiscover() {
    const response = await this.client.get('/reels/discover/');
    return response.data;
  }

  async getReelMusic() {
    const response = await this.client.get('/reel-music/');
    const data = response.data;
    return Array.isArray(data) ? data : data?.results || [];
  }

  async getReelTemplates() {
    const response = await this.client.get('/reel-templates/');
    const data = response.data;
    return Array.isArray(data) ? data : data?.results || [];
  }

  async generateReelCaptions(id: string | number, language = 'en') {
    const response = await this.client.post(`/reels/${id}/generate-captions/`, { language, force: true });
    return response.data;
  }

  async reelDwell(id: string | number, seconds: number) {
    const response = await this.client.post(`/reels/${id}/dwell/`, { seconds });
    return response.data;
  }

  async createReel(formData: FormData) {
    const response = await this.client.post('/reels/', formData);
    return response.data;
  }

  async reactToReel(id: string | number, reaction: string | null) {
    const response = await this.client.post(`/reels/${id}/react/`, { reaction });
    return response.data as {
      reaction_counts: Record<string, number>;
      my_reaction: string | null;
    };
  }

  async recordReelView(id: string | number) {
    const response = await this.client.post(`/reels/${id}/record_view/`);
    return response.data;
  }

  async saveReel(id: string | number) {
    const response = await this.client.post(`/reels/${id}/save/`);
    return response.data as { saved: boolean };
  }

  async dimReel(id: string | number) {
    const response = await this.client.post(`/reels/${id}/dim/`);
    return response.data as { dimmed: boolean };
  }

  async getReelComments(reelId: string | number, params?: { sort?: string }) {
    const response = await this.client.get('/reel-comments/', {
      params: { reel: reelId, ...params },
    });
    return toFeedPage(response.data);
  }

  async createReelComment(reelId: string | number, text: string) {
    const response = await this.client.post('/reel-comments/', {
      reel: reelId,
      text,
    });
    return response.data;
  }

  async shareReel(id: string | number, channel = 'other') {
    const response = await this.client.post(`/reels/${id}/share/`, { channel });
    return response.data as { shares_count: number; channel: string };
  }

  // ── Long-form videos / playlists ─────────────────────────────────
  async getVideos(params?: { limit?: number; offset?: number; mine?: boolean; ordering?: string }) {
    const response = await this.client.get('/videos/', {
      params: {
        limit: params?.limit,
        offset: params?.offset,
        mine: params?.mine ? '1' : undefined,
        ordering: params?.ordering,
      },
    });
    return toFeedPage(response.data);
  }

  async createVideo(formData: FormData) {
    const response = await this.client.post('/videos/', formData);
    return response.data;
  }

  async getVideo(id: string | number) {
    const response = await this.client.get(`/videos/${id}/`);
    return response.data;
  }

  async premiereVideo(id: string | number, premiereAt: string) {
    const response = await this.client.post(`/videos/${id}/premiere/`, {
      premiere_at: premiereAt,
    });
    return response.data;
  }

  async getVideoChapters(videoId: string | number) {
    const response = await this.client.get(`/videos/${videoId}/chapters/`);
    return Array.isArray(response.data) ? response.data : response.data?.results || [];
  }

  async addVideoChapter(
    videoId: string | number,
    payload: { title: string; start_seconds: number; order?: number },
  ) {
    const response = await this.client.post(`/videos/${videoId}/chapters/`, payload);
    return response.data;
  }

  async getPlaylists(params?: { limit?: number; offset?: number }) {
    const response = await this.client.get('/playlists/', { params });
    return toFeedPage(response.data);
  }

  async getPlaylist(id: string | number) {
    const response = await this.client.get(`/playlists/${id}/`);
    return response.data;
  }

  async createPlaylist(payload: { title: string; description?: string; is_public?: boolean }) {
    const response = await this.client.post('/playlists/', payload);
    return response.data;
  }

  async addPlaylistItem(playlistId: string | number, videoId: string | number, order?: number) {
    const response = await this.client.post(`/playlists/${playlistId}/add_item/`, {
      video_id: videoId,
      ...(order != null ? { order } : {}),
    });
    return response.data;
  }

  async getPreferences() {
    const response = await this.client.get('/preferences/');
    return response.data;
  }

  async updatePreferences(payload: Record<string, unknown>) {
    const response = await this.client.put('/preferences/', payload);
    return response.data;
  }

  // ── Users / profiles ──────────────────────────────────────────────
  async getProfile(username: string) {
    const response = await this.client.get(`/users/by-username/${username}/`);
    return response.data;
  }

  async getProfileById(userId: string | number) {
    const response = await this.client.get(`/users/${userId}/`);
    return response.data;
  }

  async getMyExperience() {
    const response = await this.client.get('/users/me/experience/');
    return Array.isArray(response.data) ? response.data : response.data?.results || [];
  }

  async getUserExperience(userId: string | number) {
    const response = await this.client.get(`/users/${userId}/experience/`);
    return Array.isArray(response.data) ? response.data : response.data?.results || [];
  }

  async createExperience(payload: {
    title: string;
    organization?: string;
    start_date?: string;
    end_date?: string | null;
    is_current?: boolean;
    description?: string;
  }) {
    const response = await this.client.post('/users/me/experience/', payload);
    return response.data;
  }

  async updateExperience(
    experienceId: string | number,
    payload: Partial<{
      title: string;
      organization: string;
      start_date: string;
      end_date: string | null;
      is_current: boolean;
      description: string;
    }>,
  ) {
    const response = await this.client.patch(`/users/me/experience/${experienceId}/`, payload);
    return response.data;
  }

  async deleteExperience(experienceId: string | number) {
    await this.client.delete(`/users/me/experience/${experienceId}/`);
  }

  /** Toggle follow — backend uses a single endpoint with following_id. */
  async toggleFollow(userId: string | number) {
    const response = await this.client.post('/users/follow/', {
      following_id: userId,
    });
    return response.data as { following?: boolean; is_following?: boolean };
  }

  async followUser(userId: string | number) {
    return this.toggleFollow(userId);
  }

  async unfollowUser(userId: string | number) {
    return this.toggleFollow(userId);
  }

  async getFollowers(userId: string | number) {
    const response = await this.client.get(`/users/${userId}/followers/`);
    return unwrapList(response.data);
  }

  async getFollowing(userId: string | number) {
    const response = await this.client.get(`/users/${userId}/following/`);
    return unwrapList(response.data);
  }

  async getSuggestions(exclude?: string | number) {
    const response = await this.client.get('/users/suggestions/', {
      params: exclude ? { exclude } : undefined,
    });
    return unwrapList(response.data);
  }

  // ── Notifications ─────────────────────────────────────────────────
  async getNotifications(params?: { page?: number; unread_only?: boolean }): Promise<FeedPage<Notification>> {
    const response = await this.client.get('/notifications/', { params });
    return toFeedPage(response.data);
  }

  async markNotificationRead(id: string | number) {
    const response = await this.client.post(`/notifications/${id}/read/`);
    return response.data;
  }

  async markAllNotificationsRead() {
    const response = await this.client.post('/notifications/read_all/');
    return response.data;
  }

  // ── Unified saved items (GET/DELETE /api/saved/) ──────────────────
  async getSavedItems(collection: 'all' | 'post' | 'reel' | 'idea' | 'story' = 'all') {
    const response = await this.client.get('/saved/', {
      params: { collection },
    });
    const data = response.data;
    return (Array.isArray(data) ? data : []) as Array<
      Record<string, unknown> & {
        saved_id: string;
        saved_type: 'post' | 'reel' | 'idea' | 'story';
      }
    >;
  }

  async unsaveItem(savedId: string) {
    await this.client.delete(`/saved/${savedId}/`);
  }

  // ── Search ────────────────────────────────────────────────────────
  async searchUsers(query: string): Promise<Array<{ id: number; username: string; name?: string; avatar?: string | null }>> {
    const response = await this.client.get('/users/mentions/', {
      params: { q: query },
    });
    return unwrapList(response.data);
  }

  async searchPosts(query: string) {
    const response = await this.client.get('/search/', {
      params: { q: query },
    });
    const data = response.data;
    if (Array.isArray(data)) return data;
    if (data?.posts) return data.posts;
    if (data?.results) return data.results;
    return [];
  }

  async search(
    query: string,
    params?: { category?: string; limit?: number; offset?: number },
  ): Promise<{
    users: Array<{ id: number; username: string; name?: string; avatar?: string | null }>;
    posts: Array<{ id: number; snippet?: string; author?: string; tags?: string[] }>;
    reels: Array<{ id: number; caption?: string; author?: string; tags?: string[] }>;
    ideas: Array<{ id: number; title?: string; description?: string; owner?: string }>;
    stories: Array<{ id: number; title?: string; description?: string; owner?: string }>;
    bottles: Array<{ id: number; message?: string; emotion_type?: string; sender?: string }>;
    shop: Array<{ id: number; name?: string; description?: string; creator?: string; price?: number }>;
    challenges: Array<{ id: number; title?: string; description?: string; type?: string }>;
    results?: unknown[];
    count?: number;
    has_more?: boolean;
  }> {
    const response = await this.client.get('/search/', {
      params: {
        q: query,
        ...(params?.category ? { category: params.category } : {}),
        ...(params?.limit != null ? { limit: params.limit } : {}),
        ...(params?.offset != null ? { offset: params.offset } : {}),
      },
    });
    const data = response.data || {};
    if (params?.category) {
      return {
        users: [],
        posts: [],
        reels: [],
        ideas: [],
        stories: [],
        bottles: [],
        shop: [],
        challenges: [],
        results: Array.isArray(data.results) ? data.results : [],
        count: typeof data.count === 'number' ? data.count : undefined,
        has_more: Boolean(data.has_more),
      };
    }
    return {
      users: Array.isArray(data.users) ? data.users : [],
      posts: Array.isArray(data.posts) ? data.posts : [],
      reels: Array.isArray(data.reels) ? data.reels : [],
      ideas: Array.isArray(data.ideas) ? data.ideas : [],
      stories: Array.isArray(data.stories) ? data.stories : [],
      bottles: Array.isArray(data.bottles) ? data.bottles : [],
      shop: Array.isArray(data.shop) ? data.shop : [],
      challenges: Array.isArray(data.challenges) ? data.challenges : [],
    };
  }

  // ── Chat ──────────────────────────────────────────────────────────
  async getConversations() {
    const response = await this.client.get('/chat/conversations/');
    return unwrapList(response.data);
  }

  async getMessages(conversationId: string | number, params?: { q?: string }) {
    const response = await this.client.get(
      `/chat/conversations/${conversationId}/messages/`,
      { params: params?.q ? { q: params.q } : undefined },
    );
    const messages = unwrapList<Record<string, unknown>>(response.data).map((m) => ({
      ...m,
      text: String(m.text ?? m.content ?? ''),
      content: String(m.text ?? m.content ?? ''),
    }));
    return {
      conversation_id: response.data?.conversation_id,
      peer: response.data?.peer ?? null,
      messages,
    };
  }

  async pinMessage(messageId: string | number) {
    const response = await this.client.post(`/chat/messages/${messageId}/pin/`, {});
    return response.data as { is_pinned: boolean };
  }

  async reactMessage(messageId: string | number, emoji: string | null) {
    const response = await this.client.post(`/chat/messages/${messageId}/react/`, { emoji });
    return response.data as {
      reaction_counts: Record<string, number>;
      my_reaction: string | null;
    };
  }

  async sendMessage(conversationId: string | number, text: string) {
    const response = await this.client.post(
      `/chat/conversations/${conversationId}/messages/`,
      { text },
    );
    return response.data;
  }

  async startConversation(peerId: string | number) {
    const response = await this.client.post('/chat/conversations/start/', {
      peer_id: peerId,
    });
    return response.data;
  }

  async muteConversation(conversationId: string | number, isMuted: boolean) {
    const response = await this.client.patch(
      `/chat/conversations/${conversationId}/state/`,
      { is_muted: isMuted },
    );
    return response.data as {
      conversation_id: number;
      is_muted: boolean;
      is_archived: boolean;
    };
  }

  async archiveConversation(conversationId: string | number, isArchived: boolean) {
    const response = await this.client.patch(
      `/chat/conversations/${conversationId}/state/`,
      { is_archived: isArchived },
    );
    return response.data as {
      conversation_id: number;
      is_muted: boolean;
      is_archived: boolean;
    };
  }

  async scheduleConversationMessage(
    conversationId: string | number,
    payload: { text: string; send_at: string },
  ) {
    const response = await this.client.post(
      `/chat/conversations/${conversationId}/schedule/`,
      payload,
    );
    return response.data;
  }

  async getRooms() {
    const response = await this.client.get('/chat/rooms/');
    return unwrapList(response.data);
  }

  async getRoomMessages(roomId: string | number) {
    const response = await this.client.get(`/chat/rooms/${roomId}/messages/`);
    const data = response.data as Record<string, unknown>;
    const rawMessages = Array.isArray(data?.messages)
      ? (data.messages as Record<string, unknown>[])
      : unwrapList<Record<string, unknown>>(data);
    const messages = rawMessages.map((m) => ({
      ...m,
      text: String(m.text ?? m.content ?? ''),
      content: String(m.text ?? m.content ?? ''),
    }));
    return {
      room_id: data?.room_id,
      name: String(data?.name ?? ''),
      messages,
    };
  }

  async sendRoomMessage(roomId: string | number, text: string) {
    const response = await this.client.post(`/chat/rooms/${roomId}/messages/`, { text });
    return response.data;
  }

  async getStageState(roomId: string | number) {
    const response = await this.client.get(`/chat/rooms/${roomId}/stage/`);
    const data = response.data?.state || response.data;
    return data as {
      speakers_count?: number;
      listeners_count?: number;
      speakers?: unknown[];
      listeners?: unknown[];
      hand_raised?: boolean;
      is_speaker?: boolean;
      joined?: boolean;
    };
  }

  async updateStageState(roomId: string | number, action: string) {
    const response = await this.client.post(`/chat/rooms/${roomId}/stage/`, { action });
    const data = response.data?.state || response.data;
    return data as {
      speakers_count?: number;
      listeners_count?: number;
      speakers?: unknown[];
      listeners?: unknown[];
      hand_raised?: boolean;
      is_speaker?: boolean;
      joined?: boolean;
    };
  }

  // ── Ideas (Bazaar) ────────────────────────────────────────────────
  async getIdeas(params?: {
    limit?: number;
    offset?: number;
    category?: string;
    status?: string;
    ordering?: string;
  }) {
    const response = await this.client.get('/ideas/', {
      params: {
        limit: params?.limit ?? 20,
        offset: params?.offset ?? 0,
        category: params?.category,
        status: params?.status,
        ordering: params?.ordering,
      },
    });
    return toFeedPage(response.data);
  }

  async getIdea(id: string | number) {
    const response = await this.client.get(`/ideas/${id}/`);
    return response.data;
  }

  async createIdea(payload: { title: string; description?: string; category?: string }) {
    const response = await this.client.post('/ideas/', {
      title: payload.title,
      description: payload.description || '',
      category: payload.category,
    });
    return response.data;
  }

  async voteIdea(id: string | number, vote: 'up' | 'down' | 'support' = 'support') {
    const response = await this.client.post(`/ideas/${id}/vote/`, { vote });
    return response.data;
  }

  async pledgeIdea(id: string | number, amount: number) {
    const response = await this.client.post(`/ideas/${id}/pledge/`, { amount });
    return response.data;
  }

  // ── Bottles ───────────────────────────────────────────────────────
  async getBottles() {
    const response = await this.client.get('/bottles/recent/');
    return unwrapList(response.data);
  }

  async catchBottle() {
    const response = await this.client.post('/bottles/catch/');
    return response.data;
  }

  async throwBottle(payload: {
    message: string;
    emotion_type?: string;
    location_lat?: number;
    location_lng?: number;
  }) {
    const response = await this.client.post('/bottles/throw/', payload);
    return response.data;
  }

  // ── Communities ───────────────────────────────────────────────────
  async getCommunities(params?: {
    q?: string;
    ordering?: string;
    mine?: boolean;
    limit?: number;
    offset?: number;
  }) {
    const response = await this.client.get('/communities/', {
      params: {
        q: params?.q,
        ordering: params?.ordering,
        mine: params?.mine ? '1' : undefined,
        limit: params?.limit ?? 20,
        offset: params?.offset ?? 0,
      },
    });
    return toFeedPage(response.data);
  }

  async joinCommunity(slug: string) {
    const response = await this.client.post(`/communities/${slug}/join/`, {});
    return response.data;
  }

  async leaveCommunity(slug: string) {
    const response = await this.client.post(`/communities/${slug}/leave/`, {});
    return response.data;
  }

  async getCommunity(slug: string) {
    const response = await this.client.get(`/communities/${slug}/`);
    return response.data;
  }

  async getPendingMembers(slug: string) {
    const response = await this.client.get(`/communities/${slug}/pending-members/`);
    return Array.isArray(response.data) ? response.data : response.data?.results || [];
  }

  async approveCommunityMember(slug: string, userId: string | number) {
    const response = await this.client.post(`/communities/${slug}/approve/`, { user_id: userId });
    return response.data;
  }

  async removeCommunityMember(slug: string, userId: string | number) {
    const response = await this.client.post(`/communities/${slug}/kick/`, { user_id: userId });
    return response.data;
  }

  async rejectCommunityMember(slug: string, userId: string | number) {
    const response = await this.client.post(`/communities/${slug}/reject/`, { user_id: userId });
    return response.data;
  }

  async banCommunityMember(slug: string, userId: string | number) {
    const response = await this.client.post(`/communities/${slug}/ban/`, { user_id: userId });
    return response.data;
  }

  async updateCommunityGates(slug: string, payload: Record<string, unknown>) {
    const response = await this.client.patch(`/communities/${slug}/`, payload);
    return response.data;
  }

  async getCommunityChannels(slug: string) {
    try {
      const response = await this.client.get(`/communities/${slug}/channels/`);
      return Array.isArray(response.data) ? response.data : [];
    } catch {
      return [];
    }
  }

  async createCommunityChannel(
    slug: string,
    payload: { name: string; category?: string; slowmode_seconds?: number; channel_type?: 'text' | 'voice' | 'stage' },
  ) {
    const response = await this.client.post(`/communities/${slug}/channels/`, payload);
    return response.data;
  }

  async updateCommunityChannel(
    slug: string,
    channelId: string | number,
    payload: {
      name?: string;
      category?: string;
      slowmode_seconds?: number;
      channel_type?: 'text' | 'voice' | 'stage';
    },
  ) {
    const response = await this.client.patch(`/communities/${slug}/channels/${channelId}/`, payload);
    return response.data;
  }

  async deleteCommunityChannel(slug: string, channelId: string | number) {
    await this.client.delete(`/communities/${slug}/channels/${channelId}/`);
  }

  async joinCommunityChannel(slug: string, channelId: string | number) {
    const response = await this.client.post(`/communities/${slug}/channels/${channelId}/join/`, {});
    return response.data;
  }

  async getCommunityWiki(slug: string) {
    try {
      const response = await this.client.get(`/communities/${slug}/wiki/`);
      const data = response.data;
      return Array.isArray(data) ? data : data?.results || [];
    } catch {
      return [];
    }
  }

  async crossEchoPost(
    postId: string | number,
    payload: { community_id?: string | number; community?: string; text?: string; flair?: string },
  ) {
    const response = await this.client.post(`/posts/${postId}/cross-echo/`, payload);
    return response.data;
  }

  async getScheduledPosts() {
    const response = await this.client.get('/scheduled-posts/');
    const data = response.data;
    return Array.isArray(data) ? data : data?.results || [];
  }

  async createScheduledPost(
    payload: {
      text: string;
      visibility?: string;
      reply_control?: string;
      location_name?: string;
      location_lat?: number;
      location_lng?: number;
      required_tier?: string | number | null;
    },
    publishAt: string,
  ) {
    const response = await this.client.post('/scheduled-posts/', {
      payload,
      publish_at: publishAt,
    });
    return response.data;
  }

  async addScheduledMedia(
    id: string | number,
    media: Array<{ uri: string; type: 'image' | 'video'; name?: string }>,
  ) {
    if (!media.length) return null;
    const formData = new FormData();
    media.forEach((m, i) => {
      formData.append('media', {
        uri: m.uri,
        type: m.type === 'video' ? 'video/mp4' : 'image/jpeg',
        name: m.name || `media_${i}.${m.type === 'video' ? 'mp4' : 'jpg'}`,
      } as unknown as Blob);
    });
    const response = await this.client.post(`/scheduled-posts/${id}/add_media/`, formData);
    return response.data;
  }

  async cancelScheduledPost(id: string | number) {
    await this.client.delete(`/scheduled-posts/${id}/`);
  }

  async getOnboardingOptions() {
    const response = await this.client.get('/users/onboarding-options/');
    return response.data as { worlds?: string[] };
  }

  // ── Lab (Questions / Challenges) ──────────────────────────────────
  async getDailyQuestion(params?: { period?: 'morning' | 'evening'; lang?: string }) {
    const response = await this.client.get('/questions/daily/', { params });
    return response.data;
  }

  async completeDailyRitual(params?: { period?: 'morning' | 'evening'; lang?: string }) {
    const response = await this.client.post('/questions/daily/', {}, { params });
    return response.data;
  }

  async getDailyChallenge() {
    const response = await this.client.get('/challenges/daily/');
    return response.data;
  }

  async getChallenges(params?: { type?: string; page?: number; page_size?: number }) {
    const response = await this.client.get('/challenges/archive/', { params });
    return response.data;
  }

  // ── Capsules ──────────────────────────────────────────────────────
  async getCapsules() {
    const response = await this.client.get('/capsules/mine/');
    return toFeedPage(response.data);
  }

  async createCapsule(payload: { text: string; open_at: string }) {
    const response = await this.client.post('/capsules/', payload);
    return response.data;
  }

  async openCapsule(id: string | number) {
    const response = await this.client.post(`/capsules/${id}/open/`, {});
    return response.data;
  }

  async getCapsuleStats() {
    const response = await this.client.get('/capsules/stats/');
    return response.data;
  }

  // ── Year stats ────────────────────────────────────────────────────
  async getYearStats(year?: number) {
    const response = await this.client.get('/users/me/year/', {
      params: year ? { year } : undefined,
    });
    return response.data;
  }

  async getCreatorAnalytics() {
    const response = await this.client.get('/analytics/creator/');
    return response.data;
  }

  // ── Shop ──────────────────────────────────────────────────────────
  async getShopItems(params?: { category?: string; type?: string; ordering?: string }) {
    const response = await this.client.get('/shop/items/', { params });
    return toFeedPage(response.data);
  }

  async getShopWallet() {
    const response = await this.client.get('/shop/items/wallet/');
    return response.data;
  }

  async purchaseShopItem(id: string | number, shippingAddress?: string) {
    const response = await this.client.post(`/shop/items/${id}/purchase/`, {
      shipping_address: shippingAddress || '',
    });
    return response.data;
  }

  // ── Live sessions ─────────────────────────────────────────────────
  async getLiveSessions(params?: { status?: string; limit?: number; offset?: number }) {
    const response = await this.client.get('/live/', {
      params: {
        status: params?.status,
        limit: params?.limit ?? 20,
        offset: params?.offset ?? 0,
      },
    });
    return toFeedPage(response.data);
  }

  async getLiveVods(params?: { mine?: boolean; limit?: number }) {
    const response = await this.client.get('/live/vods/', {
      params: { mine: params?.mine ? '1' : undefined, limit: params?.limit ?? 20 },
    });
    return Array.isArray(response.data) ? response.data : response.data?.results || [];
  }

  async getLiveSession(id: string | number) {
    const response = await this.client.get(`/live/${id}/`);
    return response.data;
  }

  async joinLiveSession(id: string | number) {
    const response = await this.client.post(`/live/${id}/join/`, {});
    return response.data;
  }

  async leaveLiveSession(id: string | number) {
    const response = await this.client.post(`/live/${id}/leave/`, {});
    return response.data;
  }

  async getLiveChat(id: string | number) {
    const response = await this.client.get(`/live/${id}/chat/`);
    return unwrapList(response.data);
  }

  async sendLiveMessage(id: string | number, text: string) {
    const response = await this.client.post(`/live/${id}/send_message/`, { text });
    return response.data;
  }

  async reactLive(id: string | number, type = 'heart') {
    const response = await this.client.post(`/live/${id}/react/`, { type });
    return response.data;
  }

  async createLiveSession(payload?: { title?: string; description?: string }) {
    const response = await this.client.post('/live/', {
      title: payload?.title || 'My Live Stream',
      description: payload?.description || '',
      is_public: true,
      chat_enabled: true,
      recording_enabled: true,
    });
    return response.data;
  }

  async startLiveSession(id: string | number) {
    const response = await this.client.post(`/live/${id}/start/`, {});
    return response.data;
  }

  async endLiveSession(id: string | number) {
    const response = await this.client.post(`/live/${id}/end/`, {});
    return response.data;
  }

  // ── Shop — coin packs ─────────────────────────────────────────────
  async getCoinPacks() {
    const response = await this.client.get('/shop/coin-packs/');
    return unwrapList(response.data);
  }

  async createCoinCheckout(packId: string | number): Promise<{ checkout_url: string }> {
    const response = await this.client.post('/shop/coin-checkout/', { pack_id: packId });
    return response.data;
  }

  // ── Creator subscriptions ────────────────────────────────────────
  async getMyCreatorTiers() {
    const response = await this.client.get('/subscriptions/creator-tiers/');
    return Array.isArray(response.data) ? response.data : response.data?.results || [];
  }

  async getCreatorTiers(creatorId: string | number) {
    const response = await this.client.get('/subscriptions/creator-tiers/', {
      params: { creator: creatorId },
    });
    return Array.isArray(response.data) ? response.data : response.data?.results || [];
  }

  async startCreatorCheckout(tierId: string | number): Promise<{ checkout_url: string }> {
    const response = await this.client.post('/subscriptions/creator-subscriptions/checkout/', { tier_id: tierId });
    return response.data;
  }

  async createCreatorTier(payload: {
    name: string;
    description?: string;
    price_usd_cents: number;
    is_active?: boolean;
    sort_order?: number;
  }) {
    const response = await this.client.post('/subscriptions/creator-tiers/', payload);
    return response.data;
  }

  async updateCreatorTier(
    tierId: string | number,
    payload: Partial<{
      name: string;
      description: string;
      price_usd_cents: number;
      is_active: boolean;
      sort_order: number;
    }>,
  ) {
    const response = await this.client.patch(`/subscriptions/creator-tiers/${tierId}/`, payload);
    return response.data;
  }

  async deleteCreatorTier(tierId: string | number) {
    await this.client.delete(`/subscriptions/creator-tiers/${tierId}/`);
  }

  // ── Ads (optional — backend may not mount ads app yet) ────────────
  async getAd(placement: 'feed' | 'stories' | 'reels' | 'explore' | 'profile' = 'feed') {
    try {
      const response = await this.client.get('/ads/delivery/', { params: { placement } });
      const list = unwrapList<Record<string, unknown>>(response.data);
      return list[0] ?? null;
    } catch {
      return null;
    }
  }

  async logAdImpression(data: { ad_id: string; placement: string }) {
    try {
      const response = await this.client.post('/ads/delivery/impression/', data);
      return response.data;
    } catch {
      return null;
    }
  }

  async logAdClick(data: { impression_id: string; landing_url: string }) {
    try {
      const response = await this.client.post('/ads/delivery/click/', data);
      return response.data;
    } catch {
      return null;
    }
  }

  // ── Web worlds parity ─────────────────────────────────────────────
  async getResources() {
    const response = await this.client.get('/resources/');
    return response.data;
  }

  async downloadResource(id: string | number) {
    const response = await this.client.post(`/resources/${id}/download/`, {});
    return response.data;
  }

  async getFailedIdeas(params?: { exhibition?: string }) {
    const response = await this.client.get('/speculative/failed-ideas/', {
      params: params?.exhibition && params.exhibition !== 'all'
        ? { exhibition: params.exhibition }
        : undefined,
    });
    return response.data;
  }

  async createFailedIdea(payload: Record<string, unknown>) {
    const response = await this.client.post('/speculative/failed-ideas/', payload);
    return response.data;
  }

  async getFutureMemories() {
    const response = await this.client.get('/speculative/future-memories/');
    return response.data;
  }

  async createFutureMemory(payload: Record<string, unknown>) {
    const response = await this.client.post('/speculative/future-memories/', payload);
    return response.data;
  }

  async getCharacters() {
    const response = await this.client.get('/speculative/characters/');
    return response.data;
  }

  async summonCharacter(id: string | number) {
    const response = await this.client.post(`/speculative/characters/${id}/summon/`, {});
    return response.data;
  }

  async getMeAnalytics() {
    const response = await this.client.get('/analytics/me/');
    return response.data;
  }

  async getSubscriptionPlans() {
    const response = await this.client.get('/subscriptions/plans/');
    return response.data;
  }

  async startPlanCheckout(planId: string | number) {
    const response = await this.client.post('/subscriptions/checkout/', { plan_id: planId });
    return response.data as { checkout_url?: string; url?: string };
  }

  async getCollabProjects() {
    const response = await this.client.get('/collab/projects/');
    return response.data;
  }

  async toggleCollabTask(projectId: string | number, taskId?: string | number) {
    const path = taskId
      ? `/collab/projects/${projectId}/tasks/${taskId}/toggle/`
      : `/collab/projects/${projectId}/tasks/toggle/`;
    const response = await this.client.post(path, {});
    return response.data;
  }

  async getDrawSessions() {
    const response = await this.client.get('/speculative/draw-sessions/');
    return response.data;
  }

  async createDrawSession(payload: Record<string, unknown>) {
    const response = await this.client.post('/speculative/draw-sessions/', payload);
    return response.data;
  }

  async getForgeStories(params?: { ordering?: string; genre?: string; status?: string }) {
    const response = await this.client.get('/forge/stories/', {
      params: {
        ...(params?.ordering ? { ordering: params.ordering } : {}),
        ...(params?.genre && params.genre !== 'all' ? { genre: params.genre } : {}),
        ...(params?.status && params.status !== 'all' ? { status: params.status } : {}),
      },
    });
    return response.data;
  }

  async createForgeStory(payload: Record<string, unknown>) {
    const response = await this.client.post('/forge/stories/', payload);
    return response.data;
  }

  async getForgeStory(id: string | number) {
    const response = await this.client.get(`/forge/stories/${id}/`);
    return response.data;
  }

  async addForgeSegment(storyId: string | number, payload: Record<string, unknown>) {
    const response = await this.client.post(`/forge/stories/${storyId}/segments/`, payload);
    return response.data;
  }

  async publishForgeStory(storyId: string | number) {
    const response = await this.client.post(`/forge/stories/${storyId}/publish/`, {});
    return response.data;
  }

  async toggleForgeSave(storyId: string | number) {
    const response = await this.client.post(`/forge/stories/${storyId}/toggle_save/`, {});
    return response.data as { saved?: boolean };
  }

  async getAdCampaigns() {
    const response = await this.client.get('/ads/campaigns/');
    return response.data;
  }

  async pauseAdCampaign(id: string | number) {
    const response = await this.client.post(`/ads/campaigns/${id}/pause/`, {});
    return response.data;
  }

  async resumeAdCampaign(id: string | number) {
    const response = await this.client.post(`/ads/campaigns/${id}/resume/`, {});
    return response.data;
  }

  async getPromptRooms() {
    const response = await this.client.get('/chat/prompt-rooms/');
    return response.data;
  }

  async getMySales() {
    const response = await this.client.get('/shop/my-sales/');
    return response.data;
  }

  async getShopTransactions() {
    const response = await this.client.get('/shop/transactions/');
    return response.data;
  }

  async getTwoFactorStatus() {
    const response = await this.client.get('/users/me/2fa/');
    return response.data;
  }

  async enableTwoFactor(password: string) {
    const response = await this.client.post('/users/me/2fa/', { password });
    return response.data;
  }

  // ── AI Coach ──────────────────────────────────────────────────────
  async coachIdea(opts: { title?: string; description?: string; lang?: string }) {
    const response = await this.client.post('/ideas/coach/', {
      title: opts.title || '',
      description: opts.description || '',
      lang: opts.lang || 'en',
    });
    return response.data as {
      title: string;
      milestones: string[];
      constellation_questions: string[];
      source?: string;
      error?: string;
    };
  }

  async remixMeaning(opts: { source_label?: string; source_text?: string; draft_caption?: string; lang?: string }) {
    const response = await this.client.post('/reels/remix-meaning/', {
      source_label: opts.source_label || '',
      source_text: opts.source_text || '',
      draft_caption: opts.draft_caption || '',
      lang: opts.lang || 'en',
    });
    return response.data as {
      hook: string;
      caption: string;
      why_it_matters: string;
      source?: string;
      error?: string;
    };
  }

  async polishTone(text: string, kind: 'bottle' | 'capsule', lang = 'en') {
    const path = kind === 'capsule' ? '/capsules/polish-tone/' : '/bottles/polish-tone/';
    const response = await this.client.post(path, { text, lang });
    return response.data as {
      polished: string;
      note: string;
      source?: string;
      error?: string;
    };
  }

  async liveHostAssist(sessionId: string | number, lang = 'en') {
    const response = await this.client.post(`/live/${sessionId}/host-assist/`, { lang });
    return response.data as { questions: string[]; source?: string; error?: string };
  }

  async liveHostRecap(sessionId: string | number, lang = 'en') {
    const response = await this.client.post(`/live/${sessionId}/host-recap/`, { lang });
    return response.data as { summary: string; source?: string; error?: string };
  }

  async request<T>(method: string, url: string, data?: unknown, config?: object) {
    const response = await this.client.request<T>({ method, url, data, ...config });
    return response.data;
  }
}

export const api = new ApiClient();
export default api;
