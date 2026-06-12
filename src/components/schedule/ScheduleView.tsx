import { useMemo, useState, useCallback } from 'react';
import { useStore } from '@/store/useStore';
import {
    DndContext,
    DragOverlay,
    useSensor,
    useSensors,
    PointerSensor,
    KeyboardSensor,
    pointerWithin
} from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
import { generateSchedule } from '@/lib/generator';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Download, RefreshCcw, Trash2, AlertTriangle, Settings2, MoreHorizontal } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from 'sonner';
import { exportToPdf, exportProfessorsToPdf } from '@/lib/PdfExport';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { ScheduleConflict } from '@/types';
import { ProfessorEditDialog } from '../data/ProfessorEditDialog';
import { Badge } from '@/components/ui/badge';
import { ScheduleDay } from './ScheduleDay';

export function ScheduleView() {
  const { 
    schoolConfig, 
    professors, 
    subjects, 
    classes, 
    lessons, 
    setLessons, 
    upsertLesson, 
    removeLesson, 
    stages,
    scheduleViewState,
    setScheduleViewState 
  } = useStore();
  const [isGenerating, setIsGenerating] = useState(false);
  
  const selectedClassId = scheduleViewState.selectedClassId;
  const selectedStageId = scheduleViewState.selectedStageId;

  const setSelectedClassId = (id: string) => {
    setScheduleViewState({ ...scheduleViewState, selectedClassId: id });
  };


  
  const [conflictReport, setConflictReport] = useState<ScheduleConflict[]>([]);
  const [editingProfessorId, setEditingProfessorId] = useState<string | null>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  
  const [selectedSlot, setSelectedSlot] = useState<{classId: string, dayId: string, slotId: string} | null>(null);

  const handleSlotClick = useCallback((classId: string, dayId: string, slotId: string) => {
     setSelectedSlot({ classId, dayId, slotId });
  }, []);

  const [conflictDialog, setConflictDialog] = useState<{
      isOpen: boolean;
      message: string;
      onConfirm: () => void;
  } | null>(null);

  // Drag and Drop Logic
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor)
  );
  
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeLesson, setActiveLesson] = useState<any>(null);

  const handleDragStart = (event: any) => {
    setActiveId(event.active.id);
    setActiveLesson(event.active.data.current?.lesson);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    setActiveLesson(null);

    if (!over) return;

    const sourceData = active.data.current;
    const targetData = over.data.current;

    if (!sourceData || !targetData) return;

    // Validate: Same Slot (No-op)
    if (sourceData.classId === targetData.classId && sourceData.dayId === targetData.dayId && sourceData.slotId === targetData.slotId) return;

    const checkConflict = (
        professorId: string, 
        subjectId: string, 
        classId: string, 
        dayId: string, 
        slotId: string,
        ignoreLessonId: string
    ): string | null => {
        const prof = professors.find(p => p.id === professorId);
        if (!prof) return null;

        // 1. Check Busy
        const isBusy = lessons.some(l => 
            l.id !== ignoreLessonId &&
            l.dayId === dayId && 
            l.slotId === slotId && 
            l.professorId === professorId
        );
        if (isBusy) {
            const busyLesson = lessons.find(l => 
                l.id !== ignoreLessonId &&
                l.dayId === dayId && 
                l.slotId === slotId && 
                l.professorId === professorId
            );
            const busyClass = classes.find(c => c.id === busyLesson?.classGroupId);
            return `Conflito: Prof. ${prof.name} já está dando aula na turma ${busyClass?.name} neste horário.`;
        }

        // 2. Check Unavailable
        if (prof.unavailableSlots?.includes(`${dayId}|${slotId}`)) {
            return `Conflito: Prof. ${prof.name} marcou indisponibilidade para este horário.`;
        }

        // 3. Check Limit (Allocations)
        // Count existing lessons for this class/subject, excluding the one being moved (if it was already in this class)
        // If we are moving within the same class, the count doesn't increase, so we might skip this?
        // Actually, if we move within same class, count handles it. 
        // But if we move from Class A to Class B, we need to check Class B's limit.
        
        // We need to know if the lesson was ALREADY in this class.
        // The ignoreLessonId lesson might be in this class or another.
        // If it was in another class, we count existing lessons in THIS class.
        // If it was in THIS class, `ignoreLessonId` ensures we don't double count it.
        const currentLessons = lessons.filter(l => 
            l.id !== ignoreLessonId &&
            l.professorId === professorId && 
            l.classGroupId === classId && 
            l.subjectId === subjectId
        ).length;

        const allocation = prof.allocations.find(a => 
            a.classGroupId === classId && 
            a.subjectId === subjectId
        );
        
        const limit = allocation?.lessonsPerWeek || 0;
        if (currentLessons >= limit) {
             return `Limite: Prof. ${prof.name} já atingiu o limite de ${limit} aulas para a turma selecionada.`;
        }

        return null; // No conflict
    };

    // Perform Move (Draft)
    // 1. Find source lesson
    const sourceLesson = lessons.find(l => 
        l.classGroupId === sourceData.classId && 
        l.dayId === sourceData.dayId && 
        l.slotId === sourceData.slotId
    );

    if (!sourceLesson) return;

    // 2. Find target lesson (if any) - For swapping
    const targetLesson = lessons.find(l => 
        l.classGroupId === targetData.classId && 
        l.dayId === targetData.dayId && 
        l.slotId === targetData.slotId
    );

    // Prepare Payload
    const executeMove = () => {
        let newLessons = lessons.filter(l => l.id !== sourceLesson.id);
        if (targetLesson) {
            newLessons = newLessons.filter(l => l.id !== targetLesson.id);
            
            // Swap: Source gets Target's position, Target gets Source's position
            // When swapping across classes, we also swap classGroupIds
            const updatedTarget = { 
                ...targetLesson, 
                classGroupId: sourceData.classId,
                dayId: sourceData.dayId, 
                slotId: sourceData.slotId 
            };
            const updatedSource = { 
                ...sourceLesson, 
                classGroupId: targetData.classId,
                dayId: targetData.dayId, 
                slotId: targetData.slotId, 
                isLocked: true 
            }; // Lock when manually moved
            
            newLessons.push(updatedTarget);
            newLessons.push(updatedSource);
        } else {
            // Just Move
            const updatedSource = { 
                ...sourceLesson, 
                classGroupId: targetData.classId,
                dayId: targetData.dayId, 
                slotId: targetData.slotId, 
                isLocked: true 
            };
            newLessons.push(updatedSource);
        }
        setLessons(newLessons);
        setConflictDialog(null);
    };

    // Validate
    const errors: string[] = [];
    
    // Check Source moving to Target
    if (sourceLesson.professorId) {
        const err = checkConflict(
            sourceLesson.professorId, 
            sourceLesson.subjectId, 
            targetData.classId, 
            targetData.dayId, 
            targetData.slotId, 
            sourceLesson.id
        );
        if (err) errors.push(err);
    }

    // Check Target moving to Source (Swap)
    if (targetLesson && targetLesson.professorId) {
         const err = checkConflict(
            targetLesson.professorId, 
            targetLesson.subjectId, 
            sourceData.classId, 
            sourceData.dayId, 
            sourceData.slotId, 
            targetLesson.id
        );
        if (err) errors.push(err);
    }

    if (errors.length > 0) {
        setConflictDialog({
            isOpen: true,
            message: errors.join("\n") + "\n\nDeseja mover mesmo assim?",
            onConfirm: () => executeMove()
        });
    } else {
        executeMove();
    }
  };

  const handleSubjectSelect = (subjectId: string) => {
      if (!selectedSlot) return;

      // VALIDATION: Check for available professors
      const capableProfessors = professors.filter(p => p.subjectIds.includes(subjectId));
      
      if (capableProfessors.length === 0) {
          toast.error("Erro: Nenhum professor cadastrado para esta disciplina.");
          return;
      }

      // Check which professors are busy at this time OR have reached their limit
      const availableProfessors = capableProfessors.filter(prof => {
          // Check if busy in another class
          const isBusy = lessons.some(l => 
              l.dayId === selectedSlot.dayId && 
              l.slotId === selectedSlot.slotId && 
              l.professorId === prof.id &&
              l.classGroupId !== selectedSlot.classId // Ignore self (update case, though upsert handles replacement)
          );
          
          // Check explicit unavailableSlots from professor config
          const isUnavailable = prof.unavailableSlots?.includes(`${selectedSlot.dayId}|${selectedSlot.slotId}`);

          // Check Limit
          const currentLessons = lessons.filter(l => 
            l.professorId === prof.id && 
            l.classGroupId === selectedSlot.classId && 
            l.subjectId === subjectId
          ).length;

          const allocation = prof.allocations.find(a => 
            a.classGroupId === selectedSlot.classId && 
            a.subjectId === subjectId
          );
          
          const limit = allocation?.lessonsPerWeek || 0;
          const isLimitReached = currentLessons >= limit;

          return !isBusy && !isUnavailable && !isLimitReached;
      });

      let assignedProfessor = availableProfessors[0];

      if (!assignedProfessor) {
          // If no one is available, pick the first capable one and ask for confirmation
          const candidate = capableProfessors[0];
          
          // Find out why (busy, unavailable, or limit)
          const busyLesson = lessons.find(l => 
              l.dayId === selectedSlot.dayId && 
              l.slotId === selectedSlot.slotId && 
              l.professorId === candidate.id
          );

          // Check Limit for candidate
           const currentLessons = lessons.filter(l => 
            l.professorId === candidate.id && 
            l.classGroupId === selectedSlot.classId && 
            l.subjectId === subjectId
          ).length;
          const allocation = candidate.allocations.find(a => 
            a.classGroupId === selectedSlot.classId && 
            a.subjectId === subjectId
          );
          const limit = allocation?.lessonsPerWeek || 0;
          const isLimitReached = currentLessons >= limit;

          
          let message = "";
          if (busyLesson) {
             const busyClass = classes.find(c => c.id === busyLesson.classGroupId);
             message = `Conflito: Prof. ${candidate.name} já está dando aula na turma ${busyClass?.name} neste horário.`;
          } else if (candidate.unavailableSlots?.includes(`${selectedSlot.dayId}|${selectedSlot.slotId}`)) {
             message = `Conflito: Prof. ${candidate.name} marcou indisponibilidade para este horário.`;
          } else if (isLimitReached) {
             message = `Limite: Prof. ${candidate.name} já atingiu o limite de ${limit} aulas para esta turma.`;
          } else {
             message = "Conflito: Todos os professores desta disciplina estão ocupados.";
          }

          setConflictDialog({
              isOpen: true,
              message: `${message} Deseja adicionar mesmo assim? (Isso pode ser útil para juntar turmas).`,
              onConfirm: () => {
                  upsertLesson({
                      classGroupId: selectedSlot.classId,
                      dayId: selectedSlot.dayId,
                      slotId: selectedSlot.slotId,
                      subjectId,
                      professorId: candidate.id, 
                      isLocked: true // Mark as manually placed
                  });
                  setSelectedSlot(null);
                  toast.success(`Horário definido com conflito! (Prof. ${candidate.name})`);
                  setConflictDialog(null);
              }
          });
          return;
      }

      // If available, proceed normally
      upsertLesson({
          classGroupId: selectedSlot.classId,
          dayId: selectedSlot.dayId,
          slotId: selectedSlot.slotId,
          subjectId,
          professorId: assignedProfessor.id, 
          isLocked: true // Mark as manually placed
      });
      setSelectedSlot(null);
      toast.success(`Horário definido! (Prof. ${assignedProfessor.name})`);
  };

  const handleClearSlot = () => {
      if (!selectedSlot) return;
      removeLesson(selectedSlot.classId, selectedSlot.dayId, selectedSlot.slotId);
      setSelectedSlot(null);
      toast.info("Horário limpo.");
  };

  const [generationProgress, setGenerationProgress] = useState<{ generation: number, fitness: number } | null>(null);

  const handleGenerate = async () => {
    setIsGenerating(true);
    setGenerationProgress({ generation: 0, fitness: 0 }); // Reset
    
    // Add small delay to allow UI to render loader
    setTimeout(async () => {
      try {
         // Clear previous conflicts
         setConflictReport([]);
         
         // 1. Determine Scope
         const targetClasses = selectedStageId === 'all' 
            ? classes 
            : classes.filter(c => c.stageId === selectedStageId);

         if (targetClasses.length === 0) {
             toast.error("Nenhuma turma encontrada para o filtro selecionado.");
             setIsGenerating(false);
             return;
         }

         // 2. Identify Existing Lessons (to preserve)
         // If a stage is selected, lessons from OTHER stages are "fixed"
         let otherLessons: typeof lessons = [];
         if (selectedStageId !== 'all') {
             const targetClassIds = targetClasses.map(c => c.id);
             otherLessons = lessons.filter(l => !targetClassIds.includes(l.classGroupId));
         }

         // 3. Prepare Input


         const { result: newSchedule, conflicts } = await generateSchedule({ 
             schoolConfig, 
             professors, 
             subjects, 
             classes: targetClasses,
             stages, // Pass stages context
             existingLessons: otherLessons 
         }, (progress) => {
            setGenerationProgress(progress);
        });
        
        if (newSchedule.length === 0) {
          toast.error("Não foi possível gerar um horário completo com as restrições atuais.");
        } else {
          // Merge new schedule with preserved lessons
          setLessons([...otherLessons, ...newSchedule]);
          
          if (conflicts.length > 0) {
             toast.warning(`Horário gerado com ${conflicts.length} questões.`);
             setConflictReport(conflicts);
          } else {
             toast.success("Horário gerado com sucesso!");
          }
        }
      } catch (e) {
        toast.error("Erro ao gerar horário.");
        console.error(e);
      } finally {
        setIsGenerating(false);
        setGenerationProgress(null);
      }
    }, 100);
  };

  const handleEditProfessor = (profId: string) => {
      setEditingProfessorId(profId);
      setIsEditOpen(true);
  };



  const lessonMap = useMemo(() => {
    const map = new Map<string, typeof lessons[0]>();
    lessons.forEach(l => {
        map.set(`${l.classGroupId}|${l.dayId}|${l.slotId}`, l);
    });
    return map;
  }, [lessons]);



  return (
    <div className="space-y-6">
      <div className="space-y-6">
        <div>
            <h2 className="text-3xl font-bold tracking-tight">Grade de Horário</h2>
            <p className="text-muted-foreground">
                Gerencie a grade de aulas, gere horários com IA e exporte em PDF.
            </p>
        </div>

        <Card className="p-4">
            <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
                {/* Filters */}
                <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
                    <Select value={selectedStageId} onValueChange={(val) => { 
                        setScheduleViewState({ selectedStageId: val, selectedClassId: "all" });
                    }}>
                        <SelectTrigger className="w-full sm:w-[200px]">
                            <SelectValue placeholder="Filtrar por Etapa" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Todas as Etapas</SelectItem>
                            {stages.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                        </SelectContent>
                    </Select>

                    <Select value={selectedClassId} onValueChange={setSelectedClassId}>
                        <SelectTrigger className="w-full sm:w-[200px]">
                            <SelectValue placeholder="Filtrar por Turma" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Todas as Turmas</SelectItem>
                            {classes
                                .filter(c => selectedStageId === 'all' || c.stageId === selectedStageId)
                                .map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)
                            }
                        </SelectContent>
                    </Select>
                </div>

                {/* Actions */}
                <div className="flex flex-wrap gap-2 w-full md:w-auto justify-end">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="icon">
                                <MoreHorizontal className="h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-destructive focus:text-destructive cursor-pointer">
                                        <Trash2 className="mr-2 h-4 w-4" />
                                        Zerar Grade
                                    </DropdownMenuItem>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>Zerar grade de horários?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                            Esta ação não pode ser desfeita. Isso excluirá permanentemente todos os horários definidos.
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                        <AlertDialogAction onClick={() => {
                                            setLessons([]);
                                            toast.success("Grade de horários zerada com sucesso!");
                                        }}>
                                            Continuar
                                        </AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        </DropdownMenuContent>
                    </DropdownMenu>

                    {/* Conflict Confirmation Dialog */}
                    <AlertDialog open={!!conflictDialog?.isOpen} onOpenChange={(open) => !open && setConflictDialog(null)}>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle className="text-yellow-600 flex items-center gap-2">
                                    <AlertTriangle className="h-5 w-5" />
                                    Conflito de Horário Detectado
                                </AlertDialogTitle>
                                <AlertDialogDescription>
                                    {conflictDialog?.message}
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel onClick={() => setConflictDialog(null)}>Cancelar</AlertDialogCancel>
                                <AlertDialogAction onClick={conflictDialog?.onConfirm}>
                                    Sim, adicionar mesmo assim
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>

                    <Button variant="outline" onClick={() => {
                        const targetClasses = classes
                            .filter(c => selectedStageId === 'all' || c.stageId === selectedStageId)
                            .filter(c => selectedClassId === "all" || c.id === selectedClassId);
                        
                        if (targetClasses.length === 0) {
                            toast.error("Nenhuma turma selecionada para exportação.");
                            return;
                        }

                        exportToPdf(schoolConfig, targetClasses, lessons, subjects, professors)
                    }}>
                        <Download className="mr-2 h-4 w-4" /> 
                        <span className="hidden sm:inline">Exportar Geral</span>
                    </Button>

                    <Button variant="outline" onClick={() => {
                         exportProfessorsToPdf(schoolConfig, classes, lessons, subjects, professors);
                    }}>
                        <Download className="mr-2 h-4 w-4" />
                        <span className="hidden sm:inline">Exportar Profs.</span>
                    </Button>

                    <Button onClick={handleGenerate} disabled={isGenerating} className="min-w-[140px]">
                        {isGenerating ? (
                            <div className="flex items-center gap-2">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                {generationProgress ? (
                                    <span className="text-xs">
                                        {(generationProgress.fitness / 1000).toFixed(1)}k
                                    </span>
                                ) : "Gerando..."}
                            </div>
                        ) : (
                            <>
                                <RefreshCcw className="mr-2 h-4 w-4" />
                                <span className="hidden sm:inline">Gerar com IA</span>
                                <span className="sm:hidden">Gerar</span>
                            </>
                        )}
                    </Button>
                </div>
            </div>
        </Card>
      </div>

      {classes.length === 0 && <p className="text-center text-muted-foreground p-10">Cadastre turmas para gerar a grade.</p>}

      {/* Professor Edit Dialog (Lazy) */}
      <ProfessorEditDialog 
         professorId={editingProfessorId} 
         open={isEditOpen} 
         onOpenChange={setIsEditOpen} 
      />

      {/* Selection Dialog */}
      <Dialog open={!!selectedSlot} onOpenChange={(open) => !open && setSelectedSlot(null)}>
        {/* ... (existing selection dialog content) ... */}
         <DialogContent 
            className="sm:max-w-md"
            onCloseAutoFocus={(e) => e.preventDefault()}
         >
           <DialogHeader>
              <DialogTitle>Selecionar Disciplina</DialogTitle>
              <DialogDescription>
                 Escolha uma disciplina para este horário ou limpe a seleção.
              </DialogDescription>
           </DialogHeader>
           
           <div className="grid grid-cols-2 gap-2 py-4">
              {subjects.map(subject => (
                 <Button
                    key={subject.id}
                    variant="outline"
                    className="justify-start gap-2 h-auto py-2"
                    onClick={() => handleSubjectSelect(subject.id)}
                    style={{ borderColor: subject.color }}
                 >
                    <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: subject.color }} />
                    <span className="truncate">{subject.name}</span>
                 </Button>
              ))}
           </div>

            <DialogFooter className="sm:justify-between">
               <Button variant="ghost" className="text-destructive hover:text-destructive" onClick={handleClearSlot}>
                   <Trash2 className="mr-2 h-4 w-4" /> Limpar Horário
               </Button>
               <Button variant="secondary" onClick={() => setSelectedSlot(null)}>
                   Cancelar
               </Button>
            </DialogFooter>
         </DialogContent>
      </Dialog>
      
      {/* Conflict Report Dialog */}
      <Dialog open={conflictReport.length > 0} onOpenChange={(open) => !open && setConflictReport([])}>
        <DialogContent 
            className="sm:max-w-3xl max-h-[85vh] flex flex-col"
            onCloseAutoFocus={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-yellow-500" />
                Relatório de Sugestões de Ajuste
            </DialogTitle>
            <DialogDescription>
               Alguns horários não puderam ser preenchidos. Para resolver, você pode precisar ajustar as restrições dos professores abaixo.
            </DialogDescription>
          </DialogHeader>
          
          <ScrollArea className="h-[60vh] pr-4 -mr-4">
             <div className="space-y-4 pr-4">
               {conflictReport.map((conflict, idx) => {
                   const subject = subjects.find(s => s.id === conflict.subjectId);
                   return (
                   <div key={idx} className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between p-3 rounded-md border bg-muted/20 hover:bg-muted/40 transition-colors">
                       <div className="space-y-1 overflow-hidden">
                           <div className="flex items-center gap-2">
                               <Badge variant="outline" className="text-xs shrink-0" style={{ borderColor: subject?.color }}>
                                 {conflict.className}
                               </Badge>
                               <span className="font-semibold text-sm truncate">{conflict.subjectName}</span>
                               <span className="text-muted-foreground text-xs">em</span>
                               <span className="text-xs font-medium">{conflict.dayName} ({conflict.slotId})</span>
                           </div>
                           <p className="text-sm text-muted-foreground">
                              {conflict.message}
                           </p>
                       </div>
                       <Button 
                          variant="secondary" 
                          size="sm" 
                          className="shrink-0 gap-2"
                          onClick={() => handleEditProfessor(conflict.professorId)}
                       >
                           <Settings2 className="h-3 w-3" />
                           Editar {conflict.professorName.split(' ')[0]}
                       </Button>
                   </div>
                   )
               })}
             </div>
          </ScrollArea>
          
          <DialogFooter className="sm:justify-between gap-2">
            <span className="text-xs text-muted-foreground self-center">
                Total: {conflictReport.length} questões encontradas.
            </span>
            <Button onClick={() => setConflictReport([])}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>


      {/* Render Schedule - Day by Day */}
      <div className="space-y-8">
        {(() => {
            // 1. Determine "View Days" based on selection
            // If a specific stage is selected AND it has custom days, use them.
            // Otherwise, use global schoolConfig.days.
            // (Note: PDF Export always uses schoolConfig.days, so we stick to that for consistency in "All" view)
            let viewDays = schoolConfig.days; 
            if (selectedStageId !== 'all') {
                const stage = stages.find(s => s.id === selectedStageId);
                if (stage && stage.days && stage.days.length > 0) {
                    viewDays = stage.days;
                }
            }
            const activeDays = viewDays.filter(d => d.enabled);

            // 2. Filter Classes
            const filteredClasses = classes
                .filter(c => selectedStageId === 'all' || c.stageId === selectedStageId)
                .filter(c => selectedClassId === "all" || c.id === selectedClassId);

            return (
              <DndContext 
                sensors={sensors} 
                collisionDetection={pointerWithin} 
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
              >
               <div className="flex flex-col gap-8 pb-8">
               {activeDays.map(day => (
                  <ScheduleDay
                    key={day.id}
                    day={day}
                    filteredClasses={filteredClasses}
                    lessonMap={lessonMap}
                    subjects={subjects}
                    onSlotClick={handleSlotClick}
                  />
                ))}
               </div>
               
               <DragOverlay>
                  {activeId && activeLesson ? (
                     <div 
                      className="p-1 rounded text-center shadow-lg border-l-4 overflow-hidden bg-background border opacity-80 w-[140px] h-[50px] flex flex-col justify-center items-center"
                       style={{ 
                          backgroundColor: subjects.find(s=>s.id===activeLesson.subjectId)?.color + '1a', 
                          borderLeftColor: subjects.find(s=>s.id===activeLesson.subjectId)?.color
                       }}
                     >
                       <span className="font-bold text-xs">{subjects.find(s=>s.id===activeLesson.subjectId)?.name}</span>
                     </div>
                  ) : null}
               </DragOverlay>
              </DndContext>
            );
        })()}
      </div>

      {/* Professor Workload Report */}
      <Card className="mt-8">
          <div className="bg-primary/5 border-b p-3">
              <h3 className="font-bold text-lg">Relatório de Carga Horária por Professor</h3>
          </div>
          <CardContent className="p-0">
             <ScrollArea className="h-[400px]">
              <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-background z-10">
                      <tr className="border-b bg-muted/50">
                          <th className="p-3 text-left font-bold border-r">Professor</th>
                          <th className="p-3 text-left font-bold border-r">Disciplinas</th>
                          <th className="p-3 text-left font-bold border-r w-40">Dia de Planejamento</th>
                          <th className="p-3 text-left font-bold border-r">Turma</th>
                          <th className="p-3 text-center font-bold border-r w-32">Qtd. Aulas</th>
                          <th className="p-3 text-left font-bold">Dias da Semana</th>
                      </tr>
                  </thead>
                  <tbody>
                      {professors.map(prof => {
                          const relevantClasses = classes
                            .filter(c => selectedStageId === 'all' || c.stageId === selectedStageId)
                            .filter(c => selectedClassId === "all" || c.id === selectedClassId);

                          const profLessons = lessons.filter(l => l.professorId === prof.id);
                          
                          // Calculate Planning Days (Days with NO lessons across ALL classes)
                          // We check the professor's total schedule, not just filtered classes, 
                          // because a planning day implies they are free from teaching duties entirely.
                          const allProfLessons = lessons.filter(l => l.professorId === prof.id);
                          const activeDaysOfWeek = schoolConfig.days.filter(d => d.enabled).map(d => d.dayOfWeek);
                          
                          // Find days where professor has at least one lesson
                          const workingDays = new Set(allProfLessons.map(l => {
                              const dayConfig = schoolConfig.days.find(d => d.id === l.dayId);
                              return dayConfig?.dayOfWeek;
                          }).filter(d => d !== undefined));

                          const planningDays = activeDaysOfWeek
                              .filter(dayOfWeek => !workingDays.has(dayOfWeek))
                              .map(d => ['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado'][d])
                              .join(', ');

                          // Group by class (only for relevant classes)
                          const classStats = relevantClasses.map(cls => {
                                const lessonsInClass = profLessons.filter(l => l.classGroupId === cls.id);
                                if (lessonsInClass.length === 0) return null;

                                const days = Array.from(new Set(lessonsInClass.map(l => l.dayId)))
                                    .map(dayId => schoolConfig.days.find(d => d.id === dayId))
                                    .filter(Boolean)
                                    .sort((a,b) => (a?.dayOfWeek || 0) - (b?.dayOfWeek || 0))
                                    .map(d => ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'][d!.dayOfWeek]);

                                return {
                                    className: cls.name,
                                    count: lessonsInClass.length,
                                    days: days.join(', ')
                                };
                          }).filter(Boolean);

                          if (classStats.length === 0) return null;

                          return classStats.map((stat, idx) => (
                              <tr key={`${prof.id}-${idx}`} className="border-b hover:bg-muted/5">
                                  {/* Show professor name only on first row of their group with rowSpan */}
                                  {idx === 0 && (
                                      <>
                                        <td className="p-2 border-r align-middle font-medium bg-muted/5" rowSpan={classStats.length}>
                                            {prof.name}
                                        </td>
                                        <td className="p-2 border-r align-middle" rowSpan={classStats.length}>
                                            <div className="flex flex-wrap gap-1">
                                                {prof.subjectIds.map(subId => {
                                                    const subject = subjects.find(s => s.id === subId);
                                                    if (!subject) return null;
                                                    return (
                                                        <Badge key={subject.id} variant="outline" style={{ borderColor: subject.color, color: subject.color }} className="whitespace-nowrap">
                                                            {subject.name}
                                                        </Badge>
                                                    );
                                                })}
                                            </div>
                                        </td>
                                        <td className="p-2 border-r align-middle text-sm text-muted-foreground" rowSpan={classStats.length}>
                                            {planningDays || '-'}
                                        </td>
                                      </>
                                  )}
                                  <td className="p-2 border-r">{stat?.className?.split(' - ')[0]}</td>
                                  <td className="p-2 border-r text-center">{stat?.count}</td>
                                  <td className="p-2">{stat?.days}</td>
                              </tr>
                          ));
                      })}
                      {/* Empty state if no professors found */}
                      {professors.length === 0 && (
                          <tr><td colSpan={4} className="p-4 text-center text-muted-foreground">Nenhum professor cadastrado.</td></tr>
                      )}
                  </tbody>
              </table>
             </ScrollArea>
          </CardContent>
      </Card>
    </div>
  );
}
