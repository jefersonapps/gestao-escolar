import { useState, useEffect } from 'react';
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { SchoolConfiguration } from "@/components/config/SchoolConfiguration";
import { SubjectManager } from "@/components/data/SubjectManager";
import { ProfessorManager } from "@/components/data/ProfessorManager";
import { ClassManager } from "@/components/data/ClassManager";
import { ProfessorAvailability } from "@/components/constraints/ProfessorAvailability";
import { ScheduleView } from "@/components/schedule/ScheduleView";
import { AttendanceSheet } from "@/components/attendance/AttendanceSheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"; // Keep for sub-tabs if needed
import { ReportsScreen } from '@/components/reports/ReportsScreen';
import { Toaster } from "@/components/ui/sonner";

import { ThemeProvider } from "@/components/theme-provider";
import { InfrequencyControl } from './components/attendance/InfrequencyControl';
import { CustomTableControl } from './components/custom-table/CustomTableControl';
import { CustomChartsControl } from './components/custom-charts/CustomChartsControl';
import { useStore } from '@/store/useStore';
import { SGEduService } from '@/services/sgedu';
import { SaevService } from '@/services/saev';
import type { ExternalSystem } from '@/types/auth';

// Utility map to get services
const services: Record<ExternalSystem, any> = {
  sgedu: new SGEduService(),
  saev: new SaevService()
};

function App() {
  const [activeTab, setActiveTab] = useState('config');
  const { externalSessions, logoutExternalSystem } = useStore();

  useEffect(() => {
    const validateSessions = async () => {
      // Loop through all saved sessions
      for (const [sysStr, session] of Object.entries(externalSessions)) {
        if (!session) continue;
        
        const system = sysStr as ExternalSystem;
        const service = services[system];
        
        if (service) {
           const isValid = await service.checkSession();
           if (!isValid) {
              console.log(`Session for ${system} expired on startup. Logging out.`);
              logoutExternalSystem(system);
           }
        }
      }
    };

    validateSessions();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <ThemeProvider defaultTheme="light" storageKey="vite-ui-theme">
      <DashboardLayout activeTab={activeTab} onTabChange={setActiveTab}>
        {activeTab === 'config' && <SchoolConfiguration />}
        
        {activeTab === 'subjects' && <SubjectManager />}
        
        {activeTab === 'professors' && (
          <Tabs defaultValue="list" className="w-full">
              <TabsList className="mb-4">
              <TabsTrigger value="list">Cadastro</TabsTrigger>
              <TabsTrigger value="availability">Disponibilidade</TabsTrigger>
              </TabsList>
              <TabsContent value="list" className="mt-0">
              <ProfessorManager />
              </TabsContent>
              <TabsContent value="availability" className="mt-0">
              <ProfessorAvailability />
              </TabsContent>
          </Tabs>
        )}
        
        {activeTab === 'classes' && <ClassManager />}
        
        {activeTab === 'schedule' && <ScheduleView />}

        {activeTab === 'attendance' && <AttendanceSheet />}
        
        {activeTab === 'infrequency' && <InfrequencyControl />}

        {activeTab === 'tables' && <CustomTableControl />}

        {activeTab === 'charts' && <CustomChartsControl />}
        
        {activeTab === 'reports' && <ReportsScreen />}
        
        <Toaster />
      </DashboardLayout>
    </ThemeProvider>
  )
}

export default App
