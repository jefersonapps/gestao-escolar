import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { SchoolConfig, Professor, Subject, ClassGroup, Lesson, DayConfig, Stage } from '../types';
import { v4 as uuidv4 } from 'uuid';

interface AppState {
  schoolConfig: SchoolConfig;
  professors: Professor[];
  subjects: Subject[];
  classes: ClassGroup[];
  lessons: Lesson[];
  stages: Stage[];
  externalSessions: Record<string, import('../types/auth').ExternalUser | null>;
  scheduleViewState: {
    selectedStageId: string;
    selectedClassId: string;
  };
  isSGEduLoginOpen: boolean;
  isSaevLoginOpen: boolean;
  
  // Actions
  setSGEduLoginOpen: (isOpen: boolean) => void;
  setSaevLoginOpen: (isOpen: boolean) => void;
  setExternalSession: (system: string, user: import('../types/auth').ExternalUser | null) => void;
  setScheduleViewState: (state: { selectedStageId: string; selectedClassId: string }) => void;
  logoutExternalSystem: (system: string) => void;
  updateClassStudents: (classId: string, students: import('../types').Student[]) => void;
  transferStudent: (studentId: string, fromClassId: string, toClassId: string) => void;
  
  // Actions
  setLessons: (lessons: Lesson[]) => void;
  upsertLesson: (lesson: Omit<Lesson, 'id'>) => void;
  removeLesson: (classId: string, dayId: string, slotId: string) => void;
  setSchoolName: (name: string) => void;
  updateDayConfig: (dayId: string, updates: Partial<DayConfig>) => void;
  
  addSubject: (subject: Omit<Subject, 'id'>) => void;
  updateSubject: (id: string, updates: Partial<Subject>) => void;
  deleteSubject: (id: string) => void;

  addProfessor: (professor: Omit<Professor, 'id'>) => void;
  updateProfessor: (id: string, updates: Partial<Professor>) => void;
  deleteProfessor: (id: string) => void;
  clearProfessors: () => void;

  addClassGroup: (group: Omit<ClassGroup, 'id'>) => void;
  deleteClassGroup: (id: string) => void;
  updateClassGroup: (id: string, updates: Partial<ClassGroup>) => void;

  addStage: (stage: Omit<Stage, 'id'>) => void;
  updateStage: (id: string, updates: Partial<Stage>) => void;
  deleteStage: (id: string) => void;

  resetData: () => void;
  loadData: (data: Partial<AppState>) => void;
}

const DEFAULT_DAYS: DayConfig[] = [
  { id: 'mon', dayOfWeek: 1, enabled: true, slots: [] },
  { id: 'tue', dayOfWeek: 2, enabled: true, slots: [] },
  { id: 'wed', dayOfWeek: 3, enabled: true, slots: [] },
  { id: 'thu', dayOfWeek: 4, enabled: true, slots: [] },
  { id: 'fri', dayOfWeek: 5, enabled: true, slots: [] },
];

