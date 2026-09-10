import type { AgendaActivity, SpellingIssue } from '@/types/agenda';

export interface ReplacementRule {
  pattern: RegExp;
  replacement: string;
  explanation: string;
}

export const PT_BR_RULES: ReplacementRule[] = [
  // Erros de digitação com números / OCR encontrados nas agendas
  { pattern: /\b0rganiza[çc][ãa]o\b/gi, replacement: 'Organização', explanation: 'Número 0 digitado no lugar da letra O' },
  { pattern: /\b0rganizaço\b/gi, replacement: 'Organização', explanation: 'Grafia incorreta e número 0' },
  { pattern: /\b0rganiza\b/gi, replacement: 'Organiza', explanation: 'Número 0 digitado no lugar da letra O' },
  { pattern: /\bADMINISTRATIV0\b/g, replacement: 'ADMINISTRATIVO', explanation: 'Número 0 no final da palavra' },
  { pattern: /\bdesfilie\b/gi, replacement: 'desfile', explanation: 'Erro de digitação' },
  { pattern: /\bco Psic[oó]logo\b/gi, replacement: 'com Psicólogo', explanation: 'Falta da consoante "m"' },
  { pattern: /\bFERAIADO\b/gi, replacement: 'FERIADO', explanation: 'Erro de digitação de "Feriado"' },
  { pattern: /\bCONTINUADDA\b/gi, replacement: 'CONTINUADA', explanation: 'Letra D duplicada' },
  { pattern: /\bnescess[aá]rio\b/gi, replacement: 'necessário', explanation: 'Grafia correta: "necessário"' },
  { pattern: /\bnescess[aá]ria\b/gi, replacement: 'necessária', explanation: 'Grafia correta: "necessária"' },
  { pattern: /\bnescess[aá]rios\b/gi, replacement: 'necessários', explanation: 'Grafia correta: "necessários"' },
  { pattern: /\bnescess[aá]rias\b/gi, replacement: 'necessárias', explanation: 'Grafia correta: "necessárias"' },
  { pattern: /\bOreinadora\b/gi, replacement: 'Orientadora', explanation: 'Erro de digitação de "Orientadora"' },
  { pattern: /\bOrientora\b/gi, replacement: 'Orientadora', explanation: 'Falta da sílaba "ta"' },
  { pattern: /\bresposaveis\b/gi, replacement: 'responsáveis', explanation: 'Falta da consoante "n"' },
  { pattern: /\brespons[aá]bvel\b/gi, replacement: 'responsável', explanation: 'Erro de digitação com "b"' },
  { pattern: /\bacohida\b/gi, replacement: 'acolhida', explanation: 'Falta da letra "l"' },
  { pattern: /\bnaAvalia[çc][ãa]o\b/gi, replacement: 'na Avaliação', explanation: 'Palavras coladas' },
  { pattern: /\bment[oó]ria gestor\b/gi, replacement: 'mentoria para gestores', explanation: 'Concordância' },
  { pattern: /\bDriv\b/g, replacement: 'Drive', explanation: 'Falta da letra "e"' },

  // Acentuação gráfica essencial do Português Brasileiro (contexto escolar)
  { pattern: /\bCivico\b/g, replacement: 'Cívico', explanation: 'Proparoxítona: exige acento agudo' },
  { pattern: /\bcivico\b/g, replacement: 'cívico', explanation: 'Proparoxítona: exige acento agudo' },
  { pattern: /\bIndependencia\b/g, replacement: 'Independência', explanation: 'Paroxítona terminada em ditongo' },
  { pattern: /\bindependencia\b/g, replacement: 'independência', explanation: 'Paroxítona terminada em ditongo' },
  { pattern: /\bPsicologo\b/g, replacement: 'Psicólogo', explanation: 'Proparoxítona: exige acento agudo' },
  { pattern: /\bpsicologo\b/g, replacement: 'psicólogo', explanation: 'Proparoxítona: exige acento agudo' },
  { pattern: /\bresponsaveis\b/g, replacement: 'responsáveis', explanation: 'Paroxítona terminada em ditongo' },
  { pattern: /\bresponsavel\b/g, replacement: 'responsável', explanation: 'Paroxítona terminada em L' },
  { pattern: /\bInfrequencia\b/g, replacement: 'Infrequência', explanation: 'Paroxítona terminada em ditongo' },
  { pattern: /\binfrequencia\b/g, replacement: 'infrequência', explanation: 'Paroxítona terminada em ditongo' },
  { pattern: /\bFrequencia\b/g, replacement: 'Frequência', explanation: 'Paroxítona terminada em ditongo' },
  { pattern: /\bfrequencia\b/g, replacement: 'frequência', explanation: 'Paroxítona terminada em ditongo' },
  { pattern: /\bpedagogico\b/g, replacement: 'pedagógico', explanation: 'Proparoxítona: exige acento agudo' },
  { pattern: /\bPedagogico\b/g, replacement: 'Pedagógico', explanation: 'Proparoxítona: exige acento agudo' },
  { pattern: /\bpedagogica\b/g, replacement: 'pedagógica', explanation: 'Proparoxítona: exige acento agudo' },
  { pattern: /\bPedagogica\b/g, replacement: 'Pedagógica', explanation: 'Proparoxítona: exige acento agudo' },
  { pattern: /\bhorario\b/g, replacement: 'horário', explanation: 'Paroxítona terminada em ditongo' },
  { pattern: /\bHorario\b/g, replacement: 'Horário', explanation: 'Paroxítona terminada em ditongo' },
  { pattern: /\breuniao\b/g, replacement: 'reunião', explanation: 'Exige til no ditongo nasal' },
  { pattern: /\bReuniao\b/g, replacement: 'Reunião', explanation: 'Exige til no ditongo nasal' },
  { pattern: /\breunioes\b/g, replacement: 'reuniões', explanation: 'Exige til no ditongo nasal' },
  { pattern: /\bReunioes\b/g, replacement: 'Reuniões', explanation: 'Exige til no ditongo nasal' },
  { pattern: /\bavaliacao\b/g, replacement: 'avaliação', explanation: 'Exige cedilha e til' },
  { pattern: /\bAvaliacao\b/g, replacement: 'Avaliação', explanation: 'Exige cedilha e til' },
  { pattern: /\bavaliacoes\b/g, replacement: 'avaliações', explanation: 'Exige cedilha e til' },
  { pattern: /\bAvaliacoes\b/g, replacement: 'Avaliações', explanation: 'Exige cedilha e til' },
  { pattern: /\bcoordenacao\b/g, replacement: 'coordenação', explanation: 'Exige cedilha e til' },
  { pattern: /\bCoordenacao\b/g, replacement: 'Coordenação', explanation: 'Exige cedilha e til' },
  { pattern: /\bcoordenador\b/g, replacement: 'coordenador', explanation: 'Grafia' },
  { pattern: /\bdirecao\b/g, replacement: 'direção', explanation: 'Exige cedilha e til' },
  { pattern: /\bDirecao\b/g, replacement: 'Direção', explanation: 'Exige cedilha e til' },
  { pattern: /\brelatorio\b/g, replacement: 'relatório', explanation: 'Paroxítona terminada em ditongo' },
  { pattern: /\bRelatorio\b/g, replacement: 'Relatório', explanation: 'Paroxítona terminada em ditongo' },
  { pattern: /\bmatricula\b/g, replacement: 'matrícula', explanation: 'Proparoxítona' },
  { pattern: /\bMatricula\b/g, replacement: 'Matrícula', explanation: 'Proparoxítona' },
  { pattern: /\bpublico\b/g, replacement: 'público', explanation: 'Proparoxítona' },
  { pattern: /\bPublico\b/g, replacement: 'Público', explanation: 'Proparoxítona' },
  { pattern: /\bdeclaracao\b/g, replacement: 'declaração', explanation: 'Exige cedilha e til' },
  { pattern: /\bDeclaracao\b/g, replacement: 'Declaração', explanation: 'Exige cedilha e til' },
  { pattern: /\bcomunicacao\b/g, replacement: 'comunicação', explanation: 'Exige cedilha e til' },
  { pattern: /\bComunicacao\b/g, replacement: 'Comunicação', explanation: 'Exige cedilha e til' },
  { pattern: /\bjuri\b/gi, replacement: 'júri', explanation: 'Paroxítona terminada em I exige acento agudo' },
  { pattern: /\bJuri\b/g, replacement: 'Júri', explanation: 'Paroxítona terminada em I exige acento agudo' },
  { pattern: /\bsaude\b/gi, replacement: 'saúde', explanation: 'Hiato: o "u" tônico isolado recebe acento' },
  { pattern: /\bSaude\b/g, replacement: 'Saúde', explanation: 'Hiato: o "u" tônico isolado recebe acento' },
  { pattern: /\bmedico\b/g, replacement: 'médico', explanation: 'Proparoxítona' },
  { pattern: /\bMedico\b/g, replacement: 'Médico', explanation: 'Proparoxítona' },
  { pattern: /\batestado mdico\b/gi, replacement: 'atestado médico', explanation: 'Falta da letra "e" e acento' },
  { pattern: /\bAtestado Mdico\b/g, replacement: 'Atestado Médico', explanation: 'Falta da letra "e" e acento' },

  // Formatações e pontuações
  { pattern: /\bsegunda feira\b/gi, replacement: 'segunda-feira', explanation: 'Dias da semana exigem hífen' },
  { pattern: /\bSegunda feira\b/g, replacement: 'Segunda-feira', explanation: 'Dias da semana exigem hífen' },
  { pattern: /\bterca feira\b/gi, replacement: 'terça-feira', explanation: 'Dias da semana exigem hífen e cedilha' },
  { pattern: /\bTerça feira\b/g, replacement: 'Terça-feira', explanation: 'Dias da semana exigem hífen' },
  { pattern: /\bquarta feira\b/gi, replacement: 'quarta-feira', explanation: 'Dias da semana exigem hífen' },
  { pattern: /\bQuarta feira\b/g, replacement: 'Quarta-feira', explanation: 'Dias da semana exigem hífen' },
  { pattern: /\bquinta feira\b/gi, replacement: 'quinta-feira', explanation: 'Dias da semana exigem hífen' },
  { pattern: /\bQuinta feira\b/g, replacement: 'Quinta-feira', explanation: 'Dias da semana exigem hífen' },
  { pattern: /\bsexta feira\b/gi, replacement: 'sexta-feira', explanation: 'Dias da semana exigem hífen' },
  { pattern: /\bSexta feira\b/g, replacement: 'Sexta-feira', explanation: 'Dias da semana exigem hífen' },
];

