import { useCallback, useMemo, useState } from 'react';
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
  TextInput,
  Modal,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { AnimatedPageView } from '@/components/ui/animated-page-view';
import { PaginationControls } from '@/components/ui/pagination-controls';
import { Layout, type AppThemeColors } from '@/constants/theme';
import { useAppTheme } from '@/hooks/use-app-theme';
import { usePagination } from '@/hooks/use-pagination';
import { supabase } from '@/lib/supabase';
import { calculateCompatibilityScore } from '@/lib/matching';
import { ensureMatchForChat, pickMatchedSkillWanted } from '@/lib/chat-match';

type OfferedSkillWithId = {
  skill_id: string;
  level: string | null;
  skills: { name: string };
};

type Review = {
  id: string;
  rating: number;
  review_text: string | null;
  created_at: string;
};

type UserCard = {
  id: string;
  full_name: string | null;
  bio: string | null;
  location: string | null;
  preferred_language: string | null;
  avatar_url: string | null;
  offeredSkills: OfferedSkillWithId[];
  compatibilityScore: number;
  averageRating: number | null;
  ratingCount: number;
  reviews: Review[];
};

const SKILL_LEVELS = ['beginner', 'intermediate', 'advanced'] as const;
type SkillLevelFilter = (typeof SKILL_LEVELS)[number] | null;

type DiscoverFilters = {
  skillLevel: SkillLevelFilter;
  location: string;
  preferredLanguage: string;
};

const EMPTY_FILTERS: DiscoverFilters = {
  skillLevel: null,
  location: '',
  preferredLanguage: '',
};

function filterDiscoverUsers(users: UserCard[], searchQuery: string, filters: DiscoverFilters) {
  const q = searchQuery.trim().toLowerCase();
  const locationQ = filters.location.trim().toLowerCase();
  const languageQ = filters.preferredLanguage.trim().toLowerCase();

  return users.filter((user) => {
    if (q) {
      const matchesSkill = user.offeredSkills.some((s) =>
        s.skills.name.toLowerCase().includes(q)
      );
      if (!matchesSkill) return false;
    }

    if (filters.skillLevel) {
      const hasLevel = user.offeredSkills.some(
        (s) => s.level?.toLowerCase() === filters.skillLevel
      );
      if (!hasLevel) return false;
    }

    if (locationQ) {
      const loc = user.location?.toLowerCase() ?? '';
      if (!loc.includes(locationQ)) return false;
    }

    if (languageQ) {
      const lang = user.preferred_language?.toLowerCase() ?? '';
      if (!lang.includes(languageQ)) return false;
    }

    return true;
  });
}

