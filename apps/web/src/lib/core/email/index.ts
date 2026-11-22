// Compatibility entry point for the editor's HTML decorator and quoted replies.
// The implementation lives in the framework-independent renderer package.
export { stripColorSchemeMediaQueries } from '@rox-one/email-renderer';
export {
  processEmailColors,
  type ThemeColorParams,
} from '@rox-one/email-renderer/browser';
