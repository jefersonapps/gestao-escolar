import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const MONTH_NAMES_PT = [
  'JANEIRO', 'FEVEREIRO', 'MARÇO', 'ABRIL', 'MAIO', 'JUNHO',
  'JULHO', 'AGOSTO', 'SETEMBRO', 'OUTUBRO', 'NOVEMBRO', 'DEZEMBRO',
];

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

function getDayOfWeek(year: number, month: number, day: number): number {
  return new Date(year, month - 1, day).getDay();
}

interface WorkerInput {
  turma: string;
  professor: string;
  month: number;
  year: number;
  students: string[];
  fontBase64: string | null;
  logoLeftBase64: string | null;
  logoRightBase64: string | null;
}

self.onmessage = (e: MessageEvent<WorkerInput>) => {
  try {
    const { turma, professor, month, year, students, fontBase64, logoLeftBase64, logoRightBase64 } = e.data;
    const daysInMonth = getDaysInMonth(year, month);
    const monthName = MONTH_NAMES_PT[month - 1];

    const doc = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4',
    });

    const pageWidth = doc.internal.pageSize.getWidth();   // 297
    const pageHeight = doc.internal.pageSize.getHeight();  // 210
    const marginX = 5;
    const contentWidth = pageWidth - marginX * 2;

    // Load font
    if (fontBase64) {
      try {
        doc.addFileToVFS('CustomTimes.ttf', fontBase64);
        doc.addFont('CustomTimes.ttf', 'CustomTimes', 'normal');
        doc.setFont('CustomTimes'); 
      } catch {
        doc.setFont('times');
      }
    } else {
      doc.setFont('times');
    }

    // ========== HEADER ==========
    // COMPACT HEADER to save vertical space
    let cursorY = 5; // Start higher
    const logoSize = 15; // Reduced from 20
    const headerTextX = marginX + logoSize + 5;
    const headerTextWidth = contentWidth - (logoSize + 5) * 2;

    // Draw logos
    if (logoLeftBase64) {
      doc.addImage(logoLeftBase64, 'PNG', marginX + 2, cursorY, logoSize, logoSize);
    }
    if (logoRightBase64) {
      // SEDUC Logo needs to be larger/wider
      const seducWidth = 35; // increased from logoSize+4 (~19)
      const seducHeight = 20; // increased from logoSize (~15)
      doc.addImage(logoRightBase64, 'JPEG', pageWidth - marginX - seducWidth, cursorY - 2, seducWidth, seducHeight);
    }

    // Header text - Compact spacing
    doc.setFontSize(8);
    doc.setFont('times', 'bold');

    const headerLines = [
      'PREFEITURA MUNICIPAL DE SUMÉ SECRETARIA DA EDUCAÇÃO',
      'UNIDADE MUNICIPAL DE EDUCAÇÃO INFANTIL E ENSINO FUNDAMENTAL',
      'GONÇALA RODRIGUES DE FREITAS',
    ];
    const headerLinesSmall = [
      'Endereço: Rua Maurício Adriano Josué de Lima, 121',
      'CNPJ: 07.646.417/0001-03 Insc. 2646861',
      'E-mail: coordenação.goncala@gmail.com',
    ];

    let textY = cursorY + 3;
    const lineSpacing = 3; // Reduced from 3.5
    headerLines.forEach((line) => {
      doc.text(line, headerTextX + headerTextWidth / 2, textY, { align: 'center' });
      textY += lineSpacing;
    });

    doc.setFontSize(6.5);
    doc.setFont('times', 'normal');
    headerLinesSmall.forEach((line) => {
      doc.text(line, headerTextX + headerTextWidth / 2, textY, { align: 'center' });
      textY += 2.5; // Reduced from 3
    });

    cursorY = cursorY + logoSize + 6; // Increased from 2 to 6 for breathing room

    // ========== HEADER INFO TABLE (Turma, Mês, Professora) ==========
    autoTable(doc, {
      startY: cursorY,
      head: [
        [
          {
            content: turma.toUpperCase(),
            styles: { halign: 'center', fontStyle: 'bold', fontSize: 11 }
          },
          {
            content: `MÊS: ${monthName} ${year}`,
            styles: { halign: 'center', fontStyle: 'bold', fontSize: 11 }
          }
        ],
        [
          {
            content: `PROFESSOR(A): ${professor.toUpperCase()}`,
            colSpan: 2,
            styles: {
              halign: 'left',
              fontStyle: 'bold',
              fontSize: 10,
              lineWidth: { top: 0.1, right: 0, bottom: 0, left: 0 } 
            }
          }
        ]
      ],
      body: [],
      theme: 'plain',
      styles: {
        font: 'times',
        lineColor: [0, 0, 0],
        lineWidth: 0,
        textColor: 0,
        cellPadding: 1, // Reduced padding
      },
      headStyles: {
        fillColor: [255, 255, 255],
        textColor: 0,
        lineWidth: 0,
        lineColor: [0, 0, 0]
      },
      columnStyles: {
        0: { cellWidth: contentWidth * 0.6 },
        1: { cellWidth: contentWidth * 0.4 }
      },
      margin: { left: marginX, right: marginX },
    });
    
    const headerTableFinalY = (doc as any).lastAutoTable.finalY;
    doc.setLineWidth(0.1);
    doc.setDrawColor(0);
    doc.rect(marginX, cursorY, contentWidth, headerTableFinalY - cursorY);

    cursorY = headerTableFinalY; // Attached

    // ========== TABLE ==========
    const colNumWidth = 8;
    const dayColWidth = 5.5; 
    const totalDayWidth = dayColWidth * daysInMonth; 
    const nameColWidth = contentWidth - colNumWidth - totalDayWidth;

    const DOW_LETTERS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

    const headerRow = [
      { content: 'Nº', styles: { fillColor: [255, 255, 255] as [number, number, number], fontStyle: 'bold' as const, halign: 'center' as const, fontSize: 10 } },
      { 
        content: 'NOME DO ESTUDANTE', 
        styles: { 
          fillColor: [255, 255, 255] as [number, number, number], 
          fontStyle: 'bold' as const, 
          halign: 'left' as const, 
          fontSize: 11,
          cellPadding: { top: 0.5, bottom: 0.5, left: 1, right: 0.5 } // Match body padding
        } 
      },
      ...Array.from({ length: daysInMonth }, (_, i) => {
        const day = i + 1;
        const dow = getDayOfWeek(year, month, day);
        const isWeekend = dow === 0 || dow === 6;
        const content = isWeekend ? DOW_LETTERS[dow] : String(day);

        // Weekends: Light Green [144, 238, 144]
        // Weekdays: Pale Green [200, 255, 200]
        const fillColor: [number, number, number] = isWeekend 
            ? [144, 238, 144] 
            : [200, 255, 200]; 

        return {
          content,
          styles: {
            fillColor,
            fontStyle: 'bold' as const,
            halign: 'center' as const,
            fontSize: 9,
            cellPadding: 0.5,
          },
        };
      }),
    ];

    const tableBody = students.map((studentLine, index) => {
      const cleanName = studentLine.replace(/^\d+[\s\t]+/, '').trim();
      
      const rowData: any[] = [
        { content: String(index + 1), styles: { halign: 'center', fontSize: 10 } },
        { 
          content: cleanName, 
          styles: { 
            halign: 'left', 
            fontSize: 11, // REDUCED TO 11pt to save space
            cellPadding: { top: 0.5, bottom: 0.5, left: 1, right: 0.5 } // MINIMAL PADDING
          } 
        },
      ];
      
      for (let i = 0; i < daysInMonth; i++) {
        const day = i + 1;
        const dow = getDayOfWeek(year, month, day);
        const isWeekend = dow === 0 || dow === 6;
        rowData.push({
          content: '',
          styles: {
             fillColor: isWeekend ? [144, 238, 144] : [255, 255, 255],
             halign: 'center',
             fontSize: 9 
          }
        });
      }
      return rowData;
    });
    
    const columnStyles: Record<number, any> = {
      0: { cellWidth: colNumWidth },
      1: { cellWidth: nameColWidth }, 
    };
    for(let i=0; i<daysInMonth; i++) {
      columnStyles[i+2] = { cellWidth: dayColWidth };
    }

    autoTable(doc, {
      startY: cursorY,
      head: [headerRow],
      body: tableBody,
      theme: 'grid',
      styles: {
        font: 'times',
        lineColor: [0, 0, 0],
        lineWidth: 0.1,
        textColor: 0,
        cellPadding: 0.3, // VERY TIGHT global padding
        minCellHeight: 0, // No forced height, let font dictate
      },
      headStyles: {
        fillColor: [255, 255, 255],
        textColor: 0,
        lineWidth: 0.1,
        lineColor: [0, 0, 0],
        valign: 'middle',
      },
      columnStyles: columnStyles,
      margin: { left: marginX, right: marginX, bottom: 5 }, // Minimize bottom margin
      didParseCell: (data) => {
        if (data.section === 'body' && data.column.index === 1) {
           data.cell.styles.overflow = 'ellipsize';
        }
      }
    });

    const finalY = (doc as any).lastAutoTable.finalY + 4; // reduced spacing

    // ========== LEGEND ==========
    const legendY = finalY > pageHeight - 10 ? pageHeight - 5 : finalY;
    
    doc.setFontSize(8); 
    doc.setFont('times', 'bold');
    doc.text('LEGENDA:', marginX, legendY); // Align exactly with table left (marginX)
    
    // Draw manual circle for "Presença" - Reduced size and moved right
    doc.setFillColor(0, 0, 0);
    doc.circle(marginX + 19, legendY - 0.8, 0.5, 'F'); // R=0.5mm (half size), moved to X+18

    doc.setFont('times', 'normal');
    doc.text(
      '  = Presença      F = Falta      A = Atestado      Fj = Falta justificada',
      marginX + 19, // Adjusted text start
      legendY
    );

    const pdfArrayBuffer = doc.output('arraybuffer');
    self.postMessage({ success: true, pdfBuffer: pdfArrayBuffer }, [pdfArrayBuffer] as any);
  } catch (err: any) {
    self.postMessage({ success: false, error: err?.message || String(err) });
  }
};
