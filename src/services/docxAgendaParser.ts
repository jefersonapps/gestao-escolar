import JSZip from 'jszip';
import type { AgendaActivity } from '@/types/agenda';

export interface ParseResult {
  activities: AgendaActivity[];
  warnings: string[];
  detectedStartDate?: string;
  filename: string;
}

const MONTH_NAME_MAP: Record<string, number> = {
  jan: 1, janeiro: 1,
  fev: 2, fevereiro: 2,
  mar: 3, marco: 3, março: 3,
  abr: 4, abril: 4,
  mai: 5, maio: 5,
  jun: 6, junho: 6,
  jul: 7, julho: 7,
  ago: 8, agosto: 8,
  set: 9, setembro: 9,
  out: 10, outubro: 10,
  nov: 11, novembro: 11,
  dez: 12, dezembro: 12,
};

/**
 * Robustly parses the date range from filename with support for:
 * - Virada de mês: "31-08 a 04-09"
 * - Múltiplos espaços e separadores: "Agenda da semana  03 a 07-08.docx"
 * - Nomes de meses por extenso/abreviado: "Agenda fev 23 a 27-02-2026", "Agenda Semana março 30 a 31-03"
 * - Extensões duplicadas: "agenda da semana 27 a 30-04-2026.docx.pdf"
 */
export function parseFilenameDate(filename: string): { start: Date; end?: Date; isMonthSpan?: boolean } | null {
  const norm = filename.toLowerCase().replace(/[\r\n\t]+/g, ' ').replace(/\s+/g, ' ');

  if (norm.includes('relat') || norm.startsWith('~')) {
    return null;
  }

  // Check for year
  const yearMatch = norm.match(/\b(202\d)\b/);
  const defaultYear = yearMatch ? parseInt(yearMatch[1], 10) : 2026;

  // Pattern 1: DD-MM a DD-MM (e.g. 31-08 a 04-09 or 31/08 a 04/09)
  const mSpan = norm.match(/(\d{1,2})[-/](\d{1,2})\s*a\s*(\d{1,2})[-/](\d{1,2})/);
  if (mSpan) {
    const d1 = parseInt(mSpan[1], 10);
    const mo1 = parseInt(mSpan[2], 10);
    const d2 = parseInt(mSpan[3], 10);
    const mo2 = parseInt(mSpan[4], 10);
    return {
      start: new Date(defaultYear, mo1 - 1, d1),
      end: new Date(defaultYear, mo2 - 1, d2),
      isMonthSpan: mo1 !== mo2
    };
  }

  // Pattern 2: DD a DD-MM (e.g. 18 a 22-05 or 06 a 10/04)
  const mStandard = norm.match(/(\d{1,2})\s*a\s*(\d{1,2})[-/](\d{1,2})/);
  if (mStandard) {
    const d1 = parseInt(mStandard[1], 10);
    const d2 = parseInt(mStandard[2], 10);
    const mo = parseInt(mStandard[3], 10);
    return {
      start: new Date(defaultYear, mo - 1, d1),
      end: new Date(defaultYear, mo - 1, d2)
    };
  }

  // Pattern 3: Month name in text (e.g. "fev 23 a 27", "março 30 a 31")
  for (const [mName, mNum] of Object.entries(MONTH_NAME_MAP)) {
    if (norm.includes(mName)) {
      const mText = norm.match(/(\d{1,2})\s*a\s*(\d{1,2})/);
      if (mText) {
        const d1 = parseInt(mText[1], 10);
        const d2 = parseInt(mText[2], 10);
        return {
          start: new Date(defaultYear, mNum - 1, d1),
          end: new Date(defaultYear, mNum - 1, d2)
        };
      }
    }
  }

  return null;
}

/**
 * Cleans raw XML text and entity references
 */
function cleanText(t: string): string {
  if (!t) return '';
  return t
    .replace(/\u00a0/g, ' ')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[ \t]+/g, ' ')
    .trim();
}

/**
 * Inspects table headers for explicit date references (e.g. "SEGUNDA-FEIRA - 01/06")
 * This solves critical edge cases like "Agenda da semana 01 a 29-05.docx" where the filename was mistyped!
 */
