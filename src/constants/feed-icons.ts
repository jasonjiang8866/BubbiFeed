import type { AppIconName } from '@/components/app-icon';
import type { ThemeColor } from '@/constants/theme';

export type FeedType = 'breast' | 'bottle' | 'solid';

/**
 * Shared mapping from a feeding type to its Lucide icon + brand color key.
 * Keeps the iconography consistent across Home, Logger, History and Insights.
 */
export const FEED_TYPE_ICON: Record<FeedType, AppIconName> = {
  breast: 'baby',
  bottle: 'milk',
  solid: 'apple',
};

export const FEED_TYPE_COLOR: Record<FeedType, ThemeColor> = {
  breast: 'breast',
  bottle: 'bottle',
  solid: 'solid',
};

/** Empty-state / generic food icon. */
export const FOOD_EMPTY_ICON: AppIconName = 'utensils';
