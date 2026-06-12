import { save } from '@tauri-apps/plugin-dialog';
import { writeFile } from '@tauri-apps/plugin-fs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { FileDown, Plus, LayoutList, Download, Loader2, Trash2 } from 'lucide-react';
import { useStore } from '@/store/useStore';
import { toast } from 'sonner';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogDescription,
} from "@/components/ui/dialog";
import { useState } from 'react';

interface InfrequencyData {
  id: string; // Class ID or generated ID
  name: string; // Class Name
  totalStudents: number | string;
  faults: number | string;
  observations: string;
}

export function InfrequencyControl() {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [data, setData] = useState<InfrequencyData[]>([]);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  
  // Manual Add State
  const [isManualAddOpen, setIsManualAddOpen] = useState(false);
  const [newClassName, setNewClassName] = useState('');
  const [newClassStudents, setNewClassStudents] = useState<number>(0);

  const classes = useStore((s) => s.classes);

  // Initial load / Sync with existing store classes (optional, maybe user wants to start empty?)
  // Requirement says: "Importar do SGEdu", "Adicionar Manualmente".
  // It effectively replaces "Sync With Store" button with a more robust import logic.
  // But we can keep "Importar das Turmas Cadastradas" as an option too.
  
  const sortData = (items: InfrequencyData[]) => {
      // Normalize to fix symbol variations (like 'º' vs '°') that break alphabetic sorting
      const norm = (str: string) => str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/[^A-Z0-9]/g, ' ').replace(/\s+/g, ' ').trim();
      
      return [...items].sort((a, b) => {
          const aName = norm(a.name);
          const bName = norm(b.name);
          
          const aIsPre = aName.includes('PRE');
          const bIsPre = bName.includes('PRE');

          if (aIsPre && !bIsPre) return -1;
          if (!aIsPre && bIsPre) return 1;

          return aName.localeCompare(bName, 'pt-BR', { numeric: true });
      });
  };

  const handleImportFromStore = () => {
    const newData: InfrequencyData[] = classes.map(cls => {
       const existing = data.find(d => d.id === cls.id);
       return {
         id: cls.id,
         name: cls.name.replace(/\s*-\s*\d{4}$/, ''), // Remove " - YYYY" suffix
         totalStudents: cls.students?.length || 0,
         faults: existing ? existing.faults : 0,
         observations: existing ? existing.observations : ''
       };
    });
    
    setData(sortData(newData));
    toast.success('Dados importados das turmas cadastradas.');
  };

  const handleManualAdd = () => {
      if (!newClassName.trim()) {
          toast.error('Nome da turma é obrigatório');
          return;
      }

      const newItem: InfrequencyData = {
          id: `manual-${Date.now()}`,
          name: newClassName,
          totalStudents: newClassStudents,
          faults: 0,
          observations: ''
      };

      setData(prev => sortData([...prev, newItem]));
      setNewClassName('');
      setNewClassStudents(0);
      setIsManualAddOpen(false);
      toast.success('Turma adicionada manualmente.');
  };

  // Update field
  const updateField = (id: string, field: keyof InfrequencyData, value: any) => {
    setData(prev => prev.map(item => {
      if (item.id === id) {
        return { ...item, [field]: value };
      }
      return item;
    }));
  };
  
  const removeClass = (id: string) => {
      setData(prev => prev.filter(item => item.id !== id));
      toast.success('Turma removida da lista.');
  };

const loadImageAsBase64 = async (url: string, format: 'image/png' | 'image/jpeg' = 'image/png', quality: number = 0.8): Promise<string | null> => {
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_SIZE = 2000; 
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_SIZE) {
            height *= MAX_SIZE / width;
            width = MAX_SIZE;
          }
        } else {
          if (height > MAX_SIZE) {
            width *= MAX_SIZE / height;
            height = MAX_SIZE;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
            // If JPEG, fill white background to avoid black transparency
            if (format === 'image/jpeg') {
                ctx.fillStyle = '#FFFFFF';
                ctx.fillRect(0, 0, width, height);
            }
            ctx.drawImage(img, 0, 0, width, height);
            resolve(canvas.toDataURL(format, quality)); 
        } else {
            resolve(null);
        }
      };
      img.onerror = () => resolve(null);
      img.src = URL.createObjectURL(blob);
    });
  } catch {
    return null;
  }
};