export function extractDatesFromTableHeaders(tableRows: Element[]): { dayDates: string[]; detectedStart?: Date } {
  for (let rIdx = 0; rIdx < Math.min(3, tableRows.length); rIdx++) {
    const row = tableRows[rIdx];
    const cells = Array.from(row.querySelectorAll(':scope > tc, tc'));
    const rowDates: string[] = [];

    for (const c of cells) {
      const text = c.textContent || '';
      // Search for DD/MM pattern in cell
      const match = text.match(/(\d{1,2})\/(\d{1,2})/);
      if (match) {
        rowDates.push(`${match[1].padStart(2, '0')}/${match[2].padStart(2, '0')}`);
      }
    }

    if (rowDates.length >= 4) {
      // Found at least 4 dates in this row!
      const first = rowDates[0].split('/');
      const d = parseInt(first[0], 10);
      const m = parseInt(first[1], 10);
      return {
        dayDates: rowDates,
        detectedStart: new Date(2026, m - 1, d)
      };
    }
  }

  return { dayDates: [] };
}

/**
 * Splits text into discrete items removing bullet points and categories
 */
function splitItems(cellText: string, defaultCat: string): { text: string; category: string }[] {
  const cleaned = cleanText(cellText);
  if (!cleaned) return [];

  // Remove top header
  const bodyText = cleaned.replace(
    /^(?:PEDAG[ÓO]GICO|ADMINISTRATIV[O0]|NOITE;?|A[ÇC][ÕO]ES PERMANENTES|MANH[ÃA]\/TARDE)\s*[:\-\]]*\s*/i,
    ''
  );

  const lines = bodyText.split(/[\r\n]+/);
  const items: { text: string; category: string }[] = [];
  let currentItem: string[] = [];
  let currentCat = defaultCat;

  for (const rawLine of lines) {
    let line = cleanText(rawLine);
    if (!line) continue;

    if (/^(?:PEDAG[ÓO]GICO|ADMINISTRATIV[O0]|NOITE;?|A[ÇC][ÕO]ES PERMANENTES|MANH[ÃA]\/TARDE)\s*[:\-\]]*$/i.test(line)) {
      continue;
    }

    const isBullet = /^[*•\-\u2013\]]\s*/.test(line);
    const isNumbered = /^\d+[\.\)]\s*/.test(line);
    const isAction = /^(?:PARTICIPAR|PARTICIPA|REUNI[ÃA]O|CURSO|FORMA[ÇC][ÃA]O|ATESTADO|FERIADO|FERAIADO|FACULTATIVO|ORGANIZA[ÇC][ÃA]O|0RGANIZA[ÇC][ÃA]O|ACOLHIMENTO|ACOMPANHAMENTO|ATENDIMENTO|CAMINHADA|APLICA[ÇC][ÃA]O|ENCAMINHAMENTOS|NOITE;?)\b/i.test(line);

    let lineCat = currentCat;
    if (/^[*•\-\s]*NOITE[;:]?/i.test(line)) {
      lineCat = 'Noite';
      line = line.replace(/^[*•\-\s]*NOITE[;:]?\s*/i, '');
    }

    if ((isBullet || isNumbered || isAction || lineCat === 'Noite') && currentItem.length > 0) {
      const joined = currentItem.join(' ').trim();
      if (joined.length > 3) {
        items.push({ text: joined, category: currentCat });
      }
      currentItem = [];
    }

    currentCat = lineCat;
    const cleanLine = line.replace(/^[*•\-\u2013\]\d\.\)]+\s*/, '').trim();
    if (cleanLine) {
      currentItem.push(cleanLine);
    }
  }

  if (currentItem.length > 0) {
    const joined = currentItem.join(' ').trim();
    if (joined.length > 3) {
      items.push({ text: joined, category: currentCat });
    }
  }

  return items;
}

/**
 * Generates an automatic short meaningful title
 */
function generateTitle(text: string, isSpecial?: string | null): string {
  if (isSpecial) return isSpecial;
  if (!text) return 'Demanda Pedagógica e Administrativa';

  const lower = text.toLowerCase();
  if (lower.includes('equipe técnica na seduc') || lower.includes('reunião com a equipe técnica')) {
    return 'Reunião com a Equipe Técnica na SEDUC';
  }
  if (lower.includes('acolhimento na chegada') || lower.includes('acolhida aos estudantes')) {
    return 'Acolhimento na chegada dos alunos e pais';
  }
  if (lower.includes('pontualidade e frequência')) {
    return 'Acompanhamento da pontualidade e frequência';
  }
  if (lower.includes('audição de leitura')) {
    return 'Aplicação da audição de leitura';
  }
  if (lower.includes('caminhada pedagógica')) {
    return 'Caminhada pedagógica e busca ativa';
  }
  if (lower.includes('quadro de infrequência')) {
    return 'Acompanhamento do quadro de infrequência';
  }
  if (lower.includes('intervalo')) {
    return 'Acompanhamento e organização do intervalo';
  }
  if (lower.includes('mentoria') && lower.includes('gestor')) {
    return 'Curso de Mentoria para Gestores';
  }
  if (lower.includes('formação continuada') || lower.includes('formação de professores')) {
    return 'Participação em Formação Continuada de Professores';
  }

  return 'Demanda Pedagógica e Administrativa';
}

