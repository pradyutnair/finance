"use client"

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react"

type Rates = Record<string, number>

type CurrencyContextValue = {
  baseCurrency: string
  setBaseCurrency: (code: string) => void
  rates: Rates | null
  convertAmount: (amount: number, fromCurrency: string, toCurrency?: string) => number
  formatAmount: (amount: number, currency?: string, options?: Intl.NumberFormatOptions) => string
  getCurrencySymbol: (currency: string) => string
  supportedCurrencies: string[]
}

const CurrencyContext = createContext<CurrencyContextValue | undefined>(undefined)

// European currencies (non-EUR) commonly available from ECB feed
const EUROPEAN_CURRENCIES = [
  "GBP", "CHF", "SEK", "NOK", "DKK", "PLN", "HUF", "CZK", "RON", "BGN", "HRK", "ISK"
]

const PREFERRED = ["EUR", "USD", "INR", "GBP"]

const LOCAL_STORAGE_KEY = "nexpass_fx_rates_v2"
const LOCAL_STORAGE_BASE_KEY = "nexpass_base_currency_v1"

type StoredRates = {
  date: string // YYYY-MM-DD (UTC today)
  rates: Rates
}

async function fetchLatestRatesEURBase(): Promise<StoredRates> {
  const today = new Date()
  const yyyy = today.getUTCFullYear()
  const mm = String(today.getUTCMonth() + 1).padStart(2, "0")
  const dd = String(today.getUTCDate()).padStart(2, "0")
  const dateStr = `${yyyy}-${mm}-${dd}`

  // Use exchangerate-api.com (free tier, no key required)
  console.log('Fetching exchange rates from API...')
  const res = await fetch("https://api.exchangerate-api.com/v4/latest/EUR")
  const json = await res.json()
  console.log('Raw API response:', json)
  const rates: Rates = { EUR: 1, ...(json?.rates || {}) }
  console.log('Processed rates:', { USD: rates.USD, GBP: rates.GBP, INR: rates.INR })
  return { date: dateStr, rates }
}

function readCachedRates(): StoredRates | null {
  try {
    const raw = typeof window !== "undefined" ? window.localStorage.getItem(LOCAL_STORAGE_KEY) : null
    if (!raw) return null
    const parsed = JSON.parse(raw) as StoredRates
    return parsed?.rates ? parsed : null
  } catch {
    return null
  }
}

function writeCachedRates(data: StoredRates) {
  try {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(data))
    }
  } catch {
    // ignore
  }
}

function getCurrencySymbolInternal(currency: string): string {
  const symbols: Record<string, string> = {
    USD: "$",
    EUR: "€",
    GBP: "£",
    JPY: "¥",
    CNY: "¥",
    INR: "₹",
    KRW: "₩",
    CAD: "C$",
    AUD: "A$",
    CHF: "CHF",
    SEK: "kr",
    NOK: "kr",
    DKK: "kr",
    PLN: "zł",
    BRL: "R$",
    MXN: "$",
    ZAR: "R",
    SGD: "S$",
    HKD: "HK$",
    NZD: "NZ$",
    HUF: "Ft",
    CZK: "Kč",
    RON: "lei",
    BGN: "лв",
    HRK: "€", // Croatia uses EUR now
    ISK: "kr"
  }
  return symbols[currency] || currency
}

