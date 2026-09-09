import { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Pressable,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { supabase } from '@/lib/supabase';

type SessionItem = {
  id: string;
  scheduled_at: string;
  duration_minutes: number;
  session_type: 'online' | 'in_person';
  status: 'pending' | 'scheduled' | 'completed' | 'cancelled' | 'declined';
  teacher_id: string;
  learner_id: string;
  skills: { name: string };
  teacher: { full_name: string | null };
  learner: { full_name: string | null };
};

export default function SessionsScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      loadSessions();
    }, [])
  );

  async function loadSessions() {
    setLoading(true);

    const { data: { session } } = await supabase.auth.getSession();
    const userId = session?.user?.id;

    if (!userId) {
      setLoading(false);
      return;
    }

    setCurrentUserId(userId);

    const { data, error } = await supabase
      .from('sessions')
      .select(
        `id, scheduled_at, duration_minutes, session_type, status, teacher_id, learner_id,
         skills(name),
         teacher:profiles!sessions_teacher_id_fkey(full_name),
         learner:profiles!sessions_learner_id_fkey(full_name)`
      )
      .or(`teacher_id.eq.${userId},learner_id.eq.${userId}`)
      .order('scheduled_at', { ascending: true });

    if (error) {
      Alert.alert('Error loading sessions', error.message);
      setLoading(false);
      return;
    }

    setSessions((data as any) ?? []);
    setLoading(false);
    setRefreshing(false);
  }

  function onRefresh() {
    setRefreshing(true);
    loadSessions();
  }

   function getStatusColor(status: string) {
    if (status === 'pending') return '#FF9500';
    if (status === 'scheduled') return '#007AFF';
    if (status === 'completed') return '#34C759';
    return '#8E8E93';
  }

  async function handleRespond(sessionId: string, newStatus: 'scheduled' | 'declined') {
    const { error } = await supabase
      .from('sessions')
      .update({ status: newStatus })
      .eq('id', sessionId);

    if (error) {
      Alert.alert('Error', error.message);
      return;
    }

    loadSessions();
  }
    async function handleMarkCompleted(sessionId: string) {
    const { error } = await supabase
      .from('sessions')
      .update({ status: 'completed' })
      .eq('id', sessionId);

    if (error) {
      Alert.alert('Error', error.message);
      return;
    }

    router.push(`/rate-session?sessionId=${sessionId}`);
  }
  function renderSession({ item }: { item: SessionItem }) {
    const isTeaching = item.teacher_id === currentUserId;
    const otherPersonName = isTeaching
      ? item.learner.full_name || 'Someone'
      : item.teacher.full_name || 'Someone';

    const dateObj = new Date(item.scheduled_at);

        return (
      <View style={styles.card}>
        <View style={styles.cardTop}>
          <Text style={styles.skillName}>{item.skills.name}</Text>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
            <Text style={styles.statusText}>{item.status}</Text>
          </View>
        </View>

        <Text style={styles.roleText}>
          {isTeaching ? `You're teaching ${otherPersonName}` : `${otherPersonName} is teaching you`}
        </Text>

        <Text style={styles.detailText}>
          {dateObj.toLocaleDateString()} at{' '}
          {dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </Text>
        <Text style={styles.detailText}>
          {item.duration_minutes} min · {item.session_type === 'online' ? 'Online' : 'In Person'}
        </Text>

        {item.status === 'pending' && isTeaching && (
          <View style={styles.actionRow}>
            <Pressable
              style={styles.declineButton}
              onPress={() => handleRespond(item.id, 'declined')}
            >
              <Text style={styles.declineButtonText}>Decline</Text>
            </Pressable>
            <Pressable
              style={styles.acceptButton}
              onPress={() => handleRespond(item.id, 'scheduled')}
            >
              <Text style={styles.acceptButtonText}>Accept</Text>
            </Pressable>
          </View>
        )}

                {item.status === 'pending' && !isTeaching && (
          <Text style={styles.waitingText}>Waiting for {otherPersonName} to respond...</Text>
        )}

        {item.status === 'scheduled' && (
          <Pressable
            style={styles.completeButton}
            onPress={() => handleMarkCompleted(item.id)}
          >
            <Text style={styles.completeButtonText}>Mark as Completed</Text>
          </Pressable>
        )}
      </View>
    );
  }

  if (loading && !refreshing) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>My Sessions</Text>
      <FlatList
        data={sessions}
        keyExtractor={(item) => item.id}
        renderItem={renderSession}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={
          <Text style={styles.emptyText}>
            No sessions yet. Go to Discover to request one!
          </Text>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 60,
    paddingHorizontal: 20,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  listContent: {
    paddingBottom: 24,
  },
  card: {
    borderWidth: 1,
    borderColor: '#eee',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    backgroundColor: '#fafafa',
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  skillName: {
    fontSize: 17,
    fontWeight: '700',
    color: '#000',
  },
  statusBadge: {
    borderRadius: 12,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  statusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  roleText: {
    fontSize: 14,
    color: '#444',
    marginBottom: 8,
  },
  detailText: {
    fontSize: 13,
    color: '#666',
  },
   emptyText: {
    textAlign: 'center',
    color: '#888',
    marginTop: 40,
    fontSize: 15,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
  },
  declineButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#FF3B30',
    borderRadius: 8,
    padding: 10,
    alignItems: 'center',
  },
  declineButtonText: {
    color: '#FF3B30',
    fontWeight: '600',
  },
  acceptButton: {
    flex: 1,
    backgroundColor: '#34C759',
    borderRadius: 8,
    padding: 10,
    alignItems: 'center',
  },
  acceptButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
    waitingText: {
    marginTop: 8,
    fontSize: 13,
    color: '#999',
    fontStyle: 'italic',
  },
  completeButton: {
    backgroundColor: '#5856D6',
    borderRadius: 8,
    padding: 10,
    alignItems: 'center',
    marginTop: 12,
  },
  completeButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
});