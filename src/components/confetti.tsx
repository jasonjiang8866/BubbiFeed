import { forwardRef, useImperativeHandle, useState } from 'react';
import { Dimensions, StyleSheet, View } from 'react-native';
import Animated, {
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Premium nursery pastel colors
const CONFETTI_COLORS = [
  '#FF9B85', // Warm Coral
  '#F7A8B8', // Rose Pink
  '#8CD1CA', // Milky Mint
  '#FFD97D', // Sunny Apricot
  '#C5A3FF', // Lavender
  '#9CCC65', // Soothing Green
];

const PARTICLE_COUNT = 60;

interface Particle {
  id: number;
  color: string;
  size: number;
  isRound: boolean;
  angle: number; // launch direction (rad), centered on straight-up
  distance: number; // how far it travels (px)
  spinVal: number; // total spin (deg)
  duration: number; // staggered for a natural flow
}

export interface ConfettiRef {
  trigger: () => void;
}

/**
 * A single confetti piece. Its animation is driven by a shared UI-thread
 * `progress` value (0 → 1) so the burst runs on the native driver and is
 * reliable on release builds (unlike RN core Animated).
 */
const ParticleView = ({
  particle,
  progress,
}: {
  particle: Particle;
  progress: { value: number };
}) => {
  const style = useAnimatedStyle(() => {
    const t = progress.value;

    const translateX = interpolate(t, [0, 1], [0, particle.distance * Math.cos(particle.angle)]);

    // Launch up along the cone, then fall under gravity (quadratic-ish curve)
    const translateY = interpolate(
      t,
      [0, 0.4, 1],
      [
        0,
        particle.distance * 0.8 * Math.sin(particle.angle),
        particle.distance * 0.3 * Math.sin(particle.angle) + 520,
      ]
    );

    const rotateDeg = interpolate(t, [0, 1], [0, particle.spinVal]);
    const opacity = interpolate(t, [0, 0.7, 1], [1, 0.9, 0]);
    const scale = interpolate(t, [0, 0.8, 1], [1, 1, 0]);

    return {
      transform: [{ translateX }, { translateY }, { rotate: `${rotateDeg}deg` }, { scale }],
      opacity,
    };
  });

  return (
    <Animated.View
      style={[
        styles.particle,
        {
          backgroundColor: particle.color,
          width: particle.size,
          height: particle.size,
          borderRadius: particle.isRound ? particle.size / 2 : 2,
        },
        style,
      ]}
    />
  );
};

export const Confetti = forwardRef<ConfettiRef, {}>((props, ref) => {
  const [particles, setParticles] = useState<Particle[]>([]);
  // UI-thread progress shared by every particle in the current burst.
  const progress = useSharedValue(0);

  useImperativeHandle(ref, () => ({
    trigger() {
      // True upward cone: angle centered on straight-up (-PI/2), spread ± ~72deg
      const newParticles: Particle[] = Array.from({ length: PARTICLE_COUNT }).map((_, index) => {
        const angle = -Math.PI / 2 + (Math.random() - 0.5) * (Math.PI * 0.8);
        const distance = 140 + Math.random() * 220;

        return {
          id: Date.now() + index,
          color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
          size: 8 + Math.random() * 9,
          isRound: Math.random() > 0.5,
          angle,
          distance,
          spinVal: (Math.random() - 0.5) * 720,
          duration: 1500 + Math.random() * 500,
        };
      });

      // Mount the particles, then start the shared progress on the next frame
      // so the UI-thread animation reliably picks up the freshly-mounted views.
      setParticles(newParticles);
      progress.value = 0;
      requestAnimationFrame(() => {
        const maxDuration = Math.max(...newParticles.map((p) => p.duration));
        progress.value = withTiming(1, { duration: maxDuration }, (finished) => {
          if (finished) {
            // Clear particles after the burst to conserve memory.
            runOnJS(setParticles)([]);
          }
        });
      });
    },
  }));

  if (particles.length === 0) return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {particles.map((p) => (
        <ParticleView key={p.id} particle={p} progress={progress} />
      ))}
    </View>
  );
});

export default Confetti;

const styles = StyleSheet.create({
  particle: {
    position: 'absolute',
    left: SCREEN_WIDTH / 2,
    top: SCREEN_HEIGHT / 2, // bursts from viewport center
  },
});
