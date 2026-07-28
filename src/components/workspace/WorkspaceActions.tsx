import { useMemo, useState } from 'react';
import { Clock, History, Save, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { WORKSPACE_TAB_LABELS, type WorkspaceItem, type WorkspaceTabType } from '@/lib/workspacePersistence';
import type { WorkspacePersistenceController } from '@/hooks/useWorkspacePersistence';

interface WorkspaceActionsProps<TData> {
  tabType: WorkspaceTabType;
  controller: WorkspacePersistenceController<TData>;
  defaultName: string;
  onClearData: () => void;
}

const formatDateTime = (value: string | null) => {
  if (!value) return null;

  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value));
};

export function WorkspaceActions<TData>({
  tabType,
  controller,
  defaultName,
  onClearData,
}: WorkspaceActionsProps<TData>) {
  const [isSaveOpen, setIsSaveOpen] = useState(false);
  const [isRecentOpen, setIsRecentOpen] = useState(false);
  const [isResetOpen, setIsResetOpen] = useState(false);
  const [saveName, setSaveName] = useState(defaultName);

  const lastAutoSaveText = useMemo(() => formatDateTime(controller.lastAutoSavedAt), [controller.lastAutoSavedAt]);

  const openSaveDialog = () => {
    setSaveName(controller.currentName || defaultName);
    setIsSaveOpen(true);
  };

  const handleManualSave = () => {
    controller.saveManually(saveName);
    setIsSaveOpen(false);
  };

  const clearData = () => {
    onClearData();
    controller.clearCurrentAutosave();
    setIsResetOpen(false);
    toast.success('Dados zerados.');
  };

  const handleSaveAndClear = () => {
    controller.saveManually(controller.currentName || defaultName);
    clearData();
  };

  const handleOpenWork = (item: WorkspaceItem<TData>) => {
    controller.openWork(item);
    setIsRecentOpen(false);
  };

  return (
    <div className="flex flex-col gap-2 rounded-md border bg-muted/20 p-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-center gap-2 text-sm text-muted-foreground">
        <Clock className="h-4 w-4 shrink-0" />
        <span className="truncate">
          {lastAutoSaveText ? `Auto save: ${lastAutoSaveText}` : `Auto save ativo em ${WORKSPACE_TAB_LABELS[tabType]}`}
        </span>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" onClick={openSaveDialog}>
          <Save className="mr-2 h-4 w-4" />
          Salvar
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            controller.refreshRecentWorks();
            setIsRecentOpen(true);
          }}
        >
          <History className="mr-2 h-4 w-4" />
          Recentes
        </Button>
        <Button type="button" variant="destructive" size="sm" onClick={() => setIsResetOpen(true)}>
          <Trash2 className="mr-2 h-4 w-4" />
          Zerar Dados
        </Button>
      </div>

      <Dialog open={isSaveOpen} onOpenChange={setIsSaveOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Salvar trabalho localmente</DialogTitle>
            <DialogDescription>Trabalhos salvos manualmente permanecem no historico.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor={`${tabType}-workspace-name`}>Nome do trabalho</Label>
            <Input
              id={`${tabType}-workspace-name`}
              value={saveName}
              onChange={(event) => setSaveName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  handleManualSave();
                }
              }}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setIsSaveOpen(false)}>
              Cancelar
            </Button>
            <Button type="button" onClick={handleManualSave}>
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isRecentOpen} onOpenChange={setIsRecentOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Trabalhos recentes</DialogTitle>
            <DialogDescription>Abra um trabalho salvo ou a ultima sessao recuperada desta aba.</DialogDescription>
          </DialogHeader>
          <div className="max-h-96 space-y-2 overflow-auto pr-1">
            {controller.recentWorks.length === 0 ? (
              <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
                Nenhum trabalho recente nesta aba.
              </div>
            ) : (
              controller.recentWorks.map((item) => (
                <button
                  key={`${item.savedManually ? 'manual' : 'auto'}-${item.id}`}
                  type="button"
                  className="w-full rounded-md border p-3 text-left transition-colors hover:bg-accent"
                  onClick={() => handleOpenWork(item)}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate font-medium">{item.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {item.tabLabel} - Criado em {formatDateTime(item.createdAt)} - Atualizado em {formatDateTime(item.updatedAt)}
                      </div>
                    </div>
                    <span className="shrink-0 rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground">
                      {item.savedManually ? 'Salvo' : 'Auto save'}
                    </span>
                  </div>
                </button>
              ))
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setIsRecentOpen(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isResetOpen} onOpenChange={setIsResetOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Zerar dados?</DialogTitle>
            <DialogDescription>
              {controller.hasUnsavedManualChanges
                ? 'Existem alteracoes que ainda nao foram salvas manualmente.'
                : 'Os dados atuais desta aba serao removidos.'}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setIsResetOpen(false)}>
              Cancelar
            </Button>
            {controller.hasUnsavedManualChanges && (
              <Button type="button" variant="secondary" onClick={handleSaveAndClear}>
                Salvar e limpar
              </Button>
            )}
            <Button type="button" variant="destructive" onClick={clearData}>
              {controller.hasUnsavedManualChanges ? 'Limpar sem salvar' : 'Limpar dados'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