export default function DiscoverScreen() {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [users, setUsers] = useState<UserCard[]>([]);
  const [myWantedSkillIds, setMyWantedSkillIds] = useState<string[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [expandedReviews, setExpandedReviews] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [appliedFilters, setAppliedFilters] = useState<DiscoverFilters>(EMPTY_FILTERS);
  const [filtersModalVisible, setFiltersModalVisible] = useState(false);
  const [draftFilters, setDraftFilters] = useState<DiscoverFilters>(EMPTY_FILTERS);

  const filteredUsers = useMemo(
    () => filterDiscoverUsers(users, searchQuery, appliedFilters),
    [users, searchQuery, appliedFilters]
  );

  const filterResetKey = useMemo(
    () =>
      JSON.stringify({
        searchQuery,
        ...appliedFilters,
      }),
    [searchQuery, appliedFilters]
  );

  const { page, totalPages, pageItems, direction, goNext, goPrev } = usePagination(
    filteredUsers,
    undefined,
    filterResetKey
  );

  const hasModalFiltersActive =
    appliedFilters.skillLevel !== null ||
    appliedFilters.location.trim() !== '' ||
    appliedFilters.preferredLanguage.trim() !== '';

  const hasAnyFilterActive = searchQuery.trim() !== '' || hasModalFiltersActive;

  function openFiltersModal() {
    setDraftFilters(appliedFilters);
    setFiltersModalVisible(true);
  }

  function applyDraftFilters() {
    setAppliedFilters(draftFilters);
    setFiltersModalVisible(false);
  }

  function clearAllFilters() {
    setSearchQuery('');
    setAppliedFilters(EMPTY_FILTERS);
    setDraftFilters(EMPTY_FILTERS);
  }

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

    setCurrentUserId(currentUserId);

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

    const { data: allRatings, error: ratingsError } = await supabase
      .from('ratings')
      .select('id, rated_user_id, rating, review_text, created_at')
      .order('created_at', { ascending: false });

    if (ratingsError) {
      Alert.alert('Error loading ratings', ratingsError.message);
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
      ) as unknown as OfferedSkillWithId[];

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

      const theirRatings = (allRatings ?? []).filter(
        (r) => r.rated_user_id === profile.id
      );

      const averageRating =
        theirRatings.length > 0
          ? theirRatings.reduce((sum, r) => sum + r.rating, 0) / theirRatings.length
          : null;

      return {
        ...profile,
        offeredSkills: theirOfferedSkills,
        compatibilityScore: score,
        averageRating,
        ratingCount: theirRatings.length,
        reviews: theirRatings as Review[],
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

  function toggleReviews(userId: string) {
    setExpandedReviews((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) {
        next.delete(userId);
      } else {
        next.add(userId);
      }
      return next;
    });
  }

  function getScoreColor(score: number) {
    if (score >= 70) return theme.success;
    if (score >= 40) return theme.warning;
    return theme.textMuted;
  }

  async function handleStartChat(item: UserCard) {
    if (!currentUserId) return;
    try {
      const skillId = pickMatchedSkillWanted(item.offeredSkills, myWantedSkillIds);
      const matchId = await ensureMatchForChat({
        currentUserId,
        otherUserId: item.id,
        compatibilityScore: item.compatibilityScore,
        matchedSkillWanted: skillId,
      });
      router.push({
        pathname: '/chat',
        params: { matchId, otherName: item.full_name || 'Skill partner' },
      });
    } catch (error) {
      Alert.alert(
        'Could not open chat',
        error instanceof Error ? error.message : 'Unknown error'
      );
    }
  }

  function renderUser({ item }: { item: UserCard }) {
    const isExpanded = expandedReviews.has(item.id);

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
            {item.averageRating !== null ? (
              <View style={styles.ratingRow}>
                <Ionicons name="star" size={14} color={theme.star} />
                <Text style={styles.ratingText}>
                  {item.averageRating.toFixed(1)} ({item.ratingCount})
                </Text>
              </View>
            ) : (
              <Text style={styles.noRatingText}>No ratings yet</Text>
            )}
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

        <Pressable
          style={styles.chatButton}
          onPress={() => void handleStartChat(item)}
        >
          <Ionicons name="chatbubble-ellipses-outline" size={16} color={theme.primary} />
          <Text style={styles.chatButtonText}>Chat</Text>
        </Pressable>

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
                {`Request "${s.skills.name}" Session`}
              </Text>
            </Pressable>
          ))}

        {item.reviews.length > 0 && (
          <>
            <Pressable
              style={styles.reviewsToggle}
              onPress={() => toggleReviews(item.id)}
            >
              <Text style={styles.reviewsToggleText}>
                {isExpanded ? 'Hide Reviews' : `See Reviews (${item.reviews.length})`}
              </Text>
              <Ionicons
                name={isExpanded ? 'chevron-up' : 'chevron-down'}
                size={16}
                color={theme.primary}
              />
            </Pressable>

            {isExpanded && (
              <View style={styles.reviewsList}>
                {item.reviews.map((review) => (
                  <View key={review.id} style={styles.reviewItem}>
                    <View style={styles.reviewStars}>
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Ionicons
                          key={star}
                          name={star <= review.rating ? 'star' : 'star-outline'}
                          size={14}
                          color={theme.star}
                        />
                      ))}
                    </View>
                    {review.review_text ? (
                      <Text style={styles.reviewText}>{review.review_text}</Text>
                    ) : (
                      <Text style={styles.noReviewText}>No written review</Text>
                    )}
                    <Text style={styles.reviewDate}>
                      {new Date(review.created_at).toLocaleDateString()}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </>
        )}
      </View>
    );
  }

  if (loading && !refreshing) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Discover</Text>
      <Text style={styles.subtitle}>Find skill partners matched to your goals</Text>

      <View style={styles.searchRow}>
        <View style={styles.searchInputWrap}>
          <Ionicons name="search" size={18} color={theme.textMuted} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search by skill offered..."
            placeholderTextColor={theme.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
            clearButtonMode="while-editing"
          />
        </View>
        <Pressable
          style={[styles.filtersButton, hasModalFiltersActive && styles.filtersButtonActive]}
          onPress={openFiltersModal}
        >
          <Ionicons
            name="options-outline"
            size={20}
            color={hasModalFiltersActive ? theme.primaryForeground : theme.primary}
          />
          <Text
            style={[
              styles.filtersButtonText,
              hasModalFiltersActive && styles.filtersButtonTextActive,
            ]}
          >
            Filters
          </Text>
          {hasModalFiltersActive ? <View style={styles.filtersBadge} /> : null}
        </Pressable>
      </View>

      {hasAnyFilterActive ? (
        <Pressable style={styles.clearFiltersRow} onPress={clearAllFilters}>
          <Ionicons name="close-circle" size={16} color={theme.primary} />
          <Text style={styles.clearFiltersText}>Clear filters</Text>
        </Pressable>
      ) : null}

      <AnimatedPageView pageKey={page} direction={direction}>
        <FlatList
          data={pageItems}
          keyExtractor={(item) => item.id}
          renderItem={renderUser}
          scrollEnabled={pageItems.length > 0}
          contentContainerStyle={styles.listContent}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={theme.primary}
            />
          }
          ListEmptyComponent={
            <Text style={styles.emptyText}>
              {users.length === 0
                ? 'No other users yet. Check back once more people join!'
                : 'No users match your search or filters. Try adjusting them.'}
            </Text>
          }
          ListFooterComponent={
            filteredUsers.length > 0 ? (
              <PaginationControls
                page={page}
                totalPages={totalPages}
                onPrevious={goPrev}
                onNext={goNext}
                itemLabel="Page"
              />
            ) : null
          }
        />
      </AnimatedPageView>

      <Modal
        visible={filtersModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setFiltersModalVisible(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setFiltersModalVisible(false)}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.modalKeyboard}
          >
            <Pressable style={styles.modalSheet} onPress={(e) => e.stopPropagation()}>
              <View style={styles.modalHandle} />
              <Text style={styles.modalTitle}>Filters</Text>

              <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                <Text style={styles.filterLabel}>Skill level offered</Text>
                <View style={styles.filterChipsRow}>
                  {SKILL_LEVELS.map((level) => {
                    const selected = draftFilters.skillLevel === level;
                    return (
                      <Pressable
                        key={level}
                        style={[styles.filterChip, selected && styles.filterChipSelected]}
                        onPress={() =>
                          setDraftFilters((prev) => ({
                            ...prev,
                            skillLevel: selected ? null : level,
                          }))
                        }
                      >
                        <Text
                          style={[
                            styles.filterChipText,
                            selected && styles.filterChipTextSelected,
                          ]}
                        >
                          {level}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                <Text style={styles.filterLabel}>Location</Text>
                <TextInput
                  style={styles.filterInput}
                  value={draftFilters.location}
                  onChangeText={(location) =>
                    setDraftFilters((prev) => ({ ...prev, location }))
                  }
                  placeholder="e.g. Lahore"
                  placeholderTextColor={theme.textMuted}
                  autoCapitalize="words"
                />

                <Text style={styles.filterLabel}>Preferred language</Text>
                <TextInput
                  style={styles.filterInput}
                  value={draftFilters.preferredLanguage}
                  onChangeText={(preferredLanguage) =>
                    setDraftFilters((prev) => ({ ...prev, preferredLanguage }))
                  }
                  placeholder="e.g. English"
                  placeholderTextColor={theme.textMuted}
                  autoCapitalize="words"
                />
              </ScrollView>

              <View style={styles.modalActions}>
                <Pressable
                  style={styles.modalSecondaryButton}
                  onPress={() => {
                    setDraftFilters(EMPTY_FILTERS);
                  }}
                >
                  <Text style={styles.modalSecondaryText}>Reset</Text>
                </Pressable>
                <Pressable style={styles.modalPrimaryButton} onPress={applyDraftFilters}>
                  <Text style={styles.modalPrimaryText}>Apply filters</Text>
                </Pressable>
              </View>
            </Pressable>
          </KeyboardAvoidingView>
        </Pressable>
      </Modal>
    </View>
  );
}

function createStyles(theme: AppThemeColors) {
  return StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 60,
    paddingHorizontal: Layout.screenPadding,
    backgroundColor: theme.background,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    marginBottom: 4,
    color: theme.text,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14,
    color: theme.textSecondary,
    marginBottom: 12,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  searchInputWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: Layout.radiusSm,
    backgroundColor: theme.surface,
    paddingHorizontal: 10,
  },
  searchIcon: {
    marginRight: 6,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 10,
    fontSize: 15,
    color: theme.text,
  },
  filtersButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: theme.primary,
    borderRadius: Layout.radiusSm,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: theme.surface,
  },
  filtersButtonActive: {
    backgroundColor: theme.primary,
    borderColor: theme.primary,
  },
  filtersButtonText: {
    color: theme.primary,
    fontSize: 14,
    fontWeight: '600',
  },
  filtersButtonTextActive: {
    color: theme.primaryForeground,
  },
  filtersBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.warning,
  },
  clearFiltersRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    marginBottom: 12,
    paddingVertical: 4,
  },
  clearFiltersText: {
    color: theme.primary,
    fontSize: 13,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
  },
  modalKeyboard: {
    width: '100%',
  },
  modalSheet: {
    backgroundColor: theme.surface,
    borderTopLeftRadius: Layout.radiusLg,
    borderTopRightRadius: Layout.radiusLg,
    paddingHorizontal: Layout.screenPadding,
    paddingBottom: Platform.OS === 'ios' ? 28 : 20,
    paddingTop: 12,
    maxHeight: '85%',
  },
  modalHandle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: theme.border,
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.text,
    marginBottom: 16,
  },
  filterLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.text,
    marginBottom: 8,
    marginTop: 8,
  },
  filterChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  filterChip: {
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: Layout.radiusFull,
    paddingVertical: 8,
    paddingHorizontal: 14,
    backgroundColor: theme.inputBackground,
  },
  filterChipSelected: {
    backgroundColor: theme.primary,
    borderColor: theme.primary,
  },
  filterChipText: {
    color: theme.text,
    textTransform: 'capitalize',
    fontSize: 14,
  },
  filterChipTextSelected: {
    color: theme.primaryForeground,
    fontWeight: '600',
  },
  filterInput: {
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: Layout.radiusSm,
    padding: 12,
    fontSize: 15,
    color: theme.text,
    backgroundColor: theme.inputBackground,
    marginBottom: 8,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  modalSecondaryButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: Layout.radiusSm,
    paddingVertical: 14,
    alignItems: 'center',
  },
  modalSecondaryText: {
    color: theme.textSecondary,
    fontWeight: '600',
    fontSize: 15,
  },
  modalPrimaryButton: {
    flex: 1,
    backgroundColor: theme.primary,
    borderRadius: Layout.radiusSm,
    paddingVertical: 14,
    alignItems: 'center',
  },
  modalPrimaryText: {
    color: theme.primaryForeground,
    fontWeight: '700',
    fontSize: 15,
  },
  listContent: {
    paddingBottom: 24,
  },
  card: {
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: Layout.radiusMd,
    padding: 16,
    marginBottom: 16,
    backgroundColor: theme.surface,
    shadowColor: theme.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
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
    backgroundColor: theme.surfaceMuted,
  },
  avatarPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarPlaceholderText: {
    fontSize: 22,
    fontWeight: 'bold',
    color: theme.textMuted,
  },
  headerText: {
    marginLeft: 12,
    flex: 1,
  },
  name: {
    fontSize: 17,
    fontWeight: '700',
    color: theme.text,
  },
  location: {
    fontSize: 13,
    color: theme.textSecondary,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 4,
  },
  ratingText: {
    fontSize: 13,
    color: theme.textSecondary,
    fontWeight: '600',
  },
  noRatingText: {
    fontSize: 12,
    color: theme.textMuted,
    fontStyle: 'italic',
    marginTop: 4,
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
    color: theme.textSecondary,
    marginBottom: 12,
  },
  skillsLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.text,
    marginBottom: 6,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    backgroundColor: theme.primaryMuted,
    borderRadius: Layout.radiusLg,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  chipText: {
    color: theme.primary,
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  noSkillsText: {
    color: theme.textMuted,
    fontSize: 13,
    fontStyle: 'italic',
  },
  chatButton: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: theme.primary,
    borderRadius: Layout.radiusSm,
    paddingVertical: 10,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  chatButtonText: {
    color: theme.primary,
    fontSize: 13,
    fontWeight: '600',
  },
  requestButton: {
    backgroundColor: theme.primary,
    borderRadius: Layout.radiusSm,
    padding: 10,
    alignItems: 'center',
    marginTop: 8,
  },
  requestButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  reviewsToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    marginTop: 12,
    paddingVertical: 8,
  },
  reviewsToggleText: {
    color: theme.primary,
    fontSize: 13,
    fontWeight: '600',
  },
  reviewsList: {
    marginTop: 8,
    gap: 10,
  },
  reviewItem: {
    borderTopWidth: 1,
    borderTopColor: theme.border,
    paddingTop: 10,
  },
  reviewStars: {
    flexDirection: 'row',
    gap: 2,
    marginBottom: 4,
  },
  reviewText: {
    fontSize: 13,
    color: theme.text,
    marginBottom: 4,
  },
  noReviewText: {
    fontSize: 13,
    color: theme.textMuted,
    fontStyle: 'italic',
    marginBottom: 4,
  },
  reviewDate: {
    fontSize: 11,
    color: theme.textMuted,
  },
  emptyText: {
    textAlign: 'center',
    color: theme.textMuted,
    marginTop: 40,
    fontSize: 15,
  },
  });
}