export function CurrencyProvider({ children }: { children: React.ReactNode }) {
  const [baseCurrency, setBaseCurrency] = useState<string>("EUR")
  const [rates, setRates] = useState<Rates | null>(null)
  
  // Debug: log when rates change
  useEffect(() => {
    console.log('Rates state updated:', rates ? { USD: rates.USD, GBP: rates.GBP, INR: rates.INR } : 'null')
  }, [rates])

  // Load rates once per day with localStorage cache
  useEffect(() => {
    let cancelled = false
    const init = async () => {
      const cached = readCachedRates()

      const today = new Date()
      const yyyy = today.getUTCFullYear()
      const mm = String(today.getUTCMonth() + 1).padStart(2, "0")
      const dd = String(today.getUTCDate()).padStart(2, "0")
      const dateStr = `${yyyy}-${mm}-${dd}`

      if (cached && cached.date === dateStr) {
        if (!cancelled) {
          setRates(cached.rates)
          console.log('Using cached exchange rates:', { USD: cached.rates.USD, GBP: cached.rates.GBP })
        }
        return
      }

      try {
        const fresh = await fetchLatestRatesEURBase()
        if (!cancelled) {
          setRates(fresh.rates)
          console.log(`Loaded fresh exchange rates:`, Object.keys(fresh.rates).slice(0, 5))
        }
        writeCachedRates(fresh)
      } catch (error) {
        console.warn('Failed to fetch exchange rates, using cached or defaults:', error)
        // Fallback with some hardcoded rates for testing
        const fallbackRates = { EUR: 1, USD: 1.17, GBP: 0.85, INR: 86.5 }
        if (!cancelled) setRates(cached?.rates || fallbackRates)
        console.log('Using fallback rates:', fallbackRates)
      }
    }
    init()
    return () => {
      cancelled = true
    }
  }, [])

  // Load preferred base currency from localStorage
  useEffect(() => {
    try {
      const saved = typeof window !== "undefined" ? window.localStorage.getItem(LOCAL_STORAGE_BASE_KEY) : null
      if (saved) {
        setBaseCurrency(saved)
      }
    } catch {
      // ignore
    }
  }, [])

  // Persist base currency changes
  useEffect(() => {
    try {
      if (typeof window !== "undefined") {
        window.localStorage.setItem(LOCAL_STORAGE_BASE_KEY, baseCurrency)
      }
    } catch {
      // ignore
    }
  }, [baseCurrency])

  const convertAmount = useCallback(
    (amount: number, fromCurrency: string, toCurrency?: string) => {
      const to = (toCurrency || baseCurrency || "EUR").toUpperCase()
      const from = (fromCurrency || "EUR").toUpperCase()
      if (!amount || Number.isNaN(amount)) return 0
      if (from === to) return amount
      const r = rates || { EUR: 1 }
      const rFrom = from === "EUR" ? 1 : r[from]
      const rTo = to === "EUR" ? 1 : r[to]
      if (!rFrom || !rTo) {
        console.warn(`Missing exchange rate: ${from} -> ${to}`, { rFrom, rTo, rates })
        return amount
      }
      const amountInEUR = amount / rFrom
      const converted = amountInEUR * rTo
      // Only log significant conversions for debugging
      if (amount > 100) {
        console.log(`Converting ${amount} ${from} -> ${converted.toFixed(2)} ${to} (rate: ${rTo})`)
      }
      return converted
    },
    [baseCurrency, rates]
  )

  const formatAmount = useCallback(
    (amount: number, currency?: string, options?: Intl.NumberFormatOptions) => {
      const curr = (currency || baseCurrency || "EUR").toUpperCase()
      try {
        return new Intl.NumberFormat(undefined, {
          style: "currency",
          currency: curr,
          maximumFractionDigits: 2,
          ...(options || {}),
        }).format(amount)
      } catch {
        return `${getCurrencySymbolInternal(curr)}${amount.toFixed(2)}`
      }
    },
    [baseCurrency]
  )

  const supportedCurrencies = useMemo<string[]>(() => {
    const results = Array.from(new Set([...
      PREFERRED,
      ...EUROPEAN_CURRENCIES
    ]))
    return results
  }, [])

  const value = useMemo<CurrencyContextValue>(() => ({
    baseCurrency,
    setBaseCurrency,
    rates,
    convertAmount,
    formatAmount,
    getCurrencySymbol: getCurrencySymbolInternal,
    supportedCurrencies,
  }), [baseCurrency, rates, convertAmount, formatAmount, supportedCurrencies])

  return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>
}

export function useCurrency() {
  const ctx = useContext(CurrencyContext)
  if (!ctx) throw new Error("useCurrency must be used within CurrencyProvider")
  return ctx
}