// ... inside InfrequencyControl ...

  const handleGeneratePdf = async () => {
     setIsGeneratingPdf(true);
     try {
        const worker = new Worker(new URL('../../workers/infrequencyPdf.worker.ts', import.meta.url), {
            type: 'module'
        });

        const [logoBase64, logoRightBase64, footerBase64] = await Promise.all([
            loadImageAsBase64('/images/logo-Goncala.png', 'image/png'), // Keep transparency
            loadImageAsBase64('/images/logo-SEDUC.png', 'image/png', 0.8),
            loadImageAsBase64('/images/RODAPE.png', 'image/jpeg', 0.8) // Convert to JPEG for size
        ]);
        
        // Sanitize data to ensure numbers
        const validData = data.map(item => ({
            ...item,
            totalStudents: Number(item.totalStudents) || 0,
            faults: Number(item.faults) || 0
        }));

        worker.postMessage({
            date,
            data: validData,
            logoBase64,
            logoRightBase64,
            footerBase64
        });

        worker.onmessage = async (e: MessageEvent) => {
             // ... existing handler ...
             if (e.data.success) {
                try {
                    const pdfBuffer = e.data.pdfBuffer;
                    const defaultName = `Infrequencia_${date}.pdf`;
                    
                    const filePath = await save({
                        defaultPath: defaultName,
                        filters: [{ name: 'PDF', extensions: ['pdf'] }],
                    });

                    if (filePath) {
                        await writeFile(filePath, new Uint8Array(pdfBuffer));
                        toast.success('Relatório salvo com sucesso!');
                    }
                } catch (err) {
                    console.error('Error saving file:', err);
                    toast.error('Erro ao salvar o arquivo.');
                }
            } else {
                toast.error('Erro ao gerar relatório: ' + e.data.error);
            }
            worker.terminate();
            setIsGeneratingPdf(false);
        };

     } catch (error) {
         console.error(error);
         toast.error("Erro ao iniciar geração do PDF");
         setIsGeneratingPdf(false);
     }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Controle de Infrequência</CardTitle>
          <div className="flex gap-2">
             <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="outline">
                        <LayoutList className="w-4 h-4 mr-2" />
                        Importar / Adicionar
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={handleImportFromStore}>
                        <Download className="w-4 h-4 mr-2" />
                        Do Cadastro (Local)
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setIsManualAddOpen(true)}>
                        <Plus className="w-4 h-4 mr-2" />
                        Adicionar Manualmente
                    </DropdownMenuItem>
                </DropdownMenuContent>
             </DropdownMenu>

             <Button onClick={handleGeneratePdf} disabled={isGeneratingPdf || data.length === 0}>
                {isGeneratingPdf ? <Loader2 className="w-4 h-4 mr-2 animate-spin"/> : <FileDown className="w-4 h-4 mr-2" />}
                Gerar Relatório
             </Button>
          </div>
        </CardHeader>
        <CardContent>
           <div className="mb-6 max-w-sm space-y-2">
              <Label>Data de Referência</Label>
              <Input type="date" value={date} onChange={e => setDate(e.target.value)} />
           </div>

           <div className="border rounded-md">
              <Table>
                 <TableHeader>
                    <TableRow>
                       <TableHead>TURMAS</TableHead>
                       <TableHead className="text-center w-[120px]">QTD. ESTUDANTES</TableHead>
                       <TableHead className="text-center w-[100px]">FALTAS</TableHead>
                       <TableHead className="text-center w-[100px]">PRESENTES</TableHead>
                       <TableHead>OBSERVAÇÕES</TableHead>
                       <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                 </TableHeader>
                 <TableBody>
                    {data.map(row => {
                        const totalStudents = Number(row.totalStudents);
                        const faults = Number(row.faults);
                        const presentes = totalStudents - faults;
                        const isFullPresence = faults === 0 && totalStudents > 0;
                        
                        return (
                            <TableRow key={row.id}>
                               <TableCell className="font-medium">{row.name}</TableCell>
                               <TableCell className="text-center">
                                   <Input 
                                      type="number" 
                                      className="h-8 w-20 mx-auto text-center" 
                                      value={row.totalStudents}
                                      onChange={e => updateField(row.id, 'totalStudents', e.target.value)}
                                      onBlur={e => {
                                          let val = parseInt(e.target.value);
                                          if (isNaN(val) || val < 0) val = 0;
                                          updateField(row.id, 'totalStudents', val);
                                      }}
                                   />
                               </TableCell>
                               <TableCell className="text-center">
                                   <Input 
                                      type="number" 
                                      className="h-8 w-20 mx-auto text-center" 
                                      value={row.faults}
                                      onChange={e => {
                                          const val = e.target.value;
                                          if (val === '') {
                                              updateField(row.id, 'faults', val);
                                              return;
                                          }
                                          
                                          const numVal = parseInt(val);
                                          const max = Number(row.totalStudents) || 0;

                                          if (!isNaN(numVal)) {
                                              if (numVal > max) {
                                                  updateField(row.id, 'faults', max);
                                              } else if (numVal < 0) {
                                                  updateField(row.id, 'faults', 0);
                                              } else {
                                                  updateField(row.id, 'faults', val);
                                              }
                                          }
                                      }}
                                      onBlur={e => {
                                          // If empty on blur, set to 0
                                          if (e.target.value === '') {
                                              updateField(row.id, 'faults', 0);
                                          }
                                      }}
                                   />
                               </TableCell>
                               <TableCell className="text-center">
                                   <div className={`py-1 px-2 rounded text-sm font-semibold ${isFullPresence ? 'bg-green-200 text-green-800' : ''}`}>
                                       {isFullPresence ? '100% presente' : presentes}
                                   </div>
                               </TableCell>
                               <TableCell>
                                   <Input 
                                      className="h-8" 
                                      value={row.observations}
                                      placeholder="Observações..."
                                      onChange={e => updateField(row.id, 'observations', e.target.value)}
                                   />
                               </TableCell>
                               <TableCell>
                                   <Button 
                                       variant="ghost" 
                                       size="icon" 
                                       className="h-8 w-8 text-muted-foreground hover:text-red-600" 
                                       onClick={() => removeClass(row.id)}
                                   >
                                       <Trash2 className="h-4 w-4" />
                                   </Button>
                               </TableCell>
                            </TableRow>
                        );
                    })}
                    {data.length === 0 && (
                        <TableRow>
                            <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                                Nenhuma turma na lista. Importe ou adicione manualmente.
                            </TableCell>
                        </TableRow>
                    )}
                 </TableBody>
              </Table>
           </div>
           
           <div className="mt-4 flex justify-end gap-8 text-sm font-medium">
               <span>Total Estudantes: {data.reduce((acc, curr) => acc + (Number(curr.totalStudents) || 0), 0)}</span>
               <span>Total Faltas: {data.reduce((acc, curr) => acc + (Number(curr.faults) || 0), 0)}</span>
               <span>Total Presentes: {data.reduce((acc, curr) => acc + ((Number(curr.totalStudents) || 0) - (Number(curr.faults) || 0)), 0)}</span>
           </div>

        </CardContent>
      </Card>

      <Dialog open={isManualAddOpen} onOpenChange={setIsManualAddOpen}>
          <DialogContent>
              <DialogHeader>
                  <DialogTitle>Adicionar Turma Manualmente</DialogTitle>
                  <DialogDescription>
                      Informe o nome da turma e a quantidade de alunos.
                  </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                  <div className="space-y-2">
                      <Label>Nome da Turma</Label>
                      <Input 
                          placeholder="Ex: 5º Ano A" 
                          value={newClassName} 
                          onChange={e => setNewClassName(e.target.value)}
                      />
                  </div>
                  <div className="space-y-2">
                      <Label>Quantidade de Estudantes</Label>
                      <Input 
                          type="number" 
                          value={newClassStudents} 
                          onChange={e => setNewClassStudents(parseInt(e.target.value) || 0)}
                      />
                  </div>
              </div>
              <DialogFooter>
                  <Button variant="outline" onClick={() => setIsManualAddOpen(false)}>Cancelar</Button>
                  <Button onClick={handleManualAdd}>Adicionar</Button>
              </DialogFooter>
          </DialogContent>
      </Dialog>
    </div>
  );
}