/**
 * Scans a text string against Brazilian Portuguese rules and returns detected issues
 */
export function scanTextForSpelling(
  text: string,
  activityId: number | string,
  field: 'titulo' | 'descricao'
): SpellingIssue[] {
  if (!text) return [];

  const issues: SpellingIssue[] = [];

  for (const rule of PT_BR_RULES) {
    const matches = Array.from(text.matchAll(new RegExp(rule.pattern, 'g')));
    for (const match of matches) {
      if (match.index === undefined) continue;

      const originalWord = match[0];
      // Skip if identical
      if (originalWord === rule.replacement) continue;

      // Extract a snippet of context around the error (approx 25 chars before and after)
      const start = Math.max(0, match.index - 20);
      const end = Math.min(text.length, match.index + originalWord.length + 20);
      let context = text.slice(start, end).replace(/\n/g, ' ');
      if (start > 0) context = '...' + context;
      if (end < text.length) context = context + '...';

      issues.push({
        id: `${activityId}-${field}-${match.index}-${originalWord}`,
        activityId,
        field,
        originalWord,
        suggestedWord: rule.replacement,
        context,
        explanation: rule.explanation
      });
    }
  }

  return issues;
}

/**
 * Scans a full list of AgendaActivity items and compiles all spelling issues
 */
