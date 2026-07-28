import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { type SGEduClass } from '@/services/sgedu';
import { useStore } from '@/store/useStore';
import { Loader2, Search, Users, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useExternalAuth } from '@/hooks/useExternalAuth';
import { SGEduService } from '@/services/sgedu';

interface SGEduImportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (students: import('@/types').Student[], professor?: string, className?: string, url?: string) => void;
  onImportProfessors?: (professors: { id: string, name: string }[]) => void;
  mode?: 'class' | 'professor';
}

export function SGEduImportDialog({ 
    isOpen, 
    onClose, 
    onImport, 
    onImportProfessors,
    mode = 'class'
}: SGEduImportDialogProps) {

  const { externalSessions, setExternalSession, logoutExternalSystem } = useStore();
  const sgeduUser = externalSessions['sgedu'];
  const [step, setStep] = useState<'login' | 'select-class'>(sgeduUser ? 'select-class' : 'login');
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0); // 0 to 100
  const [loadingStudent, setLoadingStudent] = useState('');
  const [classes, setClasses] = useState<SGEduClass[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const { requireSession, service } = useExternalAuth('sgedu');
  const sgeService = service as SGEduService;
  
  // Auto-load classes or professors if user is already logged in
  useEffect(() => {
    if (isOpen && sgeduUser && step === 'select-class') {
        if (mode === 'class' && classes.length === 0) {
            loadClasses();
        } else if (mode === 'professor') {
            handleImportProfessors();
        }
    }
  }, [isOpen, sgeduUser, step, mode]);

  const handleImportProfessors = async () => {
    if (!(await requireSession())) return;
    setIsLoading(true);
    try {
        const profs = await sgeService.getProfessors();
        if (profs.length > 0) {
            if (onImportProfessors) {
                onImportProfessors(profs);
                toast.success(`${profs.length} professores encontrados e importados!`);
                onClose();
            } else {
                toast.error('Callback de importação de professores não definido');
            }
        } else {
            toast.warning('Nenhum professor encontrado.');
        }
    } catch (e) {
        toast.error('Erro ao importar professores');
        console.error(e);
    } finally {
        setIsLoading(false);
    }
  };

  const handleLogin = async () => {
    if (!email || !password) {
      toast.error('Preencha email e senha');
      return;
    }

    setIsLoading(true);
    try {
      const success = await service.login(email, password);
      if (success) {
        toast.success('Login realizado com sucesso!');
        
        // Fetch and update user profile globally
        try {
            const profile = await service.getUserProfile();
            if (profile) {
                setExternalSession('sgedu', profile);
                toast.success(`Bem-vindo(a), ${profile.name}!`);
            }
        } catch (error) {
            console.error('Failed to fetch user profile after login', error);
        }

        if (mode === 'class') {
            await loadClasses();
        } else {
             setStep('select-class'); // move to next step which triggers useEffect
        }
      } else {
        toast.error('Falha no login. Verifique suas credenciais.');
      }
    } catch (e) {
      toast.error('Erro ao conectar com SGEdu');
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const loadClasses = async () => {
    if (!(await requireSession())) return;
    setIsLoading(true);
    try {
      const data = await sgeService.getClasses();
      setClasses(data);
      setStep('select-class');
    } catch (e) {
      toast.error('Erro ao carregar turmas');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectClass = async (cls: SGEduClass) => {
    if (!(await requireSession())) return;
    setIsLoading(true);
    setLoadingProgress(0);
    try {
      toast.info(`Iniciando importação completa de ${cls.name}... Por favor, aguarde.`);
      const { professor, students } = await sgeService.getStudentsFromClass(cls.url);
      
      if (students.length === 0) {
        toast.warning('Nenhum aluno encontrado nesta turma.');
        setIsLoading(false);
        return;
      }
      
      const detailedStudents = [];
      // Removed TEST MODE limit
      for (let i = 0; i < students.length; i++) {
          const s = students[i];
          setLoadingProgress(Math.round(((i + 1) / students.length) * 100)); // Show progress
          setLoadingStudent(s.name);
          
          try {
              const details = await sgeService.getStudentDetails(s.id);
              if (details) {
                  detailedStudents.push({ ...s, ...details });
              } else {
                  detailedStudents.push(s);
              }
          } catch (e) {
              console.error(`Falha ao buscar detalhes do aluno ${s.name}`, e);
              detailedStudents.push(s);
          }
          // Dynamic delay to be respectful to the server
          await new Promise(r => setTimeout(r, 400)); 
      }

      toast.success(`${detailedStudents.length} alunos importados detalhadamente!`);
      // Pass back full data
      onImport(detailedStudents, professor, cls.name, cls.url);
      onClose();
    } catch (e) {
      toast.error('Erro ao importar dados da turma');
      console.error(e);
    } finally {
      setIsLoading(false);
      setLoadingProgress(0);
      setLoadingStudent('');
    }
  };

  const filteredClasses = classes.filter(c => 
    c.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-125" onCloseAutoFocus={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>Importar do SGEdu</DialogTitle>
          <DialogDescription>
              {mode === 'class' 
                ? 'Conecte-se para puxar todos os detalhes dos alunos de uma turma.'
                : 'Conecte-se para importar a lista de professores da escola.'
              }
          </DialogDescription>
        </DialogHeader>

        {step === 'login' ? (
          <form 
              id="sgedu-import-login"
              className="space-y-4 py-4" 
              autoComplete="on"
              onSubmit={(e) => {
                  e.preventDefault();
                  handleLogin();
              }}
          >
             <div className="space-y-2">
               <Label htmlFor="email">Email</Label>
               <Input 
                 id="email"
                 name="username"
                 autoComplete="section-sgedu-import username"
                 type="email" 
                 value={email} 
                 onChange={e => setEmail(e.target.value)} 
                 placeholder="seu@email.com"
               />
             </div>
             <div className="space-y-2">
               <Label htmlFor="password">Senha</Label>
               <div className="relative">
                 <Input 
                   id="password"
                   name="password"
                   autoComplete="section-sgedu-import current-password"
                   type={showPassword ? "text" : "password"} 
                   value={password} 
                   onChange={e => setPassword(e.target.value)} 
                   className="pr-10"
                 />
                 <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                    onClick={() => setShowPassword(!showPassword)}
                 >
                    {showPassword ? (
                        <EyeOff className="h-4 w-4 text-muted-foreground" />
                    ) : (
                        <Eye className="h-4 w-4 text-muted-foreground" />
                    )}
                 </Button>
               </div>
             </div>
          </form>
        ) : (
          <div className="space-y-4 py-4">
             {isLoading && (mode === 'professor' || loadingProgress > 0) ? (
                 <div className="flex flex-col items-center justify-center py-8 space-y-4">
                     <Loader2 className="h-8 w-8 animate-spin text-primary" />
                     <div className="text-sm text-muted-foreground text-center">
                           {mode === 'class' 
                               ? (
                                   <>
                                       <div>Importando alunos... {loadingProgress}%</div>
                                       {loadingStudent && <div className="text-xs opacity-75 mt-1 truncate max-w-62.5">Lendo: {loadingStudent}</div>}
                                   </>
                               )
                               : mode === 'professor'
                               ? 'Importando lista de professores...'
                               : 'Carregando lista de turmas...'}
                     </div>
                     {mode === 'class' && (
                        <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                            <div 
                                className="h-full bg-primary transition-all duration-300"
                                style={{ width: `${loadingProgress}%` }}
                            />
                        </div>
                     )}
                 </div>
             ) : (
                 <>
                 {mode === 'class' ? (
                    <>
                     <div className="relative">
                        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input 
                          placeholder="Buscar turma..." 
                          className="pl-8"
                          value={searchQuery}
                          onChange={e => setSearchQuery(e.target.value)}
                        />
                     </div>

                     <ScrollArea className="h-75 rounded-md border p-2 mt-4">
                        {isLoading ? (
                           <div className="flex justify-center p-4">
                              <Loader2 className="h-6 w-6 animate-spin text-primary" />
                           </div>
                        ) : filteredClasses.length === 0 ? (
                           <div className="text-center p-4 text-muted-foreground">Nenhuma turma encontrada.</div>
                        ) : (
                           <div className="space-y-1">
                              {filteredClasses.map(cls => (
                                 <button
                                   key={cls.id}
                                   onClick={() => handleSelectClass(cls)}
                                   className="w-full text-left px-3 py-2 rounded-md hover:bg-accent text-sm flex items-center justify-between group"
                                 >
                                    <div>
                                       <div className="font-medium">{cls.name}</div>
                                       <div className="text-xs text-muted-foreground">{cls.shift || 'Turno não informado'}</div>
                                    </div>
                                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                        <Users className="h-3 w-3" />
                                        {cls.studentsCount}
                                    </div>
                                 </button>
                              ))}
                           </div>
                        )}
                     </ScrollArea>
                    </>
                 ) : (
                    <div className="text-center p-4 text-muted-foreground">
                       Nenhum professor encontrado. Se você vê esta mensagem, a importação automática falhou. 
                       Tente novamente ou verifique se está logado corretament.
                    </div>
                 )}
                 </>
             )}
          </div>
        )}

        <DialogFooter className="flex justify-between sm:justify-between">
           {step === 'select-class' && (
              <Button 
                variant="ghost" 
                onClick={() => {
                    logoutExternalSystem('sgedu');
                    setStep('login');
                    setClasses([]);
                }}
              >
                Sair / Trocar conta
              </Button>
           )}
           {step === 'login' && (
             <Button type="submit" form="sgedu-import-login" disabled={isLoading}>
               {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
               Entrar
             </Button>
           )}
           {step === 'select-class' && (
               <Button variant="secondary" onClick={onClose}>
                   Cancelar
               </Button>
           )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