export const useStore = create<AppState>()(
  persist(
    (set) => ({
      schoolConfig: {
        name: 'Minha Escola',
        days: DEFAULT_DAYS,
        minTime: '07:00',
        maxTime: '18:00',
      },
      professors: [],
      subjects: [],
      classes: [],
      lessons: [],
      stages: [],

      setSchoolName: (name) => 
        set((state) => ({ schoolConfig: { ...state.schoolConfig, name } })),

      updateDayConfig: (dayId, updates) =>
        set((state) => ({
          schoolConfig: {
            ...state.schoolConfig,
            days: state.schoolConfig.days.map((d) => 
              d.id === dayId ? { ...d, ...updates } : d
            ),
          },
        })),

      addSubject: (subject) =>
        set((state) => ({ subjects: [...state.subjects, { ...subject, id: uuidv4() }] })),
      updateSubject: (id, updates) =>
        set((state) => ({
          subjects: state.subjects.map((s) => (s.id === id ? { ...s, ...updates } : s)),
        })),
      deleteSubject: (id) =>
        set((state) => ({ subjects: state.subjects.filter((s) => s.id !== id) })),

      addProfessor: (professor) =>
        set((state) => ({ professors: [...state.professors, { ...professor, id: uuidv4() }] })),
      updateProfessor: (id, updates) =>
        set((state) => ({
          professors: state.professors.map((p) => (p.id === id ? { ...p, ...updates } : p)),
        })),
  deleteProfessor: (id) =>
    set((state) => ({ professors: state.professors.filter((p) => p.id !== id) })),
  clearProfessors: () => set({ professors: [] }),

      addClassGroup: (group) =>
        set((state) => ({ classes: [...state.classes, { ...group, id: uuidv4() }] })),
      deleteClassGroup: (id) =>
        set((state) => ({ classes: state.classes.filter((c) => c.id !== id) })),
      updateClassGroup: (id, updates) =>
        set((state) => ({
          classes: state.classes.map((c) => (c.id === id ? { ...c, ...updates } : c)),
        })),

      addStage: (stage) =>
        set((state) => ({ stages: [...state.stages, { ...stage, id: uuidv4() }] })),
      updateStage: (id, updates) =>
        set((state) => ({
          stages: state.stages.map((s) => (s.id === id ? { ...s, ...updates } : s)),
        })),
      deleteStage: (id) =>
        set((state) => ({ 
            stages: state.stages.filter((s) => s.id !== id),
            // Optional: Unlink classes? Keeping it simple for now.
            classes: state.classes.map(c => c.stageId === id ? { ...c, stageId: undefined } : c)
        })),

      setLessons: (lessons: Lesson[]) => set({ lessons }),
      
      upsertLesson: (lesson: Omit<Lesson, 'id'>) => set((state) => {
        const index = state.lessons.findIndex(
          l => l.classGroupId === lesson.classGroupId && 
               l.dayId === lesson.dayId && 
               l.slotId === lesson.slotId
        );
        
        if (index >= 0) {
          // Update existing
          const newLessons = [...state.lessons];
          newLessons[index] = { ...newLessons[index], ...lesson };
          return { lessons: newLessons };
        } else {
          // Add new
          return { lessons: [...state.lessons, { ...lesson, id: uuidv4() }] };
        }
      }),

      removeLesson: (classId: string, dayId: string, slotId: string) => set((state) => ({
        lessons: state.lessons.filter(
          l => !(l.classGroupId === classId && l.dayId === dayId && l.slotId === slotId)
        )
      })),

      externalSessions: {},
      isSGEduLoginOpen: false,
      isSaevLoginOpen: false,
      scheduleViewState: { selectedStageId: 'all', selectedClassId: 'all' },
      setSGEduLoginOpen: (isOpen) => set({ isSGEduLoginOpen: isOpen }),
      setSaevLoginOpen: (isOpen) => set({ isSaevLoginOpen: isOpen }),
      setExternalSession: (system, user) => set((state) => ({ 
          externalSessions: { ...state.externalSessions, [system]: user } 
      })),
      setScheduleViewState: (viewState) => set({ scheduleViewState: viewState }),
      logoutExternalSystem: (system) => set((state) => ({ 
          externalSessions: { ...state.externalSessions, [system]: null } 
      })),
      
      updateClassStudents: (classId, students) => set((state) => ({
        classes: state.classes.map(c => 
          c.id === classId ? { ...c, students } : c
        )
      })),

      transferStudent: (studentId, fromClassId, toClassId) => set((state) => {
          let studentToMove: import('../types').Student | undefined;
          
          // First pass: find the student and remove from origin class
          const updatedClasses = state.classes.map(c => {
              if (c.id === fromClassId) {
                  const students = c.students || [];
                  studentToMove = students.find(s => s.id === studentId);
                  if (studentToMove) {
                      return { ...c, students: students.filter(s => s.id !== studentId) };
                  }
              }
              return c;
          });

          // Second pass: add student to destination class IF found
          if (studentToMove) {
              return {
                  classes: updatedClasses.map(c => {
                      if (c.id === toClassId) {
                          const students = c.students || [];
                          // Avoid duplicates
                          if (!students.some(s => s.id === studentId)) {
                              const newStudents = [...students, studentToMove!];
                              newStudents.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'pt-BR'));
                              return { ...c, students: newStudents };
                          }
                      }
                      return c;
                  })
              };
          }

          return { classes: state.classes }; // No changes if student not found
      }),

      resetData: () => set({ professors: [], subjects: [], classes: [], lessons: [], stages: [], externalSessions: {} }),
      
      loadData: (data: Partial<AppState>) => set((state) => ({
        ...state,
        ...data,
        // Preserve session and view state if not explicitly desired (usually we don't want to overwrite session)
        externalSessions: state.externalSessions, 
        scheduleViewState: state.scheduleViewState
      })),
    }),
    {
      name: 'school-scheduler-storage',
      storage: createJSONStorage(() => localStorage),
    }
  )
);
