import type { SchoolConfig, Professor, ClassGroup, Subject, Lesson, ScheduleConflict, Stage, TimeSlot } from '@/types';

interface GeneratorInput {
  schoolConfig: SchoolConfig;
  professors: Professor[];
  subjects: Subject[];
  classes: ClassGroup[];
  stages: Stage[];
  existingLessons?: Lesson[];
  // overlapMap is calculated internally and passed to worker
}

interface WorkerInput extends GeneratorInput {
    overlapMap: Record<string, string[]>;
    slotToDayId: Record<string, string>;
}

const checkTimeOverlap = (s1: TimeSlot, s2: TimeSlot): boolean => {
    const toMin = (t: string) => {
        const [h, m] = t.split(':').map(Number);
        return h * 60 + m;
    }
    const start1 = toMin(s1.startTime);
    const end1 = toMin(s1.endTime);
    const start2 = toMin(s2.startTime);
    const end2 = toMin(s2.endTime);

    // Standard overlap check: (StartA < EndB) && (EndA > StartB)
    return start1 < end2 && end1 > start2;
}

export const generateSchedule = (
  input: GeneratorInput, 
  onProgress?: (data: { generation: number, fitness: number }) => void
): Promise<{ result: Lesson[], conflicts: ScheduleConflict[] }> => {
  return new Promise((resolve, reject) => {
    // Calculate Overlap Map
    const allSlots: { dayId: string, dayOfWeek: number, slot: TimeSlot }[] = [];
    const slotToDayId: Record<string, string> = {};
    
    // Global slots
    input.schoolConfig.days.forEach(d => {
        if (d.enabled) {
            d.slots.forEach(s => {
                if (!s.isInterval) {
                    allSlots.push({ dayId: d.id, dayOfWeek: d.dayOfWeek, slot: s });
                    slotToDayId[s.id] = d.id;
                }
            });
        }
    });

    // Stage slots (only if they have custom days)
    input.stages.forEach(st => {
        st.days?.forEach(d => {
             if (d.enabled) {
                 d.slots.forEach(s => {
                     if (!s.isInterval) {
                         allSlots.push({ dayId: d.id, dayOfWeek: d.dayOfWeek, slot: s });
                         slotToDayId[s.id] = d.id;
                     }
                 });
             }
        });
    });

    const overlapMap: Record<string, string[]> = {};
    
    // Initialize empty arrays
    allSlots.forEach(item => {
        if (!overlapMap[item.slot.id]) overlapMap[item.slot.id] = [];
    });

    // Brute-force N^2 check (N is small, < 1000 slots usually)
    for (let i = 0; i < allSlots.length; i++) {
        const item1 = allSlots[i];
        for (let j = i + 1; j < allSlots.length; j++) {
            const item2 = allSlots[j];
            
            // Check implicit Day of Week match + Time Overlap
            if (item1.dayOfWeek === item2.dayOfWeek && checkTimeOverlap(item1.slot, item2.slot)) {
                overlapMap[item1.slot.id].push(item2.slot.id);
                overlapMap[item2.slot.id].push(item1.slot.id);
            }
        }
    }

    // Instantiate the worker
    const worker = new Worker(new URL('../workers/schedule.worker.ts', import.meta.url), {
      type: 'module',
    });

    worker.onmessage = (e) => {
      const { type, payload } = e.data;
      
      if (type === 'progress') {
          if (onProgress) onProgress(payload);
          return; 
      }

      if (type === 'done') {
          const { result, conflicts } = payload;
          resolve({ result, conflicts });
          worker.terminate();
      }
    };

    worker.onerror = (err) => {
      console.error('Worker error:', err);
      reject(err);
      worker.terminate();
    };

    // Send data
    const workerInput: WorkerInput = { ...input, overlapMap, slotToDayId };
    worker.postMessage(workerInput);
  });
};
