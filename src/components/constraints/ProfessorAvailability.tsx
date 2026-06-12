import { useState, useMemo } from 'react';
import { useStore } from '@/store/useStore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { AlertCircle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';

export function ProfessorAvailability() {
  const { professors, subjects, schoolConfig, updateProfessor } = useStore();
  const [selectedProfId, setSelectedProfId] = useState<string>('');

  console.log('Professors available:', professors.map(p => p.name));

  const sortedProfessors = useMemo(() => {
    return [...professors].sort((a, b) => 
      a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' })
    );
  }, [professors]);

  const subjectMap = useMemo(() => {
    return new Map(subjects.map(s => [s.id, s]));
  }, [subjects]);

  const selectedProf = professors.find(p => p.id === selectedProfId);

  const toggleSlot = (dayId: string, slotId: string) => {
    if (!selectedProf) return;
    
    // Create a composite key for the unavailability
    const compositeKey = `${dayId}|${slotId}`;
    
    let newUnavailable = [...selectedProf.unavailableSlots];
    if (newUnavailable.includes(compositeKey)) {
      newUnavailable = newUnavailable.filter(k => k !== compositeKey);
    } else {
      newUnavailable.push(compositeKey);
    }
    
    updateProfessor(selectedProf.id, { unavailableSlots: newUnavailable });
  };

  const toggleDay = (dayId: string, slots: { id: string }[]) => {
    if (!selectedProf) return;

    const slotIds = slots.map(s => s.id);
    const daySlotKeys = slotIds.map(sid => `${dayId}|${sid}`);
    
    // Check if all slots in this day are already unavailable
    const allUnavailable = daySlotKeys.every(key => selectedProf.unavailableSlots.includes(key));
    
    let newUnavailable = [...selectedProf.unavailableSlots];
    
    if (allUnavailable) {
       // Make all available (remove from list)
       newUnavailable = newUnavailable.filter(key => !daySlotKeys.includes(key));
    } else {
       // Make all unavailable (add missing ones)
       daySlotKeys.forEach(key => {
         if (!newUnavailable.includes(key)) {
            newUnavailable.push(key);
         }
       });
    }

    updateProfessor(selectedProf.id, { unavailableSlots: newUnavailable });
  };

  const isUnavailable = (dayId: string, slotId: string) => {
    if (!selectedProf) return false;
    return selectedProf.unavailableSlots.includes(`${dayId}|${slotId}`);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Disponibilidade do Professor</CardTitle>
          <CardDescription>
            Selecione um professor e marque os horários em que ele <strong>NÃO</strong> pode dar aula.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-6">
            <Select value={selectedProfId} onValueChange={setSelectedProfId}>
              <SelectTrigger className="w-[450px] h-auto py-1">
                <SelectValue placeholder="Selecione um professor..." />
              </SelectTrigger>
              <SelectContent>
                {sortedProfessors.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    <div className="flex items-center gap-2">
                       <span>{p.name}</span>
                       {p.subjectIds?.map(subId => {
                        const sub = subjectMap.get(subId);
                        if (!sub) return null;
                        return (
                          <Badge 
                            key={sub.id} 
                            variant="outline" 
                            className="text-[10px] px-1 py-0 h-4 border-muted-foreground/30 text-muted-foreground font-normal"
                            style={{ 
                              borderColor: sub.color, 
                              color: sub.color,
                              backgroundColor: `${sub.color}10`
                            }}
                          >
                            {sub.name}
                          </Badge>
                        )
                      })}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {!selectedProf && (
             <div className="flex flex-col items-center justify-center p-8 border rounded-md border-dashed text-muted-foreground bg-muted/20">
              <p>Selecione um professor acima para configurar sua disponibilidade.</p>
            </div>
          )}

          {selectedProf && (
            <ScrollArea className="w-full whitespace-nowrap pb-4">
              <div className="flex gap-4 min-w-max pb-4">
                {schoolConfig.days.filter(d => d.enabled).map((day) => (
                  <div key={day.id} className="flex flex-col w-40 border rounded-md overflow-hidden">
                    <div 
                        className="bg-muted p-2 text-center font-bold text-sm border-b cursor-pointer hover:bg-muted/80 transition-colors"
                        onClick={() => toggleDay(day.id, day.slots)}
                        title="Clique para alternar o dia todo"
                    >
                      {['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'][day.dayOfWeek]}
                    </div>
                    <div className="divide-y">
                      {day.slots.map((slot) => (
                        <div 
                          key={slot.id} 
                          onClick={() => toggleSlot(day.id, slot.id)}
                          className={cn(
                            "p-2 text-center text-xs cursor-pointer transition-colors hover:font-bold h-12 flex flex-col justify-center",
                            slot.isInterval ? "bg-yellow-50 text-yellow-600 font-bold dark:bg-yellow-900/20" : "",
                            isUnavailable(day.id, slot.id) 
                              ? "bg-red-100 dark:bg-red-900/30 text-red-600 line-through decoration-red-500" 
                              : "hover:bg-accent"
                          )}
                        >
                          {slot.isInterval ? (
                            <span>INTERVALO</span>
                          ) : (
                            <>
                              <span className="block opacity-70 scale-90">{slot.startTime} - {slot.endTime}</span>
                              {isUnavailable(day.id, slot.id) ? "Indisponível" : "Disponível"}
                            </>
                          )}
                        </div>
                      ))}
                      {day.slots.length === 0 && (
                        <div className="p-4 text-center text-xs text-muted-foreground">
                          Sem horários
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              
              <Alert className="mt-6">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Dica</AlertTitle>
                <AlertDescription>
                  Clique nos horários para alternar entre Disponível e Indisponível.
                  Vermelho indica horário bloqueado.
                </AlertDescription>
              </Alert>
              <ScrollBar orientation="horizontal" />
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
