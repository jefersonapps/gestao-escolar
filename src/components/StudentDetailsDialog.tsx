import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { type Student, type Responsible, type Phone as PhoneType } from '@/types';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Calendar, User, Phone, FileText, RefreshCw, Loader2, Edit2, Save, X, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useState, useEffect } from 'react';
import { maskCPF, maskPhone, maskDate, validateCPF, calculateAge } from '@/lib/utils';
import { toast } from 'sonner';
import { useStore } from '@/store/useStore';
import { cn } from '@/lib/utils';
import { useExternalAuth } from '@/hooks/useExternalAuth';

interface StudentDetailsDialogProps {
  student: Student | null;
  classId?: string;
  isOpen: boolean;
  onClose: () => void;
  onRefresh?: () => Promise<void>;
  onUpdate?: (student: Student) => void;
  onDelete?: (studentId: string, classId: string) => void;
}

export function StudentDetailsDialog({ student, classId, isOpen, onClose, onRefresh, onUpdate, onDelete }: StudentDetailsDialogProps) {
  const { classes, transferStudent } = useStore();
  const { requireSession } = useExternalAuth('sgedu');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<Partial<Student>>({});
  const [isDeleting, setIsDeleting] = useState(false);
  
  // Transfer state
  const [isTransferring, setIsTransferring] = useState(false);
  const [targetClassId, setTargetClassId] = useState<string>('');

  useEffect(() => {
    if (student) {
        setFormData({ 
            ...student,
            // Ensure arrays exist
            responsibles: student.responsibles || (student.responsibleName ? [{ name: student.responsibleName, kinship: 'Responsável', cpf: '' }] : []),
            phones: student.phones || (student.responsiblePhone ? [{ number: student.responsiblePhone, type: 'cel', description: 'Principal' }] : [])
        });
    }
    setIsEditing(false);
  }, [student, isOpen]);


  if (!student) return null;

  const handleRefresh = async () => {
      if (onRefresh) {
          if (!(await requireSession())) return;
          setIsRefreshing(true);
          await onRefresh();
          setIsRefreshing(false);
      }
  };

  const handleSave = () => {
      if (onUpdate && formData) {
          // Validate CPFs
          if (formData.cpf && !validateCPF(formData.cpf)) {
              toast.error('CPF do aluno inválido.');
              return;
          }
          const invalidRespCpf = formData.responsibles?.find(r => r.cpf && !validateCPF(r.cpf));
          if (invalidRespCpf) {
              toast.error(`CPF do responsável ${invalidRespCpf.name} é inválido.`);
              return;
          }

          // Validate Age
          if (formData.birthDate) {
               const age = calculateAge(formData.birthDate);
               if (age === null) {
                   toast.error('Data de nascimento inválida (DD/MM/AAAA).');
                   return;
               }
               if (age < 3) {
                   toast.error('O aluno deve ter pelo menos 3 anos de idade.');
                   return;
               }
          }

          onUpdate({ 
               ...student, 
               ...formData,
               // Sync backward compatibility fields (optional, but good for safety)
               responsibleName: formData.responsibles?.[0]?.name || formData.responsibleName,
               responsiblePhone: formData.phones?.[0]?.number || formData.responsiblePhone
          } as Student);
          setIsEditing(false);
      }
  };

  const handleChange = (field: keyof Student, value: string) => {
      setFormData(prev => ({ ...prev, [field]: value }));
  };

  // --- Responsibles Management ---
  const addResponsible = () => {
      setFormData(prev => ({
          ...prev,
          responsibles: [...(prev.responsibles || []), { name: '', kinship: 'Responsável', cpf: '' }]
      }));
  };

  const removeResponsible = (index: number) => {
      setFormData(prev => ({
          ...prev,
          responsibles: prev.responsibles?.filter((_, i) => i !== index)
      }));
  };

  const updateResponsible = (index: number, field: keyof Responsible, value: string) => {
      setFormData(prev => {
          const newResp = [...(prev.responsibles || [])];
          newResp[index] = { ...newResp[index], [field]: value };
          return { ...prev, responsibles: newResp };
      });
  };

  // --- Phones Management ---
  const addPhone = () => {
      setFormData(prev => ({
          ...prev,
          phones: [...(prev.phones || []), { number: '', type: 'cel', description: '' }]
      }));
  };

  const removePhone = (index: number) => {
      setFormData(prev => ({
          ...prev,
          phones: prev.phones?.filter((_, i) => i !== index)
      }));
  };

  const updatePhone = (index: number, field: keyof PhoneType, value: string) => {
      setFormData(prev => {
          const newPhones = [...(prev.phones || [])];
          newPhones[index] = { ...newPhones[index], [field]: value };
          return { ...prev, phones: newPhones };
      });
  };

  const handleTransfer = () => {
      if (!student || !classId || !targetClassId) return;
      
      transferStudent(student.id, classId, targetClassId);
      toast.success(`Aluno transferido com sucesso!`);
      setIsTransferring(false);
      onClose(); // Close dialog after successful transfer
  };
  
  const handleDelete = () => {
      if (!student || !classId || !onDelete) return;
      onDelete(student.id, classId);
      setIsDeleting(false);
      onClose();
  };
  
  const currentClass = classes.find((c: any) => c.id === classId);
  const availableClasses = classes.filter((c: any) => c.id !== classId);
  
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle>{isEditing ? 'Editar Aluno' : 'Detalhes do Aluno'}</DialogTitle>
            <div className="flex gap-2 mr-8">
                {isDeleting && classId && onDelete && (
                    <div className="flex items-center gap-2 mr-4 bg-destructive/10 px-2 py-1 rounded-md">
                        <span className="text-xs text-destructive font-semibold">Excluir aluno?</span>
                        <Button size="sm" variant="destructive" onClick={handleDelete}>Sim</Button>
                        <Button size="sm" variant="ghost" onClick={() => setIsDeleting(false)}><X className="h-4 w-4" /></Button>
                    </div>
                )}
                
                {!isEditing && classId && currentClass && !isTransferring && !isDeleting && (
                    <>
                        <Button variant="outline" size="sm" onClick={() => setIsTransferring(true)} title="Transferir para outra turma">
                            Transferir
                        </Button>
                        {onDelete && (
                            <Button variant="outline" size="sm" onClick={() => setIsDeleting(true)} title="Excluir aluno da turma">
                                <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                        )}
                    </>
                )}
                
                {isTransferring && classId && (
                    <div className="flex items-center gap-2">
                        <Select value={targetClassId} onValueChange={setTargetClassId}>
                            <SelectTrigger className="w-[200px] h-8 text-xs">
                                <SelectValue placeholder="Selecione a nova turma" />
                            </SelectTrigger>
                            <SelectContent>
                                {availableClasses.map((cls: any) => (
                                    <SelectItem key={cls.id} value={cls.id}>{cls.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <Button size="sm" onClick={handleTransfer} disabled={!targetClassId}>Confirmar</Button>
                        <Button size="sm" variant="ghost" onClick={() => setIsTransferring(false)}>
                            <X className="h-4 w-4" />
                        </Button>
                    </div>
                )}
                
                {!isEditing && !isTransferring && onRefresh && (
                    <Button variant="ghost" size="icon" onClick={handleRefresh} disabled={isRefreshing} title="Atualizar dados do SGEdu">
                        <Loader2 className={cn("h-4 w-4", isRefreshing ? "animate-spin" : "hidden")} />
                        <RefreshCw className={cn("h-4 w-4", isRefreshing ? "hidden" : "block")} />
                    </Button>
                )}
                {!isEditing && !isTransferring && (
                    <Button variant="outline" size="sm" onClick={() => setIsEditing(true)} title="Editar manualmente">
                        <Edit2 className="h-4 w-4 mr-2" />
                        Editar manualmente
                    </Button>
                )}
            </div>
          </div>
        </DialogHeader>
        
        <div className="grid gap-6 py-4">
            {/* Header with Photo and Basic Info */}
            <div className="flex flex-col items-center gap-4 sm:flex-row sm:gap-6">
                <Avatar className="h-24 w-24">
                    <AvatarImage src={student.photoUrl} alt={student.name} />
                    <AvatarFallback>{student.name.charAt(0)}</AvatarFallback>
                </Avatar>
                <div className="flex-1 w-full space-y-4">
                    {isEditing ? (
                        <div className="grid gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="name">Nome Completo</Label>
                                <Input 
                                    id="name" 
                                    value={formData.name || ''} 
                                    onChange={(e) => handleChange('name', e.target.value)} 
                                />
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="cpf">CPF</Label>
                                    <Input 
                                        id="cpf" 
                                        value={formData.cpf || ''} 
                                        onChange={(e) => handleChange('cpf', maskCPF(e.target.value))} 
                                        placeholder="000.000.000-00"
                                        maxLength={14}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="birthDate">Data Nasc.</Label>
                                    <Input 
                                        id="birthDate" 
                                        value={formData.birthDate || ''} 
                                        onChange={(e) => handleChange('birthDate', maskDate(e.target.value))} 
                                        placeholder="dd/mm/aaaa"
                                        maxLength={10}
                                    />
                                </div>
                            </div>
                            <div className="grid gap-4 mt-2 border-t pt-4">
                                <h4 className="font-medium text-sm">Informações Adicionais / Documentos</h4>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="rg">RG</Label>
                                        <Input id="rg" value={formData.rg || ''} onChange={(e) => handleChange('rg', e.target.value)} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="sus">Cartão SUS</Label>
                                        <Input id="sus" value={formData.sus || ''} onChange={(e) => handleChange('sus', e.target.value)} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="nis">NIS</Label>
                                        <Input id="nis" value={formData.nis || ''} onChange={(e) => handleChange('nis', e.target.value)} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="matricula">Matrícula</Label>
                                        <Input id="matricula" value={formData.matricula || ''} onChange={(e) => handleChange('matricula', e.target.value)} />
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="address">Endereço</Label>
                                        <Input id="address" value={formData.address || ''} onChange={(e) => handleChange('address', e.target.value)} />
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="text-center sm:text-left space-y-1">
                            <h3 className="text-xl font-semibold">{student.name}</h3>
                            <p className="text-sm text-muted-foreground">ID: {student.id}</p>
                            <div className="flex flex-wrap gap-4 justify-center sm:justify-start mt-2">
                                {student.cpf && (
                                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                        <FileText className="h-4 w-4" />
                                        <span>CPF: {student.cpf}</span>
                                    </div>
                                )}
                                {student.birthDate && (
                                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                        <Calendar className="h-4 w-4" />
                                        <span>Nascimento: {student.birthDate}</span>
                                    </div>
                                )}
                                {student.sus && (
                                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                        <FileText className="h-4 w-4" />
                                        <span>SUS: {student.sus}</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <div className="grid gap-6 sm:grid-cols-2">
                {/* Responsibles Section */}
                <div className="space-y-4 rounded-lg border p-4 bg-muted/30">
                    <div className="flex items-center justify-between">
                        <h4 className="font-medium flex items-center gap-2">
                            <User className="h-4 w-4" />
                            Responsáveis
                        </h4>
                        {isEditing && (
                            <Button variant="outline" size="sm" onClick={addResponsible}>
                                <Plus className="h-3 w-3 mr-1" /> Adicionar
                            </Button>
                        )}
                    </div>
                    
                    <div className="space-y-3">
                        {formData.responsibles?.map((resp, index) => (
                            <div key={index} className="p-3 bg-background rounded-md border text-sm space-y-2 relative">
                                {isEditing ? (
                                    <>
                                        <div className="absolute right-2 top-2">
                                            <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => removeResponsible(index)}>
                                                <Trash2 className="h-3 w-3" />
                                            </Button>
                                        </div>
                                        <div className="grid gap-2">
                                            <div className="space-y-1">
                                                <Label className="text-xs">Nome</Label>
                                                <Input 
                                                    value={resp.name} 
                                                    onChange={(e) => updateResponsible(index, 'name', e.target.value)}
                                                    className="h-8"
                                                />
                                            </div>
                                            <div className="grid grid-cols-2 gap-2">
                                                <div className="space-y-1">
                                                    <Label className="text-xs">Vínculo</Label>
                                                    <Select value={resp.kinship} onValueChange={(v) => updateResponsible(index, 'kinship', v)}>
                                                        <SelectTrigger className="h-8">
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="Mãe">Mãe</SelectItem>
                                                            <SelectItem value="Pai">Pai</SelectItem>
                                                            <SelectItem value="Responsável">Responsável</SelectItem>
                                                            <SelectItem value="Avó">Avó</SelectItem>
                                                            <SelectItem value="Avô">Avô</SelectItem>
                                                            <SelectItem value="Tio(a)">Tio(a)</SelectItem>
                                                            <SelectItem value="Irmão(ã)">Irmão(ã)</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                                <div className="space-y-1">
                                                    <Label className="text-xs">CPF</Label>
                                                    <Input 
                                                        value={resp.cpf || ''}
                                                        onChange={(e) => updateResponsible(index, 'cpf', maskCPF(e.target.value))}
                                                        className="h-8"
                                                        placeholder="000.000.000-00"
                                                        maxLength={14}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        <div className="font-medium">{resp.name}</div>
                                        <div className="flex justify-between text-muted-foreground text-xs">
                                            <span>{resp.kinship}</span>
                                            {resp.cpf && <span>CPF: {resp.cpf}</span>}
                                        </div>
                                    </>
                                )}
                            </div>
                        ))}
                        {(!formData.responsibles || formData.responsibles.length === 0) && (
                            <p className="text-xs text-muted-foreground text-center py-2">Nenhum responsável cadastrado.</p>
                        )}
                    </div>
                </div>

                {/* Phones Section */}
                <div className="space-y-4 rounded-lg border p-4 bg-muted/30">
                    <div className="flex items-center justify-between">
                        <h4 className="font-medium flex items-center gap-2">
                            <Phone className="h-4 w-4" />
                            Telefones
                        </h4>
                        {isEditing && (
                            <Button variant="outline" size="sm" onClick={addPhone}>
                                <Plus className="h-3 w-3 mr-1" /> Adicionar
                            </Button>
                        )}
                    </div>
                    
                    <div className="space-y-3">
                         {formData.phones?.map((phone, index) => (
                            <div key={index} className="p-3 bg-background rounded-md border text-sm space-y-2 relative">
                                {isEditing ? (
                                    <>
                                        <div className="absolute right-2 top-2">
                                            <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => removePhone(index)}>
                                                <Trash2 className="h-3 w-3" />
                                            </Button>
                                        </div>
                                        <div className="grid gap-2">
                                            <div className="space-y-1">
                                                <Label className="text-xs">Número</Label>
                                                <Input 
                                                    value={phone.number} 
                                                    onChange={(e) => updatePhone(index, 'number', maskPhone(e.target.value))}
                                                    className="h-8"
                                                    placeholder="(00) 00000-0000"
                                                    maxLength={15}
                                                />
                                            </div>
                                            <div className="grid grid-cols-2 gap-2">
                                                <div className="space-y-1">
                                                    <Label className="text-xs">Tipo</Label>
                                                    <Select value={phone.type} onValueChange={(v) => updatePhone(index, 'type', v)}>
                                                        <SelectTrigger className="h-8">
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="cel">Celular</SelectItem>
                                                            <SelectItem value="fixo">Fixo</SelectItem>
                                                            <SelectItem value="whatsapp">WhatsApp</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                                <div className="space-y-1">
                                                    <Label className="text-xs">Descrição</Label>
                                                    <Input 
                                                        value={phone.description} 
                                                        onChange={(e) => updatePhone(index, 'description', e.target.value)}
                                                        className="h-8"
                                                        placeholder="Ex: Mãe"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </>
                                ) : (
                                    <div className="flex justify-between items-center">
                                        <span className="font-medium">{phone.number}</span>
                                        <div className="flex gap-2 text-xs text-muted-foreground">
                                            <span className="uppercase text-[10px] bg-muted px-1 rounded border">{phone.type}</span>
                                            <span>{phone.description}</span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                         {(!formData.phones || formData.phones.length === 0) && (
                            <p className="text-xs text-muted-foreground text-center py-2">Nenhum telefone cadastrado.</p>
                        )}
                    </div>
                </div>
            </div>

            {isEditing && (
                <div className="flex justify-end gap-2 border-t pt-4">
                    <Button variant="outline" onClick={() => setIsEditing(false)}>
                        <X className="mr-2 h-4 w-4" />
                        Cancelar
                    </Button>
                    <Button onClick={handleSave}>
                        <Save className="mr-2 h-4 w-4" />
                        Salvar Alterações
                    </Button>
                </div>
            )}
        </div>
      </DialogContent>
    </Dialog>
  );
}