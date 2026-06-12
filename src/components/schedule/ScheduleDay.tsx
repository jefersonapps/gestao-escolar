import { memo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { ScheduleCell } from './ScheduleCell';
import type { DayConfig, ClassGroup, Lesson, Subject } from '@/types';

interface ScheduleDayProps {
  day: DayConfig;
  filteredClasses: ClassGroup[];
  lessonMap: Map<string, Lesson>;
  subjects: Subject[];
  onSlotClick: (classId: string, dayId: string, slotId: string) => void;
}

export const ScheduleDay = memo(({ 
  day, 
  filteredClasses, 
  lessonMap, 
  subjects, 
  onSlotClick 
}: ScheduleDayProps) => {
  const dayName = ['Domingo','Segunda-feira','Terça-feira','Quarta-feira','Quinta-feira','Sexta-feira','Sábado'][day.dayOfWeek];

  // Helper to get lesson from map
  const getLesson = (classId: string, dayId: string, slotId: string) => {
    return lessonMap.get(`${classId}|${dayId}|${slotId}`);
  };

  const getSubject = (id: string) => subjects.find(s => s.id === id);

  return (
    <Card className="overflow-hidden">
      <div className="bg-primary/5 border-b p-3 flex justify-between items-center">
        <h3 className="font-bold text-lg">{dayName}</h3>
      </div>
      <CardContent className="p-0">
        <ScrollArea className="w-full whitespace-nowrap">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="p-2 border-r w-24 text-center sticky left-0 bg-muted/50 z-10">Horário</th>
                <th className="p-2 border-r w-16 text-center sticky left-24 bg-muted/50 z-10">Aula</th>
                {filteredClasses.map(cls => (
                  <th key={cls.id} className="p-2 border-r min-w-[140px] text-center font-bold text-muted-foreground/80">
                    {cls.name.split(' - ')[0]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {day.slots.map((slot, slotIndex) => {
                const isInterval = !!slot.isInterval; // Force boolean
                
                // Calculate Lesson Number
                const lessonNumber = day.slots
                  .slice(0, slotIndex)
                  .filter(s => !s.isInterval).length + 1;

                return (
                  <tr key={slot.id} className="border-b last:border-0 hover:bg-muted/5">
                    {/* Time Column */}
                    <td className="p-2 border-r text-center font-mono text-xs text-muted-foreground sticky left-0 bg-background z-10">
                      {slot.startTime} - {slot.endTime}
                    </td>

                    {/* Lesson Number Column */}
                    <td className="p-2 border-r text-center font-medium text-xs text-muted-foreground sticky left-24 bg-background z-10">
                      {isInterval ? '-' : `${lessonNumber}ª`}
                    </td>

                    {/* Class Columns */}
                    {filteredClasses.map(cls => {
                      // Get lesson and subject for this cell
                      // We do this here to pass down to the memoized cell
                      const lesson = !isInterval ? getLesson(cls.id, day.id, slot.id) : undefined;
                      const subject = lesson ? getSubject(lesson.subjectId) : undefined;

                      return (
                        <ScheduleCell 
                          key={`${cls.id}-${day.id}-${slot.id}`}
                          classId={cls.id}
                          dayId={day.id}
                          slotId={slot.id}
                          lesson={lesson}
                          subject={subject}
                          isInterval={isInterval}
                          onClick={onSlotClick}
                        />
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </CardContent>
    </Card>
  );
}, (prev, next) => {
    // Only re-render if:
    // 1. Day config changes (unlikely dynamic)
    // 2. Filtered classes list changes
    // 3. Lesson map changes (this is the big one)
    // 4. Subjects list changes
   
    if (prev.day !== next.day) return false;
    if (prev.filteredClasses !== next.filteredClasses) return false;
    if (prev.lessonMap !== next.lessonMap) return false;
    if (prev.subjects !== next.subjects) return false;

    return true;
});

ScheduleDay.displayName = 'ScheduleDay';
