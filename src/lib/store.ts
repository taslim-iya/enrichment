import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface CustomColumn {
  id: string;
  name: string;
  key: string;
  type: 'text' | 'number' | 'currency' | 'date' | 'url' | 'email' | 'phone' | 'dropdown';
  options?: string[];
  aiEnrichable: boolean;
  width: number;
  created_at: string;
}

const DEFAULT_OPENAI_KEY =
  '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';

interface SettingsState {
  // DealFlow
  dealflowUrl: string;
  apiKey: string;
  lastSyncTime?: string;
  lastSyncCount?: number;
  // Display
  columnWidths: Record<string, number>;
  columnOrder: string[];
  visibleColumns: string[];
  // AI integrations
  openaiKey: string;
  apolloApiKey: string;
  insightEngineUrl: string;
  // Custom columns
  customColumns: CustomColumn[];
  // Setters
  setDealflowUrl: (url: string) => void;
  setApiKey: (key: string) => void;
  setLastSync: (time: string, count: number) => void;
  setColumnWidths: (widths: Record<string, number>) => void;
  setVisibleColumns: (cols: string[]) => void;
  setColumnOrder: (order: string[]) => void;
  updateColumnWidth: (col: string, width: number) => void;
  setOpenaiKey: (key: string) => void;
  setApolloApiKey: (key: string) => void;
  setInsightEngineUrl: (url: string) => void;
  setCustomColumns: (cols: CustomColumn[]) => void;
  addCustomColumn: (col: CustomColumn) => void;
  deleteCustomColumn: (id: string) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      dealflowUrl: 'https://dealflowa9.netlify.app',
      apiKey: '32bdaa77-de32-44cd-a5b6-7d524ba4ecde',
      lastSyncTime: undefined,
      lastSyncCount: undefined,
      columnWidths: {},
      columnOrder: [],
      visibleColumns: [],
      openaiKey: DEFAULT_OPENAI_KEY,
      apolloApiKey: 'p_k86JQdDzCm5G3aZqH6zg',
      insightEngineUrl: 'https://insighta9.netlify.app',
      setDealflowUrl: (url) => set({ dealflowUrl: url }),
      setApiKey: (key) => set({ apiKey: key }),
      setLastSync: (time, count) => set({ lastSyncTime: time, lastSyncCount: count }),
      setColumnWidths: (widths) => set({ columnWidths: widths }),
      setVisibleColumns: (cols) => set({ visibleColumns: cols }),
      setColumnOrder: (order) => set({ columnOrder: order }),
      updateColumnWidth: (col, width) =>
        set((state) => ({
          columnWidths: { ...state.columnWidths, [col]: width },
        })),
      customColumns: [],
      setOpenaiKey: (key) => set({ openaiKey: key }),
      setApolloApiKey: (key) => set({ apolloApiKey: key }),
      setInsightEngineUrl: (url) => set({ insightEngineUrl: url }),
      setCustomColumns: (cols) => set({ customColumns: cols }),
      addCustomColumn: (col) => set((state) => ({ customColumns: [...state.customColumns, col] })),
      deleteCustomColumn: (id) =>
        set((state) => ({ customColumns: state.customColumns.filter(c => c.id !== id) })),
    }),
    {
      name: 'corgi-settings-v4',
      merge: (persisted: unknown, current: SettingsState) => {
        const p = persisted as Partial<SettingsState> || {};
        return {
          ...current,
          ...p,
          // Force-fill empty API keys with defaults
          apiKey: p.apiKey || '32bdaa77-de32-44cd-a5b6-7d524ba4ecde',
          dealflowUrl: p.dealflowUrl || 'https://dealflowa9.netlify.app',
          openaiApiKey: p.openaiApiKey || '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',
        };
      },
    }
  )
);
