import type { ReactNode } from 'react';
import Animated, { FadeInLeft, FadeInRight, FadeOutLeft, FadeOutRight } from 'react-native-reanimated';

export type PageTransitionDirection = 'next' | 'prev';

type AnimatedPageViewProps = {
  pageKey: number;
  direction: PageTransitionDirection;
  children: ReactNode;
};

export function AnimatedPageView({ pageKey, direction, children }: AnimatedPageViewProps) {
  const entering = direction === 'next' ? FadeInRight.duration(280) : FadeInLeft.duration(280);
  const exiting = direction === 'next' ? FadeOutLeft.duration(200) : FadeOutRight.duration(200);

  return (
    <Animated.View key={pageKey} entering={entering} exiting={exiting} style={{ flex: 1 }}>
      {children}
    </Animated.View>
  );
}
