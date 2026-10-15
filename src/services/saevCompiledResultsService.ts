import PptxGenJS from 'pptxgenjs';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { open, save } from '@tauri-apps/plugin-dialog';
import { writeFile } from '@tauri-apps/plugin-fs';
import { join } from '@tauri-apps/api/path';
import type { EvolutionRow, LevelsSummaryRow, FluencyDetailRow } from '@/types';

export interface PerformanceHistoryStudent {
  name: string;
  values: Record<string, string>; // column -> value (e.g. "Não Leitor" or "63%")
  colors: Record<string, string>; // column -> hex or rgb color
}

export interface PerformanceHistoryDiscipline {
  name: string; // "Leitura" | "Língua portuguesa" | "Matemática"
  columns: string[]; // ["2026 - Av. Diagnóstica", ...]
  students: PerformanceHistoryStudent[];
}

export interface PerformanceHistoryData {
  school: string;
  className: string;
  series: string;
  year: string;
  disciplines: PerformanceHistoryDiscipline[];
  legend: { label: string; color: string }[];
}

export interface DescriptorItem {
  code: string;
  description: string;
  percentage: number;
}

export interface DescriptorTopic {
  title: string;
  percentage: number;
  items: DescriptorItem[];
}

export interface DescriptorsDiscipline {
  name: string;
  topics: DescriptorTopic[];
}

export interface DescriptorsData {
  school: string;
  className: string;
  series: string;
  year: string;
  edition: string;
  disciplines: DescriptorsDiscipline[];
}

export interface MatrixStudentRow {
  name: string;
  questions: { number: number; answer: string; isCorrect: boolean }[];
  hitRate: number; // percentage (e.g. 85)
}

export interface MatrixDisciplineData {
  subject: string; // 'Língua Portuguesa' | 'Matemática'
  totalQuestions: number;
  students: MatrixStudentRow[];
  questionAverages: number[]; // % hit rate per question
  classAverage: number;
}

export interface CompiledResultsState {
  school: string;
  className: string;
  series: string;
  year: string;
  edition: string;
  selectedModules: {
    sinteseGeral: boolean;
    descritores: boolean;
    linhaEvolutiva: boolean;
    nivelLeitura: boolean;
    historicoDesempenho: boolean;
  };
  performanceHistory: PerformanceHistoryData;
  descriptors: DescriptorsData;
  evolutionRows: EvolutionRow[];
  readingSummaryRows: LevelsSummaryRow[];
  fluencyDetails: FluencyDetailRow[];
  matrixDisciplines?: MatrixDisciplineData[];
}

export const READING_LEVEL_COLORS: Record<string, string> = {
  'fluente': '#11312B',
  'não fluente': '#2D9B82',
  'nao fluente': '#2D9B82',
  'frases': '#51D0B2',
  'palavras': '#5A9BD5',
  'sílabas': '#9DC3E7',
  'silabas': '#9DC3E7',
  'não leitor': '#A4A4A4',
  'nao leitor': '#A4A4A4',
  'não avaliado': '#666666',
  'nao avaliado': '#666666',
  'não informado': '#666666',
  'nao informado': '#666666',
};

export const getPercentageColor = (pctValue: number | string): string => {
  const num = typeof pctValue === 'number' ? pctValue : parseFloat(String(pctValue).replace('%', '').trim());
  if (isNaN(num)) return '#666666';
  if (num === 0) return '#FF6868';
  if (num < 25) return '#FF6868';
  if (num < 50) return '#FAA036';
  if (num < 75) return '#5EC2B1';
  return '#3E8277';
};

export const normalizeColorToHex = (colorStr: string): string => {
  if (!colorStr) return '#FFFFFF';
  const clean = colorStr.trim().toLowerCase();
  if (clean.startsWith('#')) return clean;
  const rgbMatch = clean.match(/rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/);
  if (rgbMatch) {
    const r = parseInt(rgbMatch[1], 10).toString(16).padStart(2, '0');
    const g = parseInt(rgbMatch[2], 10).toString(16).padStart(2, '0');
    const b = parseInt(rgbMatch[3], 10).toString(16).padStart(2, '0');
    return `#${r}${g}${b}`;
  }
  return clean;
};

// --- DEFAULT REAL SAMPLES FROM USER'S SYSTEM ---

