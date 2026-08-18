import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { save } from '@tauri-apps/plugin-dialog';
import { writeFile } from '@tauri-apps/plugin-fs';
import type { StudentAuditItem, InconsistencySeverity } from '@/components/inconsistencies/InconsistencyControl';
import { toast } from 'sonner';

export interface InconsistencyPdfStats {
  totalStudents: number;
  inconsistenciesCount: number;
  cleanCount: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
}

export interface InconsistencyPdfOptions {
  items: StudentAuditItem[];
  stats: InconsistencyPdfStats;
  schoolName?: string;
  filtersDescription?: string;
}

export const generateInconsistenciesPdf = async ({
  items,
  stats,
  schoolName = 'Sistema de Gestão Escolar',
  filtersDescription = 'Todas as Turmas',
}: InconsistencyPdfOptions): Promise<void> => {
  if (items.length === 0) {
    toast.error('Nenhuma inconsistência para gerar no PDF.');
    return;
  }

  // Orientation: Landscape A4 to accommodate detailed descriptions
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const today = new Date();
  const dateFormatted = today.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  const timeFormatted = today.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  });

  // 1. Header Banner
  doc.setFillColor(30, 41, 59); // Deep Slate
  doc.rect(0, 0, pageWidth, 26, 'F');

  // School / App Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(255, 255, 255);
  doc.text('RELATÓRIO DETALHADO DE AUDITORIA E INCONSISTÊNCIAS CADASTRAIS', 14, 11);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(203, 213, 225); // Slate 300
  doc.text(`${schoolName} • Emissão: ${dateFormatted} às ${timeFormatted} • Filtros: ${filtersDescription}`, 14, 18);

  // 2. Summary KPI Box
  const startY = 32;
  doc.setFillColor(248, 250, 252); // Slate 50
  doc.setDrawColor(226, 232, 240); // Slate 200
  doc.roundedRect(14, startY, pageWidth - 28, 18, 2, 2, 'FD');

  const summaryItems = [
    { label: 'Total Auditado', value: `${stats.totalStudents}`, color: [30, 41, 59] },
    { label: 'Com Inconsistência', value: `${items.length}`, color: [194, 65, 12] },
    { label: 'Críticas', value: `${stats.criticalCount}`, color: [185, 28, 28] },
    { label: 'Altas', value: `${stats.highCount}`, color: [194, 65, 12] },
    { label: 'Médias', value: `${stats.mediumCount}`, color: [180, 83, 9] },
    { label: 'Baixas', value: `${stats.lowCount}`, color: [29, 78, 216] },
  ];

  const colWidth = (pageWidth - 28) / summaryItems.length;
  summaryItems.forEach((item, idx) => {
    const xPos = 14 + idx * colWidth + colWidth / 2;
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text(item.label, xPos, startY + 6, { align: 'center' });

    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(item.color[0], item.color[1], item.color[2]);
    doc.text(item.value, xPos, startY + 13, { align: 'center' });
  });

  // 3. Prepare Table Data
  const severityLabels: Record<InconsistencySeverity, string> = {
    critical: 'Crítica',
    high: 'Alta',
    medium: 'Média',
    low: 'Baixa',
  };

  const tableRows = items.map((item, idx) => {
    // Formatted Student Cell
    const studentCell = `${item.student.name}\nID SGEdu: ${item.student.id}`;

    // Formatted Class / Stage
    const classCell = item.student.stage
      ? `${item.classGroup.name}\n(${item.student.stage})`
      : item.classGroup.name;

    // Formatted Documents
    const cpfStr = item.student.cpf ? `CPF: ${item.student.cpf}` : 'CPF: AUSENTE';
    const nisStr = item.student.nis ? `NIS: ${item.student.nis}` : 'NIS: AUSENTE';
    const susStr = item.student.sus ? `SUS: ${item.student.sus}` : 'SUS: AUSENTE';
    const docsCell = `${cpfStr}\n${nisStr}\n${susStr}`;

    // Formatted Severity
    const sevLabel = severityLabels[item.maxSeverity] || 'Baixa';

    // Detailed Issues with bullet points and description
    const issuesCell = item.issues
      .map((issue, iIdx) => `${iIdx + 1}. [${issue.title}]: ${issue.description}`)
      .join('\n\n');

    return [
      `${idx + 1}`,
      studentCell,
      classCell,
      docsCell,
      sevLabel,
      issuesCell,
    ];
  });

  // 4. Render Table with autoTable
  autoTable(doc, {
    startY: startY + 22,
    head: [['#', 'Aluno (Nome / ID)', 'Turma / Etapa', 'Documentos Principais', 'Gravidade', 'Detalhamento das Inconsistências Identificadas']],
    body: tableRows,
    theme: 'grid',
    headStyles: {
      fillColor: [30, 41, 59],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8.5,
      halign: 'left',
      cellPadding: 2.5,
    },
    styles: {
      fontSize: 8,
      cellPadding: 2.5,
      valign: 'top',
      textColor: [30, 41, 59],
      lineColor: [226, 232, 240],
      lineWidth: 0.2,
    },
    columnStyles: {
      0: { cellWidth: 8, halign: 'center' },
      1: { cellWidth: 50, fontStyle: 'bold' },
      2: { cellWidth: 32 },
      3: { cellWidth: 42, fontStyle: 'normal' },
      4: { cellWidth: 24, halign: 'center', fontStyle: 'bold' },
      5: { cellWidth: 'auto' }, // Fills remaining space for detailed issues
    },
    didParseCell: (data) => {
      // Highlight severity column
      if (data.section === 'body' && data.column.index === 4) {
        const text = String(data.cell.raw || '');
        if (text === 'Crítica') {
          data.cell.styles.textColor = [185, 28, 28];
          data.cell.styles.fillColor = [254, 242, 242];
        } else if (text === 'Alta') {
          data.cell.styles.textColor = [194, 65, 12];
          data.cell.styles.fillColor = [255, 247, 237];
        } else if (text === 'Média') {
          data.cell.styles.textColor = [180, 83, 9];
          data.cell.styles.fillColor = [254, 252, 232];
        } else {
          data.cell.styles.textColor = [29, 78, 216];
          data.cell.styles.fillColor = [239, 246, 255];
        }
      }
    },
    didDrawPage: () => {
      // Header on continuation pages
      const pageNumber = doc.getNumberOfPages();
      if (pageNumber > 1) {
        doc.setFillColor(30, 41, 59);
        doc.rect(0, 0, pageWidth, 12, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8.5);
        doc.setTextColor(255, 255, 255);
        doc.text(`RELATÓRIO DE INCONSISTÊNCIAS DE DADOS (Continuação - Página ${pageNumber})`, 14, 8);
      }

      // Footer on all pages
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(148, 163, 184); // Slate 400
      doc.text(
        `Sistema de Gestão Escolar • Relatório de Auditoria e Controle Interno • Página ${pageNumber}`,
        14,
        pageHeight - 6
      );
      doc.text(
        `Documento gerado em ${dateFormatted} às ${timeFormatted}`,
        pageWidth - 14,
        pageHeight - 6,
        { align: 'right' }
      );
    },
    margin: { top: 16, bottom: 12, left: 14, right: 14 },
  });

  // 5. Save PDF File (Tauri or Browser)
  const defaultFileName = `Relatorio_Inconsistencias_Alunos_${today.toISOString().slice(0, 10)}.pdf`;

  try {
    const arrayBuffer = doc.output('arraybuffer');
    const pdfBytes = new Uint8Array(arrayBuffer);

    const savePath = await save({
      filters: [{ name: 'Documento PDF', extensions: ['pdf'] }],
      defaultPath: defaultFileName,
    });

    if (savePath) {
      await writeFile(savePath, pdfBytes);
      toast.success(`Relatório em PDF exportado com sucesso! Salvo em: ${savePath}`);
    }
  } catch (tauriError) {
    console.warn('Tauri save dialog not available, downloading via browser:', tauriError);
    doc.save(defaultFileName);
    toast.success('Relatório em PDF baixado com sucesso!');
  }
};
