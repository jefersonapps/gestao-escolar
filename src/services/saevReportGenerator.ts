import PptxGenJS from 'pptxgenjs';
import { save } from '@tauri-apps/plugin-dialog';
import { writeFile } from '@tauri-apps/plugin-fs';
import type { PresentationConfig, EvolutionRow, LevelsSummaryRow, HistoryStudent, FluencyDetailRow, ClassData } from '../types';

// Colors extracted from screenshots
const PALETTE = {
  bgGreen: 'F0F5E5', 
  headerText: '2E4053', 
  
  // Matrix
  correct: 'D5E8D4', // Light Green
  correctText: '006100',
  wrong: 'F4CCCC', // Light Red/Pink
  wrongText: '9C0006',
  
  // Levels / Charts
  // From "Nível de Leitura - Distribuição" screenshot
  colorFluente: '154C38', // Very dark green
  colorNaoFluente: '1F6E53', // Dark teal
  colorFrases: '00C590', // Bright teal/green
  colorPalavras: '2E5C8F', // Blue (darkened for better contrast with white text)
  colorSilabas: '5A9BD5', // Light Blue (darkened for better contrast with white text)
  colorNaoLeitor: '707070', // Grey
  colorNaoAvaliado: 'FFC000', // Yellow/Orange
  colorNaoInformado: 'FF7C80', // Pink/Salmon
  
  // Evolution Chart
  evoPart: '4472C4', // Blue
  evoRes: 'ED7D31',  // Orange
  evoResGreen: '00B050', // Green used in some bars
  evoResRed: 'C00000',   // Red used in some bars
};

// --- Helper Functions ---

const cleanEditionTitle = (edicao: string) => {
    if (!edicao) return { text: "Avaliação", year: new Date().getFullYear().toString() };
    
    // Extract year if present at start (e.g. "2026 - ...")
    const yearMatch = edicao.match(/^(\d{4})/);
    const year = yearMatch ? yearMatch[1] : new Date().getFullYear().toString();

    // Clean text: remove year prefix, expand abbreviations
    let text = edicao.replace(/^\d{4}\s*-\s*/, ''); 
    text = text.replace(/Av\./gi, 'Avaliação');
    text = text.replace(/Diag\./gi, 'Diagnóstica');
    text = text.replace(/Form\./gi, 'Formativa');
    text = text.replace(/Avaliaçâo/gi, 'Avaliação'); // Fix common typos
    
    return { text: text.trim(), year };
};


const generateCoverSlide = (pres: PptxGenJS, config: any) => {
    const slide = pres.addSlide();
    const edicaoRaw = config.edicaoLabel || config.edicao || '';
    const { text: editionName, year } = cleanEditionTitle(edicaoRaw);

    // Set background image
    slide.background = { path: '/images/slide-background.png' };

    // Logos
    slide.addImage({ path: '/images/logo-Goncala.png', x: 0.5, y: 0.3, w: 1.2, h: 1.2 });
    slide.addImage({ path: '/images/logo-SEDUC.png', x: 7.2, y: 0.3, w: 2.3, h: 1.0 });

    // Main Title
    slide.addText(`${editionName} - ${year}`, {
        x: 0.5, y: 2.5, w: 9.0,
        fontSize: 32, bold: true, align: 'center', color: '000000', fontFace: 'Arial'
    });

    // Subtitle
    slide.addText(`Resultados obtidos na ${editionName} de ${year}`, {
        x: 0.5, y: 3.8, w: 9.0,
        fontSize: 22, align: 'center', color: '333333', fontFace: 'Arial'
    });
};

const generateFinalSlide = (pres: PptxGenJS) => {
    const slide = pres.addSlide();
    
    // Set background image
    slide.background = { path: '/images/slide-background.png' };

    // Main Text
    slide.addText('Obrigado pela atenção!', {
        x: 0.5, y: 1.5, w: 9.0,
        fontSize: 48, bold: true, align: 'center', color: '000000', fontFace: 'Arial'
    });

    // Quote
    slide.addText('"Educai as crianças para que não seja necessário punir os adultos."', {
        x: 1.0, y: 3.5, w: 8.0,
        fontSize: 32, italic: true, align: 'right', color: '000000', fontFace: 'Arial'
    });

    // Author
    slide.addText('Pitágoras', {
        x: 1.0, y: 4.5, w: 8.0,
        fontSize: 28, bold: true, align: 'right', color: '000000', fontFace: 'Arial'
    });
};