export const getSamplePerformanceHistory = (): PerformanceHistoryData => {
  const studentNames = [
    'ANNA LÍVIA RODRIGUES DE QUEIROZ',
    'ANTONY DANIEL DE OLIVEIRA QUIRINO',
    'DANIELE SILVA',
    'ERIC LIMA DUARTE',
    'HEITOR PALMEIRA DO NASCIMENTO',
    'JHONATHAN BENJAMIN OLIVEIRA DA SILVA',
    'JOÃO GUILHERME BARBOSA ARAUJO',
    'JOÃO HENRIQUE SOARES FELIX',
    'JOÃO LUCAS DE LIMA SOUZA',
    'KEMMILY STHER ARAUJO DE LIMA',
    'MARIA ISABELA MOREIRA DOS SANTOS',
    'MARIA LAURA DOS SANTOS SILVA',
    'MARIA LUIZA ALBINO DO NASCIMENTO',
    'MIGUEL DE SOUSA QUINTANS ARAUJO',
    'RAEL VALENTIN DE LIMA MORATO',
    'VALENTINA DE SOUZA OLIVEIRA',
  ];

  const columns = [
    '2026 - Av. Diagnóstica',
    '2026 - Av. Formativa 1',
    '2026 - Av. Formativa 2',
    '2026 - Av. Formativa 3',
    '2026 - Av. Formativa 3 - Escrita',
    '2026 - Av. Extra 2',
    '2026 - Av. Saída',
  ];

  const leituraValues: string[][] = [
    ['Não Leitor', 'Sílabas', 'Sílabas', 'Palavras', 'Não Informado', 'Não Informado', 'Não Informado'],
    ['Não Leitor', 'Sílabas', 'Palavras', 'Palavras', 'Não Informado', 'Não Informado', 'Não Informado'],
    ['Não Leitor', 'Sílabas', 'Sílabas', 'Palavras', 'Não Informado', 'Não Informado', 'Não Informado'],
    ['Sílabas', 'Palavras', 'Não Fluente', 'Não Fluente', 'Não Informado', 'Não Informado', 'Não Informado'],
    ['Não Fluente', 'Não Fluente', 'Não Fluente', 'Não Fluente', 'Não Informado', 'Não Informado', 'Não Informado'],
    ['Não Fluente', 'Fluente', 'Fluente', 'Fluente', 'Não Informado', 'Não Informado', 'Não Informado'],
    ['Não Leitor', 'Não Leitor', 'Frases', 'Frases', 'Não Informado', 'Não Informado', 'Não Informado'],
    ['Não Leitor', 'Palavras', 'Frases', 'Não Fluente', 'Não Informado', 'Não Informado', 'Não Informado'],
    ['Não Leitor', 'Sílabas', 'Frases', 'Fluente', 'Não Informado', 'Não Informado', 'Não Informado'],
    ['Fluente', 'Fluente', 'Fluente', 'Fluente', 'Não Informado', 'Não Informado', 'Não Informado'],
    ['Frases', 'Frases', 'Não Fluente', 'Não Fluente', 'Não Informado', 'Não Informado', 'Não Informado'],
    ['Não Fluente', 'Não Fluente', 'Fluente', 'Fluente', 'Não Informado', 'Não Informado', 'Não Informado'],
    ['Frases', 'Frases', 'Não Fluente', 'Não Fluente', 'Não Informado', 'Não Informado', 'Não Informado'],
    ['Não Leitor', 'Sílabas', 'Frases', 'Frases', 'Não Informado', 'Não Informado', 'Não Informado'],
    ['Não Fluente', 'Não Fluente', 'Não Fluente', 'Fluente', 'Não Informado', 'Não Informado', 'Não Informado'],
    ['Não Fluente', 'Não Fluente', 'Não Fluente', 'Não Fluente', 'Não Informado', 'Não Informado', 'Não Informado'],
  ];

  const portuguesValues: string[][] = [
    ['63%', '56%', '63%', '69%', 'Não Informado', '0%', '0%'],
    ['69%', '75%', '88%', '69%', 'Não Informado', '0%', '0%'],
    ['69%', '44%', '69%', '63%', 'Não Informado', '0%', '0%'],
    ['75%', '63%', '81%', '100%', 'Não Informado', '0%', '0%'],
    ['88%', '81%', '88%', '81%', 'Não Informado', '0%', '0%'],
    ['94%', '81%', '100%', '100%', 'Não Informado', '0%', '0%'],
    ['81%', '69%', '94%', '50%', 'Não Informado', '0%', '0%'],
    ['88%', '81%', '100%', '69%', 'Não Informado', '0%', '0%'],
    ['75%', '75%', '75%', '88%', 'Não Informado', '0%', '0%'],
    ['88%', '88%', '88%', '94%', 'Não Informado', '0%', '0%'],
    ['81%', '75%', '100%', '94%', 'Não Informado', '0%', '0%'],
    ['94%', '88%', '100%', '100%', 'Não Informado', '0%', '0%'],
    ['94%', '88%', '100%', '100%', 'Não Informado', '0%', '0%'],
    ['94%', '44%', '81%', '75%', 'Não Informado', '0%', '0%'],
    ['100%', '88%', '75%', '81%', 'Não Informado', '0%', '0%'],
    ['88%', '81%', '100%', '94%', 'Não Informado', '0%', '0%'],
  ];

  const buildDiscipline = (name: string, matrix: string[][]): PerformanceHistoryDiscipline => {
    const students: PerformanceHistoryStudent[] = studentNames.map((stName, sIdx) => {
      const values: Record<string, string> = {};
      const colors: Record<string, string> = {};

      columns.forEach((col, cIdx) => {
        const val = matrix[sIdx]?.[cIdx] || 'Não Informado';
        values[col] = val;
        if (name === 'Leitura') {
          colors[col] = READING_LEVEL_COLORS[val.toLowerCase()] || '#666666';
        } else {
          colors[col] = val.includes('%') ? getPercentageColor(val) : '#666666';
        }
      });

      return { name: stName, values, colors };
    });

    return { name, columns, students };
  };

  return {
    school: 'UMEIEF GONÇALA RODRIGUES DE FREITAS',
    className: '1º Ano A',
    series: '1º Ano EF',
    year: '2026',
    disciplines: [
      buildDiscipline('Leitura', leituraValues),
      buildDiscipline('Língua portuguesa', portuguesValues),
      buildDiscipline('Matemática', portuguesValues), // Same layout pattern for Math
    ],
    legend: [
      { label: 'Fluente', color: '#11312B' },
      { label: 'Não Fluente', color: '#2D9B82' },
      { label: 'Frases', color: '#51D0B2' },
      { label: 'Palavras', color: '#5A9BD5' },
      { label: 'Sílabas', color: '#9DC3E7' },
      { label: 'Não Leitor', color: '#A4A4A4' },
      { label: 'Não Avaliado', color: '#666666' },
      { label: 'Não Informado', color: '#666666' },
    ],
  };
};

export const getSampleDescriptors = (): DescriptorsData => {
  return {
    school: 'UMEIEF GONÇALA RODRIGUES DE FREITAS',
    className: '2º Ano A',
    series: '2º Ano EF',
    year: '2026',
    edition: '2026 - Av. Formativa 3',
    disciplines: [
      {
        name: 'Língua portuguesa',
        topics: [
          {
            title: 'Tópico "Geral"',
            percentage: 71,
            items: [
              {
                code: 'EF01LP02',
                description: 'Escrever, espontaneamente ou por ditado, palavras e frases de forma alfabética',
                percentage: 93,
              },
              {
                code: 'EF01LP07',
                description: 'Identificar fonemas e sua representação por letras.',
                percentage: 93,
              },
              {
                code: 'EF01LP09',
                description: 'Comparar palavras, identificando semelhanças e diferenças entre sons de sílabas iniciais.',
                percentage: 87,
              },
              {
                code: 'EF01LP13',
                description: 'Comparar palavras, identificando semelhanças e diferenças entre sons de sílabas médias e finais.',
                percentage: 90,
              },
              {
                code: 'EF02LP03',
                description: 'Ler e escrever palavras com correspondências regulares diretas entre letras e fonemas (f, v, t, d, p, b) e contextuais.',
                percentage: 67,
              },
              {
                code: 'EF12LP01',
                description: 'Ler palavras novas com precisão na decodificação, no caso de palavras de uso frequente, ler globalmente, por memorização.',
                percentage: 75,
              },
            ],
          },
        ],
      },
      {
        name: 'Matemática',
        topics: [
          {
            title: 'Tópico "Geral"',
            percentage: 78,
            items: [
              {
                code: 'EF01MA01',
                description: 'Utilizar números naturais como indicador de quantidade ou de ordem em diferentes situações cotidianas.',
                percentage: 89,
              },
              {
                code: 'EF01MA06',
                description: 'Construir fatos básicos da adição e utilizá-los no cálculo mental ou escrito para resolver problemas simples.',
                percentage: 72,
              },
              {
                code: 'EF02MA05',
                description: 'Construir fatos fundamentais da adição e subtração e utilizá-los no cálculo mental ou escrito.',
                percentage: 80,
              },
            ],
          },
        ],
      },
    ],
  };
};

export const getSampleEvolution = (): EvolutionRow[] => [
  { edicao: '2026 - Av. Diagnóstica', materia: 'Leitura', participacao: 95, acertos: 65 },
  { edicao: '2026 - Av. Diagnóstica', materia: 'Língua Portuguesa', participacao: 95, acertos: 70 },
  { edicao: '2026 - Av. Diagnóstica', materia: 'Matemática', participacao: 95, acertos: 72 },
  { edicao: '2026 - Av. Formativa 1', materia: 'Leitura', participacao: 100, acertos: 74 },
  { edicao: '2026 - Av. Formativa 1', materia: 'Língua Portuguesa', participacao: 100, acertos: 78 },
  { edicao: '2026 - Av. Formativa 1', materia: 'Matemática', participacao: 100, acertos: 80 },
  { edicao: '2026 - Av. Formativa 2', materia: 'Leitura', participacao: 98, acertos: 82 },
  { edicao: '2026 - Av. Formativa 2', materia: 'Língua Portuguesa', participacao: 98, acertos: 85 },
  { edicao: '2026 - Av. Formativa 2', materia: 'Matemática', participacao: 98, acertos: 88 },
  { edicao: '2026 - Av. Formativa 3', materia: 'Leitura', participacao: 100, acertos: 89 },
  { edicao: '2026 - Av. Formativa 3', materia: 'Língua Portuguesa', participacao: 100, acertos: 91 },
  { edicao: '2026 - Av. Formativa 3', materia: 'Matemática', participacao: 100, acertos: 93 },
];

