import { useState, useMemo } from 'react';
import { useStore } from '@/store/useStore';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Trash2, Edit2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { SGEduImportDialog } from '@/components/SGEduImportDialog';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export function ProfessorManager() {
  const { schoolConfig, professors, subjects, classes, addProfessor, updateProfessor, deleteProfessor, clearProfessors } = useStore();
  const [isOpen, setIsOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isClearDialogOpen, setIsClearDialogOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [currentId, setCurrentId] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    name: '',
    subjectIds: [] as string[],
    allocations: [] as {
      classGroupId: string;
      subjectId: string;
      lessonsPerWeek: number;
      maxDailyLessons: number;
    }[],
    minConsecutiveLessons: 1,
    maxConsecutiveLessons: 2,
    canTeachConsecutive: false,
  });

  const lessonDurationMinutes = useMemo(() => {
     const validDay = schoolConfig.days.find(d => d.enabled && d.slots.length > 0);
     if (validDay && validDay.slots.length > 0) {
        const slot = validDay.slots[0];
        const [startH, startM] = slot.startTime.split(':').map(Number);
        const [endH, endM] = slot.endTime.split(':').map(Number);
        return (endH * 60 + endM) - (startH * 60 + startM);
     }
     return 50;
  }, [schoolConfig]);

  const totalLessons = formData.allocations.reduce((sum, a) => sum + a.lessonsPerWeek, 0);
  const totalMinutes = totalLessons * lessonDurationMinutes;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const timeString = `${hours}h${minutes > 0 ? ` ${minutes}min` : ''}`;

  const handleOpen = () => {
    setIsEditing(false);
    setFormData({
      name: '',
      subjectIds: [],
      allocations: [],
      minConsecutiveLessons: 1,
      maxConsecutiveLessons: 2,
      canTeachConsecutive: false,
    });
    setIsOpen(true);
  };

  const handleEdit = (id: string) => {
    const prof = professors.find(p => p.id === id);
    if (!prof) return;
    setCurrentId(id);

    // Ensure all classes are allocated for the subjects (if not already)
    // We check existing allocations from 'prof.allocations'. 
    // If a subject is enabled but a class allocation is missing, we add it by default.
    const currentAllocations = prof.allocations || [];
    // Previous logic auto-added missing allocations here. 
    // User requested "deixe tudo desmarcado", so we should NOT auto-fill missing allocations on edit either,
    // unless they allow it. But usually edit implies showing what is saved.
    // If we just want to NOT auto-add NEW subjects/classes, we stop that.
    // But for existing ones, we probably just show what is there.
    
    setFormData({
      name: prof.name,
      subjectIds: prof.subjectIds,
      allocations: [...currentAllocations],
      minConsecutiveLessons: prof.minConsecutiveLessons,
      maxConsecutiveLessons: prof.maxConsecutiveLessons,
      canTeachConsecutive: prof.canTeachConsecutive,
    });
    setIsEditing(true);
    setIsOpen(true);
  };

  const handleSave = () => {
    if (!formData.name.trim()) return;

    if (isEditing && currentId) {
      updateProfessor(currentId, formData);
    } else {
      addProfessor({
        ...formData,
        unavailableSlots: [], 
      });
    }
    setIsOpen(false);
  };

  const toggleSubject = (subjectId: string) => {
    setFormData(prev => {
      if (prev.subjectIds.includes(subjectId)) {
        return { 
          ...prev, 
          subjectIds: prev.subjectIds.filter(id => id !== subjectId),
          allocations: prev.allocations.filter(a => a.subjectId !== subjectId)
        };
      } else {
        // Do NOT auto-allocate classes for the new subject
        return { 
            ...prev, 
            subjectIds: [...prev.subjectIds, subjectId],
            // allocations remain as is (empty for this subject)
        };
      }
    });
  };

  const addAllocation = (classGroupId: string, subjectId: string) => {
     setFormData(prev => ({
        ...prev,
        allocations: [...prev.allocations, { classGroupId, subjectId, lessonsPerWeek: 5, maxDailyLessons: 2 }]
     }));
  };

  const removeAllocation = (classGroupId: string, subjectId: string) => {
    setFormData(prev => ({
        ...prev,
        allocations: prev.allocations.filter(a => !(a.classGroupId === classGroupId && a.subjectId === subjectId))
    }));
  };

  const updateAllocation = (classGroupId: string, subjectId: string, field: 'lessonsPerWeek'|'maxDailyLessons', value: number) => {
      setFormData(prev => ({
          ...prev,
          allocations: prev.allocations.map(a => 
            (a.classGroupId === classGroupId && a.subjectId === subjectId) ? { ...a, [field]: value } : a
          )
      }));
  };

  const handleImportProfessors = (importedProfs: { id: string, name: string }[]) => {
      let count = 0;
      importedProfs.forEach(p => {
          // Check if professor already exists by name (case insensitive)
          const exists = professors.some(existing => existing.name.toLowerCase() === p.name.toLowerCase());
          
          if (!exists) {
              addProfessor({
                  name: p.name,
                  subjectIds: [],
                  allocations: [],
                  unavailableSlots: [],
                  minConsecutiveLessons: 1,
                  maxConsecutiveLessons: 2,
                  canTeachConsecutive: false
              });
              count++;
          }
      });
      
      if (count > 0) {
          // toast.success is not directly imported here, but we can relay or just let the dialog handle part of it.
          // The store update will reflect in the UI automatically.
      }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold tracking-tight">Professores</h2>
        <div className="space-x-2">
            {professors.length > 0 && (
                <Button variant="destructive" onClick={() => setIsClearDialogOpen(true)}>
                    Excluir Todos
                </Button>
            )}
            <Button variant="outline" onClick={() => setIsImportOpen(true)}>
                Importar SGEdu
            </Button>
            <Button onClick={handleOpen}>Novo Professor</Button>
        </div>
      </div>

      <AlertDialog open={isClearDialogOpen} onOpenChange={setIsClearDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Você tem certeza?</AlertDialogTitle>
            <AlertDialogDescription>
              Essa ação não pode ser desfeita. Isso excluirá permanentemente todos os professores cadastrados e suas atribuições.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => {
                clearProfessors();
                setIsClearDialogOpen(false);
            }}>
              Sim, excluir tudo
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent 
            className="sm:max-w-5xl max-h-[90vh] overflow-y-auto"
            onCloseAutoFocus={(e) => e.preventDefault()}
        >
            <DialogHeader>
              <DialogTitle>{isEditing ? 'Editar Professor' : 'Novo Professor'}</DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-4">
              <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Nome do Professor</Label>
                    <Input 
                      id="name" 
                      value={formData.name} 
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })} 
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Disciplinas Habilitadas</Label>
                    <ScrollArea className="h-[200px] w-full rounded-md border p-4">
                      <div className="space-y-2">
                        {subjects.length === 0 && <p className="text-sm text-muted-foreground">Cadastre disciplinas primeiro.</p>}
                        {subjects.map((subject) => (
                          <div key={subject.id} className="flex items-center space-x-2">
                            <Checkbox 
                              id={`subj-${subject.id}`} 
                              checked={formData.subjectIds.includes(subject.id)}
                              onCheckedChange={() => toggleSubject(subject.id)}
                            />
                            <Label 
                              htmlFor={`subj-${subject.id}`} 
                              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 flex items-center gap-2"
                            >
                              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: subject.color }} />
                              {subject.name}
                            </Label>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </div>
              </div>

              <div className="space-y-4">
                 <div className="flex justify-between items-end">
                    <Label>Carga Horária & Atribuições</Label>
                    <span className="text-xs font-mono bg-primary/10 text-primary px-2 py-1 rounded">
                        Total: {totalLessons} aulas ({timeString})
                    </span>
                 </div>
                 <ScrollArea className="border rounded-md h-[300px] bg-muted/10">
                    <div className="p-4 space-y-4">
                    {formData.subjectIds.length === 0 && <p className="text-sm text-muted-foreground text-center pt-10">Selecione disciplinas primeiro.</p>}
                    
                    {formData.subjectIds.map(subjectId => {
                        const subject = subjects.find(s => s.id === subjectId);
                        if (!subject) return null;
                        
                        return (
                            <div key={subjectId} className="space-y-2">
                                <div className="font-semibold flex items-center gap-2 text-sm border-b pb-1">
                                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: subject.color }} />
                                    {subject.name}
                                </div>
                                <div className="pl-2 space-y-2">
                                    {classes.map(cls => {
                                        const alloc = formData.allocations.find(a => a.classGroupId === cls.id && a.subjectId === subjectId);
                                        const isAllocated = !!alloc;

                                        return (
                                            <div key={cls.id} className="flex items-center justify-between text-xs bg-card p-2 rounded border">
                                                <div className="flex items-center gap-2">
                                                    <Checkbox 
                                                        checked={isAllocated}
                                                        onCheckedChange={(checked) => {
                                                            if (checked) addAllocation(cls.id, subjectId);
                                                            else removeAllocation(cls.id, subjectId);
                                                        }}
                                                    />
                                                    <span>{cls.name}</span>
                                                </div>
                                                
                                                {isAllocated && (
                                                    <div className="flex items-center gap-2 shrink-0">
                                                        <div className="flex flex-col w-20">
                                                            <label className="text-[10px] text-muted-foreground whitespace-nowrap">Aulas/Sem</label>
                                                            <Input 
                                                                type="number" 
                                                                className="h-6 text-xs px-1" 
                                                                min={1} 
                                                                value={alloc.lessonsPerWeek}
                                                                onChange={(e) => updateAllocation(cls.id, subjectId, 'lessonsPerWeek', parseInt(e.target.value) || 1)}
                                                            />
                                                        </div>
                                                        <div className="flex flex-col w-20">
                                                            <label className="text-[10px] text-muted-foreground whitespace-nowrap">Máx/Dia</label>
                                                            <Input 
                                                                type="number" 
                                                                className="h-6 text-xs px-1" 
                                                                min={1} 
                                                                value={alloc.maxDailyLessons}
                                                                onChange={(e) => updateAllocation(cls.id, subjectId, 'maxDailyLessons', parseInt(e.target.value) || 1)}
                                                            />
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>
                        )
                    })}
                    </div>
                 </ScrollArea>
              </div>

              <div className="space-y-4 md:col-span-2">
                <Label>Preferências Gerais</Label>
                <div className="space-y-4 border p-4 rounded-md flex gap-8 items-center">
                   <div className="flex items-center space-x-2">
                    <Checkbox 
                      id="canTeachConsecutive" 
                      checked={formData.canTeachConsecutive}
                      onCheckedChange={(checked) => setFormData({ ...formData, canTeachConsecutive: checked === true })}
                    />
                    <Label htmlFor="canTeachConsecutive">Aceita aulas seguidas?</Label>
                  </div>
                  
                  <div className="flex gap-4">
                    <div className="space-y-1 w-32">
                      <Label className="text-xs">Mínimo seguidas</Label>
                      <Input 
                        type="number" 
                        min={1} 
                        value={formData.minConsecutiveLessons}
                        onChange={(e) => setFormData({ ...formData, minConsecutiveLessons: parseInt(e.target.value) || 1 })}
                      />
                    </div>
                    <div className="space-y-1 w-32">
                      <Label className="text-xs">Máximo seguidas</Label>
                      <Input 
                        type="number" 
                        min={1} 
                        value={formData.maxConsecutiveLessons}
                        onChange={(e) => setFormData({ ...formData, maxConsecutiveLessons: parseInt(e.target.value) || 1 })}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button type="submit" onClick={handleSave}>Salvar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>


      <Card className="py-0 overflow-hidden">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Atribuições</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {professors.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-muted-foreground h-24">
                    Nenhum professor cadastrado.
                  </TableCell>
                </TableRow>
              ) : (
                professors.map((professor) => (
                  <TableRow key={professor.id}>
                    <TableCell className="font-medium py-2">{professor.name}</TableCell>
                    <TableCell className="py-2">
                      <div className="flex flex-col gap-1">
                        {professor.allocations?.map((alloc, idx) => {
                           const sub = subjects.find(s => s.id === alloc.subjectId);
                           const cls = classes.find(c => c.id === alloc.classGroupId);
                           if (!sub || !cls) return null;
                           return (
                               <div key={idx} className="flex items-center gap-2 text-xs">
                                  <Badge variant="outline" style={{ borderColor: sub.color, color: sub.color }}>{sub.name}</Badge>
                                  <span className="text-muted-foreground">➔</span>
                                  <span className="font-semibold">{cls.name}</span>
                                  <span className="text-muted-foreground">({alloc.lessonsPerWeek} aulas, máx {alloc.maxDailyLessons}/dia)</span>
                               </div>
                           )
                        })}
                        {(!professor.allocations || professor.allocations.length === 0) && <span className="text-muted-foreground text-xs italic">Sem atribuições</span>}
                      </div>
                    </TableCell>
                    <TableCell className="text-right py-2">
                      <Button variant="ghost" size="icon" onClick={() => handleEdit(professor.id)}>
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => deleteProfessor(professor.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div style={{ display: 'none' }}>
        {/* Helper for dynamic imports or just to ensure the component is used if lazy loaded, 
            but here we just render it conditionally */}
      </div>
      
      <SGEduImportDialog 
        isOpen={isImportOpen}
        onClose={() => setIsImportOpen(false)}
        mode="professor"
        onImportProfessors={handleImportProfessors}
        onImport={() => {}} // Not used in professor mode
      />
    </div>
  );
}