// Sanitize text for XML/Office compatibility
const sanitizeText = (text: string | number | undefined | null): string => {
  if (text === undefined || text === null) return '';
  
  const str = String(text);
  
  // Remove or replace XML-invalid characters
  return str
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, '') // Control characters
    .replace(/&/g, '&amp;')  // Ampersand
    .replace(/</g, '&lt;')   // Less than
    .replace(/>/g, '&gt;')   // Greater than
    .replace(/"/g, '&quot;') // Quote
    .replace(/'/g, '&apos;') // Apostrophe
    .trim();
};

// --- Generators ---



const generateLevelsSlide = (pres: PptxGenJS, data: LevelsSummaryRow[], _className: string) => {
  const slide = pres.addSlide();
  slide.addText("Nível de Leitura - Distribuição", { x: 0.5, y: 0.3, fontSize: 18, color: PALETTE.headerText, bold: true });

  // Reverse data for chart so that the first item (Diagnóstica) appears at the top
  const chartDataSrc = [...data].reverse();
  const labels = chartDataSrc.map(d => d.edicao);
  
  // Calculate Percentages for Chart (Decimal 0-1 for proper formatting)
  const calcPct = (val: number, total: number) => total > 0 ? (val / total) : 0;

  const chartData = [
    { name: 'Fluente', labels, values: chartDataSrc.map(d => calcPct(d.fluente, d.total_alunos)) },
    { name: 'Não Fluente', labels, values: chartDataSrc.map(d => calcPct(d.nao_fluente, d.total_alunos)) },
    { name: 'Frases', labels, values: chartDataSrc.map(d => calcPct(d.frases, d.total_alunos)) },
    { name: 'Palavras', labels, values: chartDataSrc.map(d => calcPct(d.palavras, d.total_alunos)) },
    { name: 'Sílabas', labels, values: chartDataSrc.map(d => calcPct(d.silabas, d.total_alunos)) },
    { name: 'Não Leitor', labels, values: chartDataSrc.map(d => calcPct(d.nao_leitor, d.total_alunos)) },
    { name: 'Não Avaliado', labels, values: chartDataSrc.map(d => calcPct(d.nao_avaliado, d.total_alunos)) },
    { name: 'Não Informado', labels, values: chartDataSrc.map(d => calcPct(d.nao_informado, d.total_alunos)) },
  ];

  slide.addChart(pres.ChartType.bar, chartData, {
    x: 0.5, y: 0.6, w: 9, h: 2.5,
    barDir: 'bar',
    barGrouping: 'stacked',
    chartColors: [
        PALETTE.colorFluente, 
        PALETTE.colorNaoFluente, 
        PALETTE.colorFrases, 
        PALETTE.colorPalavras, 
        PALETTE.colorSilabas, 
        PALETTE.colorNaoLeitor,
        PALETTE.colorNaoAvaliado,
        PALETTE.colorNaoInformado
    ],
    dataLabelFormatCode: '0%;;', 
    dataLabelFontSize: 9,
    showValue: true,
    dataLabelColor: 'FFFFFF', 
    dataLabelPosition: 'ctr',
    showLegend: true,
    legendPos: 'b', 
    legendFontSize: 9,
    valAxisMaxVal: 1.0,
    valAxisLabelFormatCode: '0%',
    catAxisLabelFontSize: 9, 
    valAxisLabelFontSize: 9  
  });

  const headers = ['Edições', 'Total', 'Fluente', 'Não Fluente', 'Frases', 'Palavras', 'Sílabas', 'Não Leitor', 'Não Aval.', 'Não Inf.'];
  
  const headerRow = headers.map(h => ({
    text: h,
    options: { fill: { color: 'F2F2F2' }, bold: true, color: '333333', border: { pt: 1, color: 'DDDDDD' }, fontSize: 7 }
  }));

  const rows = data.map(d => {
    const fmt = (val: number) => {
        const pct = d.total_alunos > 0 ? ((val / d.total_alunos) * 100).toFixed(1) : '0';
        return `${val}\n(${pct}%)`;
    };
    return [
        { text: d.edicao, options: { bold: true, align: 'left' as const } },
        { text: String(d.total_alunos || '-') },
        { text: fmt(d.fluente) },
        { text: fmt(d.nao_fluente) },
        { text: fmt(d.frases) },
        { text: fmt(d.palavras) },
        { text: fmt(d.silabas) },
        { text: fmt(d.nao_leitor) },
        { text: fmt(d.nao_avaliado) },
        { text: fmt(d.nao_informado) }
    ];
  });

  slide.addTable([headerRow, ...rows], {
    x: 0.5, y: 3.2, w: 9,
    colW: [2.0, 0.778, 0.778, 0.778, 0.778, 0.778, 0.778, 0.778, 0.778, 0.778],
    fontSize: 7,
    align: 'center' as const,
    border: { pt: 1, color: 'DDDDDD' },
    rowH: 0.25 
  });
};

const generateFluencyChartSlide = (pres: PptxGenJS, data: FluencyDetailRow[], className: string) => {
  const slide = pres.addSlide();
  
  slide.addText(className, { 
    x: 0.5, y: 0.5, w: '90%', fontSize: 44, color: '000000', bold: true, align: 'center', fontFace: 'Arial'
  });

  const counts = {
    fluente: 0,
    nao_fluente: 0,
    frases: 0,
    palavras: 0,
    silabas: 0,
    nao_leitor: 0,
    nao_avaliado: 0,
    nao_informado: 0
  };

  data.forEach(row => {
    const nivel = (row.nivel || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, '_');
    if (nivel.includes('fluente') && !nivel.includes('nao')) counts.fluente++;
    else if (nivel.includes('nao') && nivel.includes('fluente')) counts.nao_fluente++;
    else if (nivel.includes('frases')) counts.frases++;
    else if (nivel.includes('palavras')) counts.palavras++;
    else if (nivel.includes('silabas')) counts.silabas++;
    else if (nivel.includes('nao') && nivel.includes('leitor')) counts.nao_leitor++;
    else if (nivel.includes('nao') && nivel.includes('avaliado')) counts.nao_avaliado++;
    else if (nivel.includes('nao') && nivel.includes('informado')) counts.nao_informado++;
  });

  const labels = ['Fluente', 'Não Fluente', 'Frases', 'Palavras', 'Sílabas', 'Não Leitor', 'Não Avaliado', 'Não informado'];
  const values = [
    counts.fluente,
    counts.nao_fluente,
    counts.frases,
    counts.palavras,
    counts.silabas,
    counts.nao_leitor,
    counts.nao_avaliado,
    counts.nao_informado
  ];

  slide.addChart(pres.ChartType.bar, [
    { name: 'Qtd Estudantes', labels, values }
  ], {
    x: 0.5, y: 1.5, w: 9, h: 3.5,
    barDir: 'col',
    barGrouping: 'standard',
    chartColors: [
      PALETTE.colorFluente,
      PALETTE.colorNaoFluente,
      PALETTE.colorFrases,
      PALETTE.colorPalavras,
      PALETTE.colorSilabas,
      PALETTE.colorNaoLeitor,
      PALETTE.colorNaoAvaliado,
      PALETTE.colorNaoInformado
    ],
    showValue: true,
    showLegend: false,
    valAxisMinVal: 0,
    catAxisLabelFontSize: 10,
    valAxisLineShow: false,
    catAxisLineShow: true
  });
};

const generateFluencyTableSlide = async (pres: PptxGenJS, data: FluencyDetailRow[], className: string) => {
  const MAX_ROWS = 16;
  const chunks = [];
  const sortedData = [...data].sort((a, b) => a.nome.localeCompare(b.nome));
  
  for (let i = 0; i < sortedData.length; i += MAX_ROWS) {
    chunks.push(sortedData.slice(i, i + MAX_ROWS));
  }

  // Helper to normalize strings for comparison (lowercase, no accents, no spaces)
  const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[\s_]/g, '');

  // Define which levels are "correct" based on the year (Matriz de expectativas)
  const isLevelCorrect = (nLevel: string) => {
      const isFluente = nLevel === 'fluente';
      const isNaoFluente = nLevel === 'naofluente';
      const isFrases = nLevel === 'frases';

      // 1º Ano: Fluente, Não Fluente, Frases
      if (className.includes('1º')) {
          return isFluente || isNaoFluente || isFrases;
      }
      
      // 2º e 3º Ano: Fluente, Não Fluente
      if (className.includes('2º') || className.includes('3º')) {
          return isFluente || isNaoFluente;
      }

      // 4º ao 9º Ano: Apenas Fluente
      return isFluente;
  };

  for (const chunk of chunks) {
    const slide = pres.addSlide();
    
    const headerRow = [
      { text: `Aluno (${data.length})`, options: { bold: true, fill: { color: 'F2F2F2' }, color: '333333', fontSize: 9, align: 'left' as const, valign: 'middle' as const, border: { pt: 1, color: 'DDDDDD' } } },
      { text: 'Fluente', options: { bold: true, fill: { color: 'F2F2F2' }, color: '333333', fontSize: 8, align: 'center' as const, valign: 'middle' as const, border: { pt: 1, color: 'DDDDDD' } } },
      { text: 'Não Fluente', options: { bold: true, fill: { color: 'F2F2F2' }, color: '333333', fontSize: 8, align: 'center' as const, valign: 'middle' as const, border: { pt: 1, color: 'DDDDDD' } } },
      { text: 'Frases', options: { bold: true, fill: { color: 'F2F2F2' }, color: '333333', fontSize: 8, align: 'center' as const, valign: 'middle' as const, border: { pt: 1, color: 'DDDDDD' } } },
      { text: 'Palavras', options: { bold: true, fill: { color: 'F2F2F2' }, color: '333333', fontSize: 8, align: 'center' as const, valign: 'middle' as const, border: { pt: 1, color: 'DDDDDD' } } },
      { text: 'Sílabas', options: { bold: true, fill: { color: 'F2F2F2' }, color: '333333', fontSize: 8, align: 'center' as const, valign: 'middle' as const, border: { pt: 1, color: 'DDDDDD' } } },
      { text: 'Não Leitor', options: { bold: true, fill: { color: 'F2F2F2' }, color: '333333', fontSize: 8, align: 'center' as const, valign: 'middle' as const, border: { pt: 1, color: 'DDDDDD' } } },
      { text: 'Não Avaliado', options: { bold: true, fill: { color: 'F2F2F2' }, color: '333333', fontSize: 8, align: 'center' as const, valign: 'middle' as const, border: { pt: 1, color: 'DDDDDD' } } },
      { text: 'Não Informado', options: { bold: true, fill: { color: 'F2F2F2' }, color: '333333', fontSize: 8, align: 'center' as const, valign: 'middle' as const, border: { pt: 1, color: 'DDDDDD' } } }
    ];

    const bodyRows = chunk.map(student => {
      const nLevel = norm(student.nivel || '');
      const isCorrect = isLevelCorrect(nLevel);
      const marker = isCorrect ? '✓' : '✗';
      const style = isCorrect 
        ? { fill: { color: PALETTE.correct }, align: 'center' as const, valign: 'middle' as const, border: { pt: 1, color: 'DDDDDD' }, fontSize: 11 }
        : { fill: { color: PALETTE.wrong }, align: 'center' as const, valign: 'middle' as const, border: { pt: 1, color: 'DDDDDD' }, fontSize: 11 };
      
      const emptyStyle = { align: 'center' as const, valign: 'middle' as const, border: { pt: 1, color: 'DDDDDD' } };

      return [
        { text: sanitizeText(student.nome).toUpperCase(), options: { fill: { color: 'F9F9F9' }, fontSize: 8, align: 'left' as const, valign: 'middle' as const, border: { pt: 1, color: 'DDDDDD' } } },
        { text: nLevel === 'fluente' ? marker : '', options: nLevel === 'fluente' ? style : emptyStyle },
        { text: nLevel === 'naofluente' ? marker : '', options: nLevel === 'naofluente' ? style : emptyStyle },
        { text: nLevel === 'frases' ? marker : '', options: nLevel === 'frases' ? style : emptyStyle },
        { text: nLevel === 'palavras' ? marker : '', options: nLevel === 'palavras' ? style : emptyStyle },
        { text: nLevel === 'silabas' ? marker : '', options: nLevel === 'silabas' ? style : emptyStyle },
        { text: nLevel === 'naoleitor' ? marker : '', options: nLevel === 'naoleitor' ? style : emptyStyle },
        { text: nLevel === 'naoavaliado' ? marker : '', options: nLevel === 'naoavaliado' ? style : emptyStyle },
        { text: nLevel === 'naoinformado' ? marker : '', options: nLevel === 'naoinformado' ? style : emptyStyle }
      ];
    });

    slide.addTable([headerRow, ...bodyRows], {
      x: 0.5, y: 0.2, w: 9.0,
      colW: [2.6, 0.8, 0.8, 0.8, 0.8, 0.8, 0.8, 0.8, 0.8],
      border: { pt: 1, color: 'DDDDDD' },
      rowH: 0.25
    });
  }
};


