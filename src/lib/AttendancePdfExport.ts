import { save } from '@tauri-apps/plugin-dialog';
import { writeFile } from '@tauri-apps/plugin-fs';

const MONTH_NAMES_PT = [
  'JANEIRO', 'FEVEREIRO', 'MARÇO', 'ABRIL', 'MAIO', 'JUNHO',
  'JULHO', 'AGOSTO', 'SETEMBRO', 'OUTUBRO', 'NOVEMBRO', 'DEZEMBRO',
];

// Helper to load font as base64
const loadFontBase64 = async (url: string): Promise<string | null> => {
  try {
    const response = await fetch(url);
    const arrayBuffer = await response.arrayBuffer();
    let binary = '';
    const bytes = new Uint8Array(arrayBuffer);
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
  } catch (e) {
    console.error('Failed to load font', e);
    return null;
  }
};

const loadImageAsBase64 = async (url: string): Promise<string | null> => {
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_SIZE = 500; // Resize to max 500px (sufficient for 15mm logo)
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_SIZE) {
            height *= MAX_SIZE / width;
            width = MAX_SIZE;
          }
        } else {
          if (height > MAX_SIZE) {
            width *= MAX_SIZE / height;
            height = MAX_SIZE;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            // Use JPEG for further compression if opaque, or stick to PNG/JPEG based on source?
            // Safer to return same format or a robust one. 
            // logo-Goncala is PNG.
            resolve(canvas.toDataURL('image/png', 0.8)); 
        } else {
            resolve(null);
        }
      };
      img.onerror = () => resolve(null);
      img.src = URL.createObjectURL(blob);
    });
  } catch {
    return null;
  }
};

interface AttendancePdfParams {
  turma: string;
  professor: string;
  month: number; // 1-12
  year: number;
  students: string[]; // already sorted
}

export const exportAttendancePdf = async (params: AttendancePdfParams) => {
  const { turma, professor, month, year, students } = params;
  const monthName = MONTH_NAMES_PT[month - 1];

  // Load assets on main thread (needs DOM/fetch)
  const [fontBase64, logoLeftBase64, logoRightBase64] = await Promise.all([
    loadFontBase64('/fonts/Times New Roman.ttf'),
    loadImageAsBase64('/images/logo-Goncala.png'),
    loadImageAsBase64('/images/logo-SEDUC.png'),
  ]);

  // Generate PDF in a Web Worker (off main thread)
  const pdfBuffer = await new Promise<ArrayBuffer>((resolve, reject) => {
    const worker = new Worker(new URL('../workers/attendancePdf.worker.ts', import.meta.url), {
      type: 'module',
    });

    worker.onmessage = (e: MessageEvent) => {
      worker.terminate();
      if (e.data.success) {
        resolve(e.data.pdfBuffer);
      } else {
        reject(new Error(e.data.error));
      }
    };

    worker.onerror = (err) => {
      worker.terminate();
      reject(err);
    };

    worker.postMessage({
      turma,
      professor,
      month,
      year,
      students,
      fontBase64,
      logoLeftBase64,
      logoRightBase64,
    });
  });

  // Save via native Tauri dialog (main thread)
  const safeTurma = turma.replace(/[^a-z0-9]/gi, '_');
  const safeMonth = monthName.normalize("NFD").replace(/[\u0300-\u036f]/g, ""); // remove accents
  const defaultName = `Frequencia_${safeTurma}_${safeMonth}_${year}.pdf`;
  const filePath = await save({
    defaultPath: defaultName,
    filters: [{ name: 'PDF', extensions: ['pdf'] }],
  });

  if (filePath) {
    console.log('Saving PDF to:', filePath);
    console.log('PDF buffer size:', pdfBuffer.byteLength);
    try {
      await writeFile(filePath, new Uint8Array(pdfBuffer));
      console.log('File written successfully');
    } catch (err) {
      console.error('Error writing file:', err);
      throw err;
    }
  }
};
