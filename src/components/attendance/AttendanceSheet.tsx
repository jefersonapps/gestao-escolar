import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import {
  Plus,
  Trash2,
  FileDown,
  Loader2,
  CalendarOff,
  CloudDownload,
  ClipboardPaste,
  Sparkles,
  Calendar as CalendarIcon,
  Check,
  X
} from 'lucide-react';
import { exportAttendancePdf, type AttendanceHoliday } from '@/lib/AttendancePdfExport';
import { useStore } from '@/store/useStore';
import { toast } from 'sonner';
import { SGEduImportDialog } from '../SGEduImportDialog';
import { useWorkspacePersistence } from '@/hooks/useWorkspacePersistence';
import { WorkspaceActions } from '@/components/workspace/WorkspaceActions';
import { parseStudentList } from '@/lib/utils';

interface AttendanceWorkspaceData {
  turma: string;
  professor: string;
  monthYear: string;
  students: string[];
  newName: string;
  holidays?: AttendanceHoliday[];
}

export function AttendanceSheet() {
  const now = new Date();
  const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const registeredClasses = useStore((s) => s.classes);
  const updateClassStudents = useStore((s) => s.updateClassStudents);

  const [turma, setTurma] = useState('');
  const [professor, setProfessor] = useState('');
  const [monthYear, setMonthYear] = useState(defaultMonth);
  const [students, setStudents] = useState<string[]>([]);
  const [newName, setNewName] = useState('');
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [isImportoSGEduOpen, setIsImportoSGEduOpen] = useState(false);
  const [isPasteDialogOpen, setIsPasteDialogOpen] = useState(false);
  const [pasteDialogText, setPasteDialogText] = useState('');
  const skipClassAutoLoadRef = useRef(false);

  // Holidays and stoppages state
  const [holidays, setHolidays] = useState<AttendanceHoliday[]>([]);
  const [isRange, setIsRange] = useState(false);
  const [holidayType, setHolidayType] = useState<'feriado' | 'paralisacao' | 'recesso' | 'outro'>('feriado');
  const [startDay, setStartDay] = useState<number>(1);
  const [endDay, setEndDay] = useState<number>(1);
  const [holidayDescription, setHolidayDescription] = useState<string>('');

  const [currentYear, currentMonth] = useMemo(() => {
    const parts = monthYear.split('-').map(Number);
    return [parts[0] || now.getFullYear(), parts[1] || now.getMonth() + 1];
  }, [monthYear, now]);

  const daysInCurrentMonth = useMemo(() => {
    return new Date(currentYear, currentMonth, 0).getDate();
  }, [currentYear, currentMonth]);

  // Adjust startDay / endDay if month changes and daysInCurrentMonth shrinks
  useEffect(() => {
    if (startDay > daysInCurrentMonth) setStartDay(daysInCurrentMonth);
    if (endDay > daysInCurrentMonth) setEndDay(daysInCurrentMonth);
  }, [daysInCurrentMonth, startDay, endDay]);

  const handleAddHoliday = useCallback(() => {
    const desc = holidayDescription.trim();
    if (!desc) {
      toast.error('Informe o nome ou motivo do feriado/paralisação.');
      return;
    }

    const sDay = Math.max(1, Math.min(startDay, daysInCurrentMonth));
    const eDay = isRange ? Math.max(sDay, Math.min(endDay, daysInCurrentMonth)) : sDay;

    const newHoliday: AttendanceHoliday = {
      id: `holiday-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      type: holidayType,
      startDay: sDay,
      endDay: eDay,
      description: desc,
    };

    setHolidays((prev) => [...prev, newHoliday]);
    setHolidayDescription('');
    toast.success(`Feriado/paralisação "${desc}" adicionado(a)!`);
  }, [holidayDescription, startDay, daysInCurrentMonth, isRange, endDay, holidayType]);

  const handleRemoveHoliday = useCallback((id: string) => {
    setHolidays((prev) => prev.filter((h) => h.id !== id));
  }, []);

  const handleQuickDayClick = (day: number) => {
    const existing = holidays.find((h) => day >= h.startDay && day <= h.endDay);
    if (existing) {
      handleRemoveHoliday(existing.id);
      toast.info(`Feriado "${existing.description}" removido do dia ${day}.`);
    } else {
      setStartDay(day);
      setEndDay(day);
      setIsRange(false);
      const inputEl = document.getElementById('holiday-desc-input');
      if (inputEl) {
        inputEl.focus();
      }
      toast.info(`Dia ${day} selecionado. Digite o motivo para cadastrar.`);
    }
  };

  const workspaceData = useMemo<AttendanceWorkspaceData>(
    () => ({ turma, professor, monthYear, students, newName, holidays }),
    [holidays, monthYear, newName, professor, students, turma],
  );

  const getWorkspaceName = useCallback(
    (data: AttendanceWorkspaceData) => `Frequencia_${data.turma || 'sem_turma'}_${data.monthYear || defaultMonth}`,
    [defaultMonth],
  );

  const restoreWorkspace = useCallback((data: AttendanceWorkspaceData) => {
    skipClassAutoLoadRef.current = true;
    setTurma(data.turma || '');
    setProfessor(data.professor || '');
    setMonthYear(data.monthYear || defaultMonth);
    setStudents(Array.isArray(data.students) ? data.students : []);
    setNewName(data.newName || '');
    setHolidays(Array.isArray(data.holidays) ? data.holidays : []);
  }, [defaultMonth]);

  const clearWorkspace = useCallback(() => {
    skipClassAutoLoadRef.current = true;
    setTurma('');
    setProfessor('');
    setMonthYear(defaultMonth);
    setStudents([]);
    setNewName('');
    setHolidays([]);
  }, [defaultMonth]);

  const workspace = useWorkspacePersistence({
    tabType: 'attendance',
    data: workspaceData,
    onRestore: restoreWorkspace,
    getDefaultName: getWorkspaceName,
    isDataEmpty: (data) =>
      !data.turma.trim() &&
      !data.professor.trim() &&
      data.monthYear === defaultMonth &&
      data.students.length === 0 &&
      !data.newName.trim() &&
      (!data.holidays || data.holidays.length === 0),
  });

  const [selectedSubStage, setSelectedSubStage] = useState<string>('all');

  // Auto-load students when class or selectedSubStage is selected
  useEffect(() => {
    if (skipClassAutoLoadRef.current) {
      skipClassAutoLoadRef.current = false;
      return;
    }

    if (!turma) return;

    const selectedClass = registeredClasses.find((c) => c.name === turma);

    if (selectedClass?.students && selectedClass.students.length > 0) {
      const filtered =
        selectedSubStage === 'all'
          ? selectedClass.students
          : selectedClass.students.filter((s) => s.stage === selectedSubStage);
      setStudents(filtered.map((s) => s.name));
    } else if (selectedClass) {
      setStudents([]);
    }
  }, [turma, registeredClasses, selectedSubStage]);

  const sortedStudents = useMemo(() => {
    return [...students].sort((a, b) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base' }));
  }, [students]);

  const addStudent = useCallback(() => {
    const name = newName.trim();
    if (name && !students.includes(name)) {
      setStudents((prev) => [...prev, name]);
      setNewName('');
    }
  }, [newName, students]);

  const updateStudentName = useCallback((index: number, updatedName: string) => {
    setStudents((prev) => {
      const currentSorted = [...prev].sort((a, b) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base' }));
      const originalName = currentSorted[index];
      return prev.map((n) => (n === originalName ? updatedName : n));
    });
  }, []);

  const removeStudent = useCallback(
    (index: number) => {
      const nameToRemove = sortedStudents[index];
      setStudents((prev) => prev.filter((n) => n !== nameToRemove));
    },
    [sortedStudents],
  );

  const clearStudentsList = useCallback(() => {
    if (students.length === 0) return;
    setStudents([]);
    toast.info('Lista de alunos limpa.');
  }, [students.length]);

  const applyPastedText = useCallback((rawText: string) => {
    const parsedNames = parseStudentList(rawText);
    if (parsedNames.length > 0) {
      setStudents((prev) => {
        const set = new Set(prev);
        parsedNames.forEach((n) => set.add(n));
        return Array.from(set);
      });
      toast.success(`${parsedNames.length} aluno(s) adicionado(s) à folha de frequência.`);
    } else {
      toast.warning('Nenhum nome de aluno válido foi identificado no texto colado.');
    }
  }, []);

  const handleDialogPasteImport = () => {
    if (!pasteDialogText.trim()) return;
    applyPastedText(pasteDialogText);
    setPasteDialogText('');
    setIsPasteDialogOpen(false);
  };

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        addStudent();
      }
    },
    [addStudent],
  );

  const handleExportPdf = useCallback(async () => {
    if (sortedStudents.length === 0) return;
    const [year, month] = monthYear.split('-').map(Number);
    const exportTurmaTitle = selectedSubStage !== 'all' ? `${turma} (${selectedSubStage})` : turma;
    await exportAttendancePdf({
      turma: exportTurmaTitle,
      professor,
      month,
      year,
      students: sortedStudents,
      holidays,
    });
  }, [turma, professor, monthYear, sortedStudents, selectedSubStage, holidays]);

  const handleSGEduImport = (
    importedStudents: import('@/types').Student[],
    importedProfessor?: string,
    importedClassName?: string,
  ) => {
    const studentNames = importedStudents.map((s) => s.name);
    setStudents(studentNames);

    if (importedProfessor) setProfessor(importedProfessor);

    let targetClass = turma;
    if (importedClassName) {
      // Remove trailing year like " - 2026", " - 2025" from the class name
      const cleanClassName = importedClassName.replace(/\s*-\s*\d{4}\s*$/g, '').trim();
      setTurma(cleanClassName);
      targetClass = cleanClassName;
    }

    if (targetClass) {
      const classGroup = registeredClasses.find(
        (c) => c.name === targetClass || c.name.replace(/\s*-\s*\d{4}\s*$/g, '').trim() === targetClass
      );
      if (classGroup) {
        updateClassStudents(classGroup.id, importedStudents);
        toast.success(`Lista de alunos salva para a turma ${targetClass}`);
      } else {
        toast.info('Lista importada, mas a turma não está cadastrada para salvamento automático.');
      }
    }
  };

  const daysInfo = useMemo(() => {
    const DOW_LETTERS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
    return Array.from({ length: daysInCurrentMonth }, (_, i) => {
      const day = i + 1;
      const dow = new Date(currentYear, currentMonth - 1, day).getDay();
      const isWeekend = dow === 0 || dow === 6;
      const holiday = holidays.find((h) => day >= h.startDay && day <= h.endDay);
      const label = isWeekend ? DOW_LETTERS[dow] : String(day);
      return {
        day,
        dow,
        isWeekend,
        holiday,
        label,
      };
    });
  }, [daysInCurrentMonth, currentYear, currentMonth, holidays]);

  return (
    <div className="space-y-6">
      <WorkspaceActions
        tabType="attendance"
        controller={workspace}
        defaultName={getWorkspaceName(workspaceData)}
        onClearData={clearWorkspace}
      />

      {/* Header Info & Configuration */}
      <Card className="border-border/60 shadow-xs">
        <CardHeader className="pb-3">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <CalendarIcon className="w-5 h-5 text-primary" />
                Folha de Frequência Mensal
              </CardTitle>
              <CardDescription>
                Configure os dados da turma, visualize os dias letivos e feriados em tempo real e gere o PDF.
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => setIsPasteDialogOpen(true)}>
                <ClipboardPaste className="w-4 h-4 mr-1.5 text-primary" />
                Colar Alunos
              </Button>
              <Button variant="outline" size="sm" onClick={() => setIsImportoSGEduOpen(true)}>
                <CloudDownload className="w-4 h-4 mr-1.5 text-blue-600" />
                Importar SGEdu
              </Button>
              {students.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={clearStudentsList}
                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="w-4 h-4 mr-1.5" />
                  Limpar Alunos
                </Button>
              )}
              <Button
                size="sm"
                onClick={async () => {
                  try {
                    setIsGeneratingPdf(true);
                    await handleExportPdf();
                    toast.success('PDF gerado com sucesso!');
                  } catch (error) {
                    console.error(error);
                    toast.error('Erro ao gerar PDF: ' + (error instanceof Error ? error.message : String(error)));
                  } finally {
                    setIsGeneratingPdf(false);
                  }
                }}
                disabled={sortedStudents.length === 0 || isGeneratingPdf}
                className="bg-primary text-primary-foreground font-semibold shadow-sm"
              >
                {isGeneratingPdf ? (
                  <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                ) : (
                  <FileDown className="w-4 h-4 mr-1.5" />
                )}
                {isGeneratingPdf ? 'Gerando...' : 'Gerar PDF'}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="turma">Turma</Label>
              {registeredClasses.length > 0 ? (
                <div className="flex gap-2">
                  <Select
                    value={registeredClasses.some((c) => c.name === turma) ? turma : ''}
                    onValueChange={(val) => {
                      setTurma(val);
                      setSelectedSubStage('all');
                    }}
                  >
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Selecionar turma" />
                    </SelectTrigger>
                    <SelectContent>
                      {registeredClasses.map((c) => (
                        <SelectItem key={c.id} value={c.name}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <span className="self-center text-xs text-muted-foreground">ou</span>
                  <Input
                    id="turma"
                    placeholder="Digitar"
                    value={registeredClasses.some((c) => c.name === turma) ? '' : turma}
                    onChange={(e) => setTurma(e.target.value)}
                    className="flex-1"
                  />
                </div>
              ) : (
                <Input
                  id="turma"
                  placeholder="Ex: 1º ANO A"
                  value={turma}
                  onChange={(e) => setTurma(e.target.value)}
                />
              )}

              {(() => {
                const currentClass = registeredClasses.find((c) => c.name === turma);
                if (!currentClass) return null;
                const stagesInClass = Array.from(
                  new Set([
                    ...(currentClass.subStages || []),
                    ...(currentClass.students || []).map((s) => s.stage).filter(Boolean) as string[],
                  ]),
                );
                if (stagesInClass.length === 0) return null;

                return (
                  <div className="flex items-center gap-1 mt-2 bg-muted/40 p-1.5 rounded-md border">
                    <span className="text-xs font-semibold mr-1 text-muted-foreground">Aba / Etapa:</span>
                    <button
                      type="button"
                      className={`px-2.5 py-1 text-xs font-medium rounded transition-colors ${selectedSubStage === 'all' ? 'bg-primary text-primary-foreground shadow-sm' : 'bg-background hover:bg-muted text-foreground'}`}
                      onClick={() => setSelectedSubStage('all')}
                    >
                      Todas ({currentClass.students?.length || 0})
                    </button>
                    {stagesInClass.map((st) => {
                      const count = (currentClass.students || []).filter((s) => s.stage === st).length;
                      return (
                        <button
                          key={st}
                          type="button"
                          className={`px-2.5 py-1 text-xs font-medium rounded transition-colors ${selectedSubStage === st ? 'bg-primary text-primary-foreground shadow-sm' : 'bg-background hover:bg-muted text-foreground'}`}
                          onClick={() => setSelectedSubStage(st)}
                        >
                          {st} ({count})
                        </button>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="professor">Professor(a)</Label>
              <Input
                id="professor"
                placeholder="Nome do(a) professor(a)"
                value={professor}
                onChange={(e) => setProfessor(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="monthYear">Mês / Ano</Label>
              <Input
                id="monthYear"
                type="month"
                value={monthYear}
                onChange={(e) => setMonthYear(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Feriados e Paralisações Bar */}
      <Card className="border-border/60 shadow-xs bg-rose-50/20 dark:bg-rose-950/10">
        <CardHeader className="py-3 px-4 flex flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <CalendarOff className="w-4 h-4 text-rose-500" />
            <CardTitle className="text-sm font-semibold">
              Feriados e Paralisações ({holidays.length})
            </CardTitle>
            <span className="text-xs text-muted-foreground hidden sm:inline">
              (Destacados em vermelho pastel com texto vertical no PDF)
            </span>
          </div>
          {holidays.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={() => {
                setHolidays([]);
                toast.info('Lista de feriados limpa.');
              }}
            >
              <Trash2 className="w-3.5 h-3.5 mr-1" />
              Limpar
            </Button>
          )}
        </CardHeader>
        <CardContent className="px-4 pb-3 pt-0 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-2.5 items-end bg-background/80 p-2.5 rounded-lg border">
            <div className="md:col-span-2 space-y-1">
              <Label className="text-xs">Tipo</Label>
              <Select value={holidayType} onValueChange={(val: any) => setHolidayType(val)}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="feriado">Feriado</SelectItem>
                  <SelectItem value="paralisacao">Paralisação</SelectItem>
                  <SelectItem value="recesso">Recesso</SelectItem>
                  <SelectItem value="outro">Outro</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="md:col-span-2 space-y-1">
              <Label className="text-xs">Formato</Label>
              <div className="flex rounded-md border bg-muted/40 p-0.5 h-8 items-center">
                <button
                  type="button"
                  className={`flex-1 h-7 text-xs font-medium rounded transition-colors ${!isRange ? 'bg-primary text-primary-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'}`}
                  onClick={() => setIsRange(false)}
                >
                  Único
                </button>
                <button
                  type="button"
                  className={`flex-1 h-7 text-xs font-medium rounded transition-colors ${isRange ? 'bg-primary text-primary-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'}`}
                  onClick={() => {
                    setIsRange(true);
                    if (endDay < startDay) setEndDay(startDay);
                  }}
                >
                  Intervalo
                </button>
              </div>
            </div>

            {!isRange ? (
              <div className="md:col-span-2 space-y-1">
                <Label className="text-xs">Dia do Mês</Label>
                <Select value={String(startDay)} onValueChange={(val) => setStartDay(Number(val))}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="max-h-56">
                    {Array.from({ length: daysInCurrentMonth }, (_, i) => i + 1).map((d) => (
                      <SelectItem key={d} value={String(d)}>
                        Dia {d}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <>
                <div className="md:col-span-1 space-y-1">
                  <Label className="text-xs">De</Label>
                  <Select
                    value={String(startDay)}
                    onValueChange={(val) => {
                      const valNum = Number(val);
                      setStartDay(valNum);
                      if (endDay < valNum) setEndDay(valNum);
                    }}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="max-h-56">
                      {Array.from({ length: daysInCurrentMonth }, (_, i) => i + 1).map((d) => (
                        <SelectItem key={d} value={String(d)}>
                          {d}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="md:col-span-1 space-y-1">
                  <Label className="text-xs">Até</Label>
                  <Select value={String(endDay)} onValueChange={(val) => setEndDay(Number(val))}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="max-h-56">
                      {Array.from({ length: daysInCurrentMonth }, (_, i) => i + 1)
                        .filter((d) => d >= startDay)
                        .map((d) => (
                          <SelectItem key={d} value={String(d)}>
                            {d}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            <div className="md:col-span-4 space-y-1">
              <Label className="text-xs">Descrição / Motivo</Label>
              <Input
                id="holiday-desc-input"
                className="h-8 text-xs"
                placeholder="Ex: Feriado Municipal, Paralisação..."
                value={holidayDescription}
                onChange={(e) => setHolidayDescription(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddHoliday();
                  }
                }}
              />
            </div>

            <div className="md:col-span-2">
              <Button onClick={handleAddHoliday} className="w-full h-8 text-xs" variant="default">
                <Plus className="w-3.5 h-3.5 mr-1" />
                Adicionar
              </Button>
            </div>
          </div>

          {/* Active holiday chips */}
          {holidays.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-0.5">
              {holidays.map((h) => {
                const dayLabel = h.startDay === h.endDay ? `Dia ${h.startDay}` : `Dias ${h.startDay} a ${h.endDay}`;
                const typeLabel =
                  h.type === 'paralisacao'
                    ? 'Paralisação'
                    : h.type === 'recesso'
                      ? 'Recesso'
                      : h.type === 'feriado'
                        ? 'Feriado'
                        : 'Outro';
                return (
                  <div
                    key={h.id}
                    className="flex items-center gap-1.5 bg-rose-100/80 dark:bg-rose-950/50 text-rose-900 dark:text-rose-200 border border-rose-300 dark:border-rose-800 px-2.5 py-1 rounded-md text-xs"
                  >
                    <span className="font-semibold">
                      [{typeLabel}] {dayLabel}:
                    </span>
                    <span>{h.description}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveHoliday(h.id)}
                      className="ml-1 text-rose-600 hover:text-rose-950 dark:text-rose-400 dark:hover:text-rose-100 transition-colors"
                      title="Remover feriado"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Main Interactive Spreadsheet View */}
      <Card className="border-border/70 shadow-sm overflow-hidden">
        <CardHeader className="py-3 px-4 bg-muted/20 border-b flex flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm">Folha de Frequência</span>
            <span className="text-xs bg-primary/10 text-primary font-medium px-2 py-0.5 rounded-full">
              {sortedStudents.length} {sortedStudents.length === 1 ? 'aluno' : 'alunos'}
            </span>
          </div>
          <span className="text-xs text-muted-foreground hidden md:inline">
            Clique no cabeçalho de um dia para marcar/desmarcar feriado, ou edite os nomes dos alunos diretamente na tabela.
          </span>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto w-full">
            <table className="w-full text-xs border-collapse border-spacing-0">
              <thead>
                <tr className="border-b bg-muted/40 divide-x divide-border/60">
                  <th className="w-10 min-w-10 max-w-10 py-2 px-1 text-center font-bold text-muted-foreground bg-muted/50">
                    Nº
                  </th>
                  <th className="w-64 min-w-56 max-w-72 py-2 px-3 text-left font-bold text-foreground bg-muted/50">
                    NOME DO ESTUDANTE
                  </th>
                  {daysInfo.map((info) => {
                    let headerBgClass = 'bg-[#dcfce7] text-[#166534] dark:bg-[#166534]/30 dark:text-[#bbf7d0]'; // Pale green
                    if (info.holiday) {
                      headerBgClass = 'bg-[#fee2e2] text-[#991b1b] dark:bg-[#991b1b]/40 dark:text-[#fecaca]'; // Pastel Red
                    } else if (info.isWeekend) {
                      headerBgClass = 'bg-[#ffedd5] text-[#9a3412] dark:bg-[#7c2d12]/30 dark:text-[#fed7aa]'; // Pastel Orange
                    }

                    return (
                      <th
                        key={info.day}
                        onClick={() => handleQuickDayClick(info.day)}
                        title={
                          info.holiday
                            ? `${info.holiday.description} (Clique para remover)`
                            : `Dia ${info.day} (Clique para marcar feriado)`
                        }
                        className={`w-7 min-w-7 max-w-7 py-1 px-0.5 text-center font-bold select-none cursor-pointer transition-opacity hover:opacity-80 ${headerBgClass}`}
                      >
                        <div className="flex flex-col items-center justify-center leading-tight">
                          <span>{info.label}</span>
                          {info.holiday && (
                            <span className="w-1 h-1 rounded-full bg-rose-600 mt-0.5" />
                          )}
                        </div>
                      </th>
                    );
                  })}
                  <th className="w-9 min-w-9 py-2 px-1 text-center font-medium bg-muted/50"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {sortedStudents.length === 0 ? (
                  <tr>
                    <td
                      colSpan={daysInfo.length + 3}
                      className="py-12 text-center text-muted-foreground bg-muted/5"
                    >
                      <div className="flex flex-col items-center justify-center gap-2">
                        <Sparkles className="w-8 h-8 text-muted-foreground/40" />
                        <p className="font-medium text-sm">Nenhum aluno na folha de frequência</p>
                        <p className="text-xs">
                          Cole a lista copiada do SGEdu, importe automaticamente ou digite o nome do aluno abaixo.
                        </p>
                        <div className="flex gap-2 mt-2">
                          <Button size="sm" variant="outline" onClick={() => setIsPasteDialogOpen(true)}>
                            <ClipboardPaste className="w-4 h-4 mr-1.5" />
                            Colar Lista
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => setIsImportoSGEduOpen(true)}>
                            <CloudDownload className="w-4 h-4 mr-1.5" />
                            Importar SGEdu
                          </Button>
                        </div>
                      </div>
                    </td>
                  </tr>
                ) : (
                  sortedStudents.map((studentName, i) => (
                    <tr
                      key={`${studentName}-${i}`}
                      className="hover:bg-muted/30 transition-colors group divide-x divide-border/40"
                    >
                      <td className="w-10 min-w-10 max-w-10 py-1.5 px-1 text-center text-muted-foreground font-medium bg-background">
                        {i + 1}
                      </td>
                      <td className="w-64 min-w-56 max-w-72 py-1 px-2 bg-background">
                        <Input
                          value={studentName}
                          onChange={(e) => updateStudentName(i, e.target.value)}
                          className="h-7 text-xs border-transparent hover:border-input focus:border-input bg-transparent px-2 shadow-none font-medium"
                          title="Clique para editar o nome do estudante"
                        />
                      </td>
                      {daysInfo.map((info) => {
                        let cellBg = 'bg-background';
                        if (info.holiday) {
                          cellBg = 'bg-[#fee2e2]/60 dark:bg-[#991b1b]/20';
                        } else if (info.isWeekend) {
                          cellBg = 'bg-[#ffedd5]/60 dark:bg-[#7c2d12]/20';
                        }

                        return (
                          <td
                            key={info.day}
                            title={info.holiday ? `${info.holiday.description}` : undefined}
                            className={`w-7 min-w-7 max-w-7 p-0 text-center ${cellBg}`}
                          >
                            <span className="inline-block w-full h-full min-h-6" />
                          </td>
                        );
                      })}
                      <td className="w-9 min-w-9 p-1 text-center bg-background">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-muted-foreground hover:text-destructive opacity-40 group-hover:opacity-100 transition-opacity"
                          onClick={() => removeStudent(i)}
                          title="Excluir aluno"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </td>
                    </tr>
                  ))
                )}

                {/* Bottom Quick-Add Row */}
                <tr className="bg-muted/15 border-t-2 border-border/60 divide-x divide-border/40">
                  <td className="w-10 min-w-10 max-w-10 py-2 px-1 text-center text-primary font-bold bg-background">
                    +
                  </td>
                  <td className="w-64 min-w-56 max-w-72 py-1 px-2 bg-background">
                    <div className="flex gap-1.5 items-center">
                      <Input
                        placeholder="Digitar nome do aluno e teclar Enter..."
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        onKeyDown={handleKeyDown}
                        className="h-7 text-xs flex-1 shadow-none"
                      />
                      <Button onClick={addStudent} size="icon" variant="outline" className="h-7 w-7 shrink-0">
                        <Plus className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </td>
                  {daysInfo.map((info) => {
                    let cellBg = 'bg-muted/10';
                    if (info.holiday) {
                      cellBg = 'bg-[#fee2e2]/40 dark:bg-[#991b1b]/15';
                    } else if (info.isWeekend) {
                      cellBg = 'bg-[#ffedd5]/40 dark:bg-[#7c2d12]/15';
                    }
                    return <td key={info.day} className={`w-7 min-w-7 max-w-7 ${cellBg}`} />;
                  })}
                  <td className="w-9 min-w-9 bg-background" />
                </tr>
              </tbody>
            </table>
          </div>

          {/* Visual Legend Footer & Bottom Actions */}
          <div className="p-3 bg-muted/20 border-t flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex flex-wrap items-center gap-4 text-muted-foreground">
              <span className="font-semibold text-foreground">LEGENDA DO PDF:</span>
              <span>• = Presença</span>
              <span>F = Falta</span>
              <span>A = Atestado</span>
              <span>Fj = Falta justificada</span>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-3.5 h-3.5 rounded bg-[#ffedd5] border border-orange-300 inline-block" />
                <span className="text-muted-foreground">Sábado / Domingo</span>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-3.5 h-3.5 rounded bg-[#dcfce7] border border-emerald-300 inline-block" />
                <span className="text-muted-foreground">Dias Letivos</span>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-3.5 h-3.5 rounded bg-[#fee2e2] border border-rose-300 inline-block" />
                <span className="text-muted-foreground">Feriado / Paralisação</span>
              </span>
            </div>
          </div>

          <div className="p-3 bg-background border-t flex justify-end">
            <Button
              onClick={async () => {
                try {
                  setIsGeneratingPdf(true);
                  await handleExportPdf();
                  toast.success('PDF gerado com sucesso!');
                } catch (error) {
                  console.error(error);
                  toast.error('Erro ao gerar PDF: ' + (error instanceof Error ? error.message : String(error)));
                } finally {
                  setIsGeneratingPdf(false);
                }
              }}
              disabled={isGeneratingPdf || sortedStudents.length === 0}
              className="gap-2"
            >
              {isGeneratingPdf ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Gerando PDF...
                </>
              ) : (
                <>
                  <FileDown className="w-4 h-4" />
                  Gerar PDF
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Paste Dialog */}
      <Dialog open={isPasteDialogOpen} onOpenChange={setIsPasteDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ClipboardPaste className="w-5 h-5 text-primary" />
              Colar Lista de Alunos
            </DialogTitle>
            <DialogDescription>
              Cole a lista copiada do SGEdu ou sistema educacional. Números, fotos e alunos transferidos serão
              tratados automaticamente.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2 space-y-2">
            <textarea
              className="w-full h-44 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none font-mono text-xs"
              placeholder={`Exemplo de colagem do SGEdu:\n1  Anna Lívia Rodrigues de Queiroz\n2  Antony Daniel de Oliveira Quirino\n3  Daniele Silva\n...`}
              value={pasteDialogText}
              onChange={(e) => setPasteDialogText(e.target.value)}
              autoFocus
            />
            {pasteDialogText.trim() && (
              <p className="text-xs text-muted-foreground">
                Alunos detectados:{' '}
                <strong className="text-primary">{parseStudentList(pasteDialogText).length}</strong>
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsPasteDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleDialogPasteImport} disabled={!pasteDialogText.trim()}>
              <Check className="w-4 h-4 mr-1.5" />
              Adicionar à Folha
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* SGEdu Direct Import Dialog */}
      <SGEduImportDialog
        isOpen={isImportoSGEduOpen}
        onClose={() => setIsImportoSGEduOpen(false)}
        onImport={handleSGEduImport}
        mode="attendance"
      />
    </div>
  );
}
