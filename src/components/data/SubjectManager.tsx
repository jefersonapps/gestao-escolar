import { useState } from 'react';
import { useStore } from '@/store/useStore';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Trash2, Edit2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';

export function SubjectManager() {
  const { subjects, addSubject, updateSubject, deleteSubject } = useStore();
  const [isOpen, setIsOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [currentId, setCurrentId] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    name: '',
    color: '#3b82f6',
  });

  const handleOpen = () => {
    setIsEditing(false);
    setFormData({ name: '', color: '#3b82f6' });
    setIsOpen(true);
  };

  const handleEdit = (id: string) => {
    const subject = subjects.find(s => s.id === id);
    if (!subject) return;
    setCurrentId(id);
    setFormData({ name: subject.name, color: subject.color });
    setIsEditing(true);
    setIsOpen(true);
  };

  const handleSave = () => {
    if (!formData.name.trim()) return;

    if (isEditing && currentId) {
      updateSubject(currentId, formData);
    } else {
      addSubject(formData);
    }
    setIsOpen(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold tracking-tight">Disciplinas</h2>

        <Button onClick={handleOpen}>Nova Disciplina</Button>
      </div>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent onCloseAutoFocus={(e) => e.preventDefault()}>
            <DialogHeader>
              <DialogTitle>{isEditing ? 'Editar Disciplina' : 'Nova Disciplina'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nome da Disciplina</Label>
                <Input 
                  id="name" 
                  value={formData.name} 
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })} 
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="color">Cor de Identificação</Label>
                <div className="flex items-center gap-4">
                   <Input 
                    type="color" 
                    id="color" 
                    className="w-16 h-10 p-1"
                    value={formData.color} 
                    onChange={(e) => setFormData({ ...formData, color: e.target.value })} 
                  />
                  <div 
                    className="w-full h-10 rounded border" 
                    style={{ backgroundColor: formData.color }}
                  ></div>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button type="submit" onClick={handleSave}>Salvar</Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cor</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {subjects.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-muted-foreground h-24">
                    Nenhuma disciplina cadastrada.
                  </TableCell>
                </TableRow>
              ) : (
                subjects.map((subject) => (
                  <TableRow key={subject.id}>
                    <TableCell>
                      <div 
                        className="w-6 h-6 rounded-full border" 
                        style={{ backgroundColor: subject.color }}
                      />
                    </TableCell>
                    <TableCell className="font-medium">{subject.name}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => handleEdit(subject.id)}>
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => deleteSubject(subject.id)}>
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
    </div>
  );
}
