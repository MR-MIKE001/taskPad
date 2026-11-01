import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { TaskRow, type TaskRowProps } from './TaskRow';
import type { Task } from '../store/types';

type SharedProps = Omit<TaskRowProps, 'task' | 'drag' | 'list'> & { listFor: (task: Task) => TaskRowProps['list'] };

function SortableRow({ task, listFor, ...rest }: SharedProps & { task: Task }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id });
  return (
    <TaskRow
      {...rest}
      task={task}
      list={listFor(task)}
      drag={{
        setNodeRef,
        isDragging,
        style: { transform: CSS.Translate.toString(transform), transition },
        handleProps: { ...attributes, ...listeners },
      }}
    />
  );
}

interface TaskListViewProps extends SharedProps {
  tasks: Task[];
  /** When true rows can be dragged; the new order is reported through `onReorder`. */
  sortable: boolean;
  onReorder: (ids: string[]) => void;
}

export function TaskListView({ tasks, sortable, onReorder, listFor, ...rest }: TaskListViewProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  if (!sortable) {
    return (
      <ul className="space-y-0.5">
        {tasks.map((task) => (
          <TaskRow key={task.id} {...rest} task={task} list={listFor(task)} />
        ))}
      </ul>
    );
  }

  const ids = tasks.map((t) => t.id);
  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const from = ids.indexOf(String(active.id));
    const to = ids.indexOf(String(over.id));
    if (from < 0 || to < 0) return;
    onReorder(arrayMove(ids, from, to));
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <ul className="space-y-0.5">
          {tasks.map((task) => (
            <SortableRow key={task.id} {...rest} task={task} listFor={listFor} />
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  );
}
