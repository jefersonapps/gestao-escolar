import { useCallback, useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useStore } from '@/store/useStore';
import { useExternalAuth } from '@/hooks/useExternalAuth';
import { FileDown, LogIn, RefreshCcw, LayoutDashboard, CheckCircle2 } from 'lucide-react';
import { openPath } from '@tauri-apps/plugin-opener';
import { SaevService } from '@/services/saev';
import { toast } from 'sonner';
import { SaevFilterForm, type SaevFilters } from './SaevFilterForm';
import { generatePresentation } from '@/services/saevReportGenerator';
import type { ClassData } from '@/types';
import { useWorkspacePersistence } from '@/hooks/useWorkspacePersistence';
import { WorkspaceActions } from '@/components/workspace/WorkspaceActions';

type ReportStep = 'setup' | 'generating' | 'finished';

interface ReportsWorkspaceData {
    filters: SaevFilters;
    step: Exclude<ReportStep, 'generating'>;
    progress: number;
    currentClassName: string;
    savedFilePath: string | null;
}

const createEmptyFilters = (): SaevFilters => ({
    serie: '',
    ano: '',
    edicao: '',
    rede: '',
    estado: '',
    regionalEstadual: '',
    municipio: '',
    regionalMunicipal: '',
    escola: '',
    turma: '',
});

