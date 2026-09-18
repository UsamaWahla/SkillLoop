import { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Layout, type AppThemeColors } from '@/constants/theme';
import { useAppTheme } from '@/hooks/use-app-theme';
import { supabase } from '@/lib/supabase';

type Skill = { id: string; name: string; category: string | null };
type UserSkill = {
  id: string;
  skill_id: string;
  type: 'offered' | 'wanted';
  level: string | null;
  skills: Skill;
};

const LEVELS = ['beginner', 'intermediate', 'advanced'];

export default function SkillsScreen() {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [allSkills, setAllSkills] = useState<Skill[]>([]);
  const [userSkills, setUserSkills] = useState<UserSkill[]>([]);

  const [addingType, setAddingType] = useState<'offered' | 'wanted' | null>(null);
  const [selectedSkillId, setSelectedSkillId] = useState<string | null>(null);
  const [selectedLevel, setSelectedLevel] = useState<string>('beginner');
  const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
    let isMounted = true;
    if (isMounted) {
      loadData();
    }
    return () => {
      isMounted = false;
    };
  }, []);

    async function loadData() {
    console.log('1. Starting loadData');
    setLoading(true);

       const { data: { session } } = await supabase.auth.getSession();
    console.log('2. Got session:', session?.user?.id);

    const user = session?.user;

    if (!user) {
      setLoading(false);
      return;
    }
    setUserId(user.id);

    const { data: skillsData, error: skillsError } = await supabase
      .from('skills')
      .select('*')
      .order('name');

    console.log('3. Got skills:', skillsData?.length, 'error:', skillsError);

    if (skillsError) {
      Alert.alert('Error loading skills', skillsError.message);
    } else {
      setAllSkills(skillsData ?? []);
    }

    const { data: userSkillsData, error: userSkillsError } = await supabase
      .from('user_skills')
      .select('id, skill_id, type, level, skills(id, name, category)')
      .eq('user_id', user.id);

    console.log('4. Got user skills:', userSkillsData, 'error:', userSkillsError);

    if (userSkillsError) {
      Alert.alert('Error loading your skills', userSkillsError.message);
    } else {
      setUserSkills((userSkillsData as any) ?? []);
    }

    console.log('5. Done loading');
    setLoading(false);
  }

  function startAdding(type: 'offered' | 'wanted') {
    setAddingType(type);
    setSelectedSkillId(null);
    setSelectedLevel('beginner');
  }

  function cancelAdding() {
    setAddingType(null);
    setSelectedSkillId(null);
  }

  async function handleAddSkill() {
    if (!userId || !addingType || !selectedSkillId) {
      Alert.alert('Missing info', 'Please select a skill.');
      return;
    }

    setSubmitting(true);

    const { error } = await supabase.from('user_skills').insert({
      user_id: userId,
      skill_id: selectedSkillId,
      type: addingType,
      level: addingType === 'offered' ? selectedLevel : null,
    });

    setSubmitting(false);

    if (error) {
      if (error.code === '23505') {
        Alert.alert('Already added', 'You already added this skill in this category.');
      } else {
        Alert.alert('Error', error.message);
      }
      return;
    }

    cancelAdding();
    loadData();
  }

  async function handleRemoveSkill(userSkillId: string) {
    const { error } = await supabase.from('user_skills').delete().eq('id', userSkillId);

    if (error) {
      Alert.alert('Error removing skill', error.message);
      return;
    }

    loadData();
  }

  const offeredSkills = userSkills.filter((s) => s.type === 'offered');
  const wantedSkills = userSkills.filter((s) => s.type === 'wanted');

  const availableSkillsForAdding = allSkills.filter(
    (skill) =>
      !userSkills.some((us) => us.skill_id === skill.id && us.type === addingType)
  );

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  return (
    <ScrollView
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={styles.container}
    >
                 <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Pressable
          onPress={() => {
            if (router.canGoBack()) {
              router.back();
            } else {
              router.replace('/(tabs)/explore');
            }
          }}
          style={styles.backButton}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="arrow-back" size={24} color={theme.primary} />
          <Text style={styles.backText}>Back</Text>
        </Pressable>

        <Text style={styles.title}>My Skills</Text>
      </View>

      <Text style={styles.sectionTitle}>Skills I Offer</Text>
      {offeredSkills.length === 0 && (
        <Text style={styles.emptyText}>No skills added yet.</Text>
      )}
      {offeredSkills.map((us) => (
        <View key={us.id} style={styles.skillRow}>
          <View>
            <Text style={styles.skillName}>{us.skills.name}</Text>
            <Text style={styles.skillLevel}>{us.level}</Text>
          </View>
          <Pressable onPress={() => handleRemoveSkill(us.id)}>
            <Text style={styles.removeText}>Remove</Text>
          </Pressable>
        </View>
      ))}

      {addingType === 'offered' ? (
        <View style={styles.addForm}>
          <Text style={styles.label}>Select a skill</Text>
          <View style={styles.chipsRow}>
            {availableSkillsForAdding.map((skill) => (
              <Pressable
                key={skill.id}
                style={[
                  styles.chip,
                  selectedSkillId === skill.id && styles.chipSelected,
                ]}
                onPress={() => setSelectedSkillId(skill.id)}
              >
                <Text
                  style={[
                    styles.chipText,
                    selectedSkillId === skill.id && styles.chipTextSelected,
                  ]}
                >
                  {skill.name}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.label}>Level</Text>
          <View style={styles.chipsRow}>
            {LEVELS.map((level) => (
              <Pressable
                key={level}
                style={[styles.chip, selectedLevel === level && styles.chipSelected]}
                onPress={() => setSelectedLevel(level)}
              >
                <Text
                  style={[
                    styles.chipText,
                    selectedLevel === level && styles.chipTextSelected,
                  ]}
                >
                  {level}
                </Text>
              </Pressable>
            ))}
          </View>

          <View style={styles.formButtons}>
            <Pressable style={styles.cancelButton} onPress={cancelAdding}>
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
            <Pressable style={styles.addButton} onPress={handleAddSkill} disabled={submitting}>
              {submitting ? (
                <ActivityIndicator color={theme.primaryForeground} />
              ) : (
                <Text style={styles.addButtonText}>Add</Text>
              )}
            </Pressable>
          </View>
        </View>
      ) : (
        <Pressable style={styles.addSkillButton} onPress={() => startAdding('offered')}>
          <Text style={styles.addSkillText}>+ Add a skill you offer</Text>
        </Pressable>
      )}

      <Text style={[styles.sectionTitle, { marginTop: 32 }]}>Skills I Want to Learn</Text>
      {wantedSkills.length === 0 && (
        <Text style={styles.emptyText}>No skills added yet.</Text>
      )}
      {wantedSkills.map((us) => (
        <View key={us.id} style={styles.skillRow}>
          <Text style={styles.skillName}>{us.skills.name}</Text>
          <Pressable onPress={() => handleRemoveSkill(us.id)}>
            <Text style={styles.removeText}>Remove</Text>
          </Pressable>
        </View>
      ))}

      {addingType === 'wanted' ? (
        <View style={styles.addForm}>
          <Text style={styles.label}>Select a skill</Text>
          <View style={styles.chipsRow}>
            {availableSkillsForAdding.map((skill) => (
              <Pressable
                key={skill.id}
                style={[
                  styles.chip,
                  selectedSkillId === skill.id && styles.chipSelected,
                ]}
                onPress={() => setSelectedSkillId(skill.id)}
              >
                <Text
                  style={[
                    styles.chipText,
                    selectedSkillId === skill.id && styles.chipTextSelected,
                  ]}
                >
                  {skill.name}
                </Text>
              </Pressable>
            ))}
          </View>

          <View style={styles.formButtons}>
            <Pressable style={styles.cancelButton} onPress={cancelAdding}>
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
            <Pressable style={styles.addButton} onPress={handleAddSkill} disabled={submitting}>
              {submitting ? (
                <ActivityIndicator color={theme.primaryForeground} />
              ) : (
                <Text style={styles.addButtonText}>Add</Text>
              )}
            </Pressable>
          </View>
        </View>
      ) : (
        <Pressable style={styles.addSkillButton} onPress={() => startAdding('wanted')}>
          <Text style={styles.addSkillText}>+ Add a skill you want to learn</Text>
        </Pressable>
      )}
    </ScrollView>
  );
}

function createStyles(theme: AppThemeColors) {
  return StyleSheet.create({
    container: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingBottom: 24,
    backgroundColor: theme.background,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.background,
  },
   header: {
    paddingBottom: 16,
    marginBottom: 8,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingVertical: 8,
    paddingRight: 12,
    marginBottom: 12,
  },
  backText: {
    color: theme.primary,
    fontSize: 17,
    fontWeight: '500',
    marginLeft: 4,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: theme.text,
    letterSpacing: -0.5,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
    color: theme.text,
  },
  emptyText: {
    color: theme.textMuted,
    marginBottom: 12,
  },
  skillRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: Layout.radiusSm,
    padding: 12,
    marginBottom: 8,
    backgroundColor: theme.surface,
  },
  skillName: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.text,
  },
  skillLevel: {
    fontSize: 13,
    color: theme.textSecondary,
    textTransform: 'capitalize',
  },
  removeText: {
    color: theme.error,
    fontWeight: '600',
  },
  addSkillButton: {
    borderWidth: 1,
    borderColor: theme.primary,
    borderStyle: 'dashed',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  addSkillText: {
    color: theme.primary,
    fontWeight: '600',
  },
  addForm: {
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: Layout.radiusSm,
    padding: 16,
    marginTop: 8,
    backgroundColor: theme.surfaceMuted,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    marginTop: 8,
    color: theme.text,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  chip: {
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 14,
    backgroundColor: theme.inputBackground,
  },
  chipSelected: {
    backgroundColor: theme.primary,
    borderColor: theme.primary,
  },
  chipText: {
    color: theme.text,
    textTransform: 'capitalize',
  },
  chipTextSelected: {
    color: theme.primaryForeground,
  },
  formButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 12,
  },
  cancelButton: {
    padding: 12,
  },
  cancelText: {
    color: theme.textSecondary,
  },
  addButton: {
    backgroundColor: theme.primary,
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  addButtonText: {
    color: theme.primaryForeground,
    fontWeight: '600',
  },
  });
}