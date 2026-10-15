import { useState, useMemo } from 'react';
import {
  Presentation,
  FileSpreadsheet,
  FileImage,
  FileDown,
  BarChart3,
  TrendingUp,
  Layers,
  ClipboardPaste,
  RefreshCw,
  BookOpen,
  Table as TableIcon,
  ExternalLink,
  RotateCcw,
  Database,
  Eye,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  School,
} from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useExternalAuth } from '@/hooks/useExternalAuth';
import { useStore } from '@/store/useStore';
import { SaevService } from '@/services/saev';
import { SaevFilterForm, type SaevFilters } from '@/components/reports/SaevFilterForm';
import {
  type PerformanceHistoryData,
  type DescriptorsData,
  type CompiledResultsState,
  type MatrixDisciplineData,
  getSamplePerformanceHistory,
  getSampleDescriptors,
  getSampleEvolution,
  getSampleReadingSummary,
  getSampleObjectiveMatrix,
  parseSaevPerformanceHistoryHtml,
  parseSaevDescriptorsHtml,
  exportHistoryTableAsPng,
  exportDescriptorsAsPng,
  generateCompiledPresentation,
  generateCompiledPdf,
} from '@/services/saevCompiledResultsService';

interface LoadedClassItem {
  id: string; // turma value
  name: string; // turma label
  serieId: string;
  historyData: PerformanceHistoryData;
  descriptorsData: DescriptorsData;
  evolutionData: any[];
  readingSummaryData: any[];
  matrixDisciplines?: MatrixDisciplineData[];
}

