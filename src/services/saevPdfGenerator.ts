import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { 
    PresentationConfig, 
    FluencyDetailRow, 
    LevelsSummaryRow, 
    EvolutionRow, 
    HistoryStudent 
} from '@/types';

type ScrapedDataset = {
    type: string;
    data?: any;
    [key: string]: any;
};

// Colors extracted from slide screenshots
const PALETTE = {
  headerText: [46, 64, 83] as [number, number, number],
  
  // Matrix
  correct: [213, 232, 212] as [number, number, number],   // Light Green #D5E8D4
  correctText: [0, 97, 0] as [number, number, number],
  wrong: [244, 204, 204] as [number, number, number],     // Light Red/Pink #F4CCCC
  wrongText: [156, 0, 6] as [number, number, number],
  
  // Levels / Charts
  colorFluente: [21, 76, 56] as [number, number, number],       // #154C38
  colorNaoFluente: [31, 110, 83] as [number, number, number],    // #1F6E53
  colorFrases: [0, 197, 144] as [number, number, number],       // #00C590
  colorPalavras: [46, 92, 143] as [number, number, number],     // #2E5C8F
  colorSilabas: [90, 155, 213] as [number, number, number],     // #5A9BD5
  colorNaoLeitor: [112, 112, 112] as [number, number, number],  // #707070
  colorNaoAvaliado: [255, 192, 0] as [number, number, number],   // #FFC000
  colorNaoInformado: [255, 124, 128] as [number, number, number],// #FF7C80
  
  // Evolution Chart
  evoPart: [68, 114, 196] as [number, number, number],
  evoRes: [237, 125, 49] as [number, number, number],
};

const cleanEditionTitle = (edicao: string) => {
    if (!edicao) return { text: "Avaliação", year: new Date().getFullYear().toString() };
    const yearMatch = edicao.match(/^(\d{4})/);
    const year = yearMatch ? yearMatch[1] : new Date().getFullYear().toString();

    let text = edicao.replace(/^\d{4}\s*-\s*/, ''); 
    text = text.replace(/Av\./gi, 'Avaliação');
    text = text.replace(/Diag\./gi, 'Diagnóstica');
    text = text.replace(/Form\./gi, 'Formativa');
    text = text.replace(/Avaliaçâo/gi, 'Avaliação');
    return { text: text.trim(), year };
};

