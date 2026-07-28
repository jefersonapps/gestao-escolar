import { useCallback, useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { FileDown, Loader2, TableProperties, ChevronsUpDown, Check } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useStore } from '@/store/useStore';
import { toast } from 'sonner';
import { save } from '@tauri-apps/plugin-dialog';
import { writeFile } from '@tauri-apps/plugin-fs';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useWorkspacePersistence } from '@/hooks/useWorkspacePersistence';
import { WorkspaceActions } from '@/components/workspace/WorkspaceActions';

interface ColumnConfig {
  id: string;
  label: string;
  field: string; // key in Student object or special handler
  checked: boolean;
  width?: number; // for PDF
}

const AVAILABLE_COLUMNS: ColumnConfig[] = [
  { id: 'educacensoId', label: 'ID Educacenso', field: 'educacensoId', checked: false, width: 20 },
  { id: 'name', label: 'Nome do Estudante', field: 'name', checked: true, width: 60 },
  { id: 'email', label: 'E-mail', field: 'email', checked: false, width: 40 },
  { id: 'cpf', label: 'CPF', field: 'cpf', checked: true, width: 30 },
  { id: 'rg', label: 'RG', field: 'rg', checked: false, width: 20 },
  { id: 'sex', label: 'Sexo', field: 'sex', checked: false, width: 15 },
  { id: 'birthDate', label: 'Data de Nascimento', field: 'birthDate', checked: true, width: 25 },
  { id: 'age', label: 'Idade', field: 'age', checked: false, width: 10 },
  { id: 'responsiblePhone', label: 'Telefone', field: 'responsiblePhone', checked: false, width: 30 },
  { id: 'address', label: 'Endereço', field: 'address', checked: false, width: 50 },
  { id: 'birthCertificate', label: 'Certidão de Nascimento', field: 'birthCertificate', checked: false, width: 40 },
  { id: 'sus', label: 'Cartão do SUS', field: 'sus', checked: false, width: 30 },
  { id: 'nis', label: 'NIS', field: 'nis', checked: false, width: 25 },
  { id: 'responsibleName', label: 'Responsável', field: 'responsibleName', checked: false, width: 40 },
  { id: 'responsibleKinship', label: 'Parentesco', field: 'responsibleKinship', checked: false, width: 20 },
  { id: 'responsibleCpf', label: 'CPF do Responsável', field: 'responsibleCpf', checked: false, width: 30 },
  { id: 'responsibleJob', label: 'Profissão do Responsável', field: 'responsibleJob', checked: false, width: 30 },
  { id: 'fatherName', label: 'Pai', field: 'fatherName', checked: false, width: 40 },
  { id: 'fatherCpf', label: 'CPF do Pai', field: 'fatherCpf', checked: false, width: 30 },
  { id: 'motherName', label: 'Mãe', field: 'motherName', checked: false, width: 40 },
  { id: 'motherCpf', label: 'CPF da Mãe', field: 'motherCpf', checked: false, width: 30 },
  { id: 'naturalness', label: 'Naturalidade', field: 'naturalness', checked: false, width: 25 },
  { id: 'colorRace', label: 'Cor/Raça', field: 'colorRace', checked: false, width: 20 },
  { id: 'transport', label: 'Transporte', field: 'transport', checked: false, width: 15 },
  { id: 'bolsaFamilia', label: 'Bolsa Família', field: 'bolsaFamilia', checked: false, width: 15 },
];

const DEFAULT_REPORT_TITLE = 'Relatório de Alunos';

interface CustomTableWorkspaceData {
  selectedClassIds: string[];
  columns: ColumnConfig[];
  reportTitle: string;
  excludedStudentIds: string[];
}

