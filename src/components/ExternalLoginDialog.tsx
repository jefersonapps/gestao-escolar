import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { useStore } from '@/store/useStore';
import { Loader2, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';
import { useExternalAuth } from '@/hooks/useExternalAuth';
import type { ExternalSystem } from '@/types/auth';

interface ExternalLoginDialogProps {
  system: ExternalSystem;
  isOpen: boolean;
  onClose: () => void;
}

export function ExternalLoginDialog({ system, isOpen, onClose }: ExternalLoginDialogProps) {
  const { setExternalSession } = useStore();
  const { service, systemName } = useExternalAuth(system);
  const loginFormId = `external-login-${system}`;
  const autocompleteSection = `section-${system}`;
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      toast.error('Preencha email e senha');
      return;
    }

    setIsLoading(true);
    try {
      const success = await service.login(email, password);
      if (success) {
        // Fetch profile
        const profile = await service.getUserProfile();
        if (profile) {
            setExternalSession(system, profile);
            toast.success(`Bem-vindo, ${profile.name}!`);
            onClose();
        } else {
            toast.warning('Login realizado, mas não foi possível carregar o perfil.');
            setExternalSession(system, { name: `Usuário ${systemName}`, email }); // Fallback
            onClose();
        }
      } else {
        toast.error('Falha no login. Verifique suas credenciais.');
      }
    } catch (e) {
      toast.error(`Erro ao conectar com ${systemName}`);
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-100" onCloseAutoFocus={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>Entrar no {systemName}</DialogTitle>
          <DialogDescription>
             Conecte-se para acessar seus dados do sistema.
          </DialogDescription>
        </DialogHeader>

        <form 
            id={loginFormId}
            className="space-y-4 py-4"
            autoComplete="on"
            onSubmit={(e) => {
                e.preventDefault();
                handleLogin();
            }}
        >
            <div className="space-y-2">
            <Label htmlFor={`${system}-login-email`}>Email / Usuário</Label>
            <Input 
                id={`${system}-login-email`}
                name="username"
                autoComplete={`${autocompleteSection} username`}
                type="email"
                value={email} 
                onChange={e => setEmail(e.target.value)} 
                placeholder="seu@email.com"
            />
            </div>
            <div className="space-y-2">
            <Label htmlFor={`${system}-login-password`}>Senha</Label>
            <div className="relative">
                <Input 
                    id={`${system}-login-password`}
                    name="password"
                    autoComplete={`${autocompleteSection} current-password`}
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

        <DialogFooter>
            <Button type="submit" form={loginFormId} disabled={isLoading}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Entrar
            </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
