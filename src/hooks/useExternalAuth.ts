import { useStore } from '@/store/useStore';
import type { IExternalAuthService, ExternalSystem } from '@/types/auth';
import { SGEduService } from '@/services/sgedu';
import { SaevService } from '@/services/saev';
import { toast } from 'sonner';

// Keep instances of services here or inject them
const services: Record<ExternalSystem, IExternalAuthService> = {
  sgedu: new SGEduService(),
  saev: new SaevService(),
};

export function useExternalAuth(system: ExternalSystem) {
    const { setSGEduLoginOpen, externalSessions, logoutExternalSystem } = useStore();
    const service: IExternalAuthService = services[system];
    
    // Helper names for display 
    const systemNames: Record<ExternalSystem, string> = {
        sgedu: 'SGEdu',
        saev: 'SAEV'
    };

    const requireSession = async (): Promise<boolean> => {
        const session = externalSessions[system];
        
        if (!session) {
            toast.warning(`Você precisa fazer login no ${systemNames[system]} primeiro.`);
            if (system === 'sgedu') setSGEduLoginOpen(true);
            else if (system === 'saev') useStore.getState().setSaevLoginOpen(true);
            return false;
        }

        const isValid = await service.checkSession();
        if (!isValid) {
            toast.warning(`Sua sessão no ${systemNames[system]} expirou. Por favor, faça login novamente.`);
            logoutExternalSystem(system);
            if (system === 'sgedu') setSGEduLoginOpen(true);
            else if (system === 'saev') useStore.getState().setSaevLoginOpen(true);
            return false;
        }

        return true;
    };

    return { requireSession, service, systemName: systemNames[system] };
}
