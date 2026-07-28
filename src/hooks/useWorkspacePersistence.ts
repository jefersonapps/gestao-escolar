import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';

import {
  clearAutoSession,
  getAutoSession,
  getRecentWorkspaceItems,
  hashWorkspaceData,
  saveAutoSession,
  saveManualWorkspaceItem,
  type WorkspaceItem,
  type WorkspaceTabType,
} from '@/lib/workspacePersistence';

interface UseWorkspacePersistenceOptions<TData> {
  tabType: WorkspaceTabType;
  data: TData;
  onRestore: (data: TData) => void;
  getDefaultName: (data: TData) => string;
  isDataEmpty?: (data: TData) => boolean;
  debounceMs?: number;
}

export interface WorkspacePersistenceController<TData> {
  currentName: string;
  hasUnsavedManualChanges: boolean;
  lastAutoSavedAt: string | null;
  recentWorks: WorkspaceItem<TData>[];
  saveManually: (name?: string) => WorkspaceItem<TData>;
  openWork: (item: WorkspaceItem<TData>) => void;
  clearCurrentAutosave: () => void;
  refreshRecentWorks: () => void;
}

export function useWorkspacePersistence<TData>({
  tabType,
  data,
  onRestore,
  getDefaultName,
  isDataEmpty = () => false,
  debounceMs = 500,
}: UseWorkspacePersistenceOptions<TData>): WorkspacePersistenceController<TData> {
  const [currentName, setCurrentName] = useState(() => getDefaultName(data));
  const [lastAutoSavedAt, setLastAutoSavedAt] = useState<string | null>(null);
  const [recentWorks, setRecentWorks] = useState<WorkspaceItem<TData>[]>([]);
  const [manualSnapshotHash, setManualSnapshotHash] = useState<string | null>(null);
  const [manualWorkId, setManualWorkId] = useState<string | undefined>(undefined);
  const lastObservedHashRef = useRef(hashWorkspaceData(data));
  const hydratedRef = useRef(false);
  const onRestoreRef = useRef(onRestore);

  useEffect(() => {
    onRestoreRef.current = onRestore;
  }, [onRestore]);

  const dataHash = useMemo(() => hashWorkspaceData(data), [data]);
  const hasUnsavedManualChanges = useMemo(() => {
    if (isDataEmpty(data)) return false;
    return !manualSnapshotHash || manualSnapshotHash !== dataHash;
  }, [data, dataHash, isDataEmpty, manualSnapshotHash]);

  const refreshRecentWorks = useCallback(() => {
    setRecentWorks(getRecentWorkspaceItems(tabType) as WorkspaceItem<TData>[]);
  }, [tabType]);

  useEffect(() => {
    const autoSession = getAutoSession<TData>(tabType);

    if (autoSession) {
      const restoredHash = hashWorkspaceData(autoSession.data);
      lastObservedHashRef.current = restoredHash;
      setCurrentName(autoSession.name);
      setLastAutoSavedAt(autoSession.updatedAt);
      setManualSnapshotHash(autoSession.manualSnapshotHash || null);
      setManualWorkId(autoSession.manualWorkId);
      onRestoreRef.current(autoSession.data);
      toast.info(`Sessao recuperada: ${autoSession.name}`);
    }

    hydratedRef.current = true;
    refreshRecentWorks();
  }, [refreshRecentWorks, tabType]);

  useEffect(() => {
    if (!hydratedRef.current) return;
    if (dataHash === lastObservedHashRef.current) return;

    const timeoutId = window.setTimeout(() => {
      lastObservedHashRef.current = dataHash;

      if (isDataEmpty(data)) {
        clearAutoSession(tabType);
        setLastAutoSavedAt(null);
        refreshRecentWorks();
        return;
      }

      const item = saveAutoSession(tabType, currentName || getDefaultName(data), data, {
        manualWorkId,
        manualSnapshotHash: manualSnapshotHash || undefined,
      });
      setCurrentName(item.name);
      setLastAutoSavedAt(item.updatedAt);
      refreshRecentWorks();
    }, debounceMs);

    return () => window.clearTimeout(timeoutId);
  }, [
    currentName,
    data,
    dataHash,
    debounceMs,
    getDefaultName,
    isDataEmpty,
    manualSnapshotHash,
    manualWorkId,
    refreshRecentWorks,
    tabType,
  ]);

  const saveManually = useCallback(
    (name?: string) => {
      const cleanName = (name || currentName || getDefaultName(data)).trim() || getDefaultName(data);
      const item = saveManualWorkspaceItem(tabType, cleanName, data, manualWorkId);
      const hash = hashWorkspaceData(data);

      setCurrentName(item.name);
      setManualWorkId(item.id);
      setManualSnapshotHash(hash);
      setLastAutoSavedAt(null);
      lastObservedHashRef.current = hash;
      clearAutoSession(tabType);
      refreshRecentWorks();
      toast.success('Trabalho salvo localmente.');
      return item;
    },
    [currentName, data, getDefaultName, manualWorkId, refreshRecentWorks, tabType],
  );

  const openWork = useCallback(
    (item: WorkspaceItem<TData>) => {
      const hash = hashWorkspaceData(item.data);
      setCurrentName(item.name);
      setManualWorkId(item.savedManually ? item.id : item.manualWorkId);
      setManualSnapshotHash(item.savedManually ? hash : item.manualSnapshotHash || null);
      setLastAutoSavedAt(item.savedManually ? null : item.updatedAt);
      lastObservedHashRef.current = hash;
      onRestore(item.data);
      toast.success(`Trabalho aberto: ${item.name}`);
    },
    [onRestore],
  );

  const clearCurrentAutosave = useCallback(() => {
    clearAutoSession(tabType);
    setLastAutoSavedAt(null);
    setManualSnapshotHash(null);
    setManualWorkId(undefined);
    lastObservedHashRef.current = hashWorkspaceData(data);
    refreshRecentWorks();
  }, [data, refreshRecentWorks, tabType]);

  return {
    currentName,
    hasUnsavedManualChanges,
    lastAutoSavedAt,
    recentWorks,
    saveManually,
    openWork,
    clearCurrentAutosave,
    refreshRecentWorks,
  };
}
