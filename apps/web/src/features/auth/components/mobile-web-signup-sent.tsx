import { RoxMark } from '@core/component/RoxMark';

export function MobileWebSignupSent(props: { onBackHome: () => void }) {
  return (
    <div class="flex flex-col size-full p-6 overflow-hidden relative">
      <div class="flex flex-col items-start gap-4 w-full max-w-md mx-auto mt-6">
        <RoxMark class="size-16 self-center" />
        <h2 class="text-3xl font-semibold text-ink mt-3">
          Rox лучше на компьютере.
        </h2>
        <p class="text-base text-ink/60 mt-4">
          Мы отправили ссылку на вашу почту — откройте её на компьютере, чтобы
          получить весь Rox.
        </p>

        <button
          type="button"
          onClick={() => props.onBackHome()}
          class="w-full px-3 py-2.5 text-lg font-bold rounded-xs bg-accent text-surface border-none mt-16"
        >
          Вернуться на главную
        </button>
      </div>
    </div>
  );
}
