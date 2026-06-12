'use client'
import { createContext, useContext, useEffect, useState, ReactNode } from 'react'

export type Mood = '' | 'focus' | 'midnight' | 'forest' | 'sunset' | 'paper' | 'cyber'
export type Mode = 'dark' | 'light'
export type Accent = '' | 'ticktick' | 'blue' | 'violet' | 'amber' | 'mono'
export type Bg = '' | 'gradient' | 'glow' | 'texture' | 'glass' | 'black' | 'focus' | 'image'
export type Density = 'cozy' | 'compact'
export type FontSize = 'sm' | 'md' | 'lg'
export type BgLuma = '' | 'bright' | 'dark'

export type ThemeState = {
  mode: Mode
  mood: Mood
  accent: Accent
  bg: Bg
  glass: boolean
  density: Density
  font: FontSize
  cardOpacity: number   // 0.4 - 1.0
  blur: number          // 0 - 30 (px)
  bgLuma: BgLuma
}

const DEFAULT_STATE: ThemeState = {
  mode: 'light',
  mood: '',
  accent: 'ticktick',
  bg: '',
  glass: false,
  density: 'cozy',
  font: 'md',
  cardOpacity: 1,
  blur: 0,
  bgLuma: '',
}

const STORAGE_KEY = 'anthill_theme'
const WALLPAPER_KEY = 'anthill_wallpaper'

type ThemeContextValue = {
  state: ThemeState
  set: <K extends keyof ThemeState>(key: K, value: ThemeState[K]) => void
  reset: () => void
  wallpaper: string | null
  setWallpaper: (dataUrl: string | null) => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

function loadState(): ThemeState {
  if (typeof window === 'undefined') return DEFAULT_STATE
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_STATE
    const parsed = JSON.parse(raw)
    return { ...DEFAULT_STATE, ...parsed }
  } catch {
    return DEFAULT_STATE
  }
}

function saveState(state: ThemeState) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {}
}

function loadWallpaper(): string | null {
  if (typeof window === 'undefined') return null
  try { return localStorage.getItem(WALLPAPER_KEY) } catch { return null }
}

function saveWallpaper(dataUrl: string | null) {
  if (typeof window === 'undefined') return
  try {
    if (dataUrl) localStorage.setItem(WALLPAPER_KEY, dataUrl)
    else localStorage.removeItem(WALLPAPER_KEY)
  } catch {}
}

function applyToDom(state: ThemeState, wallpaper: string | null) {
  if (typeof document === 'undefined') return
  const html = document.documentElement
  // Attribute toggles — empty/falsy values clear the attribute
  const setAttr = (key: string, val: string) => {
    if (val) html.setAttribute(key, val)
    else html.removeAttribute(key)
  }
  setAttr('data-mode', state.mode === 'light' ? 'light' : '')
  setAttr('data-mood', state.mood)
  setAttr('data-accent', state.accent)
  setAttr('data-bg', wallpaper ? 'image' : state.bg)
  setAttr('data-glass', state.glass ? 'on' : '')
  setAttr('data-density', state.density)
  setAttr('data-font', state.font)
  setAttr('data-bg-luma', state.bgLuma)

  html.style.setProperty('--card-opacity', String(state.cardOpacity))
  html.style.setProperty('--blur', `${state.blur}px`)
  html.style.setProperty('--bg-image', wallpaper ? `url("${wallpaper}")` : 'none')
}

// Calculate luminance of an image data URL — used to decide bright/dark for text contrast.
export async function detectLuminance(dataUrl: string): Promise<'bright' | 'dark'> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas')
        const size = 32
        canvas.width = size; canvas.height = size
        const ctx = canvas.getContext('2d')!
        ctx.drawImage(img, 0, 0, size, size)
        const data = ctx.getImageData(0, 0, size, size).data
        let total = 0
        for (let i = 0; i < data.length; i += 4) {
          // Rec. 709 luma
          total += (0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2])
        }
        const avg = total / (size * size)
        resolve(avg > 140 ? 'bright' : 'dark')
      } catch {
        resolve('dark')
      }
    }
    img.onerror = () => resolve('dark')
    img.src = dataUrl
  })
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ThemeState>(DEFAULT_STATE)
  const [wallpaper, setWallpaperState] = useState<string | null>(null)

  useEffect(() => {
    const loaded = loadState()
    const wp = loadWallpaper()
    setState(loaded)
    setWallpaperState(wp)
    applyToDom(loaded, wp)
  }, [])

  useEffect(() => {
    applyToDom(state, wallpaper)
  }, [state, wallpaper])

  const set = <K extends keyof ThemeState>(key: K, value: ThemeState[K]) => {
    setState((prev) => {
      const next = { ...prev, [key]: value }
      saveState(next)
      return next
    })
  }

  const reset = () => {
    setState(DEFAULT_STATE)
    setWallpaperState(null)
    saveState(DEFAULT_STATE)
    saveWallpaper(null)
  }

  const setWallpaper = (dataUrl: string | null) => {
    setWallpaperState(dataUrl)
    saveWallpaper(dataUrl)
    if (!dataUrl) {
      // Clear luma when wallpaper is removed
      set('bgLuma', '')
    } else {
      detectLuminance(dataUrl).then((luma) => set('bgLuma', luma))
    }
  }

  return (
    <ThemeContext.Provider value={{ state, set, reset, wallpaper, setWallpaper }}>
      <div className="wallpaper" aria-hidden="true" />
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider')
  return ctx
}
