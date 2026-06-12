import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Trash2, Plus, Copy } from 'lucide-react';
import type { DayConfig, TimeSlot } from '@/types';
import { v4 as uuidv4 } from 'uuid';

interface DayTimeEditorProps {
    days: DayConfig[];
    minTime: string;
    onUpdateDay: (dayId: string, updates: Partial<DayConfig>) => void;
    readOnly?: boolean;
}

export function DayTimeEditor({ days, minTime, onUpdateDay, readOnly = false }: DayTimeEditorProps) {
    const daysMap = { 0: 'Domingo', 1: 'Segunda', 2: 'Terça', 3: 'Quarta', 4: 'Quinta', 5: 'Sexta', 6: 'Sábado' };

    // Helper to add minutes to HH:MM
    const addMinutes = (time: string, minutes: number): string => {
        const [h, m] = time.split(':').map(Number);
        const date = new Date();
        date.setHours(h, m);
        date.setMinutes(date.getMinutes() + minutes);
        return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    };

    const handleCopyPreviousDay = (currentDayIndex: number) => {
        if (readOnly || currentDayIndex <= 0) return;
        const currentDay = days[currentDayIndex];
        const prevDay = days[currentDayIndex - 1];

        const newSlots = prevDay.slots.map(slot => ({
            ...slot,
            id: uuidv4() // Generate new IDs to avoid reference issues
        }));

        onUpdateDay(currentDay.id, {
            slots: newSlots,
            defaultLessonDuration: prevDay.defaultLessonDuration
        });
    };

    const handleAddSlot = (dayId: string) => {
        if (readOnly) return;
        const day = days.find(d => d.id === dayId);
        if (!day) return;

        let startTime = minTime || '07:00';
        const duration = day.defaultLessonDuration || 50;

        // If there are existing slots, start after the last one
        if (day.slots.length > 0) {
            const lastSlot = day.slots[day.slots.length - 1];
            startTime = lastSlot.endTime;
        }

        const endTime = addMinutes(startTime, duration);

        const newSlot: TimeSlot = {
            id: uuidv4(),
            startTime,
            endTime,
            isInterval: false,
        };
        onUpdateDay(dayId, { slots: [...day.slots, newSlot] });
    };

    const handleUpdateSlot = (dayId: string, slotId: string, field: keyof TimeSlot, value: any) => {
        if (readOnly) return;
        const day = days.find(d => d.id === dayId);
        if (!day) return;
        const newSlots = day.slots.map(s => s.id === slotId ? { ...s, [field]: value } : s);
        onUpdateDay(dayId, { slots: newSlots });
    };

    const handleRemoveSlot = (dayId: string, slotId: string) => {
        if (readOnly) return;
        const day = days.find(d => d.id === dayId);
        if (!day) return;
        onUpdateDay(dayId, { slots: day.slots.filter(s => s.id !== slotId) });
    };

    return (
        <div className="space-y-4">
            {days.map((day, index) => (
                <Card key={day.id} className={day.enabled ? '' : 'opacity-60'}>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-xl font-bold">
                            {daysMap[day.dayOfWeek as keyof typeof daysMap]}
                        </CardTitle>
                        <Switch
                            checked={day.enabled}
                            onCheckedChange={(checked) => !readOnly && onUpdateDay(day.id, { enabled: checked })}
                            disabled={readOnly}
                        />
                    </CardHeader>
                    {day.enabled && (
                        <CardContent>
                            <div className="space-y-4">
                                <div className="flex justify-between items-center gap-4">
                                    <div className="flex items-center gap-2">
                                        <Label htmlFor={`duration-${day.id}`} className="whitespace-nowrap text-sm text-muted-foreground">
                                            Duração Aula (min):
                                        </Label>
                                        <Input
                                            id={`duration-${day.id}`}
                                            type="number"
                                            className="w-20 h-8"
                                            value={day.defaultLessonDuration || 50}
                                            onChange={(e) => onUpdateDay(day.id, { defaultLessonDuration: parseInt(e.target.value) || 50 })}
                                            disabled={readOnly}
                                        />
                                    </div>
                                    {!readOnly && (
                                        <div className="flex gap-2">
                                            {index > 0 && (
                                                <Button size="sm" variant="outline" onClick={() => handleCopyPreviousDay(index)} title="Copiar do dia anterior">
                                                    <Copy className="mr-2 h-4 w-4" /> Repetir
                                                </Button>
                                            )}
                                            <Button size="sm" variant="outline" onClick={() => handleAddSlot(day.id)}>
                                                <Plus className="mr-2 h-4 w-4" /> Adicionar Horário
                                            </Button>
                                        </div>
                                    )}
                                </div>

                                {day.slots.length === 0 && <p className="text-sm text-muted-foreground">Nenhum horário configurado.</p>}

                                <div className="space-y-2">
                                    {day.slots.map((slot, index) => {
                                        // Calculate lesson number: count non-interval slots before this one
                                        const lessonNumber = day.slots
                                            .slice(0, index)
                                            .filter(s => !s.isInterval).length + 1;

                                        return (
                                            <div key={slot.id} className="flex items-center gap-2">
                                                <span className="text-sm font-mono w-14 text-right pr-2">
                                                    {slot.isInterval ? 'Int.' : `${lessonNumber}º`}
                                                </span>
                                                <Input
                                                    type="time"
                                                    className="w-24"
                                                    value={slot.startTime}
                                                    onChange={(e) => handleUpdateSlot(day.id, slot.id, 'startTime', e.target.value)}
                                                    disabled={readOnly}
                                                />
                                                <span>às</span>
                                                <Input
                                                    type="time"
                                                    className="w-24"
                                                    value={slot.endTime}
                                                    onChange={(e) => handleUpdateSlot(day.id, slot.id, 'endTime', e.target.value)}
                                                    disabled={readOnly}
                                                />
                                                <div className="flex items-center gap-2 ml-4">
                                                    <Switch
                                                        checked={slot.isInterval}
                                                        onCheckedChange={(checked) => handleUpdateSlot(day.id, slot.id, 'isInterval', checked)}
                                                        disabled={readOnly}
                                                    />
                                                    <Label className="text-xs">Intervalo?</Label>
                                                </div>
                                                {!readOnly && (
                                                    <Button variant="ghost" size="icon" onClick={() => handleRemoveSlot(day.id, slot.id)}>
                                                        <Trash2 className="h-4 w-4 text-destructive" />
                                                    </Button>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </CardContent>
                    )}
                </Card>
            ))}
        </div>
    );
}
