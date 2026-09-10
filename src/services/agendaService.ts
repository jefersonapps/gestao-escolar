import type { AgendaActivity } from '@/types/agenda';
import { fetch as tauriFetch } from '@tauri-apps/plugin-http';
import { invoke } from '@tauri-apps/api/core';

const API_BASE = 'http://127.0.0.1:8000';
const LOCAL_STORAGE_KEY = 'gestao_escolar_agenda_atividades';

/**
 * Checks whether we are running inside Tauri desktop environment
 */
function isTauriEnvironment(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

/**
 * Universal fetch that works in Tauri and browser
 */
async function appFetch(url: string, options?: RequestInit): Promise<Response> {
  try {
    return await tauriFetch(url, options as any);
  } catch {
    return await window.fetch(url, options);
  }
}

export class AgendaService {
  /**
   * Checks if automation is ready. In Tauri, it is always natively ready!
   */
  static async checkServerStatus(): Promise<{ online: boolean; message?: string }> {
    if (isTauriEnvironment()) {
      // Auto-start background server silently just in case
      try {
        await invoke('start_agenda_server');
      } catch {
        // ignore
      }
      return { online: true, message: 'Automação Integrada Pronta' };
    }

    try {
      const res = await appFetch(`${API_BASE}/api/status`, { method: 'GET' });
      if (res.ok) {
        return { online: true, message: 'Servidor conectado' };
      }
      return { online: false, message: 'Servidor respondeu com erro' };
    } catch {
      return { online: false, message: 'Servidor offline' };
    }
  }

  /**
   * Loads activities from Tauri native command, server, or localStorage
   */
  static async loadActivities(): Promise<{ activities: AgendaActivity[]; source: 'tauri' | 'server' | 'local' }> {
    // 1. Try Tauri native command
    if (isTauriEnvironment()) {
      try {
        const rawJson = await invoke<string>('load_agenda_activities');
        if (rawJson && rawJson !== '[]') {
          const parsed = JSON.parse(rawJson);
          if (Array.isArray(parsed) && parsed.length > 0) {
            localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(parsed));
            return { activities: parsed, source: 'tauri' };
          }
        }
      } catch (e) {
        console.warn('[AgendaService] Tauri load command error, falling back:', e);
      }
    }

    // 2. Try HTTP Server
    try {
      const res = await appFetch(`${API_BASE}/api/activities`, { method: 'GET' });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(data));
          return { activities: data, source: 'server' };
        }
      }
    } catch {
      // ignore
    }

    // 3. Fallback to LocalStorage
    const localData = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (localData) {
      try {
        const parsed = JSON.parse(localData);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return { activities: parsed, source: 'local' };
        }
      } catch {
        // ignore
      }
    }

    return { activities: [], source: 'local' };
  }

  /**
   * Saves updated activities to Tauri file system, localStorage, and server
   */
  static async saveActivities(activities: AgendaActivity[]): Promise<boolean> {
    const jsonStr = JSON.stringify(activities, null, 2);
    localStorage.setItem(LOCAL_STORAGE_KEY, jsonStr);

    if (isTauriEnvironment()) {
      try {
        await invoke('save_agenda_activities', { data: jsonStr });
      } catch (e) {
        console.warn('[AgendaService] Tauri save command error:', e);
      }
    }

    try {
      await appFetch(`${API_BASE}/api/activities`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: jsonStr
      });
    } catch {
      // ignore
    }

    return true;
  }

  /**
   * Triggers the assisted Playwright launch directly via Tauri or HTTP server
   */
  static async launchAssistedBrowser(): Promise<{ success: boolean; message: string }> {
    // 1. Try Tauri native process spawn
    if (isTauriEnvironment()) {
      try {
        const msg = await invoke<string>('launch_agenda_automation');
        return {
          success: true,
          message: msg || 'Navegador Chromium iniciado com sucesso! Aguarde o preenchimento no SGEDU.'
        };
      } catch (err) {
        console.warn('[AgendaService] Tauri launch error, trying HTTP fallback:', err);
      }
    }

    // 2. Try HTTP server
    try {
      const res = await appFetch(`${API_BASE}/api/launch-assisted`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      if (res.ok) {
        const data = await res.json();
        return { success: true, message: data.message || 'Navegador iniciado com sucesso!' };
      }
      const errText = await res.text();
      return { success: false, message: `Erro ao iniciar navegador: ${errText}` };
    } catch {
      return {
        success: false,
        message: 'Não foi possível iniciar a automação automaticamente. Verifique se os arquivos da agenda estão presentes.'
      };
    }
  }

  /**
   * Fetches progress data from progresso.json
   */
  static async getProgress(): Promise<{ concluidos_ids: (string | number)[]; total?: number }> {
    if (isTauriEnvironment()) {
      try {
        const raw = await invoke<string>('get_agenda_progress');
        if (raw) {
          const parsed = JSON.parse(raw);
          return parsed;
        }
      } catch {
        // ignore
      }
    }

    try {
      const res = await appFetch(`${API_BASE}/api/progress`, { method: 'GET' });
      if (res.ok) {
        return await res.json();
      }
    } catch {
      // ignore
    }

    return { concluidos_ids: [] };
  }

  /**
   * Resets progress
   */
  static async resetProgress(): Promise<boolean> {
    try {
      const res = await appFetch(`${API_BASE}/api/progress/reset`, { method: 'POST' });
      return res.ok;
    } catch {
      return false;
    }
  }
}
