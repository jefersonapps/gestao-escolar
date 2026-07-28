export type WorkspaceTabType = 'attendance' | 'infrequency' | 'tables' | 'charts' | 'reports';

export const WORKSPACE_TAB_LABELS: Record<WorkspaceTabType, string> = {
  attendance: 'Frequencia',
  infrequency: 'Infrequencia',
  tables: 'Tabelas',
  charts: 'Graficos',
  reports: 'Relatorios',
};

export interface WorkspaceItem<TData = unknown> {
  id: string;
  name: string;
  tabType: WorkspaceTabType;
  tabLabel: string;
  createdAt: string;
  updatedAt: string;
  savedManually: boolean;
  data: TData;
  manualWorkId?: string;
  manualSnapshotHash?: string;
}

interface WorkspaceStorage {
  version: 1;
  manualItems: WorkspaceItem[];
  autoSessions: Partial<Record<WorkspaceTabType, WorkspaceItem>>;
  updatedAt: string;
}

const STORAGE_KEY = 'school-workspace-history-storage';
const RECENT_DISPLAY_LIMIT = 30;

const createEmptyStorage = (): WorkspaceStorage => ({
  version: 1,
  manualItems: [],
  autoSessions: {},
  updatedAt: new Date().toISOString(),
});

const canUseLocalStorage = () => typeof window !== 'undefined' && !!window.localStorage;

const createId = () => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
};

const normalizeStorage = (value: Partial<WorkspaceStorage> | null): WorkspaceStorage => ({
  version: 1,
  manualItems: Array.isArray(value?.manualItems) ? value.manualItems : [],
  autoSessions: value?.autoSessions && typeof value.autoSessions === 'object' ? value.autoSessions : {},
  updatedAt: typeof value?.updatedAt === 'string' ? value.updatedAt : new Date().toISOString(),
});

export const readWorkspaceStorage = (): WorkspaceStorage => {
  if (!canUseLocalStorage()) return createEmptyStorage();

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return createEmptyStorage();
    return normalizeStorage(JSON.parse(raw) as Partial<WorkspaceStorage>);
  } catch (error) {
    console.warn('[WorkspacePersistence] Failed to read workspace storage.', error);
    return createEmptyStorage();
  }
};

const writeWorkspaceStorage = (storage: WorkspaceStorage) => {
  if (!canUseLocalStorage()) return;

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...storage, updatedAt: new Date().toISOString() }));
  } catch (error) {
    console.warn('[WorkspacePersistence] Failed to write workspace storage.', error);
  }
};

export const hashWorkspaceData = (data: unknown) => {
  try {
    return JSON.stringify(data);
  } catch {
    return String(Date.now());
  }
};

export const getAutoSession = <TData>(tabType: WorkspaceTabType): WorkspaceItem<TData> | null => {
  const storage = readWorkspaceStorage();
  return (storage.autoSessions[tabType] as WorkspaceItem<TData> | undefined) || null;
};

export const saveAutoSession = <TData>(
  tabType: WorkspaceTabType,
  name: string,
  data: TData,
  options: {
    manualWorkId?: string;
    manualSnapshotHash?: string;
  } = {},
) => {
  const storage = readWorkspaceStorage();
  const now = new Date().toISOString();
  const existing = storage.autoSessions[tabType];

  const item: WorkspaceItem<TData> = {
    id: existing?.id || createId(),
    name,
    tabType,
    tabLabel: WORKSPACE_TAB_LABELS[tabType],
    createdAt: existing?.createdAt || now,
    updatedAt: now,
    savedManually: false,
    data,
    manualWorkId: options.manualWorkId,
    manualSnapshotHash: options.manualSnapshotHash,
  };

  storage.autoSessions[tabType] = item;
  writeWorkspaceStorage(storage);
  return item;
};

export const clearAutoSession = (tabType: WorkspaceTabType) => {
  const storage = readWorkspaceStorage();
  delete storage.autoSessions[tabType];
  writeWorkspaceStorage(storage);
};

export const saveManualWorkspaceItem = <TData>(
  tabType: WorkspaceTabType,
  name: string,
  data: TData,
  existingId?: string,
) => {
  const storage = readWorkspaceStorage();
  const now = new Date().toISOString();
  const itemIndex = existingId ? storage.manualItems.findIndex((item) => item.id === existingId) : -1;
  const existing = itemIndex >= 0 ? storage.manualItems[itemIndex] : null;
  const item: WorkspaceItem<TData> = {
    id: existing?.id || createId(),
    name,
    tabType,
    tabLabel: WORKSPACE_TAB_LABELS[tabType],
    createdAt: existing?.createdAt || now,
    updatedAt: now,
    savedManually: true,
    data,
  };

  if (itemIndex >= 0) {
    storage.manualItems[itemIndex] = item;
  } else {
    storage.manualItems.unshift(item);
  }

  storage.manualItems.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  writeWorkspaceStorage(storage);
  return item;
};

export const getRecentWorkspaceItems = (tabType?: WorkspaceTabType) => {
  const storage = readWorkspaceStorage();
  const autoItems = Object.values(storage.autoSessions).filter(Boolean) as WorkspaceItem[];
  const items = [...storage.manualItems, ...autoItems]
    .filter((item) => !tabType || item.tabType === tabType)
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

  return items.slice(0, RECENT_DISPLAY_LIMIT);
};
