'use client'
import { useCallback, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Users, Search, Plus, Mail, Phone, Building2, Pencil, Trash2, X, Check } from 'lucide-react'
import { EmptyState } from '@/components/ui/EmptyState'
import { getToken } from '@/lib/auth/api-client'
import { useRevalidate } from '@/lib/use-revalidate'

export type Contact = {
  id: string
  name: string | null
  email: string | null
  phone: string | null
  company: string | null
  notes: string | null
  createdAt: string
}

const AVATAR_COLORS = ['#5B8DB8', '#1C7A50', '#B0703B', '#6C5DAB', '#B26B2C', '#556B2F']

function avatarColor(seed: string): string {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0
  return AVATAR_COLORS[h % AVATAR_COLORS.length]
}

function initialsOf(c: Contact): string {
  const source = c.name || c.email || c.phone || '?'
  const parts = source.trim().split(/\s+/).filter(Boolean)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return source.slice(0, 2).toUpperCase()
}

function displayName(c: Contact): string {
  return c.name || c.email || c.phone || 'Unknown'
}

function timeAgo(iso: string): string {
  const d = (Date.now() - new Date(iso).getTime()) / 1000
  if (d < 3600) return `${Math.max(1, Math.floor(d / 60))}m ago`
  if (d < 86400) return `${Math.floor(d / 3600)}h ago`
  const days = Math.floor(d / 86400)
  if (days < 7) return `${days}d ago`
  if (days < 30) return `${Math.floor(days / 7)}w ago`
  return `${Math.floor(days / 30)}mo ago`
}