export function CustomTableControl() {
  const { classes } = useStore();
  const [selectedClassIds, setSelectedClassIds] = useState<string[]>([]);
  const [columns, setColumns] = useState<ColumnConfig[]>(AVAILABLE_COLUMNS);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [reportTitle, setReportTitle] = useState(DEFAULT_REPORT_TITLE);
  const [excludedStudentIds, setExcludedStudentIds] = useState<string[]>([]);

  const [isPopoverOpen, setIsPopoverOpen] = useState(false);

  const workspaceData = useMemo<CustomTableWorkspaceData>(
    () => ({ selectedClassIds, columns, reportTitle, excludedStudentIds }),
    [columns, excludedStudentIds, reportTitle, selectedClassIds],
  );

  const getWorkspaceName = useCallback((workspace: CustomTableWorkspaceData) => {
    const suffix = workspace.selectedClassIds.length > 0 ? `${workspace.selectedClassIds.length}_turmas` : 'sem_turmas';
    return `Tabelas_${suffix}`;
  }, []);

  const restoreWorkspace = useCallback((workspace: CustomTableWorkspaceData) => {
    setSelectedClassIds(Array.isArray(workspace.selectedClassIds) ? workspace.selectedClassIds : []);
    setColumns(Array.isArray(workspace.columns) ? workspace.columns : AVAILABLE_COLUMNS);
    setReportTitle(workspace.reportTitle || DEFAULT_REPORT_TITLE);
    setExcludedStudentIds(Array.isArray(workspace.excludedStudentIds) ? workspace.excludedStudentIds : []);
  }, []);

  const clearWorkspace = useCallback(() => {
    setSelectedClassIds([]);
    setColumns(AVAILABLE_COLUMNS);
    setReportTitle(DEFAULT_REPORT_TITLE);
    setExcludedStudentIds([]);
  }, []);

  const workspace = useWorkspacePersistence({
    tabType: 'tables',
    data: workspaceData,
    onRestore: restoreWorkspace,
    getDefaultName: getWorkspaceName,
    isDataEmpty: (workspaceValue) =>
      workspaceValue.selectedClassIds.length === 0 &&
      workspaceValue.reportTitle === DEFAULT_REPORT_TITLE &&
      workspaceValue.excludedStudentIds.length === 0 &&
      JSON.stringify(workspaceValue.columns) === JSON.stringify(AVAILABLE_COLUMNS),
  });

  // Filter classes to only show those that have students or are relevant? 
  // No, let user select any. But sorting by name is nice.
  const sortClasses = (a: { name: string }, b: { name: string }) => {
      // Normalize to fix symbol variations (like 'º' vs '°') that break alphabetic sorting
      const norm = (str: string) => str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/[^A-Z0-9]/g, ' ').replace(/\s+/g, ' ').trim();
      const aName = norm(a.name);
      const bName = norm(b.name);
      
      const aIsPre = aName.includes('PRE');
      const bIsPre = bName.includes('PRE');

      if (aIsPre && !bIsPre) return -1;
      if (!aIsPre && bIsPre) return 1;

      return aName.localeCompare(bName, 'pt-BR', { numeric: true });
  };

  const sortedClasses = useMemo(() => [...classes].sort(sortClasses), [classes]);

  const selectedClasses = useMemo(() => 
    classes.filter(c => selectedClassIds.includes(c.id)).sort(sortClasses), 
  [classes, selectedClassIds]);
  
  // Prepare Data for Preview (Concatenated)
  // We want to show which class they belong to in preview, maybe?
  const previewData = useMemo(() => {
     let allData: any[] = [];
     
     selectedClasses.forEach(cls => {
         if (!cls.students) return;
         
         const classStudents = cls.students.map(student => {
             // Calculate Age
             let age = '';
             if (student.birthDate) {
                 try {
                    const [day, month, year] = student.birthDate.split('/').map(Number);
                    const birth = new Date(year, month - 1, day);
                    const today = new Date();
                    let a = today.getFullYear() - birth.getFullYear();
                    const m = today.getMonth() - birth.getMonth();
                    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
                        a--;
                    }
                    if (!isNaN(a)) age = a.toString();
                 } catch (e) {}
             }
             
             return {
                 ...student,
                 age,
                 _className: cls.name // Internal field for grouping/display
             };
         });
         allData = [...allData, ...classStudents];
     });
     
     return allData;
  }, [selectedClasses]);

  const toggleColumn = (id: string) => {
      setColumns(prev => prev.map(col => 
          col.id === id ? { ...col, checked: !col.checked } : col
      ));
  };
  
  const toggleClassSelection = (id: string) => {
      setSelectedClassIds(prev => {
          const newSelection = prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id];
          // Clear exclusions if selection changes (optional, but good for UX)
          setExcludedStudentIds([]);
          return newSelection;
      });
  };

  const selectAllClasses = () => {
      setExcludedStudentIds([]);
      if (selectedClassIds.length === classes.length) {
          setSelectedClassIds([]);
      } else {
          setSelectedClassIds(classes.map(c => c.id));
      }
  };

  const toggleStudentExclusion = (studentId: string) => {
      setExcludedStudentIds(prev => 
          prev.includes(studentId) ? prev.filter(id => id !== studentId) : [...prev, studentId]
      );
  };


