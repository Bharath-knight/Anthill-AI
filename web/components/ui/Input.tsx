import { InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react'

const BASE =
  'w-full bg-surface2 border border-border rounded px-3 py-2 text-sm text-text placeholder:text-text3 focus:outline-none focus:border-border2 focus:bg-surface3 transition-colors'

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  const { className = '', ...rest } = props
  return <input {...rest} className={`${BASE} ${className}`} />
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  const { className = '', children, ...rest } = props
  return (
    <select {...rest} className={`${BASE} cursor-pointer ${className}`}>
      {children}
    </select>
  )
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const { className = '', ...rest } = props
  return <textarea {...rest} className={`${BASE} resize-y ${className}`} />
}

export function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="block text-xs font-medium text-text2 mb-1.5">
      {children}
    </label>
  )
}
