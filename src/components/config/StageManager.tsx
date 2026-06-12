import { useState } from 'react';
import { useStore } from '@/store/useStore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Trash2, Edit2, Plus } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import type { Stage } from '@/types';

export function StageManager() {
  const { stages, addStage, updateStage, deleteStage } = useStore();
  const [isOpen, setIsOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
      name: '',
      color: '#3b82f6' // Default blue
  });

  const handleOpen = (stage?: Stage) => {
      if (stage) {
          setEditingId(stage.id);
          setFormData({ name: stage.name, color: stage.color });
      } else {
          setEditingId(null);
          setFormData({ name: '', color: '#3b82f6' });
      }
      setIsOpen(true);
  };

  const handleSave = () => {
    if (!formData.name.trim()) return;
    
    if (editingId) {
        updateStage(editingId, formData);
    } else {
        addStage(formData);
    }
    setIsOpen(false);
  };

  return (
    <Card>
        <CardHeader className="flex flex-row items-center justify-between">
            <div>
                <CardTitle>Etapas de Ensino</CardTitle>
                <CardDescription>Defina as etapas (ex: Fundamental I, Médio) para organizar as turmas.</CardDescription>
            </div>
            <Button onClick={() => handleOpen()} size="sm" className="gap-2">
                <Plus className="h-4 w-4" /> Nova Etapa
            </Button>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Cor</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {stages.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-muted-foreground h-24">
                    Nenhuma etapa cadastrada.
                  </TableCell>
                </TableRow>
              ) : (
                stages.map((stage) => (
                  <TableRow key={stage.id}>
                    <TableCell className="font-medium">{stage.name}</TableCell>
                    <TableCell>
                        <div className="flex items-center gap-2">
                            <div className="w-4 h-4 rounded-full border" style={{ backgroundColor: stage.color }} />
                            <span className="text-xs text-muted-foreground">{stage.color}</span>
                        </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => handleOpen(stage)}>
                        <Edit2 className="h-4 w-4 text-primary" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => deleteStage(stage.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>

        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogContent onCloseAutoFocus={(e) => e.preventDefault()}>
            <DialogHeader>
              <DialogTitle>{editingId ? 'Editar Etapa' : 'Nova Etapa'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="stage-name">Nome da Etapa</Label>
                <Input 
                  id="stage-name" 
                  value={formData.name} 
                  onChange={(e) => setFormData({...formData, name: e.target.value})} 
                  placeholder="Ex: Fundamental Anos Iniciais"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="stage-color">Cor Identificadora</Label>
                <div className="flex gap-2">
                    <Input 
                        id="stage-color" 
                        type="color"
                        value={formData.color} 
                        onChange={(e) => setFormData({...formData, color: e.target.value})} 
                        className="w-12 h-10 p-1 cursor-pointer"
                    />
                    <Input 
                        value={formData.color} 
                        onChange={(e) => setFormData({...formData, color: e.target.value})} 
                        placeholder="#000000"
                        className="flex-1"
                    />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsOpen(false)}>Cancelar</Button>
              <Button type="submit" onClick={handleSave}>Salvar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
    </Card>
  );
}
