import { interfaceLanguage } from '@app/lib/i18n';

/**
 * Copy for the signed-out entry. Russian when nobody has chosen a language:
 * the interface language is already Russian in that case.
 */
export type EntryCopy = {
  welcome: (name: string) => string;
  tagline: string;
  agentTitle: string;
  agentSubtitle: string;
  continueEmail: string;
  continueApple: string;
  agreeLead: string;
  terms: string;
  and: string;
  privacy: string;
  modifiedLead: (name: string) => string;
  modifiedTail: string;
  source: string;
  emailHint: string;
  passwordPlaceholder: string;
  continue: string;
  back: string;
};

const en: EntryCopy = {
  welcome: (name) => `Добро пожаловать в ${name}`,
  tagline:
    'One workspace - for you, agents and teams. AI-native and 2027-ready. Engineered for speed and security in Rust. Open source & free.',
  agentTitle: 'Sign up as an agent',
  agentSubtitle: 'Use your email address. You get an SDK token next.',
  continueEmail: 'Продолжить с почтой',
  continueApple: 'Continue with Apple',
  agreeLead: 'By continuing, you agree to our',
  terms: 'terms',
  and: 'and',
  privacy: 'privacy policy',
  modifiedLead: (name) => `${name} is a modified version of`,
  modifiedTail:
    ', modified 2026-11-12 under the existing license notices.',
  source: 'Source',
  emailHint: 'We’ll send a one-time code to verify.',
  passwordPlaceholder: 'Password',
  continue: 'Continue',
  back: 'Back to sign in',
};

const ru: EntryCopy = {
  welcome: (name) => `Добро пожаловать в ${name}`,
  tagline:
    'Одно пространство — для вас, агентов и команды. Создано для работы с ИИ и готово к 2027 году. Скорость и защита на Rust. Открытый код и бесплатно.',
  agentTitle: 'Регистрация агента',
  agentSubtitle: 'Укажите свою почту. Дальше вы получите ключ для программ.',
  continueEmail: 'Продолжить с почтой',
  continueApple: 'Продолжить с Apple',
  agreeLead: 'Продолжая, вы соглашаетесь с нашими',
  terms: 'условиями',
  and: 'и',
  privacy: 'политикой конфиденциальности',
  modifiedLead: (name) => `${name} — изменённая версия`,
  modifiedTail:
    ', изменения от 2026-11-12 в соответствии с действующими уведомлениями о лицензии.',
  source: 'Исходный код',
  emailHint: 'Мы отправим одноразовый код для проверки.',
  passwordPlaceholder: 'Пароль',
  continue: 'Продолжить',
  back: 'Назад ко входу',
};

export function entryCopy(): EntryCopy {
  return interfaceLanguage() === 'ru' ? ru : en;
}
