import React, { useState, useMemo } from 'react';
import type { CertificateTemplate, CertificateStudentData, SaevRankingMode } from '@/types/certificates';
import { CertificateEditorCanvas } from './CertificateEditorCanvas';
import { generateCertificatesPdf } from '@/services/certificatePdfGenerator';
import { useStore } from '@/store/useStore';
import { useExternalAuth } from '@/hooks/useExternalAuth';
import { SaevService } from '@/services/saev';
import { SaevFilterForm, type SaevFilters } from '@/components/reports/SaevFilterForm';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { save } from '@tauri-apps/plugin-dialog';
import { writeFile } from '@tauri-apps/plugin-fs';
import { openPath } from '@tauri-apps/plugin-opener';
import {
  Award,
  Upload,
  Sparkles,
  Users,
  FileDown,
  Search,
  Trophy,
  BookOpen,
  CheckCircle2,
  RefreshCw,
  FolderOpen,
  School,
  Image
} from 'lucide-react';

// Helper: Load image from URL and convert to base64 data URL
const loadImageAsBase64 = (url: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) { reject(new Error('Canvas context unavailable')); return; }
      ctx.drawImage(img, 0, 0);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = () => reject(new Error('Falha ao carregar imagem do modelo'));
    img.src = url;
  });
};

// Built-in Default Templates
const createCertificadoPadraoTemplate = (bgImage: string): CertificateTemplate => ({
  id: 'template_certificado_padrao',
  name: 'Certificado de Reconhecimento',
  orientation: 'landscape',
  bgImage,
  customText: 'Parabenizamos pelo excelente desempenho e dedicação demonstrados nas avaliações.',
  fields: [
    {
      id: 'f_student',
      name: 'Nome do Aluno',
      placeholderKey: '{nome_aluno}',
      xPercent: 23,
      yPercent: 60,
      widthPercent: 63.6,
      heightPercent: 6,
      text: '{nome_aluno}',
      fontSize: 20,
      fontFamily: 'times',
      fontWeight: 'bold',
      color: '#1a365d',
      align: 'left',
    },
    {
      id: 'f_avaliacao',
      name: 'Avaliação',
      placeholderKey: '{avaliacao}',
      xPercent: 23,
      yPercent: 66,
      widthPercent: 63.6,
      heightPercent: 6,
      text: '{avaliacao}',
      fontSize: 20,
      fontFamily: 'times',
      fontWeight: 'bold',
      color: '#1a365d',
      align: 'left',
    },
    {
      id: 'f_resultado',
      name: 'Resultado Alcançado',
      placeholderKey: '{colocacao}',
      xPercent: 32,
      yPercent: 72,
      widthPercent: 54,
      heightPercent: 6,
      text: '{colocacao} — Português: {nota_portugues} — Matemática: {nota_matematica}',
      fontSize: 18,
      fontFamily: 'times',
      fontWeight: 'bold',
      color: '#92400e',
      align: 'left',
    },
    {
      id: 'f_date',
      name: 'Data',
      placeholderKey: '{data}',
      xPercent: 20,
      yPercent: 79,
      widthPercent: 20,
      heightPercent: 5,
      text: '{data}',
      fontSize: 20,
      fontFamily: 'times',
      fontWeight: 'bold',
      color: '#1a365d',
      align: 'left',
    },
  ],
});

const createGoldTemplate = (): CertificateTemplate => ({
  id: 'template_gold',
  name: 'Tradicional Dourado',
  orientation: 'landscape',
  bgImage: '',
  customText: 'Pela excelente participação e dedicação nos estudos.',
  fields: [
    {
      id: 'f_title',
      name: 'Título',
      placeholderKey: '',
      xPercent: 15,
      yPercent: 12,
      widthPercent: 70,
      heightPercent: 15,
      text: 'CERTIFICADO DE MÉRITO',
      fontSize: 32,
      fontFamily: 'times',
      fontWeight: 'bold',
      color: '#92400e',
      align: 'center',
    },
    {
      id: 'f_subtitle',
      name: 'Subtítulo',
      placeholderKey: '',
      xPercent: 15,
      yPercent: 28,
      widthPercent: 70,
      heightPercent: 8,
      text: 'Conferimos o presente certificado ao(à) aluno(a)',
      fontSize: 16,
      fontFamily: 'helvetica',
      fontWeight: 'normal',
      color: '#334155',
      align: 'center',
    },
    {
      id: 'f_student',
      name: 'Nome do Aluno',
      placeholderKey: '{nome_aluno}',
      xPercent: 10,
      yPercent: 38,
      widthPercent: 80,
      heightPercent: 14,
      text: '{nome_aluno}',
      fontSize: 26,
      fontFamily: 'times',
      fontWeight: 'bold',
      color: '#0f172a',
      align: 'center',
    },
    {
      id: 'f_reason',
      name: 'Motivo / Avaliação',
      placeholderKey: '{avaliacao}',
      xPercent: 12,
      yPercent: 54,
      widthPercent: 76,
      heightPercent: 12,
      text: 'Pelo excelente desempenho em {colocacao} no(a) {avaliacao}.',
      fontSize: 16,
      fontFamily: 'helvetica',
      fontWeight: 'normal',
      color: '#334155',
      align: 'center',
    },
    {
      id: 'f_custom',
      name: 'Texto Livre',
      placeholderKey: '{texto_personalizado}',
      xPercent: 15,
      yPercent: 68,
      widthPercent: 70,
      heightPercent: 10,
      text: '{texto_personalizado}',
      fontSize: 14,
      fontFamily: 'helvetica',
      fontWeight: 'italic',
      color: '#475569',
      align: 'center',
    },
    {
      id: 'f_date',
      name: 'Data',
      placeholderKey: '{data}',
      xPercent: 60,
      yPercent: 83,
      widthPercent: 30,
      heightPercent: 8,
      text: 'Emissão: {data}',
      fontSize: 12,
      fontFamily: 'helvetica',
      fontWeight: 'normal',
      color: '#64748b',
      align: 'right',
    },
  ],
});

