import { useState } from 'react';
import { useStore } from '@/store/useStore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DayTimeEditor } from './DayTimeEditor';
import { StageManager } from '@/components/config/StageManager';
import { v4 as uuidv4 } from 'uuid';
import type { DayConfig } from '@/types';

export function SchoolConfiguration() {
  const { schoolConfig, setSchoolName, updateDayConfig, stages, updateStage } = useStore();
  const [selectedScope, setSelectedScope] = useState<string>('global');

  const currentStage = selectedScope === 'global' ? null : stages.find(s => s.id === selectedScope);
  const hasCustomSchedule = currentStage ? !!currentStage.days : true; // Global always has schedule

  // If stage has no custom days, show global days (read-only or with "Customize" option)
  const daysToDisplay = currentStage 
      ? (currentStage.days || schoolConfig.days) 
      : schoolConfig.days;

  const handleUpdateDay = (dayId: string, updates: Partial<DayConfig>) => {
      if (selectedScope === 'global') {
          updateDayConfig(dayId, updates);
      } else if (currentStage && currentStage.days) {
          const newDays = currentStage.days.map(d => d.id === dayId ? { ...d, ...updates } : d);
          updateStage(currentStage.id, { days: newDays });
      }
  };

  const handleToggleCustomSchedule = (enabled: boolean) => {
      if (!currentStage) return;
      
      if (enabled) {
          // Initialize with copy of global, regenerating IDs to avoid collisions
          const initialDays = schoolConfig.days.map(d => ({
              ...d,
              slots: d.slots.map(s => ({ ...s, id: uuidv4() }))
          }));
          updateStage(currentStage.id, { days: initialDays });
      } else {
          // Revert to using global
          updateStage(currentStage.id, { days: undefined });
      }
  };



  return (
    <div className="space-y-6">
      <StageManager />
      
      <Card>
        <CardHeader>
          <CardTitle>Configurações da Escola</CardTitle>
          <CardDescription>Defina o nome da escola e os dias letivos.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="schoolName">Nome da Escola</Label>
              <Input 
                id="schoolName" 
                value={schoolConfig.name} 
                onChange={(e) => setSchoolName(e.target.value)} 
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
            <div className="space-y-1">
                <h3 className="text-lg font-medium">Configuração de Horários</h3>
                <p className="text-sm text-muted-foreground">
                    Define os horários de aula. Você pode personalizar por etapa de ensino.
                </p>
            </div>
            <div className="flex items-center gap-4">
                <Label>Contexto:</Label>
                <Select value={selectedScope} onValueChange={setSelectedScope}>
                    <SelectTrigger className="w-[250px]">
                        <SelectValue placeholder="Selecione o contexto" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="global">Configuração Geral (Padrão)</SelectItem>
                        {stages.map(stage => (
                            <SelectItem key={stage.id} value={stage.id}>
                                <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: stage.color }} />
                                    {stage.name}
                                </div>
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
        </div>

        {currentStage && (
            <Card className="bg-muted/30 border-dashed">
                <CardHeader className="flex flex-row items-center justify-between py-4">
                    <div className="space-y-1">
                        <CardTitle className="text-base">Horários Personalizados</CardTitle>
                        <CardDescription>
                            {hasCustomSchedule 
                                ? "Esta etapa usa horários próprios, independentes da configuração geral."
                                : "Esta etapa está usando a configuração geral."}
                        </CardDescription>
                    </div>
                    <Switch 
                        checked={hasCustomSchedule}
                        onCheckedChange={handleToggleCustomSchedule}
                    />
                </CardHeader>
            </Card>
        )}

        <DayTimeEditor 
            days={daysToDisplay}
            minTime={schoolConfig.minTime}
            onUpdateDay={handleUpdateDay}
            readOnly={!!currentStage && !hasCustomSchedule}
        />
      </div>
    </div>
  );
}
