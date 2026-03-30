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

export function invalidateCatalogCache() {
  cached = null
}

export function useCatalog() {
  const [state, setState] = useState<State>({
    businesses: [], categories: [], exchangeRates: {}, rules: [],
    loading: !cached, error: null,
  })

  async function loadData() {
    try {
      const [catalog, rulesRes] = await Promise.all([
        fetch('/api/catalog').then(r => r.json()),
        fetch('/api/rules').then(r => r.json()),
      ])
      const data: CatalogData = {
        businesses:    catalog.data?.businesses    ?? [],
        categories:    catalog.data?.categories    ?? [],
        exchangeRates: catalog.data?.exchangeRates ?? {},
        rules:         rulesRes.data               ?? [],
      }
      cached = data
      setState({ ...data, loading: false, error: null })
    } catch (err: any) {
      setState(s => ({ ...s, loading: false, error: err.message }))
    }
  }

  useEffect(() => {
    if (cached) {
      setState({ ...cached, loading: false, error: null })
    } else {
      loadData()
    }

    // Refresco al volver al foco (cuando cambiás de app/pestaña)
    function handleFocus() {
      cached = null
      loadData()
    }
    window.addEventListener('focus', handleFocus)
    return () => window.removeEventListener('focus', handleFocus)
  }, [])

  function invalidate() {
    cached = null
    loadData()
  }

  return { ...state, invalidate }
}
