import { useMemo, useState } from 'react';
import {
  BarChart3,
  ChevronLeft,
  ChevronRight,
  ClipboardPaste,
  FileDown,
  FileImage,
  Loader2,
  Plus,
  Trash2,
  Upload,
  Users,
} from 'lucide-react';
import { toast } from 'sonner';

import { SGEduImportDialog } from '@/components/SGEduImportDialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import {
  generateReadingChartPng,
  generateReadingChartPresentation,
  getReadingSummary,
  normalizeReadingLevel,
  READING_LEVELS,
  type CustomChartClass,
  type CustomChartStudent,
  type ReadingLevelId,
} from '@/services/customChartGenerator';
import type { Student } from '@/types';

type ExportFormat = 'pptx' | 'png';

interface ChartClassDraft extends CustomChartClass {
  pastedNames: string;
}

const createStudent = (name = '', levelId: ReadingLevelId = 'nao_informado'): CustomChartStudent => ({
  id: crypto.randomUUID(),
  name,
  levelId,
});

const createClassDraft = (index: number): ChartClassDraft => ({
  id: crypto.randomUUID(),
  name: `Turma ${index}`,
  students: [createStudent()],
  pastedNames: '',
});

const getCurrentYear = () => new Date().getFullYear();

const chartTypes = [
  {
    id: 'reading-level',
    label: 'Nível de leitura',
    description: 'Distribuição horizontal empilhada com tabela de totais.',
  },
];

const parseNamesFromText = (text: string) =>
  text
    .split(/\r?\n/)
    .map((line) => {
      const cells = line.split(/\t|;/).map((cell) => cell.trim()).filter(Boolean);
      return cells[0] || line.trim();
    })
    .map((name) => name.replace(/\s+/g, ' ').trim())
    .filter(Boolean);

const preparedClasses = (classes: ChartClassDraft[]): CustomChartClass[] =>
  classes
    .map((classData) => ({
      id: classData.id,
      name: classData.name.trim() || 'Turma sem nome',
      students: classData.students
        .map((student) => ({ ...student, name: student.name.trim() }))
        .filter((student) => student.name),
    }))
    .filter((classData) => classData.students.length > 0);