const generateHistorySlide = (pres: PptxGenJS, data: HistoryStudent[]) => {
  if (!data || data.length === 0) return;

  const getLevelColor = (level: string): string => {
    const l = level.toLowerCase().trim().replace(/\s+/g, ' ');
    
    if (l.includes('%')) {
      const percentMatch = l.match(/(\d+)%/);
      if (percentMatch) {
        const percent = parseInt(percentMatch[1]);
        if (percent === 0) return 'E91E63'; 
        if (percent >= 1 && percent < 30) return 'FF4081'; 
        if (percent >= 30 && percent < 50) return 'FF9800'; 
        if (percent >= 50 && percent < 70) return '26A69A'; 
        if (percent >= 70) return '00897B'; 
      }
    }
    
    if (l === 'fluente') return '00695C'; 
    if (l === 'não fluente' || l === 'nao fluente') return '509C83'; 
    if (l === 'frases') return '4DB6AC'; 
    if (l === 'palavras') return 'F57C00'; 
    if (l === 'sílabas' || l === 'silabas') return 'FF9800'; 
    if (l === 'não leitor' || l === 'nao leitor') return 'D32F2F'; 
    if (l === 'não avaliado' || l === 'nao avaliado') return '9E9E9E'; 
    if (l === 'não informado' || l === 'nao informado') return 'BDBDBD'; 
    
    return 'FFFFFF';
  };

  const allKeys = Object.keys(data[0].results);
  const subjectGroups = new Map<string, string[]>();
  
  allKeys.forEach(key => {
    const match = key.match(/\[(.*?)\]/);
    if (match) {
      const subject = match[1].trim().replace(/\s+/g, ' ');
      if (!subjectGroups.has(subject)) {
        subjectGroups.set(subject, []);
      }
      subjectGroups.get(subject)!.push(key);
    }
  });

  const order = ['Leitura', 'Língua Portuguesa', 'Português', 'Matemática'];
  const otherSubjects = Array.from(subjectGroups.keys()).filter(s => !order.includes(s));
  const sortedSubjects = [...order, ...otherSubjects];

  sortedSubjects.forEach(subject => {
    const columns = subjectGroups.get(subject);
    if (!columns) return; 
    const columnData = columns.map(col => {
      const editionMatch = col.match(/\[(.*?)\]\s*(.*)/);
      const edition = editionMatch ? editionMatch[2].trim() : col;
      return { col, edition };
    });

    columnData.sort((a, b) => a.edition.localeCompare(b.edition));
    const sortedColumns = columnData.map(cd => cd.col);

    const sortedStudents = [...data].sort((a, b) => a.nome.localeCompare(b.nome));

    const MAX_ROWS_PER_SLIDE = 16;
    const chunks: typeof sortedStudents[] = [];
    
    for (let i = 0; i < sortedStudents.length; i += MAX_ROWS_PER_SLIDE) {
      chunks.push(sortedStudents.slice(i, i + MAX_ROWS_PER_SLIDE));
    }

    chunks.forEach((chunk, chunkIndex) => {
      const slide = pres.addSlide();

      const titleText = chunkIndex === 0 ? `Histórico de Desempenho - ${subject}` : `Histórico de Desempenho - ${subject} (Cont.)`;
      slide.addText(titleText, {
        x: 0.5, y: 0.3, w: 9, fontSize: 16, bold: true, color: PALETTE.headerText
      });

      const headerCells = [
        { text: 'Alunos', options: { bold: true, fill: { color: 'FFFFFF' }, fontSize: 8, align: 'left' as const } }
      ];

      sortedColumns.forEach(col => {
        const editionMatch = col.match(/\[(.*?)\]\s*(.*)/);
        const edition = editionMatch ? editionMatch[2].trim() : col;
        headerCells.push({
          text: edition,
          options: { bold: true, fill: { color: 'FFFFFF' }, fontSize: 7, align: 'left' as const }
        });
      });

      const nameColWidth = 2.0;
      const remainingWidth = 9.0 - nameColWidth;
      const dataColWidth = remainingWidth / sortedColumns.length;
      const colWidths = [nameColWidth, ...Array(sortedColumns.length).fill(dataColWidth)];

      const bodyRows = chunk.map(student => {
        const studentName = sanitizeText(student.nome);
        const nameLength = studentName.length;
        
        let nameFontSize = 8;
        const charWidthPerPoint = 0.0067;
        const estimatedWidth = nameLength * charWidthPerPoint * nameFontSize;
        const availableWidth = nameColWidth * 0.9;
        
        if (estimatedWidth > availableWidth) {
          const requiredFontSize = availableWidth / (nameLength * charWidthPerPoint);
          nameFontSize = Math.max(6, Math.floor(requiredFontSize));
        }
        
        const row = [
          { text: studentName, options: { fontSize: nameFontSize, align: 'left' as const, fill: { color: 'FFFFFF' } } }
        ];

        sortedColumns.forEach(col => {
          const value = student.results[col] || '';
          const color = getLevelColor(value);
          
          row.push({
            text: sanitizeText(value),
            options: {
              fontSize: 8,
              fill: { color },
              align: 'left' as const
            }
          });
        });

        return row;
      });

      slide.addTable([headerCells, ...bodyRows], {
        x: 0.5,
        y: 0.7,
        w: 9.0,
        colW: colWidths,
        border: { pt: 1, color: 'CCCCCC' }, 
        rowH: 0.25,
        fontSize: 8,
        align: 'center',
        valign: 'middle'
      });

      const legendY = 5.2; 
      const legendStartX = 3.5 
      const squareSize = 0.12;
      const spacing = 1; 

      const legendItems = [
        { color: '00897B', label: 'Maior\nDesempenho' },
        { color: '26A69A', label: 'Desempenho\nMediano' },
        { color: 'FF9800', label: 'Abaixo da\nMédia' },
        { color: 'E91E63', label: 'Menor\nDesempenho' },
        { color: '9E9E9E', label: 'Não\nAvaliado' },
        { color: 'BDBDBD', label: 'Não\nInformado' }
      ];

      legendItems.forEach((item, index) => {
        const xPos = legendStartX + (index * spacing);
        
        slide.addShape(pres.ShapeType.rect, {
          x: xPos,
          y: legendY,
          w: squareSize,
          h: squareSize,
          fill: { color: item.color }
        });

        slide.addText(item.label, {
          x: xPos + squareSize + 0.02, 
          y: legendY - 0.01, 
          w: spacing - squareSize - 0.05,
          fontSize: 5.5,
          color: '666666',
          align: 'left',
          valign: 'top'
        });
      });
    });
  });
};

