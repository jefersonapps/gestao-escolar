import type { TimeSlot } from '@/types';

// Helper to convert "HH:MM" to minutes from midnight
const toMinutes = (time: string) => {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
};

export const hasOverlap = (slot1: TimeSlot, slot2: TimeSlot) => {
  const start1 = toMinutes(slot1.startTime);
  const end1 = toMinutes(slot1.endTime);
  const start2 = toMinutes(slot2.startTime);
  const end2 = toMinutes(slot2.endTime);

  return start1 < end2 && start2 < end1;
};

// Check if a professor is available at a given day/slot
// We use dayId + slotId as the key
export const isProfessorAvailable = (
  professor: { unavailableSlots: string[] },
  dayId: string,
  slotId: string
): boolean => {
  const key = `${dayId}|${slotId}`;
  return !professor.unavailableSlots.includes(key);
};
