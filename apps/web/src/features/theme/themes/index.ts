import type { ThemeV3 } from '../types/themeTypes';
import { decepticonTheme } from './decepticon';
import { emberTheme } from './ember';
import { floraTheme } from './flora';
import { lapisTheme } from './lapis';
import { roxDarkTheme } from './rox-dark';
import { roxGruvboxTheme } from './rox-gruvbox';
import { roxLightTheme } from './rox-light';
import { moonTheme } from './moon';
import { paperTheme } from './paper';
import { rainTheme } from './rain';
import { satsumaTheme } from './satsuma';
import { spiritTheme } from './spirit';
import { voidTheme } from './void';

// Ordered for the theme picker: dark themes first (led by Rox Dark), then
// light themes (led by Rox Light).
export const DEFAULT_THEMES = [
  roxDarkTheme,
  roxGruvboxTheme,
  voidTheme,
  emberTheme,
  spiritTheme,
  moonTheme,
  rainTheme,
  roxLightTheme,
  satsumaTheme,
  lapisTheme,
  floraTheme,
  paperTheme,
  decepticonTheme,
] satisfies ThemeV3[];