const generateEvolutionLineSlides = (pres: PptxGenJS, data: EvolutionRow[], _className: string) => {
  if (!data || data.length === 0) return;

  const editions = Array.from(new Set(data.map(d => d.edicao)));
  
  const series = {
    partMat: [] as number[], resMat: [] as number[],
    partPort: [] as number[], resPort: [] as number[],
    partLeit: [] as number[], resLeit: [] as number[]
  };

  editions.forEach(ed => {
    const rows = data.filter(d => d.edicao === ed);
    
    const getVal = (mat: string, type: 'part' | 'res') => {
      const row = rows.find(r => r.materia.toLowerCase().includes(mat.toLowerCase()));
      const val = row ? Math.round(type === 'part' ? row.participacao : row.acertos) : 0;
      return val === 0 ? null : val;
    };

    series.partMat.push(getVal('Matemática', 'part') as number);
    series.resMat.push(getVal('Matemática', 'res') as number);
    series.partPort.push(getVal('Língua Portuguesa', 'part') as number);
    series.resPort.push(getVal('Língua Portuguesa', 'res') as number);
    series.partLeit.push(getVal('Leitura', 'part') as number);
    series.resLeit.push(getVal('Leitura', 'res') as number);
  });

  const steps = [
    { 
      title: 'Evolução - Leitura',
      series: [
        { name: 'Participação Leitura', labels: editions, values: series.partLeit, color: 'FF0000' }, 
        { name: 'Resultado Leitura', labels: editions, values: series.resLeit, color: '800000' }      
      ]
    },
    { 
      title: 'Evolução - Língua Portuguesa',
      series: [
        { name: 'Participação Língua Portuguesa', labels: editions, values: series.partPort, color: '70AD47' }, 
        { name: 'Resultado Língua Portuguesa', labels: editions, values: series.resPort, color: '2E5C1F' }      
      ]
    },
    { 
      title: 'Evolução - Matemática',
      series: [
        { name: 'Participação Matemática', labels: editions, values: series.partMat, color: '4472C4' },    
        { name: 'Resultado Matemática', labels: editions, values: series.resMat, color: '1F4E78' }         
      ]
    }
  ];

  steps.forEach(step => {
    const slide = pres.addSlide();
    slide.addText(step.title, { 
      x: 0.5, y: 0.3, w: 9, fontSize: 18, color: PALETTE.headerText, bold: true, align: 'left' 
    });

    const chartData = step.series.map(s => ({
      name: s.name,
      labels: s.labels,
      values: s.values
    }));
    
    const chartColors = step.series.map(s => s.color);

    slide.addChart(pres.ChartType.line, chartData, {
      x: 0.5, y: 1.0, w: 9.0, h: 4.0,
      chartColors: chartColors,
      showLegend: true,
      legendPos: 'b',
      legendFontSize: 9,
      showValue: false, 
      lineDataSymbol: 'circle',
      lineDataSymbolSize: 8,
      lineSize: 2,
      valAxisMaxVal: 100,
      valAxisMinVal: 0,
      displayBlanksAs: 'span',
      catAxisLabelFontSize: 10,
      catAxisLabelColor: '404040',
      valAxisLabelFontSize: 10,
      valAxisLabelColor: '404040'
    });
  });
};