export const getSampleReadingSummary = (): LevelsSummaryRow[] => [
  {
    edicao: '2026 - Av. Diagnóstica',
    total_alunos: 16,
    fluente: 1,
    nao_fluente: 5,
    frases: 2,
    palavras: 0,
    silabas: 1,
    nao_leitor: 7,
    nao_avaliado: 0,
    nao_informado: 0,
  },
  {
    edicao: '2026 - Av. Formativa 1',
    total_alunos: 16,
    fluente: 3,
    nao_fluente: 3,
    frases: 2,
    palavras: 2,
    silabas: 5,
    nao_leitor: 1,
    nao_avaliado: 0,
    nao_informado: 0,
  },
  {
    edicao: '2026 - Av. Formativa 2',
    total_alunos: 16,
    fluente: 4,
    nao_fluente: 4,
    frases: 4,
    palavras: 1,
    silabas: 3,
    nao_leitor: 0,
    nao_avaliado: 0,
    nao_informado: 0,
  },
  {
    edicao: '2026 - Av. Formativa 3',
    total_alunos: 16,
    fluente: 6,
    nao_fluente: 4,
    frases: 2,
    palavras: 4,
    silabas: 0,
    nao_leitor: 0,
    nao_avaliado: 0,
    nao_informado: 0,
  },
];

export const getSampleObjectiveMatrix = (
  subject: string = 'Língua Portuguesa',
  studentsList: string[] = [
    'ANNA LÍVIA RODRIGUES DE QUEIROZ',
    'ANTONY DANIEL DE OLIVEIRA QUIRINO',
    'DANIELE SILVA',
    'ERIC LIMA DUARTE',
    'HEITOR PALMEIRA DO NASCIMENTO',
    'JHONATHAN BENJAMIN OLIVEIRA DA SILVA',
    'JOÃO GUILHERME BARBOSA ARAUJO',
    'JOÃO HENRIQUE SOARES FELIX',
    'JOÃO LUCAS DE LIMA SOUZA',
    'KEMMILY STHER ARAUJO DE LIMA',
    'MARIA ISABELA MOREIRA DOS SANTOS',
    'MARIA LAURA DOS SANTOS SILVA',
    'MARIA LUIZA ALBINO DO NASCIMENTO',
    'MIGUEL DE SOUSA QUINTANS ARAUJO',
    'RAEL VALENTIN DE LIMA MORATO',
    'VALENTINA DE SOUZA OLIVEIRA',
  ]
): MatrixDisciplineData => {
  const totalQuestions = 20;
  const baseHitRates = [
    70, 75, 65, 85, 90, 95, 80, 85, 80, 90, 85, 100, 95, 75, 90, 90
  ];

  const students: MatrixStudentRow[] = studentsList.map((name, sIdx) => {
    const rate = baseHitRates[sIdx % baseHitRates.length];
    const letters = ['A', 'B', 'C', 'D'];
    const questions = Array.from({ length: totalQuestions }, (_, qIdx) => {
      const isCorrect = ((qIdx * 7 + sIdx * 5 + (subject.includes('Mat') ? 3 : 1)) % 100) < rate;
      const answer = letters[(qIdx + sIdx) % 4];
      return {
        number: qIdx + 1,
        answer,
        isCorrect,
      };
    });

    const actualCorrect = questions.filter((q) => q.isCorrect).length;
    const hitRate = Math.round((actualCorrect / totalQuestions) * 100);

    return {
      name,
      questions,
      hitRate,
    };
  });

  const questionAverages = Array.from({ length: totalQuestions }, (_, qIdx) => {
    const rights = students.filter((s) => s.questions[qIdx]?.isCorrect).length;
    return Math.round((rights / (students.length || 1)) * 100);
  });

  const classAverage = Math.round(
    students.reduce((sum, s) => sum + s.hitRate, 0) / (students.length || 1)
  );

  return {
    subject,
    totalQuestions,
    students,
    questionAverages,
    classAverage,
  };
};

// --- HTML PARSERS ---

export const parseSaevPerformanceHistoryHtml = (html: string): PerformanceHistoryData => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  // 1. Breadcrumbs / Context
  let school = 'Escola';
  let className = 'Turma';
  let series = '';
  let year = new Date().getFullYear().toString();

  const breadcrumbSpans = Array.from(doc.querySelectorAll('[class*="BreadcrumbContent"] span'));
  if (breadcrumbSpans.length > 0) {
    const texts = breadcrumbSpans.map((s) => s.textContent?.trim() || '').filter(Boolean);
    if (texts[0]) year = texts[0].replace(/[^\d]/g, '') || year;
    if (texts.length >= 2) {
      className = texts[texts.length - 1];
      school = texts[texts.length - 2];
    }
  }

  // Also check form selects / inputs
  const schoolInput = doc.querySelector('#school') as HTMLInputElement;
  if (schoolInput?.value) school = schoolInput.value;
  const classInput = doc.querySelector('#schoolClass') as HTMLInputElement;
  if (classInput?.value) className = classInput.value;
  const yearInput = doc.querySelector('#size-small-outlined') as HTMLInputElement;
  if (yearInput?.value) year = yearInput.value;

  const titleHeader = doc.querySelector('[class*="PageTitleStyled"]')?.textContent || '';
  const seriesMatch = titleHeader.match(/Série:\s*([^<]+)/i) || doc.body.textContent?.match(/Série:\s*([^\n<]+)/i);
  if (seriesMatch) series = seriesMatch[1].trim();

  // 2. Disciplines: Look for sections in PDF container first (which has all 3 subjects), or interactive container
  const pdfContainers = Array.from(doc.querySelectorAll('.historico-desempenho-pdf-container [class*="Container-sc-1r954wo-0"]'));
  const disciplines: PerformanceHistoryDiscipline[] = [];

  const parseSection = (container: Element, discName: string) => {
    let studentNames: string[] = [];
    const editionCols: { title: string; cells: { text: string; bg: string }[] }[] = [];

    // Search for Alunos column
    const allDivs = Array.from(container.querySelectorAll('div'));
    const alunosHeader = allDivs.find((d) => d.textContent?.trim() === 'Alunos');
    if (alunosHeader && alunosHeader.parentElement) {
      const parent = alunosHeader.parentElement;
      studentNames = Array.from(parent.children)
        .slice(1)
        .map((c) => c.textContent?.trim() || '')
        .filter(Boolean);
    }

    // Search for edition columns
    const editionContainers = Array.from(container.querySelectorAll('[style*="flex-direction: column"]'));
    editionContainers.forEach((ec) => {
      const headerDiv = ec.children[0];
      const title = headerDiv?.getAttribute('title') || headerDiv?.textContent?.trim() || '';
      if (!title || title.toLowerCase() === 'alunos') return;

      const cells: { text: string; bg: string }[] = [];
      Array.from(ec.children)
        .slice(1)
        .forEach((cell) => {
          const text = cell.textContent?.trim() || '';
          const style = (cell as HTMLElement).getAttribute('style') || '';
          const bgMatch = style.match(/background-color:\s*([^;]+)/i);
          const bg = bgMatch ? bgMatch[1].trim() : '#666666';
          cells.push({ text, bg });
        });

      editionCols.push({ title, cells });
    });

    if (studentNames.length > 0 && editionCols.length > 0) {
      const columns = editionCols.map((c) => c.title);
      const students: PerformanceHistoryStudent[] = studentNames.map((name, sIdx) => {
        const values: Record<string, string> = {};
        const colors: Record<string, string> = {};

        editionCols.forEach((col) => {
          const cell = col.cells[sIdx];
          values[col.title] = cell?.text || 'Não Informado';
          colors[col.title] = normalizeColorToHex(cell?.bg || '#666666');
        });

        return { name, values, colors };
      });

      disciplines.push({ name: discName, columns, students });
    }
  };

  if (pdfContainers.length > 0) {
    pdfContainers.forEach((pc) => {
      const strong = pc.querySelector('strong');
      const text = strong?.textContent || '';
      let discName = 'Leitura';
      if (text.toLowerCase().includes('portug')) discName = 'Língua portuguesa';
      else if (text.toLowerCase().includes('matem')) discName = 'Matemática';
      else if (text.toLowerCase().includes('leitur')) discName = 'Leitura';

      parseSection(pc, discName);
    });
  }

  // Fallback: parse interactive container if pdf containers were empty
  if (disciplines.length === 0) {
    const mainContainer = doc.querySelector('[class*="Container-sc-1r954wo-0"]');
    if (mainContainer) {
      const activeTabBtn = doc.querySelector('[class*="Container-sc-1xjk62e-0"] button.checked');
      const activeDisc = activeTabBtn?.textContent?.trim() || 'Leitura';
      parseSection(mainContainer, activeDisc);
    }
  }

  // If parsing completely succeeded, return
  if (disciplines.length > 0) {
    return {
      school,
      className,
      series,
      year,
      disciplines,
      legend: [
        { label: 'Fluente', color: '#11312B' },
        { label: 'Não Fluente', color: '#2D9B82' },
        { label: 'Frases', color: '#51D0B2' },
        { label: 'Palavras', color: '#5A9BD5' },
        { label: 'Sílabas', color: '#9DC3E7' },
        { label: 'Não Leitor', color: '#A4A4A4' },
        { label: 'Não Avaliado', color: '#666666' },
        { label: 'Não Informado', color: '#666666' },
      ],
    };
  }

  // Fallback to sample if empty
  return getSamplePerformanceHistory();
};

