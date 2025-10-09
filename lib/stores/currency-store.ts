'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type Rates = Record<string, number>;

interface CurrencyState {
  baseCurrency: string;
  rates: Rates | null;
  preferredCurrencies: string[];
  ratesDate: string | null;
  loading: boolean;
  
  setBaseCurrency: (code: string) => void;
  setRates: (rates: Rates, date: string) => void;
  updatePreferredCurrencies: (currencies: string[]) => void;
  convertAmount: (amount: number, fromCurrency: string, toCurrency?: string) => number;
  formatAmount: (amount: number, currency?: string, options?: Intl.NumberFormatOptions) => string;
  getCurrencySymbol: (currency: string) => string;
  fetchRates: () => Promise<void>;
}

// European currencies (non-EUR) commonly available from ECB feed
const EUROPEAN_CURRENCIES = [
  'GBP', 'CHF', 'SEK', 'NOK', 'DKK', 'PLN', 'HUF', 'CZK', 'RON', 'BGN', 'HRK', 'ISK'
];

const PREFERRED = ['EUR', 'USD', 'INR', 'GBP'];

const supportedCurrencies = Array.from(new Set([...PREFERRED, ...EUROPEAN_CURRENCIES]));

function getCurrencySymbolInternal(currency: string): string {
  const symbols: Record<string, string> = {
    USD: '$',
    EUR: '€',
    GBP: '£',
    JPY: '¥',
    CNY: '¥',
    INR: '₹',
    KRW: '₩',
    CAD: 'C$',
    AUD: 'A$',
    CHF: 'CHF',
    SEK: 'kr',
    NOK: 'kr',
    DKK: 'kr',
    PLN: 'zł',
    BRL: 'R$',
    MXN: '$',
    ZAR: 'R',
    SGD: 'S$',
    HKD: 'HK$',
    NZD: 'NZ$',
    HUF: 'Ft',
    CZK: 'Kč',
    RON: 'lei',
    BGN: 'лв',
    HRK: '€',
    ISK: 'kr'
  };
  return symbols[currency] || currency;
}

async function fetchLatestRatesEURBase(): Promise<{ date: string; rates: Rates }> {
  const today = new Date();
  const yyyy = today.getUTCFullYear();
  const mm = String(today.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(today.getUTCDate()).padStart(2, '0');
  const dateStr = `${yyyy}-${mm}-${dd}`;

  console.log('Fetching exchange rates from API...');
  const res = await fetch('https://api.exchangerate-api.com/v4/latest/EUR');
  const json = await res.json();
  console.log('Raw API response:', json);
  const rates: Rates = { EUR: 1, ...(json?.rates || {}) };
  console.log('Processed rates:', { USD: rates.USD, GBP: rates.GBP, INR: rates.INR });
  return { date: dateStr, rates };
}

export const useCurrencyStore = create<CurrencyState>()(
  persist(
    (set, get) => ({
      baseCurrency: 'EUR',
      rates: null,
      preferredCurrencies: PREFERRED,
      ratesDate: null,
      loading: false,

      setBaseCurrency: (code) => {
        set({ baseCurrency: code });
      },

      setRates: (rates, date) => {
        set({ rates, ratesDate: date, loading: false });
      },

      updatePreferredCurrencies: (currencies) => {
        const state = get();
        set({ preferredCurrencies: currencies });
        if (!currencies.includes(state.baseCurrency)) {
          set({ baseCurrency: currencies[0] });
        }
      },

      convertAmount: (amount: number, fromCurrency: string, toCurrency?: string) => {
        const state = get();
        const to = (toCurrency || state.baseCurrency || 'EUR').toUpperCase();
        const from = (fromCurrency || 'EUR').toUpperCase();
        if (!amount || Number.isNaN(amount)) return 0;
        if (from === to) return amount;
        
        const r = state.rates || { EUR: 1 };
        const rFrom = from === 'EUR' ? 1 : r[from];
        const rTo = to === 'EUR' ? 1 : r[to];
        
        if (!rFrom || !rTo) {
          console.warn(`Missing exchange rate: ${from} -> ${to}`, { rFrom, rTo, rates: state.rates });
          return amount;
        }
        
        const amountInEUR = amount / rFrom;
        const converted = amountInEUR * rTo;
        
        if (amount > 100) {
          console.log(`Converting ${amount} ${from} -> ${converted.toFixed(2)} ${to} (rate: ${rTo})`);
        }
        
        return converted;
      },

      formatAmount: (amount: number, currency?: string, options?: Intl.NumberFormatOptions) => {
        const state = get();
        const curr = (currency || state.baseCurrency || 'EUR').toUpperCase();
        try {
          return new Intl.NumberFormat(undefined, {
            style: 'currency',
            currency: curr,
            maximumFractionDigits: 2,
            ...(options || {}),
          }).format(amount);
        } catch {
          return `${getCurrencySymbolInternal(curr)}${amount.toFixed(2)}`;
        }
      },

      getCurrencySymbol: getCurrencySymbolInternal,

      fetchRates: async () => {
        const state = get();
        
        // Check if we already have today's rates
        const today = new Date();
        const yyyy = today.getUTCFullYear();
        const mm = String(today.getUTCMonth() + 1).padStart(2, '0');
        const dd = String(today.getUTCDate()).padStart(2, '0');
        const dateStr = `${yyyy}-${mm}-${dd}`;

        if (state.ratesDate === dateStr && state.rates) {
          console.log('Using cached exchange rates:', { USD: state.rates.USD, GBP: state.rates.GBP });
          return;
        }

        set({ loading: true });

        try {
          const fresh = await fetchLatestRatesEURBase();
          set({ rates: fresh.rates, ratesDate: fresh.date, loading: false });
          console.log('Loaded fresh exchange rates:', Object.keys(fresh.rates).slice(0, 5));
        } catch (error) {
          console.warn('Failed to fetch exchange rates, using cached or defaults:', error);
          // Fallback with some hardcoded rates for testing
          const fallbackRates = { EUR: 1, USD: 1.17, GBP: 0.85, INR: 86.5 };
          set({ rates: state.rates || fallbackRates, loading: false });
          console.log('Using fallback rates:', fallbackRates);
        }
      },
    }),
    {
      name: 'nexpass-currency-storage',
      partialize: (state) => ({
        baseCurrency: state.baseCurrency,
        rates: state.rates,
        preferredCurrencies: state.preferredCurrencies,
        ratesDate: state.ratesDate,
      }),
    }
  )
);

// Export supported currencies as constant
export const SUPPORTED_CURRENCIES = supportedCurrencies;

// Initialize currency rates on app load
export const initializeCurrency = () => {
  const { rates, fetchRates } = useCurrencyStore.getState();
  if (!rates) {
    fetchRates();
  }
};
