'use client'
import { useEffect, useRef, ChangeEvent, useState } from 'react'
import { X, Upload, Trash2, RotateCcw } from 'lucide-react'
import { useTheme, type Mood, type Accent, type Bg, type Density, type FontSize } from '@/lib/theme'
import { TextInput } from './Input'
import { authedFetch } from '@/lib/api-client'

type Props = {
  open: boolean
  onClose: () => void
  needsPassword?: boolean
  onPasswordSaved?: () => void
}

const MOODS: { key: Mood; label: string; swatches: [string, string, string] }[] = [
  { key: '',         label: 'Default',  swatches: ['#B8E62E', '#8B7CFF', '#0E0E11'] },
  { key: 'focus',    label: 'Focus',    swatches: ['#E5E5EA', '#888888', '#0A0A0C'] },
  { key: 'midnight', label: 'Midnight', swatches: ['#6BA8FF', '#B0C4DE', '#0B1220'] },
  { key: 'forest',   label: 'Forest',   swatches: ['#88D982', '#C8B568', '#0E1A14'] },
  { key: 'sunset',   label: 'Sunset',   swatches: ['#FF9F6B', '#FFB8B8', '#1A1014'] },
  { key: 'paper',    label: 'Paper',    swatches: ['#6B7F2E', '#8B6F4A', '#F5F2EA'] },
  { key: 'cyber',    label: 'Cyber',    swatches: ['#C8FF00', '#FF4DCB', '#0A0612'] },
]

const ACCENTS: { key: Accent; label: string; color: string }[] = [
  { key: 'ticktick', label: 'TickTick', color: '#4772FA' },
  { key: '',       label: 'Anthill',  color: '#B8E62E' },
  { key: 'blue',   label: 'Blue',    color: '#4DA8FF' },
  { key: 'violet', label: 'Violet',  color: '#A78BFA' },
  { key: 'amber',  label: 'Amber',   color: '#F0A030' },
  { key: 'mono',   label: 'Mono',    color: '#E5E5EA' },
]

const BACKGROUNDS: { key: Bg; label: string; desc: string }[] = [
  { key: '',         label: 'Solid',    desc: 'Flat color' },
  { key: 'gradient', label: 'Gradient', desc: 'Diagonal accent fade' },
  { key: 'glow',     label: 'Glow',     desc: 'Soft accent glow' },
  { key: 'texture',  label: 'Texture',  desc: 'Subtle dot pattern' },
  { key: 'black',    label: 'Black',    desc: 'Pure black' },
  { key: 'focus',    label: 'Focus',    desc: 'Desaturated' },
]

