import { useState, useEffect, useMemo, useRef } from 'react';
import {
  CalendarDays,
  Upload,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Search,
  Trash2,
  Plus,
  Play,
  Download,
  Sparkles,
  ArrowUpDown,
  RotateCcw,
  Check,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';

import type { AgendaActivity, SpellingIssue, AgendaStats } from '@/types/agenda';
import { AgendaService } from '@/services/agendaService';
import { parseDocxFile } from '@/services/docxAgendaParser';
import {
  scanActivitiesForSpelling,
  applySpellingFix,
  autoFixAllActivities
} from '@/services/ptBrSpellChecker';

export function AgendaDiretoraManager() {
  const [activities, setActivities] = useState<AgendaActivity[]>([]);
  const [completedIds, setCompletedIds] = useState<Set<string | number>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'demandas' | 'upload' | 'portugues'>('demandas');

  // Upload & Extraction
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [uploadWarnings, setUploadWarnings] = useState<string[]>([]);
  const [isExtracting, setIsExtracting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedWeek, setSelectedWeek] = useState<string>('ALL');
  const [selectedDay, setSelectedDay] = useState<string>('ALL');
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'SELECTED' | 'PENDING' | 'COMPLETED'>('ALL');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // Collapsed / Expanded state for completed activities (completed activities start collapsed)
  const [expandedIds, setExpandedIds] = useState<Set<string | number>>(new Set());

  // Assisted Launch Modal
  const [isLaunchModalOpen, setIsLaunchModalOpen] = useState(false);
  const [isLaunching, setIsLaunching] = useState(false);

  // New activity manual modal
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newActivityData, setNewActivityData] = useState({
    data: new Date().toLocaleDateString('pt-BR'),
    titulo: 'Demanda Pedagógica e Administrativa',
    local: 'UMEIEF GONÇALA RODRIGUES DE FREITAS',
    descricao: 'PEDAGÓGICO\n- Atendimento aos alunos e professores;\n\nADMINISTRATIVO\n- Acompanhamento de frequência escolar;'
  });

  // Load initial activities on mount
  useEffect(() => {
    AgendaService.checkServerStatus(); // Auto-start background helper if needed
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    setIsLoading(true);
    try {
      const { activities: loadedActs } = await AgendaService.loadActivities();
      const progress = await AgendaService.getProgress();
      setCompletedIds(new Set(progress.concluidos_ids || []));
      setActivities(loadedActs);
    } catch (e) {
      console.error('Error loading agenda data:', e);
    } finally {
      setIsLoading(false);
    }
  };

  // Compile spelling issues whenever activities change
  const spellingIssues: SpellingIssue[] = useMemo(() => {
    return scanActivitiesForSpelling(activities);
  }, [activities]);

  // Derived stats
  const stats: AgendaStats & { pendingSelected: number } = useMemo(() => {
    const total = activities.length;
    const selected = activities.filter(a => a.selecionado).length;
    const completed = activities.filter(a => completedIds.has(a.id)).length;
    const pending = total - completed;
    const pendingSelected = activities.filter(a => a.selecionado && !completedIds.has(a.id)).length;
    const uniqueWeeks = new Set(activities.map(a => a.origem_arquivo)).size;

    return {
      total,
      selected,
      completed,
      pending,
      pendingSelected,
      weeksCount: uniqueWeeks,
      spellingIssuesCount: spellingIssues.length
    };
  }, [activities, completedIds, spellingIssues]);

  // Helper to convert DD/MM/YYYY or ISO into comparable YYYY-MM-DD
  const getDateSortKey = (act: AgendaActivity): string => {
    if (act.data_iso && /^\d{4}-\d{2}-\d{2}$/.test(act.data_iso)) {
      return act.data_iso;
    }
    if (act.data) {
      const parts = act.data.split('/');
      if (parts.length === 3) {
        const d = parts[0].padStart(2, '0');
        const m = parts[1].padStart(2, '0');
        const y = parts[2].length === 2 ? `20${parts[2]}` : parts[2];
        return `${y}-${m}-${d}`;
      }
    }
    return '9999-99-99';
  };

  // Unique weeks list for filter - SORTED CHRONOLOGICALLY by week start date!
  const weekOptions = useMemo(() => {
    const fileEarliestDate = new Map<string, string>();
    for (const act of activities) {
      if (!act.origem_arquivo) continue;
      const iso = getDateSortKey(act);
      const existing = fileEarliestDate.get(act.origem_arquivo);
      if (!existing || iso < existing) {
        fileEarliestDate.set(act.origem_arquivo, iso);
      }
    }
    const files = Array.from(fileEarliestDate.keys());
    return files.sort((a, b) => {
      const dateA = fileEarliestDate.get(a) || '';
      const dateB = fileEarliestDate.get(b) || '';
      return dateA.localeCompare(dateB);
    });
  }, [activities]);

  // Filtered activities - STRICTLY SORTED IN CHRONOLOGICAL ORDER
  const filteredActivities = useMemo(() => {
    const filtered = activities.filter(act => {
      // Week filter
      if (selectedWeek !== 'ALL' && act.origem_arquivo !== selectedWeek) return false;

      // Day filter
      if (selectedDay !== 'ALL' && act.dia_semana !== selectedDay) return false;

      // Status filter
      const isDone = completedIds.has(act.id);
      if (filterStatus === 'SELECTED' && !act.selecionado) return false;
      if (filterStatus === 'PENDING' && isDone) return false;
      if (filterStatus === 'COMPLETED' && !isDone) return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = (act.titulo || '').toLowerCase().includes(q);
        const matchDesc = (act.descricao || '').toLowerCase().includes(q);
        const matchLoc = (act.local || '').toLowerCase().includes(q);
        const matchDate = (act.data || '').includes(q);
        if (!matchTitle && !matchDesc && !matchLoc && !matchDate) return false;
      }

      return true;
    });

    // Chronological sorting (earliest dates first, e.g. 11/05 -> 12/05 -> 13/05 ... 07/09)
    return filtered.sort((a, b) => {
      const isoA = getDateSortKey(a);
      const isoB = getDateSortKey(b);
      const comp = isoA.localeCompare(isoB);
      if (comp !== 0) {
        return sortDirection === 'asc' ? comp : -comp;
      }
      return (Number(a.id) || 0) - (Number(b.id) || 0);
    });
  }, [activities, selectedWeek, selectedDay, filterStatus, searchQuery, completedIds, sortDirection]);

  // Handle File Input Change
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files).filter(f =>
        f.name.endsWith('.docx') || f.name.endsWith('.pdf')
      );
      setUploadedFiles(prev => [...prev, ...files]);
    }
  };

  // Drag and drop handlers
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files) {
      const files = Array.from(e.dataTransfer.files).filter(f =>
        f.name.endsWith('.docx') || f.name.endsWith('.pdf')
      );
      setUploadedFiles(prev => [...prev, ...files]);
    }
  };

  // Perform Extraction on Uploaded Files
  const handleExtractFiles = async () => {
    if (uploadedFiles.length === 0) {
      toast.warning('Selecione pelo menos um arquivo DOCX ou PDF para extrair.');
      return;
    }

    setIsExtracting(true);
    const newActs: AgendaActivity[] = [];
    const warnings: string[] = [];

    try {
      for (const file of uploadedFiles) {
        if (file.name.endsWith('.docx')) {
          try {
            const result = await parseDocxFile(file, file.name);
            newActs.push(...result.activities);
            warnings.push(...result.warnings);
          } catch (err) {
            warnings.push(`Erro ao processar ${file.name}: ${err instanceof Error ? err.message : String(err)}`);
          }
        } else {
          warnings.push(`Arquivo PDF detectado (${file.name}). Para máxima precisão de tabelas, o arquivo DOCX é preferível.`);
        }
      }

      if (newActs.length > 0) {
        const combined = [...activities];
        newActs.forEach(act => {
          const exists = combined.some(c => c.data_iso === act.data_iso && c.origem_arquivo === act.origem_arquivo);
          if (!exists) {
            combined.push(act);
          }
        });

        // Re-index IDs cleanly
        combined.forEach((a, i) => { a.id = i + 1; });

        setActivities(combined);
        await AgendaService.saveActivities(combined);
        setUploadedFiles([]);
        setUploadWarnings(warnings);
        setActiveTab('demandas');
        toast.success(`${newActs.length} atividades extraídas com sucesso!`);
      } else {
        setUploadWarnings(warnings);
        toast.warning('Nenhuma nova atividade foi extraída. Verifique os avisos.');
      }
    } catch (err) {
      toast.error('Erro na extração dos arquivos.');
      console.error(err);
    } finally {
      setIsExtracting(false);
    }
  };

  // Apply Single Spelling Fix
  const handleApplySpellingFix = (issue: SpellingIssue) => {
    setActivities(prev =>
      prev.map(act => {
        if (act.id === issue.activityId) {
          return applySpellingFix(act, issue);
        }
        return act;
      })
    );
    toast.success(`Correção aplicada: "${issue.originalWord}" → "${issue.suggestedWord}"`);
  };

  // Auto-Fix All Spelling Issues
  const handleAutoFixAll = () => {
    const { updated, totalFixed } = autoFixAllActivities(activities);
    setActivities(updated);
    AgendaService.saveActivities(updated);
    toast.success(`${totalFixed} correções ortográficas aplicadas com sucesso!`);
  };

  // Update Activity Field
  const updateActivityField = (id: string | number, field: keyof AgendaActivity, value: any) => {
    setActivities(prev =>
      prev.map(act => {
        if (act.id === id) {
          const updated = { ...act, [field]: value };
          if (field === 'data' && typeof value === 'string') {
            const parts = value.split('/');
            if (parts.length === 3) {
              const dt = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
              if (!isNaN(dt.getTime())) {
                const dayIndex = dt.getDay();
                const weekdays = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
                updated.dia_semana = weekdays[dayIndex] || updated.dia_semana;
                updated.data_iso = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
              }
            }
          }
          return updated;
        }
        return act;
      })
    );
  };

  // Toggle Selection
  const toggleSelect = (id: string | number) => {
    setActivities(prev =>
      prev.map(act => (act.id === id ? { ...act, selecionado: !act.selecionado } : act))
    );
  };

  // Select/Unselect All
  const handleSelectAll = (select: boolean) => {
    setActivities(prev => prev.map(act => ({ ...act, selecionado: select })));
  };

  // Delete Activity
  const handleDeleteActivity = (id: string | number) => {
    setActivities(prev => prev.filter(act => act.id !== id));
    toast.success('Atividade removida.');
  };

  // Toggle expand / collapse single completed activity
  const toggleExpand = (id: string | number) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Toggle expand / collapse all completed activities
  const toggleCollapseAllCompleted = () => {
    const completedList = activities.filter(a => completedIds.has(a.id));
    const allExpanded = completedList.length > 0 && completedList.every(a => expandedIds.has(a.id));

    if (allExpanded) {
      setExpandedIds(new Set());
    } else {
      setExpandedIds(new Set(completedList.map(a => a.id)));
    }
  };

  const allCompletedExpanded = useMemo(() => {
    const completedList = activities.filter(a => completedIds.has(a.id));
    return completedList.length > 0 && completedList.every(a => expandedIds.has(a.id));
  }, [activities, completedIds, expandedIds]);

  // Reset Progress History
  const handleResetProgress = async () => {
    if (confirm('Deseja resetar o histórico de progresso? Todas as 70 demandas voltarão ao estado pendente para que você possa lançá-las novamente no SGEDU.')) {
      setIsLoading(true);
      try {
        await AgendaService.resetProgress();
        setCompletedIds(new Set());
        toast.success('Progresso resetado com sucesso! Todas as demandas estão prontas para novo lançamento.');
      } catch {
        toast.error('Erro ao resetar progresso.');
      } finally {
        setIsLoading(false);
      }
    }
  };

  // Save changes
  const handleSaveAll = async () => {
    setIsLoading(true);
    try {
      await AgendaService.saveActivities(activities);
      toast.success('Todas as alterações foram salvas!');
    } catch {
      toast.error('Erro ao salvar alterações.');
    } finally {
      setIsLoading(false);
    }
  };

  // Launch Assisted Playwright Mode
  const handleStartAssistedLaunch = async () => {
    // If all selected are completed, warn user and offer reset
    if (stats.pendingSelected === 0 && stats.selected > 0) {
      toast.info('Todas as atividades selecionadas já constam como concluídas no SGEDU.');
      return;
    }

    setIsLaunching(true);
    try {
      await AgendaService.saveActivities(activities);
      const result = await AgendaService.launchAssistedBrowser();
      if (result.success) {
        toast.success(result.message);
        setIsLaunchModalOpen(false);
      } else {
        toast.error(result.message);
      }
    } catch (e) {
      toast.error('Erro ao iniciar automação.');
      console.error(e);
    } finally {
      setIsLaunching(false);
    }
  };

  // Export CSV
  const handleExportCsv = () => {
    const headers = ['ID', 'Data', 'Dia da Semana', 'Local', 'Título', 'Descrição', 'Arquivo de Origem', 'Selecionado'];
    const rows = activities.map(a => [
      a.id,
      `"${a.data}"`,
      `"${a.dia_semana}"`,
      `"${a.local}"`,
      `"${(a.titulo || '').replace(/"/g, '""')}"`,
      `"${(a.descricao || '').replace(/"/g, '""')}"`,
      `"${a.origem_arquivo}"`,
      a.selecionado ? 'Sim' : 'Não'
    ]);

    const csvContent = '\uFEFF' + [headers.join(';'), ...rows.map(r => r.join(';'))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'agenda_gestao_escolar.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Planilha CSV exportada com sucesso!');
  };

  // Add Manual Activity
  const handleAddManualActivity = () => {
    const newId = activities.length > 0 ? Math.max(...activities.map(a => Number(a.id) || 0)) + 1 : 1;
    const parts = newActivityData.data.split('/');
    const dateIso = parts.length === 3 ? `${parts[2]}-${parts[1]}-${parts[0]}` : '';

    const newAct: AgendaActivity = {
      id: newId,
      data: newActivityData.data,
      data_iso: dateIso,
      dia_semana: 'Segunda-feira',
      categoria: 'Demanda Pedagógica e Administrativa',
      titulo: newActivityData.titulo,
      descricao: newActivityData.descricao,
      local: newActivityData.local,
      origem_arquivo: 'Manual',
      selecionado: true
    };

    setActivities(prev => [newAct, ...prev]);
    setIsAddModalOpen(false);
    toast.success('Nova atividade adicionada!');
  };

  return (
    <div className="space-y-6 w-full min-w-0 animate-in fade-in duration-300">
      {/* Top Header Banner */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 border-b pb-6 w-full min-w-0">
        <div className="flex items-center gap-3.5 min-w-0">
          <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shrink-0 shadow-xs border border-primary/20">
            <CalendarDays className="w-6 h-6 shrink-0 text-primary" />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl md:text-2xl font-bold tracking-tight truncate">Agenda da Gestão Escolar</h1>
            <p className="text-xs text-muted-foreground mt-0.5 break-words">
              Extração de agendas, conferência ortográfica e lançamento assistido no portal SGEDU.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap shrink-0">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold border bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20 shadow-2xs shrink-0">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
            <span>Automação Pronta</span>
          </div>

          <Button variant="outline" size="sm" onClick={handleSaveAll} disabled={isLoading} className="text-xs h-8 shrink-0">
            Salvar Alterações
          </Button>

          <Button variant="outline" size="sm" onClick={handleExportCsv} className="text-xs h-8 shrink-0">
            <Download className="w-3.5 h-3.5 mr-1.5" />
            Exportar CSV
          </Button>

          {/* Launch Button with Smart State */}
          <Button
            size="sm"
            onClick={() => setIsLaunchModalOpen(true)}
            className={`h-8 px-3.5 text-xs font-bold gap-2 shadow-xs shrink-0 ${
              stats.pendingSelected === 0 && stats.total > 0
                ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                : 'bg-primary hover:bg-primary/90 text-primary-foreground'
            }`}
          >
            {stats.pendingSelected === 0 && stats.total > 0 ? (
              <>
                <Check className="w-4 h-4" />
                Todas Concluídas ({stats.completed})
              </>
            ) : (
              <>
                <Play className="w-4 h-4" />
                Lançar no SGEDU ({stats.pendingSelected})
              </>
            )}
          </Button>
        </div>
      </div>

      {/* 100% Completed Visual Banner */}
      {stats.total > 0 && stats.pending === 0 && (
        <div className="bg-gradient-to-r from-emerald-500/15 via-emerald-500/10 to-transparent border border-emerald-500/30 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-2xs animate-in fade-in duration-300 w-full min-w-0">
          <div className="flex items-start sm:items-center gap-3 min-w-0 flex-1">
            <div className="w-10 h-10 rounded-xl bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-sm mt-0.5 sm:mt-0">
              <CheckCircle2 className="w-5 h-5 shrink-0" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="font-bold text-sm text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5 flex-wrap">
                <span>Todas as {stats.total} demandas já foram concluídas e lançadas no SGEDU!</span>
                <span>🎉</span>
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed break-words">
                O arquivo de progresso confirma que todos os {stats.total} registros foram salvos. Caso queira relançar ou conferir novamente no SGEDU, clique em "Resetar Histórico".
              </p>
            </div>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={handleResetProgress}
            className="border-emerald-500/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/10 text-xs font-semibold gap-1.5 shrink-0 self-start md:self-auto"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Resetar Histórico para Relançar</span>
          </Button>
        </div>
      )}

      {/* Stats Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-3 w-full min-w-0">
        <Card className="shadow-2xs min-w-0 overflow-hidden">
          <CardHeader className="pb-1 pt-3 px-3.5">
            <CardDescription className="text-[10px] md:text-[11px] uppercase font-bold text-muted-foreground tracking-wider truncate">
              Total na Base
            </CardDescription>
            <CardTitle className="text-2xl font-extrabold text-foreground">{stats.total}</CardTitle>
          </CardHeader>
          <CardContent className="px-3.5 pb-3">
            <span className="text-xs text-muted-foreground font-medium truncate block">{stats.weeksCount} semanas</span>
          </CardContent>
        </Card>

        <Card className="shadow-2xs border-primary/20 bg-primary/5 min-w-0 overflow-hidden">
          <CardHeader className="pb-1 pt-3 px-3.5">
            <CardDescription className="text-[10px] md:text-[11px] uppercase font-bold text-primary tracking-wider truncate">
              Selecionadas
            </CardDescription>
            <CardTitle className="text-2xl font-extrabold text-primary">{stats.selected}</CardTitle>
          </CardHeader>
          <CardContent className="px-3.5 pb-3">
            <span className="text-xs text-muted-foreground font-medium truncate block">{stats.pendingSelected} prontas para envio</span>
          </CardContent>
        </Card>

        <Card className="shadow-2xs border-emerald-500/20 bg-emerald-500/5 min-w-0 overflow-hidden">
          <CardHeader className="pb-1 pt-3 px-3.5">
            <CardDescription className="text-[10px] md:text-[11px] uppercase font-bold text-emerald-600 dark:text-emerald-400 tracking-wider truncate">
              Concluídas SGEDU
            </CardDescription>
            <CardTitle className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400">
              {stats.completed}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-3.5 pb-3">
            <span className="text-xs text-muted-foreground font-medium truncate block">Já gravadas no portal</span>
          </CardContent>
        </Card>

        <Card className="shadow-2xs min-w-0 overflow-hidden">
          <CardHeader className="pb-1 pt-3 px-3.5">
            <CardDescription className="text-[10px] md:text-[11px] uppercase font-bold text-muted-foreground tracking-wider truncate">
              Pendentes Agora
            </CardDescription>
            <CardTitle className="text-2xl font-extrabold text-foreground">{stats.pending}</CardTitle>
          </CardHeader>
          <CardContent className="px-3.5 pb-3">
            <span className="text-xs text-muted-foreground font-medium truncate block">Faltando cadastrar</span>
          </CardContent>
        </Card>

        <Card
          className={`shadow-2xs cursor-pointer transition-all min-w-0 overflow-hidden ${
            stats.spellingIssuesCount > 0
              ? 'border-amber-500/40 bg-amber-500/10 hover:bg-amber-500/15'
              : 'border-muted bg-card hover:bg-muted/30'
          }`}
          onClick={() => setActiveTab('portugues')}
        >
          <CardHeader className="pb-1 pt-3 px-3.5">
            <div className="flex items-center justify-between">
              <CardDescription className="text-[10px] md:text-[11px] uppercase font-bold text-amber-600 dark:text-amber-400 tracking-wider truncate">
                Erros Português
              </CardDescription>
              <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0" />
            </div>
            <CardTitle className="text-2xl font-extrabold text-amber-600 dark:text-amber-400">
              {stats.spellingIssuesCount}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-3.5 pb-3">
            <span className="text-xs text-muted-foreground font-medium truncate block">
              {stats.spellingIssuesCount === 0 ? 'Tudo conferido!' : 'Ver e corrigir erros'}
            </span>
          </CardContent>
        </Card>
      </div>

      {/* Main Intuitive Tabs Navigation */}
      <Tabs value={activeTab} onValueChange={(v: any) => setActiveTab(v)} className="w-full space-y-4 min-w-0">
        <div className="flex items-center justify-between border-b pb-2 overflow-x-auto min-w-0">
          <TabsList className="bg-muted/60 p-1 rounded-xl flex-wrap h-auto min-w-0">
            <TabsTrigger value="demandas" className="text-xs font-semibold gap-2 py-2 px-4 rounded-lg data-[state=active]:shadow-xs">
              <FileText className="w-4 h-4" />
              Demandas da Agenda ({filteredActivities.length})
            </TabsTrigger>

            <TabsTrigger value="upload" className="text-xs font-semibold gap-2 py-2 px-4 rounded-lg data-[state=active]:shadow-xs">
              <Upload className="w-4 h-4" />
              Subir Novos Arquivos (DOCX / PDF)
              {uploadedFiles.length > 0 && (
                <Badge variant="default" className="ml-1 px-1.5 py-0 text-[10px] h-4">
                  {uploadedFiles.length}
                </Badge>
              )}
            </TabsTrigger>

            <TabsTrigger value="portugues" className="text-xs font-semibold gap-2 py-2 px-4 rounded-lg data-[state=active]:shadow-xs">
              <Sparkles className="w-4 h-4 text-amber-500" />
              Correção de Português
              {spellingIssues.length > 0 && (
                <Badge variant="destructive" className="ml-1 px-1.5 py-0 text-[10px] h-4">
                  {spellingIssues.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>
        </div>

        {/* TAB 1: DEMANDAS DA AGENDA */}
        <TabsContent value="demandas" className="space-y-4 focus-visible:outline-none mt-0 min-w-0">
          {/* Structured 2-Tier Clean Toolbar */}
          <div className="bg-card rounded-xl border p-3.5 space-y-3 shadow-2xs w-full min-w-0">
            {/* Tier 1: Search & Primary Action Buttons */}
            <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2.5 w-full min-w-0">
              {/* Search Bar */}
              <div className="relative flex-1 min-w-[220px]">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Buscar por texto, data ou local..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="pl-9 text-xs h-9 bg-background/80 rounded-lg w-full"
                />
              </div>

              {/* Primary Actions */}
              <div className="flex items-center gap-2 flex-wrap shrink-0">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'))}
                  className="h-9 text-xs gap-1.5 bg-background font-medium shrink-0 rounded-lg"
                  title="Alternar sentido cronológico"
                >
                  <ArrowUpDown className="w-3.5 h-3.5 text-primary" />
                  <span>{sortDirection === 'asc' ? 'Mais Antigas' : 'Mais Recentes'}</span>
                </Button>

                {stats.completed > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={toggleCollapseAllCompleted}
                    className="h-9 text-xs gap-1.5 bg-background font-medium text-emerald-700 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10 shrink-0 rounded-lg"
                    title={allCompletedExpanded ? 'Recolher todas as demandas já lançadas' : 'Expandir todas as demandas já lançadas'}
                  >
                    {allCompletedExpanded ? (
                      <>
                        <ChevronUp className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Recolher Lançadas</span>
                      </>
                    ) : (
                      <>
                        <ChevronDown className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Expandir Lançadas ({stats.completed})</span>
                      </>
                    )}
                  </Button>
                )}

                <Button
                  size="sm"
                  onClick={() => setIsAddModalOpen(true)}
                  className="h-9 text-xs gap-1.5 font-semibold bg-primary hover:bg-primary/90 text-primary-foreground shadow-xs shrink-0 rounded-lg"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Nova Demanda</span>
                </Button>
              </div>
            </div>

            {/* Separator */}
            <div className="border-t border-border/50" />

            {/* Tier 2: Filters Dropdowns & Batch Selection */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 w-full min-w-0 text-xs">
              {/* Dropdowns */}
              <div className="flex items-center gap-2 flex-wrap flex-1 min-w-0">
                <span className="text-[11px] font-semibold text-muted-foreground mr-0.5 shrink-0">Filtros:</span>

                {/* Week Filter */}
                <div className="w-[170px] shrink-0">
                  <Select value={selectedWeek} onValueChange={setSelectedWeek}>
                    <SelectTrigger className="h-8 text-xs bg-background/80 rounded-md w-full">
                      <SelectValue placeholder="Todas as Semanas" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">Todas as Semanas</SelectItem>
                      {weekOptions.map((w, idx) => (
                        <SelectItem key={idx} value={w}>
                          {w.replace(/\.(docx|pdf)/i, '')}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Day of Week Filter */}
                <div className="w-[130px] shrink-0">
                  <Select value={selectedDay} onValueChange={setSelectedDay}>
                    <SelectTrigger className="h-8 text-xs bg-background/80 rounded-md w-full">
                      <SelectValue placeholder="Todos os Dias" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">Todos os Dias</SelectItem>
                      <SelectItem value="Segunda-feira">Segunda-feira</SelectItem>
                      <SelectItem value="Terça-feira">Terça-feira</SelectItem>
                      <SelectItem value="Quarta-feira">Quarta-feira</SelectItem>
                      <SelectItem value="Quinta-feira">Quinta-feira</SelectItem>
                      <SelectItem value="Sexta-feira">Sexta-feira</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Status Filter */}
                <div className="w-[130px] shrink-0">
                  <Select value={filterStatus} onValueChange={(val: any) => setFilterStatus(val)}>
                    <SelectTrigger className="h-8 text-xs bg-background/80 rounded-md w-full">
                      <SelectValue placeholder="Todos os Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">Todos Status</SelectItem>
                      <SelectItem value="SELECTED">Selecionadas</SelectItem>
                      <SelectItem value="PENDING">Pendentes</SelectItem>
                      <SelectItem value="COMPLETED">Concluídas</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Clear filters shortcut */}
                {(selectedWeek !== 'ALL' || selectedDay !== 'ALL' || filterStatus !== 'ALL' || searchQuery) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSelectedWeek('ALL');
                      setSelectedDay('ALL');
                      setFilterStatus('ALL');
                      setSearchQuery('');
                    }}
                    className="h-8 text-[11px] text-muted-foreground hover:text-foreground px-2 shrink-0"
                  >
                    Limpar filtros
                  </Button>
                )}
              </div>

              {/* Mass Selection */}
              <div className="flex items-center gap-1.5 self-end sm:self-auto shrink-0">
                <span className="text-[11px] text-muted-foreground mr-0.5">Seleção:</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleSelectAll(true)}
                  className="text-xs h-7.5 px-2.5 rounded-md bg-background/80 font-medium"
                >
                  Marcar Todas
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleSelectAll(false)}
                  className="text-xs h-7.5 px-2.5 rounded-md bg-background/80 font-medium text-muted-foreground"
                >
                  Desmarcar
                </Button>
              </div>
            </div>
          </div>

          {/* Activities List */}
          {filteredActivities.length === 0 ? (
            <div className="text-center py-16 px-4 border rounded-xl bg-card space-y-3">
              <CalendarDays className="w-12 h-12 text-muted-foreground mx-auto opacity-30" />
              <h3 className="text-base font-semibold">
                {activities.length === 0 ? 'Base de dados pronta para novas demandas' : 'Nenhuma atividade encontrada com os filtros atuais'}
              </h3>
              <p className="text-xs text-muted-foreground max-w-md mx-auto">
                {activities.length === 0
                  ? 'A base foi zerada com sucesso. Suba os novos arquivos DOCX ou PDF na aba ao lado para extrair as demandas automaticamente.'
                  : 'Ajuste os filtros acima ou limpe a busca para visualizar as demandas.'}
              </p>
              {activities.length === 0 && (
                <div className="flex items-center justify-center gap-2 pt-2">
                  <Button size="sm" onClick={() => setActiveTab('upload')} className="text-xs gap-1.5 font-semibold">
                    <Upload className="w-3.5 h-3.5" />
                    Subir Novos Arquivos (DOCX / PDF)
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setIsAddModalOpen(true)} className="text-xs gap-1.5">
                    <Plus className="w-3.5 h-3.5" />
                    Nova Demanda Manual
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-2.5 w-full min-w-0">
              {filteredActivities.map(act => {
                const isDone = completedIds.has(act.id);
                const isExpanded = !isDone || expandedIds.has(act.id);
                const descLength = (act.descricao || '').length;
                const isOverLimit = descLength > 1500;

                // Collapsed View for activities already launched in SGEDU
                if (isDone && !isExpanded) {
                  return (
                    <div
                      key={act.id}
                      onClick={() => toggleExpand(act.id)}
                      className={`group flex items-center justify-between gap-2.5 px-3 py-2 rounded-xl border transition-all duration-150 cursor-pointer w-full min-w-0 overflow-hidden ${
                        act.selecionado
                          ? 'border-emerald-500/30 bg-emerald-500/5 hover:bg-emerald-500/10'
                          : 'border-border/60 bg-muted/20 hover:bg-muted/40 opacity-75'
                      }`}
                    >
                      {/* Left side info */}
                      <div className="flex items-center gap-2 min-w-0 flex-1 overflow-hidden">
                        <div onClick={e => e.stopPropagation()} className="shrink-0">
                          <Checkbox
                            checked={act.selecionado}
                            onCheckedChange={() => toggleSelect(act.id)}
                            className="data-[state=checked]:bg-emerald-600 data-[state=checked]:border-emerald-600"
                          />
                        </div>

                        <Badge className="bg-emerald-600/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 text-[10px] py-0 px-1.5 font-semibold shrink-0">
                          ✓ Lançada
                        </Badge>

                        <span className="text-xs font-bold text-foreground shrink-0 hidden sm:inline">
                          {act.dia_semana}
                        </span>

                        <span className="text-xs font-mono font-medium text-muted-foreground shrink-0">
                          {act.data}
                        </span>

                        <Badge variant="outline" className="text-[10px] py-0 hidden lg:inline-flex shrink-0">
                          {act.local === 'UMEIEF GONÇALA RODRIGUES DE FREITAS' ? 'UMEIEF GONÇALA' : act.local}
                        </Badge>

                        <span className="text-xs font-medium text-foreground/85 truncate min-w-0 flex-1 group-hover:text-foreground" title={act.titulo}>
                          {act.titulo}
                        </span>
                      </div>

                      {/* Right side controls */}
                      <div className="flex items-center gap-1.5 shrink-0" onClick={e => e.stopPropagation()}>
                        <span className="text-[11px] text-muted-foreground truncate max-w-[140px] hidden xl:inline" title={act.origem_arquivo}>
                          {act.origem_arquivo}
                        </span>

                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleExpand(act.id)}
                          className="h-7 text-xs px-2 gap-1 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/15 shrink-0"
                          title="Expandir detalhes da demanda"
                        >
                          <ChevronDown className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">Expandir</span>
                        </Button>

                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteActivity(act.id)}
                          className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive shrink-0"
                          title="Remover atividade"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  );
                }

                // Full Expanded Card (for pending demands or expanded completed demands)
                return (
                  <Card
                    key={act.id}
                    className={`transition-all duration-200 border w-full min-w-0 overflow-hidden ${
                      act.selecionado ? 'border-primary/40 shadow-xs' : 'opacity-75 border-border'
                    } ${isDone ? 'bg-emerald-500/5 border-emerald-500/30' : 'bg-card'}`}
                  >
                    <CardHeader className="pb-2.5 pt-3.5 px-4 sm:px-6 min-w-0">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 min-w-0">
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <Checkbox
                            checked={act.selecionado}
                            onCheckedChange={() => toggleSelect(act.id)}
                            className="data-[state=checked]:bg-primary shrink-0"
                          />

                          <div className="flex items-center gap-2 flex-wrap min-w-0">
                            <Badge variant="outline" className="font-bold bg-background text-xs shrink-0">
                              {act.dia_semana}
                            </Badge>

                            {/* Editable Date */}
                            <Input
                              type="text"
                              value={act.data}
                              onChange={e => updateActivityField(act.id, 'data', e.target.value)}
                              className="h-7 w-28 text-xs font-mono font-semibold bg-background shrink-0"
                              placeholder="DD/MM/AAAA"
                            />

                            {/* Editable Local */}
                            <Select
                              value={act.local}
                              onValueChange={val => updateActivityField(act.id, 'local', val)}
                            >
                              <SelectTrigger className="h-7 text-xs w-44 bg-background font-medium shrink-0">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="UMEIEF GONÇALA RODRIGUES DE FREITAS">
                                  UMEIEF GONÇALA
                                </SelectItem>
                                <SelectItem value="SEDUC">SEDUC</SelectItem>
                              </SelectContent>
                            </Select>

                            {isDone && (
                              <Badge className="bg-emerald-500 text-white text-[10px] py-0 px-2 font-semibold shrink-0">
                                ✓ Lançado no SGEDU
                              </Badge>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                          {isDone && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => toggleExpand(act.id)}
                              className="h-7 text-xs px-2 gap-1 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/15"
                              title="Recolher demanda lançada"
                            >
                              <ChevronUp className="w-3.5 h-3.5" />
                              <span>Recolher</span>
                            </Button>
                          )}
                          <span className="text-[11px] text-muted-foreground truncate max-w-[180px] hidden md:inline" title={act.origem_arquivo}>
                            {act.origem_arquivo}
                          </span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteActivity(act.id)}
                            className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                            title="Remover atividade"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>

                    <CardContent className="space-y-2.5 px-4 sm:px-6 pb-3.5 min-w-0">
                      {/* Title Field */}
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground flex items-center justify-between">
                          <span>Título da Demanda</span>
                          <span className="text-[11px]">{(act.titulo || '').length}/100 caracteres</span>
                        </Label>
                        <Input
                          value={act.titulo}
                          maxLength={100}
                          onChange={e => updateActivityField(act.id, 'titulo', e.target.value)}
                          className="font-semibold text-xs bg-background h-8"
                        />
                      </div>

                      {/* Description Field */}
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>Descrição (Injeção no CKEditor)</span>
                          <span className={`text-[11px] font-mono ${isOverLimit ? 'text-destructive font-bold' : ''}`}>
                            {descLength}/1500 caracteres {isOverLimit && '(Excede o limite do SGEDU!)'}
                          </span>
                        </div>
                        <Textarea
                          value={act.descricao}
                          onChange={e => updateActivityField(act.id, 'descricao', e.target.value)}
                          rows={4}
                          className="text-xs font-sans leading-relaxed bg-background resize-y"
                        />
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* TAB 2: UPLOAD & EXTRAÇÃO DE ARQUIVOS */}
        <TabsContent value="upload" className="space-y-4 focus-visible:outline-none mt-0">
          <Card className="shadow-xs border-2 border-dashed">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2 text-primary">
                <Upload className="w-5 h-5" />
                Carregar Arquivos DOCX ou PDF
              </CardTitle>
              <CardDescription>
                Arraste os arquivos semanais da diretora. O extrator detecta viradas de mês, tabelas e recupera datas internas mesmo com erros de digitação no nome do arquivo.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div
                onDragOver={e => e.preventDefault()}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center text-center cursor-pointer hover:bg-primary/5 transition-colors"
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileSelect}
                  multiple
                  accept=".docx,.pdf"
                  className="hidden"
                />
                <div className="w-14 h-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mb-3 shadow-2xs">
                  <FileText className="w-7 h-7" />
                </div>
                <p className="font-bold text-sm">Clique aqui ou arraste seus arquivos DOCX / PDF</p>
                <p className="text-xs text-muted-foreground mt-1 max-w-md">
                  Suporta arquivos com múltiplos espaços, viradas de mês (ex: 31-08 a 04-09) e corrige automaticamente nomes digitados incorretamente.
                </p>
              </div>

              {uploadedFiles.length > 0 && (
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase text-muted-foreground">
                      Arquivos Prontos para Extração ({uploadedFiles.length})
                    </span>
                    <Button size="sm" onClick={handleExtractFiles} disabled={isExtracting} className="gap-2 text-xs font-bold">
                      <Sparkles className="w-4 h-4" />
                      {isExtracting ? 'Processando...' : 'Extrair Dados Agora'}
                    </Button>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {uploadedFiles.map((file, idx) => (
                      <Badge key={idx} variant="secondary" className="px-3 py-2 flex items-center gap-2 bg-muted">
                        <FileText className="w-4 h-4 text-primary" />
                        <span className="font-medium text-xs">{file.name}</span>
                        <span className="text-[10px] text-muted-foreground">({(file.size / 1024).toFixed(0)} KB)</span>
                        <button
                          onClick={e => {
                            e.stopPropagation();
                            setUploadedFiles(prev => prev.filter((_, i) => i !== idx));
                          }}
                          className="text-muted-foreground hover:text-destructive ml-1.5 font-bold"
                        >
                          ×
                        </button>
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {uploadWarnings.length > 0 && (
                <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3.5 text-xs text-amber-800 dark:text-amber-200 space-y-1.5">
                  <div className="font-bold flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                    Avisos de Processamento:
                  </div>
                  <ul className="list-disc pl-5 space-y-0.5 text-muted-foreground">
                    {uploadWarnings.map((w, idx) => (
                      <li key={idx}>{w}</li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 3: CORREÇÃO DE PORTUGUÊS */}
        <TabsContent value="portugues" className="space-y-4 focus-visible:outline-none mt-0">
          <Card className="border border-amber-500/30 bg-amber-500/5 shadow-xs">
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <div className="space-y-1">
                <CardTitle className="text-base font-bold flex items-center gap-2 text-amber-800 dark:text-amber-300">
                  <Sparkles className="w-5 h-5 text-amber-500" />
                  Área de Detecção e Correção de Erros de Português (Brasil)
                </CardTitle>
                <CardDescription className="text-xs">
                  Revisão ortográfica direcionada: acentuação de termos escolares (pedagógico, horário, infrequência), correção de digitações comuns e OCR.
                </CardDescription>
              </div>

              {spellingIssues.length > 0 && (
                <Button
                  size="sm"
                  onClick={handleAutoFixAll}
                  className="bg-amber-500 text-white hover:bg-amber-600 border-none shadow-xs text-xs font-bold"
                >
                  <Sparkles className="w-3.5 h-3.5 mr-1.5" />
                  Corrigir Todos ({spellingIssues.length})
                </Button>
              )}
            </CardHeader>

            <CardContent className="pt-0">
              {spellingIssues.length === 0 ? (
                <div className="flex items-center gap-3 p-4 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200 rounded-xl text-xs font-medium border border-emerald-500/20">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span>Nenhum erro ortográfico pendente! Todos os textos estão em conformidade com o padrão da Língua Portuguesa (Brasil).</span>
                </div>
              ) : (
                <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
                  {spellingIssues.map(issue => {
                    const act = activities.find(a => a.id === issue.activityId);
                    return (
                      <div
                        key={issue.id}
                        className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-card border rounded-xl text-xs shadow-2xs hover:border-amber-500/50 transition-colors"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge variant="outline" className="text-[10px] py-0 px-2 font-bold bg-background">
                              {act ? `${act.data} (${act.dia_semana})` : `Demanda #${issue.activityId}`}
                            </Badge>
                            <span className="font-bold text-destructive line-through">
                              {issue.originalWord}
                            </span>
                            <span className="text-muted-foreground">→</span>
                            <span className="font-bold text-emerald-600 dark:text-emerald-400">
                              {issue.suggestedWord}
                            </span>
                            {issue.explanation && (
                              <span className="text-[11px] text-muted-foreground">({issue.explanation})</span>
                            )}
                          </div>
                          <p className="text-muted-foreground italic text-[11px]">
                            Contexto: "{issue.context}"
                          </p>
                        </div>

                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => handleApplySpellingFix(issue)}
                          className="self-end sm:self-auto h-7 text-xs px-3 font-semibold"
                        >
                          Corrigir
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Modal: Lançar no SGEDU (Modo Assistido com Playwright) */}
      <Dialog open={isLaunchModalOpen} onOpenChange={setIsLaunchModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-primary font-bold">
              <Play className="w-5 h-5" />
              Lançamento Assistido no SGEDU
            </DialogTitle>
            <DialogDescription>
              Automação segura com conferência visual na tela do sistema SGEDU.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 text-sm text-foreground">
            <div className="bg-primary/10 border border-primary/20 rounded-xl p-3.5 text-xs space-y-2">
              <p className="font-bold text-primary">Como funciona este modo:</p>
              <ol className="list-decimal pl-4 space-y-1.5 text-muted-foreground">
                <li>O navegador Chromium abrirá visível na tela de cadastro de demandas.</li>
                <li>Os campos de <strong>Título</strong>, <strong>Data</strong>, <strong>Local</strong> e o <strong>CKEditor</strong> serão preenchidos automaticamente.</li>
                <li><strong>A automação aguarda você conferir e clicar manualmente em "Salvar" no SGEDU.</strong></li>
                <li>Ao clicar em Salvar, o script detecta a conclusão, avança para a próxima atividade e atualiza o progresso.</li>
              </ol>
            </div>

            <div className="border rounded-xl p-3.5 bg-muted/30 text-xs space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Total de demandas selecionadas:</span>
                <span className="font-bold text-foreground">{stats.selected} de {stats.total}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Demandas já concluídas no SGEDU:</span>
                <span className="font-semibold text-emerald-600 dark:text-emerald-400">{stats.completed}</span>
              </div>
              <div className="flex justify-between items-center pt-1 border-t">
                <span className="font-bold text-foreground">Prontas para lançar agora:</span>
                <span className="font-extrabold text-primary text-sm">{stats.pendingSelected}</span>
              </div>
            </div>

            {/* If all are completed, show reset message */}
            {stats.pendingSelected === 0 && stats.total > 0 ? (
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3.5 text-xs text-amber-800 dark:text-amber-200 space-y-2">
                <p className="font-bold flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-amber-500" />
                  Todas as atividades selecionadas já foram concluídas!
                </p>
                <p className="text-muted-foreground">
                  O progresso local indica que todas as {stats.total} demandas já foram salvas. Para lançar novamente ou realizar uma nova rodada de testes, você pode resetar o histórico.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    await handleResetProgress();
                    setIsLaunchModalOpen(false);
                  }}
                  className="w-full text-xs font-bold gap-2 mt-1 border-amber-500/40 text-amber-800 dark:text-amber-200"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Resetar Histórico e Liberar Lançamento
                </Button>
              </div>
            ) : (
              <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 text-xs text-emerald-800 dark:text-emerald-300 flex items-center gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span>Automação pronta e integrada. O navegador Chromium abrirá diretamente ao clicar abaixo.</span>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" size="sm" onClick={() => setIsLaunchModalOpen(false)}>
              Fechar
            </Button>
            <Button
              size="sm"
              onClick={handleStartAssistedLaunch}
              disabled={isLaunching || stats.pendingSelected === 0}
              className="bg-primary text-primary-foreground font-bold"
            >
              {isLaunching ? 'Abrindo Navegador...' : `Iniciar Lançamento (${stats.pendingSelected})`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: Adicionar Demanda Manual */}
      <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nova Demanda Manual</DialogTitle>
            <DialogDescription>
              Cadastre uma atividade individual para conferência e lançamento.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label className="text-xs">Data (DD/MM/AAAA)</Label>
              <Input
                value={newActivityData.data}
                onChange={e => setNewActivityData(prev => ({ ...prev, data: e.target.value }))}
                className="text-xs h-8"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Local</Label>
              <Select
                value={newActivityData.local}
                onValueChange={val => setNewActivityData(prev => ({ ...prev, local: val }))}
              >
                <SelectTrigger className="text-xs h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="UMEIEF GONÇALA RODRIGUES DE FREITAS">UMEIEF GONÇALA</SelectItem>
                  <SelectItem value="SEDUC">SEDUC</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Título</Label>
              <Input
                value={newActivityData.titulo}
                onChange={e => setNewActivityData(prev => ({ ...prev, titulo: e.target.value }))}
                className="text-xs h-8"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Descrição</Label>
              <Textarea
                value={newActivityData.descricao}
                onChange={e => setNewActivityData(prev => ({ ...prev, descricao: e.target.value }))}
                rows={5}
                className="text-xs"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setIsAddModalOpen(false)}>
              Cancelar
            </Button>
            <Button size="sm" onClick={handleAddManualActivity}>
              Adicionar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
