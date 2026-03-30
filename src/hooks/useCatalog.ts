'use client'

import { useEffect, useState, useRef } from 'react'
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

export function invalidateCatalogCache() {
  cached = null
}

export function useCatalog() {
  const [state, setState] = useState<State>({
    businesses: [], categories: [], exchangeRates: {}, rules: [],
    loading: !cached, error: null,
  })
  const channelRef = useRef<any>(null)

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
    // Cargar datos iniciales
    if (cached) {
      setState({ ...cached, loading: false, error: null })
    } else {
      loadData()
    }

    // Suscribirse a cambios en tiempo real via Supabase Realtime
    const supabase = createClient()
    const channel = supabase
      .channel('catalog-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'categories' }, () => {
        cached = null
        loadData()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'businesses' }, () => {
        cached = null
        loadData()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'split_rules' }, () => {
        cached = null
        loadData()
      })
      .subscribe()

    channelRef.current = channel

    // Refresco al volver al foco (cuando el usuario cambia de app/pestaña)
    function handleFocus() {
      cached = null
      loadData()
    }
    window.addEventListener('focus', handleFocus)

    return () => {
      supabase.removeChannel(channel)
      window.removeEventListener('focus', handleFocus)
    }
  }, [])

  function invalidate() {
    cached = null
    loadData()
  }

  return { ...state, invalidate }
}
