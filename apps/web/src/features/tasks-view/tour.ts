import { VIEW_SHELL_TOUR } from '@app/components/view-shell/tour';
import { defineViewTour } from '@app/features/tours/core/view-tour';
import { defineTourTargets } from '@ui/components/Tour';

export const TASKS_TOUR = defineTourTargets('tasks', ['filter']);

export const tasksTour = defineViewTour({
  id: 'tasks',
  title: 'Задачи',
  connector: { kind: 'mcp', label: 'Linear', tools: ['Linear'] },
  video: { youtubeId: 'gxJquVXRX5A', title: 'Задачи Rox', duration: '1:35' },
  steps: [
    {
      target: VIEW_SHELL_TOUR.aside,
      entry: VIEW_SHELL_TOUR.sidebarToggle,
      entryLabel: 'Откройте боковую панель задач, чтобы продолжить',
      title: 'Превратите планы в движение',
      description:
        'Создайте задачу с ясным следующим шагом или подключите Linear, чтобы перенести задачи в Rox.',
    },
    {
      target: VIEW_SHELL_TOUR.main,
      title: 'Назначьте ответственного',
      description:
        'Откройте задачу, чтобы указать исполнителя, срок и статус. Добавьте контекст, чтобы следующий шаг был понятен.',
    },
    {
      target: TASKS_TOUR.filter,
      title: 'Держите задачи в порядке с помощью тегов',
      description:
        'Помечайте задачи проектом, командой или видом работы, затем фильтруйте список по тегам, которые важны сейчас.',
    },
  ],
});