function ReadingChartPreview({ classData, editionLabel }: { classData: CustomChartClass; editionLabel: string }) {
  const summary = getReadingSummary(classData.students);

  return (
    <div className="h-full overflow-auto bg-background p-4 md:p-6">
      <div className="mx-auto max-w-5xl rounded-md border bg-white text-slate-700 shadow-sm">
        <div className="px-6 pt-8 text-center">
          <h3 className="text-xl font-bold leading-snug text-slate-800">
            Gráfico de Nível de Leitura - {classData.name}
          </h3>
        </div>

        <div className="px-5 pt-8 pb-5">
          <div className="grid grid-cols-[150px_1fr] items-center gap-4 xl:grid-cols-[180px_1fr]">
            <div className="text-sm font-semibold text-slate-500">{editionLabel}</div>
            <div className="flex h-24 overflow-hidden border border-white bg-slate-100">
              {READING_LEVELS.map((level) => {
                const count = summary.counts[level.id];
                const pct = summary.total > 0 ? (count / summary.total) * 100 : 0;
                if (pct <= 0) return null;

                return (
                  <div
                    key={level.id}
                    className="flex min-w-8 items-center justify-center text-xs font-bold text-white shadow-[inset_1px_0_rgba(255,255,255,0.35)]"
                    style={{
                      width: `${pct}%`,
                      backgroundColor: `#${level.color}`,
                    }}
                    title={`${level.label}: ${count} (${pct.toFixed(1)}%)`}
                  >
                    {pct >= 4 ? `${Math.round(pct)}%` : ''}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-8 flex flex-wrap justify-center gap-x-5 gap-y-3 text-sm font-semibold">
            {READING_LEVELS.map((level) => (
              <div key={level.id} className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full" style={{ backgroundColor: `#${level.color}` }} />
                <span>{level.label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="px-5 pb-8">
          <div className="w-full overflow-hidden">
            <table className="w-full table-fixed border-collapse text-center text-[11px] leading-tight md:text-xs">
              <colgroup>
                <col className="w-[18%]" />
                <col className="w-[10%]" />
                {READING_LEVELS.map((level) => (
                  <col key={level.id} className="w-[9%]" />
                ))}
              </colgroup>
              <thead>
                <tr className="text-slate-700">
                  <th className="break-words border-r border-emerald-100 px-1.5 py-3 text-left">Edições</th>
                  <th className="break-words border-r border-emerald-100 px-1.5 py-3">Total de Alunos</th>
                  {READING_LEVELS.map((level) => (
                    <th key={level.id} className="break-words border-r border-emerald-100 px-1.5 py-3 last:border-r-0">
                      {level.shortLabel}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="break-words border-r border-emerald-100 px-1.5 py-3 text-left font-semibold">{editionLabel}</td>
                  <td className="border-r border-emerald-100 px-1.5 py-3">{summary.total}</td>
                  {READING_LEVELS.map((level) => {
                    const count = summary.counts[level.id];
                    const pct = summary.total > 0 ? ((count / summary.total) * 100).toFixed(1) : '0.0';
                    return (
                      <td key={level.id} className="border-r border-emerald-100 px-1.5 py-3 last:border-r-0">
                        <div>{count}</div>
                        <div>({pct}%)</div>
                      </td>
                    );
                  })}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

export function CustomChartsControl() {
  const [classes, setClasses] = useState<ChartClassDraft[]>([createClassDraft(1)]);
  const [selectedClassId, setSelectedClassId] = useState(classes[0].id);
  const [chartType] = useState(chartTypes[0].id);
  const [reportTitle, setReportTitle] = useState(`${getCurrentYear()} - Nível de Leitura`);
  const [editionLabel, setEditionLabel] = useState(`${getCurrentYear()} - Av. Diagnóstica`);
  const [importTargetClassId, setImportTargetClassId] = useState<string | null>(null);
  const [exporting, setExporting] = useState<ExportFormat | null>(null);

  const selectedClass = classes.find((classData) => classData.id === selectedClassId) || classes[0];

  const cleanClasses = useMemo(() => preparedClasses(classes), [classes]);
  const previewClass = useMemo(
    () => cleanClasses.find((classData) => classData.id === selectedClass?.id) || cleanClasses[0],
    [cleanClasses, selectedClass?.id],
  );
  const previewClassIndex = previewClass ? cleanClasses.findIndex((classData) => classData.id === previewClass.id) : -1;
  const previewPosition = previewClassIndex >= 0 ? previewClassIndex + 1 : 0;

  const goToPreviewClass = (direction: 'previous' | 'next') => {
    if (cleanClasses.length === 0 || previewClassIndex < 0) return;

    const nextIndex =
      direction === 'next'
        ? (previewClassIndex + 1) % cleanClasses.length
        : (previewClassIndex - 1 + cleanClasses.length) % cleanClasses.length;

    setSelectedClassId(cleanClasses[nextIndex].id);
  };

  const updateClass = (classId: string, updater: (classData: ChartClassDraft) => ChartClassDraft) => {
    setClasses((current) => current.map((classData) => (classData.id === classId ? updater(classData) : classData)));
  };

  const addClass = () => {
    const newClass = createClassDraft(classes.length + 1);
    setClasses((current) => [...current, newClass]);
    setSelectedClassId(newClass.id);
  };

  const removeClass = (classId: string) => {
    if (classes.length === 1) {
      toast.warning('Mantenha pelo menos uma turma.');
      return;
    }

    setClasses((current) => {
      const next = current.filter((classData) => classData.id !== classId);
      if (selectedClassId === classId) {
        setSelectedClassId(next[0].id);
      }
      return next;
    });
  };

  const addStudent = (classId: string) => {
    updateClass(classId, (classData) => ({
      ...classData,
      students: [...classData.students, createStudent()],
    }));
  };

  const removeStudent = (classId: string, studentId: string) => {
    updateClass(classId, (classData) => ({
      ...classData,
      students:
        classData.students.length > 1
          ? classData.students.filter((student) => student.id !== studentId)
          : [createStudent()],
    }));
  };

  const updateStudent = (
    classId: string,
    studentId: string,
    updates: Partial<Pick<CustomChartStudent, 'name' | 'levelId'>>,
  ) => {
    updateClass(classId, (classData) => ({
      ...classData,
      students: classData.students.map((student) => (student.id === studentId ? { ...student, ...updates } : student)),
    }));
  };

  const pasteNamesIntoClass = (classId: string) => {
    const classData = classes.find((item) => item.id === classId);
    if (!classData) return;

    const names = parseNamesFromText(classData.pastedNames);
    if (names.length === 0) {
      toast.error('Cole pelo menos um nome de aluno.');
      return;
    }

    const imported = names.map((name) => createStudent(name, 'nao_informado'));
    updateClass(classId, (item) => ({
      ...item,
      students: item.students.length === 1 && !item.students[0].name.trim() ? imported : [...item.students, ...imported],
      pastedNames: '',
    }));
    toast.success(`${names.length} aluno(s) adicionados.`);
  };

  const handleImportFromSGEdu = (students: Student[], _professor?: string, className?: string) => {
    if (!importTargetClassId) return;

    const importedStudents = students.map((student) => createStudent(student.name, 'nao_informado'));
    updateClass(importTargetClassId, (classData) => ({
      ...classData,
      name: className || classData.name,
      students: importedStudents.length > 0 ? importedStudents : classData.students,
    }));
    setSelectedClassId(importTargetClassId);
    setImportTargetClassId(null);
  };

  const validateBeforeExport = () => {
    if (!reportTitle.trim()) {
      toast.error('Informe o título do gráfico.');
      return false;
    }

    if (!editionLabel.trim()) {
      toast.error('Informe o nome da edição.');
      return false;
    }

    if (cleanClasses.length === 0) {
      toast.error('Adicione alunos em pelo menos uma turma.');
      return false;
    }

    return true;
  };

  const handleExport = async (format: ExportFormat) => {
    if (!validateBeforeExport()) return;

    setExporting(format);
    try {
      const options = {
        title: reportTitle.trim(),
        editionLabel: editionLabel.trim(),
        classes: cleanClasses,
      };

      const filePath =
        format === 'pptx'
          ? await generateReadingChartPresentation(options)
          : await generateReadingChartPng(options);

      if (filePath) {
        toast.success(format === 'pptx' ? 'Apresentação salva com sucesso.' : 'Imagens PNG salvas com sucesso.');
      }
    } catch (error) {
      console.error(error);
      toast.error(format === 'pptx' ? 'Erro ao gerar PowerPoint.' : 'Erro ao gerar PNG.');
    } finally {
      setExporting(null);
    }
  };

  return (
    <div className="h-[calc(100vh-140px)] flex flex-col overflow-hidden">
      <Card className="flex h-full flex-col overflow-hidden border-none bg-transparent shadow-none">
        <CardHeader className="shrink-0 px-0 pt-0">
          <CardTitle className="flex items-center gap-2 text-xl">
            <BarChart3 className="h-6 w-6" />
            Gerador de Gráficos Personalizados
          </CardTitle>
        </CardHeader>

        <CardContent className="flex min-h-0 flex-1 flex-col overflow-hidden px-0">
          <div className="grid min-h-0 flex-1 grid-cols-1 gap-6 lg:grid-cols-12">
            <div className="flex min-h-0 flex-col lg:col-span-4">
              <ScrollArea className="flex-1 pr-4">
                <div className="space-y-6 p-1">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Tipo de gráfico</Label>
                      <Select value={chartType} disabled>
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {chartTypes.map((type) => (
                            <SelectItem key={type.id} value={type.id}>
                              {type.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">{chartTypes[0].description}</p>
                    </div>

                    <div className="grid grid-cols-1 gap-3">
                      <div className="space-y-2">
                        <Label>Título</Label>
                        <Input value={reportTitle} onChange={(event) => setReportTitle(event.target.value)} />
                      </div>
                      <div className="space-y-2">
                        <Label>Edição</Label>
                        <Input value={editionLabel} onChange={(event) => setEditionLabel(event.target.value)} />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <Label>Turmas</Label>
                      <Button type="button" variant="outline" size="sm" onClick={addClass}>
                        <Plus className="mr-2 h-4 w-4" />
                        Adicionar
                      </Button>
                    </div>

                    <div className="space-y-2">
                      {classes.map((classData) => {
                        const summary = getReadingSummary(classData.students.filter((student) => student.name.trim()));
                        return (
                          <button
                            key={classData.id}
                            type="button"
                            className={cn(
                              'w-full rounded-md border px-3 py-2 text-left text-sm transition-colors hover:bg-accent',
                              selectedClassId === classData.id && 'border-primary bg-accent',
                            )}
                            onClick={() => setSelectedClassId(classData.id)}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-medium">{classData.name || 'Turma sem nome'}</span>
                              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                <Users className="h-3 w-3" />
                                {summary.total}
                              </span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {selectedClass && (
                    <div className="space-y-5 rounded-md border bg-card p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 space-y-2">
                          <Label>Nome da turma</Label>
                          <Input
                            value={selectedClass.name}
                            onChange={(event) =>
                              updateClass(selectedClass.id, (classData) => ({ ...classData, name: event.target.value }))
                            }
                          />
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="mt-6 text-muted-foreground hover:text-destructive"
                          onClick={() => removeClass(selectedClass.id)}
                          title="Remover turma"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>

                      <div className="space-y-2">
                        <Label>Colar nomes</Label>
                        <Textarea
                          value={selectedClass.pastedNames}
                          onChange={(event) =>
                            updateClass(selectedClass.id, (classData) => ({
                              ...classData,
                              pastedNames: event.target.value,
                            }))
                          }
                          placeholder="Cole um aluno por linha ou copie uma coluna de uma tabela."
                          className="min-h-24"
                        />
                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                          <Button type="button" variant="outline" onClick={() => pasteNamesIntoClass(selectedClass.id)}>
                            <ClipboardPaste className="mr-2 h-4 w-4" />
                            Inserir nomes
                          </Button>
                          <Button type="button" variant="outline" onClick={() => setImportTargetClassId(selectedClass.id)}>
                            <Upload className="mr-2 h-4 w-4" />
                            Importar SGEdu
                          </Button>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <div className="flex items-center justify-between gap-3">
                          <Label>Alunos e classificação</Label>
                          <Button type="button" variant="ghost" size="sm" onClick={() => addStudent(selectedClass.id)}>
                            <Plus className="mr-2 h-4 w-4" />
                            Aluno
                          </Button>
                        </div>

                        <div className="space-y-2">
                          {selectedClass.students.map((student, index) => (
                            <div key={student.id} className="grid grid-cols-[1fr_155px_34px] items-center gap-2">
                              <Input
                                value={student.name}
                                onChange={(event) => updateStudent(selectedClass.id, student.id, { name: event.target.value })}
                                placeholder={`Aluno ${index + 1}`}
                              />
                              <Select
                                value={student.levelId}
                                onValueChange={(value) =>
                                  updateStudent(selectedClass.id, student.id, {
                                    levelId: normalizeReadingLevel(value),
                                  })
                                }
                              >
                                <SelectTrigger className="w-full">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {READING_LEVELS.map((level) => (
                                    <SelectItem key={level.id} value={level.id}>
                                      {level.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="text-muted-foreground hover:text-destructive"
                                onClick={() => removeStudent(selectedClass.id, student.id)}
                                title="Remover aluno"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                </div>
              </ScrollArea>
            </div>

            <div className="flex min-h-0 flex-col lg:col-span-8">
              <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-md border bg-background shadow-sm ring-1 ring-border">
                <div className="flex shrink-0 items-center justify-between border-b bg-muted/40 px-4 py-3 text-sm font-medium">
                  <span>Pré-visualização do Gráfico</span>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground">
                      {cleanClasses.length} turma(s) com dados
                    </span>
                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => goToPreviewClass('previous')}
                        disabled={cleanClasses.length <= 1}
                        title="Turma anterior"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <span className="min-w-12 text-center text-xs text-muted-foreground">
                        {previewPosition}/{cleanClasses.length || 0}
                      </span>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => goToPreviewClass('next')}
                        disabled={cleanClasses.length <= 1}
                        title="Próxima turma"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
                <div className="min-h-0 flex-1 bg-card">
                  {previewClass ? (
                    <ReadingChartPreview classData={previewClass} editionLabel={editionLabel || 'Edição'} />
                  ) : (
                    <div className="flex h-full flex-col items-center justify-center gap-4 p-8 text-center text-muted-foreground">
                      <div className="rounded-full bg-muted/20 p-6">
                        <BarChart3 className="h-12 w-12 opacity-20" />
                      </div>
                      <p>Adicione alunos e defina as classificações para visualizar o gráfico.</p>
                    </div>
                  )}
                </div>
                <div className="flex shrink-0 justify-end gap-2 border-t bg-muted/30 px-4 py-3">
                  <Button
                    type="button"
                    onClick={() => handleExport('pptx')}
                    disabled={!!exporting || cleanClasses.length === 0}
                  >
                    {exporting === 'pptx' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileDown className="mr-2 h-4 w-4" />}
                    PowerPoint
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => handleExport('png')}
                    disabled={!!exporting || cleanClasses.length === 0}
                  >
                    {exporting === 'png' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileImage className="mr-2 h-4 w-4" />}
                    PNG
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <SGEduImportDialog
        isOpen={!!importTargetClassId}
        onClose={() => setImportTargetClassId(null)}
        onImport={handleImportFromSGEdu}
      />
    </div>
  );
}
