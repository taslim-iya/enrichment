import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface ApiKeys {
  openai: string;
  anthropic: string;
}

interface SettingsState {
  apiKeys: ApiKeys;
  dealflowUrl: string;
  columnWidths: Record<string, number>;
  visibleColumns: string[];
  setApiKeys: (keys: Partial<ApiKeys>) => void;
  setDealflowUrl: (url: string) => void;
  setColumnWidths: (widths: Record<string, number>) => void;
  setVisibleColumns: (cols: string[]) => void;
  updateColumnWidth: (col: string, width: number) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      apiKeys: { openai: '', anthropic: '' },
      dealflowUrl: 'https://dealflowa9.netlify.app',
      columnWidths: {},
      visibleColumns: [],
      setApiKeys: (keys) =>
        set((state) => ({ apiKeys: { ...state.apiKeys, ...keys } })),
      setDealflowUrl: (url) => set({ dealflowUrl: url }),
      setColumnWidths: (widths) => set({ columnWidths: widths }),
      setVisibleColumns: (cols) => set({ visibleColumns: cols }),
      updateColumnWidth: (col, width) =>
        set((state) => ({
          columnWidths: { ...state.columnWidths, [col]: width },
        })),
    }),
    { name: 'corgi-settings-v1' }
  )
);
