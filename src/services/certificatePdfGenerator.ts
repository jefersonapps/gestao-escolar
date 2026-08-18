import jsPDF from 'jspdf';
import type { CertificateTemplate, CertificateStudentData } from '@/types/certificates';

// Helper to convert Hex color #RRGGBB to [R, G, B]
const hexToRgb = (hex: string): [number, number, number] => {
  const cleanHex = hex.replace('#', '');
  if (cleanHex.length === 3) {
    const r = parseInt(cleanHex[0] + cleanHex[0], 16);
    const g = parseInt(cleanHex[1] + cleanHex[1], 16);
    const b = parseInt(cleanHex[2] + cleanHex[2], 16);
    return [r, g, b];
  }
  const num = parseInt(cleanHex, 16);
  if (isNaN(num)) return [0, 0, 0];
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
};

export const replacePlaceholders = (
  templateText: string,
  student: CertificateStudentData,
  defaultCustomText: string = ''
): string => {
  if (!templateText) return '';

  const todayStr = new Date().toLocaleDateString('pt-BR');

  return templateText
    .replace(/\{nome_aluno\}/g, student.nome_aluno || '')
    .replace(/\{turma\}/g, student.turma || '')
    .replace(/\{escola\}/g, student.escola || '')
    .replace(/\{colocacao\}/g, student.colocacao || '')
    .replace(/\{avaliacao\}/g, student.avaliacao || '')
    .replace(/\{nota_portugues\}/g, student.nota_portugues || '')
    .replace(/\{nota_matematica\}/g, student.nota_matematica || '')
    .replace(/\{nivel_leitura\}/g, student.nivel_leitura || '')
    .replace(/\{texto_personalizado\}/g, student.texto_personalizado || defaultCustomText || '')
    .replace(/\{data\}/g, student.data || todayStr);
};

export interface GenerateCertificatesOptions {
  template: CertificateTemplate;
  students: CertificateStudentData[];
  onProgress?: (current: number, total: number) => void;
}

export const generateCertificatesPdf = async ({
  template,
  students,
  onProgress,
}: GenerateCertificatesOptions): Promise<Uint8Array> => {
  const orientation = template.orientation || 'landscape';
  
  const doc = new jsPDF({
    orientation: orientation,
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  const total = students.length;

  for (let i = 0; i < total; i++) {
    const student = students[i];

    if (i > 0) {
      doc.addPage();
    }

    if (onProgress) {
      onProgress(i + 1, total);
    }

    // 1. Render Background Image if present
    if (template.bgImage && template.bgImage.startsWith('data:image')) {
      try {
        const imageType = template.bgImage.includes('data:image/png') ? 'PNG' : 'JPEG';
        doc.addImage(template.bgImage, imageType, 0, 0, pageWidth, pageHeight);
      } catch (err) {
        console.warn('Could not render background image into PDF:', err);
      }
    } else {
      // Fallback clean background card with subtle border if no image
      doc.setFillColor(252, 252, 253);
      doc.rect(0, 0, pageWidth, pageHeight, 'F');

      doc.setDrawColor(218, 165, 32); // Gold border
      doc.setLineWidth(3);
      doc.rect(8, 8, pageWidth - 16, pageHeight - 16, 'S');

      doc.setDrawColor(30, 41, 59);
      doc.setLineWidth(0.8);
      doc.rect(12, 12, pageWidth - 24, pageHeight - 24, 'S');
    }

    // 2. Render Text Fields
    for (const field of template.fields) {
      const renderedText = replacePlaceholders(field.text, student, template.customText);
      if (!renderedText.trim()) continue;

      // Position in mm (matching HTML flex items-center box model)
      const fieldX = (field.xPercent / 100) * pageWidth;
      const fieldY = (field.yPercent / 100) * pageHeight;
      const fieldWidth = (field.widthPercent / 100) * pageWidth;
      const fieldHeight = ((field.heightPercent || 10) / 100) * pageHeight;

      // Vertical center of the field container box
      const centerY = fieldY + fieldHeight / 2;

      // Set Font Family & Style
      const fontStyle = field.fontWeight || 'normal';
      const fontFamily = field.fontFamily || 'helvetica';
      doc.setFont(fontFamily, fontStyle);

      // Auto-shrink font size to fit within fieldWidth
      const baseFontSize = field.fontSize || 16;
      const minFontSize = 6;
      let finalFontSize = baseFontSize;
      doc.setFontSize(finalFontSize);

      let textWidth = doc.getTextWidth(renderedText);
      while (textWidth > fieldWidth && finalFontSize > minFontSize) {
        finalFontSize -= 0.5;
        doc.setFontSize(finalFontSize);
        textWidth = doc.getTextWidth(renderedText);
      }

      // Set Text Color
      const [r, g, b] = hexToRgb(field.color || '#1e293b');
      doc.setTextColor(r, g, b);

      // Calculate anchor point based on alignment
      let anchorX = fieldX;
      if (field.align === 'center') {
        anchorX = fieldX + fieldWidth / 2;
      } else if (field.align === 'right') {
        anchorX = fieldX + fieldWidth;
      }

      // Render text centered vertically inside the container box
      doc.text(renderedText, anchorX, centerY, {
        align: field.align || 'left',
        baseline: 'middle',
      });
    }
  }

  const arrayBuffer = doc.output('arraybuffer');
  return new Uint8Array(arrayBuffer);
};
