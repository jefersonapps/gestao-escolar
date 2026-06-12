import PptxGenJS from 'pptxgenjs';
import { open, save } from '@tauri-apps/plugin-dialog';
import { writeFile } from '@tauri-apps/plugin-fs';
import { join } from '@tauri-apps/api/path';

export type ReadingLevelId =
  | 'fluente'
  | 'nao_fluente'
  | 'frases'
  | 'palavras'
  | 'silabas'
  | 'nao_leitor'
  | 'nao_avaliado'
  | 'nao_informado';

export interface ReadingLevelDefinition {
  id: ReadingLevelId;
  label: string;
  shortLabel: string;
  color: string;
}

export interface CustomChartStudent {
  id: string;
  name: string;
  levelId: ReadingLevelId;
}

export interface CustomChartClass {
  id: string;
  name: string;
  students: CustomChartStudent[];
}

export interface ReadingChartGenerationOptions {
  title: string;
  editionLabel: string;
  classes: CustomChartClass[];
}

export interface ReadingSummary {
  total: number;
  counts: Record<ReadingLevelId, number>;
}

export const READING_LEVELS: ReadingLevelDefinition[] = [
  { id: 'fluente', label: 'Fluente', shortLabel: 'Fluente', color: '154C38' },
  { id: 'nao_fluente', label: 'Não Fluente', shortLabel: 'Não Fluente', color: '1F6E53' },
  { id: 'frases', label: 'Frases', shortLabel: 'Frases', color: '00C590' },
  { id: 'palavras', label: 'Palavras', shortLabel: 'Palavras', color: '2E5C8F' },
  { id: 'silabas', label: 'Sílabas', shortLabel: 'Sílabas', color: '5A9BD5' },
  { id: 'nao_leitor', label: 'Não Leitor', shortLabel: 'Não Leitor', color: '707070' },
  { id: 'nao_avaliado', label: 'Não Avaliado', shortLabel: 'Não Aval.', color: 'FFC000' },
  { id: 'nao_informado', label: 'Não Informado', shortLabel: 'Não Inf.', color: 'FF7C80' },
];

const emptyCounts = (): Record<ReadingLevelId, number> => ({
  fluente: 0,
  nao_fluente: 0,
  frases: 0,
  palavras: 0,
  silabas: 0,
  nao_leitor: 0,
  nao_avaliado: 0,
  nao_informado: 0,
});

const sanitizeText = (text: string | number | undefined | null): string => {
  if (text === undefined || text === null) return '';
  return String(text)
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
    .trim();
};

const sanitizeFileName = (text: string) =>
  text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 80) || 'graficos';

const percent = (value: number, total: number) => (total > 0 ? value / total : 0);

export const getReadingSummary = (students: CustomChartStudent[]): ReadingSummary => {
  const counts = emptyCounts();

  students.forEach((student) => {
    counts[student.levelId] += 1;
  });

  return {
    total: students.length,
    counts,
  };
};