export function SettingsModal({ open, onClose, needsPassword = false, onPasswordSaved }: Props) {
  const { state, set, reset, wallpaper, setWallpaper } = useTheme()
  const fileRef = useRef<HTMLInputElement>(null)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordMsg, setPasswordMsg] = useState('')
  const [passwordErr, setPasswordErr] = useState('')
  const [savingPassword, setSavingPassword] = useState(false)

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  function onWallpaperChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 4 * 1024 * 1024) {
      alert('File too large (max 4MB).')
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result
      if (typeof result === 'string') setWallpaper(result)
    }
    reader.readAsDataURL(file)
  }

  async function savePassword() {
    setPasswordMsg('')
    setPasswordErr('')

    if (newPassword.length < 8) {
      setPasswordErr('Use at least 8 characters.')
      return
    }
    if (newPassword !== confirmPassword) {
      setPasswordErr('New passwords do not match.')
      return
    }

    setSavingPassword(true)
    const res = await authedFetch('/api/auth/password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword }),
    })
    const data = await res.json().catch(() => ({}))
    setSavingPassword(false)

    if (!res.ok) {
      setPasswordErr(data.error || 'Could not update password.')
      return
    }

    setCurrentPassword('')
    setNewPassword('')
    setConfirmPassword('')
    onPasswordSaved?.()
    setPasswordMsg(needsPassword ? 'Password created.' : 'Password updated.')
  }

  const passwordSection = (
    <Section
      title={needsPassword ? 'Create password' : 'Password'}
      desc={
        needsPassword
          ? 'Add a password so email login and the extension both work even when Google is unavailable.'
          : 'Change the password on your Anthill account.'
      }
    >
      <div className="space-y-3">
        {!needsPassword && (
          <TextInput
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            placeholder="Current password"
          />
        )}
        <TextInput
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          placeholder={needsPassword ? 'Password' : 'New password'}
        />
        <TextInput
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          placeholder="Confirm password"
        />
        {passwordErr && <p className="text-xs text-accent3">{passwordErr}</p>}
        {passwordMsg && <p className="text-xs text-accent">{passwordMsg}</p>}
        <button
          onClick={savePassword}
          disabled={savingPassword}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded border border-border bg-surface2 hover:bg-surface3 text-xs disabled:opacity-50"
        >
          {savingPassword ? 'Saving...' : needsPassword ? 'Create password' : 'Update password'}
        </button>
      </div>
    </Section>
  )

  return (
    <div
      className="fixed inset-0 z-[150] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="glass-pane w-full max-w-2xl max-h-[85vh] overflow-y-auto bg-surface border border-border rounded-lg shadow-lg">
        <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 border-b border-border bg-surface/95 backdrop-blur">
          <h3 className="font-semibold text-text">{needsPassword ? 'Finish account setup' : 'Settings'}</h3>
          <div className="flex items-center gap-2">
            <button
              onClick={reset}
              className="inline-flex items-center gap-1 text-xs text-text2 hover:text-text px-2 py-1 rounded transition-colors"
              title="Reset all settings"
            >
              <RotateCcw size={12} strokeWidth={2.25} /> Reset
            </button>
            <button onClick={onClose} className="text-text2 hover:text-text" aria-label="Close">
              <X size={16} strokeWidth={2.25} />
            </button>
          </div>
        </div>

        <div className="px-6 py-5 space-y-7">
          {needsPassword && passwordSection}

          {/* Light/Dark */}
          <Section title="Mode">
            <div className="grid grid-cols-2 gap-2">
              <Pill active={state.mode === 'dark'}  onClick={() => set('mode', 'dark')}>Dark</Pill>
              <Pill active={state.mode === 'light'} onClick={() => set('mode', 'light')}>Light</Pill>
            </div>
          </Section>

          {/* Mood presets */}
          <Section title="Work mode" desc="Color theme presets.">
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {MOODS.map((m) => (
                <button
                  key={m.key || 'default'}
                  onClick={() => set('mood', m.key)}
                  className={`flex flex-col gap-1.5 p-3 rounded-lg border transition-all ${
                    state.mood === m.key
                      ? 'border-accent bg-surface3'
                      : 'border-border hover:border-border2 bg-surface2'
                  }`}
                >
                  <div className="flex gap-1">
                    {m.swatches.map((c, i) => (
                      <span key={i} className="w-4 h-4 rounded-full border border-black/20" style={{ background: c }} />
                    ))}
                  </div>
                  <span className="text-xs font-medium text-text">{m.label}</span>
                </button>
              ))}
            </div>
          </Section>

          {/* Accent override */}
          <Section title="Accent">
            <div className="flex flex-wrap gap-2">
              {ACCENTS.map((a) => (
                <button
                  key={a.key || 'default'}
                  onClick={() => set('accent', a.key)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs transition-all ${
                    state.accent === a.key ? 'border-accent bg-surface3' : 'border-border hover:border-border2 bg-surface2'
                  }`}
                >
                  <span className="w-3 h-3 rounded-full" style={{ background: a.color }} />
                  {a.label}
                </button>
              ))}
            </div>
          </Section>

          {/* Background */}
          <Section title="Background" desc="Layer behind the cards.">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {BACKGROUNDS.map((b) => (
                <button
                  key={b.key || 'solid'}
                  onClick={() => { setWallpaper(null); set('bg', b.key) }}
                  className={`flex flex-col gap-1 p-3 rounded-lg border text-left transition-all ${
                    state.bg === b.key && !wallpaper
                      ? 'border-accent bg-surface3'
                      : 'border-border hover:border-border2 bg-surface2'
                  }`}
                >
                  <span className="text-xs font-medium text-text">{b.label}</span>
                  <span className="text-[11px] text-text3">{b.desc}</span>
                </button>
              ))}
            </div>

            {/* Wallpaper */}
            <div className="mt-3 flex items-center gap-2 flex-wrap">
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={onWallpaperChange}
                className="hidden"
              />
              <button
                onClick={() => fileRef.current?.click()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded border border-border bg-surface2 hover:bg-surface3 text-xs"
              >
                <Upload size={12} strokeWidth={2.25} />
                {wallpaper ? 'Replace wallpaper' : 'Upload wallpaper'}
              </button>
              {wallpaper && (
                <button
                  onClick={() => setWallpaper(null)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded border border-border bg-surface2 hover:bg-surface3 text-xs text-text2 hover:text-accent3"
                >
                  <Trash2 size={12} strokeWidth={2.25} /> Remove
                </button>
              )}
              <span className="text-[11px] text-text3">Max 4MB · JPG, PNG, WebP</span>
            </div>
          </Section>

          {/* Glass mode */}
          <Section title="Glass">
            <Toggle
              checked={state.glass}
              onChange={(v) => set('glass', v)}
              label="Frosted cards over background"
            />
          </Section>

          {/* Card opacity + blur sliders */}
          <Section title="Cards">
            <Slider
              label="Opacity"
              value={state.cardOpacity}
              min={0.4}
              max={1}
              step={0.05}
              format={(v) => `${Math.round(v * 100)}%`}
              onChange={(v) => set('cardOpacity', v)}
            />
            <Slider
              label="Background blur"
              value={state.blur}
              min={0}
              max={30}
              step={1}
              format={(v) => `${v}px`}
              onChange={(v) => set('blur', v)}
            />
          </Section>

          {/* Density */}
          <Section title="Density">
            <div className="grid grid-cols-2 gap-2">
              <Pill active={state.density === 'cozy'}    onClick={() => set('density', 'cozy')}>Cozy</Pill>
              <Pill active={state.density === 'compact'} onClick={() => set('density', 'compact')}>Compact</Pill>
            </div>
          </Section>

          {/* Font size */}
          <Section title="Font size">
            <div className="grid grid-cols-3 gap-2">
              <Pill active={state.font === 'sm'} onClick={() => set('font', 'sm')}>Small</Pill>
              <Pill active={state.font === 'md'} onClick={() => set('font', 'md')}>Medium</Pill>
              <Pill active={state.font === 'lg'} onClick={() => set('font', 'lg')}>Large</Pill>
            </div>
          </Section>

          {!needsPassword && passwordSection}
        </div>
      </div>
    </div>
  )
}

function Section({ title, desc, children }: { title: string; desc?: string; children: React.ReactNode }) {
  return (
    <section>
      <div className="text-[11px] font-mono uppercase tracking-wider text-text3 mb-2">{title}</div>
      {desc && <div className="text-xs text-text3 mb-3 -mt-1">{desc}</div>}
      {children}
    </section>
  )
}

function Pill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-2 rounded text-sm border transition-all ${
        active ? 'border-accent bg-surface3 text-text' : 'border-border bg-surface2 text-text2 hover:text-text hover:border-border2'
      }`}
    >
      {children}
    </button>
  )
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex items-center justify-between gap-3 cursor-pointer">
      <span className="text-sm text-text">{label}</span>
      <span
        className={`relative inline-flex w-9 h-5 rounded-full transition-colors ${checked ? 'bg-accent' : 'bg-surface3'}`}
        onClick={() => onChange(!checked)}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${checked ? 'translate-x-4' : ''}`}
        />
      </span>
    </label>
  )
}

function Slider({ label, value, min, max, step, format, onChange }: {
  label: string; value: number; min: number; max: number; step: number;
  format: (v: number) => string; onChange: (v: number) => void;
}) {
  return (
    <div className="mb-3">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-sm text-text">{label}</span>
        <span className="text-[11px] font-mono text-text2">{format(value)}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-accent"
      />
    </div>
  )
}
