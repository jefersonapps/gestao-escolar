import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface InfrequencyData {
  id: string; 
  name: string; 
  totalStudents: number;
  faults: number;
  observations: string;
}

// ... imports

interface WorkerInput {
  date: string;
  data: InfrequencyData[];
  logoBase64: string | null;
  logoRightBase64: string | null;
  footerBase64: string | null;
}

self.onmessage = (e: MessageEvent<WorkerInput>) => {
  try {
    const { date, data, logoBase64, logoRightBase64, footerBase64 } = e.data;
    
    // ... date parsing ...
    const [year, month, day] = date.split('-').map(Number);
    const dateObj = new Date(year, month - 1, day);
    const formattedDate = dateObj.toLocaleDateString('pt-BR');

    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    const pageWidth = doc.internal.pageSize.getWidth();   // 210
    const pageHeight = doc.internal.pageSize.getHeight();  // 297
    const marginX = 10;
    const contentWidth = pageWidth - marginX * 2;

    let footerHeight = 20;
    if (footerBase64) {
        try {
            const props = doc.getImageProperties(footerBase64);
            footerHeight = (props.height * contentWidth) / props.width;
        } catch (e) {}
    }

    doc.setFont('times');

    // ========== HEADER ==========
    
    let cursorY = 5;
    const logoSize = 20; // Reduced to match SEDUC logo height
    // Left Logo
    if (logoBase64) {
      doc.addImage(logoBase64, 'PNG', marginX, cursorY, logoSize, logoSize, 'logo_left', 'FAST');
    }
    // Right Logo (SEDUC)
    if (logoRightBase64) {
        // Aspect ratio for SEDUC logo usually wider? Let's check props or assume square/rect.
        // Let's use getImageProperties to be safe if possible, or just fit in box.
        // To be safe, let's define a box at right.
        const rightLogoW = 35;
        const rightLogoH = 20;
        doc.addImage(logoRightBase64, 'JPEG', pageWidth - marginX - rightLogoW, cursorY, rightLogoW, rightLogoH, 'logo_right', 'FAST');
    }

    // Header text
    doc.setFontSize(9);
    doc.setFont('times', 'bold');

    const headerLines = [
      'PREFEITURA MUNICIPAL DE SUMÉ - SECRETARIA DE EDUCAÇÃO', // Adjusted text
      'UNIDADE MUNICIPAL DE EDUCAÇÃO INFANTIL E ENSINO FUNDAMENTAL',
      'GONÇALA RODRIGUES DE FREITAS',
    ];
    const headerLinesSmall = [
      'Endereço: Rua Maurício Adriano Josué de Lima, 121',
      'CNPJ: 07.646.417/0001-03 Insc. 2646861',
      'E-mail: coordenacao.goncala@gmail.com', // removed special char just in case
    ];

    let textY = cursorY + 5;
    headerLines.forEach((line) => {
      doc.text(line, pageWidth / 2, textY, { align: 'center' }); 
      textY += 4;
    });

    doc.setFontSize(7);
    doc.setFont('times', 'normal');
    headerLinesSmall.forEach((line) => {
      doc.text(line, pageWidth / 2, textY, { align: 'center' });
      textY += 3;
    });

    cursorY = textY + 5;

    // Title Box
    doc.setFillColor(180, 230, 255); 
    doc.rect(marginX, cursorY, contentWidth, 10, 'F');
    doc.setLineWidth(0.1); // Match table line width
    
    // Draw borders excluding bottom to avoid double line with table header
    doc.line(marginX, cursorY, marginX + contentWidth, cursorY); // Top
    doc.line(marginX, cursorY, marginX, cursorY + 10); // Left
    doc.line(marginX + contentWidth, cursorY, marginX + contentWidth, cursorY + 10); // Right

    doc.setFontSize(11);
    doc.setFont('times', 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text(`CONTROLE DA INFREQUÊNCIA ESCOLAR DOS ESTUDANTES ${formattedDate}`, pageWidth / 2, cursorY + 6.5, { align: 'center' });

    cursorY += 10; 

    // ========== TABLE ==========
    const tableBody = data.map(row => {
        const presentes = row.totalStudents - row.faults;
        return [
            row.name,
            row.totalStudents,
            row.faults,
            presentes,
            row.observations
        ];
    });

    autoTable(doc, {
        startY: cursorY,
        head: [['TURMAS', 'QUANTOS\nESTUDANTES', 'FALTAS', 'PRESENTES', 'OBSERVAÇÕES']],
        body: tableBody,
        theme: 'grid',
        styles: {
            font: 'times',
            lineColor: [0, 0, 0],
            lineWidth: 0.1,
            textColor: 0,
            halign: 'center',
            valign: 'middle',
            cellPadding: 1,
            fontSize: 9
        },
        headStyles: {
            fillColor: [180, 230, 255], 
            textColor: 0,
            fontStyle: 'bold',
            lineWidth: 0.1,
            lineColor: [0, 0, 0]
        },
        columnStyles: {
            0: { halign: 'center', fontStyle: 'bold', cellWidth: 40 }, 
            1: { cellWidth: 25 }, 
            2: { cellWidth: 20 }, 
            3: { cellWidth: 25 }, 
            4: { halign: 'center' } 
        },
        tableWidth: contentWidth,
        margin: { left: marginX, right: marginX, bottom: footerHeight + 5 },
        didParseCell: (data) => {
             // Conditional formatting for "Observações" column (index 4)
             // Check if it's body row
             if (data.section === 'body' && data.column.index === 4) {
                 const rowIdx = data.row.index;
                 const rowData = data.table.body[rowIdx].raw as any[];
                 const total = rowData[1] as number;
                 const faults = rowData[2] as number;
                 
                 // "SE 100 dos alunos estiverem presentes deve preencher a célula de um verde pouco saturado com o texto 100% presente"
                 if (faults === 0 && total > 0) {
                     data.cell.styles.fillColor = [144, 238, 144]; // Light green
                     data.cell.text = ['100% presente'];
                     data.cell.styles.fontSize = 8; 
                 }
             }
        }
    });

    // ========== FOOTER ==========
    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        if (footerBase64) {
            doc.addImage(footerBase64, 'JPEG', marginX, pageHeight - footerHeight - 10, contentWidth, footerHeight, 'footer', 'FAST');
        }
    }

    const pdfArrayBuffer = doc.output('arraybuffer');
    self.postMessage({ success: true, pdfBuffer: pdfArrayBuffer }, [pdfArrayBuffer] as any);

  } catch (err: any) {
    self.postMessage({ success: false, error: err?.message || String(err) });
  }
};
