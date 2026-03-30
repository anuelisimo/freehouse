'use client'

import { useEffect, useState } from 'react'
import type { Business, Category, SplitRule } from '@/types'
import { createClient } from '@/lib/supabase/client'

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

export function invalidateCatalogCache() { cached = null }

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

    // Intentar Realtime — si falla, continúa sin él
    let channel: any = null
    try {
      const supabase = createClient()
      channel = supabase
        .channel('catalog-realtime')
        .on('postgres_changes' as any, { event: '*', schema: 'public', table: 'categories' }, () => {
          cached = null; loadData()
        })
        .on('postgres_changes' as any, { event: '*', schema: 'public', table: 'businesses' }, () => {
          cached = null; loadData()
        })
        .on('postgres_changes' as any, { event: '*', schema: 'public', table: 'split_rules' }, () => {
          cached = null; loadData()
        })
        .subscribe((status: string) => {
          // Si falla silenciosamente, no hay problema — funciona sin realtime
          if (status === 'CHANNEL_ERROR') console.info('Realtime no disponible, usando modo sin sincronización')
        })
    } catch (e) {
      // Realtime no disponible — funciona igual sin él
    }

    // Refresco al volver al foco como fallback
    function handleFocus() { cached = null; loadData() }
    window.addEventListener('focus', handleFocus)

    return () => {
      if (channel) {
        try { createClient().removeChannel(channel) } catch(e) {}
      }
      window.removeEventListener('focus', handleFocus)
    }
  }, [])

  function invalidate() { cached = null; loadData() }

  return { ...state, invalidate }
}
