import { useState, useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Play } from 'lucide-react';
import { useExternalAuth } from '@/hooks/useExternalAuth';
import { SaevService } from '@/services/saev';

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
}

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
};

export function SaevFilterForm({ onSubmit, isLoading, initialFilters, restoreToken = 0, onChange }: SaevFilterFormProps) {
    const { service } = useExternalAuth('saev');
    const saevService = service as SaevService;

    const { handleSubmit, reset, setValue, watch } = useForm<SaevFilters>({
        defaultValues: initialFilters || DEFAULT_FILTERS
    });

    const values = watch();
    const initialFiltersRef = useRef(initialFilters);
    const lastChangeHashRef = useRef('');
    const [options, setOptions] = useState<Record<string, Option[]>>({});
    const [loadingFields, setLoadingFields] = useState<Record<string, boolean>>({});

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

    const fetchOptions = async (level: keyof SaevFilters, currentFilters: Partial<SaevFilters>) => {
        if (loadingFields[level]) return;
        console.log(`[FilterForm] Triggering fetch for ${level}`, currentFilters);
        setLoadingFields(prev => ({ ...prev, [level]: true }));
        try {
            const opts = await saevService.getFilterOptions(level, currentFilters);
            console.log(`[FilterForm] Received ${opts.length} options for ${level}`);
            setOptions(prev => ({ ...prev, [level]: opts }));
            
            if (opts.length > 0) {
                if (opts.length === 1 && !values[level]) {
                    console.log(`[FilterForm] Auto-selecting only option for ${level}: ${opts[0].label}`);
                    handleValueChange(level, opts[0].value);
                } else if (level === 'serie' && !values.serie) {
                    console.log(`[FilterForm] Auto-selecting FIRST option for serie: ${opts[0].label}`);
                    handleValueChange('serie', opts[0].value);
                }
            } else {
                console.warn(`[FilterForm] No options found for ${level}`);
            }
        } catch (error) {
            console.error(`[FilterForm] Failed to fetch options for ${level}`, error);
        } finally {
            setLoadingFields(prev => ({ ...prev, [level]: false }));
        }
    };

    const handleValueChange = (name: keyof SaevFilters, val: string) => {
        setValue(name, val);
        
        // Logical reset of all dependent fields at once
        const hierarchy: (keyof SaevFilters)[] = [
            'serie', 'ano', 'edicao', 'rede', 'estado', 'regionalEstadual', 'municipio', 'regionalMunicipal', 'escola', 'turma'
        ];
        const index = hierarchy.indexOf(name);
        if (index !== -1) {
            for (let i = index + 1; i < hierarchy.length; i++) {
                setValue(hierarchy[i], '');
                // Also clear options for dependent fields
                setOptions(prev => ({ ...prev, [hierarchy[i]]: [] }));
            }
        }
    };

    // Initial load - Start with Serie
    useEffect(() => {
        fetchOptions('serie', {});
    }, []);

    // Effect-based dependencies following the new order
    useEffect(() => {
        if (values.serie) fetchOptions('ano', { serie: values.serie });
    }, [values.serie]);

    useEffect(() => {
        if (values.serie && values.ano) fetchOptions('edicao', { serie: values.serie, ano: values.ano });
    }, [values.serie, values.ano]);

    useEffect(() => {
        if (values.edicao) fetchOptions('rede', { ...values });
    }, [values.edicao]);

    useEffect(() => {
        if (values.rede) fetchOptions('estado', { ...values });
    }, [values.rede]);

    useEffect(() => {
        if (values.estado) fetchOptions('regionalEstadual', { ...values });
    }, [values.estado]);

    useEffect(() => {
        if (values.regionalEstadual || (values.estado && !loadingFields.regionalEstadual)) {
            fetchOptions('municipio', { ...values });
        }
    }, [values.regionalEstadual, values.estado]);

    useEffect(() => {
        if (values.municipio) fetchOptions('regionalMunicipal', { ...values });
    }, [values.municipio]);

    useEffect(() => {
        if (values.regionalMunicipal || (values.municipio && !loadingFields.regionalMunicipal)) {
            fetchOptions('escola', { ...values });
        }
    }, [values.regionalMunicipal, values.municipio]);

    useEffect(() => {
        if (values.escola) fetchOptions('turma', { ...values });
    }, [values.escola]);

    const renderSelect = (name: keyof SaevFilters, label: string, placeholder: string) => (
        <div className="space-y-2">
            <div className="flex items-center justify-between">
                <Label htmlFor={name}>{label}</Label>
                {loadingFields[name] && <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />}
            </div>
            <Select 
                value={values[name]} 
                onValueChange={(val) => handleValueChange(name, val)}
                disabled={loadingFields[name] || !isReadyToLoad(name)}
            >
                <SelectTrigger id={name} className="border-green-100 focus:ring-green-600 w-full overflow-hidden">
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

    const isReadyToLoad = (name: keyof SaevFilters) => {
        const hierarchy: (keyof SaevFilters)[] = [
            'serie', 'ano', 'edicao', 'rede', 'estado', 'regionalEstadual', 'municipio', 'regionalMunicipal', 'escola', 'turma'
        ];
        const index = hierarchy.indexOf(name);
        if (index === 0) return true; // first level
        const parent = hierarchy[index - 1];
        return !!values[parent];
    };

    const handleSubmitWithLabels = (data: SaevFilters) => {
        const enrichedData = {
            ...data,
            edicaoLabel: options.edicao?.find(o => o.value === data.edicao)?.label,
            escolaLabel: options.escola?.find(o => o.value === data.escola)?.label,
        };
        onSubmit(enrichedData);
    };

    return (
        <form onSubmit={handleSubmit(handleSubmitWithLabels)} className="space-y-6">
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

            <div className="pt-4 flex justify-end">
                <Button 
                    type="submit" 
                    size="lg" 
                    disabled={isLoading || !values.turma} 
                    className="bg-green-700 hover:bg-green-800 gap-2 min-w-50"
                >
                    {isLoading ? (
                        <>
                            <Loader2 className="w-5 h-5 animate-spin" />
                            Processando...
                        </>
                    ) : (
                        <>
                            <Play className="w-5 h-5" />
                            Iniciar Geração
                        </>
                    )}
                </Button>
            </div>
        </form>
    );
}