export const generatePdfReport = async (
    allClassesData: { className: string; datasets: ScrapedDataset[] }[],
    config: PresentationConfig
): Promise<Uint8Array> => {
    const orientation = config.pdfOrientation === 'portrait' ? 'portrait' : 'landscape';
    
    const doc = new jsPDF({
        orientation: orientation,
        unit: 'mm',
        format: 'a4'
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    let isFirstPage = true;

    const newSlidePage = () => {
        if (!isFirstPage) {
            doc.addPage();
        }
        isFirstPage = false;
    };

    // --- COVER SLIDE PAGE ---
    newSlidePage();
    doc.setFillColor(30, 41, 59); // Deep Slate Navy
    doc.rect(0, 0, pageWidth, pageHeight, 'F');

    const edRaw = (config as any).edicaoLabel || (config as any).edicao || '';
    const { text: editionName, year } = cleanEditionTitle(edRaw);

    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(28);
    doc.text(`${editionName} - ${year}`, pageWidth / 2, pageHeight / 2 - 10, { align: 'center' });

    doc.setFontSize(16);
    doc.setFont('helvetica', 'normal');
    doc.text(`Resultados obtidos na ${editionName} de ${year}`, pageWidth / 2, pageHeight / 2 + 8, { align: 'center' });

    doc.setFontSize(10);
    doc.setTextColor(203, 213, 225);
    doc.text(`Gerado em ${new Date().toLocaleDateString('pt-BR')}`, pageWidth / 2, pageHeight - 15, { align: 'center' });

    // Process Classes
    for (let cIdx = 0; cIdx < allClassesData.length; cIdx++) {
        const { className, datasets } = allClassesData[cIdx];

        const fluencyDetail = datasets.find(d => d.type === 'FLUENCY_DETAIL');
        const levelsSummary = datasets.find(d => d.type === 'LEVELS_SUMMARY');
        const evolution = datasets.find(d => d.type === 'EVOLUTION');
        const history = datasets.find(d => d.type === 'HISTORY');

        // 1. FLUENCY CHART SLIDE PAGE
        if (fluencyDetail && config.includeFluency !== false) {
            const fluencyData = (fluencyDetail.data || []) as FluencyDetailRow[];
            const readingStudents = fluencyData.filter(s => 
                (s.materia || 'Leitura').toLowerCase().includes('leitura')
            );
            const targetStudents = readingStudents.length > 0 ? readingStudents : fluencyData;

            if (targetStudents.length > 0) {
                newSlidePage();

                // Slide Title (Class Name Centered)
                doc.setTextColor(PALETTE.headerText[0], PALETTE.headerText[1], PALETTE.headerText[2]);
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(24);
                doc.text(`${className} - Nível de Leitura`, pageWidth / 2, 22, { align: 'center' });

                // Calculate counts
                const counts = { fluente: 0, nao_fluente: 0, frases: 0, palavras: 0, silabas: 0, nao_leitor: 0, nao_avaliado: 0, nao_informado: 0 };
                targetStudents.forEach(row => {
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

                const chartLabels = ['Fluente', 'Não Fluente', 'Frases', 'Palavras', 'Sílabas', 'Não Leitor', 'Não Avaliado', 'Não informado'];
                const chartValues = [
                    counts.fluente, counts.nao_fluente, counts.frases, counts.palavras, counts.silabas, counts.nao_leitor, counts.nao_avaliado, counts.nao_informado
                ];
                const chartColors = [
                    PALETTE.colorFluente, PALETTE.colorNaoFluente, PALETTE.colorFrases, PALETTE.colorPalavras, PALETTE.colorSilabas, PALETTE.colorNaoLeitor, PALETTE.colorNaoAvaliado, PALETTE.colorNaoInformado
                ];

                // Draw Bar Chart
                const chartLeft = orientation === 'landscape' ? 25 : 15;
                const chartWidth = pageWidth - chartLeft * 2;
                const chartBottom = pageHeight - 30;
                const maxVal = Math.max(...chartValues, 1);
                const maxBarHeight = pageHeight - 85;

                const colGap = chartWidth / chartValues.length;
                const barW = Math.min(colGap * 0.65, 24);

                // Baseline
                doc.setDrawColor(200, 200, 200);
                doc.setLineWidth(0.5);
                doc.line(chartLeft, chartBottom, chartLeft + chartWidth, chartBottom);

                chartValues.forEach((val, idx) => {
                    const xCenter = chartLeft + idx * colGap + colGap / 2;
                    const barX = xCenter - barW / 2;
                    const bHeight = (val / maxVal) * maxBarHeight;
                    const barY = chartBottom - bHeight;

                    const color = chartColors[idx];
                    doc.setFillColor(color[0], color[1], color[2]);
                    doc.rect(barX, barY, barW, Math.max(bHeight, 0.5), 'F');

                    // Value label on top
                    doc.setFontSize(10);
                    doc.setFont('helvetica', 'bold');
                    doc.setTextColor(30, 41, 59);
                    doc.text(val.toString(), xCenter, barY - 2, { align: 'center' });

                    // Category label below
                    doc.setFontSize(8);
                    doc.setFont('helvetica', 'normal');
                    doc.setTextColor(71, 85, 105);
                    doc.text(chartLabels[idx], xCenter, chartBottom + 6, { align: 'center' });
                });

                // 2. FLUENCY STUDENT TABLE SLIDE PAGE(S)
                const MAX_ROWS = 16;
                const sortedStudents = [...targetStudents].sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));
                const studentChunks = [];
                for (let i = 0; i < sortedStudents.length; i += MAX_ROWS) {
                    studentChunks.push(sortedStudents.slice(i, i + MAX_ROWS));
                }

                const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[\s_]/g, '');
                const isLevelCorrect = (nLevel: string) => {
                    const isFluente = nLevel === 'fluente';
                    const isNaoFluente = nLevel === 'naofluente';
                    const isFrases = nLevel === 'frases';
                    if (className.includes('1º')) return isFluente || isNaoFluente || isFrases;
                    if (className.includes('2º') || className.includes('3º')) return isFluente || isNaoFluente;
                    return isFluente;
                };

                studentChunks.forEach(chunk => {
                    newSlidePage();

                    doc.setTextColor(PALETTE.headerText[0], PALETTE.headerText[1], PALETTE.headerText[2]);
                    doc.setFont('helvetica', 'bold');
                    doc.setFontSize(14);
                    doc.text(`${className} - Alunos e Níveis de Leitura`, 10, 12);

                    const tableHead = [
                        [
                            `Aluno (${targetStudents.length})`,
                            'Fluente', 'Não Fluente', 'Frases', 'Palavras', 'Sílabas', 'Não Leitor', 'Não Avaliado', 'Não Informado'
                        ]
                    ];

                    const tableBody = chunk.map(student => {
                        const nLevel = norm(student.nivel || '');
                        const isCorrect = isLevelCorrect(nLevel);
                        const marker = isCorrect ? '✓' : '✗';

                        return [
                            (student.nome || '').toUpperCase(),
                            nLevel === 'fluente' ? marker : '',
                            nLevel === 'naofluente' ? marker : '',
                            nLevel === 'frases' ? marker : '',
                            nLevel === 'palavras' ? marker : '',
                            nLevel === 'silabas' ? marker : '',
                            nLevel === 'naoleitor' ? marker : '',
                            nLevel === 'naoavaliado' ? marker : '',
                            nLevel === 'naoinformado' ? marker : ''
                        ];
                    });

                    autoTable(doc, {
                        startY: 18,
                        head: tableHead,
                        body: tableBody,
                        theme: 'grid',
                        headStyles: { fillColor: [242, 242, 242], textColor: [51, 51, 51], fontStyle: 'bold', fontSize: 8, halign: 'center' },
                        bodyStyles: { fontSize: 8, halign: 'center' },
                        columnStyles: {
                            0: { halign: 'left', cellWidth: orientation === 'landscape' ? 85 : 55, fillColor: [249, 249, 249] }
                        },
                        didParseCell: (dataCell) => {
                            if (dataCell.section === 'body' && dataCell.column.index >= 1) {
                                const val = dataCell.cell.raw;
                                if (val === '✓') {
                                    dataCell.cell.styles.fillColor = PALETTE.correct;
                                    dataCell.cell.styles.textColor = PALETTE.correctText;
                                    dataCell.cell.styles.fontStyle = 'bold';
                                } else if (val === '✗') {
                                    dataCell.cell.styles.fillColor = PALETTE.wrong;
                                    dataCell.cell.styles.textColor = PALETTE.wrongText;
                                    dataCell.cell.styles.fontStyle = 'bold';
                                }
                            }
                        },
                        margin: { left: 10, right: 10 }
                    });
                });
            }
        }

        // 3. LEVELS DISTRIBUTION SLIDE PAGE
        if (levelsSummary && config.includeLevels !== false) {
            const rows = (levelsSummary.data || []) as LevelsSummaryRow[];
            if (rows.length > 0) {
                newSlidePage();

                doc.setTextColor(PALETTE.headerText[0], PALETTE.headerText[1], PALETTE.headerText[2]);
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(18);
                doc.text(`${className} - Nível de Leitura - Distribuição`, 14, 18);

                // Table
                const headers = ['Edições', 'Total', 'Fluente', 'Não Fluente', 'Frases', 'Palavras', 'Sílabas', 'Não Leitor', 'Não Aval.', 'Não Inf.'];
                const bodyRows = rows.map(d => {
                    const total = d.total_alunos || 0;
                    const fmt = (val: number) => {
                        const pct = total > 0 ? Math.round((val / total) * 100) : 0;
                        return `${val}\n(${pct}%)`;
                    };
                    return [
                        d.edicao || '-',
                        String(total || '-'),
                        fmt(d.fluente || 0),
                        fmt(d.nao_fluente || 0),
                        fmt(d.frases || 0),
                        fmt(d.palavras || 0),
                        fmt(d.silabas || 0),
                        fmt(d.nao_leitor || 0),
                        fmt(d.nao_avaliado || 0),
                        fmt(d.nao_informado || 0)
                    ];
                });

                autoTable(doc, {
                    startY: 25,
                    head: [headers],
                    body: bodyRows,
                    theme: 'grid',
                    headStyles: { fillColor: [242, 242, 242], textColor: [51, 51, 51], fontStyle: 'bold', fontSize: 8, halign: 'center' },
                    bodyStyles: { fontSize: 7.5, halign: 'center' },
                    columnStyles: {
                        0: { halign: 'left', cellWidth: orientation === 'landscape' ? 55 : 35, fontStyle: 'bold' }
                    },
                    margin: { left: 14, right: 14 }
                });
            }
        }

        // 4. MATRIX RESPONSE SLIDE PAGE
        if (fluencyDetail && config.includeMatrix !== false) {
            const fluencyData = (fluencyDetail.data || []) as FluencyDetailRow[];
            const nonReadingStudents = fluencyData.filter(s => !(s.materia || '').toLowerCase().includes('leitura'));

            if (nonReadingStudents.length > 0) {
                newSlidePage();

                doc.setTextColor(PALETTE.headerText[0], PALETTE.headerText[1], PALETTE.headerText[2]);
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(18);
                doc.text(`${className} - Matriz de Respostas dos Alunos`, 14, 18);

                let maxQ = 0;
                nonReadingStudents.forEach(s => {
                    if (s.questions) {
                        const len = Array.isArray(s.questions) ? s.questions.length : (s.questions instanceof Map ? s.questions.size : Object.keys(s.questions).length);
                        maxQ = Math.max(maxQ, len);
                    }
                });

                const qCount = Math.min(maxQ, orientation === 'landscape' ? 24 : 14);
                const headRow = ['Aluno', 'Disciplina'];
                for (let q = 1; q <= qCount; q++) headRow.push(`Q${q}`);
                headRow.push('% Acerto');

                const matrixRows = nonReadingStudents.map(s => {
                    const row: string[] = [s.nome || 'Aluno', s.materia || 'Geral'];
                    let correctCount = 0;

                    for (let q = 0; q < qCount; q++) {
                        let qObj: any = null;
                        if (s.questions) {
                            if (Array.isArray(s.questions)) qObj = s.questions[q];
                            else if (s.questions instanceof Map) qObj = s.questions.get(q);
                            else qObj = (s.questions as any)[q];
                        }
                        if (qObj) {
                            const isRight = !!(qObj.correct || qObj.certo || qObj.ATR_CERTO || qObj.type === 'right');
                            if (isRight) correctCount++;
                            row.push(isRight ? 'C' : 'E');
                        } else {
                            row.push('-');
                        }
                    }
                    const hitRate = s.percentualAcerto !== undefined ? Math.round(s.percentualAcerto) : (qCount > 0 ? Math.round((correctCount / qCount) * 100) : 0);
                    row.push(`${hitRate}%`);
                    return row;
                });

                autoTable(doc, {
                    startY: 25,
                    head: [headRow],
                    body: matrixRows,
                    theme: 'grid',
                    headStyles: { fillColor: [46, 64, 83], textColor: 255, fontStyle: 'bold', fontSize: 7, halign: 'center' },
                    bodyStyles: { fontSize: 6.5, halign: 'center' },
                    columnStyles: {
                        0: { halign: 'left', cellWidth: orientation === 'landscape' ? 55 : 35 },
                        1: { halign: 'left', cellWidth: 25 }
                    },
                    didParseCell: (dataCell) => {
                        if (dataCell.section === 'body' && dataCell.column.index >= 2 && dataCell.column.index < headRow.length - 1) {
                            if (dataCell.cell.raw === 'C') {
                                dataCell.cell.styles.fillColor = PALETTE.correct;
                                dataCell.cell.styles.textColor = PALETTE.correctText;
                            } else if (dataCell.cell.raw === 'E') {
                                dataCell.cell.styles.fillColor = PALETTE.wrong;
                                dataCell.cell.styles.textColor = PALETTE.wrongText;
                            }
                        }
                    },
                    margin: { left: 14, right: 14 }
                });
            }
        }

        // 5. EVOLUTION LINE SLIDE PAGE (Visão Geral - Linha Evolutiva)
        if (evolution && config.includeEvolution !== false) {
            const rows = (evolution.data || []) as EvolutionRow[];
            if (rows.length > 0) {
                newSlidePage();

                doc.setTextColor(PALETTE.headerText[0], PALETTE.headerText[1], PALETTE.headerText[2]);
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(18);
                doc.text(`${className} - Visão Geral - Linha Evolutiva`, 14, 18);

                const editions = Array.from(new Set(rows.map(d => d.edicao)));
                
                const seriesData = {
                    partMat: [] as number[], resMat: [] as number[],
                    partPort: [] as number[], resPort: [] as number[],
                    partLeit: [] as number[], resLeit: [] as number[]
                };

                editions.forEach(ed => {
                    const edRows = rows.filter(d => d.edicao === ed);
                    
                    const getVal = (mat: string, type: 'part' | 'res') => {
                        const r = edRows.find(item => item.materia.toLowerCase().includes(mat.toLowerCase()));
                        return r ? Math.round(type === 'part' ? r.participacao : r.acertos) : 0;
                    };

                    seriesData.partMat.push(getVal('Matemática', 'part'));
                    seriesData.resMat.push(getVal('Matemática', 'res'));
                    seriesData.partPort.push(getVal('Língua Portuguesa', 'part'));
                    seriesData.resPort.push(getVal('Língua Portuguesa', 'res'));
                    seriesData.partLeit.push(getVal('Leitura', 'part'));
                    seriesData.resLeit.push(getVal('Leitura', 'res'));
                });

                // Draw Clustered Bar Chart at top
                const chartLeft = orientation === 'landscape' ? 25 : 15;
                const chartWidth = pageWidth - chartLeft * 2;
                const chartTop = 26;
                const chartHeight = orientation === 'landscape' ? 65 : 50;
                const chartBottom = chartTop + chartHeight;

                // Y-Axis Grid Lines (0, 20, 40, 60, 80, 100)
                doc.setDrawColor(220, 220, 220);
                doc.setLineWidth(0.3);
                for (let yVal = 0; yVal <= 100; yVal += 20) {
                    const yPos = chartBottom - (yVal / 100) * chartHeight;
                    doc.line(chartLeft, yPos, chartLeft + chartWidth, yPos);
                    doc.setFontSize(7);
                    doc.setTextColor(120, 120, 120);
                    doc.text(yVal.toString(), chartLeft - 3, yPos + 1, { align: 'right' });
                }

                // Baseline
                doc.setDrawColor(100, 100, 100);
                doc.setLineWidth(0.6);
                doc.line(chartLeft, chartBottom, chartLeft + chartWidth, chartBottom);

                // Bar series colors matching PPTX slide exactly
                const barSeries = [
                    { name: 'Participação Matemática', values: seriesData.partMat, color: [68, 114, 196] },
                    { name: 'Resultado Matemática', values: seriesData.resMat, color: [37, 94, 145] },
                    { name: 'Participação Língua Portuguesa', values: seriesData.partPort, color: [112, 173, 71] },
                    { name: 'Resultado Língua Portuguesa', values: seriesData.resPort, color: [84, 130, 53] },
                    { name: 'Participação Leitura', values: seriesData.partLeit, color: [255, 0, 0] },
                    { name: 'Resultado Leitura', values: seriesData.resLeit, color: [192, 0, 0] }
                ];

                const clusterCount = editions.length;
                const clusterGap = chartWidth / clusterCount;
                const barsPerCluster = 6;
                const singleBarWidth = Math.min((clusterGap * 0.75) / barsPerCluster, 7.5);

                editions.forEach((ed, edIdx) => {
                    const clusterCenterX = chartLeft + edIdx * clusterGap + clusterGap / 2;
                    const clusterStartX = clusterCenterX - (barsPerCluster * singleBarWidth) / 2;

                    barSeries.forEach((s, sIdx) => {
                        const val = s.values[edIdx] || 0;
                        const bHeight = (val / 100) * chartHeight;
                        const barX = clusterStartX + sIdx * singleBarWidth;
                        const barY = chartBottom - bHeight;

                        doc.setFillColor(s.color[0], s.color[1], s.color[2]);
                        doc.rect(barX, barY, singleBarWidth, Math.max(bHeight, 0.5), 'F');
                    });

                    // X-Axis Edition Label
                    doc.setFontSize(8);
                    doc.setFont('helvetica', 'normal');
                    doc.setTextColor(80, 80, 80);
                    doc.text(ed, clusterCenterX, chartBottom + 5, { align: 'center' });
                });

                // Chart Legend below chart (Dynamic spacing & wrapping to avoid text overlap)
                const legendY = chartBottom + 9;
                const rectSize = 3;
                const textGap = 1.5;
                const itemGap = 4;
                const maxLineWidth = pageWidth - chartLeft * 2;

                doc.setFontSize(6);
                doc.setFont('helvetica', 'normal');

                interface MeasuredLegendItem {
                    name: string;
                    color: number[];
                    itemWidth: number;
                }

                const lines: MeasuredLegendItem[][] = [[]];
                let currentLineWidth = 0;

                barSeries.forEach((s) => {
                    const textWidth = doc.getTextWidth(s.name);
                    const itemWidth = rectSize + textGap + textWidth;
                    const currentLine = lines[lines.length - 1];

                    if (currentLine.length > 0 && (currentLineWidth + itemGap + itemWidth > maxLineWidth)) {
                        lines.push([{ name: s.name, color: s.color, itemWidth }]);
                        currentLineWidth = itemWidth;
                    } else {
                        currentLine.push({ name: s.name, color: s.color, itemWidth });
                        currentLineWidth += (currentLine.length > 1 ? itemGap : 0) + itemWidth;
                    }
                });

                const lineHeight = 4.5;
                lines.forEach((lineItems, lineIdx) => {
                    const lineTotalWidth = lineItems.reduce((sum, item) => sum + item.itemWidth, 0) + (lineItems.length - 1) * itemGap;
                    let currentX = (pageWidth - lineTotalWidth) / 2;
                    const currentY = legendY + lineIdx * lineHeight;

                    lineItems.forEach((item) => {
                        doc.setFillColor(item.color[0], item.color[1], item.color[2]);
                        doc.rect(currentX, currentY, rectSize, rectSize, 'F');

                        doc.setFontSize(6);
                        doc.setFont('helvetica', 'normal');
                        doc.setTextColor(70, 70, 70);
                        doc.text(item.name, currentX + rectSize + textGap, currentY + 2.3);

                        currentX += item.itemWidth + itemGap;
                    });
                });

                // Pivot Table below legend (Matching Image 1)
                const legendTotalHeight = lines.length * lineHeight;
                const tableStartY = legendY + legendTotalHeight + 2;

                const evoTableHead = [
                    [
                        '', '', 
                        'Matemática', 'Língua Portuguesa', 'Leitura'
                    ]
                ];

                const evoTableBody: any[] = [];

                editions.forEach((ed, idx) => {
                    const edRows = rows.filter(d => d.edicao === ed);
                    const getValStr = (mat: string, type: 'part' | 'res') => {
                        const r = edRows.find(item => item.materia.toLowerCase().includes(mat.toLowerCase()));
                        return r ? `${Math.round(type === 'part' ? r.participacao : r.acertos)}%` : '-';
                    };

                    evoTableBody.push([
                        { content: ed, rowSpan: 2, styles: { fontStyle: 'bold', valign: 'middle', halign: 'left', fillColor: idx % 2 === 0 ? [245, 245, 245] : [255, 255, 255] } },
                        { content: 'Participação', styles: { halign: 'right', textColor: [100, 100, 100], fillColor: idx % 2 === 0 ? [245, 245, 245] : [255, 255, 255] } },
                        getValStr('Matemática', 'part'),
                        getValStr('Língua Portuguesa', 'part'),
                        getValStr('Leitura', 'part')
                    ]);

                    evoTableBody.push([
                        { content: 'Resultado', styles: { halign: 'right', textColor: [100, 100, 100], fillColor: idx % 2 === 0 ? [245, 245, 245] : [255, 255, 255] } },
                        getValStr('Matemática', 'res'),
                        getValStr('Língua Portuguesa', 'res'),
                        getValStr('Leitura', 'res')
                    ]);
                });

                autoTable(doc, {
                    startY: tableStartY,
                    head: evoTableHead,
                    body: evoTableBody,
                    theme: 'plain',
                    headStyles: { fillColor: [255, 255, 255], textColor: [80, 80, 80], fontStyle: 'bold', fontSize: 8, halign: 'center' },
                    bodyStyles: { fontSize: 8, halign: 'center' },
                    columnStyles: {
                        0: { cellWidth: orientation === 'landscape' ? 55 : 40 },
                        1: { cellWidth: 30 }
                    },
                    margin: { left: 14, right: 14 }
                });
            }
        }

        // 6. HISTORY SLIDE PAGE
        if (history && config.includeHistory !== false) {
            const historyData = (history.data || []) as HistoryStudent[];
            if (historyData.length > 0) {
                const allKeysSet = new Set<string>();
                historyData.forEach(s => {
                    if (s.results) Object.keys(s.results).forEach(k => allKeysSet.add(k));
                });
                const allKeys = Array.from(allKeysSet);

                if (allKeys.length > 0) {
                    const subjectGroups = new Map<string, string[]>();
                    allKeys.forEach(key => {
                        const match = key.match(/\[(.*?)\]/);
                        if (match) {
                            const subj = match[1].trim();
                            if (!subjectGroups.has(subj)) subjectGroups.set(subj, []);
                            subjectGroups.get(subj)!.push(key);
                        }
                    });

                    for (const [subj, cols] of subjectGroups.entries()) {
                        cols.sort((a, b) => a.localeCompare(b));
                        newSlidePage();

                        doc.setTextColor(PALETTE.headerText[0], PALETTE.headerText[1], PALETTE.headerText[2]);
                        doc.setFont('helvetica', 'bold');
                        doc.setFontSize(18);
                        doc.text(`${className} - Histórico de Desempenho - ${subj}`, 14, 18);

                        const headRow = ['Alunos', ...cols.map(c => {
                            const m = c.match(/\[(.*?)\]\s*(.*)/);
                            return m ? m[2] : c;
                        })];

                        const hRows = [...historyData]
                            .sort((a, b) => (a.nome || '').localeCompare(b.nome || ''))
                            .map(s => {
                                const row = [s.nome || 'Aluno'];
                                cols.forEach(c => {
                                    row.push(s.results ? (s.results[c] || '-') : '-');
                                });
                                return row;
                            });

                        autoTable(doc, {
                            startY: 25,
                            head: [headRow],
                            body: hRows,
                            theme: 'striped',
                            headStyles: { fillColor: [46, 64, 83], textColor: 255, fontStyle: 'bold', fontSize: 8, halign: 'left' },
                            bodyStyles: { fontSize: 7.5, halign: 'left' },
                            columnStyles: {
                                0: { halign: 'left', cellWidth: orientation === 'landscape' ? 65 : 45, fontStyle: 'bold' }
                            },
                            margin: { left: 14, right: 14 }
                        });
                    }
                }
            }
        }
    }

    // --- FINAL SLIDE PAGE ---
    newSlidePage();
    doc.setFillColor(30, 41, 59); // Deep Slate Navy
    doc.rect(0, 0, pageWidth, pageHeight, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(32);
    doc.text('Obrigado pela atenção!', pageWidth / 2, pageHeight / 2 - 15, { align: 'center' });

    doc.setFontSize(14);
    doc.setFont('helvetica', 'italic');
    doc.text('"Educai as crianças para que não seja necessário punir os adultos."', pageWidth / 2, pageHeight / 2 + 10, { align: 'center' });

    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('- Pitágoras', pageWidth / 2, pageHeight / 2 + 20, { align: 'center' });

    const arrayBuffer = doc.output('arraybuffer');
    return new Uint8Array(arrayBuffer);
};
