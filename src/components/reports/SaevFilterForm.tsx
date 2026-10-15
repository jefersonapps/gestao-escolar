import { useState, useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Play, BarChart2, PieChart, Grid, TrendingUp, History, SlidersHorizontal, FileSpreadsheet, Compass, LogIn } from 'lucide-react';
import { useExternalAuth } from '@/hooks/useExternalAuth';
import { SaevService } from '@/services/saev';
import { useStore } from '@/store/useStore';

export interface SaevFilters {
    serie: string;
    ano: string;
    edicao: string;
    edicaoLabel?: string;
    rede: string;
    estado: string;
    regionalEstadual: string;
    municipio: string;
    regionalMunicipal: string;
    escola: string;
    escolaLabel?: string;
    turma: string;
    turmaLabel?: string;
    outputType?: 'pptx' | 'pdf' | 'both';
    pdfOrientation?: 'portrait' | 'landscape';
    includeFluency?: boolean;
    includeLevels?: boolean;
    includeMatrix?: boolean;
    includeEvolution?: boolean;
    includeHistory?: boolean;
}

export type SaevSelectFilter = 'serie' | 'ano' | 'edicao' | 'rede' | 'estado' | 'regionalEstadual' | 'municipio' | 'regionalMunicipal' | 'escola' | 'turma';

interface Option {
    label: string;
    value: string;
}

interface SaevFilterFormProps {
    onSubmit: (data: SaevFilters) => void;
    isLoading: boolean;
    initialFilters?: SaevFilters;
    restoreToken?: number;
    onChange?: (data: SaevFilters) => void;
    showReportOptions?: boolean;
    submitButtonLabel?: string;
    submitButtonClassName?: string;
}

const DEFAULT_FILTERS: SaevFilters = {
    rede: '',
    ano: '',
    edicao: '',
    serie: '',
    estado: '',
    regionalEstadual: '',
    municipio: '',
    regionalMunicipal: '',
    escola: '',
    turma: '',
    outputType: 'pptx',
    pdfOrientation: 'portrait',
    includeFluency: true,
    includeLevels: true,
    includeMatrix: true,
    includeEvolution: true,
    includeHistory: true,
};