const loadImageAsBase64 = async (url: string, format: 'image/png' | 'image/jpeg' = 'image/png', quality: number = 0.8): Promise<string | null> => {
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
            if (format === 'image/jpeg') {
                ctx.fillStyle = '#FFFFFF';
                // @ts-ignore
                ctx.fillRect(0, 0, canvas.width, canvas.height);
            }
            ctx.drawImage(img, 0, 0);
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

  const handleGeneratePdf = async () => {
      if (selectedClasses.length === 0) {
          toast.error("Selecione pelo menos uma turma.");
          return;
      }
      
      const activeColumns = columns.filter(c => c.checked);
      if (activeColumns.length === 0) {
          toast.error("Selecione pelo menos uma coluna.");
          return;
      }

      setIsGeneratingPdf(true);
      try {
          const worker = new Worker(new URL('../../workers/customTablePdf.worker.ts', import.meta.url), {
              type: 'module'
          });

         const [logoBase64, logoRightBase64, footerBase64] = await Promise.all([
            loadImageAsBase64('/images/logo-Goncala.png', 'image/png'),
            loadImageAsBase64('/images/logo-SEDUC.png', 'image/png', 0.8),
            loadImageAsBase64('/images/RODAPE.png', 'image/jpeg', 0.8)
         ]);

         const pdfColumns = activeColumns.map(c => ({
             header: c.label.toUpperCase(),
             dataKey: c.field,
             width: c.width
         }));

         // Prepare Datasets
         const datasets = selectedClasses.map(cls => {
             const data = (cls.students || [])
                 .filter(s => !excludedStudentIds.includes(s.id))
                 .map(student => {
                     let age = '';
                     if (student.birthDate) {
                     try {
                        const [day, month, year] = student.birthDate.split('/').map(Number);
                        const birth = new Date(year, month - 1, day);
                        const today = new Date();
                        let a = today.getFullYear() - birth.getFullYear();
                        const m = today.getMonth() - birth.getMonth();
                        if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
                            a--;
                        }
                        if (!isNaN(a)) age = a.toString();
                     } catch (e) {}
                 }
                 return { ...student, age };
             });

             return {
                 subTitle: cls.name,
                 data
             };
         });

         worker.postMessage({
             title: reportTitle,
             columns: pdfColumns,
             datasets, // Array of { subTitle, data }
             logoBase64,
             logoRightBase64,
             footerBase64
         });

         worker.onmessage = async (e: MessageEvent) => {
            if (e.data.success) {
                try {
                    const defaultName = selectedClasses.length === 1 
                        ? `${reportTitle}_${selectedClasses[0].name}.pdf`
                        : `${reportTitle}_VariasTurmas.pdf`;

                    const filePath = await save({
                        defaultPath: defaultName,
                        filters: [{ name: 'PDF', extensions: ['pdf'] }],
                    });

                    if (filePath) {
                        await writeFile(filePath, new Uint8Array(e.data.pdfBuffer));
                        toast.success('Relatório salvo com sucesso!');
                    }
                } catch (err) {
                    console.error(err);
                    toast.error('Erro ao salvar arquivo.');
                }
            } else {
                toast.error('Erro ao gerar PDF: ' + e.data.error);
            }
            worker.terminate();
            setIsGeneratingPdf(false);
         };

      } catch (e) {
          console.error(e);
          toast.error('Erro ao iniciar worker.');
          setIsGeneratingPdf(false);
      }
  };

  return (
    <div className="h-[calc(100vh-140px)] flex flex-col overflow-hidden">
       <div className="mb-4 shrink-0">
          <WorkspaceActions
            tabType="tables"
            controller={workspace}
            defaultName={getWorkspaceName(workspaceData)}
            onClearData={clearWorkspace}
          />
       </div>
       <Card className="flex flex-col h-full border-none shadow-none bg-transparent overflow-hidden">
          <CardHeader className="px-0 pt-0 shrink-0">
             <CardTitle className="flex items-center gap-2 text-xl">
                <TableProperties className="w-6 h-6" />
                Gerador de Tabelas Personalizadas
             </CardTitle>
          </CardHeader>
          <CardContent className="px-0 flex-1 flex flex-col min-h-0 overflow-hidden">
             <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-full min-h-0">
                
                {/* Controls - Left Pane */}
                <div className="lg:col-span-4 flex flex-col h-full min-h-0">
                    <ScrollArea className="flex-1 pr-4">
                        <div className="space-y-6 p-1">
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <Label>Título do Relatório</Label>
                                    <Input value={reportTitle} onChange={e => setReportTitle(e.target.value)} />
                                </div>

                                <div className="space-y-2">
                                    <Label>Selecione as Turmas</Label>
                                    <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
                                        <PopoverTrigger asChild>
                                            <Button variant="outline" role="combobox" aria-expanded={isPopoverOpen} className="w-full justify-between">
                                                {selectedClassIds.length > 0 
                                                    ? `${selectedClassIds.length} turma(s) selecionada(s)`
                                                    : "Selecione turmas..."}
                                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-75 p-0" align="start">
                                            <div className="p-2 border-b">
                                                <div 
                                                    className="flex items-center gap-2 p-2 hover:bg-accent rounded-sm cursor-pointer"
                                                    onClick={selectAllClasses}
                                                >
                                                    <div className={cn(
                                                        "flex h-4 w-4 items-center justify-center rounded-sm border border-primary",
                                                        selectedClassIds.length === classes.length ? "bg-primary text-primary-foreground" : "opacity-50 [&_svg]:invisible"
                                                    )}>
                                                        <Check className={cn("h-4 w-4")} />
                                                    </div>
                                                    <span className="text-sm font-medium">Selecionar Todas</span>
                                                </div>
                                            </div>
                                            <ScrollArea className="h-50">
                                                <div className="p-1">
                                                    {sortedClasses.map((cls) => (
                                                        <div
                                                            key={cls.id}
                                                            className="flex items-center gap-2 p-2 hover:bg-accent rounded-sm cursor-pointer"
                                                            onClick={() => toggleClassSelection(cls.id)}
                                                        >
                                                            <div className={cn(
                                                                "flex h-4 w-4 items-center justify-center rounded-sm border border-primary",
                                                                selectedClassIds.includes(cls.id) ? "bg-primary text-primary-foreground" : "opacity-50 [&_svg]:invisible"
                                                            )}>
                                                                <Check className={cn("h-4 w-4")} />
                                                            </div>
                                                            <span className="text-sm">{cls.name}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </ScrollArea>
                                        </PopoverContent>
                                    </Popover>
                                </div>

                                <div className="space-y-2">
                                    <Label>Colunas Disponíveis</Label>
                                    <div className="grid grid-cols-1 gap-2 border rounded-md p-3 bg-muted/20">
                                        {columns.map(col => (
                                            <div key={col.id} className="flex items-center space-x-2 p-1 hover:bg-accent/50 rounded transition-colors">
                                                <Checkbox 
                                                    id={col.id} 
                                                    checked={col.checked} 
                                                    onCheckedChange={() => toggleColumn(col.id)} 
                                                />
                                                <Label htmlFor={col.id} className="cursor-pointer flex-1 font-normal select-none">{col.label}</Label>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                            
                            <div className="flex flex-col gap-2 pt-2">
                                <Button 
                                    onClick={handleGeneratePdf} 
                                    disabled={selectedClassIds.length === 0 || isGeneratingPdf}
                                    className="w-full"
                                >
                                    {isGeneratingPdf ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileDown className="mr-2 h-4 w-4" />}
                                    Gerar PDF (Múltiplas Páginas)
                                </Button>
                            </div>
                        </div>
                    </ScrollArea>
                </div>

                {/* Preview - Right Pane */}
                <div className="lg:col-span-8 flex flex-col h-full min-h-0">
                    <div className="border rounded-md overflow-hidden bg-background shadow-sm flex flex-col h-full ring-1 ring-border">
                        <div className="bg-muted/40 px-4 py-3 border-b font-medium text-sm flex justify-between items-center shrink-0">
                            <span>Pré-visualização da Tabela</span>
                            <span className="text-muted-foreground text-xs">
                                {previewData.length} registros • {selectedClassIds.length} turmas
                            </span>
                        </div>
                        <div className="flex-1 min-h-0 bg-card">
                             {previewData.length > 0 ? (
                                 <ScrollArea className="h-full">
                                     <Table>
                                         <TableHeader className="sticky top-0 bg-secondary z-10 shadow-sm">
                                             <TableRow className="hover:bg-transparent border-b-primary/20">
                                                {/* Extra column for Class Name in preview if multiple classes selected? */}
                                                {selectedClassIds.length > 1 && (
                                                    <TableHead className="whitespace-nowrap font-bold text-primary w-37.5">Turma</TableHead>
                                                )}
                                                 {columns.filter(c => c.checked).map(c => (
                                                     <TableHead key={c.id} className="whitespace-nowrap font-bold text-primary">{c.label}</TableHead>
                                                 ))}
                                                 <TableHead className="w-10"></TableHead>
                                             </TableRow>
                                         </TableHeader>
                                         <TableBody>
                                             {previewData.map((row, idx) => {
                                                 const isExcluded = excludedStudentIds.includes(row.id);
                                                 return (
                                                     <TableRow 
                                                         key={`preview-${row.id || idx}-${row._className || ''}`} 
                                                         className={cn("hover:bg-muted/30 border-b-border/50 transition-colors", isExcluded && "opacity-40")}
                                                     >
                                                        {selectedClassIds.length > 1 && (
                                                            <TableCell className="whitespace-nowrap text-xs font-medium text-muted-foreground">
                                                                {row._className}
                                                            </TableCell>
                                                        )}
                                                         {columns.filter(c => c.checked).map(c => {
                                                             let val = (row as any)[c.field];
                                                             if (typeof val === 'boolean') val = val ? 'Sim' : 'Não';
                                                             return (
                                                                 <TableCell key={c.id} className="whitespace-nowrap text-xs py-2">
                                                                    {val || <span className="text-muted-foreground/30">-</span>}
                                                                 </TableCell>
                                                             );
                                                         })}
                                                         <TableCell className="w-10">
                                                            <Button 
                                                                variant="ghost" 
                                                                size="icon" 
                                                                className="h-6 w-6 text-muted-foreground hover:text-red-500" 
                                                                onClick={() => toggleStudentExclusion(row.id)}
                                                                title={isExcluded ? "Incluir aluno novamente" : "Remover aluno do relatório"}
                                                            >
                                                                {isExcluded ? <Check className="h-4 w-4 text-green-500" /> : <Loader2 className="h-4 w-4 hidden" /> /* Using a placeholder icon, let's substitute with a clear/x icon or just styling if we don't import X */}
                                                                {isExcluded ? null : <span className="text-xs font-bold leading-none">X</span>}
                                                            </Button>
                                                         </TableCell>
                                                     </TableRow>
                                                 );
                                             })}
                                         </TableBody>
                                     </Table>
                                 </ScrollArea>
                             ) : (
                                 <div className="h-full flex flex-col items-center justify-center text-muted-foreground p-8 text-center space-y-4">
                                     <div className="bg-muted/20 p-6 rounded-full">
                                         <TableProperties className="w-12 h-12 opacity-20" />
                                     </div>
                                     <p>Selecione turmas para visualizar a prévia dos dados.</p>
                                 </div>
                             )}
                        </div>
                    </div>
                </div>

             </div>
          </CardContent>
       </Card>
    </div>
  );
}
