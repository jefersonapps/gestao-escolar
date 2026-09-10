export interface AgendaActivity {
  id: number | string;
  data: string;          // DD/MM/YYYY
  data_iso: string;      // YYYY-MM-DD
  dia_semana: string;    // Segunda-feira, Terça-feira, etc.
  categoria: string;     // Demanda Pedagógica e Administrativa, Feriado, etc.
  titulo: string;
  descricao: string;
  local: string;         // SEDUC, UMEIEF GONÇALA RODRIGUES DE FREITAS, etc.
  origem_arquivo: string;
  selecionado: boolean;
  concluido?: boolean;
  erro_ortografico?: string[];
}

export interface SpellingIssue {
  id: string;
  activityId: number | string;
  field: 'titulo' | 'descricao';
  originalWord: string;
  suggestedWord: string;
  context: string;
  explanation?: string;
}

export interface AgendaStats {
  total: number;
  selected: number;
  completed: number;
  pending: number;
  weeksCount: number;
  spellingIssuesCount: number;
}

export interface ExtractedWeekGroup {
  weekKey: string;      // e.g. "18/05/2026 a 22/05/2026"
  filename: string;
  startDate: string;
  endDate: string;
  activities: AgendaActivity[];
}
