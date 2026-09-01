import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '@/api/client';
import { mediaUrl } from '@/api/config';
import { useAuth } from '@/auth/AuthContext';
import { useTheme } from '@/hooks/useTheme';
import { useLocale } from '@/i18n/LocaleProvider';
import { WorldBackdrop, WorldHeader, WorldHero, WorldPrimaryButton } from '@/components/world/WorldChrome';
import {
  asCollabProjects,
  COLLAB_COLUMNS,
  COLLAB_STATUS_KEY,
  formatCollabDeadline,
  useCollabPalette,
  type CollabProject,
} from '@/lib/collab';

function apiError(error: unknown, fallback: string) {
  const data = (error as { response?: { data?: { error?: string } } })?.response?.data;
  return data?.error || fallback;
}

export default function CollabScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { isDark } = useTheme();
  const C = useCollabPalette(isDark);
  const { t } = useLocale();
  const { user } = useAuth();
  const preferredId = Number(route.params?.project || route.params?.projectId || 0);

  const [projects, setProjects] = useState<CollabProject[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(preferredId || null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);
  const [actionError, setActionError] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [creating, setCreating] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteUsername, setInviteUsername] = useState('');
  const [inviting, setInviting] = useState(false);
  const [taskTitle, setTaskTitle] = useState('');
  const [taskBusy, setTaskBusy] = useState(false);

  const selected = useMemo(
    () => projects.find((p) => p.id === selectedId) || projects[0] || null,
    [projects, selectedId],
  );
  const isOwner = Boolean(user?.id && selected && String(selected.owner?.id) === String(user.id));

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    else setLoading(true);
    setError(false);
    try {
      const rows = asCollabProjects(await api.getCollabProjects());
      setProjects(rows);
      setSelectedId((prev) => {
        if (preferredId && rows.some((p) => p.id === preferredId)) return preferredId;
        if (prev && rows.some((p) => p.id === prev)) return prev;
        return rows[0]?.id ?? null;
      });
    } catch {
      setProjects([]);
      setError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [preferredId]);

  useEffect(() => {
    void load();
  }, [load]);

  const createProject = async () => {
    if (!title.trim() || creating) return;
    setCreating(true);
    setActionError('');
    try {
      const created = (await api.createCollabProject({
        title: title.trim(),
        description: description.trim(),
      })) as CollabProject;
      setCreateOpen(false);
      setTitle('');
      setDescription('');
      await load(true);
      if (created?.id) setSelectedId(created.id);
    } catch {
      setActionError(t('collab.createError'));
    } finally {
      setCreating(false);
    }
  };

  const addTask = async () => {
    if (!selected || !taskTitle.trim() || taskBusy) return;
    setTaskBusy(true);
    setActionError('');
    try {
      await api.addCollabTask(selected.id, taskTitle.trim());
      setTaskTitle('');
      await load(true);
    } catch {
      setActionError(t('collab.taskError'));
    } finally {
      setTaskBusy(false);
    }
  };

  const moveTask = async (taskId: number, status: string) => {
    if (!selected) return;
    setActionError('');
    try {
      await api.updateCollabTask(selected.id, taskId, status);
      setProjects((prev) =>
        prev.map((project) =>
          project.id === selected.id
            ? {
                ...project,
                tasks: project.tasks.map((task) => (task.id === taskId ? { ...task, status } : task)),
                tasks_completed: project.tasks.filter((task) =>
                  task.id === taskId ? status === 'done' : task.status === 'done',
                ).length,
              }
            : project,
        ),
      );
    } catch {
      setActionError(t('collab.moveError'));
    }
  };

  const inviteMember = async () => {
    if (!selected || !inviteUsername.trim() || inviting) return;
    setInviting(true);
    setActionError('');
    try {
      await api.inviteCollabMember(selected.id, inviteUsername.trim());
      setInviteOpen(false);
      setInviteUsername('');
      await load(true);
    } catch (err) {
      setActionError(apiError(err, t('collab.inviteError')));
    } finally {
      setInviting(false);
    }
  };

  if (!user) {
    return (
      <WorldBackdrop>
        <SafeAreaView style={{ flex: 1 }} edges={['top']}>
          <WorldHeader title={t('collab.title')} subtitle={t('nav.collab')} onBack={() => navigation.goBack()} />
          <View style={styles.center}>
            <Text style={{ color: C.text2, textAlign: 'center', paddingHorizontal: 28 }}>{t('collab.signInPrompt')}</Text>
          </View>
        </SafeAreaView>
      </WorldBackdrop>
    );
  }

  return (
    <WorldBackdrop>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <WorldHeader
          title={t('collab.title')}
          subtitle={t('nav.collab')}
          onBack={() => navigation.goBack()}
          right={
            <Pressable onPress={() => setCreateOpen(true)} hitSlop={8} accessibilityLabel={t('collab.newProject')}>
              <Ionicons name="add" size={22} color={C.brown} />
            </Pressable>
          }
        />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          {loading && projects.length === 0 ? (
            <View style={styles.center}>
              <ActivityIndicator color={C.brown} />
              <Text style={{ color: C.text2, marginTop: 8 }}>{t('common.loading')}</Text>
            </View>
          ) : (
            <ScrollView
              contentContainerStyle={styles.content}
              keyboardShouldPersistTaps="handled"
              refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={C.brown} />
              }
            >
              <WorldHero
                title={t('collab.title')}
                body={t('collab.subtitle')}
                action={<WorldPrimaryButton label={t('collab.newProject')} onPress={() => setCreateOpen(true)} />}
              />

              {actionError ? (
                <View style={styles.errorBox}>
                  <Text style={styles.errorText}>{actionError}</Text>
                </View>
              ) : null}

              {error ? (
                <Pressable onPress={() => void load()} style={[styles.empty, { backgroundColor: C.card, borderColor: C.line }]}>
                  <Text style={{ color: C.text, fontWeight: '700' }}>{t('collab.retry')}</Text>
                </Pressable>
              ) : projects.length === 0 ? (
                <View style={[styles.empty, { backgroundColor: C.card, borderColor: C.line }]}>
                  <Text style={{ fontSize: 28 }}>🤝</Text>
                  <Text style={[styles.emptyTitle, { color: C.text }]}>{t('collab.empty')}</Text>
                  <WorldPrimaryButton label={t('collab.newProject')} onPress={() => setCreateOpen(true)} />
                </View>
              ) : (
                <>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rail}>
                    {projects.map((project) => {
                      const active = selected?.id === project.id;
                      return (
                        <Pressable
                          key={project.id}
                          onPress={() => setSelectedId(project.id)}
                          style={[
                            styles.railItem,
                            {
                              backgroundColor: active ? C.brown : C.white,
                              borderColor: C.line,
                            },
                          ]}
                        >
                          <Text style={[styles.railTitle, { color: active ? '#fff' : C.text }]} numberOfLines={1}>
                            {project.title}
                          </Text>
                          <Text style={[styles.railMeta, { color: active ? 'rgba(255,255,255,0.8)' : C.text2 }]}>
                            {project.tasks_completed}/{project.tasks_total} {t('collab.tasksDone')}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </ScrollView>

                  {selected ? (
                    <>
                      <View style={styles.stats}>
                        <View style={[styles.stat, { backgroundColor: C.white, borderColor: C.line }]}>
                          <Text style={[styles.statValue, { color: C.brown }]}>
                            {selected.tasks_completed}/{selected.tasks_total}
                          </Text>
                          <Text style={[styles.statLabel, { color: C.text2 }]}>{t('collab.tasksCompleted')}</Text>
                        </View>
                        <View style={[styles.stat, { backgroundColor: C.white, borderColor: C.line }]}>
                          <Text style={[styles.statValue, { color: C.brown }]}>{selected.members?.length || 0}</Text>
                          <Text style={[styles.statLabel, { color: C.text2 }]}>{t('collab.teamMembers')}</Text>
                        </View>
                        <View style={[styles.stat, { backgroundColor: C.white, borderColor: C.line }]}>
                          <Ionicons name="calendar-outline" size={18} color={C.brown} />
                          <Text style={[styles.statLabel, { color: C.text2 }]}>
                            {formatCollabDeadline(selected.deadline) || t('collab.noDeadline')}
                          </Text>
                        </View>
                      </View>

                      <View style={styles.sectionHead}>
                        <Text style={[styles.sectionTitle, { color: C.text }]}>{t('collab.teamMembers')}</Text>
                        {isOwner ? (
                          <Pressable onPress={() => setInviteOpen(true)} style={[styles.ghostBtn, { backgroundColor: C.card2 }]}>
                            <Text style={{ color: C.brownDk, fontWeight: '800', fontSize: 12 }}>+ {t('collab.inviteMember')}</Text>
                          </Pressable>
                        ) : null}
                      </View>
                      <View style={styles.memberWrap}>
                        {(selected.members || []).map((member) => {
                          const avatar = member.user?.avatar ? mediaUrl(member.user.avatar) : '';
                          return (
                            <View key={member.id} style={[styles.member, { backgroundColor: C.white, borderColor: C.line }]}>
                              {avatar ? (
                                <Image source={{ uri: avatar }} style={styles.avatar} />
                              ) : (
                                <View style={[styles.avatar, { backgroundColor: C.brown, alignItems: 'center', justifyContent: 'center' }]}>
                                  <Text style={{ color: '#fff', fontWeight: '800', fontSize: 10 }}>
                                    {(member.user?.username || '?').slice(0, 2).toUpperCase()}
                                  </Text>
                                </View>
                              )}
                              <View style={{ flex: 1 }}>
                                <Text style={[styles.memberName, { color: C.text }]} numberOfLines={1}>
                                  @{member.user?.username}
                                </Text>
                                <Text style={[styles.memberRole, { color: C.text2 }]} numberOfLines={1}>
                                  {member.role || t('collab.contributor')}
                                  {member.current_task ? ` · ${member.current_task}` : ''}
                                </Text>
                              </View>
                            </View>
                          );
                        })}
                      </View>

                      <View style={styles.sectionHead}>
                        <Text style={[styles.sectionTitle, { color: C.text }]}>{t('collab.tasks')}</Text>
                      </View>
                      {isOwner ? (
                        <View style={styles.taskAdd}>
                          <TextInput
                            value={taskTitle}
                            onChangeText={setTaskTitle}
                            placeholder={t('collab.addTask')}
                            placeholderTextColor={C.text2}
                            style={[styles.taskInput, { color: C.text, backgroundColor: C.white, borderColor: C.line }]}
                          />
                          <Pressable
                            onPress={() => void addTask()}
                            disabled={taskBusy || !taskTitle.trim()}
                            style={[styles.addBtn, { backgroundColor: C.brownDk, opacity: taskBusy || !taskTitle.trim() ? 0.5 : 1 }]}
                          >
                            <Text style={{ color: '#fff', fontWeight: '800' }}>+</Text>
                          </Pressable>
                        </View>
                      ) : null}

                      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.board}>
                        {COLLAB_COLUMNS.map((column) => {
                          const tasks = (selected.tasks || []).filter((task) => task.status === column);
                          return (
                            <View key={column} style={[styles.column, { backgroundColor: C.card2 }]}>
                              <Text style={[styles.columnTitle, { color: C.text2 }]}>{t(COLLAB_STATUS_KEY[column])}</Text>
                              {tasks.map((task) => (
                                <View key={task.id} style={[styles.task, { backgroundColor: C.white, borderColor: C.line }]}>
                                  <Text style={[styles.taskTitle, { color: C.text }]}>{task.title}</Text>
                                  {task.assignee?.username ? (
                                    <Text style={[styles.memberRole, { color: C.text2 }]}>@{task.assignee.username}</Text>
                                  ) : null}
                                  <View style={styles.moveRow}>
                                    {COLLAB_COLUMNS.filter((status) => status !== column).map((status) => (
                                      <Pressable
                                        key={status}
                                        onPress={() => void moveTask(task.id, status)}
                                        style={[styles.moveBtn, { backgroundColor: C.card2 }]}
                                      >
                                        <Text style={{ color: C.brownDk, fontSize: 10, fontWeight: '800' }}>
                                          → {t(COLLAB_STATUS_KEY[status])}
                                        </Text>
                                      </Pressable>
                                    ))}
                                  </View>
                                </View>
                              ))}
                            </View>
                          );
                        })}
                      </ScrollView>
                    </>
                  ) : null}
                </>
              )}
            </ScrollView>
          )}
        </KeyboardAvoidingView>
      </SafeAreaView>

      <Modal visible={createOpen} transparent animationType="fade" onRequestClose={() => setCreateOpen(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalRoot}>
          <Pressable style={[styles.overlay, { backgroundColor: C.overlay }]} onPress={() => setCreateOpen(false)} />
          <View style={[styles.sheet, { backgroundColor: C.cream, borderColor: C.line }]}>
            <Text style={[styles.modalTitle, { color: C.text }]}>{t('collab.newProject')}</Text>
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder={t('collab.projectTitle')}
              placeholderTextColor={C.text2}
              style={[styles.input, { color: C.text, backgroundColor: C.white, borderColor: C.line }]}
            />
            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder={t('collab.projectDescription')}
              placeholderTextColor={C.text2}
              multiline
              style={[styles.input, styles.area, { color: C.text, backgroundColor: C.white, borderColor: C.line }]}
            />
            <View style={styles.modalActions}>
              <Pressable onPress={() => setCreateOpen(false)} style={[styles.modalBtn, { backgroundColor: C.card }]}>
                <Text style={{ color: C.text, fontWeight: '700' }}>{t('common.cancel')}</Text>
              </Pressable>
              <Pressable
                onPress={() => void createProject()}
                disabled={creating || !title.trim()}
                style={[styles.modalBtn, { backgroundColor: C.brownDk, opacity: creating || !title.trim() ? 0.55 : 1 }]}
              >
                {creating ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>{t('collab.create')}</Text>}
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={inviteOpen} transparent animationType="fade" onRequestClose={() => setInviteOpen(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalRoot}>
          <Pressable style={[styles.overlay, { backgroundColor: C.overlay }]} onPress={() => setInviteOpen(false)} />
          <View style={[styles.sheet, { backgroundColor: C.cream, borderColor: C.line }]}>
            <Text style={[styles.modalTitle, { color: C.text }]}>{t('collab.inviteMember')}</Text>
            <TextInput
              value={inviteUsername}
              onChangeText={setInviteUsername}
              placeholder={t('collab.inviteUsernamePlaceholder')}
              placeholderTextColor={C.text2}
              autoCapitalize="none"
              style={[styles.input, { color: C.text, backgroundColor: C.white, borderColor: C.line }]}
            />
            <View style={styles.modalActions}>
              <Pressable onPress={() => setInviteOpen(false)} style={[styles.modalBtn, { backgroundColor: C.card }]}>
                <Text style={{ color: C.text, fontWeight: '700' }}>{t('common.cancel')}</Text>
              </Pressable>
              <Pressable
                onPress={() => void inviteMember()}
                disabled={inviting || !inviteUsername.trim()}
                style={[styles.modalBtn, { backgroundColor: C.brownDk, opacity: inviting || !inviteUsername.trim() ? 0.55 : 1 }]}
              >
                {inviting ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.primaryText}>{t('collab.invite')}</Text>
                )}
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </WorldBackdrop>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { paddingHorizontal: 16, paddingBottom: 40, gap: 12 },
  errorBox: { backgroundColor: '#FEE2E2', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 },
  errorText: { color: '#B91C1C', fontSize: 13, fontWeight: '600' },
  empty: { borderRadius: 18, borderWidth: 1, padding: 22, alignItems: 'center', gap: 10 },
  emptyTitle: { fontSize: 15, fontWeight: '700', textAlign: 'center', lineHeight: 22 },
  rail: { gap: 8, paddingRight: 8 },
  railItem: { width: 168, borderRadius: 14, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10 },
  railTitle: { fontSize: 14, fontWeight: '800' },
  railMeta: { fontSize: 11, marginTop: 4 },
  stats: { flexDirection: 'row', gap: 8 },
  stat: { flex: 1, borderRadius: 16, borderWidth: 1, padding: 10, alignItems: 'center', gap: 4 },
  statValue: { fontSize: 18, fontWeight: '800' },
  statLabel: { fontSize: 10, fontWeight: '700', textAlign: 'center' },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { fontSize: 16, fontWeight: '800' },
  ghostBtn: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  memberWrap: { gap: 8 },
  member: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 14, borderWidth: 1, padding: 10 },
  avatar: { width: 32, height: 32, borderRadius: 16 },
  memberName: { fontSize: 13, fontWeight: '800' },
  memberRole: { fontSize: 11 },
  taskAdd: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  taskInput: { flex: 1, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14 },
  addBtn: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  board: { gap: 10, paddingRight: 8 },
  column: { width: 240, borderRadius: 16, padding: 10, gap: 8 },
  columnTitle: { fontSize: 11, fontWeight: '800', letterSpacing: 0.6, textTransform: 'uppercase' },
  task: { borderRadius: 12, borderWidth: 1, padding: 10, gap: 4 },
  taskTitle: { fontSize: 14, fontWeight: '700' },
  moveRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 4 },
  moveBtn: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4 },
  modalRoot: { flex: 1, justifyContent: 'flex-end' },
  overlay: { ...StyleSheet.absoluteFillObject },
  sheet: { borderTopLeftRadius: 22, borderTopRightRadius: 22, borderWidth: 1, padding: 18, gap: 12 },
  modalTitle: { fontSize: 18, fontWeight: '800' },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14 },
  area: { minHeight: 80, textAlignVertical: 'top' },
  modalActions: { flexDirection: 'row', gap: 8, justifyContent: 'flex-end' },
  modalBtn: { borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, minWidth: 96, alignItems: 'center' },
  primaryText: { color: '#fff', fontWeight: '800' },
});
