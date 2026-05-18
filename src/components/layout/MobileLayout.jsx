import { NavLink, useNavigate } from 'react-router-dom'
import { Home, Store, ClipboardList, User, Coins, ArrowLeft } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { cn } from '@/lib/utils'

const navItems = [
  { to: '/app',         icon: Home,          label: 'Home',    end: true },
  { to: '/app/toko',    icon: Store,         label: 'Toko' },
  { to: '/app/riwayat', icon: ClipboardList, label: 'Riwayat' },
  { to: '/app/profil',  icon: User,          label: 'Profil' },
]

export default function MobileLayout({ children, title, showBack = false, onBack }) {
  const { profile } = useAuth()
  const navigate    = useNavigate()

  return (
    <div className="flex flex-col h-[100dvh] bg-background max-w-md mx-auto relative overflow-hidden">
      {/* Top Bar */}
      <header className="flex-shrink-0 bg-[#1e3a5f] text-white">
        <div className="flex items-center gap-3 px-4 h-14">
          {showBack ? (
            <button onClick={onBack || (() => navigate(-1))}
              className="p-1.5 -ml-1.5 rounded-lg hover:bg-white/10 transition-colors">
              <ArrowLeft size={20} />
            </button>
          ) : (
            <div className="w-7 h-7 rounded-lg bg-teal-600 flex items-center justify-center flex-shrink-0">
              <Coins size={15} className="text-white" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm truncate">{title || 'Sistem Tukar Koin'}</p>
            {!title && <p className="text-blue-200 text-xs truncate">{profile?.name}</p>}
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-y-auto pb-20">
        {children}
      </main>

      {/* Bottom Nav — fixed center, full max-w-md, always visible */}
      <nav className="tour-bottom-nav fixed bottom-0 left-0 right-0 flex justify-center z-30">
        <div className="w-full max-w-md bg-white border-t border-border flex shadow-lg">
          {navItems.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end}
              className={({ isActive }) => cn(
                'bottom-nav-item',
                `tour-nav-${item.label}`,
                isActive ? 'text-[#1e3a5f]' : 'text-muted-foreground hover:text-foreground'
              )}>
              <item.icon size={22} />
              <span className="text-xs">{item.label}</span>
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}
