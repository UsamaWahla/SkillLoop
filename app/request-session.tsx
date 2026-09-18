import { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Alert,
  ActivityIndicator,
  ScrollView,
  Platform,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Layout, type AppThemeColors } from '@/constants/theme';
import { useAppTheme } from '@/hooks/use-app-theme';
import { supabase } from '@/lib/supabase';

const DURATIONS = [30, 60, 90, 120];

export default function RequestSessionScreen() {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    teacherId: string;
    teacherName: string;
    skillId: string;
    skillName: string;
  }>();

  const [date, setDate] = useState(new Date());
  const [showPicker, setShowPicker] = useState(false);
  const [pickerMode, setPickerMode] = useState<'date' | 'time'>('date');
  const [duration, setDuration] = useState(60);
  const [sessionType, setSessionType] = useState<'online' | 'in_person'>('online');
  const [submitting, setSubmitting] = useState(false);

  function openPicker(mode: 'date' | 'time') {
    setPickerMode(mode);
    setShowPicker(true);
  }

  function onPickerChange(event: any, selectedDate?: Date) {
    setShowPicker(Platform.OS === 'ios');
    if (selectedDate) {
      setDate(selectedDate);
    }
  }

  async function handleConfirm() {
    if (!params.teacherId || !params.skillId) {
      Alert.alert('Missing info', 'Something went wrong, please go back and try again.');
      return;
    }

    setSubmitting(true);

    const { data: { session } } = await supabase.auth.getSession();
    const currentUserId = session?.user?.id;

    if (!currentUserId) {
      setSubmitting(false);
      return;
    }

    const { data: existingMatch } = await supabase
      .from('matches')
      .select('id')
      .or(
        `and(user_id_1.eq.${currentUserId},user_id_2.eq.${params.teacherId}),and(user_id_1.eq.${params.teacherId},user_id_2.eq.${currentUserId})`
      )
      .maybeSingle();

    let matchId = existingMatch?.id;

    if (!matchId) {
      const { data: newMatch, error: matchError } = await supabase
        .from('matches')
        .insert({
          user_id_1: currentUserId,
          user_id_2: params.teacherId,
          compatibility_score: 0,
          matched_skill_wanted: params.skillId,
          status: 'accepted',
        })
        .select('id')
        .single();

      if (matchError) {
        setSubmitting(false);
        Alert.alert('Error creating match', matchError.message);
        return;
      }

      matchId = newMatch.id;
    }

       const { error: sessionError } = await supabase.from('sessions').insert({
      match_id: matchId,
      skill_id: params.skillId,
      teacher_id: params.teacherId,
      learner_id: currentUserId,
      scheduled_at: date.toISOString(),
      duration_minutes: duration,
      session_type: sessionType,
      status: 'pending',
    });
    setSubmitting(false);

    if (sessionError) {
      Alert.alert('Error creating session', sessionError.message);
      return;
    }

        Alert.alert(
      'Request Sent!',
      `Your session request has been sent to ${params.teacherName}. You'll be notified once they respond.`,
      [{ text: 'OK', onPress: () => router.back() }]
    );
  }

  return (
    <ScrollView
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={styles.container}
    >
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Pressable
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)'))}
          style={styles.backButton}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="arrow-back" size={24} color={theme.primary} />
          <Text style={styles.backText}>Back</Text>
        </Pressable>
        <Text style={styles.title}>Request Session</Text>
      </View>

      <View style={styles.summaryCard}>
        <Text style={styles.summaryLabel}>Skill</Text>
        <Text style={styles.summaryValue}>{params.skillName}</Text>
        <Text style={styles.summaryLabel}>Teacher</Text>
        <Text style={styles.summaryValue}>{params.teacherName}</Text>
      </View>

      <Text style={styles.label}>Date</Text>
      <Pressable style={styles.pickerButton} onPress={() => openPicker('date')}>
        <Text style={styles.pickerButtonText}>{date.toDateString()}</Text>
      </Pressable>

      <Text style={styles.label}>Time</Text>
      <Pressable style={styles.pickerButton} onPress={() => openPicker('time')}>
        <Text style={styles.pickerButtonText}>
          {date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </Text>
      </Pressable>

      {showPicker && (
        <DateTimePicker
          value={date}
          mode={pickerMode}
          display="default"
          onChange={onPickerChange}
        />
      )}

      <Text style={styles.label}>Duration</Text>
      <View style={styles.chipsRow}>
        {DURATIONS.map((d) => (
          <Pressable
            key={d}
            style={[styles.chip, duration === d && styles.chipSelected]}
            onPress={() => setDuration(d)}
          >
            <Text style={[styles.chipText, duration === d && styles.chipTextSelected]}>
              {d} min
            </Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.label}>Session Type</Text>
      <View style={styles.chipsRow}>
        {(['online', 'in_person'] as const).map((type) => (
          <Pressable
            key={type}
            style={[styles.chip, sessionType === type && styles.chipSelected]}
            onPress={() => setSessionType(type)}
          >
            <Text style={[styles.chipText, sessionType === type && styles.chipTextSelected]}>
              {type === 'online' ? 'Online' : 'In Person'}
            </Text>
          </Pressable>
        ))}
      </View>

      <Pressable style={styles.confirmButton} onPress={handleConfirm} disabled={submitting}>
        {submitting ? (
          <ActivityIndicator color={theme.primaryForeground} />
        ) : (
          <Text style={styles.confirmButtonText}>Confirm Request</Text>
        )}
      </Pressable>
    </ScrollView>
  );
}

function createStyles(theme: AppThemeColors) {
  return StyleSheet.create({
  container: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingBottom: 40,
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
  summaryCard: {
    backgroundColor: theme.surfaceMuted,
    borderRadius: Layout.radiusMd,
    padding: 16,
    marginBottom: 24,
  },
  summaryLabel: {
    fontSize: 12,
    color: theme.textSecondary,
    marginTop: 8,
  },
  summaryValue: {
    fontSize: 17,
    fontWeight: '700',
    color: theme.text,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    marginTop: 16,
    color: theme.text,
  },
  pickerButton: {
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: Layout.radiusSm,
    padding: 14,
    backgroundColor: theme.inputBackground,
  },
  pickerButtonText: {
    fontSize: 16,
    color: theme.text,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
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
  },
  chipTextSelected: {
    color: theme.primaryForeground,
  },
  confirmButton: {
    backgroundColor: theme.primary,
    borderRadius: Layout.radiusSm,
    padding: 16,
    alignItems: 'center',
    marginTop: 32,
  },
  confirmButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  });
}