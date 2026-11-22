import { t } from '@app/lib/i18n';
import { useIsAuthenticated } from '@core/auth';
import { useNavigate } from '@solidjs/router';
import { Button } from '@ui';

export function openLoginModal() {
  const isAuthenticated = useIsAuthenticated();
  if (isAuthenticated()) return;

  const params = new URLSearchParams(window.location.search);
  const queryString = params.size > 0 ? `?${params.toString()}` : '';
  window.location.href = `${window.location.origin}/app/login${queryString}`;
}

export function LoginButton() {
  const navigate = useNavigate();
  return (
    <div class="flex gap-2 justify-center w-max items-center">
      <Button
        variant="secondary"
        size="sm"
        onClick={() => navigate(`/login${window.location.search}`)}
      >
        {t('common.logIn')}
      </Button>
      <span class="text-xs text-ink-muted italic">{t('common.or')}</span>
      <Button
        variant="primary"
        size="sm"
        onClick={() => navigate(`/welcome${window.location.search}`)}
      >
        {t('common.signUp')}
      </Button>
    </div>
  );
}