export function ReportsScreen() {
    const { externalSessions, setSaevLoginOpen } = useStore();
    const saevUser = externalSessions['saev'];
    const { requireSession, service } = useExternalAuth('saev');
    const saevService = service as SaevService;

    const [isGenerating, setIsGenerating] = useState(false);
    const [step, setStep] = useState<ReportStep>('setup');
    const [progress, setProgress] = useState(0);
    const [currentClassName, setCurrentClassName] = useState('');
    const [savedFilePath, setSavedFilePath] = useState<string | null>(null);
    const [filters, setFilters] = useState<SaevFilters>(createEmptyFilters);
    const [restoreToken, setRestoreToken] = useState(0);

    const workspaceData = useMemo<ReportsWorkspaceData>(
        () => ({
            filters,
            step: step === 'generating' ? 'setup' : step,
            progress: step === 'generating' ? 0 : progress,
            currentClassName: step === 'generating' ? '' : currentClassName,
            savedFilePath,
        }),
        [currentClassName, filters, progress, savedFilePath, step],
    );

    const getWorkspaceName = useCallback((workspace: ReportsWorkspaceData) => {
        const school = workspace.filters.escolaLabel || workspace.filters.escola || 'sem_escola';
        return `Relatorios_SAEV_${school}`;
    }, []);

    const restoreWorkspace = useCallback((workspace: ReportsWorkspaceData) => {
        setFilters({ ...createEmptyFilters(), ...workspace.filters });
        setStep(workspace.step || 'setup');
        setProgress(Number(workspace.progress) || 0);
        setCurrentClassName(workspace.currentClassName || '');
        setSavedFilePath(workspace.savedFilePath || null);
        setRestoreToken((current) => current + 1);
    }, []);

    const clearWorkspace = useCallback(() => {
        setFilters(createEmptyFilters());
        setStep('setup');
        setProgress(0);
        setCurrentClassName('');
        setSavedFilePath(null);
        setRestoreToken((current) => current + 1);
    }, []);

    const workspace = useWorkspacePersistence({
        tabType: 'reports',
        data: workspaceData,
        onRestore: restoreWorkspace,
        getDefaultName: getWorkspaceName,
        isDataEmpty: (workspaceValue) =>
            Object.values(workspaceValue.filters).every((value) => !value) &&
            workspaceValue.step === 'setup' &&
            workspaceValue.progress === 0 &&
            !workspaceValue.currentClassName &&
            !workspaceValue.savedFilePath,
    });

    const handleLogin = () => {
        setSaevLoginOpen(true);
    };

    const handleStartGeneration = async (filters: SaevFilters) => {
        setFilters(filters);
        const hasSession = await requireSession();
        if (!hasSession) return;

        setStep('generating');
        setIsGenerating(true);
        setProgress(0);

        try {
            // 1. Fetch ALL series for this school to find ALL classes
            setProgress(5);
            setCurrentClassName('Buscando séries...');
            console.log('[ReportsScreen] Fetching all series from SAEV...');
            const allSeries = await saevService.getFilterOptions('serie', filters);
            
            const targetClasses: { label: string, value: string, serieId: string }[] = [];
            
            // 2. Fetch classes for EACH series
            for (let i = 0; i < allSeries.length; i++) {
                const s = allSeries[i];
                const seriesProgress = 5 + Math.floor(((i + 1) / allSeries.length) * 5); // 5% to 10%
                setProgress(seriesProgress);
                setCurrentClassName(`Buscando turmas: ${s.label}`);
                
                const classesForSeries = await saevService.getFilterOptions('turma', { ...filters, serie: s.value });
                classesForSeries.forEach(c => {
                    if (!targetClasses.some(tc => tc.value === c.value)) {
                        targetClasses.push({ ...c, serieId: s.value });
                    }
                });
            }

            console.log(`[ReportsScreen] Found ${targetClasses.length} total classes across all series.`);

            const allClassesData: ClassData[] = [];

            for (let i = 0; i < targetClasses.length; i++) {
                const cls = targetClasses[i];
                setCurrentClassName(cls.label);
                
                // Update progress (from 10% to 90%)
                const currentProgress = 10 + Math.floor(((i + 1) / targetClasses.length) * 80);
                setProgress(currentProgress);

                // 3. Scrape data using the specific class ID AND series ID
                const currentFilters = { ...filters, serie: cls.serieId, turma: cls.value };
                console.log(`[ReportsScreen] Scraping data for ${cls.label} (Series: ${cls.serieId}, ID: ${cls.value})`);
                const data = await saevService.scrapeReportData(currentFilters);
                
                allClassesData.push({
                    name: cls.label,
                    images: [],
                    csvData: data || []
                });
            }

            // 4. Generate presentation
            setProgress(95);
            setCurrentClassName('Montando apresentação...');
            
            const filePath = await generatePresentation(allClassesData, {
                ...filters,
                title: `Relatorio_SAEV_${new Date().getFullYear()}`,
                margin: 0.5,
                backgroundColor: 'FFFFFF'
            });
            
            setSavedFilePath(filePath);
            setStep('finished');
            if (filePath) {
                toast.success("Apresentação gerada e salva com sucesso!");
            } else {
                toast.success("Apresentação gerada!");
            }
        } catch (error) {
            console.error(error);
            toast.error("Erro ao gerar a apresentação. O sistema SAEV pode estar instável.");
            setStep('setup');
        } finally {
            setIsGenerating(false);
        }
    };

    const handleOpenFile = async () => {
        if (savedFilePath) {
            try {
                await openPath(savedFilePath);
            } catch (error) {
                console.error('Error opening file:', error);
                toast.error("Não foi possível abrir o arquivo automaticamente.");
            }
        }
    };

    const workspaceActions = (
        <WorkspaceActions
            tabType="reports"
            controller={workspace}
            defaultName={getWorkspaceName(workspaceData)}
            onClearData={clearWorkspace}
        />
    );

    if (!saevUser) {
        return (
            <div className="space-y-6">
                {workspaceActions}
                <div className="flex flex-col items-center justify-center h-[60vh] space-y-6">
                    <div className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center">
                        <LayoutDashboard className="w-10 h-10 text-green-600" />
                    </div>
                    <div className="text-center space-y-2">
                        <h2 className="text-2xl font-bold">Relatórios SAEV</h2>
                        <p className="text-muted-foreground max-w-md">
                            Conecte sua conta do SAEV para gerar apresentações automáticas dos resultados das turmas.
                        </p>
                    </div>
                    <Button onClick={handleLogin} size="lg" className="gap-2 bg-green-700 hover:bg-green-800">
                        <LogIn className="w-5 h-5" />
                        Entrar no SAEV
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            {workspaceActions}

            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Relatórios SAEV</h2>
                    <p className="text-muted-foreground">
                        Gere apresentações PowerPoint com os resultados das avaliações.
                    </p>
                </div>
            </div>

            {step === 'setup' && (
                <Card className="border-green-100 shadow-sm">
                    <CardHeader>
                        <CardTitle>Configuração da Primeira Turma</CardTitle>
                        <CardDescription>
                            Preencha os filtros exatamente como aparecem no SAEV para a primeira turma. 
                            O sistema replicará automaticamente para as demais.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <SaevFilterForm
                            onSubmit={handleStartGeneration}
                            isLoading={isGenerating}
                            initialFilters={filters}
                            restoreToken={restoreToken}
                            onChange={setFilters}
                        />
                    </CardContent>
                </Card>
            )}

            {step === 'generating' && (
                <Card className="border-green-100 shadow-lg">
                    <CardContent className="pt-10 pb-10 flex flex-col items-center space-y-6">
                        <div className="relative w-24 h-24">
                            <RefreshCcw className="w-24 h-24 text-green-600 animate-spin opacity-20" />
                            <div className="absolute inset-0 flex items-center justify-center font-bold text-xl">
                                {progress}%
                            </div>
                        </div>
                        <div className="text-center space-y-2">
                            <h3 className="text-xl font-semibold">Gerando Apresentação...</h3>
                            {currentClassName && (
                                <p className="text-green-600 font-medium animate-pulse">
                                    Processando: {currentClassName}
                                </p>
                            )}
                            <p className="text-muted-foreground">Extraindo dados e montando os slides. Por favor, aguarde.</p>
                        </div>
                        <div className="w-full bg-muted rounded-full h-2 overflow-hidden max-w-md">
                            <div 
                                className="bg-green-600 h-full transition-all duration-300" 
                                style={{ width: `${progress}%` }}
                            />
                        </div>
                    </CardContent>
                </Card>
            )}

            {step === 'finished' && (
                <Card className="border-green-100 shadow-lg">
                    <CardContent className="pt-10 pb-10 flex flex-col items-center space-y-6">
                        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center">
                            <CheckCircle2 className="w-12 h-12 text-green-600" />
                        </div>
                        <div className="text-center">
                            <h3 className="text-xl font-semibold">Concluído!</h3>
                            <p className="text-muted-foreground">A apresentação foi gerada e enviada para seu computador.</p>
                        </div>
                        <div className="flex gap-3">
                            <Button variant="outline" onClick={() => setStep('setup')}>
                                Gerar outro
                            </Button>
                            <Button 
                                className="bg-green-700 hover:bg-green-800 gap-2"
                                onClick={handleOpenFile}
                                disabled={!savedFilePath}
                            >
                                <FileDown className="w-4 h-4" />
                                Abrir Arquivo
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
