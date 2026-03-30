'use client'

import { useEffect, useState } from 'react'
import type { Business, Category, SplitRule } from '@/types'

interface CatalogData {
  businesses:    Business[]
  categories:    Category[]
  exchangeRates: Record<string, number>
  rules:         SplitRule[]
}

interface State extends CatalogData {
  loading: boolean
  error:   string | null
}

let cached: CatalogData | null = null

export function useCatalog() {
  const [state, setState] = useState<State>({
    businesses: [], categories: [], exchangeRates: {}, rules: [],
    loading: !cached, error: null,
  })

  useEffect(() => {
    if (cached) {
      setState({ ...cached, loading: false, error: null })
      return
    }
    Promise.all([
      fetch('/api/catalog').then(r => r.json()),
      fetch('/api/rules').then(r => r.json()),
    ]).then(([catalog, rulesRes]) => {
      const data: CatalogData = {
        businesses:    catalog.data?.businesses    ?? [],
        categories:    catalog.data?.categories    ?? [],
        exchangeRates: catalog.data?.exchangeRates ?? {},
        rules:         rulesRes.data               ?? [],
      }
      cached = data
      setState({ ...data, loading: false, error: null })
    }).catch(err => {
      setState(s => ({ ...s, loading: false, error: err.message }))
    })
  }, [])

  function invalidate() { cached = null }

  return { ...state, invalidate }
}
