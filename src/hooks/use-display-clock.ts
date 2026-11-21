import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { AppState } from 'react-native';

export function useDisplayClock(intervalMs: number | null) {
  const [now, setNow] = useState(Date.now);
  useFocusEffect(useCallback(() => {
    const update = () => setNow(Date.now());
    update();
    if (!intervalMs) return;
    const timer = setInterval(update, intervalMs);
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') update();
    });
    return () => {
      clearInterval(timer);
      subscription.remove();
    };
  }, [intervalMs]));
  return now;
}

export function formatNursingTime(seconds: number) {
  return [Math.floor(seconds / 60), seconds % 60]
    .map(value => String(value).padStart(2, '0')).join(':');
}
