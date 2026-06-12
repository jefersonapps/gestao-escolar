import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { save } from "@tauri-apps/plugin-dialog";
import { writeFile } from "@tauri-apps/plugin-fs";
import { cleanClassName } from "@/lib/utils";
import type {
  SchoolConfig,
  ClassGroup,
  Lesson,
  Subject,
  Professor,
} from "@/types";

// Helper to load font
const loadFont = async (url: string): Promise<string> => {
  const response = await fetch(url);
  const arrayBuffer = await response.arrayBuffer();
  return arrayBufferToBase64(arrayBuffer);
};

// Helper for base64
const arrayBufferToBase64 = (buffer: ArrayBuffer): string => {
  let binary = "";
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
};



const getCellColor = (hex: string) => {
  if (!hex) return [255, 255, 255];
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return [r, g, b];
};

export const exportToPdf = async (
  schoolConfig: SchoolConfig,
  classes: ClassGroup[],
  lessons: Lesson[],
  subjects: Subject[],
  _: Professor[],
) => {
  // Determine Orientation & Layout Math
  const isLandscape = classes.length > 5;
  const orientation = isLandscape ? "landscape" : "portrait";

  const doc = new jsPDF({
    orientation: orientation,
    unit: "mm",
    format: "a4",
  });

  // Load Custom Font (Keep existing logic)
  try {
    const fontBase64 = await loadFont("/fonts/Times New Roman.ttf");
    doc.addFileToVFS("TimesNewRoman.ttf", fontBase64);
    doc.addFont("TimesNewRoman.ttf", "Times New Roman", "normal");
    doc.addFont("TimesNewRoman.ttf", "Times New Roman", "bold"); // Alias for bold
    doc.setFont("Times New Roman");
  } catch (e) {
    console.error("Failed to load Times New Roman", e);
    doc.setFont("times");
  }

  const activeDays = schoolConfig.days.filter((d) => d.enabled);
  const dayNames = [
    "DOMINGO",
    "SEGUNDA",
    "TERÇA",
    "QUARTA",
    "QUINTA",
    "SEXTA",
    "SÁBADO",
  ];

  // Dimensions
  const pageWidth = doc.internal.pageSize.getWidth();
  const marginX = 5;
  const contentWidth = pageWidth - marginX * 2;

  // ABBREVIATION HELPER
  const formatSubjectName = (name: string): string => {
    if (name.length <= 10) return name.toUpperCase();

    const parts = name.split(" ");
    if (parts.length > 1) {
      const first = parts[0];
      let rest = parts
        .slice(1)
        .map((p) => {
          if (p.length <= 2) return p;
          return p[0] + ".";
        })
        .join(" ");

      return `${first} ${rest}`.toUpperCase();
    }
    return name.toUpperCase();
  };

  const getUsingSubject = (classId: string, dayId: string, slotId: string) => {
    const lesson = lessons.find(
      (l) =>
        l.classGroupId === classId && l.dayId === dayId && l.slotId === slotId,
    );
    if (!lesson) return null;
    return subjects.find((s) => s.id === lesson.subjectId);
  };

  // COLUMN WIDTH CALCULATION

  // COLUMN WIDTH CALCULATION
  const colTimeWidth = 20;
  const colAulaWidth = 18;

  const remainingWidth = contentWidth - (colTimeWidth + colAulaWidth);
  const colClassWidth = remainingWidth / classes.length;

  let finalY = 10; // Start at top margin

  for (let index = 0; index < activeDays.length; index++) {
    const day = activeDays[index];
    const dayName = dayNames[day.dayOfWeek];

    const HEAD_COLOR: [number, number, number] = [255, 204, 0];
    const SIDE_COLOR: [number, number, number] = [180, 198, 231];

    // Build Header Rows
    const headerRows: any[] = [];

    // Add Title Row ONLY for the first table (top of page)
    if (index === 0) {
      headerRows.push([
        {
          content: `HORÁRIO DA ${schoolConfig.name.toUpperCase()} ${new Date().getFullYear()}`,
          colSpan: classes.length + 2,
          styles: {
            fillColor: [180, 200, 230], // Light Blue
            textColor: 0,
            fontStyle: "bold",
            halign: "center",
            fontSize: 9, // Same as others
            lineWidth: 0.1,
            lineColor: 0,
          },
        },
      ]);
    }

    // Day Header Row
    headerRows.push([
      {
        content: "HORA",
        styles: {
          fillColor: HEAD_COLOR,
          textColor: 0,
          fontStyle: "bold" as const,
          halign: "center" as const,
          lineWidth: 0.1,
          lineColor: 0,
        },
      },
      {
        content: dayName,
        styles: {
          fillColor: HEAD_COLOR,
          textColor: 0,
          fontStyle: "bold" as const,
          halign: "center" as const,
          lineWidth: 0.1,
          lineColor: 0,
        },
      },
      ...classes.map((c) => ({
        content: cleanClassName(c.name),
        styles: {
          fillColor: HEAD_COLOR,
          textColor: 0,
          fontStyle: "bold" as const,
          halign: "center" as const,
          lineWidth: 0.1,
          lineColor: 0,
        },
      })),
    ]);

    const tableHead = headerRows;

    const tableBody = day.slots.map((slot, slotIndex) => {
      const timeStr = `${slot.startTime} – ${slot.endTime}`;

      if (slot.isInterval) {
        const row = [
          {
            content: timeStr,
            styles: {
              fillColor: SIDE_COLOR,
              fontStyle: "bold" as const,
              fontSize: 7,
            },
          },
          {
            content: "INTERVALO",
            styles: {
              fillColor: SIDE_COLOR,
              fontStyle: "bold" as const,
              fontSize: 7,
            },
          },
          ...classes.map(() => ({
            content: "INTERVALO",
            styles: {
              fillColor: [255, 255, 255] as [number, number, number],
              fontStyle: "bold" as const,
              fontSize: 7,
            },
          })),
        ];
        return row;
      }

      const lessonNumber =
        day.slots.slice(0, slotIndex).filter((s) => !s.isInterval).length + 1;

      return [
        {
          content: timeStr,
          styles: {
            fillColor: SIDE_COLOR,
            fontStyle: "bold" as const,
            fontSize: 7,
          },
        },
        {
          content: `${lessonNumber}ª AULA`,
          styles: {
            fillColor: SIDE_COLOR,
            fontStyle: "bold" as const,
            fontSize: 8,
          },
        },
        ...classes.map((cls) => {
          const sub = getUsingSubject(cls.id, day.id, slot.id);
          const color = sub ? getCellColor(sub.color) : [255, 255, 255];
          const text = sub ? formatSubjectName(sub.name) : "";

          // Adaptive font size based on text length?
          // AutoTable doesn't do this automatically per cell easily without hooks.
          // But we are abbreviating. Let's stick to size 8 or 7.

          return {
            content: text,
            styles: {
              fillColor: color as [number, number, number],
              textColor: 0,
              fontStyle: "bold" as const,
              fontSize: 7.5, // Slightly reduced global default to fit "GEOGRAFIA"
            },
          };
        }),
      ];
    });

    autoTable(doc, {
      startY: finalY,
      head: tableHead,
      body: tableBody as any,
      theme: "grid",
      styles: {
        font: "Times New Roman",
        lineColor: [0, 0, 0],
        lineWidth: 0.1,
        textColor: 0,
        fontSize: 8,
        valign: "middle",
        halign: "center",
        cellPadding: 0.8, // Reduced padding to allow more text space
        overflow: "ellipsize",
      },
      columnStyles: {
        0: { cellWidth: colTimeWidth },
        1: { cellWidth: colAulaWidth },
        // Apply calculated width
        ...Object.fromEntries(
          classes.map((_, i) => [i + 2, { cellWidth: colClassWidth }]),
        ),
      },
      margin: { left: marginX, right: marginX },
      didDrawPage: () => {},
    });

    finalY = (doc as any).lastAutoTable.finalY + 3; // Add 3mm gap between days
    // Actually image shows they are contiguous.
    // If we want them contiguous, finalY should be exactly the bottom line.
    // autoTable usually leaves 0 gap if we preserve Y.
    // BUT we have a header for each day.
  }

  // Save via native Tauri dialog
  const filePath = await save({
    defaultPath: "Horario_Escolar_Geral.pdf",
    filters: [{ name: "PDF", extensions: ["pdf"] }],
  });
  if (filePath) {
    const pdfBytes = doc.output("arraybuffer");
    await writeFile(filePath, new Uint8Array(pdfBytes));
  }
};