export function SaevFilterForm({ 
    onSubmit, 
    isLoading, 
    initialFilters, 
    restoreToken = 0, 
    onChange,
    showReportOptions = true,
    submitButtonLabel = 'Iniciar Geração',
    submitButtonClassName,
}: SaevFilterFormProps) {
    const { service } = useExternalAuth('saev');
    const saevService = service as SaevService;

    const { handleSubmit, reset, setValue, watch } = useForm<SaevFilters>({
        defaultValues: initialFilters || DEFAULT_FILTERS
    });

    const values = watch();
    const initialFiltersRef = useRef(initialFilters);
    const lastChangeHashRef = useRef('');
    const lastFetchedKeyRef = useRef<Record<string, string>>({});
    const [options, setOptions] = useState<Record<string, Option[]>>({});
    const [loadingFields, setLoadingFields] = useState<Record<string, boolean>>({});

    const hasToken = !!saevService.accessToken;

    useEffect(() => {
        initialFiltersRef.current = initialFilters;
    }, [initialFilters]);

    useEffect(() => {
        reset({ ...DEFAULT_FILTERS, ...initialFiltersRef.current });
    }, [reset, restoreToken]);

    useEffect(() => {
        const hash = JSON.stringify(values);
        if (hash === lastChangeHashRef.current) return;

        lastChangeHashRef.current = hash;
        onChange?.(values);
    }, [onChange, values]);

    const fetchOptions = async (level: SaevSelectFilter, currentFilters: Partial<SaevFilters>) => {
        if (!saevService.accessToken) {
            console.warn(`[FilterForm] Cannot fetch ${level}: No SAEV access token available`);
            return;
        }

        const fetchKey = `${level}_${JSON.stringify(currentFilters)}`;
        if (lastFetchedKeyRef.current[level] === fetchKey && (options[level]?.length || 0) > 0) {
            return; // Avoid redundant duplicate fetches
        }
        lastFetchedKeyRef.current[level] = fetchKey;

        console.log(`[FilterForm] Triggering fetch for ${level}`, currentFilters);
        setLoadingFields(prev => ({ ...prev, [level]: true }));
        
        try {
            const optsPromise = saevService.getFilterOptions(level, currentFilters);
            const timeoutPromise = new Promise<Option[]>((resolve) =>
                setTimeout(() => resolve([]), 6000)
            );
            const opts = await Promise.race([optsPromise, timeoutPromise]);
            
            console.log(`[FilterForm] Received ${opts.length} options for ${level}`);
            setOptions(prev => ({ ...prev, [level]: opts }));
            
            if (opts.length > 0) {
                if (opts.length === 1 && !values[level]) {
                    console.log(`[FilterForm] Auto-selecting single option for ${level}: ${opts[0].label}`);
                    handleValueChange(level, opts[0].value);
                } else if (level === 'serie' && !values.serie) {
                    console.log(`[FilterForm] Auto-selecting FIRST option for serie: ${opts[0].label}`);
                    handleValueChange('serie', opts[0].value);
                }
            }
        } catch (error) {
            console.error(`[FilterForm] Failed to fetch options for ${level}`, error);
        } finally {
            setLoadingFields(prev => ({ ...prev, [level]: false }));
        }
    };

    const handleValueChange = (name: SaevSelectFilter, val: string) => {
        setValue(name, val);
        
        // Logical reset of all dependent fields at once
        const hierarchy: SaevSelectFilter[] = [
            'serie', 'ano', 'edicao', 'rede', 'estado', 'regionalEstadual', 'municipio', 'regionalMunicipal', 'escola', 'turma'
        ];
        const index = hierarchy.indexOf(name);
        if (index !== -1) {
            for (let i = index + 1; i < hierarchy.length; i++) {
                setValue(hierarchy[i], '');
                setOptions(prev => ({ ...prev, [hierarchy[i]]: [] }));
                delete lastFetchedKeyRef.current[hierarchy[i]];
            }
        }
    };

    // Initial load - Start with Serie if authenticated
    useEffect(() => {
        if (hasToken) {
            fetchOptions('serie', {});
        }
    }, [hasToken]);

    const valSerie = values.serie;
    const valAno = values.ano;
    const valEdicao = values.edicao;
    const valRede = values.rede;
    const valEstado = values.estado;
    const valRegionalEstadual = values.regionalEstadual;
    const valMunicipio = values.municipio;
    const valRegionalMunicipal = values.regionalMunicipal;
    const valEscola = values.escola;

    useEffect(() => {
        if (hasToken && valSerie) fetchOptions('ano', { serie: valSerie });
    }, [hasToken, valSerie]);

    useEffect(() => {
        if (hasToken && valSerie && valAno) fetchOptions('edicao', { serie: valSerie, ano: valAno });
    }, [hasToken, valSerie, valAno]);

    useEffect(() => {
        if (hasToken && valEdicao) fetchOptions('rede', { serie: valSerie, ano: valAno, edicao: valEdicao });
    }, [hasToken, valEdicao]);

    useEffect(() => {
        if (hasToken && valRede) fetchOptions('estado', { serie: valSerie, ano: valAno, edicao: valEdicao, rede: valRede });
    }, [hasToken, valRede]);

    useEffect(() => {
        if (hasToken && valEstado) fetchOptions('regionalEstadual', { serie: valSerie, ano: valAno, edicao: valEdicao, rede: valRede, estado: valEstado });
    }, [hasToken, valEstado]);

    useEffect(() => {
        if (hasToken && (valRegionalEstadual || valEstado)) {
            fetchOptions('municipio', { serie: valSerie, ano: valAno, edicao: valEdicao, rede: valRede, estado: valEstado, regionalEstadual: valRegionalEstadual });
        }
    }, [hasToken, valRegionalEstadual, valEstado]);

    useEffect(() => {
        if (hasToken && valMunicipio) fetchOptions('regionalMunicipal', { serie: valSerie, ano: valAno, edicao: valEdicao, rede: valRede, estado: valEstado, regionalEstadual: valRegionalEstadual, municipio: valMunicipio });
    }, [hasToken, valMunicipio]);

    useEffect(() => {
        if (hasToken && (valRegionalMunicipal || valMunicipio)) {
            fetchOptions('escola', { serie: valSerie, ano: valAno, edicao: valEdicao, rede: valRede, estado: valEstado, regionalEstadual: valRegionalEstadual, municipio: valMunicipio, regionalMunicipal: valRegionalMunicipal });
        }
    }, [hasToken, valRegionalMunicipal, valMunicipio]);

    useEffect(() => {
        if (hasToken && valEscola) fetchOptions('turma', { serie: valSerie, ano: valAno, edicao: valEdicao, rede: valRede, estado: valEstado, regionalEstadual: valRegionalEstadual, municipio: valMunicipio, regionalMunicipal: valRegionalMunicipal, escola: valEscola });
    }, [hasToken, valEscola]);

    const isReadyToLoad = (name: SaevSelectFilter) => {
        if (!hasToken) return false;
        const hierarchy: SaevSelectFilter[] = [
            'serie', 'ano', 'edicao', 'rede', 'estado', 'regionalEstadual', 'municipio', 'regionalMunicipal', 'escola', 'turma'
        ];
        const index = hierarchy.indexOf(name);
        if (index === 0) return true;
        const parent = hierarchy[index - 1];
        return !!values[parent];
    };

    const renderSelect = (name: SaevSelectFilter, label: string, placeholder: string) => (
        <div className="space-y-2">
            <div className="flex items-center justify-between">
                <Label htmlFor={name}>{label}</Label>
                {loadingFields[name] && <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />}
            </div>
            <Select 
                value={values[name] || ''} 
                onValueChange={(val) => handleValueChange(name, val)}
                disabled={loadingFields[name] || !isReadyToLoad(name)}
            >
                <SelectTrigger id={name} className="border-border focus:ring-green-600 w-full overflow-hidden bg-background">
                    <div className="truncate text-left w-full">
                        <SelectValue placeholder={placeholder} />
                    </div>
                </SelectTrigger>
                <SelectContent className="max-w-[400px]">
                    {(options[name] || []).map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                        </SelectItem>
                    ))}
                    {(!options[name] || options[name].length === 0) && !loadingFields[name] && (
                        <div className="p-2 text-xs text-muted-foreground text-center">Nenhuma opção disponível</div>
                    )}
                </SelectContent>
            </Select>
        </div>
    );

    const handleSubmitWithLabels = (data: SaevFilters) => {
        const enrichedData = {
            ...data,
            turmaLabel: options.turma?.find(o => o.value === data.turma)?.label,
            edicaoLabel: options.edicao?.find(o => o.value === data.edicao)?.label,
            escolaLabel: options.escola?.find(o => o.value === data.escola)?.label,
        };
        onSubmit(enrichedData);
    };

    return (
        <form onSubmit={handleSubmit(handleSubmitWithLabels)} className="space-y-6">
            {!hasToken && (
                <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40 text-amber-900 dark:text-amber-200 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                        <LogIn className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" />
                        <div className="text-xs">
                            <p className="font-semibold text-sm">Sessão do SAEV Desconectada</p>
                            <p className="text-amber-700 dark:text-amber-300">Faça login no SAEV para carregar automaticamente os filtros de Série, Ano, Escola e Turma.</p>
                        </div>
                    </div>
                    <Button 
                        type="button" 
                        size="sm" 
                        onClick={() => useStore.getState().setSaevLoginOpen(true)}
                        className="bg-green-700 hover:bg-green-800 text-white text-xs gap-1.5"
                    >
                        <LogIn className="w-3.5 h-3.5" />
                        Fazer Login no SAEV
                    </Button>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {renderSelect('serie', 'Série', 'Selecione a Série')}
                {renderSelect('ano', 'Ano', 'Selecione o Ano')}
                {renderSelect('edicao', 'Edição', 'Selecione a Edição')}
                {renderSelect('rede', 'Rede', 'Selecione a Rede')}
                {renderSelect('estado', 'Estado', 'Selecione o Estado')}
                {renderSelect('regionalEstadual', 'Regional Estadual', 'Selecione a Regional')}
                {renderSelect('municipio', 'Município', 'Selecione o Município')}
                {renderSelect('regionalMunicipal', 'Regional Municipal', 'Selecione a Regional')}
                <div className="lg:col-span-1">
                    {renderSelect('escola', 'Escola', 'Selecione a Escola')}
                </div>
                <div className="lg:col-span-1">
                    {renderSelect('turma', 'Turma (Primeira)', 'Selecione a Turma')}
                </div>
            </div>

            {/* Report Format & Slide Customization Section (Shown only for presentation reports) */}
            {showReportOptions && (
                <div className="rounded-xl border border-green-100 dark:border-green-800/30 bg-green-50/40 dark:bg-green-950/20 p-5 space-y-4">
                    <div className="flex items-center gap-2 text-green-900 dark:text-green-200 font-semibold text-base">
                        <SlidersHorizontal className="w-5 h-5 text-green-700 dark:text-green-400" />
                        <span>Configuração do Relatório & Conteúdo</span>
                    </div>

                    {/* Output Format & PDF Orientation Selectors */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pb-2 border-b border-green-200/60 dark:border-green-800/40">
                        <div className="space-y-1.5">
                            <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                                <FileSpreadsheet className="w-3.5 h-3.5 text-green-700 dark:text-green-400" />
                                <span>Formato de Saída</span>
                            </Label>
                            <Select 
                                value={values.outputType || 'pptx'} 
                                onValueChange={(val: 'pptx' | 'pdf' | 'both') => setValue('outputType', val)}
                            >
                                <SelectTrigger className="bg-background text-xs h-9">
                                    <SelectValue placeholder="Selecione o formato" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="pptx">📽️ PowerPoint (.pptx)</SelectItem>
                                    <SelectItem value="pdf">📄 Documento PDF (.pdf)</SelectItem>
                                    <SelectItem value="both">✨ Ambos (.pptx + .pdf)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {(values.outputType === 'pdf' || values.outputType === 'both') && (
                            <div className="space-y-1.5">
                                <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                                    <Compass className="w-3.5 h-3.5 text-blue-700 dark:text-blue-400" />
                                    <span>Orientação do PDF</span>
                                </Label>
                                <Select 
                                    value={values.pdfOrientation || 'portrait'} 
                                    onValueChange={(val: 'portrait' | 'landscape') => setValue('pdfOrientation', val)}
                                >
                                    <SelectTrigger className="bg-background text-xs h-9">
                                        <SelectValue placeholder="Selecione a orientação" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="portrait">📱 Retrato (Vertical)</SelectItem>
                                        <SelectItem value="landscape">💻 Paisagem (Horizontal)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        )}
                    </div>

                    <p className="text-xs text-muted-foreground">
                        Selecione quais dados e seções devem ser incluídos na apresentação/relatório:
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pt-1">
                        <label className="flex items-start gap-3 p-3 rounded-lg bg-card border border-border shadow-xs cursor-pointer hover:border-green-300 dark:hover:border-green-600 transition-colors">
                            <Checkbox
                                checked={values.includeFluency !== false}
                                onCheckedChange={(checked) => setValue('includeFluency', !!checked)}
                                className="mt-0.5"
                            />
                            <div className="space-y-0.5">
                                <div className="flex items-center gap-1.5 font-medium text-xs text-foreground">
                                    <BarChart2 className="w-3.5 h-3.5 text-green-600 dark:text-green-400" />
                                    <span>Fluência Leitora</span>
                                </div>
                                <p className="text-[11px] text-muted-foreground leading-tight">
                                    Gráfico e tabela com contagem de alunos por nível de leitura
                                </p>
                            </div>
                        </label>

                        <label className="flex items-start gap-3 p-3 rounded-lg bg-white border border-gray-100 shadow-xs cursor-pointer hover:border-green-300 transition-colors">
                            <Checkbox
                                checked={values.includeLevels !== false}
                                onCheckedChange={(checked) => setValue('includeLevels', !!checked)}
                                className="mt-0.5"
                            />
                            <div className="space-y-0.5">
                                <div className="flex items-center gap-1.5 font-medium text-xs text-gray-900">
                                    <PieChart className="w-3.5 h-3.5 text-blue-600" />
                                    <span>Distribuição de Nível</span>
                                </div>
                                <p className="text-[11px] text-muted-foreground leading-tight">
                                    Gráfico empilhado da evolução do percentual de leitura
                                </p>
                            </div>
                        </label>

                        <label className="flex items-start gap-3 p-3 rounded-lg bg-white border border-gray-100 shadow-xs cursor-pointer hover:border-green-300 transition-colors">
                            <Checkbox
                                checked={values.includeMatrix !== false}
                                onCheckedChange={(checked) => setValue('includeMatrix', !!checked)}
                                className="mt-0.5"
                            />
                            <div className="space-y-0.5">
                                <div className="flex items-center gap-1.5 font-medium text-xs text-gray-900">
                                    <Grid className="w-3.5 h-3.5 text-purple-600" />
                                    <span>Matriz de Respostas</span>
                                </div>
                                <p className="text-[11px] text-muted-foreground leading-tight">
                                    Detalhamento de respostas por aluno e por questão
                                </p>
                            </div>
                        </label>

                        <label className="flex items-start gap-3 p-3 rounded-lg bg-white border border-gray-100 shadow-xs cursor-pointer hover:border-green-300 transition-colors">
                            <Checkbox
                                checked={values.includeEvolution !== false}
                                onCheckedChange={(checked) => setValue('includeEvolution', !!checked)}
                                className="mt-0.5"
                            />
                            <div className="space-y-0.5">
                                <div className="flex items-center gap-1.5 font-medium text-xs text-gray-900">
                                    <TrendingUp className="w-3.5 h-3.5 text-orange-600" />
                                    <span>Linha Evolutiva</span>
                                </div>
                                <p className="text-[11px] text-muted-foreground leading-tight">
                                    Gráfico comparativo de participação e acertos entre edições
                                </p>
                            </div>
                        </label>

                        <label className="flex items-start gap-3 p-3 rounded-lg bg-white border border-gray-100 shadow-xs cursor-pointer hover:border-green-300 transition-colors">
                            <Checkbox
                                checked={values.includeHistory !== false}
                                onCheckedChange={(checked) => setValue('includeHistory', !!checked)}
                                className="mt-0.5"
                            />
                            <div className="space-y-0.5">
                                <div className="flex items-center gap-1.5 font-medium text-xs text-gray-900">
                                    <History className="w-3.5 h-3.5 text-emerald-600" />
                                    <span>Histórico de Desempenho</span>
                                </div>
                                <p className="text-[11px] text-muted-foreground leading-tight">
                                    Tabela histórica detalhada com avaliações anteriores
                                </p>
                            </div>
                        </label>
                    </div>
                </div>
            )}

            <div className="pt-2 flex justify-end">
                <Button 
                    type="submit" 
                    size="lg" 
                    disabled={isLoading || (!values.turma && !values.escola && !values.serie)} 
                    className={submitButtonClassName || "bg-green-700 hover:bg-green-800 gap-2 min-w-50 shadow-md"}
                >
                    {isLoading ? (
                        <>
                            <Loader2 className="w-5 h-5 animate-spin" />
                            Buscando Dados...
                        </>
                    ) : (
                        <>
                            <Play className="w-5 h-5" />
                            {submitButtonLabel}
                        </>
                    )}
                </Button>
            </div>
        </form>
    );
}