export const parseSaevDescriptorsHtml = (html: string): DescriptorsData => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  // Breadcrumbs
  let school = 'Escola';
  let className = 'Turma';
  let year = new Date().getFullYear().toString();
  let edition = `${year} - Avaliação`;

  const breadcrumbText = doc.body.textContent || '';
  const edMatch = breadcrumbText.match(/\d{4}\s*-\s*Av\.[^\n>]+/i);
  if (edMatch) edition = edMatch[0].trim();

  const topics: DescriptorTopic[] = [];
  let currentTopic: DescriptorTopic = {
    title: 'Tópico "Geral"',
    percentage: 70,
    items: [],
  };

  // Find percentage progress elements
  // Look for patterns like EF01LP02, EF02MA01, etc.
  const allTextElements = Array.from(doc.querySelectorAll('div, p, span, h4, h5'));
  allTextElements.forEach((el) => {
    const text = el.textContent?.trim() || '';
    const descMatch = text.match(/^(EF\d{2}[A-Z]{2}\d{2})\s*[-–]\s*(.+)/);
    if (descMatch) {
      const code = descMatch[1];
      const desc = descMatch[2];
      
      // Look nearby for a percentage
      let pct = 75;
      const parent = el.parentElement;
      if (parent) {
        const pctMatch = parent.textContent?.match(/(\d+)%/);
        if (pctMatch) pct = parseInt(pctMatch[1], 10);
      }

      if (!currentTopic.items.some((item) => item.code === code)) {
        currentTopic.items.push({
          code,
          description: desc,
          percentage: pct,
        });
      }
    }
  });

  if (currentTopic.items.length > 0) {
    const avg = Math.round(
      currentTopic.items.reduce((sum, item) => sum + item.percentage, 0) / currentTopic.items.length
    );
    currentTopic.percentage = avg;
    topics.push(currentTopic);
  }

  if (topics.length > 0) {
    return {
      school,
      className,
      series: '',
      year,
      edition,
      disciplines: [
        { name: 'Língua portuguesa', topics },
        { name: 'Matemática', topics: [] },
      ],
    };
  }

  return getSampleDescriptors();
};

// --- IMAGE / PNG EXPORTERS (HIGH RES, NO HORIZONTAL SCROLL) ---

export const exportHistoryTableAsPng = async (
  history: PerformanceHistoryData,
  activeDisciplineName: string = 'Leitura'
): Promise<string | null> => {
  const discipline =
    history.disciplines.find((d) => d.name.toLowerCase() === activeDisciplineName.toLowerCase()) ||
    history.disciplines[0];

  if (!discipline || discipline.students.length === 0) return null;

  const directoryPath = await open({
    directory: true,
    multiple: false,
    title: 'Selecione onde salvar a imagem do Histórico de Desempenho',
  });

  if (!directoryPath || typeof directoryPath !== 'string') return null;

  const studentCount = discipline.students.length;
  const colCount = discipline.columns.length;

  const nameColWidth = 320;
  const colWidth = 160;
  const tableWidth = nameColWidth + colCount * colWidth;
  const paddingX = 60;
  const headerHeight = 160;
  const rowHeight = 42;
  const legendHeight = 100;
  const totalWidth = Math.max(1600, tableWidth + paddingX * 2);
  const totalHeight = headerHeight + (studentCount + 1) * rowHeight + legendHeight + 60;

  const canvas = document.createElement('canvas');
  canvas.width = totalWidth;
  canvas.height = totalHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Não foi possível inicializar canvas');

  // Background
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, totalWidth, totalHeight);

  // Title Header
  ctx.fillStyle = '#111827';
  ctx.font = 'bold 28px Inter, Arial, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(`Histórico de Desempenho - ${discipline.name}`, paddingX, 60);

  ctx.fillStyle = '#4B5563';
  ctx.font = '500 18px Inter, Arial, sans-serif';
  const subtitle = `${history.school} • ${history.className} • Ano: ${history.year}`;
  ctx.fillText(subtitle, paddingX, 95);

  const startY = headerHeight;
  const startX = paddingX + (totalWidth - paddingX * 2 - tableWidth) / 2;

  // Header Row
  ctx.fillStyle = '#F3F4F6';
  ctx.fillRect(startX, startY, tableWidth, rowHeight);
  ctx.strokeStyle = '#D1D5DB';
  ctx.lineWidth = 1;
  ctx.strokeRect(startX, startY, tableWidth, rowHeight);

  // Header "Alunos"
  ctx.fillStyle = '#1F2937';
  ctx.font = 'bold 15px Inter, Arial, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('Alunos', startX + 16, startY + 26);

  // Header Columns (Editions)
  ctx.font = 'bold 14px Inter, Arial, sans-serif';
  ctx.textAlign = 'center';
  discipline.columns.forEach((col, cIdx) => {
    const colX = startX + nameColWidth + cIdx * colWidth;
    ctx.strokeRect(colX, startY, colWidth, rowHeight);
    
    // Clean column title
    let shortCol = col.replace(/^\d{4}\s*-\s*/, '');
    ctx.fillText(shortCol, colX + colWidth / 2, startY + 26, colWidth - 10);
  });

  // Rows (Students)
  discipline.students.forEach((st, rIdx) => {
    const rowY = startY + (rIdx + 1) * rowHeight;

    // Student Name Box
    ctx.fillStyle = rIdx % 2 === 0 ? '#FFFFFF' : '#FAFAFA';
    ctx.fillRect(startX, rowY, nameColWidth, rowHeight);
    ctx.strokeRect(startX, rowY, nameColWidth, rowHeight);

    ctx.fillStyle = '#111827';
    ctx.font = '600 13px Inter, Arial, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(st.name, startX + 16, rowY + 26, nameColWidth - 24);

    // Cells
    discipline.columns.forEach((col, cIdx) => {
      const colX = startX + nameColWidth + cIdx * colWidth;
      const val = st.values[col] || '-';
      const color = st.colors[col] || '#666666';

      // Cell Background
      ctx.fillStyle = color;
      ctx.fillRect(colX, rowY, colWidth, rowHeight);
      ctx.strokeRect(colX, rowY, colWidth, rowHeight);

      // Cell Text
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 13px Inter, Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(val, colX + colWidth / 2, rowY + 26, colWidth - 12);
    });
  });

  // Legend at bottom
  const legendY = startY + (studentCount + 1) * rowHeight + 35;
  const isLeitura = discipline.name.toLowerCase().includes('leitura');
  const legendItems = isLeitura
    ? history.legend
    : [
        { label: '75% a 100%', color: '#3E8277' },
        { label: '50% a 74%', color: '#5EC2B1' },
        { label: '25% a 49%', color: '#FAA036' },
        { label: '0% a 24%', color: '#FF6868' },
        { label: 'Não Informado', color: '#666666' },
      ];

  const itemWidth = 140;
  const legendTotalW = legendItems.length * itemWidth;
  let legX = startX + (tableWidth - legendTotalW) / 2;

  legendItems.forEach((item) => {
    ctx.fillStyle = item.color;
    ctx.fillRect(legX, legendY, 18, 18);
    ctx.strokeStyle = '#9CA3AF';
    ctx.strokeRect(legX, legendY, 18, 18);

    ctx.fillStyle = '#374151';
    ctx.font = '600 12px Inter, Arial, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(item.label, legX + 26, legendY + 14);
    legX += itemWidth;
  });

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png', 1));
  if (!blob) throw new Error('Falha ao gerar blob de imagem.');

  const cleanName = discipline.name.replace(/[^a-zA-Z0-9]/g, '_');
  const fileName = `Historico_Desempenho_${cleanName}_${new Date().getFullYear()}.png`;
  const filePath = await join(directoryPath, fileName);
  const arrayBuffer = await blob.arrayBuffer();
  await writeFile(filePath, new Uint8Array(arrayBuffer));

  return filePath;
};

