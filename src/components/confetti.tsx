import { forwardRef, useImperativeHandle, useState } from 'react';
import { Animated, Dimensions, StyleSheet, View } from 'react-native';

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

interface Particle {
  id: number;
  color: string;
  size: number;
  isRound: boolean;
  angle: number;
  distance: number;
  spinVal: number;
  anim: Animated.Value;
}

export interface ConfettiRef {
  trigger: () => void;
}

export const Confetti = forwardRef<ConfettiRef, {}>((props, ref) => {
  const [particles, setParticles] = useState<Particle[]>([]);

  useImperativeHandle(ref, () => ({
    trigger() {
      // Generate 60 random confetti particles
      const newParticles: Particle[] = Array.from({ length: 60 }).map((_, index) => {
        // True upward cone: angle centered on straight-up (-PI/2), spread ± ~72deg
        const angle = -Math.PI / 2 + (Math.random() - 0.5) * (Math.PI * 0.8);
        const distance = 140 + Math.random() * 220; // Launch range (px)

        return {
          id: Date.now() + index,
          color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
          size: 8 + Math.random() * 9, // slightly larger so they read as confetti
          isRound: Math.random() > 0.5,
          angle,
          distance,
          spinVal: (Math.random() - 0.5) * 720, // Spin rotation degrees
          anim: new Animated.Value(0),
        };
      });

      setParticles(newParticles);

      // Animate particles simultaneously
      const animations = newParticles.map((p) => {
        return Animated.timing(p.anim, {
          toValue: 1,
          duration: 1500 + Math.random() * 500, // staggered durations for natural flow
          useNativeDriver: true,
        });
      });

      Animated.parallel(animations).start(() => {
        // Clear particles after animation finishes to conserve memory
        setParticles([]);
      });
    },
  }));

  if (particles.length === 0) return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {particles.map((p) => {
        // Interpolations for physics explosion
        const translateX = p.anim.interpolate({
          inputRange: [0, 1],
          outputRange: [0, p.distance * Math.cos(p.angle)],
        });

        // Burst up first, then drop down using gravity simulation (quadratic curve)
        const translateY = p.anim.interpolate({
          inputRange: [0, 0.4, 1],
          outputRange: [
            0,
            (p.distance * 0.8) * Math.sin(p.angle), // launch up along the cone
            (p.distance * 0.3) * Math.sin(p.angle) + 520, // fall down under gravity
          ],
        });

        const rotate = p.anim.interpolate({
          inputRange: [0, 1],
          outputRange: ['0deg', `${p.spinVal}deg`],
        });

        const opacity = p.anim.interpolate({
          inputRange: [0, 0.7, 1],
          outputRange: [1, 0.9, 0], // Fade out at the end
        });

        const scale = p.anim.interpolate({
          inputRange: [0, 0.8, 1],
          outputRange: [1, 1, 0], // Shrink away as they disappear
        });

        return (
          <Animated.View
            key={p.id}
            style={[
              styles.particle,
              {
                backgroundColor: p.color,
                width: p.size,
                height: p.size,
                borderRadius: p.isRound ? p.size / 2 : 2,
                transform: [{ translateX }, { translateY }, { rotate }, { scale }],
                opacity,
              },
            ]}
          />
        );
      })}
    </View>
  );
});

const styles = StyleSheet.create({
  particle: {
    position: 'absolute',
    left: SCREEN_WIDTH / 2,
    top: SCREEN_HEIGHT / 2, // bursts from viewport center
  },
});
