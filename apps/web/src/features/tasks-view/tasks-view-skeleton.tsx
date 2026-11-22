import { ViewSkeleton } from '@app/components/view-shell/ViewSkeleton';

/** Tasks while its code loads: the task lists and the searchable list. */
export function TasksViewSkeleton() {
  return (
    <ViewSkeleton.Root asidePreferenceKey="tasks">
      <ViewSkeleton.Sidebar title="Задачи" createLabel="Новая задача" />
      <ViewSkeleton.Main
        title="Мои задачи"
        controls={[1, 3, 2, '+ Новая ⌄', 1]}
        searchPlaceholder="Поиск задач"
      />
    </ViewSkeleton.Root>
  );
}