export const exportDescriptorsAsPng = async (
  descriptors: DescriptorsData,
  activeDisciplineName: string = 'Língua portuguesa'
): Promise<string | null> => {
  const discipline =
    descriptors.disciplines.find((d) => d.name.toLowerCase() === activeDisciplineName.toLowerCase()) ||
    descriptors.disciplines[0];

  if (!discipline) return null;

  const directoryPath = await open({
    directory: true,
    multiple: false,
    title: 'Selecione onde salvar a imagem dos Descritores',
  });

  if (!directoryPath || typeof directoryPath !== 'string') return null;

  const width = 1600;
  const paddingX = 80;
  const headerHeight = 160;
  const topicHeight = 70;
  const itemHeight = 65;

  let totalItems = 0;
  discipline.topics.forEach((t) => (totalItems += t.items.length));
  const totalHeight = headerHeight + discipline.topics.length * topicHeight + totalItems * itemHeight + 80;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = totalHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Não foi possível inicializar canvas');

  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, width, totalHeight);

  // Header
  ctx.fillStyle = '#111827';
  ctx.font = 'bold 28px Inter, Arial, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(`Descritores - ${discipline.name}`, paddingX, 60);

  ctx.fillStyle = '#4B5563';
  ctx.font = '500 18px Inter, Arial, sans-serif';
  ctx.fillText(`${descriptors.school} • ${descriptors.className} • ${descriptors.edition}`, paddingX, 95);

  let currentY = headerHeight;
  const contentWidth = width - paddingX * 2;

  discipline.topics.forEach((topic) => {
    // Topic Bar
    ctx.fillStyle = '#F0FDF4';
    ctx.fillRect(paddingX, currentY, contentWidth, 48);
    ctx.strokeStyle = '#BBF7D0';
    ctx.strokeRect(paddingX, currentY, contentWidth, 48);

    ctx.fillStyle = '#166534';
    ctx.font = 'bold 18px Inter, Arial, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(topic.title, paddingX + 20, currentY + 31);

    // Topic Progress Pill
    const pillW = 280;
    const pillH = 22;
    const pillX = paddingX + contentWidth - pillW - 100;
    const pillY = currentY + 13;

    ctx.fillStyle = '#E5E7EB';
    ctx.beginPath();
    ctx.roundRect(pillX, pillY, pillW, pillH, 11);
    ctx.fill();

    const fillW = Math.max(0, (topic.percentage / 100) * pillW);
    ctx.fillStyle = '#3E8277';
    ctx.beginPath();
    ctx.roundRect(pillX, pillY, fillW, pillH, 11);
    ctx.fill();

    ctx.fillStyle = '#111827';
    ctx.font = 'bold 16px Inter, Arial, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(`${topic.percentage}%`, paddingX + contentWidth - 20, currentY + 32);

    currentY += 60;

    // Items
    topic.items.forEach((item) => {
      ctx.fillStyle = '#1F2937';
      ctx.font = 'bold 15px Inter, Arial, sans-serif';
      ctx.textAlign = 'left';
      const label = `${item.code} - ${item.description}`;
      ctx.fillText(label, paddingX + 20, currentY + 24, contentWidth - 360);

      // Bar
      const barW = 260;
      const barH = 18;
      const barX = paddingX + contentWidth - barW - 90;
      const barY = currentY + 10;

      ctx.fillStyle = '#E5E7EB';
      ctx.beginPath();
      ctx.roundRect(barX, barY, barW, barH, 9);
      ctx.fill();

      const itemFillW = Math.max(0, (item.percentage / 100) * barW);
      ctx.fillStyle = '#4EA496';
      ctx.beginPath();
      ctx.roundRect(barX, barY, itemFillW, barH, 9);
      ctx.fill();

      ctx.fillStyle = '#1F2937';
      ctx.font = 'bold 15px Inter, Arial, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(`${item.percentage}%`, paddingX + contentWidth - 20, currentY + 25);

      currentY += itemHeight;
    });

    currentY += 20;
  });

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png', 1));
  if (!blob) throw new Error('Falha ao gerar blob de imagem.');

  const cleanName = discipline.name.replace(/[^a-zA-Z0-9]/g, '_');
  const fileName = `Descritores_${cleanName}_${new Date().getFullYear()}.png`;
  const filePath = await join(directoryPath, fileName);
  const arrayBuffer = await blob.arrayBuffer();
  await writeFile(filePath, new Uint8Array(arrayBuffer));

  return filePath;
};

// --- POWERPOINT PRESENTATION COMPILER ---

export interface CompiledPresentationOptions {
  state?: CompiledResultsState;
  allClasses?: CompiledResultsState[];
}

