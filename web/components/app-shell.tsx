'use client'

import * as React from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  InboxIcon,
  BriefcaseIcon,
  SearchIcon,
  CheckSquareIcon,
  LogOutIcon,
  MenuIcon,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import {
  Avatar,
  AvatarFallback,
} from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ThemeToggle } from '@/components/theme-toggle'

type NavItem = { href: string; label: string; icon: LucideIcon }

const NAV: NavItem[] = [
  { href: '/items', label: 'Inbox', icon: InboxIcon },
  { href: '/jobs', label: 'Jobs', icon: BriefcaseIcon },
  { href: '/research', label: 'Research', icon: SearchIcon },
  { href: '/tasks', label: 'Tasks', icon: CheckSquareIcon },
]

type User = { email: string; name?: string }

function Logo() {
  return (
    <Link href="/items" className="flex items-center gap-2.5">
      <span className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
        <svg viewBox="0 0 24 24" className="size-4" fill="none" aria-hidden="true">
          <path
            d="M12 3l7 4v6c0 4-3 6.5-7 8-4-1.5-7-4-7-8V7l7-4z"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinejoin="round"
          />
        </svg>
      </span>
      <span className="text-[15px] font-semibold tracking-tight">Anthill</span>
    </Link>
  )
}

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname()
  return (
    <nav className="flex flex-col gap-1">
      {NAV.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(href + '/')
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            className={cn(
              'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
              active
                ? 'bg-secondary text-foreground'
                : 'text-muted-foreground hover:bg-secondary/60 hover:text-foreground',
            )}
          >
            <Icon className="size-4 shrink-0" />
            {label}
          </Link>
        )
      })}
    </nav>
  )
}

function UserMenu({ user, onLogout }: { user: User | null; onLogout: () => void }) {
  const initials = (user?.name || user?.email || 'U')
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join('')

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="h-auto w-full justify-start gap-3 px-2 py-2"
        >
          <Avatar className="size-7">
            <AvatarFallback className="bg-brand text-brand-foreground text-xs">
              {initials}
            </AvatarFallback>
          </Avatar>
          <span className="flex min-w-0 flex-col items-start">
            <span className="max-w-[8.5rem] truncate text-sm font-medium">
              {user?.name || 'Your account'}
            </span>
            <span className="max-w-[8.5rem] truncate text-xs text-muted-foreground">
              {user?.email || ''}
            </span>
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuLabel className="truncate">
          {user?.email || 'Signed in'}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem variant="destructive" onClick={onLogout}>
            <LogOutIcon />
            Log out
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function AppShell({
  children,
  title,
  description,
  actions,
}: {
  children: React.ReactNode
  title?: string
  description?: string
  actions?: React.ReactNode
}) {
  const router = useRouter()
  const [user, setUser] = React.useState<User | null>(null)
  const [mobileOpen, setMobileOpen] = React.useState(false)

  React.useEffect(() => {
    const token = localStorage.getItem('anthill_token')
    if (!token) {
      router.replace('/login')
      return
    }
    const stored = localStorage.getItem('anthill_user')
    if (stored) {
      try {
        setUser(JSON.parse(stored))
      } catch {
        /* ignore */
      }
    }
  }, [router])

  function logout() {
    localStorage.removeItem('anthill_token')
    localStorage.removeItem('anthill_user')
    router.replace('/login')
  }

  return (
    <div className="flex min-h-screen bg-background">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-border bg-sidebar md:flex">
        <div className="flex h-16 items-center px-5">
          <Logo />
        </div>
        <div className="flex-1 overflow-y-auto px-3 py-2">
          <NavLinks />
        </div>
        <div className="px-3 pb-4">
          <Separator className="mb-3" />
          <UserMenu user={user} onLogout={logout} />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top bar */}
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-background/80 px-4 backdrop-blur-sm md:px-8">
          {/* Mobile menu */}
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden" aria-label="Open menu">
                <MenuIcon />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 p-0">
              <SheetTitle className="sr-only">Navigation</SheetTitle>
              <div className="flex h-16 items-center px-5">
                <Logo />
              </div>
              <div className="px-3 py-2">
                <NavLinks onNavigate={() => setMobileOpen(false)} />
              </div>
              <div className="absolute inset-x-0 bottom-0 px-3 pb-4">
                <Separator className="mb-3" />
                <UserMenu user={user} onLogout={logout} />
              </div>
            </SheetContent>
          </Sheet>

          <div className="flex min-w-0 flex-1 flex-col justify-center">
            {title && (
              <h1 className="truncate text-base font-semibold leading-tight tracking-tight">
                {title}
              </h1>
            )}
            {description && (
              <p className="truncate text-xs text-muted-foreground">{description}</p>
            )}
          </div>

          <div className="flex items-center gap-2">
            {actions}
            <ThemeToggle />
          </div>
        </header>

        <main className="flex-1 px-4 py-6 md:px-8 md:py-8">{children}</main>
      </div>
    </div>
  )
}
