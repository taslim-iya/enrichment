import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface SettingsState {
  dealflowUrl: string;
  apiKey: string;
  lastSyncTime?: string;
  lastSyncCount?: number;
  columnWidths: Record<string, number>;
  visibleColumns: string[];
  setDealflowUrl: (url: string) => void;
  setApiKey: (key: string) => void;
  setLastSync: (time: string, count: number) => void;
  setColumnWidths: (widths: Record<string, number>) => void;
  setVisibleColumns: (cols: string[]) => void;
  updateColumnWidth: (col: string, width: number) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      dealflowUrl: 'https://dealflowa9.netlify.app',
      apiKey: '',
      lastSyncTime: undefined,
      lastSyncCount: undefined,
      columnWidths: {},
      visibleColumns: [],
      setDealflowUrl: (url) => set({ dealflowUrl: url }),
      setApiKey: (key) => set({ apiKey: key }),
      setLastSync: (time, count) => set({ lastSyncTime: time, lastSyncCount: count }),
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