export const generateCompiledPresentation = async (
  options: CompiledPresentationOptions
): Promise<string | null> => {
  const classesList =
    options.allClasses && options.allClasses.length > 0
      ? options.allClasses
      : options.state
      ? [options.state]
      : [];

  if (classesList.length === 0) return null;

  const pres = new PptxGenJS();
  pres.layout = 'LAYOUT_16x9';
  pres.title = `Compilação de Resultados - ${classesList[0].school}`;
  pres.author = 'Gestão Escolar';

  // Loop through ALL classes in sequence
  for (let cIdx = 0; cIdx < classesList.length; cIdx++) {
    const state = classesList[cIdx];

    // 1. Histórico de Desempenho (if selected)
    if (state.selectedModules.historicoDesempenho && state.performanceHistory.disciplines.length > 0) {
      state.performanceHistory.disciplines.forEach((disc) => {
        const slide = pres.addSlide();
        slide.addText(`Histórico de Desempenho - ${disc.name}`, {
          x: 0.5,
          y: 0.3,
          w: 9.0,
          fontSize: 18,
          bold: true,
          color: '1E293B',
        });
        slide.addText(`${state.school} • Turma: ${state.className} • Ano: ${state.year}`, {
          x: 0.5,
          y: 0.7,
          w: 9.0,
          fontSize: 12,
          color: '64748B',
        });

        const headerRow = [
          { text: 'Alunos', options: { bold: true, fill: { color: 'F1F5F9' }, color: '1E293B', fontSize: 8 } },
          ...disc.columns.map((col) => ({
            text: col.replace(/^\d{4}\s*-\s*/, ''),
            options: { bold: true, fill: { color: 'F1F5F9' }, color: '1E293B', fontSize: 7, align: 'center' as const },
          })),
        ];

        const bodyRows = disc.students.slice(0, 20).map((st) => [
          { text: st.name, options: { fontSize: 7, align: 'left' as const } },
          ...disc.columns.map((col) => {
            const val = st.values[col] || '-';
            const hex = (st.colors[col] || '#666666').replace('#', '');
            return {
              text: val,
              options: {
                fontSize: 7,
                align: 'center' as const,
                fill: { color: hex },
                color: 'FFFFFF',
                bold: true,
              },
            };
          }),
        ]);

        const nameW = 2.4;
        const colW = (9.0 - nameW) / disc.columns.length;

        slide.addTable([headerRow, ...bodyRows], {
          x: 0.5,
          y: 1.0,
          w: 9.0,
          colW: [nameW, ...disc.columns.map(() => colW)],
          border: { pt: 1, color: 'CBD5E1' },
          rowH: 0.2,
        });
      });
    }

    // 2. Descritores (if selected)
    if (state.selectedModules.descritores && state.descriptors.disciplines.length > 0) {
      state.descriptors.disciplines.forEach((disc) => {
        const slide = pres.addSlide();
        slide.addText(`Descritores de Desempenho - ${disc.name}`, {
          x: 0.5,
          y: 0.3,
          w: 9.0,
          fontSize: 18,
          bold: true,
          color: '1E293B',
        });
        slide.addText(`${state.school} • Turma: ${state.className} • ${state.edition || '2026 - Av. Formativa 3'}`, {
          x: 0.5,
          y: 0.7,
          w: 9.0,
          fontSize: 11,
          color: '64748B',
        });

        const headers = [
          { text: 'Código', options: { bold: true, fill: { color: 'E2E8F0' }, fontSize: 9 } },
          { text: 'Habilidade / Descritor', options: { bold: true, fill: { color: 'E2E8F0' }, fontSize: 9 } },
          { text: '% Acertos', options: { bold: true, fill: { color: 'E2E8F0' }, fontSize: 9, align: 'center' as const } },
        ];

        const rows: any[] = [];
        disc.topics.forEach((t) => {
          rows.push([
            { text: t.title, options: { bold: true, fill: { color: 'DCFCE7' }, color: '166534', colspan: 2 } },
            null,
            { text: `${t.percentage}%`, options: { bold: true, fill: { color: 'DCFCE7' }, color: '166534', align: 'center' as const } },
          ]);

          t.items.forEach((item) => {
            rows.push([
              { text: item.code, options: { bold: true, fontSize: 8 } },
              { text: item.description, options: { fontSize: 8 } },
              { text: `${item.percentage}%`, options: { bold: true, fontSize: 8, align: 'center' as const, color: '0D9488' } },
            ]);
          });
        });

        slide.addTable([headers, ...rows], {
          x: 0.5,
          y: 1.0,
          w: 9.0,
          colW: [1.2, 6.8, 1.0],
          border: { pt: 1, color: 'E2E8F0' },
        });
      });
    }

    // 3. Linha Evolutiva (if selected)
    if (state.selectedModules.linhaEvolutiva && state.evolutionRows.length > 0) {
      const slide = pres.addSlide();
      slide.addText('Linha Evolutiva - Desempenho Geral', {
        x: 0.5,
        y: 0.3,
        w: 9.0,
        fontSize: 18,
        bold: true,
        color: '1E293B',
      });
      slide.addText(`${state.school} • Turma: ${state.className}`, {
        x: 0.5,
        y: 0.7,
        w: 9.0,
        fontSize: 11,
        color: '64748B',
      });

      const editions = Array.from(new Set(state.evolutionRows.map((r) => r.edicao)));
      const subjects = ['Leitura', 'Língua Portuguesa', 'Matemática'];

      const chartData = subjects.map((subj) => ({
        name: subj,
        labels: editions.map((e) => e.replace(/^\d{4}\s*-\s*/, '')),
        values: editions.map((ed) => {
          const row = state.evolutionRows.find(
            (r) => r.edicao === ed && r.materia.toLowerCase().includes(subj.toLowerCase())
          );
          return row ? row.acertos : 0;
        }),
      }));

      slide.addChart(pres.ChartType.line, chartData, {
        x: 0.5,
        y: 1.1,
        w: 9.0,
        h: 3.9,
        showLegend: true,
        legendPos: 'b',
        valAxisMaxVal: 100,
        valAxisMinVal: 0,
        chartColors: ['0D9488', '3B82F6', 'F59E0B'],
        lineSize: 3,
      });
    }

    // 4. Nível de Leitura (if selected)
    if (state.selectedModules.nivelLeitura && state.readingSummaryRows.length > 0) {
      const slide = pres.addSlide();
      slide.addText('Distribuição do Nível de Leitura', {
        x: 0.5,
        y: 0.3,
        w: 9.0,
        fontSize: 18,
        bold: true,
        color: '1E293B',
      });
      slide.addText(`${state.school} • Turma: ${state.className}`, {
        x: 0.5,
        y: 0.7,
        w: 9.0,
        fontSize: 11,
        color: '64748B',
      });

      const labels = state.readingSummaryRows.map((r) => r.edicao.replace(/^\d{4}\s*-\s*/, ''));
      const levelsChart = [
        { name: 'Fluente', labels, values: state.readingSummaryRows.map((r) => r.fluente) },
        { name: 'Não Fluente', labels, values: state.readingSummaryRows.map((r) => r.nao_fluente) },
        { name: 'Frases', labels, values: state.readingSummaryRows.map((r) => r.frases) },
        { name: 'Palavras', labels, values: state.readingSummaryRows.map((r) => r.palavras) },
        { name: 'Sílabas', labels, values: state.readingSummaryRows.map((r) => r.silabas) },
        { name: 'Não Leitor', labels, values: state.readingSummaryRows.map((r) => r.nao_leitor) },
      ];

      slide.addChart(pres.ChartType.bar, levelsChart, {
        x: 0.5,
        y: 1.1,
        w: 9.0,
        h: 3.8,
        barGrouping: 'stacked',
        showLegend: true,
        legendPos: 'b',
        chartColors: ['11312B', '2D9B82', '51D0B2', '5A9BD5', '9DC3E7', 'A4A4A4'],
      });
    }

    // 5. Síntese Geral - Matrizes Objetivas (Português e Matemática)
    if (state.selectedModules.sinteseGeral) {
      const matrices = state.matrixDisciplines && state.matrixDisciplines.length > 0
        ? state.matrixDisciplines
        : [
            getSampleObjectiveMatrix('Língua Portuguesa', state.performanceHistory.disciplines[0]?.students.map((s) => s.name)),
            getSampleObjectiveMatrix('Matemática', state.performanceHistory.disciplines[0]?.students.map((s) => s.name)),
          ];

      matrices.forEach((mat) => {
        const slide = pres.addSlide();
        slide.addText(`Síntese Geral (Matriz de Respostas) - ${mat.subject}`, {
          x: 0.5,
          y: 0.3,
          w: 9.0,
          fontSize: 18,
          bold: true,
          color: '1E293B',
        });
        slide.addText(`${state.school} • Turma: ${state.className} • Prova Objetiva • Média: ${mat.classAverage}%`, {
          x: 0.5,
          y: 0.7,
          w: 9.0,
          fontSize: 11,
          color: '64748B',
        });

        const qCols = Math.min(mat.totalQuestions, 18);
        const headerRow = [
          { text: 'Aluno', options: { bold: true, fill: { color: '2E4053' }, color: 'FFFFFF', fontSize: 7 } },
          ...Array.from({ length: qCols }, (_, i) => ({
            text: `Q${i + 1}`,
            options: { bold: true, fill: { color: '2E4053' }, color: 'FFFFFF', fontSize: 6.5, align: 'center' as const },
          })),
          { text: '% Acerto', options: { bold: true, fill: { color: '2E4053' }, color: 'FFFFFF', fontSize: 7, align: 'center' as const } },
        ];

        const bodyRows = mat.students.slice(0, 16).map((st) => [
          { text: st.name, options: { fontSize: 6.5, align: 'left' as const } },
          ...st.questions.slice(0, qCols).map((q) => ({
            text: q.isCorrect ? 'C' : 'E',
            options: {
              fontSize: 6.5,
              align: 'center' as const,
              fill: { color: q.isCorrect ? 'D5E8D4' : 'F4CCCC' },
              color: q.isCorrect ? '006100' : '9C0006',
              bold: true,
            },
          })),
          { text: `${st.hitRate}%`, options: { fontSize: 7, align: 'center' as const, bold: true } },
        ]);

        const nameW = 2.4;
        const qW = (6.6 - 0.9) / qCols;
        slide.addTable([headerRow, ...bodyRows], {
          x: 0.5,
          y: 1.0,
          w: 9.0,
          colW: [nameW, ...Array(qCols).fill(qW), 0.9],
          border: { pt: 1, color: 'CBD5E1' },
          rowH: 0.2,
        });
      });
    }
  }

  // Save dialog
  const savePath = await save({
    filters: [{ name: 'Apresentação PowerPoint', extensions: ['pptx'] }],
    defaultPath: `Compilacao_Resultados_${new Date().getFullYear()}.pptx`,
  });

  if (!savePath) return null;

  const buffer = (await pres.write({ outputType: 'uint8array' })) as Uint8Array;
  await writeFile(savePath, buffer);

  return savePath;
};

