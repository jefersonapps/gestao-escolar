import { useState, useCallback, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, FileDown, Loader2 } from 'lucide-react';
import { exportAttendancePdf } from '@/lib/AttendancePdfExport';
import { useStore } from '@/store/useStore';
import { toast } from 'sonner';
import { SGEduImportDialog } from '../SGEduImportDialog';
import { CloudDownload } from 'lucide-react';

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
  const pasteRef = useRef<HTMLTextAreaElement>(null);

  // Auto-load students when class is selected
  useEffect(() => {
    // If no class is selected (empty string), do nothing (or clear?)
    if (!turma) return;

    // Use registeredClasses from the store directly, which was destructured from the hook
    const selectedClass = registeredClasses.find(c => c.name === turma);
    
    // If class found and has students, load them
    if (selectedClass?.students && selectedClass.students.length > 0) {
      setStudents(selectedClass.students.map(s => s.name));
    } else if (selectedClass) {
        // If class is known but has no students saved, clear the list to avoid confusion 
        // with previous class's students.
        setStudents([]);
    }
  }, [turma, registeredClasses]);

  const sortedStudents = [...students].sort((a, b) =>
    a.localeCompare(b, 'pt-BR', { sensitivity: 'base' })
  );

  const addStudent = useCallback(() => {
    const name = newName.trim();
    if (name && !students.includes(name)) {
      setStudents((prev) => [...prev, name]);
      setNewName('');
    }
  }, [newName, students]);

  const removeStudent = useCallback((index: number) => {
    const nameToRemove = sortedStudents[index];
    setStudents((prev) => prev.filter((n) => n !== nameToRemove));
  }, [sortedStudents]);

  const handlePaste = useCallback((e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    e.preventDefault();
    const text = e.clipboardData.getData('text');
    const lines = text.split('\n').filter((l) => l.trim());

    const names: string[] = [];
    for (const line of lines) {
      // Remove leading number + tab/spaces, then remove | artifacts and trailing whitespace
      let cleaned = line
        .replace(/^\d+\s*[\t]/, '') // remove leading "1\t", "2\t" etc
        .replace(/\|/g, '')         // remove pipe characters
        .replace(/\t.*/g, '')       // remove everything after tab (attendance data)
        .replace(/\s*\(PCD\)\s*/gi, '') // remove (PCD) suffix
        .trim();

      // Skip students marked as "Transferido" — they were transferred out
      if (/^Transferido\s/i.test(cleaned)) {
        continue;
      }

      if (cleaned) {
        names.push(cleaned);
      }
    }

    if (names.length > 0) {
      setStudents((prev) => {
        const set = new Set(prev);
        names.forEach((n) => set.add(n));
        return Array.from(set);
      });
    }
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addStudent();
    }
  }, [addStudent]);

  const handleExportPdf = useCallback(async () => {
    if (sortedStudents.length === 0) return;
    const [year, month] = monthYear.split('-').map(Number);
    await exportAttendancePdf({
      turma,
      professor,
      month,
      year,
      students: sortedStudents,
    });
  }, [turma, professor, monthYear, sortedStudents]);

  const handleSGEduImport = (importedStudents: import('@/types').Student[], importedProfessor?: string, importedClassName?: string) => {
    const studentNames = importedStudents.map(s => s.name);
    setStudents(studentNames);
    
    if (importedProfessor) setProfessor(importedProfessor);
    
    // Determine the class name to use for lookup/updating
    let targetClass = turma;
    if (importedClassName) {
        // Optimistically update the UI to the imported class name
        setTurma(importedClassName);
        targetClass = importedClassName;
    }

    // Attempt to update the local store if this class is registered
    if (targetClass) {
        const classGroup = registeredClasses.find(c => c.name === targetClass);
        if (classGroup) {
            updateClassStudents(classGroup.id, importedStudents);
            toast.success(`Lista de alunos salva para a turma ${targetClass}`);
        } else {
             // If class not found (e.g. user manually typed a name not in registered classes), 
             // we can't save to a specific ID. Just warn or do nothing.
             // Maybe we should offer to create it? For now, just show a different message.
             toast.info('Lista importada, mas a turma não está cadastrada para salvamento automático.');
        }
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Dados da Turma</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label htmlFor="turma">Turma</Label>
            {registeredClasses.length > 0 ? (
              <div className="flex gap-2">
                <Select
                  value={registeredClasses.some((c) => c.name === turma) ? turma : ''}
                  onValueChange={(val) => setTurma(val)}
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
          </div>
          <div className="space-y-2">
            <Label htmlFor="professor">Professor(a)</Label>
            <Input
              id="professor"
              placeholder="Nome do(a) professor(a)"
              value={professor}
              onChange={(e) => setProfessor(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="monthYear">Mês / Ano</Label>
            <Input
              id="monthYear"
              type="month"
              value={monthYear}
              onChange={(e) => setMonthYear(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Lista de Alunos ({sortedStudents.length})</CardTitle>
          <div className="flex gap-2">
            <Button 
                variant="outline" 
                onClick={() => setIsImportoSGEduOpen(true)}
            >
                <CloudDownload className="w-4 h-4 mr-2" />
                Importar SGEdu
            </Button>
            <Button 
            onClick={async () => {
              try {
                setIsGeneratingPdf(true);
                await handleExportPdf();
                toast.success('PDF gerado com sucesso!');
              } catch (error) {
                console.error(error);
                toast.error('Erro ao gerar PDF: ' + (error instanceof Error ? error.message :String(error)));
              } finally {
                setIsGeneratingPdf(false);
              }
            }} 
            disabled={sortedStudents.length === 0 || isGeneratingPdf}
          >
            {isGeneratingPdf ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <FileDown className="w-4 h-4 mr-2" />
            )}
            {isGeneratingPdf ? 'Gerando...' : 'Gerar PDF'}
          </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Paste area */}
          <div className="space-y-2">
            <Label>Colar lista de alunos (formato do sistema educacional)</Label>
            <textarea
              ref={pasteRef}
              onPaste={handlePaste}
              className="w-full h-24 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
              placeholder="Cole aqui a lista de alunos copiada do sistema educacional (alunos marcados como 'Transferido' serão excluídos automaticamente)..."
              readOnly
            />
          </div>

          {/* Manual add */}
          <div className="flex gap-2">
            <Input
              placeholder="Digitar nome do aluno"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={handleKeyDown}
              className="flex-1"
            />
            <Button onClick={addStudent} variant="outline" size="icon">
              <Plus className="w-4 h-4" />
            </Button>
          </div>

          {/* Student table */}
          {sortedStudents.length > 0 && (
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/50 border-b">
                    <th className="text-left px-4 py-2 w-16 font-medium">Nº</th>
                    <th className="text-left px-4 py-2 font-medium">Nome do Estudante</th>
                    <th className="w-12"></th>
                  </tr>
                </thead>
                <tbody>
                  {sortedStudents.map((name, i) => (
                    <tr key={name} className="border-b last:border-b-0 hover:bg-muted/30">
                      <td className="px-4 py-2 text-muted-foreground">{i + 1}</td>
                      <td className="px-4 py-2">{name}</td>
                      <td className="px-2 py-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive hover:text-destructive"
                          onClick={() => removeStudent(i)}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
      <SGEduImportDialog 
        isOpen={isImportoSGEduOpen} 
        onClose={() => setIsImportoSGEduOpen(false)} 
        onImport={handleSGEduImport}
      />
    </div>
  );
}
