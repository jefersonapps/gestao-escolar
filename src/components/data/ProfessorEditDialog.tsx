import { useState, useEffect, useMemo } from 'react';
import { useStore } from '@/store/useStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';

interface ProfessorEditDialogProps {
  professorId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ProfessorEditDialog({ professorId, open, onOpenChange }: ProfessorEditDialogProps) {
  const { schoolConfig, professors, subjects, classes, updateProfessor } = useStore();
  
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
    canTeachConsecutive: true,
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

  useEffect(() => {
      if (open && professorId) {
        const prof = professors.find(p => p.id === professorId);
        if (prof) {
            // Ensure allocations exist for enabled subjects
            let currentAllocations = prof.allocations || [];
            const missingAllocations: typeof currentAllocations = [];

            prof.subjectIds.forEach(subId => {
                classes.forEach(cls => {
                    const exists = currentAllocations.some(a => a.subjectId === subId && a.classGroupId === cls.id);
                    if (!exists) {
                        missingAllocations.push({
                            classGroupId: cls.id,
                            subjectId: subId,
                            lessonsPerWeek: 5,
                            maxDailyLessons: 2
                        });
                    }
                });
            });

            setFormData({
                name: prof.name,
                subjectIds: prof.subjectIds,
                allocations: [...currentAllocations, ...missingAllocations],
                minConsecutiveLessons: prof.minConsecutiveLessons,
                maxConsecutiveLessons: prof.maxConsecutiveLessons,
                canTeachConsecutive: prof.canTeachConsecutive,
            });
        }
      }
  }, [open, professorId, professors, classes]);

  const handleSave = () => {
    if (!formData.name.trim() || !professorId) return;
    updateProfessor(professorId, formData);
    onOpenChange(false);
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
        const newAllocations = classes.map(cls => ({
            classGroupId: cls.id,
            subjectId: subjectId,
            lessonsPerWeek: 5,
            maxDailyLessons: 2
        }));

        return { 
            ...prev, 
            subjectIds: [...prev.subjectIds, subjectId],
            allocations: [...prev.allocations, ...newAllocations]
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

  const totalLessons = formData.allocations.reduce((sum, a) => sum + a.lessonsPerWeek, 0);
  const totalMinutes = totalLessons * lessonDurationMinutes;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const timeString = `${hours}h${minutes > 0 ? ` ${minutes}min` : ''}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className="sm:max-w-5xl max-h-[90vh] overflow-y-auto"
        onCloseAutoFocus={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Editar Professor</DialogTitle>
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
  );
}