export default function ContactsPage() {
  const router = useRouter()
  const [contacts, setContacts] = useState<Contact[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [adding, setAdding] = useState(false)

  const fetchContacts = useCallback(async () => {
    const tk = getToken()
    if (!tk) { router.replace('/login'); return }
    const res = await fetch('/api/contacts', { headers: { Authorization: `Bearer ${tk}` } })
    if (res.status === 401) { router.replace('/login'); return }
    setContacts(await res.json())
    setLoading(false)
  }, [router])

  useRevalidate(fetchContacts)

  async function deleteContact(id: string) {
    setContacts((prev) => prev.filter((c) => c.id !== id))
    await fetch(`/api/contacts/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${getToken()}` } })
  }

  async function saveEdit(id: string, patch: Partial<Contact>): Promise<boolean> {
    const res = await fetch(`/api/contacts/${id}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${getToken()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    })
    if (!res.ok) return false
    const updated = await res.json()
    setContacts((prev) => prev.map((c) => (c.id === id ? updated : c)))
    return true
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return contacts
    return contacts.filter((c) =>
      `${c.name ?? ''} ${c.email ?? ''} ${c.phone ?? ''} ${c.company ?? ''} ${c.notes ?? ''}`.toLowerCase().includes(q)
    )
  }, [contacts, query])

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between gap-5 flex-wrap mb-1">
        <h1 className="font-display text-[30px] font-semibold tracking-tight text-text">Contacts</h1>
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="flex items-center gap-2 bg-surface border border-border2 rounded-[10px] px-3.5 py-2.5 w-[280px] text-text2">
            <Search size={15} className="shrink-0" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search names, emails, phones…"
              className="bg-transparent outline-none text-[13.5px] text-text placeholder:text-text2 w-full"
            />
          </div>
          <button
            onClick={() => setAdding((v) => !v)}
            className="inline-flex items-center gap-2 bg-accent text-white rounded-[10px] px-4 py-2.5 text-[13.5px] font-semibold hover:opacity-90 transition-opacity"
          >
            <Plus size={16} strokeWidth={2.5} /> Add contact
          </button>
        </div>
      </div>

      <div className="flex justify-between items-center text-text2 text-sm mt-1 mb-6">
        <span>People saved when you copy an email or phone number — or added here.</span>
        <span className="text-[13px] text-text3 shrink-0">{filtered.length} contact{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      {adding && (
        <AddContactForm
          onCancel={() => setAdding(false)}
          onAdded={(c) => { setContacts((prev) => [c, ...prev]); setAdding(false) }}
        />
      )}

      {loading ? (
        <p className="text-sm text-text3">Loading…</p>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<Users size={32} strokeWidth={1.5} />}
          title={contacts.length === 0 ? 'No contacts yet' : 'No matches'}
          subtitle={contacts.length === 0
            ? 'Copy an email address or phone number on any page and Anthill will offer to save it.'
            : 'Try clearing the search.'}
        />
      ) : (
        <div className="bg-surface border border-border rounded-[16px] overflow-hidden">
          {filtered.map((c) => (
            <ContactRow key={c.id} contact={c} onDelete={deleteContact} onSave={saveEdit} />
          ))}
        </div>
      )}
    </div>
  )
}

function AddContactForm({ onCancel, onAdded }: { onCancel: () => void; onAdded: (c: Contact) => void }) {
  const [form, setForm] = useState({ name: '', email: '', phone: '', company: '', notes: '' })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  function set(k: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [k]: e.target.value }))
  }

  async function submit() {
    setError('')
    if (!form.email.trim() && !form.phone.trim()) {
      setError('An email or phone number is required.')
      return
    }
    setSaving(true)
    const res = await fetch('/api/contacts', {
      method: 'POST',
      headers: { Authorization: `Bearer ${getToken()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    setSaving(false)
    if (res.status === 409) { setError('That contact is already saved.'); return }
    if (!res.ok) {
      const body = await res.json().catch(() => null)
      setError(body?.error || 'Could not save the contact.')
      return
    }
    onAdded(await res.json())
  }

  const inputCls = 'bg-surface border border-border2 rounded-[9px] px-3 py-2 text-[13.5px] text-text placeholder:text-text3 outline-none focus:border-accent w-full'

  return (
    <div className="bg-surface border border-border rounded-[16px] p-5 mb-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        <input className={inputCls} placeholder="Name" value={form.name} onChange={set('name')} />
        <input className={inputCls} placeholder="Email" type="email" value={form.email} onChange={set('email')} />
        <input className={inputCls} placeholder="Phone" value={form.phone} onChange={set('phone')} />
        <input className={inputCls} placeholder="Company" value={form.company} onChange={set('company')} />
        <input className={inputCls} placeholder="Notes" value={form.notes} onChange={set('notes')}
          onKeyDown={(e) => { if (e.key === 'Enter') submit() }} />
      </div>
      <div className="flex items-center gap-3 mt-3.5">
        <button
          onClick={submit}
          disabled={saving}
          className="inline-flex items-center gap-2 bg-accent text-white rounded-[9px] px-4 py-2 text-[13px] font-semibold hover:opacity-90 disabled:opacity-60 transition-opacity"
        >
          {saving ? 'Saving…' : 'Save contact'}
        </button>
        <button onClick={onCancel} className="text-[13px] text-text2 hover:text-text transition-colors">Cancel</button>
        {error && <span className="text-[13px] text-[#B0554F]">{error}</span>}
      </div>
    </div>
  )
}

function ContactRow({ contact, onDelete, onSave }: {
  contact: Contact
  onDelete: (id: string) => void
  onSave: (id: string, patch: Partial<Contact>) => Promise<boolean>
}) {
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({ name: '', company: '', notes: '' })
  const [saving, setSaving] = useState(false)

  function startEdit() {
    setForm({ name: contact.name ?? '', company: contact.company ?? '', notes: contact.notes ?? '' })
    setEditing(true)
  }

  async function save() {
    setSaving(true)
    const ok = await onSave(contact.id, form)
    setSaving(false)
    if (ok) setEditing(false)
  }

  const inputCls = 'bg-surface border border-border2 rounded-[8px] px-2.5 py-1.5 text-[13px] text-text placeholder:text-text3 outline-none focus:border-accent'

  return (
    <div className="flex items-center gap-4 px-5 py-4 border-b border-border last:border-b-0 hover:bg-surface2/40 transition-colors">
      <div
        className="w-[42px] h-[42px] rounded-full shrink-0 grid place-items-center text-white font-bold text-[13px]"
        style={{ background: avatarColor(displayName(contact)) }}
      >
        {initialsOf(contact)}
      </div>

      {editing ? (
        <div className="flex-1 min-w-0 grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          <input autoFocus className={inputCls} placeholder="Name" value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          <input className={inputCls} placeholder="Company" value={form.company}
            onChange={(e) => setForm((f) => ({ ...f, company: e.target.value }))} />
          <input className={inputCls} placeholder="Notes" value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            onKeyDown={(e) => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false) }} />
        </div>
      ) : (
        <div className="flex-1 min-w-0">
          <div className="text-[14.5px] font-semibold text-text truncate">{displayName(contact)}</div>
          <div className="flex items-center gap-4 flex-wrap text-[12.5px] text-text2 mt-0.5">
            {contact.email && <span className="inline-flex items-center gap-1.5 min-w-0"><Mail size={12} className="shrink-0 text-text3" /><span className="truncate">{contact.email}</span></span>}
            {contact.phone && <span className="inline-flex items-center gap-1.5"><Phone size={12} className="shrink-0 text-text3" />{contact.phone}</span>}
            {contact.company && <span className="inline-flex items-center gap-1.5 min-w-0"><Building2 size={12} className="shrink-0 text-text3" /><span className="truncate">{contact.company}</span></span>}
          </div>
          {contact.notes && <div className="text-[12.5px] text-text3 mt-1 truncate">{contact.notes}</div>}
        </div>
      )}

      <span className="text-[12px] text-text3 shrink-0 hidden sm:block">{timeAgo(contact.createdAt)}</span>

      <div className="flex items-center gap-1 shrink-0">
        {editing ? (
          <>
            <button onClick={save} disabled={saving} title="Save"
              className="w-8 h-8 grid place-items-center rounded-[8px] text-accent hover:bg-accent-soft transition-colors disabled:opacity-50">
              <Check size={15} />
            </button>
            <button onClick={() => setEditing(false)} title="Cancel"
              className="w-8 h-8 grid place-items-center rounded-[8px] text-text3 hover:text-text hover:bg-surface3 transition-colors">
              <X size={15} />
            </button>
          </>
        ) : (
          <>
            <button onClick={startEdit} title="Edit"
              className="w-8 h-8 grid place-items-center rounded-[8px] text-text3 hover:text-text hover:bg-surface3 transition-colors">
              <Pencil size={14} />
            </button>
            <button onClick={() => onDelete(contact.id)} title="Delete"
              className="w-8 h-8 grid place-items-center rounded-[8px] text-text3 hover:text-[#B0554F] hover:bg-surface3 transition-colors">
              <Trash2 size={14} />
            </button>
          </>
        )}
      </div>
    </div>
  )
}