export function CertificatesControl() {
  const { classes: localClasses, externalSessions, setSaevLoginOpen } = useStore();
  const saevUser = externalSessions['saev'];
  const { requireSession, service } = useExternalAuth('saev');
  const saevService = service as SaevService;

  // State: Active Step
  const [activeStep, setActiveStep] = useState<string>('template');

  // State: Template & Canvas
  const [template, setTemplate] = useState<CertificateTemplate>(createCertificadoPadraoTemplate('/images/certificado_padrao.png'));
  const [isLoadingPreset, setIsLoadingPreset] = useState(false);

  // Handler: Select the Certificado Padrão preset
  const handleSelectCertificadoPadrao = async () => {
    setIsLoadingPreset(true);
    try {
      const base64 = await loadImageAsBase64('/images/certificado_padrao.png');
      setTemplate(createCertificadoPadraoTemplate(base64));
      setActiveStep('canvas');
      toast.success('Modelo "Certificado de Reconhecimento" carregado! Avancei para o passo 2.');
    } catch (err: any) {
      console.error('Error loading preset image:', err);
      toast.error('Erro ao carregar imagem do modelo padrão: ' + (err.message || String(err)));
    } finally {
      setIsLoadingPreset(false);
    }
  };

  // State: Student Data Source
  const [sourceType, setSourceType] = useState<'saev' | 'local' | 'manual'>('saev');
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [customTextReplicated] = useState<string>(
    'Pelo empenho e excelente resultado obtido.'
  );

  // State: SAEV Data & Ranking Filter
  const [isFetchingSaev, setIsFetchingSaev] = useState(false);
  const [saevSearchScope, setSaevSearchScope] = useState<'school' | 'class'>('school');
  const [saevRawStudents, setSaevRawStudents] = useState<CertificateStudentData[]>([]);
  const [rankingMode, setRankingMode] = useState<SaevRankingMode>('all');
  const [readingLevelFilter, setReadingLevelFilter] = useState<string>('all');
  const [etapaFilter, setEtapaFilter] = useState<'all' | 'fund1' | 'fund2'>('all');

  // State: Selected Students for PDF Batch
  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(new Set());

  // State: PDF Generation
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [pdfProgress, setPdfProgress] = useState(0);
  const [generatedPdfPath, setGeneratedPdfPath] = useState<string | null>(null);

  // Handle Custom Image Background Upload
  const handleBgUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Por favor, selecione um arquivo de imagem (PNG ou JPG).');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      setTemplate((prev) => ({
        ...prev,
        bgImage: base64,
      }));
      setActiveStep('canvas');
      toast.success('Imagem do certificado carregada! Avancei para o passo 2 para desenhar as caixas de texto.');
    };
    reader.readAsDataURL(file);
  };

  // Fetch SAEV Data & Calculate Rankings
  const handleFetchSaevData = async (filters: SaevFilters) => {
    const hasSession = await requireSession();
    if (!hasSession) return;

    setIsFetchingSaev(true);
    const edLabel = (filters as any).edicaoLabel || filters.edicao || 'Avaliação Formativa';
    const escolaLabel = (filters as any).escolaLabel || filters.escola || 'Escola';

    try {
      const allFluencyDetail: any[] = [];

      if (saevSearchScope === 'school') {
        toast.info('Buscando todas as turmas da escola no SAEV...');

        // 1. Fetch ALL series for this school
        const allSeries = await saevService.getFilterOptions('serie', filters);
        const targetClasses: { label: string; value: string; serieId: string }[] = [];

        // 2. Fetch classes for EACH series
        for (const s of allSeries) {
          const classesForSeries = await saevService.getFilterOptions('turma', { ...filters, serie: s.value });
          classesForSeries.forEach((c) => {
            if (!targetClasses.some((tc) => tc.value === c.value)) {
              targetClasses.push({ ...c, serieId: s.value });
            }
          });
        }

        // Fallback to selected class if targetClasses is empty
        if (targetClasses.length === 0 && filters.turma) {
          targetClasses.push({
            label: (filters as any).turmaLabel || filters.turma,
            value: filters.turma,
            serieId: filters.serie,
          });
        }

        console.log(`[CertificatesControl] Scraping ${targetClasses.length} classes across school.`);

        for (let i = 0; i < targetClasses.length; i++) {
          const cls = targetClasses[i];
          toast.info(`Buscando turma ${i + 1} de ${targetClasses.length}: ${cls.label}`);
          const currentFilters = { ...filters, serie: cls.serieId, turma: cls.value };
          const data = await saevService.scrapeReportData(currentFilters);
          const fluencyDetail = data?.find((d: any) => d.type === 'FLUENCY_DETAIL')?.data || [];
          fluencyDetail.forEach((row: any) => {
            allFluencyDetail.push({ ...row, turmaName: cls.label });
          });
        }
      } else {
        // Single Class Mode
        const selectedTurmaLabel = (filters as any).turmaLabel || filters.turma || 'Turma Selecionada';
        toast.info(`Buscando alunos da turma ${selectedTurmaLabel}...`);
        const data = await saevService.scrapeReportData(filters);
        const fluencyDetail = data?.find((d: any) => d.type === 'FLUENCY_DETAIL')?.data || [];
        fluencyDetail.forEach((row: any) => {
          allFluencyDetail.push({ ...row, turmaName: selectedTurmaLabel });
        });
      }

      if (allFluencyDetail.length === 0) {
        toast.error('Nenhum dado encontrado no SAEV para os filtros selecionados.');
        setIsFetchingSaev(false);
        return;
      }

      // Aggregation map by student name
      const studentMap = new Map<string, {
        id: string;
        nome_aluno: string;
        turma: string;
        escola: string;
        avaliacao: string;
        nota_portugues: string;
        nota_matematica: string;
        nivel_leitura: string;
        data: string;
        texto_personalizado: string;
        rawPort: number | null;
        rawMat: number | null;
      }>();

      allFluencyDetail.forEach((row: any, idx: number) => {
        const rawName = (row.nome || row.aluno || `Aluno ${idx + 1}`).trim();
        if (!rawName) return;
        const studentName = rawName.toUpperCase();

        const rawMedia = row.media !== undefined && row.media !== '' ? row.media : (row.percentualAcerto !== undefined ? row.percentualAcerto : row.avg);
        let parsedScore: number | null = null;
        if (rawMedia !== undefined && rawMedia !== null && rawMedia !== '') {
          const num = parseFloat(String(rawMedia).replace('%', '').replace(',', '.').trim());
          if (Number.isFinite(num)) {
            parsedScore = Math.round(num);
          }
        }

        const readingLevel = row.nivel || row.readingType || row.leitura || '';
        const subj = String(row.materia || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

        let student = studentMap.get(studentName);
        if (!student) {
          student = {
            id: `saev_st_${idx}_${studentName.replace(/\s+/g, '_')}`,
            nome_aluno: studentName,
            turma: row.turmaName || row.turma || 'Turma',
            escola: escolaLabel,
            avaliacao: edLabel,
            nota_portugues: '-',
            nota_matematica: '-',
            nivel_leitura: 'Não avaliado',
            data: new Date().toLocaleDateString('pt-BR'),
            texto_personalizado: customTextReplicated,
            rawPort: null,
            rawMat: null,
          };
          studentMap.set(studentName, student);
        }

        if (readingLevel && readingLevel !== 'Não avaliado' && readingLevel !== 'Não informado') {
          student.nivel_leitura = readingLevel;
        }

        if (subj.includes('portugues') || subj === '1') {
          if (parsedScore !== null) {
            student.rawPort = parsedScore;
            student.nota_portugues = `${parsedScore}%`;
          }
        } else if (subj.includes('matematica') || subj === '2') {
          if (parsedScore !== null) {
            student.rawMat = parsedScore;
            student.nota_matematica = `${parsedScore}%`;
          }
        } else {
          if (parsedScore !== null && student.rawPort === null) {
            student.rawPort = parsedScore;
            student.nota_portugues = `${parsedScore}%`;
          }
        }
      });

      // Compute rawScore average
      const aggregatedList = Array.from(studentMap.values()).map((st) => {
        let sum = 0;
        let count = 0;
        if (st.rawPort !== null) { sum += st.rawPort; count++; }
        if (st.rawMat !== null) { sum += st.rawMat; count++; }
        const averageScore = count > 0 ? Math.round(sum / count) : 0;
        return {
          ...st,
          rawScore: averageScore,
        };
      });

      setSaevRawStudents(aggregatedList);
      setSelectedStudentIds(new Set(aggregatedList.map((s) => s.id)));
      const scopeName = saevSearchScope === 'school' ? 'da escola inteira' : 'da turma';
      toast.success(`${aggregatedList.length} alunos ${scopeName} carregados do SAEV com sucesso!`);
    } catch (err: any) {
      console.error('Error fetching SAEV data:', err);
      toast.error('Erro ao buscar dados do SAEV: ' + (err.message || String(err)));
    } finally {
      setIsFetchingSaev(false);
    }
  };

  // Local System Students
  const localStudentsList = useMemo<CertificateStudentData[]>(() => {
    if (sourceType === 'local' && selectedClassId) {
      const cls = localClasses.find((c) => c.id === selectedClassId);
      if (cls && cls.students) {
        return cls.students.map((st, i) => ({
          id: st.id,
          nome_aluno: st.name.toUpperCase(),
          turma: cls.name,
          escola: 'Escola',
          colocacao: `${i + 1}º Lugar`,
          rankNumber: i + 1,
          avaliacao: 'Avaliação Escolar 2026',
          data: new Date().toLocaleDateString('pt-BR'),
          texto_personalizado: customTextReplicated,
        }));
      }
    }
    return [];
  }, [sourceType, selectedClassId, localClasses, customTextReplicated]);

  // Combined Active Students
  const currentStudentsSource = useMemo<CertificateStudentData[]>(() => {
    if (sourceType === 'saev') return saevRawStudents;
    if (sourceType === 'local') return localStudentsList;

    // Manual Default List
    return [
      {
        id: 'man_1',
        nome_aluno: 'LUCAS SANTOS PEREIRA',
        turma: '5º ANO B',
        escola: 'Escola Modelo',
        colocacao: '1º Lugar',
        rankNumber: 1,
        avaliacao: 'Avaliação Formativa 1',
        nota_portugues: '96%',
        nota_matematica: '92%',
        nivel_leitura: 'Fluente',
        data: new Date().toLocaleDateString('pt-BR'),
        texto_personalizado: customTextReplicated,
      },
      {
        id: 'man_2',
        nome_aluno: 'ANA JULIA FERREIRA',
        turma: '5º ANO B',
        escola: 'Escola Modelo',
        colocacao: '2º Lugar',
        rankNumber: 2,
        avaliacao: 'Avaliação Formativa 1',
        nota_portugues: '90%',
        nota_matematica: '88%',
        nivel_leitura: 'Fluente',
        data: new Date().toLocaleDateString('pt-BR'),
        texto_personalizado: customTextReplicated,
      },
    ];
  }, [sourceType, saevRawStudents, localStudentsList, customTextReplicated]);

  // Available unique reading levels in current dataset
  const availableReadingLevels = useMemo(() => {
    const levels = new Set<string>();
    currentStudentsSource.forEach((st) => {
      if (st.nivel_leitura && st.nivel_leitura !== '-' && st.nivel_leitura !== 'Não avaliado') {
        levels.add(st.nivel_leitura.trim());
      }
    });
    const preferredOrder = ['Fluente', 'Frases', 'Palavras', 'Sílabas', 'Não Fluente', 'Não Leitor', 'Não Avaliado'];
    const list = Array.from(levels);
    list.sort((a, b) => {
      const idxA = preferredOrder.indexOf(a);
      const idxB = preferredOrder.indexOf(b);
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return a.localeCompare(b);
    });
    return list;
  }, [currentStudentsSource]);

  // Step 0.5: Filter by Etapa (Fundamental I = 1º-5º, Fundamental II = 6º-9º)
  const etapaFilteredStudents = useMemo(() => {
    if (etapaFilter === 'all') return currentStudentsSource;

    return currentStudentsSource.filter((student) => {
      const turma = (student.turma || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
      // Extract the grade number from turma name (e.g. "1º Ano A" -> 1, "6º Ano B" -> 6)
      const match = turma.match(/(\d+)/);
      if (!match) return etapaFilter === 'fund1'; // default to fund1 if no number found
      const gradeNum = parseInt(match[1], 10);
      if (etapaFilter === 'fund1') return gradeNum >= 1 && gradeNum <= 5;
      if (etapaFilter === 'fund2') return gradeNum >= 6 && gradeNum <= 9;
      return true;
    });
  }, [currentStudentsSource, etapaFilter]);

  // Step 1: Filter raw students by Reading Level
  const levelFilteredStudents = useMemo(() => {
    if (readingLevelFilter === 'all') return etapaFilteredStudents;

    return etapaFilteredStudents.filter((student) => {
      const rawLev = (student.nivel_leitura || '').trim();
      const levNorm = rawLev
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase();
      const filterNorm = readingLevelFilter
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase();

      if (filterNorm === 'fluente') {
        return levNorm === 'fluente' || (levNorm.includes('fluente') && !levNorm.includes('nao'));
      }
      if (filterNorm === 'nao fluente') {
        return levNorm.includes('nao') && levNorm.includes('fluente');
      }
      return levNorm === filterNorm || rawLev.toLowerCase() === readingLevelFilter.toLowerCase();
    });
  }, [etapaFilteredStudents, readingLevelFilter]);

  // Step 2: Dynamically Calculate Dense Podium Ranking (1º, 2º, 3º...) for the Filtered Subset
  const dynamicallyRankedStudents = useMemo(() => {
    const sorted = [...levelFilteredStudents].sort((a, b) => (b.rawScore || 0) - (a.rawScore || 0));

    let currentRank = 1;
    return sorted.map((st, i) => {
      if (i > 0 && (st.rawScore || 0) < (sorted[i - 1].rawScore || 0)) {
        currentRank++;
      }
      return {
        ...st,
        colocacao: `${currentRank}º Lugar`,
        rankNumber: currentRank,
      };
    });
  }, [levelFilteredStudents]);

  // Step 3: Counts per filter mode for active subset
  const filterCounts = useMemo(() => {
    let top1 = 0;
    let top3 = 0;
    let top5 = 0;

    dynamicallyRankedStudents.forEach((student) => {
      const rank = student.rankNumber || 999;
      if (rank === 1) top1++;
      if (rank <= 3) top3++;
      if (rank <= 5) top5++;
    });

    return {
      all: dynamicallyRankedStudents.length,
      top1,
      top3,
      top5
    };
  }, [dynamicallyRankedStudents]);

  // Step 4: Filter by Ranking Mode (top1, top3, top5, all)
  const filteredStudents = useMemo(() => {
    return dynamicallyRankedStudents.filter((student) => {
      if (rankingMode === 'top1') return student.rankNumber === 1;
      if (rankingMode === 'top3') return (student.rankNumber || 999) <= 3;
      if (rankingMode === 'top5') return (student.rankNumber || 999) <= 5;
      return true;
    });
  }, [dynamicallyRankedStudents, rankingMode]);

  // Final List of Students selected for PDF generation
  const activeStudentsForPdf = useMemo(() => {
    return filteredStudents.filter((s) => selectedStudentIds.size === 0 || selectedStudentIds.has(s.id));
  }, [filteredStudents, selectedStudentIds]);

  // Toggle Individual Student Selection
  const handleToggleStudent = (id: string) => {
    const next = new Set(selectedStudentIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedStudentIds(next);
  };

  // Toggle All
  const handleToggleAllStudents = (checked: boolean) => {
    if (checked) {
      setSelectedStudentIds(new Set(filteredStudents.map((s) => s.id)));
    } else {
      setSelectedStudentIds(new Set());
    }
  };

  // Generate Batch PDF
  const handleGeneratePdf = async () => {
    if (activeStudentsForPdf.length === 0) {
      toast.error('Nenhum aluno selecionado para gerar certificados.');
      return;
    }

    setIsGeneratingPdf(true);
    setPdfProgress(0);

    try {
      const pdfBytes = await generateCertificatesPdf({
        template,
        students: activeStudentsForPdf,
        onProgress: (curr, total) => {
          setPdfProgress(Math.round((curr / total) * 100));
        },
      });

      const defaultFileName = `Certificados_${template.name.replace(/\s+/g, '_')}_${new Date().getTime()}.pdf`;

      const savePath = await save({
        filters: [{ name: 'Documento PDF', extensions: ['pdf'] }],
        defaultPath: defaultFileName,
      });

      if (savePath) {
        await writeFile(savePath, pdfBytes);
        setGeneratedPdfPath(savePath);
        toast.success(`Certificados em PDF gerados e salvos com sucesso! (${activeStudentsForPdf.length} páginas)`);
      }
    } catch (err: any) {
      console.error('Error generating PDF certificates:', err);
      toast.error('Erro ao gerar certificados PDF: ' + (err.message || String(err)));
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-card border rounded-xl p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-600">
            <Award className="w-7 h-7" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Gerador de Certificados em Lote</h1>
            <p className="text-sm text-muted-foreground">
              Desenhe o modelo, integre dados do SAEV com filtro por colocação (1º, 2º, 3º lugar) e gere PDFs em lote.
            </p>
          </div>
        </div>
      </div>

      {/* Main Wizard Navigation Tabs */}
      <Tabs value={activeStep} onValueChange={setActiveStep} className="w-full">
        <TabsList className="grid grid-cols-2 md:grid-cols-4 w-full p-1.5 bg-slate-200/70 dark:bg-slate-800 rounded-2xl border border-slate-300/60 dark:border-slate-700 gap-1.5 group-data-[orientation=horizontal]/tabs:h-auto">
          <TabsTrigger value="template" className="h-11 py-2 px-3 text-xs md:text-sm font-bold rounded-xl transition-all data-[state=active]:bg-white data-[state=active]:text-amber-900 data-[state=active]:shadow-md data-[state=active]:border-slate-200 text-slate-600 hover:text-slate-900 gap-2 border border-transparent">
            <span>🎨</span> 1. Modelo de Fundo
          </TabsTrigger>
          <TabsTrigger value="canvas" className="h-11 py-2 px-3 text-xs md:text-sm font-bold rounded-xl transition-all data-[state=active]:bg-white data-[state=active]:text-amber-900 data-[state=active]:shadow-md data-[state=active]:border-slate-200 text-slate-600 hover:text-slate-900 gap-2 border border-transparent">
            <span>✏️</span> 2. Desenhar Caixas de Texto
          </TabsTrigger>
          <TabsTrigger value="students" className="h-11 py-2 px-3 text-xs md:text-sm font-bold rounded-xl transition-all data-[state=active]:bg-white data-[state=active]:text-amber-900 data-[state=active]:shadow-md data-[state=active]:border-slate-200 text-slate-600 hover:text-slate-900 gap-2 border border-transparent">
            <span>👥</span> 3. Alunos & Ranking SAEV
          </TabsTrigger>
          <TabsTrigger value="export" className="h-11 py-2 px-3 text-xs md:text-sm font-bold rounded-xl transition-all data-[state=active]:bg-white data-[state=active]:text-amber-900 data-[state=active]:shadow-md data-[state=active]:border-slate-200 text-slate-600 hover:text-slate-900 gap-2 border border-transparent">
            <span>📄</span> 4. Gerar e Baixar PDF
          </TabsTrigger>
        </TabsList>

        {/* STEP 1: BACKGROUND TEMPLATE */}
        <TabsContent value="template" className="mt-6 space-y-6">
          <Card className="rounded-xl border shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Upload className="w-5 h-5 text-primary" />
                Upload de Imagem de Certificado ou Escolha de Modelo
              </CardTitle>
              <CardDescription>
                Suba o arquivo de imagem do seu próprio certificado (PNG ou JPG) ou utilize nosso modelo padrão pré-configurado.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Custom Upload Button */}
              <div className="border-2 border-dashed border-primary/30 hover:border-primary rounded-xl p-8 text-center transition-colors bg-primary/5 flex flex-col items-center justify-center space-y-3">
                <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                  <Upload className="w-7 h-7" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm">Subir Minha Imagem de Certificado</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">Selecione uma imagem (PNG, JPG, JPEG) para ser a arte de fundo.</p>
                </div>
                <Label htmlFor="bg-upload-input" className="cursor-pointer">
                  <Button variant="default" size="sm" asChild className="gap-2">
                    <span>
                      <Upload className="w-4 h-4" /> Selecionar Imagem do Computador
                    </span>
                  </Button>
                </Label>
                <input
                  id="bg-upload-input"
                  type="file"
                  accept="image/*"
                  onChange={handleBgUpload}
                  className="hidden"
                />
              </div>

              {/* Preset Selection Cards */}
              <div className="space-y-3">
                <Label className="text-sm font-semibold">Ou Selecione um Modelo Pré-desenhado:</Label>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Preset 1: Certificado de Reconhecimento (imagem padrão) */}
                  <div
                    onClick={handleSelectCertificadoPadrao}
                    className={`border-2 rounded-xl p-4 cursor-pointer transition-all ${template.id === 'template_certificado_padrao'
                      ? 'border-blue-600 bg-blue-50/50 shadow-md ring-2 ring-blue-500/20'
                      : 'hover:border-blue-300 bg-card'
                      } ${isLoadingPreset ? 'opacity-60 pointer-events-none' : ''}`}
                  >
                    <div className="h-28 rounded-md border-2 border-blue-700/30 bg-slate-50 flex items-center justify-center p-1 mb-3 overflow-hidden">
                      <img
                        src="/images/certificado_padrao.png"
                        alt="Certificado de Reconhecimento"
                        className="h-full w-full object-contain rounded"
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <Image className="w-3.5 h-3.5 text-blue-700" />
                        <span className="font-semibold text-xs">Certificado de Reconhecimento</span>
                      </div>
                      {template.id === 'template_certificado_padrao' && (
                        <CheckCircle2 className="w-4 h-4 text-blue-600" />
                      )}
                    </div>
                    {isLoadingPreset && (
                      <div className="text-[10px] text-blue-600 mt-1.5 flex items-center gap-1">
                        <RefreshCw className="w-3 h-3 animate-spin" /> Carregando modelo...
                      </div>
                    )}
                  </div>

                  {/* Preset 2: Modelo Dourado Tradicional */}
                  <div
                    onClick={() => {
                      setTemplate(createGoldTemplate());
                      setActiveStep('canvas');
                      toast.success('Modelo selecionado! Avancei para o passo 2 para desenhar as caixas de texto.');
                    }}
                    className={`border-2 rounded-xl p-4 cursor-pointer transition-all ${template.id === 'template_gold' && !template.bgImage
                      ? 'border-amber-500 bg-amber-50/50 shadow-md ring-2 ring-amber-500/20'
                      : 'hover:border-amber-300 bg-card'
                      }`}
                  >
                    <div className="h-28 rounded-md border-2 border-amber-600/30 bg-slate-50 flex flex-col items-center justify-center p-2 mb-3 text-center">
                      <div className="text-amber-800 font-serif text-xs font-bold">CERTIFICADO DOURADO</div>
                      <div className="text-[9px] text-slate-500 mt-1">Borda Tradicional em Ouro</div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-xs">Modelo Dourado Tradicional</span>
                      {template.id === 'template_gold' && !template.bgImage && (
                        <CheckCircle2 className="w-4 h-4 text-amber-600" />
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-4 border-t">
                <Button onClick={() => setActiveStep('canvas')} className="gap-2 bg-amber-600 hover:bg-amber-700">
                  Avançar para Desenhar Caixas de Texto &rarr;
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* STEP 2: CANVAS EDITOR */}
        <TabsContent value="canvas" className="mt-6 space-y-6">
          <CertificateEditorCanvas
            template={template}
            onChangeTemplate={setTemplate}
            sampleStudent={filteredStudents[0] || undefined}
          />
          <div className="flex justify-between items-center pt-4 border-t">
            <Button variant="outline" onClick={() => setActiveStep('template')}>
              &larr; Voltar para Modelo
            </Button>
            <Button onClick={() => setActiveStep('students')} className="gap-2 bg-amber-600 hover:bg-amber-700">
              Avançar para Seleção de Alunos & SAEV &rarr;
            </Button>
          </div>
        </TabsContent>

        {/* STEP 3: STUDENTS & SAEV RANKING */}
        <TabsContent value="students" className="mt-6 space-y-6">
          {/* Data Source Switcher */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Users className="w-5 h-5 text-primary" />
                Fonte dos Alunos para os Certificados
              </CardTitle>
              <CardDescription>
                Escolha se deseja utilizar o resultado do SAEV com filtro por colocação (1º, 2º, 3º lugar), selecionar turmas cadastradas no sistema ou lista de teste.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div
                  onClick={() => setSourceType('saev')}
                  className={`border-2 rounded-xl p-4 cursor-pointer transition-all ${sourceType === 'saev'
                    ? 'border-amber-500 bg-amber-50/50 shadow-md ring-2 ring-amber-500/20'
                    : 'hover:border-amber-300 bg-card'
                    }`}
                >
                  <div className="flex items-center gap-2 font-bold text-sm text-amber-800 mb-1">
                    <Trophy className="w-4 h-4 text-amber-600" />
                    Resultados SAEV (Com Ranking)
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Busca percentuais de Português, Matemática e Leitura diretamente do SAEV e calcula o ranking 1º, 2º, 3º...
                  </p>
                </div>

                <div
                  onClick={() => setSourceType('local')}
                  className={`border-2 rounded-xl p-4 cursor-pointer transition-all ${sourceType === 'local'
                    ? 'border-amber-500 bg-amber-50/50 shadow-md ring-2 ring-amber-500/20'
                    : 'hover:border-amber-300 bg-card'
                    }`}
                >
                  <div className="flex items-center gap-2 font-bold text-sm text-slate-800 mb-1">
                    <BookOpen className="w-4 h-4 text-primary" />
                    Turmas do Sistema Local
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Selecione uma turma já cadastrada no seu sistema para gerar os certificados da turma inteira.
                  </p>
                </div>

                <div
                  onClick={() => setSourceType('manual')}
                  className={`border-2 rounded-xl p-4 cursor-pointer transition-all ${sourceType === 'manual'
                    ? 'border-amber-500 bg-amber-50/50 shadow-md ring-2 ring-amber-500/20'
                    : 'hover:border-amber-300 bg-card'
                    }`}
                >
                  <div className="flex items-center gap-2 font-bold text-sm text-slate-800 mb-1">
                    <Sparkles className="w-4 h-4 text-indigo-600" />
                    Lista de Teste / Exemplo
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Utilize uma lista de teste rápida para verificar o resultado e formatação do PDF.
                  </p>
                </div>
              </div>



              {/* SAEV Integration & Filter Form */}
              {sourceType === 'saev' && (
                <div className="space-y-6 pt-4 border-t">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-bold text-base flex items-center gap-2">
                        <Search className="w-4 h-4 text-amber-600" />
                        Buscar Desempenho e Gerar Ranking no SAEV
                      </h3>
                      <p className="text-xs text-muted-foreground">
                        Filtre a escola e avaliação para trazer as notas e posições dos estudantes.
                      </p>
                    </div>

                    {!saevUser && (
                      <Button variant="outline" size="sm" onClick={() => setSaevLoginOpen(true)} className="gap-2 border-green-300 text-green-700 hover:bg-green-50">
                        Entrar no SAEV
                      </Button>
                    )}
                  </div>

                  {/* Dedicated Scope Selector Buttons: Escola Toda vs Turma Atual */}
                  <div className="bg-emerald-50/80 border border-emerald-200 rounded-xl p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-bold text-emerald-950 flex items-center gap-2">
                        <School className="w-4 h-4 text-emerald-700" />
                        Escopo da Busca do Ranking:
                      </Label>
                      <Badge variant="outline" className="bg-emerald-100 text-emerald-900 border-emerald-300 text-[10px]">
                        {saevSearchScope === 'school' ? 'Modo: Escola Completa' : 'Modo: Turma Selecionada'}
                      </Badge>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <Button
                        type="button"
                        variant={saevSearchScope === 'school' ? 'default' : 'outline'}
                        onClick={() => setSaevSearchScope('school')}
                        className={`h-auto py-3 px-4 flex items-start gap-3 text-left justify-start transition-all ${saevSearchScope === 'school'
                          ? 'bg-green-700 hover:bg-green-800 text-white shadow-md ring-2 ring-green-600/30'
                          : 'bg-white hover:bg-green-50 border-green-200 text-green-950'
                          }`}
                      >
                        <School className={`w-5 h-5 shrink-0 mt-0.5 ${saevSearchScope === 'school' ? 'text-amber-300' : 'text-green-700'}`} />
                        <div>
                          <div className="font-bold text-xs">🏫 Buscar Ranking na ESCOLA TODA</div>
                          <div className={`text-[11px] leading-tight ${saevSearchScope === 'school' ? 'text-green-100' : 'text-muted-foreground'}`}>
                            Varre todas as turmas da escola e classifica os melhores colocados gerais.
                          </div>
                        </div>
                      </Button>

                      <Button
                        type="button"
                        variant={saevSearchScope === 'class' ? 'default' : 'outline'}
                        onClick={() => setSaevSearchScope('class')}
                        className={`h-auto py-3 px-4 flex items-start gap-3 text-left justify-start transition-all ${saevSearchScope === 'class'
                          ? 'bg-green-700 hover:bg-green-800 text-white shadow-md ring-2 ring-green-600/30'
                          : 'bg-white hover:bg-green-50 border-green-200 text-green-950'
                          }`}
                      >
                        <Users className={`w-5 h-5 shrink-0 mt-0.5 ${saevSearchScope === 'class' ? 'text-amber-300' : 'text-green-700'}`} />
                        <div>
                          <div className="font-bold text-xs">👥 Buscar Apenas na TURMA SELECIONADA</div>
                          <div className={`text-[11px] leading-tight ${saevSearchScope === 'class' ? 'text-green-100' : 'text-muted-foreground'}`}>
                            Restringe a busca e colocação aos alunos da turma escolhida.
                          </div>
                        </div>
                      </Button>
                    </div>
                  </div>

                  <SaevFilterForm
                    onSubmit={handleFetchSaevData}
                    isLoading={isFetchingSaev}
                    showReportOptions={false}
                    submitButtonLabel={saevSearchScope === 'school' ? '🏆 Buscar Ranking da ESCOLA TODA' : '👥 Buscar Ranking da TURMA SELECIONADA'}
                  />

                  {/* Ranking Filter Controls */}
                  {saevRawStudents.length > 0 && (
                    <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <Label className="text-sm font-bold text-amber-900 flex items-center gap-1.5">
                          <Trophy className="w-4 h-4 text-amber-600" />
                          Filtrar Alunos por Destaque / Ranking:
                        </Label>
                        <Badge variant="secondary" className="bg-amber-100 text-amber-900">
                          Total Carregado: {saevRawStudents.length} alunos
                        </Badge>
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex flex-wrap gap-2">
                          <Button
                            size="sm"
                            variant={rankingMode === 'all' ? 'default' : 'outline'}
                            onClick={() => setRankingMode('all')}
                            className="text-xs gap-1.5"
                          >
                            🏆 Todos os Alunos ({filterCounts.all})
                          </Button>
                          <Button
                            size="sm"
                            variant={rankingMode === 'top1' ? 'default' : 'outline'}
                            onClick={() => setRankingMode('top1')}
                            className="text-xs gap-1.5"
                          >
                            🥇 Apenas 1º Lugar ({filterCounts.top1})
                          </Button>
                          <Button
                            size="sm"
                            variant={rankingMode === 'top3' ? 'default' : 'outline'}
                            onClick={() => setRankingMode('top3')}
                            className="text-xs gap-1.5"
                          >
                            🥇🥈🥉 Top 3 (1º, 2º e 3º) ({filterCounts.top3})
                          </Button>
                          <Button
                            size="sm"
                            variant={rankingMode === 'top5' ? 'default' : 'outline'}
                            onClick={() => setRankingMode('top5')}
                            className="text-xs gap-1.5"
                          >
                            ⭐ Top 5 (1º ao 5º) ({filterCounts.top5})
                          </Button>
                        </div>

                        {/* Etapa Filter Dropdown */}
                        <div className="flex items-center gap-2">
                          <Label className="text-xs font-semibold text-amber-900 flex items-center gap-1">
                            <School className="w-3.5 h-3.5 text-amber-700" />
                            Etapa:
                          </Label>
                          <select
                            value={etapaFilter}
                            onChange={(e) => setEtapaFilter(e.target.value as 'all' | 'fund1' | 'fund2')}
                            className="h-8 text-xs font-medium border border-amber-300 rounded-md bg-white text-slate-900 px-2.5 shadow-xs focus:ring-2 focus:ring-amber-500/20"
                          >
                            <option value="all">🏫 Todas as Etapas</option>
                            <option value="fund1">📗 Fundamental I (1º ao 5º)</option>
                            <option value="fund2">📘 Fundamental II (6º ao 9º)</option>
                          </select>
                        </div>

                        {/* Reading Level Filter Dropdown */}
                        <div className="flex items-center gap-2">
                          <Label className="text-xs font-semibold text-amber-900 flex items-center gap-1">
                            <BookOpen className="w-3.5 h-3.5 text-amber-700" />
                            Filtrar por Leitura:
                          </Label>
                          <select
                            value={readingLevelFilter}
                            onChange={(e) => setReadingLevelFilter(e.target.value)}
                            className="h-8 text-xs font-medium border border-amber-300 rounded-md bg-white text-slate-900 px-2.5 shadow-xs focus:ring-2 focus:ring-amber-500/20"
                          >
                            <option value="all">📖 Todos os Níveis ({currentStudentsSource.length})</option>
                            {availableReadingLevels.map((lvl) => (
                              <option key={lvl} value={lvl}>📖 {lvl}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Local System Class Selector */}
              {sourceType === 'local' && (
                <div className="space-y-3 pt-4 border-t">
                  <Label className="text-sm font-semibold">Selecione a Turma Cadastrada:</Label>
                  <select
                    value={selectedClassId}
                    onChange={(e) => setSelectedClassId(e.target.value)}
                    className="w-full md:w-1/2 h-10 rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="">-- Selecionar Turma --</option>
                    {localClasses.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.students?.length || 0} Alunos)
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Student Data Table Preview */}
              <div className="space-y-3 pt-4 border-t">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-bold flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    Lista de Alunos Selecionados ({activeStudentsForPdf.length} de {filteredStudents.length})
                  </Label>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleToggleAllStudents(selectedStudentIds.size < filteredStudents.length)}
                      className="text-xs"
                    >
                      {selectedStudentIds.size === filteredStudents.length ? 'Desmarcar Todos' : 'Marcar Todos'}
                    </Button>
                  </div>
                </div>

                <div className="border rounded-lg overflow-hidden max-h-64 overflow-y-auto text-xs">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-muted sticky top-0 font-semibold border-b">
                      <tr>
                        <th className="p-2.5 w-10 text-center">
                          <Checkbox
                            checked={selectedStudentIds.size > 0 && selectedStudentIds.size === filteredStudents.length}
                            onCheckedChange={(val) => handleToggleAllStudents(!!val)}
                          />
                        </th>
                        <th className="p-2.5">Colocação</th>
                        <th className="p-2.5">Nome do Aluno</th>
                        <th className="p-2.5">Turma</th>
                        <th className="p-2.5">% Português / Mat.</th>
                        <th className="p-2.5">
                          <div className="flex items-center gap-1.5">
                            <span>Nível Leitura</span>
                            <select
                              value={readingLevelFilter}
                              onChange={(e) => setReadingLevelFilter(e.target.value)}
                              className="h-6 text-[11px] font-normal border border-amber-300 rounded bg-white text-slate-800 px-1 focus:outline-none focus:ring-1 focus:ring-amber-500 cursor-pointer"
                            >
                              <option value="all">Todos os Níveis</option>
                              {availableReadingLevels.map((lvl) => (
                                <option key={lvl} value={lvl}>{lvl}</option>
                              ))}
                            </select>
                          </div>
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {filteredStudents.length > 0 ? (
                        filteredStudents.map((st) => (
                          <tr key={st.id} className="hover:bg-muted/50 transition-colors">
                            <td className="p-2.5 text-center">
                              <Checkbox
                                checked={selectedStudentIds.has(st.id)}
                                onCheckedChange={() => handleToggleStudent(st.id)}
                              />
                            </td>
                            <td className="p-2.5 font-bold text-amber-700">
                              {st.colocacao || '-'}
                            </td>
                            <td className="p-2.5 font-semibold text-slate-800">{st.nome_aluno}</td>
                            <td className="p-2.5 text-slate-600">{st.turma}</td>
                            <td className="p-2.5 text-slate-700 font-medium">
                              {st.nota_portugues !== '-' && st.nota_matematica !== '-'
                                ? `Port: ${st.nota_portugues} | Mat: ${st.nota_matematica}`
                                : st.nota_portugues !== '-'
                                  ? `Port: ${st.nota_portugues}`
                                  : st.nota_matematica !== '-'
                                    ? `Mat: ${st.nota_matematica}`
                                    : (st.rawScore ? `${st.rawScore}%` : '-')}
                            </td>
                            <td className="p-2.5 text-slate-600">{st.nivel_leitura || '-'}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={6} className="p-6 text-center text-muted-foreground">
                            Nenhum aluno encontrado para os filtros atuais. Busque no SAEV ou selecione uma turma acima.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="flex justify-between items-center pt-4 border-t">
                <Button variant="outline" onClick={() => setActiveStep('canvas')}>
                  &larr; Voltar para Caixas de Texto
                </Button>
                <Button
                  onClick={() => setActiveStep('export')}
                  disabled={activeStudentsForPdf.length === 0}
                  className="gap-2 bg-amber-600 hover:bg-amber-700"
                >
                  Avançar para Gerar PDF ({activeStudentsForPdf.length}) &rarr;
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* STEP 4: BATCH PDF EXPORT */}
        <TabsContent value="export" className="mt-6 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <FileDown className="w-5 h-5 text-primary" />
                Gerar e Salvar Certificados em PDF em Lote
              </CardTitle>
              <CardDescription>
                Revise os detalhes abaixo e clique para gerar o arquivo PDF completo contendo 1 certificado por página.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-center">
                  <div className="text-xs text-amber-800 font-medium">Quantidade de Certificados</div>
                  <div className="text-3xl font-extrabold text-amber-900 mt-1">{activeStudentsForPdf.length}</div>
                  <div className="text-[11px] text-amber-700 mt-1">Páginas no PDF Final</div>
                </div>

                <div className="bg-slate-50 border rounded-xl p-4 text-center">
                  <div className="text-xs text-slate-600 font-medium">Modelo Selecionado</div>
                  <div className="text-lg font-bold text-slate-800 mt-1 truncate">{template.name}</div>
                  <div className="text-[11px] text-slate-500 mt-1">Orientação {template.orientation === 'landscape' ? 'Paisagem' : 'Retrato'}</div>
                </div>

                <div className="bg-slate-50 border rounded-xl p-4 text-center">
                  <div className="text-xs text-slate-600 font-medium">Fonte dos Dados</div>
                  <div className="text-lg font-bold text-slate-800 mt-1 uppercase">{sourceType}</div>
                  <div className="text-[11px] text-slate-500 mt-1">Modo Ranking: {rankingMode}</div>
                </div>
              </div>

              {/* Progress Bar during generation */}
              {isGeneratingPdf && (
                <div className="space-y-2 bg-amber-50 border border-amber-200 p-4 rounded-xl">
                  <div className="flex justify-between text-xs font-semibold text-amber-900">
                    <span className="flex items-center gap-1.5">
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      Gerando Certificados em Lote...
                    </span>
                    <span>{pdfProgress}%</span>
                  </div>
                  <Progress value={pdfProgress} className="h-2" />
                </div>
              )}

              {/* Action Button */}
              <div className="flex flex-col items-center justify-center p-8 border-2 border-dashed rounded-xl bg-card space-y-4">
                <div className="w-16 h-16 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-600">
                  <Award className="w-8 h-8" />
                </div>

                <div className="text-center max-w-md">
                  <h3 className="font-bold text-base">Pronto para Gerar os Certificados?</h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    Será gerado um único arquivo PDF contendo {activeStudentsForPdf.length} certificados formatados e prontos para impressão.
                  </p>
                </div>

                <Button
                  size="lg"
                  onClick={handleGeneratePdf}
                  disabled={isGeneratingPdf || activeStudentsForPdf.length === 0}
                  className="gap-2 bg-amber-600 hover:bg-amber-700 px-8 text-base shadow-lg"
                >
                  <FileDown className="w-5 h-5" />
                  {isGeneratingPdf ? 'Gerando PDF...' : `Gerar ${activeStudentsForPdf.length} Certificados em PDF`}
                </Button>

                {generatedPdfPath && (
                  <div className="pt-2 flex items-center gap-3 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 px-4 py-2 rounded-lg">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Salvo em: <strong>{generatedPdfPath}</strong></span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openPath(generatedPdfPath)}
                      className="h-7 text-xs gap-1 text-emerald-800 hover:bg-emerald-100"
                    >
                      <FolderOpen className="w-3.5 h-3.5" />
                      Abrir Pasta
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
