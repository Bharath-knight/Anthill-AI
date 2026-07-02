import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Button } from './Button'

describe('Button', () => {
  it('renders its children as a button', () => {
    render(<Button>Save</Button>)
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument()
  })

  it('fires onClick when pressed', async () => {
    const onClick = vi.fn()
    render(<Button onClick={onClick}>Go</Button>)
    await userEvent.click(screen.getByRole('button', { name: 'Go' }))
    expect(onClick).toHaveBeenCalledOnce()
  })

  it('does not fire onClick when disabled', async () => {
    const onClick = vi.fn()
    render(<Button disabled onClick={onClick}>Nope</Button>)
    await userEvent.click(screen.getByRole('button', { name: 'Nope' }))
    expect(onClick).not.toHaveBeenCalled()
  })
})