export const normalizeReadingLevel = (value: string | undefined | null): ReadingLevelId => {
  const normalized = (value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (normalized.includes('fluente') && !normalized.includes('nao')) return 'fluente';
  if (normalized.includes('nao') && normalized.includes('fluente')) return 'nao_fluente';
  if (normalized.includes('frases')) return 'frases';
  if (normalized.includes('palavras')) return 'palavras';
  if (normalized.includes('silabas')) return 'silabas';
  if (normalized.includes('nao') && normalized.includes('leitor')) return 'nao_leitor';
  if (normalized.includes('nao') && normalized.includes('avaliado')) return 'nao_avaliado';
  if (normalized.includes('nao') && normalized.includes('informado')) return 'nao_informado';

  return 'nao_informado';
};

const addReadingSummarySlide = (
  pres: PptxGenJS,
  classData: CustomChartClass,
  title: string,
  editionLabel: string,
) => {
  const slide = pres.addSlide();
  const summary = getReadingSummary(classData.students);
  const labels = [editionLabel];

  slide.addText(`${sanitizeText(title)} - ${sanitizeText(classData.name)}`, {
    x: 0.5,
    y: 0.25,
    w: 9,
    h: 0.55,
    fontSize: 22,
    color: '2E4053',
    bold: true,
    align: 'center',
    fontFace: 'Arial',
    fit: 'shrink',
  });

  const chartData = READING_LEVELS.map((level) => ({
    name: level.label,
    labels,
    values: [percent(summary.counts[level.id], summary.total)],
  }));

  slide.addChart(pres.ChartType.bar, chartData, {
    x: 0.55,
    y: 1.05,
    w: 8.9,
    h: 2.35,
    barDir: 'bar',
    barGrouping: 'stacked',
    chartColors: READING_LEVELS.map((level) => level.color),
    dataLabelFormatCode: '0%;;',
    dataLabelFontSize: 9,
    dataLabelColor: 'FFFFFF',
    dataLabelPosition: 'ctr',
    showValue: true,
    showLegend: true,
    legendPos: 'b',
    legendFontSize: 9,
    valAxisMaxVal: 1,
    valAxisLabelFormatCode: '0%',
    catAxisLabelFontSize: 9,
    valAxisLabelFontSize: 9,
  });

  const headers = ['Edições', 'Total de Alunos', ...READING_LEVELS.map((level) => level.shortLabel)];
  const row = [
    { text: sanitizeText(editionLabel), options: { bold: true, align: 'left' as const } },
    { text: String(summary.total) },
    ...READING_LEVELS.map((level) => {
      const count = summary.counts[level.id];
      const pct = summary.total > 0 ? ((count / summary.total) * 100).toFixed(1) : '0.0';
      return { text: `${count}\n(${pct}%)` };
    }),
  ];

  const headerRow = headers.map((header) => ({
    text: header,
    options: {
      fill: { color: 'FFFFFF' },
      bold: true,
      color: '333333',
      border: { pt: 1, color: 'B8D4C0' },
      fontSize: 8,
      valign: 'middle' as const,
    },
  }));

  slide.addTable([headerRow, row], {
    x: 0.55,
    y: 4.25,
    w: 8.9,
    colW: [1.95, 0.95, 0.75, 0.85, 0.7, 0.7, 0.7, 0.82, 0.87, 0.86],
    fontSize: 8,
    color: '2E4053',
    align: 'center',
    valign: 'middle',
    border: { pt: 1, color: 'B8D4C0' },
    rowH: 0.38,
  });
};

export const generateReadingChartPresentation = async (
  options: ReadingChartGenerationOptions,
): Promise<string | null> => {
  const pres = new PptxGenJS();
  pres.layout = 'LAYOUT_16x9';
  pres.author = 'Gestão Escolar';
  pres.subject = 'Gráficos personalizados';
  pres.title = options.title;

  options.classes.forEach((classData) => {
    addReadingSummarySlide(pres, classData, options.title, options.editionLabel);
  });

  const blob = (await pres.write({ outputType: 'blob' })) as Blob;
  const filePath = await save({
    filters: [{ name: 'PowerPoint', extensions: ['pptx'] }],
    defaultPath: `${sanitizeFileName(options.title)}.pptx`,
  });

  if (!filePath) return null;

  const arrayBuffer = await blob.arrayBuffer();
  await writeFile(filePath, new Uint8Array(arrayBuffer));
  return filePath;
};

const drawText = (
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  align: CanvasTextAlign = 'left',
) => {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = '';

  words.forEach((word) => {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  });

  if (line) lines.push(line);

  ctx.textAlign = align;
  lines.forEach((lineText, index) => {
    ctx.fillText(lineText, x, y + index * lineHeight, maxWidth);
  });

  return lines.length * lineHeight;
};

const drawReadingBlock = (
  ctx: CanvasRenderingContext2D,
  classData: CustomChartClass,
  title: string,
  editionLabel: string,
  yOffset: number,
  width: number,
  blockHeight: number,
) => {
  const summary = getReadingSummary(classData.students);
  const centerX = width / 2;
  const contentX = 95;
  const contentW = width - contentX * 2;

  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, yOffset, width, blockHeight);

  ctx.strokeStyle = '#E5E7EB';
  ctx.lineWidth = 2;
  ctx.strokeRect(contentX, yOffset + 45, contentW, blockHeight - 90);

  ctx.fillStyle = '#2E4053';
  ctx.font = '700 28px Arial';
  ctx.textAlign = 'center';
  drawText(ctx, `${title} - ${classData.name}`, centerX, yOffset + 90, contentW - 120, 34, 'center');

  const barX = contentX + 350;
  const barY = yOffset + 260;
  const barW = contentW - 520;
  const barH = 130;
  const labelX = contentX + 95;

  ctx.strokeStyle = '#D8E4DC';
  ctx.beginPath();
  ctx.moveTo(barX, yOffset + 165);
  ctx.lineTo(barX, yOffset + 465);
  ctx.stroke();

  ctx.fillStyle = '#6B7280';
  ctx.font = '700 20px Arial';
  ctx.textAlign = 'left';
  ctx.fillText(editionLabel, labelX, barY + 73, 240);

  let currentX = barX;
  READING_LEVELS.forEach((level) => {
    const count = summary.counts[level.id];
    const segmentW = summary.total > 0 ? (count / summary.total) * barW : 0;
    if (segmentW <= 0) return;

    ctx.fillStyle = `#${level.color}`;
    ctx.fillRect(currentX, barY, segmentW, barH);

    if (segmentW >= 42) {
      const pct = Math.round((count / summary.total) * 100);
      ctx.font = '700 20px Arial';
      ctx.textAlign = 'center';
      ctx.lineWidth = 4;
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.45)';
      ctx.strokeText(`${pct}%`, currentX + segmentW / 2, barY + 76);
      ctx.fillStyle = '#FFFFFF';
      ctx.fillText(`${pct}%`, currentX + segmentW / 2, barY + 76);
    }

    currentX += segmentW;
  });

  const legendY = yOffset + 520;
  let legendX = centerX - 455;
  READING_LEVELS.forEach((level) => {
    ctx.fillStyle = `#${level.color}`;
    ctx.beginPath();
    ctx.arc(legendX, legendY, 9, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#334155';
    ctx.font = '700 17px Arial';
    ctx.textAlign = 'left';
    ctx.fillText(level.label, legendX + 18, legendY + 6);
    legendX += Math.max(105, ctx.measureText(level.label).width + 55);
  });

  const tableY = yOffset + 665;
  const tableX = contentX + 80;
  const tableW = contentW - 160;
  const headers = ['Edições', 'Total de\nAlunos', ...READING_LEVELS.map((level) => level.shortLabel.replace(' ', '\n'))];
  const colWeights = [2.2, 1.2, 0.95, 1.1, 0.85, 0.9, 0.85, 1.05, 1.08, 1.08];
  const weightTotal = colWeights.reduce((sum, item) => sum + item, 0);
  const colWidths = colWeights.map((weight) => (weight / weightTotal) * tableW);
  const rowH = 82;

  ctx.strokeStyle = '#B8D4C0';
  ctx.lineWidth = 1.5;
  ctx.fillStyle = '#2E4053';
  ctx.font = '700 21px Arial';
  ctx.textAlign = 'center';

  let x = tableX;
  headers.forEach((header, index) => {
    if (index > 0) {
      ctx.beginPath();
      ctx.moveTo(x, tableY);
      ctx.lineTo(x, tableY + rowH * 2);
      ctx.stroke();
    }
    drawText(ctx, header, x + colWidths[index] / 2, tableY + 34, colWidths[index] - 12, 23, 'center');
    x += colWidths[index];
  });

  ctx.font = '700 21px Arial';
  ctx.textAlign = 'left';
  ctx.fillText(editionLabel, tableX + 8, tableY + rowH + 50, colWidths[0] - 16);

  ctx.font = '400 21px Arial';
  x = tableX + colWidths[0];
  ctx.textAlign = 'center';
  ctx.fillText(String(summary.total), x + colWidths[1] / 2, tableY + rowH + 40);
  x += colWidths[1];

  READING_LEVELS.forEach((level, index) => {
    const count = summary.counts[level.id];
    const pct = summary.total > 0 ? ((count / summary.total) * 100).toFixed(1) : '0.0';
    ctx.fillText(String(count), x + colWidths[index + 2] / 2, tableY + rowH + 28);
    ctx.fillText(`(${pct}%)`, x + colWidths[index + 2] / 2, tableY + rowH + 58);
    x += colWidths[index + 2];
  });
};

export const generateReadingChartPng = async (
  options: ReadingChartGenerationOptions,
): Promise<string | null> => {
  const width = 1600;
  const blockHeight = 900;

  const directoryPath = await open({
    directory: true,
    multiple: false,
    title: 'Selecione onde salvar as imagens PNG',
  });

  if (!directoryPath || typeof directoryPath !== 'string') return null;

  for (let index = 0; index < options.classes.length; index++) {
    const classData = options.classes[index];
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = blockHeight;

    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Não foi possível criar a imagem.');

    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    drawReadingBlock(ctx, classData, options.title, options.editionLabel, 0, width, blockHeight);

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png', 1));
    if (!blob) throw new Error('Não foi possível converter a imagem.');

    const fileName = `${String(index + 1).padStart(2, '0')}_${sanitizeFileName(classData.name)}.png`;
    const filePath = await join(directoryPath, fileName);
    const arrayBuffer = await blob.arrayBuffer();
    await writeFile(filePath, new Uint8Array(arrayBuffer));
  }

  return directoryPath;
};
