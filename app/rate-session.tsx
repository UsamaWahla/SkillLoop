import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  Alert,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';

export default function RateSessionScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ sessionId: string }>();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [rating, setRating] = useState(0);
  const [reviewText, setReviewText] = useState('');
  const [otherPersonName, setOtherPersonName] = useState('');
  const [ratedUserId, setRatedUserId] = useState('');
  const [currentUserId, setCurrentUserId] = useState('');

  useEffect(() => {
    loadSessionInfo();
  }, []);

  async function loadSessionInfo() {
    setLoading(true);

    const { data: { session } } = await supabase.auth.getSession();
    const userId = session?.user?.id;

    if (!userId || !params.sessionId) {
      setLoading(false);
      return;
    }

    setCurrentUserId(userId);

    const { data, error } = await supabase
      .from('sessions')
      .select(
        `teacher_id, learner_id,
         teacher:profiles!sessions_teacher_id_fkey(full_name),
         learner:profiles!sessions_learner_id_fkey(full_name)`
      )
      .eq('id', params.sessionId)
      .single();

    if (error || !data) {
      Alert.alert('Error', 'Could not load session info.');
      setLoading(false);
      return;
    }

    const isTeaching = (data as any).teacher_id === userId;
    const otherId = isTeaching ? (data as any).learner_id : (data as any).teacher_id;
    const otherName = isTeaching
      ? (data as any).learner.full_name
      : (data as any).teacher.full_name;

    setRatedUserId(otherId);
    setOtherPersonName(otherName || 'this user');
    setLoading(false);
  }

  async function handleSubmit() {
    if (rating === 0) {
      Alert.alert('Rating required', 'Please select a star rating.');
      return;
    }

    setSubmitting(true);

    const { error } = await supabase.from('ratings').insert({
      session_id: params.sessionId,
      rater_id: currentUserId,
      rated_user_id: ratedUserId,
      rating,
      review_text: reviewText || null,
    });

    setSubmitting(false);

    if (error) {
      if (error.code === '23505') {
        Alert.alert('Already rated', 'You already rated this session.');
        router.back();
        return;
      }
      Alert.alert('Error', error.message);
      return;
    }

    Alert.alert('Thanks!', 'Your rating has been submitted.', [
      { text: 'OK', onPress: () => router.replace('/(tabs)/sessions') },
    ]);
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Pressable
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)/sessions'))}
          style={styles.backButton}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="arrow-back" size={24} color="#007AFF" />
          <Text style={styles.backText}>Back</Text>
        </Pressable>
        <Text style={styles.title}>Rate Your Session</Text>
      </View>

      <Text style={styles.subtitle}>How was your session with {otherPersonName}?</Text>

      <View style={styles.starsRow}>
        {[1, 2, 3, 4, 5].map((star) => (
          <Pressable key={star} onPress={() => setRating(star)} hitSlop={8}>
            <Ionicons
              name={star <= rating ? 'star' : 'star-outline'}
              size={40}
              color="#FF9500"
              style={styles.star}
            />
          </Pressable>
        ))}
      </View>

      <Text style={styles.label}>Review (optional)</Text>
      <TextInput
        style={styles.textArea}
        value={reviewText}
        onChangeText={setReviewText}
        placeholder="Share your experience..."
        placeholderTextColor="#888"
        multiline
        numberOfLines={4}
      />

      <Pressable style={styles.submitButton} onPress={handleSubmit} disabled={submitting}>
        {submitting ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.submitButtonText}>Submit Rating</Text>
        )}
      </Pressable>

      <Pressable onPress={() => router.replace('/(tabs)/sessions')}>
        <Text style={styles.skipText}>Skip for now</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
    color: '#007AFF',
    fontSize: 17,
    fontWeight: '500',
    marginLeft: 4,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
  },
  subtitle: {
    fontSize: 16,
    color: '#444',
    marginBottom: 24,
    textAlign: 'center',
  },
  starsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 32,
  },
  star: {
    marginHorizontal: 4,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    color: '#333',
  },
  textArea: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 14,
    fontSize: 16,
    color: '#000',
    backgroundColor: '#fff',
    height: 100,
    textAlignVertical: 'top',
    marginBottom: 24,
  },
  submitButton: {
    backgroundColor: '#007AFF',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginBottom: 16,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  skipText: {
    textAlign: 'center',
    color: '#888',
    fontSize: 14,
  },
});