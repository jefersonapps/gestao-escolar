import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface PDFWorkerInput {
  title: string;
  columns: { header: string; dataKey: string; width?: number }[];
  datasets: { subTitle: string; data: any[] }[]; // Changed from data: any[]
  logoBase64: string | null;
  logoRightBase64: string | null;
  footerBase64: string | null;
  // Fallback for single data mode if needed, but we'll migrate
}

self.onmessage = (e: MessageEvent<PDFWorkerInput>) => {
  try {
    const { title, columns, datasets, logoBase64, logoRightBase64, footerBase64 } = e.data;

    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const marginX = 10;
    const contentWidth = pageWidth - marginX * 2;
    const logoSize = 20; // Match infrequency

    let footerHeight = 20;
    if (footerBase64) {
        try {
            const props = doc.getImageProperties(footerBase64);
            footerHeight = (props.height * contentWidth) / props.width;
        } catch (e) {}
    }

    doc.setFont('times');

    // Helper to draw Header
    const drawHeader = () => {
        let cursorY = 5;
        
        // Left Logo 
        if (logoBase64) {
          doc.addImage(logoBase64, 'PNG', marginX, cursorY, logoSize, logoSize, 'logo_left', 'FAST');
        }
        
        // Right Logo (SEDUC)
        if (logoRightBase64) {
            const rightLogoW = 35;
            const rightLogoH = 20;
            doc.addImage(logoRightBase64, 'JPEG', pageWidth - marginX - rightLogoW, cursorY, rightLogoW, rightLogoH, 'logo_right', 'FAST');
        }

        // Header text
        doc.setFontSize(9);
        doc.setFont('times', 'bold');
    
        const headerLines = [
          'PREFEITURA MUNICIPAL DE SUMÉ - SECRETARIA DE EDUCAÇÃO', 
          'UNIDADE MUNICIPAL DE EDUCAÇÃO INFANTIL E ENSINO FUNDAMENTAL',
          'GONÇALA RODRIGUES DE FREITAS',
        ];

        let textY = cursorY + 5;
        headerLines.forEach((line) => {
          doc.text(line, pageWidth / 2, textY, { align: 'center' }); 
          textY += 4;
        });
        
        return textY + 10; // Return Y position after header
    };

    // Iterate datasets
    for (let i = 0; i < datasets.length; i++) {
        const dataset = datasets[i];
        
        // If not first dataset, add new page
        if (i > 0) {
            doc.addPage();
        }

        // Draw Header for this class
        let cursorY = drawHeader();

        // Main Title
        doc.setFontSize(11);
        doc.setFont('times', 'bold');
        doc.text(title.toUpperCase(), pageWidth / 2, cursorY, { align: 'center' });
        cursorY += 6;

        // Sub Title (Class Name)
        doc.setFontSize(10);
        doc.setFont('times', 'normal');
        doc.text(dataset.subTitle, pageWidth / 2, cursorY, { align: 'center' });
        cursorY += 8;

        // Transform data
        const tableBody = dataset.data.map(row => {
            return columns.map(col => {
                let val = row[col.dataKey];
                if (typeof val === 'boolean') val = val ? 'Sim' : 'Não';
                if (val === undefined || val === null) val = '';
                return String(val);
            });
        });

        const tableHead = [columns.map(c => c.header)];

        autoTable(doc, {
            startY: cursorY,
            head: tableHead,
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
                fontSize: 8 // Slight reduction for portrait
            },
            headStyles: {
                fillColor: [220, 220, 220], 
                textColor: 0,
                fontStyle: 'bold',
                lineWidth: 0.1,
                lineColor: [0, 0, 0]
            },
            columnStyles: {
                // Find name column index and align left dynamically, or align all text columns left?
                // Let's implement didParseCell to align the "Nome" column specifically, since columns are dynamic
            },
            didParseCell: (data) => {
                // Align names to the left dynamically
                // We're passing head: [[titles]], so we need to inspect the title directly
                const titleStr = String(data.table.head[0].cells[data.column.index]?.text || '').toLowerCase();
                if (titleStr.includes('nome')) {
                    data.cell.styles.halign = 'left';
                }
            },
            tableWidth: contentWidth,
            margin: { left: marginX, right: marginX, top: 20, bottom: footerHeight + 5 },
            didDrawPage: (_data) => {
                // Keep header simple on subsequent pages or just leave blank?
                // Infrequency doesn't repeat header on new pages created by autoTable auto-paging
            }
        });

        // Footer drawing is now handled globally for all pages below
    }

    // Add Footers and Page Numbers
    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        if (footerBase64) {
            doc.addImage(footerBase64, 'JPEG', marginX, pageHeight - footerHeight - 10, contentWidth, footerHeight, 'footer', 'FAST');
        }
        doc.setFontSize(8);
        doc.text(`Página ${i} de ${totalPages}`, pageWidth - marginX, pageHeight - 5, { align: 'right' });
    }

    const pdfArrayBuffer = doc.output('arraybuffer');
    // @ts-ignore
    self.postMessage({ success: true, pdfBuffer: pdfArrayBuffer }, [pdfArrayBuffer]);

  } catch (err: any) {
    self.postMessage({ success: false, error: err?.message || String(err) });
  }
};