const generateEvolutionSlide = (pres: PptxGenJS, data: EvolutionRow[], _className: string) => {
  if (!data || data.length === 0) return;

  const slide = pres.addSlide();
  
  slide.addText("Visão Geral - Linha Evolutiva", { 
    x: 0.5, y: 0.3, w: 9, fontSize: 18, color: PALETTE.headerText, bold: true, align: 'left' 
  });

  const editions = Array.from(new Set(data.map(d => d.edicao)));
  
  const series = {
    partMat: [] as number[], resMat: [] as number[],
    partPort: [] as number[], resPort: [] as number[],
    partLeit: [] as number[], resLeit: [] as number[]
  };

  editions.forEach(ed => {
    const rows = data.filter(d => d.edicao === ed);
    
    const getVal = (mat: string, type: 'part' | 'res') => {
      const row = rows.find(r => r.materia.toLowerCase().includes(mat.toLowerCase()));
      return row ? Math.round(type === 'part' ? row.participacao : row.acertos) : 0;
    };

    series.partMat.push(getVal('Matemática', 'part'));
    series.resMat.push(getVal('Matemática', 'res'));
    series.partPort.push(getVal('Língua Portuguesa', 'part'));
    series.resPort.push(getVal('Língua Portuguesa', 'res'));
    series.partLeit.push(getVal('Leitura', 'part'));
    series.resLeit.push(getVal('Leitura', 'res'));
  });

  const chartData = [
    { name: 'Participação\nMatemática', labels: editions, values: series.partMat },
    { name: 'Resultado\nMatemática', labels: editions, values: series.resMat },
    { name: 'Participação\nLíngua Portuguesa', labels: editions, values: series.partPort },
    { name: 'Resultado\nLíngua Portuguesa', labels: editions, values: series.resPort },
    { name: 'Participação\nLeitura', labels: editions, values: series.partLeit },
    { name: 'Resultado\nLeitura', labels: editions, values: series.resLeit }
  ];

  const chartColors = ['4472C4', '255E91', '70AD47', '548235', 'FF0000', 'C00000'];

  slide.addChart(pres.ChartType.bar, chartData, {
    x: 0.25, y: 0.5, w: 9.5, h: 2.0,
    barGrouping: 'clustered',
    chartColors: chartColors,
    showLegend: true,
    legendPos: 'b',
    legendFontSize: 8,
    showValue: false,
    barGapWidthPct: 50,
    catAxisLabelFontSize: 9,
    valAxisLabelFontSize: 9,
    catAxisLabelColor: '666666',
    valAxisLabelColor: '666666',
    valAxisMaxVal: 100,
    valAxisMinVal: 0
  });

  const tableRows: any[] = [
    [
      { text: '', options: { fill: { color: 'FFFFFF' }, line: { color: 'FFFFFF' } } }, 
      { text: '', options: { fill: { color: 'FFFFFF' }, line: { color: 'FFFFFF' } } },
      { text: 'Matemática', options: { bold: true, align: 'center', fill: { color: 'FFFFFF' }, color: '666666', fontSize: 9 } },
      { text: 'Língua Portuguesa', options: { bold: true, align: 'center', fill: { color: 'FFFFFF' }, color: '666666', fontSize: 9 } },
      { text: 'Leitura', options: { bold: true, align: 'center', fill: { color: 'FFFFFF' }, color: '666666', fontSize: 9 } }
    ]
  ];

  editions.forEach((ed, idx) => {
    const bg = idx % 2 === 0 ? 'F2F2F2' : 'FFFFFF';
    const rows = data.filter(d => d.edicao === ed);
    
    const getVal = (mat: string, type: 'part' | 'res') => {
      const row = rows.find(r => r.materia.toLowerCase().includes(mat.toLowerCase()));
      return row ? Math.round(type === 'part' ? row.participacao : row.acertos) + '%' : '-';
    };

    tableRows.push([
      { text: ed, options: { rowspan: 2, valign: 'middle', bold: true, fill: { color: bg }, fontSize: 8, align: 'left' } },
      { text: 'Participação', options: { align: 'right', fontSize: 8, fill: { color: bg }, color: '666666' } },
      { text: getVal('Matemática', 'part'), options: { align: 'center', fontSize: 8, fill: { color: bg } } },
      { text: getVal('Língua Portuguesa', 'part'), options: { align: 'center', fontSize: 8, fill: { color: bg } } },
      { text: getVal('Leitura', 'part'), options: { align: 'center', fontSize: 8, fill: { color: bg } } }
    ]);

    tableRows.push([
      { text: 'Resultado', options: { align: 'right', fontSize: 8, fill: { color: bg }, color: '666666' } },
      { text: getVal('Matemática', 'res'), options: { align: 'center', fontSize: 8, fill: { color: bg } } },
      { text: getVal('Língua Portuguesa', 'res'), options: { align: 'center', fontSize: 8, fill: { color: bg } } },
      { text: getVal('Leitura', 'res'), options: { align: 'center', fontSize: 8, fill: { color: bg } } }
    ]);
  });

  slide.addTable(tableRows, {
    x: 0.25, y: 2.5, w: 9.5,
    colW: [2.5, 1.5, 1.83, 1.83, 1.83],
    border: { pt: 0, color: 'FFFFFF' },
    rowH: 0.18
  });
};