export const exportProfessorsToPdf = async (
  schoolConfig: SchoolConfig,
  classes: ClassGroup[],
  lessons: Lesson[],
  subjects: Subject[],
  professors: Professor[]
) => {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  try {
    const fontBase64 = await loadFont("/fonts/Times New Roman.ttf");
    doc.addFileToVFS("TimesNewRoman.ttf", fontBase64);
    doc.addFont("TimesNewRoman.ttf", "Times New Roman", "normal");
    doc.addFont("TimesNewRoman.ttf", "Times New Roman", "bold");
    doc.setFont("Times New Roman");
  } catch (e) {
    console.error("Failed to load Times New Roman", e);
    doc.setFont("times");
  }

  const activeDays = schoolConfig.days.filter((d) => d.enabled);
  const dayNames = [
    "DOMINGO",
    "SEGUNDA",
    "TERÇA",
    "QUARTA",
    "QUINTA",
    "SEXTA",
    "SÁBADO",
  ];

  // Filter professors who have lessons in the current set
  const activeProfessors = professors.filter(p => lessons.some(l => l.professorId === p.id));

  for (let i = 0; i < activeProfessors.length; i++) {
    const prof = activeProfessors[i];
    if (i > 0) doc.addPage();

    const profLessons = lessons.filter(l => l.professorId === prof.id);
    
    // Stats Calculation
    const totalLessons = profLessons.length;
    
    // Calculate Total Duration
    let totalMinutes = 0;
    profLessons.forEach(l => {
        const dayConfig = schoolConfig.days.find(d => d.id === l.dayId);
        if(dayConfig) {
            const slot = dayConfig.slots.find(s => s.id === l.slotId);
            if(slot && !slot.isInterval) {
                 const [h1, m1] = slot.startTime.split(':').map(Number);
                 const [h2, m2] = slot.endTime.split(':').map(Number);
                 totalMinutes += (h2 * 60 + m2) - (h1 * 60 + m1);
            }
        }
    });
    const hours = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    const durationStr = `${hours}h${mins.toString().padStart(2, '0')}`;

    
    // Planning Day
    const activeDaysOfWeek = activeDays.map(d => d.dayOfWeek);
    const workingDays = new Set(profLessons.map(l => {
        const dayConfig = schoolConfig.days.find(d => d.id === l.dayId);
        return dayConfig?.dayOfWeek;
    }).filter(d => d !== undefined));

    const planningDays = activeDaysOfWeek
        .filter(dayOfWeek => !workingDays.has(dayOfWeek))
        .map(d => ['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado'][d])
        .join(', ');

    // Class Stats
    const classStats = classes.map(cls => {
        const lessonsInClass = profLessons.filter(l => l.classGroupId === cls.id);
        const count = lessonsInClass.length;
        if (count === 0) return null;
        
        // Calculate days for this class
        const days = Array.from(new Set(lessonsInClass.map(l => l.dayId)))
            .map(dayId => schoolConfig.days.find(d => d.id === dayId))
            .filter(Boolean)
            .sort((a,b) => (a?.dayOfWeek || 0) - (b?.dayOfWeek || 0))
            .map(d => ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'][d!.dayOfWeek])
            .join(', ');

        return { name: cleanClassName(cls.name), count, days };
    }).filter(Boolean);


    // --- HEADER ---
    doc.setFontSize(14);
    doc.setFont("TimesNewRoman", "bold");
    doc.text(`HORÁRIO INDIVIDUAL - ${prof.name.toUpperCase()}`, 105, 15, { align: "center" });

    doc.setFontSize(10);
    doc.setFont("TimesNewRoman", "normal");
    
    // Workload Line
    const label1 = "Carga Horária Total: ";
    doc.text(label1, 14, 25);
    const w1 = doc.getTextWidth(label1);
    doc.setFont("TimesNewRoman", "bold");
    doc.text(`${totalLessons} aulas (${durationStr})`, 14 + w1, 25);

    // Planning Day Line
    doc.setFont("TimesNewRoman", "normal");
    const label2 = planningDays.includes(',') ? "Dias de Planejamento: " : "Dia de Planejamento: ";
    doc.text(label2, 14, 30);
    const w2 = doc.getTextWidth(label2);
    doc.setFont("TimesNewRoman", "bold");
    doc.text(`${planningDays || 'Nenhum'}`, 14 + w2, 30);

    // Mini Table for Class Stats
    if (classStats.length > 0) {
        autoTable(doc, {
            startY: 35,
            head: [["TURMA", { content: "QTD. AULAS", styles: { halign: 'center' } }, "DIAS DA SEMANA"]],
            body: classStats.map(s => [s?.name || '', `${s?.count || 0} aulas`, s?.days || '']),
            theme: 'grid',
            styles: { 
                font: "TimesNewRoman", // Fix font
                fontSize: 9, 
                cellPadding: 1.5,
                lineColor: [0,0,0],
                lineWidth: 0.1,
                textColor: 0
            },
            headStyles: {
                fillColor: [230, 230, 230],
                textColor: 0,
                fontStyle: 'bold',
                lineColor: [0,0,0],
                lineWidth: 0.1
            },
            columnStyles: { 
                0: { cellWidth: 80 }, 
                1: { cellWidth: 30, halign: 'center' },
                2: { cellWidth: 'auto' } 
            },
            margin: { left: 14, right: 14 }
        });
    }

    // --- SCHEDULE GRID ---
    const startY = (doc as any).lastAutoTable ? (doc as any).lastAutoTable.finalY + 10 : 45;

    const headRow = [
        "HORÁRIO",
        ...activeDays.map(d => dayNames[d.dayOfWeek])
    ];

    // Find max slots
    const maxSlots = Math.max(...activeDays.map(d => d.slots.length));
    const tableBody = [];

    for(let s = 0; s < maxSlots; s++) {
        const row = [];
        
        // Time Column
        const refDay = activeDays.find(d => d.slots[s]);
        if (!refDay) continue;
        const refSlot = refDay.slots[s];
        
        row.push({ content: `${refSlot.startTime} - ${refSlot.endTime}`, styles: { fontStyle: 'bold' } });

        // Days Columns
        for(const day of activeDays) {
            const slot = day.slots[s];
            if (!slot) {
                row.push("");
                continue;
            }

            if (slot.isInterval) {
                row.push({ 
                    content: "INTERVALO", 
                    styles: { 
                        fillColor: [240, 240, 240], 
                        fontStyle: 'bold', 
                        fontSize: 7 
                    } 
                });
                continue;
            }

            const lesson = profLessons.find(l => l.dayId === day.id && l.slotId === slot.id);
            if (lesson) {
                const cls = classes.find(c => c.id === lesson.classGroupId);
                const sub = subjects.find(s => s.id === lesson.subjectId);
                
                const bgColor = sub ? getCellColor(sub.color) : [255, 255, 255];
                
                row.push({
                    content: `${cls ? cleanClassName(cls.name) : '?'}\n${sub?.name || '?'}`,
                    styles: {
                        fillColor: bgColor,
                        fontStyle: 'bold',
                        textColor: [0,0,0] // Keep text black for now
                    }
                });
            } else {
                row.push("");
            }
        }
        tableBody.push(row);
    }

    autoTable(doc, {
        startY: startY,
        head: [headRow],
        body: tableBody as any,
        theme: 'grid',
        styles: {
            font: "TimesNewRoman", // Fix font
            fontSize: 8,
            halign: 'center',
            valign: 'middle',
            cellPadding: 2,
            lineColor: [0, 0, 0],
            lineWidth: 0.1,
            textColor: 0
        },
        headStyles: {
            fillColor: [255, 204, 0],
            textColor: 0,
            fontStyle: 'bold',
            lineColor: [0, 0, 0],
            lineWidth: 0.1
        },
        columnStyles: {
            0: { cellWidth: 25 } // Time column
        }
    });

  }

  const filePath = await save({
    defaultPath: "Horario_Professores_Individual.pdf",
    filters: [{ name: "PDF", extensions: ["pdf"] }],
  });
  
  if (filePath) {
    const pdfBytes = doc.output("arraybuffer");
    await writeFile(filePath, new Uint8Array(pdfBytes));
  }
};
