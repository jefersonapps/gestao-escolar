import { memo } from 'react';
import type { Subject, Lesson } from '@/types';

interface ScheduleCellProps {
  classId: string;
  dayId: string;
  slotId: string;
  lesson?: Lesson;
  subject?: Subject;
  isInterval: boolean;
  onClick: (classId: string, dayId: string, slotId: string) => void;
}

import { useDraggable, useDroppable } from '@dnd-kit/core';

export const ScheduleCell = memo(({ 
  classId, 
  dayId, 
  slotId, 
  lesson, 
  subject, 
  isInterval, 
  onClick 
}: ScheduleCellProps) => {
  
  const cellId = `cell|${classId}|${dayId}|${slotId}`;

  const { isOver,setNodeRef: setDroppableRef } = useDroppable({
    id: cellId,
    data: { classId, dayId, slotId }
  });

  const { attributes, listeners, setNodeRef: setDraggableRef, transform, isDragging } = useDraggable({
    id: cellId,
    data: { classId, dayId, slotId, lesson },
    disabled: !lesson || isInterval
  });

  const style = transform ? {
    transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
    zIndex: 50,
    opacity: isDragging ? 0.5 : 1,
  } : undefined;

  if (isInterval) {
    return (
      <td className="p-1 border-r bg-yellow-500/10 text-center font-bold text-yellow-600 dark:text-yellow-400 text-[10px] py-1 uppercase tracking-wider">
        Intervalo
      </td>
    );
  }

  return (
    <td 
      ref={setDroppableRef}
      className={`p-1 border-r h-[50px] relative group cursor-pointer transition-colors ${isOver ? 'bg-primary/20' : 'hover:bg-muted/10'}`}
      onClick={() => onClick(classId, dayId, slotId)}
    >
      {lesson ? (
        <div 
          ref={setDraggableRef}
          {...listeners}
          {...attributes}
          className="absolute inset-1 rounded p-1 text-center shadow-sm flex flex-col justify-center items-center gap-0.5 border-l-4 overflow-hidden touch-none"
          style={{ 
            backgroundColor: subject?.color ? subject.color + '1a' : undefined, 
            borderLeftColor: subject?.color,
            ...style
          }}
        >
          <span className="font-bold text-xs leading-none select-none truncate w-full" title={subject?.name}>
            {subject?.name}
          </span>
        </div>
      ) : (
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="w-6 h-6 rounded-full bg-muted/20 flex items-center justify-center text-muted-foreground/50 text-lg">
            +
          </div>
        </div>
      )}
    </td>
  );
}, (prev, next) => {
  // Custom comparison
  const lessonChanged = prev.lesson !== next.lesson;
  const subjectChanged = prev.subject !== next.subject;
  const intervalChanged = prev.isInterval !== next.isInterval;
  
  return !lessonChanged && !subjectChanged && !intervalChanged;
});

ScheduleCell.displayName = 'ScheduleCell';