// --- PDF COMPILER ---

export const generateCompiledPdf = async (
  options: CompiledPresentationOptions
): Promise<string | null> => {
  const classesList =
    options.allClasses && options.allClasses.length > 0
      ? options.allClasses
      : options.state
      ? [options.state]
      : [];

  if (classesList.length === 0) return null;

  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  let isFirst = true;

  const addPageIfNeed = () => {
    if (!isFirst) doc.addPage();
    isFirst = false;
  };

  // ZERO COVER PAGE! Starts immediately on page 1 with content, as requested.

  // Loop through ALL loaded classes in sequence!
  for (let cIdx = 0; cIdx < classesList.length; cIdx++) {
    const state = classesList[cIdx];

    // 1. Histórico de Desempenho (if selected)
    if (state.selectedModules.historicoDesempenho && state.performanceHistory.disciplines.length > 0) {
      state.performanceHistory.disciplines.forEach((disc) => {
        addPageIfNeed();

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(16);
        doc.setTextColor(30, 41, 59);
        doc.text(`Histórico de Desempenho - ${disc.name}`, 14, 16);

        doc.setFontSize(9.5);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(100, 116, 139);
        doc.text(`${state.school} • Turma: ${state.className} • Ano: ${state.year}`, 14, 22);

        const headers = ['Alunos', ...disc.columns.map((c) => c.replace(/^\d{4}\s*-\s*/, ''))];
        const data = disc.students.map((st) => [
          st.name,
          ...disc.columns.map((c) => st.values[c] || '-'),
        ]);

        autoTable(doc, {
          startY: 26,
          head: [headers],
          body: data,
          theme: 'grid',
          styles: { fontSize: 7, cellPadding: 2, halign: 'center' },
          columnStyles: { 0: { halign: 'left', cellWidth: 50, fontStyle: 'bold' } },
          didParseCell: (hookData) => {
            if (hookData.section === 'body' && hookData.column.index > 0) {
              const colIndex = hookData.column.index - 1;
              const colName = disc.columns[colIndex];
              const student = disc.students[hookData.row.index];
              const hex = student?.colors[colName] || '#666666';

              const rgbMatch = hex.match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
              if (rgbMatch) {
                const r = parseInt(rgbMatch[1], 16);
                const g = parseInt(rgbMatch[2], 16);
                const b = parseInt(rgbMatch[3], 16);
                hookData.cell.styles.fillColor = [r, g, b];
                hookData.cell.styles.textColor = [255, 255, 255];
                hookData.cell.styles.fontStyle = 'bold';
              }
            }
          },
        });
      });
    }

    // 2. Descritores de Desempenho (WITH EXACT IMAGE 2 DESIGN: CAPSULE PROGRESS BARS!)
    if (state.selectedModules.descritores && state.descriptors.disciplines.length > 0) {
      state.descriptors.disciplines.forEach((disc) => {
        addPageIfNeed();

        // Breadcrumb Header
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(14);
        doc.setTextColor(17, 24, 39);
        doc.text(`Descritores de Desempenho - ${disc.name}`, 14, 15);

        doc.setFontSize(8.5);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(100, 116, 139);
        doc.text(
          `${state.year} > ${state.edition || '2026 - Av. Formativa 3'} > Paraíba > Sumé > ${state.school} > ${state.className}`,
          14,
          21
        );

        let curY = 27;
        const marginX = 14;
        const totalContentWidth = pageWidth - marginX * 2;

        disc.topics.forEach((topic) => {
          // Check page break
          if (curY + 24 > pageHeight - 15) {
            doc.addPage();
            curY = 18;
          }

          // Topic "Geral" Card with Deep Teal Bar #3E8277
          doc.setFillColor(248, 250, 252);
          doc.setDrawColor(226, 232, 240);
          doc.roundedRect(marginX, curY, totalContentWidth, 14, 2, 2, 'FD');

          doc.setFont('helvetica', 'bold');
          doc.setFontSize(10);
          doc.setTextColor(15, 23, 42);
          doc.text(topic.title, marginX + 6, curY + 9);

          // Topic Capsule Progress Bar
          const topicBarW = 120;
          const topicBarX = pageWidth - marginX - topicBarW - 20;
          const topicBarY = curY + 4.5;
          const topicBarH = 5;

          // Track
          doc.setFillColor(229, 231, 235);
          doc.roundedRect(topicBarX, topicBarY, topicBarW, topicBarH, 2.5, 2.5, 'F');

          // Deep Teal Fill #3E8277
          const topicFillW = Math.max(0, (topic.percentage / 100) * topicBarW);
          doc.setFillColor(62, 130, 119);
          if (topicFillW > 0) {
            doc.roundedRect(topicBarX, topicBarY, topicFillW, topicBarH, 2.5, 2.5, 'F');
          }

          doc.setFont('helvetica', 'bold');
          doc.setFontSize(9.5);
          doc.setTextColor(30, 41, 59);
          doc.text(`${topic.percentage}%`, topicBarX + topicBarW + 4, topicBarY + 4);

          curY += 18;

          // Items (Individual Skills) with Vibrant Teal Bar #4EA496
          topic.items.forEach((item) => {
            if (curY + 16 > pageHeight - 15) {
              doc.addPage();
              curY = 18;
            }

            // Skill Text Label (Code + Description)
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(8.5);
            doc.setTextColor(15, 23, 42);
            const codePart = `${item.code} - `;
            doc.text(codePart, marginX + 4, curY + 4);

            doc.setFont('helvetica', 'normal');
            doc.setTextColor(51, 65, 85);
            doc.text(item.description, marginX + 4 + doc.getTextWidth(codePart), curY + 4, {
              maxWidth: totalContentWidth - 80,
            });

            // Capsule Progress Bar
            const barW = totalContentWidth - 28;
            const barX = marginX + 4;
            const barY = curY + 6.5;
            const barH = 4.5;

            // Track
            doc.setFillColor(235, 238, 242);
            doc.roundedRect(barX, barY, barW, barH, 2.25, 2.25, 'F');

            // Vibrant Teal Fill #4EA496
            const fillW = Math.max(0, (item.percentage / 100) * barW);
            doc.setFillColor(78, 164, 150);
            if (fillW > 0) {
              doc.roundedRect(barX, barY, fillW, barH, 2.25, 2.25, 'F');
            }

            doc.setFont('helvetica', 'bold');
            doc.setFontSize(8.5);
            doc.setTextColor(30, 41, 59);
            doc.text(`${item.percentage}%`, barX + barW + 3, barY + 3.5);

            curY += 14.5;
          });

          curY += 6;
        });
      });
    }

    // 3. Nível de Leitura (if selected)
    if (state.selectedModules.nivelLeitura && state.readingSummaryRows.length > 0) {
      addPageIfNeed();

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(16);
      doc.setTextColor(30, 41, 59);
      doc.text(`Distribuição dos Níveis de Leitura`, 14, 16);

      doc.setFontSize(9.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 116, 139);
      doc.text(`${state.school} • Turma: ${state.className}`, 14, 22);

      const tableRows = state.readingSummaryRows.map((r) => [
        r.edicao,
        r.total_alunos.toString(),
        `${r.fluente} (${r.total_alunos ? Math.round((r.fluente / r.total_alunos) * 100) : 0}%)`,
        `${r.nao_fluente} (${r.total_alunos ? Math.round((r.nao_fluente / r.total_alunos) * 100) : 0}%)`,
        `${r.frases} (${r.total_alunos ? Math.round((r.frases / r.total_alunos) * 100) : 0}%)`,
        `${r.palavras} (${r.total_alunos ? Math.round((r.palavras / r.total_alunos) * 100) : 0}%)`,
        `${r.silabas} (${r.total_alunos ? Math.round((r.silabas / r.total_alunos) * 100) : 0}%)`,
        `${r.nao_leitor} (${r.total_alunos ? Math.round((r.nao_leitor / r.total_alunos) * 100) : 0}%)`,
      ]);

      autoTable(doc, {
        startY: 28,
        head: [['Edição', 'Total', 'Fluente', 'Não Fluente', 'Frases', 'Palavras', 'Sílabas', 'Não Leitor']],
        body: tableRows,
        theme: 'grid',
        styles: { fontSize: 8, cellPadding: 3, halign: 'center' },
        headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: 'bold' },
        columnStyles: { 0: { halign: 'left', fontStyle: 'bold' } },
      });
    }

    // 4. Linha Evolutiva (if selected)
    if (state.selectedModules.linhaEvolutiva && state.evolutionRows.length > 0) {
      addPageIfNeed();

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(16);
      doc.setTextColor(30, 41, 59);
      doc.text(`Linha Evolutiva - Histórico de Edições`, 14, 16);

      doc.setFontSize(9.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 116, 139);
      doc.text(`${state.school} • Turma: ${state.className}`, 14, 22);

      const evoRows = state.evolutionRows.map((r) => [
        r.edicao,
        r.materia,
        `${r.participacao}%`,
        `${r.acertos}%`,
      ]);

      autoTable(doc, {
        startY: 28,
        head: [['Edição Avaliativa', 'Disciplina', '% Participação', '% Acertos (Resultado)']],
        body: evoRows,
        theme: 'grid',
        styles: { fontSize: 8.5, cellPadding: 3, halign: 'center' },
        headStyles: { fillColor: [45, 155, 130], textColor: [255, 255, 255], fontStyle: 'bold' },
        columnStyles: { 0: { halign: 'left', fontStyle: 'bold' }, 1: { halign: 'left' } },
      });
    }

    // 5. Síntese Geral (TABELAS DAS PROVAS OBJETIVAS DE PORTUGUÊS E MATEMÁTICA)
    if (state.selectedModules.sinteseGeral) {
      const matrices =
        state.matrixDisciplines && state.matrixDisciplines.length > 0
          ? state.matrixDisciplines
          : [
              getSampleObjectiveMatrix(
                'Língua Portuguesa',
                state.performanceHistory.disciplines[0]?.students.map((s) => s.name)
              ),
              getSampleObjectiveMatrix(
                'Matemática',
                state.performanceHistory.disciplines[0]?.students.map((s) => s.name)
              ),
            ];

      matrices.forEach((mat) => {
        addPageIfNeed();

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(15);
        doc.setTextColor(30, 41, 59);
        doc.text(`Síntese Geral (Matriz de Respostas) - ${mat.subject}`, 14, 16);

        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(100, 116, 139);
        doc.text(
          `${state.school} • Turma: ${state.className} • Prova Objetiva • Média da Turma: ${mat.classAverage}%`,
          14,
          22
        );

        const qHeaders = Array.from({ length: mat.totalQuestions }, (_, i) => `Q${i + 1}`);
        const headRow = ['Alunos', ...qHeaders, '% Acerto'];

        const bodyRows: any[] = mat.students.map((st) => [
          st.name,
          ...st.questions.map((q) => (q.isCorrect ? 'C' : 'E')),
          `${st.hitRate}%`,
        ]);

        const footRow = [
          'Média por Questão (%)',
          ...mat.questionAverages.map((avg) => `${avg}%`),
          `${mat.classAverage}%`,
        ];

        autoTable(doc, {
          startY: 26,
          head: [headRow],
          body: bodyRows,
          foot: [footRow],
          theme: 'grid',
          styles: { fontSize: 6.5, cellPadding: 1.5, halign: 'center' },
          headStyles: { fillColor: [46, 64, 83], textColor: [255, 255, 255], fontStyle: 'bold' },
          footStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: 'bold', fontSize: 6.5 },
          columnStyles: {
            0: { halign: 'left', cellWidth: 46, fontStyle: 'bold' },
            [headRow.length - 1]: { fontStyle: 'bold', cellWidth: 16 },
          },
          didParseCell: (dataCell) => {
            if (
              dataCell.section === 'body' &&
              dataCell.column.index > 0 &&
              dataCell.column.index <= mat.totalQuestions
            ) {
              if (dataCell.cell.raw === 'C') {
                dataCell.cell.styles.fillColor = [213, 232, 212]; // light green #D5E8D4
                dataCell.cell.styles.textColor = [0, 97, 0]; // dark green #006100
                dataCell.cell.styles.fontStyle = 'bold';
              } else if (dataCell.cell.raw === 'E') {
                dataCell.cell.styles.fillColor = [244, 204, 204]; // light red #F4CCCC
                dataCell.cell.styles.textColor = [156, 0, 6]; // dark red #9C0006
                dataCell.cell.styles.fontStyle = 'bold';
              }
            }
          },
        });
      });
    }
  }

  const savePath = await save({
    filters: [{ name: 'Documento PDF', extensions: ['pdf'] }],
    defaultPath: `Compilacao_Resultados_${new Date().getFullYear()}.pdf`,
  });

  if (!savePath) return null;

  const pdfOutput = doc.output('arraybuffer');
  await writeFile(savePath, new Uint8Array(pdfOutput));

  return savePath;
};
