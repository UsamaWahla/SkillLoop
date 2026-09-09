import { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Image,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Pressable,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { calculateCompatibilityScore } from '@/lib/matching';


type OfferedSkillWithId = {
  skill_id: string;
  level: string | null;
  skills: { name: string };
};

type UserCard = {
  id: string;
  full_name: string | null;
  bio: string | null;
  location: string | null;
  avatar_url: string | null;
  offeredSkills: OfferedSkillWithId[];
  compatibilityScore: number;
};

export default function DiscoverScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [users, setUsers] = useState<UserCard[]>([]);
  const [myWantedSkillIds, setMyWantedSkillIds] = useState<string[]>([]);

  useFocusEffect(
    useCallback(() => {
      loadUsers();
    }, [])
  );

  async function loadUsers() {
    setLoading(true);

    const { data: { session } } = await supabase.auth.getSession();
    const currentUserId = session?.user?.id;

    if (!currentUserId) {
      setLoading(false);
      return;
    }

    const { data: myProfile, error: myProfileError } = await supabase
      .from('profiles')
      .select('location, preferred_language')
      .eq('id', currentUserId)
      .single();

    if (myProfileError) {
      Alert.alert('Error loading your profile', myProfileError.message);
      setLoading(false);
      return;
    }

    const { data: myUserSkills, error: myUserSkillsError } = await supabase
      .from('user_skills')
      .select('skill_id, type, level')
      .eq('user_id', currentUserId);

    if (myUserSkillsError) {
      Alert.alert('Error loading your skills', myUserSkillsError.message);
      setLoading(false);
      return;
    }

    const { data: profilesData, error: profilesError } = await supabase
      .from('profiles')
      .select('id, full_name, bio, location, avatar_url, preferred_language')
      .neq('id', currentUserId);

    if (profilesError) {
      Alert.alert('Error loading users', profilesError.message);
      setLoading(false);
      return;
    }

    const { data: allUserSkills, error: allUserSkillsError } = await supabase
      .from('user_skills')
      .select('user_id, skill_id, type, level, skills(name)');

    if (allUserSkillsError) {
      Alert.alert('Error loading skills', allUserSkillsError.message);
      setLoading(false);
      return;
    }

        const wantedIds = (myUserSkills ?? [])
      .filter((s) => s.type === 'wanted')
      .map((s) => s.skill_id);
    setMyWantedSkillIds(wantedIds);

    const usersWithScores: UserCard[] = (profilesData ?? []).map((profile) => {
      const theirSkills = (allUserSkills ?? []).filter(
        (s: any) => s.user_id === profile.id
      );

      const theirOfferedSkills = theirSkills.filter(
        (s: any) => s.type === 'offered'
      ) as OfferedSkillWithId[];

      const score = calculateCompatibilityScore(
        {
          location: myProfile.location,
          preferred_language: myProfile.preferred_language,
        },
        myUserSkills ?? [],
        {
          location: profile.location,
          preferred_language: profile.preferred_language,
        },
        theirSkills as any
      );

      return {
        ...profile,
        offeredSkills: theirOfferedSkills,
        compatibilityScore: score,
      };
    });

    usersWithScores.sort((a, b) => b.compatibilityScore - a.compatibilityScore);

    setUsers(usersWithScores);
    setLoading(false);
    setRefreshing(false);
  }

  function onRefresh() {
    setRefreshing(true);
    loadUsers();
  }

  function getScoreColor(score: number) {
    if (score >= 70) return '#34C759';
    if (score >= 40) return '#FF9500';
    return '#8E8E93';
  }

  function renderUser({ item }: { item: UserCard }) {
    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          {item.avatar_url ? (
            <Image source={{ uri: item.avatar_url }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarPlaceholder]}>
              <Text style={styles.avatarPlaceholderText}>
                {item.full_name ? item.full_name.charAt(0).toUpperCase() : '?'}
              </Text>
            </View>
          )}
          <View style={styles.headerText}>
            <Text style={styles.name}>{item.full_name || 'Unnamed User'}</Text>
            {item.location ? (
              <Text style={styles.location}>{item.location}</Text>
            ) : null}
          </View>
          {item.compatibilityScore > 0 && (
            <View
              style={[
                styles.scoreBadge,
                { backgroundColor: getScoreColor(item.compatibilityScore) },
              ]}
            >
              <Text style={styles.scoreText}>{item.compatibilityScore}%</Text>
            </View>
          )}
        </View>

        {item.bio ? <Text style={styles.bio}>{item.bio}</Text> : null}

                <Text style={styles.skillsLabel}>Offers:</Text>
        <View style={styles.chipsRow}>
          {item.offeredSkills.length === 0 ? (
            <Text style={styles.noSkillsText}>No skills listed yet</Text>
          ) : (
            item.offeredSkills.map((s, idx) => (
              <View key={idx} style={styles.chip}>
                <Text style={styles.chipText}>
                  {s.skills.name} · {s.level}
                </Text>
              </View>
            ))
          )}
        </View>

        {item.offeredSkills
          .filter((s) => myWantedSkillIds.includes(s.skill_id))
          .map((s, idx) => (
            <Pressable
              key={idx}
              style={styles.requestButton}
              onPress={() =>
                router.push({
                  pathname: '/request-session',
                  params: {
                    teacherId: item.id,
                    teacherName: item.full_name || 'this user',
                    skillId: s.skill_id,
                    skillName: s.skills.name,
                  },
                })
              }
            >
              <Text style={styles.requestButtonText}>
                Request "{s.skills.name}" Session
              </Text>
            </Pressable>
          ))}
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
      <Text style={styles.title}>Discover</Text>
      <FlatList
        data={users}
        keyExtractor={(item) => item.id}
        renderItem={renderUser}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <Text style={styles.emptyText}>
            No other users yet. Check back once more people join!
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
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#eee',
  },
  avatarPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarPlaceholderText: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#999',
  },
  headerText: {
    marginLeft: 12,
    flex: 1,
  },
  name: {
    fontSize: 17,
    fontWeight: '700',
    color: '#000',
  },
  location: {
    fontSize: 13,
    color: '#666',
  },
  scoreBadge: {
    borderRadius: 16,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  scoreText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  bio: {
    fontSize: 14,
    color: '#444',
    marginBottom: 12,
  },
  skillsLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333',
    marginBottom: 6,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    backgroundColor: '#007AFF20',
    borderRadius: 16,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  chipText: {
    color: '#007AFF',
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  noSkillsText: {
    color: '#999',
    fontSize: 13,
    fontStyle: 'italic',
  },
    requestButton: {
    backgroundColor: '#007AFF',
    borderRadius: 8,
    padding: 10,
    alignItems: 'center',
    marginTop: 8,
  },
  requestButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  emptyText: {
    textAlign: 'center',
    color: '#888',
    marginTop: 40,
    fontSize: 15,
  },
});