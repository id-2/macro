import { t } from '@app/lib/i18n';
import { isMobile } from '@core/mobile/isMobile';
import { isNativeMobilePlatform } from '@core/mobile/isNativeMobilePlatform';
import { storePlatform } from '@core/mobile/storePlatform';
import { Tabs } from '@ui';
import { createSignal, For, Show } from 'solid-js';
import { Dynamic } from 'solid-js/web';
import { NativeAppInfo } from './NativeAppInfo';
import { SettingsCard, SettingsPage } from './primitives';

const DEVICES = {
  ios: {
    device: 'iPhone',
    picture: IphonePicture,
  },
  android: {
    device: 'Android',
    picture: AndroidPicture,
  },
};

type Platform = keyof typeof DEVICES;

const PLATFORMS: Platform[] = ['ios', 'android'];

const PLATFORM_TABS = PLATFORMS.map((value) => ({
  value,
  label: DEVICES[value].device,
}));


/** Native APIs are only read when mounted inside the mobile app. */
export function MobileApp() {
  if (isNativeMobilePlatform()) {
    return (
      <NativeAppInfo
        title="Мобильное приложение"
        description="Установленная у вас версия Rox."
      />
    );
  }

  const detected = storePlatform(navigator.userAgent, navigator.maxTouchPoints);

  return (
    <SettingsPage
      title={t('settingsMobileApp.title')}
      description={t('settingsMobileApp.storeLinksDescription')}
    >
      <SettingsCard>
        <Show when={isMobile()} fallback={<DevicePanel />}>
          <DevicePictures platforms={detected ? [detected] : PLATFORMS} />
        </Show>
      </SettingsCard>
    </SettingsPage>
  );
}

function DevicePictures(props: { platforms: Platform[] }) {
  return (
    <div class="flex items-end justify-center gap-8 p-8">
      <For each={props.platforms}>
        {(platform) => <DevicePicture platform={platform} />}
      </For>
    </div>
  );
}

function DevicePanel() {
  const [platform, setPlatform] = createSignal<Platform>('ios');

  return (
    <div class="flex flex-col items-center gap-6 px-6 pt-10 pb-12">
      <Tabs
        aria-label={t('settingsMobileApp.phone')}
        options={PLATFORM_TABS}
        value={platform()}
        onChange={setPlatform}
      />
      <DevicePicture platform={platform()} />
    </div>
  );
}

function DevicePicture(props: { platform: Platform }) {
  return (
    <Dynamic
      component={DEVICES[props.platform].picture}
      aria-hidden="true"
      class="block h-48 text-ink"
    />
  );
}

/** Decorative iPhone outline. The store code that used to sit on the screen is not drawn. */
function IphonePicture(props: { class?: string; 'aria-hidden'?: 'true' }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 58 121"
      class={props.class}
      aria-hidden={props['aria-hidden']}
    >
      <g
        fill="none"
        stroke="currentColor"
        stroke-width="1.25"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path
          transform="translate(-2.7355 -2.7355)"
          d="m4.7355 14.735 1e-7 11.5a0.5 0.5 135 0 1-0.5 0.5 0.5 0.5 135 0 0-0.5 0.5v3a0.5 0.5 45 0 0 0.5 0.5 0.5 0.5 45 0 1 0.5 0.5l-1e-7 3.2788a0.5 0.5 135 0 1-0.5 0.5 0.5 0.5 135 0 0-0.5 0.5l1e-7 6.7212a0.5 0.5 45 0 0 0.5 0.5h1e-6a0.5 0.5 45 0 1 0.5 0.5v2a0.5 0.5 135 0 1-0.5 0.5h-1e-7a0.5 0.5 135 0 0-0.5 0.5v7a0.5 0.5 45 0 0 0.5 0.5 0.5 0.5 45 0 1 0.5 0.5l-1e-7 57.5a10 10 45 0 0 10 10h34a10 10 135 0 0 10-10l2e-6 -60.5a0.5 0.5 135 0 1 0.5-0.5 0.5 0.5 135 0 0 0.5-0.5v-12a0.5 0.5 45 0 0-0.5-0.5 0.5 0.5 45 0 1-0.5-0.5l-1e-6 -22.5a10 10 45 0 0-10-10h-34a10 10 135 0 0-10 10z"
        />
        <path
          transform="translate(-2.7355 -2.7355)"
          d="m6.7355 14.471v97.265a8 8 45 0 0 8 8h34a8 8 135 0 0 8-8v-97a8 8 45 0 0-8-8h-34.264a7.7355 7.7355 135 0 0-7.7355 7.7355z"
        />
        <path
          transform="translate(-3,-2.7355)"
          d="m24 10.236a1.5 1.5 45 0 0 1.5 1.5h13a1.5 1.5 135 0 0 1.5-1.5 1.5 1.5 45 0 0-1.5-1.5h-13a1.5 1.5 135 0 0-1.5 1.5z"
        />
      </g>
    </svg>
  );
}

/** Decorative Android phone outline. The store code that used to sit on the screen is not drawn. */
function AndroidPicture(props: { class?: string; 'aria-hidden'?: 'true' }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 58 121"
      class={props.class}
      aria-hidden={props['aria-hidden']}
    >
      <g
        fill="none"
        stroke="currentColor"
        stroke-width="1.25"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path d="M10 2H48A8 8 0 0 1 56 10V27.5A0.5 0.5 0 0 0 56.5 28A0.5 0.5 0 0 1 57 28.5V34.5A0.5 0.5 0 0 1 56.5 35A0.5 0.5 0 0 0 56 35.5V40.5A0.5 0.5 0 0 0 56.5 41A0.5 0.5 0 0 1 57 41.5V54.5A0.5 0.5 0 0 1 56.5 55A0.5 0.5 0 0 0 56 55.5V111A8 8 0 0 1 48 119H10A8 8 0 0 1 2 111V10A8 8 0 0 1 10 2Z" />
        <path d="M10 4H48A6 6 0 0 1 54 10V111A6 6 0 0 1 48 117H10A6 6 0 0 1 4 111V10A6 6 0 0 1 10 4Z" />
        <circle cx="29" cy="8" r="1.25" />
      </g>
    </svg>
  );
}