/**
 * Native client-side parser for DOCX files
 */
export async function parseDocxFile(
  file: File | Blob,
  filename: string,
  defaultLocal = 'UMEIEF GONÇALA RODRIGUES DE FREITAS'
): Promise<ParseResult> {
  const warnings: string[] = [];
  const activities: AgendaActivity[] = [];

  const zip = new JSZip();
  let zipContent: JSZip;
  try {
    zipContent = await zip.loadAsync(file);
  } catch (err) {
    throw new Error(`Não foi possível ler o arquivo DOCX: ${err instanceof Error ? err.message : String(err)}`);
  }

  const documentXmlFile = zipContent.file('word/document.xml');
  if (!documentXmlFile) {
    throw new Error('Arquivo DOCX corrompido ou sem word/document.xml.');
  }

  const documentXml = await documentXmlFile.async('text');
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(documentXml, 'application/xml');

  // Check for XML parse errors
  const parseError = xmlDoc.querySelector('parsererror');
  if (parseError) {
    throw new Error('Erro ao processar a estrutura XML do DOCX.');
  }

  const tables = Array.from(xmlDoc.querySelectorAll('tbl'));
  if (tables.length === 0) {
    warnings.push(`Nenhuma tabela encontrada no arquivo ${filename}.`);
    return { activities: [], warnings, filename };
  }

  const table = tables[0];
  const rows = Array.from(table.querySelectorAll(':scope > tr, tr'));
  if (rows.length < 2) {
    warnings.push(`Tabela do arquivo ${filename} possui menos de 2 linhas.`);
    return { activities: [], warnings, filename };
  }

  // 1. Check filename dates
  let parsedDates = parseFilenameDate(filename);

  // 2. Cross-check with table header dates (critical edge case detector!)
  const { detectedStart } = extractDatesFromTableHeaders(rows);

  if (detectedStart) {
    if (!parsedDates) {
      warnings.push(`Data ausente no nome do arquivo "${filename}", recuperada do cabeçalho da tabela (${detectedStart.toLocaleDateString('pt-BR')}).`);
      parsedDates = { start: detectedStart };
    } else {
      // Check if filename had anomalous date (e.g. 01 a 29-05 when real is 01 a 05-06)
      const diffDays = Math.abs(parsedDates.start.getTime() - detectedStart.getTime()) / (1000 * 3600 * 24);
      if (diffDays > 10) {
        warnings.push(`⚠️ Data do nome do arquivo (${parsedDates.start.toLocaleDateString('pt-BR')}) inconsistente com as células da tabela (${detectedStart.toLocaleDateString('pt-BR')}). Usando a data da tabela.`);
        parsedDates.start = detectedStart;
      }
    }
  }

  if (!parsedDates) {
    warnings.push(`⚠️ Não foi possível identificar as datas automaticamente no arquivo "${filename}".`);
    return { activities: [], warnings, filename };
  }

  const startDate = parsedDates.start;
  const weekdays = ['Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira'];

  // Check layout type:
  // Layout A: Row 1 has DIA DA SEMANA
  const row1Text = (rows[1]?.textContent || '').toUpperCase();
  const isLayoutWithDiaDaSemana = row1Text.includes('DIA DA SEMANA');

  const startRowIdx = isLayoutWithDiaDaSemana ? 2 : 1;

  for (let dayOffset = 0; dayOffset < 5; dayOffset++) {
    const colIdx = isLayoutWithDiaDaSemana ? dayOffset + 1 : dayOffset;

    const currentDt = new Date(startDate);
    currentDt.setDate(currentDt.getDate() + dayOffset);

    const pad = (n: number) => n.toString().padStart(2, '0');
    const dateStr = `${pad(currentDt.getDate())}/${pad(currentDt.getMonth() + 1)}/${currentDt.getFullYear()}`;
    const dateIso = `${currentDt.getFullYear()}-${pad(currentDt.getMonth() + 1)}-${pad(currentDt.getDate())}`;

    let pedagogicoItems: string[] = [];
    let administrativoItems: string[] = [];
    let noiteItems: string[] = [];
    let isSpecial: string | null = null;

    for (let rIdx = startRowIdx; rIdx < rows.length; rIdx++) {
      const cells = Array.from(rows[rIdx].querySelectorAll(':scope > tc, tc'));
      if (colIdx >= cells.length) continue;

      const cell = cells[colIdx];
      const cellText = cleanText(cell.textContent || '');
      if (!cellText) continue;

      const upper = cellText.toUpperCase();
      if (upper.includes('HORÁRIO') || upper.includes('HORARIO')) continue;

      if (upper.includes('FERIADO') || upper.includes('FERAIADO')) {
        if (upper.includes('INDEPEND')) {
          isSpecial = 'Feriado Nacional - Independência do Brasil';
        } else if (upper.includes('ESTADUAL')) {
          isSpecial = 'Feriado Estadual';
        } else {
          isSpecial = 'Feriado';
        }
      } else if (upper.includes('FACULTATIVO')) {
        isSpecial = 'Ponto Facultativo';
      } else if (upper.includes('ATESTADO')) {
        isSpecial = 'Atestado Médico';
      } else if (upper.includes('JÚRI') || upper.includes('JURI')) {
        isSpecial = 'Participar de Júri';
      }

      // Determine category hint from first column or cell text
      let defaultCat = 'Pedagógico';
      if (isLayoutWithDiaDaSemana && cells[0]) {
        const rowLabel = (cells[0].textContent || '').toUpperCase();
        if (rowLabel.includes('ADMINISTRATIV')) defaultCat = 'Administrativo';
        else if (rowLabel.includes('NOITE')) defaultCat = 'Noite';
      } else {
        if (upper.includes('ADMINISTRATIV')) defaultCat = 'Administrativo';
        else if (upper.includes('NOITE')) defaultCat = 'Noite';
      }

      const items = splitItems(cellText, defaultCat);
      for (const it of items) {
        if (it.category === 'Noite') {
          noiteItems.push(it.text);
        } else if (it.category === 'Administrativo') {
          administrativoItems.push(it.text);
        } else {
          pedagogicoItems.push(it.text);
        }
      }
    }

    // Deduplicate
    pedagogicoItems = Array.from(new Set(pedagogicoItems));
    administrativoItems = Array.from(new Set(administrativoItems));
    noiteItems = Array.from(new Set(noiteItems));

    let fullDesc = '';
    let title = '';

    if (isSpecial && pedagogicoItems.length === 0 && administrativoItems.length === 0) {
      fullDesc = isSpecial;
      title = isSpecial;
    } else {
      const descParts: string[] = [];
      if (pedagogicoItems.length > 0) {
        descParts.push('PEDAGÓGICO');
        for (const it of pedagogicoItems) {
          descParts.push(`- ${it.replace(/[;.,\s]+$/, '')};`);
        }
      }
      if (administrativoItems.length > 0) {
        if (descParts.length > 0) descParts.push('');
        descParts.push('ADMINISTRATIVO');
        for (const it of administrativoItems) {
          descParts.push(`- ${it.replace(/[;.,\s]+$/, '')};`);
        }
      }
      if (noiteItems.length > 0) {
        if (descParts.length > 0) descParts.push('');
        descParts.push('NOITE');
        for (const it of noiteItems) {
          descParts.push(`- ${it.replace(/[;.,\s]+$/, '')};`);
        }
      }

      fullDesc = descParts.join('\n');
      title = generateTitle(fullDesc, isSpecial);
    }

    if (!fullDesc) continue;

    const loc = defaultLocal;

    activities.push({
      id: `${filename}-${dateIso}-${dayOffset}`,
      data: dateStr,
      data_iso: dateIso,
      dia_semana: weekdays[dayOffset],
      categoria: isSpecial || 'Demanda Pedagógica e Administrativa',
      titulo: title,
      descricao: fullDesc,
      local: loc,
      origem_arquivo: filename,
      selecionado: true
    });
  }

  return {
    activities,
    warnings,
    detectedStartDate: startDate.toISOString().split('T')[0],
    filename
  };
}
