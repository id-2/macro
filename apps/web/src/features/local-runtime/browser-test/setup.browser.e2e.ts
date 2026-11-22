import { expect, test } from '@playwright/test';

test('sets up the preferred agent and opens a session with it', async ({
  page,
}) => {
  await page.goto('/?scenario=happy');
  const dialog = page.getByRole('dialog', {
    name: 'Запускайте агентов на этом компьютере',
  });
  await expect(dialog.getByText('Найдите агента')).toBeVisible();
  await expect(dialog.getByText('@claude-code готов')).toBeVisible();
  await expect(
    dialog.getByText('Сеансы выполняются в /Users/sample/Rox.')
  ).toBeVisible();

  await dialog.getByRole('button', { name: 'Начать сеанс' }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole('status', { name: 'Preview action' })).toHaveText(
    'Opened @claude-code'
  );
});

test('shows where setup is while it links the computer', async ({ page }) => {
  await page.goto('/?scenario=hold');
  const dialog = page.getByRole('dialog', {
    name: 'Запускайте агентов на этом компьютере',
  });
  await expect(dialog.getByText('Найден Claude Code')).toBeVisible();
  await expect(
    dialog.getByText('Привязка этого компьютера к вашей учётной записи…')
  ).toBeVisible();
  await expect(
    dialog.locator('li[aria-current="step"]', {
      hasText: 'Подключите этот компьютер',
    })
  ).toBeVisible();
});

test('recovers from a lost pairing with Try again', async ({ page }) => {
  await page.goto('/?scenario=fail-once');
  const dialog = page.getByRole('dialog', {
    name: 'Запускайте агентов на этом компьютере',
  });
  await expect(
    dialog.getByText('The pairing code expired before it was approved.')
  ).toBeVisible();
  await dialog.getByRole('button', { name: 'Повторить' }).click();
  await expect(dialog.getByText('@claude-code готов')).toBeVisible();
});

test('lets the user pick another agent before setting up', async ({ page }) => {
  await page.goto('/?scenario=happy&auto=false');
  const dialog = page.getByRole('dialog', {
    name: 'Запускайте агентов на этом компьютере',
  });
  await expect(
    dialog.getByText('На этом компьютере найден Claude Code.')
  ).toBeVisible();
  await dialog.getByRole('button', { name: 'Параметры' }).click();
  await expect(dialog.getByLabel('Папка рабочей области')).toHaveValue(
    '/Users/sample/Rox'
  );
  await expect(dialog.getByText('Полный доступ')).toBeVisible();
  await expect(
    dialog.getByRole('button', { name: 'Настроить Claude Code' })
  ).toBeEnabled();
});

test('asks for an agent when none is installed', async ({ page }) => {
  await page.goto('/?scenario=none');
  const dialog = page.getByRole('dialog', {
    name: 'Запускайте агентов на этом компьютере',
  });
  await expect(
    dialog.getByRole('button', { name: 'Искать снова' })
  ).toBeVisible();
});
