export interface TimeSlot {
  id: string;
  startTime: string; // "07:00"
  endTime: string;   // "07:45"
  isInterval?: boolean;
}

export interface DayConfig {
  id: string; // "monday"
  dayOfWeek: number; // 0-6 (Sunday-Saturday)
  enabled: boolean;
  defaultLessonDuration?: number; // minutes, default 45 or 50
  slots: TimeSlot[];
}

export interface SchoolConfig {
  name: string;
  days: DayConfig[];
  minTime: string; // "07:00"
  maxTime: string; // "23:00"
}

export interface Subject {
  id: string;
  name: string;
  color: string;
  requiresLab?: boolean;
}

export interface Professor {
  id: string;
  name: string;
  subjectIds: string[];
  // Availability grid: array of slot IDs they CANNOT teach
  unavailableSlots: string[]; 
  // Workload Allocations
  allocations: {
    classGroupId: string;
    subjectId: string;
    lessonsPerWeek: number;
    maxDailyLessons: number; // e.g. 2 per day
  }[];
  // Constraints
  minConsecutiveLessons: number;
  maxConsecutiveLessons: number;
  canTeachConsecutive: boolean; // if false, gaps required? Usually we want "max consecutive"
}

export interface Stage {
  id: string;
  name: string;
  color: string;
  days?: DayConfig[]; // Custom schedule for this stage. If undefined, uses global config.
}



export interface Responsible {
  name: string;
  kinship: string; // "Mãe", "Pai", "Responsável"
  cpf?: string;
}

export interface Phone {
  number: string;
  type: string; // "cel", "fixo"
  description: string; // "Mãe", "Pai", "whatsapp"
}

export interface Student {
  id: string; // SGEdu ID
  name: string;
  photoUrl?: string;
  birthDate?: string;
  cpf?: string;
  responsibleName?: string; // Kept for backward compatibility
  responsiblePhone?: string; // Kept for backward compatibility
  responsibles?: Responsible[];
  phones?: Phone[];
  
  // Extended fields for custom tables
  sus?: string; // Cartão SUS
  nis?: string;
  rg?: string;
  naturalness?: string; // Natural de
  sex?: string;
  colorRace?: string; // Cor/Raça
  transport?: boolean; // Usa transporte escolar
  bolsaFamilia?: boolean;
  
  // New columns requested
  matricula?: string;
  educacensoId?: string;
  email?: string;
  address?: string;
  birthCertificate?: string;
  responsibleKinship?: string;
  responsibleCpf?: string;
  responsibleJob?: string;
  fatherName?: string;
  fatherCpf?: string;
  motherName?: string;
  motherCpf?: string;
}

export interface ClassGroup {
  id: string;
  name: string; // "6º A", "7º B"
  stageId?: string;
  sgeduId?: string; // Link to SGEdu class ID
  url?: string; // Full SGEdu URL
  students?: Student[];
  // Specific constraints for this class?
}

// The actual schedule assignment
export interface Lesson {
  id: string;
  classGroupId: string;
  subjectId: string;
  professorId: string | null; // Null if free period/study hall?
  dayId: string;
  slotId: string;
  isLocked?: boolean; // If manually placed
}

export interface ScheduleProblem {
  title: string;
  description: string;
  severity: "error" | "warning";
  relatedIds: string[]; // IDs of lessons/profs involved
}

export interface ScheduleConflict {
    type: 'unavailable' | 'busy' | 'limit_daily' | 'limit_weekly' | 'consecutive';
    professorId: string;
    professorName: string;
    classGroupId: string;
    className: string;
    subjectId: string;
    subjectName: string;
    dayId: string;
    dayName: string;
    slotId: string;
    message: string;
}

export interface PresentationConfig {
  title: string;
  margin: number;
  backgroundColor: string;
}

export interface EvolutionRow {
  edicao: string;
  materia: string;
  participacao: number;
  acertos: number;
}

export interface LevelsSummaryRow {
  edicao: string;
  total_alunos: number;
  fluente: number;
  nao_fluente: number;
  frases: number;
  palavras: number;
  silabas: number;
  nao_leitor: number;
  nao_avaliado: number;
  nao_informado: number;
}

export interface HistoryStudent {
  nome: string;
  results: Record<string, string>;
}

export interface FluencyDetailRow {
  nome: string;
  nivel: string;
  materia?: string;
  media?: string;
  nivelNum?: string;
  questions?: Map<number, { answer: string; correct: boolean }>;
}

export interface ClassData {
  name: string;
  images: { dataUrl: string; width: number; height: number }[];
  csvData: { type: string; data: any[] }[];
}
