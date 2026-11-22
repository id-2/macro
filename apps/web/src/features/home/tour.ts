import { VIEW_SHELL_TOUR } from '@app/components/view-shell/tour';
import { defineViewTour } from '@app/features/tours/core/view-tour';
import { defineTourTargets } from '@ui/components/Tour';

export const HOME_TOUR = defineTourTargets('home', ['list', 'filter']);

export const homeTour = defineViewTour({
  id: 'home',
  title: 'Главная',
  video: {
    youtubeId: 'Fn5hdzXsQQ8',
    title: 'Обзор Rox',
    duration: '4:45',
  },
  steps: [
    {
      target: HOME_TOUR.list,
      entry: VIEW_SHELL_TOUR.sidebarToggle,
      entryLabel: 'Покажите список на главной, чтобы продолжить',
      title: 'Всё ваше в одном месте',
      description:
        'На главной собраны документы, личные сообщения, почта, задачи, файлы, агенты и групповые чаты.',
    },
    {
      target: HOME_TOUR.filter,
      entry: VIEW_SHELL_TOUR.sidebarToggle,
      entryLabel: 'Покажите список на главной, чтобы продолжить',
      title: 'Откройте контекст',
      description:
        'Выберите элемент, чтобы посмотреть его рядом со списком. Фильтр сузит список.',
    },
    {
      target: VIEW_SHELL_TOUR.main,
      title: 'Начните что-то новое',
      description:
        'Нажмите «Новое», чтобы поработать с агентом, или «Создать» в боковой панели — для документа, задачи или разговора.',
    },
  ],
});
