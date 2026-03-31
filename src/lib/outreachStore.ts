import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface OutreachStep {
  id: string;
  type: 'email' | 'call' | 'linkedin';
  delay_days: number;
  subject?: string;
  template: string;
}

export interface OutreachSequence {
  id: string;
  name: string;
  steps: OutreachStep[];
  created_at: string;
}

export interface OutreachEntry {
  id: string;
  company_id: number;
  sequence_id: string;
  current_step: number;
  status: 'pending' | 'in_progress' | 'completed' | 'paused' | 'bounced' | 'replied';
  started_at: string;
  last_action_at?: string;
  notes?: string;
}

interface OutreachState {
  sequences: OutreachSequence[];
  entries: OutreachEntry[];

  // Sequence CRUD
  addSequence: (seq: OutreachSequence) => void;
  updateSequence: (id: string, updates: Partial<OutreachSequence>) => void;
  deleteSequence: (id: string) => void;

  // Entry management
  addEntry: (entry: OutreachEntry) => void;
  updateEntry: (id: string, updates: Partial<OutreachEntry>) => void;
  deleteEntry: (id: string) => void;
  advanceEntry: (id: string) => void;
}

export const useOutreachStore = create<OutreachState>()(
  persist(
    (set) => ({
      sequences: [],
      entries: [],

      addSequence: (seq) =>
        set((state) => ({ sequences: [...state.sequences, seq] })),

      updateSequence: (id, updates) =>
        set((state) => ({
          sequences: state.sequences.map((s) =>
            s.id === id ? { ...s, ...updates } : s
          ),
        })),

      deleteSequence: (id) =>
        set((state) => ({
          sequences: state.sequences.filter((s) => s.id !== id),
          entries: state.entries.filter((e) => e.sequence_id !== id),
        })),

      addEntry: (entry) =>
        set((state) => ({ entries: [...state.entries, entry] })),

      updateEntry: (id, updates) =>
        set((state) => ({
          entries: state.entries.map((e) =>
            e.id === id ? { ...e, ...updates } : e
          ),
        })),

      deleteEntry: (id) =>
        set((state) => ({
          entries: state.entries.filter((e) => e.id !== id),
        })),

      advanceEntry: (id) =>
        set((state) => ({
          entries: state.entries.map((e) => {
            if (e.id !== id) return e;
            const seq = state.sequences.find((s) => s.id === e.sequence_id);
            const maxStep = seq ? seq.steps.length - 1 : 0;
            const nextStep = e.current_step + 1;
            return {
              ...e,
              current_step: nextStep,
              last_action_at: new Date().toISOString(),
              status: nextStep > maxStep ? 'completed' : 'in_progress',
            };
          }),
        })),
    }),
    { name: 'corgi-outreach-v1' }
  )
);