export function scanActivitiesForSpelling(activities: AgendaActivity[]): SpellingIssue[] {
  const allIssues: SpellingIssue[] = [];

  for (const act of activities) {
    const titleIssues = scanTextForSpelling(act.titulo, act.id, 'titulo');
    const descIssues = scanTextForSpelling(act.descricao, act.id, 'descricao');
    allIssues.push(...titleIssues, ...descIssues);
  }

  return allIssues;
}

/**
 * Applies a specific replacement to an activity field
 */
export function applySpellingFix(
  activity: AgendaActivity,
  issue: SpellingIssue
): AgendaActivity {
  const fieldKey = issue.field;
  const currentText = activity[fieldKey] || '';

  // Replace only the first occurrence or exact word boundary
  const regex = new RegExp(`\\b${escapeRegExp(issue.originalWord)}\\b`, 'g');
  const newText = currentText.replace(regex, issue.suggestedWord);

  return {
    ...activity,
    [fieldKey]: newText
  };
}

/**
 * Automatically applies all known rules to an activity's title and description
 */
export function autoFixActivity(activity: AgendaActivity): { updated: AgendaActivity; fixedCount: number } {
  let title = activity.titulo || '';
  let desc = activity.descricao || '';
  let fixedCount = 0;

  for (const rule of PT_BR_RULES) {
    if (rule.pattern.test(title)) {
      title = title.replace(rule.pattern, rule.replacement);
      fixedCount++;
    }
    if (rule.pattern.test(desc)) {
      desc = desc.replace(rule.pattern, rule.replacement);
      fixedCount++;
    }
  }

  // Basic cleanup: double spaces, trim trailing spaces before semicolons
  desc = desc.replace(/[ \t]+/g, ' ').replace(/\s+;/g, ';');
  title = title.replace(/[ \t]+/g, ' ').trim();

  return {
    updated: {
      ...activity,
      titulo: title,
      descricao: desc,
      erro_ortografico: []
    },
    fixedCount
  };
}

/**
 * Automatically fixes all activities in batch
 */
export function autoFixAllActivities(
  activities: AgendaActivity[]
): { updated: AgendaActivity[]; totalFixed: number } {
  let totalFixed = 0;
  const updated = activities.map(act => {
    const result = autoFixActivity(act);
    totalFixed += result.fixedCount;
    return result.updated;
  });

  return { updated, totalFixed };
}

function escapeRegExp(string: string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
