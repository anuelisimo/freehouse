'use client'

import { createContext, useContext, useEffect, useMemo, useState } from 'react'

export type CurrencyView = 'ARS' | 'USD'

const CurrencyViewContext = createContext<{
  currencyView: CurrencyView
  setCurrencyView: (currency: CurrencyView) => void
}>({
  currencyView: 'ARS',
  setCurrencyView: () => {},
})

export function CurrencyViewProvider({ children }: { children: React.ReactNode }) {
  const [currencyView, setCurrencyViewState] = useState<CurrencyView>('ARS')

  useEffect(() => {
    try {
      const stored = localStorage.getItem('fh-currency-view')
      if (stored === 'USD' || stored === 'ARS') setCurrencyViewState(stored)
    } catch {}
  }, [])

  function setCurrencyView(next: CurrencyView) {
    setCurrencyViewState(next)
    try { localStorage.setItem('fh-currency-view', next) } catch {}
  }

  const value = useMemo(() => ({ currencyView, setCurrencyView }), [currencyView])

  return <CurrencyViewContext.Provider value={value}>{children}</CurrencyViewContext.Provider>
}

export function useCurrencyView() {
  return useContext(CurrencyViewContext)
}
