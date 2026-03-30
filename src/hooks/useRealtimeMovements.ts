'use client'

import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

/**
 * Escucha cambios en la tabla movements y llama a onUpdate.
 * Usar en cualquier página que muestre movimientos.
 */
export function useRealtimeMovements(onUpdate: () => void) {
  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel('movements-listener')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'movements',
      }, () => {
        onUpdate()
      })
      .subscribe()

    // También refrescar al volver al foco
    function handleFocus() { onUpdate() }
    window.addEventListener('focus', handleFocus)

    return () => {
      supabase.removeChannel(channel)
      window.removeEventListener('focus', handleFocus)
    }
  }, [onUpdate])
}
