import { useState } from 'react';
import { useStore } from '@/store/useStore';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Trash2, Edit2, CloudDownload, ChevronDown, ChevronRight, User } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SGEduImportDialog } from '../SGEduImportDialog';
import { StudentDetailsDialog } from '../StudentDetailsDialog';
import { SGEduService } from '@/services/sgedu';
import { toast } from 'sonner';
import { useExternalAuth } from '@/hooks/useExternalAuth';

export function ClassManager() {
  const { classes, addClassGroup, deleteClassGroup, updateClassGroup, stages, updateClassStudents } = useStore();
  const { requireSession, service } = useExternalAuth('sgedu');
  const sgeService = service as SGEduService;
  const [isOpen, setIsOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [stageId, setStageId] = useState<string>('');

  // SGEdu States
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [targetClassIdForImport, setTargetClassIdForImport] = useState<string | null>(null);
  const [expandedClassId, setExpandedClassId] = useState<string | null>(null);
  const [selectedStudent, setSelectedStudent] = useState<import('@/types').Student | null>(null);
  const [isStudentDetailsOpen, setIsStudentDetailsOpen] = useState(false);

  const handleOpen = (cls?: any) => {
      if (cls) {
          setEditingId(cls.id);
          setName(cls.name);
          setStageId(cls.stageId || '');
      } else {
          setEditingId(null);
          setName('');
          setStageId('');
      }
      setIsOpen(true);
  };

  const handleSave = () => {
    if (!name.trim()) return;
    
    if (editingId) {
        updateClassGroup(editingId, { name, stageId: stageId || undefined });
    } else {
        addClassGroup({ name, stageId: stageId || undefined });
    }
    
    setName('');
    setStageId('');
    setEditingId(null);
    setIsOpen(false);
  };

  const handleImportSGEdu = (students: import('@/types').Student[], _professor?: string, className?: string, url?: string) => {
      if (!targetClassIdForImport || !className) return;

      const updates: any = { students };
      if (url) updates.url = url;
      
      updateClassStudents(targetClassIdForImport, students);
      updateClassGroup(targetClassIdForImport, updates);
      
      toast.success(`Lista de alunos importada e atualizada com sucesso para a turma local!`);
      setTargetClassIdForImport(null);
  };


  // State to track which class the selected student belongs to
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);

  const handleStudentClick = async (student: import('@/types').Student, classId: string) => {
      // Open dialog immediately with basic info
      setSelectedStudent(student);
      setSelectedClassId(classId);
      setIsStudentDetailsOpen(true);

      // Fetch details in background if missing
      if (!student.cpf || !student.responsiblePhone) { 
          if (!(await requireSession())) return;
          const details = await sgeService.getStudentDetails(student.id);
          if (details) {
              const updatedStudent = { ...student, ...details };
              setSelectedStudent(updatedStudent);
              
              // Persist to store
              persistStudentUpdate(classId, updatedStudent);

              // Background fetch for photo if needed
              if (updatedStudent.photoUrl && !updatedStudent.photoUrl.startsWith('data:')) {
                   sgeService.getStudentPhoto(updatedStudent.photoUrl).then((base64: string | null) => {
                       if (base64) {
                           const withPhoto = { ...updatedStudent, photoUrl: base64 };
                           setSelectedStudent(withPhoto);
                           persistStudentUpdate(classId, withPhoto);
                       }
                   });
              }
          }
      } else {
        if (student.photoUrl && !student.photoUrl.startsWith('data:')) {
             if (!(await requireSession())) return;
             sgeService.getStudentPhoto(student.photoUrl).then((base64: string | null) => {
                 if (base64) {
                     const withPhoto = { ...student, photoUrl: base64 };
                     setSelectedStudent(withPhoto);
                     persistStudentUpdate(classId, withPhoto);
                 }
             });
        }
      }
  };

  const handleRefreshStudent = async () => {
      if (!selectedStudent || !selectedClassId) return;
      if (!(await requireSession())) return;
      
      const details = await sgeService.getStudentDetails(selectedStudent.id);
      if (details) {
          const updatedStudent = { ...selectedStudent, ...details };
          setSelectedStudent(updatedStudent);
          persistStudentUpdate(selectedClassId, updatedStudent);
          toast.success('Dados do aluno atualizados.');
          
          // Background fetch photo
          if (updatedStudent.photoUrl && !updatedStudent.photoUrl.startsWith('data:')) {
               sgeService.getStudentPhoto(updatedStudent.photoUrl).then((base64: string | null) => {
                   if (base64) {
                       const withPhoto = { ...updatedStudent, photoUrl: base64 };
                       setSelectedStudent(withPhoto);
                       persistStudentUpdate(selectedClassId, withPhoto);
                   }
               });
          }
      } else {
          toast.error('Não foi possível atualizar os dados.');
      }
  };

  const persistStudentUpdate = (classId: string, updatedStudent: import('@/types').Student) => {
      const cls = classes.find(c => c.id === classId);
      if (!cls || !cls.students) return;

      const updatedStudents = cls.students.map(s => 
          s.id === updatedStudent.id ? updatedStudent : s
      );
      
      updateClassStudents(classId, updatedStudents);
  };

  // Manual Add State
  const [isManualAddOpen, setIsManualAddOpen] = useState(false);
  const [manualStudentsText, setManualStudentsText] = useState('');
  const [manualTargetClassId, setManualTargetClassId] = useState<string | null>(null);

  const openManualAdd = (classId: string) => {
      setManualTargetClassId(classId);
      setManualStudentsText('');
      setIsManualAddOpen(true);
  };
  
  const toggleExpandRaw = (id: string) => {
      setExpandedClassId(expandedClassId === id ? null : id);
  };

  const handleManualAddStudents = () => {
      if (!manualTargetClassId || !manualStudentsText.trim()) return;

      const lines = manualStudentsText.split('\n');
      const newStudents: import('@/types').Student[] = [];

      for (const line of lines) {
       // Remove leading number + tab/spaces, then remove | artifacts and trailing whitespace
       let cleaned = line
         .replace(/^\d+\s*[\t]/, '') // remove leading "1\t", "2\t" etc
         .replace(/\|/g, '')         // remove pipe characters
         .replace(/\t.*/g, '')       // remove everything after tab (attendance data)
         .replace(/\s*\(PCD\)\s*/gi, '') // remove (PCD) suffix
         .trim();
 
       // Skip students marked as "Transferido"
       if (/^Transferido\s/i.test(cleaned)) {
         continue;
       }
 
       if (cleaned) {
         // Generate a temporary ID or use a UUID if we had a generator. 
         // For now, let's use a random string or let the backend handle it? 
         // We are client-side only for now.
         // Let's use a simple random ID to avoid collisions with SGEdu IDs (which are numbers usually).
         // Prefix with 'manual-' to identify.
         const id = `manual-${Math.random().toString(36).substr(2, 9)}`;
         newStudents.push({ id, name: cleaned });
       }
     }

     if (newStudents.length > 0) {
         const cls = classes.find(c => c.id === manualTargetClassId);
         if (cls) {
             const currentStudents = cls.students || [];
             // Filter out duplicates based on name? Or allow duplicates? 
             // Usually better to avoid exact name duplicates.
             const existingNames = new Set(currentStudents.map(s => s.name.toLowerCase()));
             const filteredNew = newStudents.filter(s => !existingNames.has(s.name.toLowerCase()));
             
             if (filteredNew.length === 0) {
                 toast.warning('Todos os alunos já estão cadastrados nesta turma.');
             } else {
                 const updatedStudents = [...currentStudents, ...filteredNew];
                 updatedStudents.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'pt-BR'));
                 updateClassStudents(manualTargetClassId, updatedStudents);
                 toast.success(`${filteredNew.length} alunos adicionados à turma.`);
             }
         }
     }

     setIsManualAddOpen(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold tracking-tight">Turmas</h2>
        <div className="flex gap-2">
            <Button onClick={() => handleOpen()}>Nova Turma</Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12.5"></TableHead>
                <TableHead>Nome da Turma</TableHead>
                <TableHead>Etapa</TableHead>
                <TableHead>Alunos</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {classes.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground h-24">
                    Nenhuma turma cadastrada.
                  </TableCell>
                </TableRow>
              ) : (
                classes.map((cls) => (
                  <>
                  <TableRow key={cls.id} className={expandedClassId === cls.id ? "bg-muted/50" : ""}>
                    <TableCell>
                        <Button variant="ghost" size="sm" onClick={() => toggleExpandRaw(cls.id)}>
                            {expandedClassId === cls.id ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        </Button>
                    </TableCell>
                    <TableCell className="font-medium">{cls.name}</TableCell>
                    <TableCell>
                        {cls.stageId ? (
                             (() => {
                                const stage = stages.find(s => s.id === cls.stageId);
                                if (!stage) return <span className="text-muted-foreground">-</span>;
                                return (
                                    <div className="flex items-center gap-2">
                                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: stage.color }} />
                                        <span className="text-sm">{stage.name}</span>
                                    </div>
                                )
                             })()
                        ) : <span className="text-muted-foreground">-</span>}
                    </TableCell>
                    <TableCell>
                        {cls.students?.length || 0} alunos
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => handleOpen(cls)}>
                        <Edit2 className="h-4 w-4 text-primary" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => deleteClassGroup(cls.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                  {expandedClassId === cls.id && (
                      <TableRow>
                          <TableCell colSpan={5} className="p-0">
                              <div className="p-4 bg-muted/30">
                                  <div className="flex justify-between items-center mb-2">
                                      <h4 className="text-sm font-semibold">Lista de Alunos</h4>
                                      <div className="flex gap-2">
                                          <Button variant="outline" size="sm" onClick={async () => {
                                              if (await requireSession()) {
                                                  setTargetClassIdForImport(cls.id);
                                                  setIsImportOpen(true);
                                              }
                                          }}>
                                              <CloudDownload className="mr-2 h-4 w-4" />
                                              Importar do SGEdu
                                          </Button>
                                          <Button variant="outline" size="sm" onClick={() => openManualAdd(cls.id)}>
                                              <User className="mr-2 h-4 w-4" />
                                              Adicionar Alunos
                                          </Button>
                                      </div>
                                  </div>
                                  
                                  {(!cls.students || cls.students.length === 0) ? (
                                      <p className="text-sm text-muted-foreground">Nenhum aluno cadastrado nesta turma.</p>
                                  ) : (
                                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                                          {cls.students.map(student => (
                                              <div 
                                                key={student.id} 
                                                className="flex items-center gap-2 p-2 rounded-md bg-background border hover:bg-accent cursor-pointer transition-colors"
                                                onClick={() => handleStudentClick(student, cls.id)}
                                              >
                                                  <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                                                      <User className="h-4 w-4 text-muted-foreground" />
                                                  </div>
                                                  <span className="text-sm truncate">{student.name}</span>
                                              </div>
                                          ))}
                                      </div>
                                  )}
                              </div>
                          </TableCell>
                      </TableRow>
                  )}
                  </>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Dialogs */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent onCloseAutoFocus={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>{editingId ? 'Editar Turma' : 'Nova Turma'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome da Turma</Label>
              <Input 
                id="name" 
                value={name} 
                onChange={(e) => setName(e.target.value)} 
                placeholder="Ex: 6º Ano A, 9º Ano"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="stage">Etapa de Ensino (Opcional)</Label>
              <Select value={stageId} onValueChange={setStageId}>
                  <SelectTrigger>
                      <SelectValue placeholder="Selecione uma etapa" />
                  </SelectTrigger>
                  <SelectContent>
                      {stages.map(stage => (
                          <SelectItem key={stage.id} value={stage.id}>
                              <div className="flex items-center gap-2">
                                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: stage.color }} />
                                  {stage.name}
                              </div>
                          </SelectItem>
                      ))}
                  </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" onClick={handleSave}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      <SGEduImportDialog 
        isOpen={isImportOpen} 
        onClose={() => {
            setIsImportOpen(false);
            setTargetClassIdForImport(null);
        }} 
        onImport={handleImportSGEdu}
      />

      <StudentDetailsDialog 
        student={selectedStudent}
        classId={selectedClassId || undefined}
        isOpen={isStudentDetailsOpen}
        onClose={() => setIsStudentDetailsOpen(false)}
        onRefresh={handleRefreshStudent}
        onUpdate={(updated) => {
            if (selectedClassId) {
                persistStudentUpdate(selectedClassId, updated);
                setSelectedStudent(updated);
                toast.success('Dados do aluno atualizados.');
            }
        }}
        onDelete={(studentId, clsId) => {
            const cls = classes.find(c => c.id === clsId);
            if (cls && cls.students) {
                const newStudents = cls.students.filter(s => s.id !== studentId);
                updateClassStudents(clsId, newStudents);
                toast.success('Aluno removido da turma com sucesso.');
            }
        }}
      />

      {/* Manual Add Dialog */}
      <Dialog open={isManualAddOpen} onOpenChange={setIsManualAddOpen}>
          <DialogContent className="sm:max-w-125">
              <DialogHeader>
                  <DialogTitle>Adicionar Alunos Manualmente</DialogTitle>
                  <DialogDescription>
                      Cole a lista de alunos (um por linha). O sistema limpará formatações automaticamente.
                  </DialogDescription>
              </DialogHeader>
              <div className="py-4">
                  <textarea 
                      className="flex min-h-50 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                      placeholder={`Exemplo:\n1 - Ana Silva\n2 - Bruno Souza\n3 - Carla Dias`}
                      value={manualStudentsText}
                      onChange={(e) => setManualStudentsText(e.target.value)}
                  />
              </div>
              <DialogFooter>
                  <Button variant="outline" onClick={() => setIsManualAddOpen(false)}>Cancelar</Button>
                  <Button onClick={handleManualAddStudents}>Adicionar Alunos</Button>
              </DialogFooter>
          </DialogContent>
      </Dialog>
    </div>
  );
}
