import { useEffect } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';

import { useAppTheme } from '@/hooks/use-app-theme';
import { Layout } from '@/constants/theme';

type PaginationControlsProps = {
  page: number;
  totalPages: number;
  onPrevious: () => void;
  onNext: () => void;
  itemLabel?: string;
};

function AnimatedDot({ active, color }: { active: boolean; color: string }) {
  const width = useSharedValue(active ? 22 : 8);
  const opacity = useSharedValue(active ? 1 : 0.45);

  useEffect(() => {
    width.value = withSpring(active ? 22 : 8, { damping: 18, stiffness: 220 });
    opacity.value = withSpring(active ? 1 : 0.45, { damping: 18, stiffness: 220 });
  }, [active, opacity, width]);

  const dotStyle = useAnimatedStyle(() => ({
    width: width.value,
    opacity: opacity.value,
    backgroundColor: color,
  }));

  return <Animated.View style={[styles.dot, dotStyle]} />;
}

export function PaginationControls({
  page,
  totalPages,
  onPrevious,
  onNext,
  itemLabel = 'page',
}: PaginationControlsProps) {
  const theme = useAppTheme();
  const hasPrev = page > 0;
  const hasNext = page < totalPages - 1;
  const showControls = totalPages > 1;

  if (!showControls) {
    return null;
  }

  return (
    <View style={[styles.wrapper, { borderTopColor: theme.border, backgroundColor: theme.surface }]}>
      <Pressable
        onPress={onPrevious}
        disabled={!hasPrev}
        style={({ pressed }) => [
          styles.navButton,
          { borderColor: theme.border, backgroundColor: theme.surfaceMuted },
          !hasPrev && styles.navDisabled,
          pressed && hasPrev && styles.navPressed,
        ]}
      >
        <Ionicons
          name="chevron-back"
          size={20}
          color={hasPrev ? theme.primary : theme.textMuted}
        />
      </Pressable>

      <View style={styles.center}>
        <View style={styles.dotsRow}>
          {Array.from({ length: totalPages }, (_, i) => (
            <AnimatedDot key={i} active={i === page} color={theme.primary} />
          ))}
        </View>
        <Text style={[styles.pageText, { color: theme.textSecondary }]}>
          {itemLabel} {page + 1} of {totalPages}
        </Text>
      </View>

      <Pressable
        onPress={onNext}
        disabled={!hasNext}
        style={({ pressed }) => [
          styles.navButton,
          { borderColor: theme.border, backgroundColor: theme.surfaceMuted },
          !hasNext && styles.navDisabled,
          pressed && hasNext && styles.navPressed,
        ]}
      >
        <Ionicons
          name="chevron-forward"
          size={20}
          color={hasNext ? theme.primary : theme.textMuted}
        />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 4,
    marginTop: 8,
    borderTopWidth: 1,
    borderRadius: Layout.radiusMd,
  },
  navButton: {
    width: 44,
    height: 44,
    borderRadius: Layout.radiusSm,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navDisabled: {
    opacity: 0.5,
  },
  navPressed: {
    opacity: 0.85,
  },
  center: {
    alignItems: 'center',
    flex: 1,
    paddingHorizontal: 12,
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  dot: {
    height: 8,
    borderRadius: Layout.radiusFull,
  },
  pageText: {
    fontSize: 12,
    fontWeight: '600',
  },
});