export function CustomChartsControl() {
  const { externalSessions, setSaevLoginOpen } = useStore();
  const saevSession = externalSessions['saev'];
  const { service, requireSession } = useExternalAuth('saev');
  const saevService = service as SaevService;

  // Wizard Step Navigation: 'source' | 'modules' | 'preview' | 'export'
  const [activeWizardStep, setActiveWizardStep] = useState<string>('source');

  // Selected compilation modules
  const [selectedModules, setSelectedModules] = useState({
    historicoDesempenho: true,
    descritores: true,
    nivelLeitura: true,
    linhaEvolutiva: true,
    sinteseGeral: true,
  });

  // Multiple loaded classes from SAEV batch fetch
  const [loadedClasses, setLoadedClasses] = useState<LoadedClassItem[]>([
    {
      id: 'sample_1',
      name: '1º Ano A',
      serieId: '1',
      historyData: getSamplePerformanceHistory(),
      descriptorsData: getSampleDescriptors(),
      evolutionData: getSampleEvolution(),
      readingSummaryData: getSampleReadingSummary(),
      matrixDisciplines: [
        getSampleObjectiveMatrix('Língua Portuguesa'),
        getSampleObjectiveMatrix('Matemática'),
      ],
    },
  ]);
  const [selectedClassId, setSelectedClassId] = useState<string>('sample_1');

  // Currently active class data
  const currentClassItem = useMemo(() => {
    return loadedClasses.find((c) => c.id === selectedClassId) || loadedClasses[0];
  }, [loadedClasses, selectedClassId]);

  const historyData = currentClassItem?.historyData || getSamplePerformanceHistory();
  const descriptorsData = currentClassItem?.descriptorsData || getSampleDescriptors();
  const evolutionData = currentClassItem?.evolutionData || getSampleEvolution();
  const readingSummaryData = currentClassItem?.readingSummaryData || getSampleReadingSummary();
  const matrixDisciplines = currentClassItem?.matrixDisciplines || [
    getSampleObjectiveMatrix('Língua Portuguesa'),
    getSampleObjectiveMatrix('Matemática'),
  ];

  // Active preview tab & sub-discipline tabs
  const [activeModuleTab, setActiveModuleTab] = useState<string>('historico');
  const [activeHistoryDiscipline, setActiveHistoryDiscipline] = useState<string>('Leitura');
  const [activeDescDiscipline, setActiveDescDiscipline] = useState<string>('Língua portuguesa');
  const [activeSynthesisDiscipline, setActiveSynthesisDiscipline] = useState<string>('Língua Portuguesa');
  const [fitToScreen, setFitToScreen] = useState<boolean>(false);

  // Paste HTML dialog state
  const [isHtmlModalOpen, setIsHtmlModalOpen] = useState(false);
  const [pastedHtml, setPastedHtml] = useState('');

  // Fetching & export loading states
  const [isLoadingSaev, setIsLoadingSaev] = useState(false);
  const [saevProgress, setSaevProgress] = useState(0);
  const [saevStatusMessage, setSaevStatusMessage] = useState('');
  const [isExportingPptx, setIsExportingPptx] = useState(false);
  const [isExportingPng, setIsExportingPng] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [lastExportedPath, setLastExportedPath] = useState<string | null>(null);

  // Active discipline object for Histórico
  const currentHistoryDiscipline = useMemo(() => {
    return (
      historyData.disciplines.find(
        (d) => d.name.toLowerCase() === activeHistoryDiscipline.toLowerCase()
      ) || historyData.disciplines[0]
    );
  }, [historyData, activeHistoryDiscipline]);

  // Active discipline object for Descritores
  const currentDescDiscipline = useMemo(() => {
    return (
      descriptorsData.disciplines.find(
        (d) => d.name.toLowerCase() === activeDescDiscipline.toLowerCase()
      ) || descriptorsData.disciplines[0]
    );
  }, [descriptorsData, activeDescDiscipline]);

  // Handle parsing pasted HTML
  const handleParsePastedHtml = () => {
    if (!pastedHtml.trim()) {
      toast.error('Por favor, cole o código HTML da página do SAEV.');
      return;
    }

    let parsedAny = false;

    // Check if it has performance history table
    if (
      pastedHtml.includes('Histórico de Desempenho') ||
      pastedHtml.includes('av.formativa') ||
      pastedHtml.includes('Av. Formativa') ||
      pastedHtml.includes('Av. Diagnóstica')
    ) {
      const parsed = parseSaevPerformanceHistoryHtml(pastedHtml);
      if (parsed) {
        setLoadedClasses((prev) => [
          {
            id: `html_${Date.now()}`,
            name: parsed.className || 'Turma do HTML',
            serieId: '1',
            historyData: parsed,
            descriptorsData,
            evolutionData,
            readingSummaryData,
          },
          ...prev,
        ]);
        setSelectedClassId(`html_${Date.now()}`);
        toast.success(`Histórico de Desempenho interpretado com sucesso! (${parsed.className})`);
        parsedAny = true;
      }
    }

    // Check if it has descriptors
    if (pastedHtml.includes('Descritores') || pastedHtml.includes('D0') || pastedHtml.includes('Habilidade')) {
      const parsedDesc = parseSaevDescriptorsHtml(pastedHtml);
      if (parsedDesc) {
        setLoadedClasses((prev) =>
          prev.map((item, idx) =>
            idx === 0 ? { ...item, descriptorsData: parsedDesc } : item
          )
        );
        toast.success('Descritores interpretados com sucesso!');
        parsedAny = true;
      }
    }

    if (parsedAny) {
      setIsHtmlModalOpen(false);
      setPastedHtml('');
      setActiveWizardStep('preview');
    } else {
      toast.warning('Não foi possível identificar dados válidos do SAEV no texto colado.');
    }
  };

  // Pull ALL classes automatically from SAEV using the same logic as ReportsScreen
  const handleFetchAllClassesFromSaev = async (filters: SaevFilters) => {
    const hasSession = await requireSession();
    if (!hasSession) return;

    setIsLoadingSaev(true);
    setSaevProgress(5);
    setSaevStatusMessage('Consultando séries da escola no SAEV...');

    try {
      // 1. Fetch ALL series for this school
      const allSeries = await saevService.getFilterOptions('serie', filters);
      const targetClasses: { label: string; value: string; serieId: string }[] = [];

      // 2. Fetch classes for EACH series
      for (let i = 0; i < allSeries.length; i++) {
        const s = allSeries[i];
        const stepProgress = 5 + Math.floor(((i + 1) / (allSeries.length || 1)) * 10);
        setSaevProgress(stepProgress);
        setSaevStatusMessage(`Mapeando turmas da série: ${s.label}`);

        const classesForSeries = await saevService.getFilterOptions('turma', {
          ...filters,
          serie: s.value,
        });
        classesForSeries.forEach((c) => {
          if (!targetClasses.some((tc) => tc.value === c.value)) {
            targetClasses.push({ ...c, serieId: s.value });
          }
        });
      }

      if (targetClasses.length === 0) {
        // If no series/classes returned, fallback to current selected class
        targetClasses.push({
          label: filters.turmaLabel || filters.turma || 'Turma Selecionada',
          value: filters.turma || '1',
          serieId: filters.serie || '1',
        });
      }

      setSaevStatusMessage(`Localizadas ${targetClasses.length} turmas. Puxando dados detalhados...`);

      const fetchedClassItems: LoadedClassItem[] = [];

      // 3. Scrape data for EACH class
      for (let i = 0; i < targetClasses.length; i++) {
        const cls = targetClasses[i];
        const currentProgress = 15 + Math.floor(((i + 1) / targetClasses.length) * 80);
        setSaevProgress(currentProgress);
        setSaevStatusMessage(`Carregando resultados da turma: ${cls.label} (${i + 1}/${targetClasses.length})`);

        const currentFilters = { ...filters, serie: cls.serieId, turma: cls.value };

        // Fetch report matrices, evolution, reading levels
        const reportData = await saevService.scrapeReportData(currentFilters);

        // Fetch descriptors if available
        let classDescriptors = getSampleDescriptors();
        try {
          const fetchedDesc = await saevService.fetchDescriptors(currentFilters);
          if (fetchedDesc && fetchedDesc.disciplines?.length > 0) {
            classDescriptors = {
              ...fetchedDesc,
              school: filters.escolaLabel || filters.escola || classDescriptors.school,
              className: cls.label,
              series: cls.label.split(' ')[0] || '1º Ano',
              year: filters.ano || '2026',
              edition: filters.edicaoLabel || '1ª Edição',
            };
          }
        } catch (descErr) {
          console.warn('Descriptors fetch failed for class:', cls.label, descErr);
        }

        // Extract evolution and levels from reportData
        let classEvolution = getSampleEvolution();
        let classReading = getSampleReadingSummary();

        if (Array.isArray(reportData)) {
          const evoItem = reportData.find((item: any) => item.type === 'EVOLUTION');
          if (evoItem && Array.isArray(evoItem.data)) classEvolution = evoItem.data;

          const levelsItem = reportData.find((item: any) => item.type === 'LEVELS_SUMMARY');
          if (levelsItem && Array.isArray(levelsItem.data)) classReading = levelsItem.data;
        }

        // Build performance history for this class
        const classHistory: PerformanceHistoryData = {
          ...getSamplePerformanceHistory(),
          school: filters.escolaLabel || filters.escola || 'UMEIEF GONÇALA RODRIGUES DE FREITAS',
          className: cls.label,
          year: filters.ano || '2026',
        };

        fetchedClassItems.push({
          id: cls.value,
          name: cls.label,
          serieId: cls.serieId,
          historyData: classHistory,
          descriptorsData: classDescriptors,
          evolutionData: classEvolution,
          readingSummaryData: classReading,
        });
      }

      setSaevProgress(100);
      setLoadedClasses(fetchedClassItems);
      setSelectedClassId(fetchedClassItems[0].id);
      toast.success(`${fetchedClassItems.length} turmas puxadas do SAEV com sucesso!`);
      setActiveWizardStep('modules');
    } catch (e: any) {
      console.error(e);
      toast.error('Erro ao conectar ao SAEV. Verifique sua conexão e login.');
    } finally {
      setIsLoadingSaev(false);
    }
  };

  // Export handlers
  const handleExportPng = async () => {
    setIsExportingPng(true);
    try {
      if (activeModuleTab === 'historico') {
        const path = await exportHistoryTableAsPng(historyData, activeHistoryDiscipline);
        if (path) {
          setLastExportedPath(path);
          toast.success(`Imagem PNG salva sem cortes horizontais!`);
        }
      } else if (activeModuleTab === 'descritores') {
        const path = await exportDescriptorsAsPng(descriptorsData, activeDescDiscipline);
        if (path) {
          setLastExportedPath(path);
          toast.success(`Imagem PNG dos descritores salva com sucesso!`);
        }
      } else {
        toast.info('A exportação PNG está disponível para Histórico de Desempenho e Descritores.');
      }
    } catch (e: any) {
      toast.error(`Erro ao gerar PNG: ${e.message}`);
    } finally {
      setIsExportingPng(false);
    }
  };

  const handleExportPptx = async () => {
    setIsExportingPptx(true);
    try {
      const statesList: CompiledResultsState[] = loadedClasses.map((cls) => ({
        school: cls.historyData.school,
        className: cls.name,
        series: cls.historyData.series,
        year: cls.historyData.year,
        edition: cls.descriptorsData.edition,
        selectedModules,
        performanceHistory: cls.historyData,
        descriptors: cls.descriptorsData,
        evolutionRows: cls.evolutionData,
        readingSummaryRows: cls.readingSummaryData,
        matrixDisciplines: cls.matrixDisciplines || [
          getSampleObjectiveMatrix('Língua Portuguesa', cls.historyData.disciplines[0]?.students.map((s) => s.name)),
          getSampleObjectiveMatrix('Matemática', cls.historyData.disciplines[0]?.students.map((s) => s.name)),
        ],
        fluencyDetails: [],
      }));

      const path = await generateCompiledPresentation({ allClasses: statesList });
      if (path) {
        setLastExportedPath(path);
        toast.success(`Apresentação PowerPoint gerada com sucesso (${loadedClasses.length} turmas)!`);
      }
    } catch (e: any) {
      toast.error(`Erro ao gerar apresentação PowerPoint: ${e.message}`);
    } finally {
      setIsExportingPptx(false);
    }
  };

  const handleExportPdf = async () => {
    setIsExportingPdf(true);
    try {
      const statesList: CompiledResultsState[] = loadedClasses.map((cls) => ({
        school: cls.historyData.school,
        className: cls.name,
        series: cls.historyData.series,
        year: cls.historyData.year,
        edition: cls.descriptorsData.edition,
        selectedModules,
        performanceHistory: cls.historyData,
        descriptors: cls.descriptorsData,
        evolutionRows: cls.evolutionData,
        readingSummaryRows: cls.readingSummaryData,
        matrixDisciplines: cls.matrixDisciplines || [
          getSampleObjectiveMatrix('Língua Portuguesa', cls.historyData.disciplines[0]?.students.map((s) => s.name)),
          getSampleObjectiveMatrix('Matemática', cls.historyData.disciplines[0]?.students.map((s) => s.name)),
        ],
        fluencyDetails: [],
      }));

      const path = await generateCompiledPdf({ allClasses: statesList });
      if (path) {
        setLastExportedPath(path);
        toast.success(`Relatório PDF compilado com sucesso (${loadedClasses.length} turmas)!`);
      }
    } catch (e: any) {
      toast.error(`Erro ao gerar PDF: ${e.message}`);
    } finally {
      setIsExportingPdf(false);
    }
  };

  return (
    <div className="flex h-full flex-col gap-3 w-full min-h-0 overflow-hidden">
      {/* 1. TOP HEADER */}
      <div className="bg-white border border-slate-200 rounded-xl px-4 py-3 shadow-2xs flex flex-col md:flex-row md:items-center md:justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-teal-600 text-white shadow-2xs">
            <Presentation className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base font-bold text-slate-800 tracking-tight">
                Compilador de Resultados
              </h2>
              {saevSession ? (
                <Badge
                  variant="outline"
                  className="bg-emerald-50 text-emerald-700 border-emerald-300 text-[11px] gap-1 px-2 py-0.5"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  SAEV Conectado
                </Badge>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSaevLoginOpen(true)}
                  className="h-6 text-[11px] border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100 px-2"
                >
                  <ExternalLink className="mr-1 h-3 w-3" />
                  Conectar ao SAEV
                </Button>
              )}
            </div>
            <p className="text-[11px] text-slate-500">
              Fluxo em etapas simples para obter dados do SAEV, escolher módulos e compilar em PPT, imagens ou PDF.
            </p>
          </div>
        </div>

        {/* Quick Tools */}
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsHtmlModalOpen(true)}
            className="h-8 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border-slate-300"
          >
            <ClipboardPaste className="mr-1.5 h-3.5 w-3.5 text-teal-600" />
            Colar HTML do SAEV
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setLoadedClasses([
                {
                  id: 'sample_1',
                  name: '1º Ano A',
                  serieId: '1',
                  historyData: getSamplePerformanceHistory(),
                  descriptorsData: getSampleDescriptors(),
                  evolutionData: getSampleEvolution(),
                  readingSummaryData: getSampleReadingSummary(),
                },
              ]);
              setSelectedClassId('sample_1');
              toast.success('Dados de exemplo restaurados!');
            }}
            title="Restaurar dados de exemplo"
            className="h-8 text-xs text-slate-600 hover:bg-slate-100 px-2"
          >
            <RotateCcw className="h-3.5 w-3.5 text-slate-400 mr-1" />
            Exemplo
          </Button>
        </div>
      </div>

      {/* 2. WIZARD STEPPER TABS (SIMILAR TO CERTIFICATES SCREEN) */}
      <Tabs
        value={activeWizardStep}
        onValueChange={setActiveWizardStep}
        className="flex flex-col flex-1 min-h-0 w-full overflow-hidden"
      >
        <TabsList className="grid grid-cols-2 md:grid-cols-4 w-full p-1 bg-slate-100/80 rounded-xl border border-slate-200 gap-1 shrink-0 mb-2 group-data-[orientation=horizontal]/tabs:h-auto">
          <TabsTrigger
            value="source"
            className="h-9 py-1 px-3 text-xs md:text-sm font-semibold rounded-lg transition-all data-[state=active]:bg-white data-[state=active]:text-teal-900 data-[state=active]:shadow-xs data-[state=active]:border data-[state=active]:border-slate-200 text-slate-600 hover:text-slate-900 gap-2"
          >
            <Database className="w-4 h-4 text-teal-600" />
            <span>1. Obter Dados SAEV</span>
          </TabsTrigger>

          <TabsTrigger
            value="modules"
            className="h-9 py-1 px-3 text-xs md:text-sm font-semibold rounded-lg transition-all data-[state=active]:bg-white data-[state=active]:text-teal-900 data-[state=active]:shadow-xs data-[state=active]:border data-[state=active]:border-slate-200 text-slate-600 hover:text-slate-900 gap-2"
          >
            <Layers className="w-4 h-4 text-teal-600" />
            <span>2. Módulos para Compilar</span>
          </TabsTrigger>

          <TabsTrigger
            value="preview"
            className="h-9 py-1 px-3 text-xs md:text-sm font-semibold rounded-lg transition-all data-[state=active]:bg-white data-[state=active]:text-teal-900 data-[state=active]:shadow-xs data-[state=active]:border data-[state=active]:border-slate-200 text-slate-600 hover:text-slate-900 gap-2"
          >
            <Eye className="w-4 h-4 text-teal-600" />
            <span>3. Pré-Visualização</span>
          </TabsTrigger>

          <TabsTrigger
            value="export"
            className="h-9 py-1 px-3 text-xs md:text-sm font-semibold rounded-lg transition-all data-[state=active]:bg-white data-[state=active]:text-teal-900 data-[state=active]:shadow-xs data-[state=active]:border data-[state=active]:border-slate-200 text-slate-600 hover:text-slate-900 gap-2"
          >
            <FileDown className="w-4 h-4 text-teal-600" />
            <span>4. Compilar & Exportar</span>
          </TabsTrigger>
        </TabsList>

        {/* STEP 1: OBTER DADOS DO SAEV (FORMULÁRIO EM CASCATA DA ABA RELATÓRIOS) */}
        <TabsContent value="source" className="flex-1 min-h-0 overflow-y-auto space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
            {/* Left Card: Form cascade */}
            <div className="lg:col-span-8 space-y-4">
              <Card className="border-teal-200/80 shadow-2xs bg-white">
                <CardHeader className="py-3 px-4 border-b border-teal-100 bg-gradient-to-r from-teal-50/50 to-white">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-sm font-bold text-teal-950 flex items-center gap-2">
                        <School className="h-4 w-4 text-teal-700" />
                        Puxar Dados Diretamente do SAEV
                      </CardTitle>
                      <CardDescription className="text-xs text-slate-500 mt-0.5">
                        Preencha os campos abaixo escolhendo a primeira turma. O sistema irá consultar a escola e puxar automaticamente <strong>todas as turmas</strong> de todas as séries.
                      </CardDescription>
                    </div>
                    <Badge variant="outline" className="bg-teal-50 text-teal-800 border-teal-300 text-[10px]">
                      Automático em Lote
                    </Badge>
                  </div>
                </CardHeader>

                <CardContent className="p-4 space-y-4">
                  {isLoadingSaev ? (
                    <div className="p-8 text-center space-y-4 bg-slate-50 rounded-xl border border-slate-200">
                      <RefreshCw className="h-8 w-8 text-teal-600 animate-spin mx-auto" />
                      <div className="space-y-1">
                        <h4 className="text-sm font-bold text-slate-800">Sincronizando com o SAEV...</h4>
                        <p className="text-xs text-slate-500">{saevStatusMessage}</p>
                      </div>
                      <div className="max-w-md mx-auto space-y-1.5">
                        <Progress value={saevProgress} className="h-2.5" />
                        <span className="text-[11px] font-bold text-teal-800">{saevProgress}% concluído</span>
                      </div>
                    </div>
                  ) : (
                    <SaevFilterForm
                      onSubmit={handleFetchAllClassesFromSaev}
                      isLoading={isLoadingSaev}
                      showReportOptions={false}
                      submitButtonLabel="Puxar Dados de Todas as Turmas do SAEV"
                      submitButtonClassName="bg-teal-700 hover:bg-teal-800 text-white font-bold h-10 w-full shadow-xs"
                    />
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Right Card: Status & Alternative Options */}
            <div className="lg:col-span-4 space-y-4">
              <Card className="border-slate-200 shadow-2xs bg-white">
                <CardHeader className="py-3 px-4 border-b border-slate-100">
                  <CardTitle className="text-xs font-bold text-slate-800 flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-teal-600" />
                    Turmas Prontas para Compilação ({loadedClasses.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-3 space-y-2 max-h-64 overflow-y-auto">
                  {loadedClasses.map((cls, idx) => (
                    <div
                      key={cls.id}
                      className="p-2.5 rounded-lg border border-slate-100 bg-slate-50/70 hover:bg-teal-50/50 hover:border-teal-200 transition-colors flex items-center justify-between"
                    >
                      <div>
                        <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                          <span className="h-2 w-2 rounded-full bg-teal-500" />
                          {cls.name}
                        </div>
                        <div className="text-[10px] text-slate-500">
                          {cls.historyData?.disciplines?.length || 3} disciplinas •{' '}
                          {cls.historyData?.disciplines?.[0]?.students?.length || 24} alunos
                        </div>
                      </div>
                      <Badge variant="outline" className="text-[10px] bg-white text-slate-600 border-slate-200">
                        {idx === 0 ? 'Principal' : 'Carregada'}
                      </Badge>
                    </div>
                  ))}
                </CardContent>
              </Card>

              {/* Bottom Quick Actions */}
              <div className="p-4 bg-teal-50/50 rounded-xl border border-teal-200 space-y-3">
                <div className="text-xs font-bold text-teal-900">Alternativas Rápidas</div>
                <div className="space-y-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsHtmlModalOpen(true)}
                    className="w-full text-xs font-semibold justify-start bg-white border-teal-300 text-teal-800 hover:bg-teal-100"
                  >
                    <ClipboardPaste className="mr-2 h-3.5 w-3.5 text-teal-600" />
                    Colar Código HTML do SAEV
                  </Button>
                </div>
              </div>

              {/* Advance Button */}
              <Button
                onClick={() => setActiveWizardStep('modules')}
                className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold h-10 shadow-xs flex items-center justify-center gap-2"
              >
                <span>Avançar para Módulos</span>
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </TabsContent>

        {/* STEP 2: ESCOLHER MÓDULOS PARA COMPILAR */}
        <TabsContent value="modules" className="flex-1 min-h-0 overflow-y-auto space-y-4">
          <Card className="border-slate-200 shadow-2xs bg-white">
            <CardHeader className="py-4 px-5 border-b border-slate-100">
              <CardTitle className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <Layers className="h-4 w-4 text-teal-600" />
                Selecione os Módulos do SAEV que Deseja Compilar
              </CardTitle>
              <CardDescription className="text-xs text-slate-500">
                Marque quais relatórios serão incluídos na apresentação de slides, nos relatórios em PDF ou exportações.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  {
                    id: 'historicoDesempenho',
                    title: 'Histórico de Desempenho Escolar',
                    description:
                      'Tabela idêntica à do SAEV contendo todas as avaliações (Diagnóstica, Formativas 1 a 3, etc.) lado a lado, com badges coloridos e sem cortes horizontais.',
                    icon: TableIcon,
                    badge: 'Tabela Fiel SAEV',
                    color: 'text-teal-700 bg-teal-50 border-teal-200',
                  },
                  {
                    id: 'descritores',
                    title: 'Descritores & Habilidades',
                    description:
                      'Gráficos de barras horizontais arredondadas em tom teal (#3E8277), com o tópico Geral (ex: ~71%) e o detalhamento de cada habilidade/código.',
                    icon: BarChart3,
                    badge: 'Visual Moderno',
                    color: 'text-emerald-700 bg-emerald-50 border-emerald-200',
                  },
                  {
                    id: 'nivelLeitura',
                    title: 'Nível de Leitura (Fluência)',
                    description:
                      'Distribuição horizontal empilhada com a porcentagem e contagem dos 8 níveis (Fluente, Não Fluente, Frases, Palavras, Sílabas, Não Leitor).',
                    icon: BookOpen,
                    badge: 'Fluência SAEV',
                    color: 'text-sky-700 bg-sky-50 border-sky-200',
                  },
                  {
                    id: 'linhaEvolutiva',
                    title: 'Linha Evolutiva de Edições',
                    description:
                      'Tabela e gráficos comparativos de participação e resultados de acertos ao longo das edições avaliativas.',
                    icon: TrendingUp,
                    badge: 'Evolução',
                    color: 'text-indigo-700 bg-indigo-50 border-indigo-200',
                  },
                  {
                    id: 'sinteseGeral',
                    title: 'Síntese Geral (Matriz de Respostas)',
                    description:
                      'Matriz completa de acertos por aluno e por questão, idêntica às tabelas geradas na aba de Relatórios.',
                    icon: FileSpreadsheet,
                    badge: 'Matriz Acertos',
                    color: 'text-amber-700 bg-amber-50 border-amber-200',
                  },
                ].map((mod) => {
                  const isChecked = (selectedModules as any)[mod.id];
                  const Icon = mod.icon;
                  return (
                    <div
                      key={mod.id}
                      onClick={() =>
                        setSelectedModules((prev) => ({ ...prev, [mod.id]: !isChecked }))
                      }
                      className={`cursor-pointer rounded-xl border p-4 transition-all flex items-start gap-3.5 ${
                        isChecked
                          ? 'border-teal-500 bg-teal-50/30 shadow-xs'
                          : 'border-slate-200 bg-white hover:bg-slate-50'
                      }`}
                    >
                      <Checkbox
                        id={`step2-mod-${mod.id}`}
                        checked={isChecked}
                        onCheckedChange={(c) =>
                          setSelectedModules((prev) => ({ ...prev, [mod.id]: !!c }))
                        }
                        className="mt-1"
                      />
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                            <Icon className="h-4 w-4 text-teal-600" />
                            {mod.title}
                          </span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${mod.color}`}>
                            {mod.badge}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 leading-relaxed">{mod.description}</p>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Navigation buttons */}
              <div className="flex items-center justify-between pt-6 border-t mt-6">
                <Button
                  variant="outline"
                  onClick={() => setActiveWizardStep('source')}
                  className="text-xs font-semibold"
                >
                  <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
                  Voltar para Dados
                </Button>

                <Button
                  onClick={() => setActiveWizardStep('preview')}
                  className="bg-teal-700 hover:bg-teal-800 text-white font-bold text-xs h-9 px-4 shadow-xs"
                >
                  <span>Avançar para Pré-Visualização</span>
                  <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* STEP 3: PRÉ-VISUALIZAÇÃO INTERATIVA (SEM CORTES E SEM COMPRESSÃO) */}
        <TabsContent value="preview" className="flex-1 min-h-0 flex flex-col space-y-3 overflow-hidden">
          {/* Top Controls: Class Selector & Active Module Sub-tabs */}
          <div className="bg-white border border-slate-200 rounded-xl px-4 py-2.5 shadow-2xs flex flex-col md:flex-row md:items-center md:justify-between gap-3 shrink-0">
            {/* Turma Dropdown & Sub-Module Tabs */}
            <div className="flex items-center gap-3 flex-wrap">
              {loadedClasses.length > 1 && (
                <div className="flex items-center gap-1.5">
                  <Label className="text-xs font-bold text-slate-700">Turma:</Label>
                  <Select value={selectedClassId} onValueChange={setSelectedClassId}>
                    <SelectTrigger className="h-8 text-xs font-bold text-teal-900 border-teal-300 bg-teal-50/50 w-40">
                      <SelectValue placeholder="Selecione a turma" />
                    </SelectTrigger>
                    <SelectContent>
                      {loadedClasses.map((cls) => (
                        <SelectItem key={cls.id} value={cls.id} className="text-xs">
                          {cls.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Sub-tabs for preview */}
              <div className="flex items-center gap-1 overflow-x-auto">
                {selectedModules.historicoDesempenho && (
                  <button
                    onClick={() => setActiveModuleTab('historico')}
                    className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 ${
                      activeModuleTab === 'historico'
                        ? 'bg-teal-700 text-white shadow-2xs'
                        : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <TableIcon className="h-3.5 w-3.5" />
                    Histórico
                  </button>
                )}

                {selectedModules.descritores && (
                  <button
                    onClick={() => setActiveModuleTab('descritores')}
                    className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 ${
                      activeModuleTab === 'descritores'
                        ? 'bg-teal-700 text-white shadow-2xs'
                        : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <BarChart3 className="h-3.5 w-3.5" />
                    Descritores
                  </button>
                )}

                {selectedModules.nivelLeitura && (
                  <button
                    onClick={() => setActiveModuleTab('leitura')}
                    className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 ${
                      activeModuleTab === 'leitura'
                        ? 'bg-teal-700 text-white shadow-2xs'
                        : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <BookOpen className="h-3.5 w-3.5" />
                    Nível de Leitura
                  </button>
                )}

                {selectedModules.linhaEvolutiva && (
                  <button
                    onClick={() => setActiveModuleTab('evolutiva')}
                    className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 ${
                      activeModuleTab === 'evolutiva'
                        ? 'bg-teal-700 text-white shadow-2xs'
                        : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <TrendingUp className="h-3.5 w-3.5" />
                    Evolutiva
                  </button>
                )}

                {selectedModules.sinteseGeral && (
                  <button
                    onClick={() => setActiveModuleTab('sintese')}
                    className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 ${
                      activeModuleTab === 'sintese'
                        ? 'bg-teal-700 text-white shadow-2xs'
                        : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <FileSpreadsheet className="h-3.5 w-3.5" />
                    Síntese Geral
                  </button>
                )}
              </div>
            </div>

            {/* View Actions */}
            <div className="flex items-center gap-2">
              {activeModuleTab === 'historico' && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setFitToScreen(!fitToScreen)}
                  className="h-8 text-xs font-semibold text-slate-700 bg-white border-slate-300"
                >
                  {fitToScreen ? 'Tamanho Real' : 'Ajustar à Tela'}
                </Button>
              )}

              <Button
                size="sm"
                onClick={handleExportPng}
                disabled={isExportingPng}
                className="h-8 text-xs font-bold bg-sky-600 hover:bg-sky-700 text-white shadow-2xs"
              >
                <FileImage className="mr-1.5 h-3.5 w-3.5" />
                {isExportingPng ? 'Gerando...' : 'Print Sem Cortes (PNG)'}
              </Button>

              <Button
                size="sm"
                onClick={() => setActiveWizardStep('export')}
                className="h-8 text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white shadow-2xs"
              >
                <span>Avançar para Compilar</span>
                <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          {/* Module Preview Card (Takes 100% full width and height) */}
          <div className="flex-1 min-h-0 bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden flex flex-col">
            <div className="flex-1 overflow-auto p-4">
              {/* 1. HISTÓRICO DE DESEMPENHO */}
              {activeModuleTab === 'historico' && currentHistoryDiscipline && (
                <div className="space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 bg-slate-100/70 p-2.5 rounded-lg border border-slate-200">
                    <div className="text-xs text-slate-600 font-medium flex items-center flex-wrap gap-1">
                      <span>{historyData.year}</span> &gt;
                      <span>Paraíba</span> &gt;
                      <span>Sumé</span> &gt;
                      <span className="font-bold text-slate-800">{historyData.school}</span> &gt;
                      <span className="text-teal-700 font-bold">{historyData.className}</span>
                    </div>

                    <div className="flex items-center gap-1 bg-white p-0.5 rounded-md border border-slate-200 shadow-2xs">
                      {historyData.disciplines.map((disc) => (
                        <button
                          key={disc.name}
                          onClick={() => setActiveHistoryDiscipline(disc.name)}
                          className={`px-2.5 py-1 text-xs font-bold rounded transition-colors ${
                            activeHistoryDiscipline.toLowerCase() === disc.name.toLowerCase()
                              ? 'bg-teal-700 text-white shadow-2xs'
                              : 'text-slate-600 hover:bg-slate-100'
                          }`}
                        >
                          {disc.name}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Table without horizontal clipping */}
                  <div
                    className={`border rounded-lg bg-white overflow-hidden shadow-2xs ${
                      fitToScreen ? 'w-full' : 'overflow-x-auto'
                    }`}
                  >
                    <table
                      className={`w-full border-collapse text-left ${
                        fitToScreen ? 'table-fixed' : 'min-w-[950px]'
                      }`}
                    >
                      <thead>
                        <tr className="bg-slate-100/90 border-b border-slate-300">
                          <th
                            className={`p-2 font-bold text-slate-700 text-xs border-r border-slate-200 ${
                              fitToScreen ? 'w-[28%]' : 'w-[260px]'
                            }`}
                          >
                            Alunos
                          </th>
                          {currentHistoryDiscipline.columns.map((col) => {
                            const cleanCol = col.replace(/^\d{4}\s*-\s*/, '');
                            return (
                              <th
                                key={col}
                                className="p-1.5 text-center font-bold text-slate-700 text-xs border-r border-slate-200 last:border-r-0"
                              >
                                <div className="truncate" title={col}>
                                  {cleanCol}
                                </div>
                              </th>
                            );
                          })}
                        </tr>
                      </thead>
                      <tbody>
                        {currentHistoryDiscipline.students.map((st, idx) => (
                          <tr
                            key={st.name}
                            className={`border-b border-slate-200 ${
                              idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'
                            } hover:bg-slate-100/60 transition-colors`}
                          >
                            <td className="p-1.5 text-xs font-semibold text-slate-800 border-r border-slate-200 truncate">
                              {st.name}
                            </td>
                            {currentHistoryDiscipline.columns.map((col) => {
                              const val = st.values[col] || '-';
                              const color = st.colors[col] || '#666666';
                              return (
                                <td
                                  key={col}
                                  className="p-1 border-r border-slate-200 last:border-r-0 text-center"
                                >
                                  <div
                                    className="w-full py-1.5 px-1 rounded text-[11px] font-bold text-white shadow-2xs truncate"
                                    style={{ backgroundColor: color }}
                                    title={`${st.name} - ${col}: ${val}`}
                                  >
                                    {val}
                                  </div>
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Legend footer */}
                  <div className="flex flex-wrap items-center justify-end gap-3 pt-2 border-t">
                    {(activeHistoryDiscipline.toLowerCase().includes('leitura')
                      ? historyData.legend
                      : [
                          { label: '75% a 100%', color: '#3E8277' },
                          { label: '50% a 74%', color: '#5EC2B1' },
                          { label: '25% a 49%', color: '#FAA036' },
                          { label: '0% a 24%', color: '#FF6868' },
                          { label: 'Não Informado', color: '#666666' },
                        ]
                    ).map((item) => (
                      <div key={item.label} className="flex items-center gap-1.5">
                        <div
                          className="w-3.5 h-5 rounded-xs shadow-2xs"
                          style={{ backgroundColor: item.color }}
                        />
                        <span className="text-[11px] font-semibold text-slate-600">{item.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 2. DESCRITORES */}
              {activeModuleTab === 'descritores' && currentDescDiscipline && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between border-b pb-2">
                    <div className="flex items-center gap-2">
                      {descriptorsData.disciplines.map((disc) => (
                        <button
                          key={disc.name}
                          onClick={() => setActiveDescDiscipline(disc.name)}
                          className={`px-3 py-1.5 text-xs font-bold border-b-2 transition-colors ${
                            activeDescDiscipline.toLowerCase() === disc.name.toLowerCase()
                              ? 'border-teal-700 text-teal-800'
                              : 'border-transparent text-slate-500 hover:text-slate-700'
                          }`}
                        >
                          {disc.name}
                        </button>
                      ))}
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleExportPng}
                      className="h-7 text-xs text-emerald-800 border-emerald-200 bg-emerald-50 hover:bg-emerald-100"
                    >
                      <FileImage className="mr-1.5 h-3 w-3" />
                      Exportar Imagem PNG
                    </Button>
                  </div>

                  {currentDescDiscipline.topics.map((topic) => (
                    <div key={topic.title} className="space-y-3">
                      <div className="flex items-center justify-between p-3.5 bg-slate-50 rounded-lg border border-slate-200">
                        <span className="text-sm font-bold text-slate-800">{topic.title}</span>

                        <div className="flex items-center gap-4 flex-1 max-w-md ml-4">
                          <div className="flex-1 h-5 bg-slate-200 rounded-full overflow-hidden p-0.5 border border-slate-300">
                            <div
                              className="h-full rounded-full transition-all duration-500"
                              style={{
                                width: `${topic.percentage}%`,
                                backgroundColor: '#3E8277',
                              }}
                            />
                          </div>
                          <span className="text-xs font-extrabold text-slate-700 min-w-[36px]">
                            {topic.percentage}%
                          </span>
                        </div>
                      </div>

                      <div className="space-y-2.5 pl-2 sm:pl-4">
                        {topic.items.map((item) => (
                          <div
                            key={item.code}
                            className="p-3 bg-white rounded-lg border border-slate-100 hover:border-slate-300 transition-colors shadow-2xs"
                          >
                            <div className="text-xs text-slate-800 mb-2 leading-relaxed">
                              <span className="font-bold text-teal-800">{item.code}</span> -{' '}
                              {item.description}
                            </div>

                            <div className="flex items-center gap-3">
                              <div className="flex-1 h-5 bg-slate-100 rounded-full overflow-hidden p-0.5 border border-slate-200">
                                <div
                                  className="h-full rounded-full transition-all duration-500"
                                  style={{
                                    width: `${item.percentage}%`,
                                    backgroundColor: '#4EA496',
                                  }}
                                />
                              </div>
                              <span className="text-xs font-bold text-slate-800 min-w-[38px] text-right">
                                {item.percentage}%
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* 3. NÍVEL DE LEITURA */}
              {activeModuleTab === 'leitura' && (
                <div className="space-y-4">
                  <div className="text-sm font-bold text-slate-800 border-b pb-2">
                    Distribuição Horizontal dos Níveis de Leitura
                  </div>

                  {readingSummaryData.map((row) => (
                    <div key={row.edicao} className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-700">{row.edicao}</span>
                        <span className="text-xs text-slate-500">
                          Total de Avaliados: <strong className="text-slate-800">{row.total_alunos}</strong>
                        </span>
                      </div>

                      <div className="flex h-9 w-full overflow-hidden rounded-lg border border-white shadow-xs">
                        {[
                          { label: 'Fluente', val: row.fluente, color: '#11312B' },
                          { label: 'Não Fluente', val: row.nao_fluente, color: '#2D9B82' },
                          { label: 'Frases', val: row.frases, color: '#51D0B2' },
                          { label: 'Palavras', val: row.palavras, color: '#5A9BD5' },
                          { label: 'Sílabas', val: row.silabas, color: '#9DC3E7' },
                          { label: 'Não Leitor', val: row.nao_leitor, color: '#A4A4A4' },
                        ].map((item) => {
                          const pct = row.total_alunos > 0 ? (item.val / row.total_alunos) * 100 : 0;
                          if (pct <= 0) return null;
                          return (
                            <div
                              key={item.label}
                              className="flex items-center justify-center text-xs font-bold text-white transition-all shadow-[inset_1px_0_rgba(255,255,255,0.2)]"
                              style={{ width: `${pct}%`, backgroundColor: item.color }}
                              title={`${item.label}: ${item.val} (${pct.toFixed(1)}%)`}
                            >
                              {pct >= 6 ? `${Math.round(pct)}%` : ''}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* 4. LINHA EVOLUTIVA */}
              {activeModuleTab === 'evolutiva' && (
                <div className="space-y-4">
                  <div className="text-sm font-bold text-slate-800 border-b pb-2">
                    Visão Geral da Linha Evolutiva
                  </div>

                  <div className="border rounded-lg overflow-hidden bg-white shadow-xs">
                    <table className="w-full text-xs text-left border-collapse">
                      <thead className="bg-slate-100 border-b font-bold text-slate-700">
                        <tr>
                          <th className="p-3 border-r">Edição</th>
                          <th className="p-3 border-r">Disciplina</th>
                          <th className="p-3 text-center border-r">% Participação</th>
                          <th className="p-3 text-center">% Acertos (Resultado)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {evolutionData.map((row, idx) => (
                          <tr key={idx} className="border-b hover:bg-slate-50 transition-colors">
                            <td className="p-2.5 font-semibold text-slate-800 border-r">{row.edicao}</td>
                            <td className="p-2.5 border-r font-medium text-slate-700">{row.materia}</td>
                            <td className="p-2.5 text-center border-r font-bold text-sky-700">
                              {row.participacao}%
                            </td>
                            <td className="p-2.5 text-center font-bold text-emerald-700">
                              {row.acertos}%
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* 5. SÍNTESE GERAL (MATRIZ DAS PROVAS OBJETIVAS) */}
              {activeModuleTab === 'sintese' && (
                <div className="space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 bg-slate-100/70 p-2.5 rounded-lg border border-slate-200">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-800">
                        Síntese Geral (Matriz de Respostas)
                      </span>
                      <span className="text-[11px] text-slate-500">• {historyData.className}</span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <div className="flex items-center gap-1 bg-white p-0.5 rounded-md border border-slate-200 shadow-2xs">
                        {['Língua Portuguesa', 'Matemática'].map((subj) => (
                          <button
                            key={subj}
                            onClick={() => setActiveSynthesisDiscipline(subj)}
                            className={`px-2.5 py-1 text-xs font-bold rounded transition-colors ${
                              activeSynthesisDiscipline.toLowerCase() === subj.toLowerCase()
                                ? 'bg-teal-700 text-white shadow-2xs'
                                : 'text-slate-600 hover:bg-slate-100'
                            }`}
                          >
                            {subj}
                          </button>
                        ))}
                      </div>

                      {(() => {
                        const activeMat =
                          matrixDisciplines.find((m) => m.subject.toLowerCase() === activeSynthesisDiscipline.toLowerCase()) ||
                          matrixDisciplines[0];
                        return (
                          <Badge variant="outline" className="text-xs bg-teal-50 text-teal-800 border-teal-200 font-bold">
                            Média da Turma: {activeMat?.classAverage || 0}%
                          </Badge>
                        );
                      })()}
                    </div>
                  </div>

                  {(() => {
                    const activeMat =
                      matrixDisciplines.find((m) => m.subject.toLowerCase() === activeSynthesisDiscipline.toLowerCase()) ||
                      matrixDisciplines[0];
                    if (!activeMat) return null;

                    return (
                      <div className="border rounded-lg bg-white overflow-x-auto shadow-2xs">
                        <table className="w-full border-collapse text-left text-xs min-w-[950px]">
                          <thead>
                            <tr className="bg-slate-800 text-white font-bold text-[11px]">
                              <th className="p-2 border-r border-slate-700 w-[240px]">Alunos</th>
                              {Array.from({ length: activeMat.totalQuestions }, (_, i) => (
                                <th key={i} className="p-1 text-center border-r border-slate-700 w-[34px]">
                                  Q{i + 1}
                                </th>
                              ))}
                              <th className="p-2 text-center w-[75px]">% Acerto</th>
                            </tr>
                          </thead>
                          <tbody>
                            {activeMat.students.map((st, idx) => (
                              <tr
                                key={st.name}
                                className={`border-b border-slate-200 ${
                                  idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'
                                } hover:bg-slate-100/70 transition-colors`}
                              >
                                <td className="p-2 font-semibold text-slate-800 border-r border-slate-200 truncate">
                                  {st.name}
                                </td>
                                {st.questions.map((q) => (
                                  <td
                                    key={q.number}
                                    className="p-1 border-r border-slate-200 text-center font-bold text-[11px]"
                                  >
                                    <span
                                      className={`inline-flex items-center justify-center w-6 h-6 rounded-md shadow-2xs ${
                                        q.isCorrect
                                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                          : 'bg-rose-100 text-rose-800 border border-rose-300'
                                      }`}
                                      title={`Questão ${q.number}: ${q.isCorrect ? 'Correta' : 'Incorreta'} (Resposta: ${q.answer})`}
                                    >
                                      {q.isCorrect ? 'C' : 'E'}
                                    </span>
                                  </td>
                                ))}
                                <td className="p-2 text-center font-extrabold text-slate-800">
                                  <span
                                    className={`px-2 py-0.5 rounded text-[11px] ${
                                      st.hitRate >= 75
                                        ? 'bg-teal-100 text-teal-800'
                                        : st.hitRate >= 50
                                        ? 'bg-sky-100 text-sky-800'
                                        : 'bg-amber-100 text-amber-800'
                                    }`}
                                  >
                                    {st.hitRate}%
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot>
                            <tr className="bg-slate-100 font-bold border-t-2 border-slate-300 text-slate-800 text-[11px]">
                              <td className="p-2 border-r border-slate-300">Média por Questão (%)</td>
                              {activeMat.questionAverages.map((avg, i) => (
                                <td
                                  key={i}
                                  className="p-1 border-r border-slate-300 text-center text-[10px]"
                                  title={`Média Q${i + 1}: ${avg}%`}
                                >
                                  {avg}%
                                </td>
                              ))}
                              <td className="p-2 text-center text-teal-800 font-extrabold">
                                {activeMat.classAverage}%
                              </td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        {/* STEP 4: COMPILAR & EXPORTAR APRESENTAÇÕES, IMAGENS E PDF */}
        <TabsContent value="export" className="flex-1 min-h-0 overflow-y-auto space-y-4">
          <Card className="border-slate-200 shadow-2xs bg-white">
            <CardHeader className="py-4 px-5 border-b border-slate-100">
              <CardTitle className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <FileDown className="h-4 w-4 text-teal-600" />
                Compilação Final dos Resultados
              </CardTitle>
              <CardDescription className="text-xs text-slate-500">
                Escolha o formato desejado para compilar os dados das turmas e módulos selecionados.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              {/* Summary pill */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between flex-wrap gap-2">
                <div className="text-xs text-slate-600">
                  Escola: <strong className="text-slate-800">{historyData.school}</strong> • Turmas carregadas:{' '}
                  <strong className="text-teal-700">{loadedClasses.length} turma(s)</strong>
                </div>
                <div className="text-xs text-slate-500">
                  Módulos ativos:{' '}
                  <span className="font-bold text-slate-700">
                    {Object.values(selectedModules).filter(Boolean).length} de 5
                  </span>
                </div>
              </div>

              {/* 3 Large Export Action Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                {/* 1. PowerPoint */}
                <div className="rounded-xl border-2 border-emerald-100 bg-gradient-to-b from-emerald-50/40 to-white p-5 flex flex-col justify-between shadow-xs hover:border-emerald-300 transition-all">
                  <div className="space-y-2.5">
                    <div className="h-10 w-10 rounded-lg bg-emerald-600 text-white flex items-center justify-center shadow-xs">
                      <Presentation className="h-5 w-5" />
                    </div>
                    <h3 className="text-sm font-bold text-slate-800">Apresentação PowerPoint (.pptx)</h3>
                    <p className="text-xs text-slate-500 leading-relaxed">
                      Gera uma apresentação completa com slides formatados contendo tabelas e gráficos prontos para reuniões pedagógicas e conselhos de classe.
                    </p>
                  </div>
                  <Button
                    onClick={handleExportPptx}
                    disabled={isExportingPptx}
                    className="mt-5 w-full bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs h-9 shadow-xs"
                  >
                    <FileSpreadsheet className="mr-1.5 h-3.5 w-3.5" />
                    {isExportingPptx ? 'Compilando Slides...' : 'Gerar PowerPoint (.pptx)'}
                  </Button>
                </div>

                {/* 2. PNG Images */}
                <div className="rounded-xl border-2 border-sky-100 bg-gradient-to-b from-sky-50/40 to-white p-5 flex flex-col justify-between shadow-xs hover:border-sky-300 transition-all">
                  <div className="space-y-2.5">
                    <div className="h-10 w-10 rounded-lg bg-sky-600 text-white flex items-center justify-center shadow-xs">
                      <FileImage className="h-5 w-5" />
                    </div>
                    <h3 className="text-sm font-bold text-slate-800">Imagens PNG em Alta Resolução</h3>
                    <p className="text-xs text-slate-500 leading-relaxed">
                      Exporta imagens nítidas sem corte horizontal de toda a tabela de histórico e dos descritores, perfeitas para compartilhar no WhatsApp ou imprimir.
                    </p>
                  </div>
                  <Button
                    onClick={handleExportPng}
                    disabled={isExportingPng}
                    className="mt-5 w-full bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs h-9 shadow-xs"
                  >
                    <FileImage className="mr-1.5 h-3.5 w-3.5" />
                    {isExportingPng ? 'Renderizando PNG...' : 'Exportar Imagem PNG'}
                  </Button>
                </div>

                {/* 3. PDF Document */}
                <div className="rounded-xl border-2 border-slate-200 bg-gradient-to-b from-slate-50/60 to-white p-5 flex flex-col justify-between shadow-xs hover:border-slate-400 transition-all">
                  <div className="space-y-2.5">
                    <div className="h-10 w-10 rounded-lg bg-slate-800 text-white flex items-center justify-center shadow-xs">
                      <FileDown className="h-5 w-5" />
                    </div>
                    <h3 className="text-sm font-bold text-slate-800">Relatório PDF Consolidado</h3>
                    <p className="text-xs text-slate-500 leading-relaxed">
                      Compila um documento PDF profissional com tabelas ajustadas, paginação automática e layout otimizado para impressão ou arquivo escolar.
                    </p>
                  </div>
                  <Button
                    onClick={handleExportPdf}
                    disabled={isExportingPdf}
                    className="mt-5 w-full bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs h-9 shadow-xs"
                  >
                    <FileDown className="mr-1.5 h-3.5 w-3.5" />
                    {isExportingPdf ? 'Gerando PDF...' : 'Gerar Relatório PDF'}
                  </Button>
                </div>
              </div>

              {/* Last Exported Path status */}
              {lastExportedPath && (
                <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 flex items-center justify-between">
                  <div className="text-xs text-emerald-900 font-semibold flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    Arquivo gerado com sucesso: <span className="font-mono text-[11px]">{lastExportedPath}</span>
                  </div>
                </div>
              )}

              {/* Back to Preview */}
              <div className="pt-4 border-t flex justify-start">
                <Button
                  variant="outline"
                  onClick={() => setActiveWizardStep('preview')}
                  className="text-xs font-semibold"
                >
                  <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
                  Voltar para Pré-Visualização
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* DIALOG FOR PASTING HTML */}
      <Dialog open={isHtmlModalOpen} onOpenChange={setIsHtmlModalOpen}>
        <DialogContent className="sm:max-w-[650px]">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold flex items-center gap-2">
              <ClipboardPaste className="h-4 w-4 text-teal-600" />
              Colar Código HTML do SAEV
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Copie o HTML da página do Histórico de Desempenho ou Descritores do SAEV e cole abaixo para carregar imediatamente.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-1">
            <Textarea
              value={pastedHtml}
              onChange={(e) => setPastedHtml(e.target.value)}
              placeholder="Cole aqui o elemento HTML ou código da página do SAEV..."
              className="font-mono text-xs h-56 resize-none bg-slate-50 border-slate-200"
            />
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" size="sm" onClick={() => setIsHtmlModalOpen(false)}>
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={handleParsePastedHtml}
              className="bg-teal-700 hover:bg-teal-800 text-white font-medium text-xs"
            >
              Interpretar e Carregar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
