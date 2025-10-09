'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { DateRange } from 'react-day-picker';
import { startOfMonth } from 'date-fns';

interface DateRangeState {
  dateRange: DateRange | undefined;
  setDateRange: (range: DateRange | undefined) => void;
  formatDateForAPI: (date: Date) => string;
}

export const useDateRangeStore = create<DateRangeState>()(
  persist(
    (set) => ({
      dateRange: {
        from: startOfMonth(new Date()),
        to: new Date(),
      },

      setDateRange: (range) => {
        set({ dateRange: range });
      },

      formatDateForAPI: (date: Date) => {
        return date.toISOString().split('T')[0]; // YYYY-MM-DD format
      },
    }),
    {
      name: 'nexpass-date-range-storage',
      partialize: (state) => ({
        dateRange: state.dateRange
          ? {
              from: state.dateRange.from?.toISOString(),
              to: state.dateRange.to?.toISOString(),
            }
          : undefined,
      }),
      // Custom deserializer to convert ISO strings back to Date objects
      onRehydrateStorage: () => (state) => {
        if (state && state.dateRange) {
          const range = state.dateRange as any;
          state.dateRange = {
            from: range.from ? new Date(range.from) : undefined,
            to: range.to ? new Date(range.to) : undefined,
          };
        }
      },
    }
  )
);
