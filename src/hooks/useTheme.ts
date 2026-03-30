'use client'

import { useEffect, useState } from 'react'

export type Theme = 'dark' | 'light'

export function useTheme() {
  const [theme, setTheme] = useState<Theme>('dark')

  useEffect(() => {
    const saved = localStorage.getItem('fh-theme') as Theme | null
    const initial = saved ?? 'dark'
    setTheme(initial)
    applyTheme(initial)
  }, [])

  function toggle() {
    const next: Theme = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    localStorage.setItem('fh-theme', next)
    applyTheme(next)
  }

  return { theme, toggle }
}

function applyTheme(theme: Theme) {
  const root = document.documentElement
  if (theme === 'light') {
    root.setAttribute('data-theme', 'light')
  } else {
    root.removeAttribute('data-theme')
  }
}