const generateMatrixSlide = async (pres: PptxGenJS, data: FluencyDetailRow[], _className: string) => {
  if (!data || data.length === 0) return;

  let maxQ = 0;
  data.forEach(d => {
    if (d.questions instanceof Map) {
        d.questions.forEach((_, qNum) => {
            if (qNum > maxQ) maxQ = qNum;
        });
    } else if (d.questions && typeof d.questions === 'object') {
        Object.keys(d.questions).forEach(k => {
            const qNum = parseInt(k);
            if (!isNaN(qNum) && qNum > maxQ) maxQ = qNum;
        });
    }
  });
  
  // Safety cap to avoid memory issues with huge question counts
  const numQuestions = Math.min(maxQ > 0 ? maxQ : 20, 60);
  console.log(`[ReportGenerator] Generating Matrix slide for ${data.length} students with ${numQuestions} questions.`);
  const questionNums = Array.from({ length: numQuestions }, (_, i) => i + 1);

  const formatLevelText = (text: string) => {
    if (!text) return '-';
    const n = text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    
    if (n.includes('fluente') && !n.includes('nao')) return 'Fluente';
    if (n.includes('nao') && n.includes('fluente')) return 'Não Fluente';
    if (n.includes('frases')) return 'Frases';
    if (n.includes('palavras')) return 'Palavras';
    if (n.includes('silabas')) return 'Sílabas';
    if (n.includes('nao') && n.includes('leitor')) return 'Não Leitor';
    if (n.includes('nao') && n.includes('avaliado')) return 'Não Avaliado';
    if (n.includes('nao') && n.includes('informado')) return 'Não Informado';
    return text.replace(/\b\w/g, c => c.toUpperCase());
  };

  const headers = [
    { text: `Alunos (${data.length})`, options: { bold: true, align: 'left' as const, valign: 'bottom' as const, fill: { color: 'F2F2F2' }, fontSize: numQuestions > 16 ? 6 : 7 } },
    ...questionNums.map(q => ({ text: String(q), options: { bold: true, align: 'center' as const, valign: 'center' as const, fill: { color: 'F2F2F2' }, fontSize: numQuestions > 16 ? 6 : 7, margin: 0 } })),
    { text: 'MÉDIA', options: { bold: true, align: 'center' as const, valign: 'center' as const, fill: { color: 'F2F2F2' }, fontSize: numQuestions > 16 ? 6 : 7, margin: 0 } },
    { text: 'NÍVEL', options: { bold: true, align: 'center' as const, valign: 'center' as const, fill: { color: 'F2F2F2' }, fontSize: numQuestions > 16 ? 6 : 7, margin: 0 } },
    { text: 'LEITURA', options: { bold: true, align: 'center' as const, valign: 'center' as const, fill: { color: 'F2F2F2' }, fontSize: numQuestions > 16 ? 6 : 7, margin: 0 } }
  ];

  const sortedData = [...data].sort((a, b) => a.nome.localeCompare(b.nome));

  const rows = sortedData.map((d, index) => {
    const rowBg = index % 2 === 0 ? 'F9F9F9' : 'FFFFFF'; 
    
    const qCells = questionNums.map(q => {
        let qData: any = null;
        if (d.questions instanceof Map) {
          qData = d.questions.get(q);
        } else if (d.questions && typeof d.questions === 'object') {
          // Fallback for serialized objects
          qData = (d.questions as any)[q] || (d.questions as any)[String(q)];
        }

        let fill = rowBg;
        let text = '-';
        
        if (qData) {
            text = sanitizeText(qData.answer || '-');
            if (qData.correct) {
                fill = PALETTE.correct;
            } else {
                fill = PALETTE.wrong;
            }
        }
        
        return { text, options: { align: 'center' as const, fill: { color: fill }, fontSize: numQuestions > 16 ? 6 : 8 } };
    });

    let media = d.media || '';
    if (!media && d.questions && d.questions.size > 0) {
        let correctCount = 0;
        d.questions.forEach(q => { if (q.correct) correctCount++; });
        media = String(Math.round((correctCount / numQuestions) * 100));
    }
    if (media && !media.includes('%')) {
        media += '%';
    }

    let nivelNum = d.nivelNum || '';
    
    if (!nivelNum) {
        const n = (d.nivel || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        if (n.includes('fluente') && !n.includes('nao')) nivelNum = '4';
        else if (n.includes('frases')) nivelNum = '3';
        else if (n.includes('palavras')) nivelNum = '2';
        else if (n.includes('silabas') || n.includes('nao leitor')) nivelNum = '1';
    }
    
    const baseFontSize = numQuestions > 16 ? 6 : 8;
    const studentName = sanitizeText(d.nome);
    const nameLength = studentName.length;
    
    let nameFontSize = baseFontSize;
    
    const charWidthPerPoint = 0.0067;
    const estimatedWidth = nameLength * charWidthPerPoint * baseFontSize;
    
    if (estimatedWidth > 1.8) {
      nameFontSize = Math.max(5, Math.floor(1.8 / (nameLength * charWidthPerPoint)));
    }
    
    return [
        { text: studentName, options: { align: 'left' as const, fill: { color: rowBg }, fontSize: nameFontSize } },
        ...qCells,
        { text: sanitizeText(media), options: { align: 'center' as const, fill: { color: rowBg }, fontSize: numQuestions > 16 ? 6 : 8} },
        { text: sanitizeText(nivelNum || '-'), options: { align: 'center' as const, fill: { color: rowBg },  fontSize: numQuestions > 16 ? 6 : 8 } },
        { text: sanitizeText(formatLevelText(d.nivel)), options: { align: 'center' as const, fill: { color: rowBg }, fontSize: numQuestions > 16 ? 6 : 7 } }
    ];
  });

  const MAX_ROWS = numQuestions > 16 ? 22 : 18; 
  const chunks = [];
  for (let i = 0; i < rows.length; i += MAX_ROWS) {
    chunks.push(rows.slice(i, i + MAX_ROWS));
  }

  chunks.forEach((chunkRows, chunkIndex) => {
    if (chunkRows.length === 0) return;

    const s = pres.addSlide();
    
    const subjectName = data.length > 0 && data[0]?.materia ? data[0].materia : 'Língua Portuguesa';
    
    s.addText(`${subjectName}${chunkIndex > 0 ? ' (Cont.)' : ''}`, {
      x: 0.5, y: 0.3, w: '90%', fontSize: 18, bold: true, color: PALETTE.headerText, align: 'center'
    });

    const legendY = 0.6;
    const squareSize = 0.2;
    
    s.addShape(pres.ShapeType.rect, { x: 3.5, y: legendY, w: squareSize, h: squareSize, fill: { color: PALETTE.correct } });
    s.addText("Resposta Certa", { x: 3.8, y: legendY, w: 1.5, h: squareSize, fontSize: 9, valign: 'middle' });
    
    s.addShape(pres.ShapeType.rect, { x: 5.5, y: legendY, w: squareSize, h: squareSize, fill: { color: PALETTE.wrong } });
    s.addText("Resposta Errada", { x: 5.8, y: legendY, w: 1.5, h: squareSize, fontSize: 9, valign: 'middle' });

    const maxWidth = 9.6;
    const tableX = 0.2;
    
    let alunosWidth = numQuestions > 16 ? 1.8 : 2.2;  
    const mediaWidth = numQuestions > 16 ? 0.40 : 0.45;
    const nivelWidth = numQuestions > 16 ? 0.3 : 0.35;
    const leituraWidth = numQuestions > 16 ? 0.75 : 0.85; 
    
    const fixedWidth = alunosWidth + mediaWidth + nivelWidth + leituraWidth;
    const availableForQuestions = maxWidth - fixedWidth;
    
    let qW = availableForQuestions / numQuestions;
    
    if (qW < 0.13 && alunosWidth > 1.5) {
      alunosWidth = 1.5;
      const newFixedWidth = alunosWidth + mediaWidth + nivelWidth + leituraWidth;
      const newAvailableForQuestions = maxWidth - newFixedWidth;
      qW = newAvailableForQuestions / numQuestions;
    }
    
    const colWidths = [alunosWidth];
    for (let i = 0; i < numQuestions; i++) {
      colWidths.push(qW);
    }
    colWidths.push(mediaWidth, nivelWidth, leituraWidth);
    
    const totalWidth = colWidths.reduce((a, b) => a + b, 0);
    
    chunkRows.forEach(row => {
      const nameCell = row[0];
      const nameText = nameCell.text;
      const nameLength = nameText.length;
      
      const charWidthPerPoint = 0.008;
      const estimatedWidth = nameLength * charWidthPerPoint * nameCell.options.fontSize;
      
      const availableWidth = alunosWidth * 0.95;
      
      if (estimatedWidth > availableWidth) {
        const requiredFontSize = availableWidth / (nameLength * charWidthPerPoint);
        nameCell.options.fontSize = Math.max(5, Math.min(nameCell.options.fontSize, Math.floor(requiredFontSize)));
      }
    });
    
    s.addTable([headers, ...chunkRows], {
      x: tableX, 
      y: 0.9, 
      w: totalWidth,
      colW: colWidths,
      fontSize: numQuestions > 16 ? 7 : 8, 
      border: { pt: 0, color: 'FFFFFF' },
      autoPage: false,
      align: 'center'
    });
  });
};

interface SchoolAggregationData {
  fluencyCounts: {
    fluente: number;
    nao_fluente: number;
    frases: number;
    palavras: number;
    silabas: number;
    nao_leitor: number;
    nao_avaliado: number;
    nao_informado: number;
  };
  subjects: {
    [key: string]: {
      totalScore: number;
      studentCount: number;
    };
  };
}

const generateSchoolSummarySlide = async (pres: PptxGenJS, aggregation: SchoolAggregationData) => {
  const slide = pres.addSlide();
  
  slide.addText("Visão Geral - Resultados da Escola", { 
    x: 0.5, y: 0.3, w: 9, fontSize: 18, color: PALETTE.headerText, bold: true, align: 'center' 
  });

  const fluencyTotal = Object.values(aggregation.fluencyCounts).reduce((a, b) => a + b, 0);
  
  const fluencyLabels = ['Fluente', 'Não Fluente', 'Frases', 'Palavras', 'Sílabas', 'Não Leitor', 'Não Avaliado', 'Não Informado'];
  const fluencyValues = [
    aggregation.fluencyCounts.fluente,
    aggregation.fluencyCounts.nao_fluente,
    aggregation.fluencyCounts.frases,
    aggregation.fluencyCounts.palavras,
    aggregation.fluencyCounts.silabas,
    aggregation.fluencyCounts.nao_leitor,
    aggregation.fluencyCounts.nao_avaliado,
    aggregation.fluencyCounts.nao_informado
  ];
  
  const fluencyColors = [
    PALETTE.colorFluente,
    PALETTE.colorNaoFluente,
    PALETTE.colorFrases,
    PALETTE.colorPalavras,
    PALETTE.colorSilabas,
    PALETTE.colorNaoLeitor,
    PALETTE.colorNaoAvaliado,
    PALETTE.colorNaoInformado
  ];

  slide.addText("📚 Fluência Leitora", {
    x: 0.25, y: 0.8, w: 5.25, fontSize: 14, color: '404040', bold: true, align: 'left'
  });

  const legendLabels = fluencyLabels.map((l, i) => {
      const val = fluencyValues[i];
      const pct = fluencyTotal > 0 ? ((val / fluencyTotal) * 100).toFixed(1).replace('.', ',') : '0,0';
      return `${l} ${pct}%`;
  });

  slide.addChart(pres.ChartType.doughnut, [
    {
      name: 'Fluência',
      labels: legendLabels,
      values: fluencyValues
    }
  ], {
    x: 0.25, y: 1.2, w: 5.25, h: 3.5,
    chartColors: fluencyColors,
    dataLabelColor: 'FFFFFF',
    showValue: false,         
    showPercent: false,       
    showLegend: true,
    legendPos: 'r',           
    legendFontSize: 12,       
    holeSize: 50
  });

  const subjectsOfInterest = ['Língua Portuguesa', 'Matemática'];
  const subjectLabels: string[] = [];
  const subjectScores: number[] = [];
  
  subjectsOfInterest.forEach(subj => {
    const key = Object.keys(aggregation.subjects).find(k => k.toLowerCase().includes(subj.toLowerCase()));
    
    subjectLabels.push(subj);
    
    if (key && aggregation.subjects[key].studentCount > 0) {
      const avg = aggregation.subjects[key].totalScore / aggregation.subjects[key].studentCount;
      subjectScores.push(Math.round(avg));
    } else {
      subjectScores.push(0);
    }
  });

  slide.addText("🎯 Desempenho Acadêmico Médio (Acertos)", {
    x: 5.75, y: 0.8, w: 4.0, fontSize: 14, color: '404040', bold: true, align: 'left'
  });

  const barChartData = [
    {
      name: 'Língua Portuguesa',
      labels: ['Língua Portuguesa'],
      values: [subjectScores[0]]
    },
    {
      name: 'Matemática',
      labels: ['Matemática'],
      values: [subjectScores[1]]
    }
  ];

  slide.addChart(pres.ChartType.bar, barChartData, {
    x: 5.75, y: 1.2, w: 4.0, h: 3.5,
    barDir: 'col',
    barGrouping: 'clustered',
    chartColors: ['70AD47', '4472C4'], 
    dataLabelColor: '404040',
    dataLabelFontSize: 10,
    showValue: true,
    dataLabelFormatCode: '0"%"', 
    catAxisLabelPos: 'none',
    valAxisLabelColor: '404040',
    valAxisLabelFontSize: 11,
    valAxisMaxVal: 100,
    valAxisMinVal: 0,
    showLegend: true,
    legendPos: 'b',
    legendFontSize: 9,
    catAxisLineShow: false,
    valAxisLineShow: false
  });

};

export const generatePresentation = async (
  classes: ClassData[],
  config: PresentationConfig
): Promise<string | null> => {
  const pres = new PptxGenJS();
  pres.layout = 'LAYOUT_16x9';
  pres.title = config.title;

  // 1. Generate Cover Slide
  generateCoverSlide(pres, config);

  const schoolAggregation: SchoolAggregationData = {
    fluencyCounts: {
      fluente: 0,
      nao_fluente: 0,
      frases: 0,
      palavras: 0,
      silabas: 0,
      nao_leitor: 0,
      nao_avaliado: 0,
      nao_informado: 0
    },
    subjects: {}
  };
  console.log(`[ReportGenerator] Starting presentation generation for ${classes.length} classes.`);
  
  for (let classIndex = 0; classIndex < classes.length; classIndex++) {
    const classData = classes[classIndex];
    const { images, csvData, name: className } = classData;
    console.log(`[ReportGenerator] Processing class ${classIndex + 1}/${classes.length}: ${className}`);
    
    // Yield to main thread to prevent UI freeze
    await new Promise(resolve => setTimeout(resolve, 0));

    const fluencyDetail = csvData.find(d => d.type === 'FLUENCY_DETAIL');
    const levelsSummary = csvData.find(d => d.type === 'LEVELS_SUMMARY');
    const evolution = csvData.find(d => d.type === 'EVOLUTION');
    const history = csvData.find(d => d.type === 'HISTORY');

    if (fluencyDetail) {
      try {
        const fluencyData = fluencyDetail.data as FluencyDetailRow[];
        
        const bySubject = new Map<string, FluencyDetailRow[]>();
        fluencyData.forEach(student => {
          const subject = student.materia || 'Leitura';
          if (!bySubject.has(subject)) {
            bySubject.set(subject, []);
          }
          bySubject.get(subject)!.push(student);

          if (subject.toLowerCase().includes('leitura') || subject.toLowerCase().includes('portugu')) {
             const n = (student.nivel || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
             
             if (n.includes('fluente') && !n.includes('nao')) schoolAggregation.fluencyCounts.fluente++;
             else if (n.includes('nao') && n.includes('fluente')) schoolAggregation.fluencyCounts.nao_fluente++;
             else if (n.includes('frases')) schoolAggregation.fluencyCounts.frases++;
             else if (n.includes('palavras')) schoolAggregation.fluencyCounts.palavras++;
             else if (n.includes('silabas')) schoolAggregation.fluencyCounts.silabas++;
             else if (n.includes('nao') && n.includes('leitor')) schoolAggregation.fluencyCounts.nao_leitor++;
             else if (n.includes('nao') && n.includes('avaliado')) schoolAggregation.fluencyCounts.nao_avaliado++;
             else if (n.includes('nao') && n.includes('informado')) schoolAggregation.fluencyCounts.nao_informado++;
          }

          let score = 0;
          if (student.media) {
             const m = student.media.replace('%', '').trim();
             score = parseInt(m) || 0;
          } else if (student.questions && student.questions.size > 0) {
             let correct = 0;
             student.questions.forEach(q => { if (q.correct) correct++; });
             let maxQ = 0;
             if (student.questions) student.questions.forEach((_, k) => maxQ = Math.max(maxQ, k));
             if (maxQ > 0) score = Math.round((correct / maxQ) * 100);
          }

          if (!schoolAggregation.subjects[subject]) {
            schoolAggregation.subjects[subject] = { totalScore: 0, studentCount: 0 };
          }
          
          schoolAggregation.subjects[subject].totalScore += score;
          schoolAggregation.subjects[subject].studentCount++;
        });
        
        for (const [subject, students] of bySubject) {
          const isReadingSubject = subject.toLowerCase().includes('leitura') || 
                                   subject.toLowerCase().includes('portugu');
          
          if (isReadingSubject) {
            // Check if there is actual fluency data (not just scores)
            const hasFluencyData = students.some(s => {
                const n = (s.nivel || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
                return n.includes('fluente') || n.includes('frases') || n.includes('palavras') || 
                       n.includes('silabas') || n.includes('leitor');
            });

            if (hasFluencyData) {
              generateFluencyChartSlide(pres, students, className);
              await generateFluencyTableSlide(pres, students, className);
            }
          }
        }
      } catch (error) {
        console.error('Error generating FLUENCY chart/table slides:', error);
      }
    }

    console.log(`[ReportGenerator] Class ${className} processing complete.`);
    // Yield again
    await new Promise(resolve => setTimeout(resolve, 0));

    if (levelsSummary) {
      generateLevelsSlide(pres, levelsSummary.data as LevelsSummaryRow[], className);
    }

    if (fluencyDetail) {
      try {
        const fluencyData = fluencyDetail.data as FluencyDetailRow[];
        
        const bySubject = new Map<string, FluencyDetailRow[]>();
        fluencyData.forEach(student => {
          const subject = student.materia || 'Leitura';
          if (!bySubject.has(subject)) {
            bySubject.set(subject, []);
          }
          bySubject.get(subject)!.push(student);
        });
        
        for (const [subject, students] of bySubject) {
          // Skip Matrix table for Reading (Leitura)
          if (subject.toLowerCase().includes('leitura')) continue;
          console.log(`[ReportGenerator] Generating Matrix slide for ${subject}...`);
          await generateMatrixSlide(pres, students, className);
          // Yield between subjects
          await new Promise(resolve => setTimeout(resolve, 0));
        }
      } catch (error) {
        console.error('Error generating Matrix slides:', error);
      }
    }

    if (evolution) {
      generateEvolutionSlide(pres, evolution.data as EvolutionRow[], className);
    }

    if (history) {
      try {
        generateHistorySlide(pres, history.data as HistoryStudent[]);
      } catch (e) { 
        console.error("Error generating History slides", e); 
      }
    }

    if (evolution) {
      generateEvolutionLineSlides(pres, evolution.data as EvolutionRow[], className);
    }

    if (images.length > 0) {
      images.forEach((img) => {
        const slide = pres.addSlide();
        slide.background = { color: config.backgroundColor };
        const margin = config.margin;
        
        const availW = 10 - (margin * 2);
        const availH = 5.625 - (margin * 2);

        const imgRatio = img.width / img.height;
        const slideRatio = availW / availH;

        let newW, newH;

        if (imgRatio > slideRatio) {
          newW = availW;
          newH = newW / imgRatio;
        } else {
          newH = availH;
          newW = newH * imgRatio;
        }

        const x = margin + (availW - newW) / 2;
        const y = margin + (availH - newH) / 2;
        
        slide.addImage({
          data: img.dataUrl,
          x: x,
          y: y, 
          w: newW, 
          h: newH
        });
      });
    }
  }

  try {
     await generateSchoolSummarySlide(pres, schoolAggregation);
  } catch (err) {
     console.error("Error generating School Summary Slide:", err);
  }

  // 3. Generate Final Slide
  generateFinalSlide(pres);

  console.log(`[ReportGenerator] Finalizing presentation structure...`);
  const blob = await pres.write({ outputType: 'blob' }) as Blob;
  console.log(`[ReportGenerator] Presentation blob created (${blob.size} bytes).`);
  
  try {
    const filePath = await save({
      filters: [{
        name: 'PowerPoint',
        extensions: ['pptx']
      }],
      defaultPath: `${config.title}.pptx`
    });

    if (filePath) {
      const arrayBuffer = await blob.arrayBuffer();
      await writeFile(filePath, new Uint8Array(arrayBuffer));
      console.log(`[ReportGenerator] Presentation saved to: ${filePath}`);
      return filePath;
    }
    
    return null;
  } catch (err) {
    console.error('[ReportGenerator] Error saving file:', err);
    // Fallback for web-like environments or if plugin fails
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${config.title}.pptx`;
    a.click();
    URL.revokeObjectURL(url);
    return null;
  }
};
