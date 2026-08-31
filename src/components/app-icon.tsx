import {
    Apple,
    ArrowLeft,
    ArrowRight,
    Baby,
    CalendarDays,
    ChartColumn,
    ChevronLeft,
    ChevronRight,
    Clock,
    House,
    Milk,
    Moon,
    Pause,
    PenLine,
    Pencil,
    Play,
    Plus,
    Settings,
    Timer,
    Trash2,
    UtensilsCrossed,
    Zap,
    type LucideIcon,
} from 'lucide-react-native';
import type { ColorValue } from 'react-native';

import { useTheme } from '@/hooks/use-theme';

/**
 * Central icon registry for FeedMyBaby.
 *
 * All icons are Lucide (SVG via react-native-svg). They use `currentColor` internally,
 * so pass `color` to tint. Default size 20 / strokeWidth 2 matches the site icon style.
 *
 * Add new icons by importing from 'lucide-react-native' and adding to the map below.
 */
const ICONS = {
  // navigation
  home: House,
  milk: Milk,
  history: CalendarDays,
  insights: ChartColumn,
  settings: Settings,
  // feed types
  baby: Baby,
  apple: Apple,
  utensils: UtensilsCrossed,
  // actions / state
  timer: Timer,
  clock: Clock,
  edit: Pencil,
  penLine: PenLine,
  play: Play,
  pause: Pause,
  plus: Plus,
  trash: Trash2,
  zap: Zap,
  moon: Moon,
  arrowLeft: ArrowLeft,
  arrowRight: ArrowRight,
  chevronLeft: ChevronLeft,
  chevronRight: ChevronRight,
} as const satisfies Record<string, LucideIcon>;

export type AppIconName = keyof typeof ICONS;

export interface AppIconProps {
  name: AppIconName;
  /** Icon box size in px (width & height). Default 20. */
  size?: number;
  /** Stroke color. Defaults to theme text color. Accepts any RN ColorValue. */
  color?: ColorValue;
  /** Lucide stroke width. Default 2. */
  strokeWidth?: number;
}

export function AppIcon({ name, size = 20, color, strokeWidth = 2 }: AppIconProps) {
  const theme = useTheme();
  const IconComponent = ICONS[name];
  return <IconComponent size={size} color={color ?? theme.text} strokeWidth={strokeWidth} />;
}

export default AppIcon;
