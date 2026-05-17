import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import {
  LayoutDashboard, ClipboardList, Store, Car, Package,
  BarChart3, Users, LogOut, Menu, X, ChevronRight, Bell, Coins, Receipt,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { ROLE_LABELS, cn } from '@/lib/utils'

function NavItem({ to, icon: Icon, label, badge, collapsed, end = false }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        cn(
          'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150',
          isActive
            ? 'bg-white/15 text-white shadow-sm'
            : 'text-blue-100/80 hover:bg-white/10 hover:text-white'
        )
      }
    >
      <Icon size={18} className="flex-shrink-0" />
      {!collapsed && (
        <>
          <span className="flex-1">{label}</span>
          {badge > 0 && (
            <Badge variant="destructive" className="min-w-[20px] text-center px-1.5 py-0.5 text-xs">
              {badge}
            </Badge>
          )}
        </>
      )}
    </NavLink>
  )
}

export default function DashboardLayout({ children, pendingCount = 0 }) {
  const { profile, role, signOut } = useAuth()
  const navigate = useNavigate()
  const [collapsed, setCollapsed]   = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  const adminNav = [
    { to: '/dashboard',             icon: LayoutDashboard, label: 'Dashboard',      end: true },
    { to: '/dashboard/sesi',        icon: ClipboardList,   label: 'Sesi Tugas',    badge: pendingCount },
    { to: '/dashboard/transaksi',   icon: Receipt,         label: 'Transaksi' },
    { to: '/dashboard/toko',        icon: Store,           label: 'Master Toko' },
    { to: '/dashboard/mobil',       icon: Car,             label: 'Master Mobil' },
    { to: '/dashboard/stok',        icon: Package,         label: 'Stok Gudang' },
    { to: '/dashboard/laporan',     icon: BarChart3,       label: 'Laporan' },
  ]
  const managerNav = [
    { to: '/dashboard',             icon: LayoutDashboard, label: 'Dashboard',      end: true },
    { to: '/dashboard/sesi',        icon: ClipboardList,   label: 'Sesi Tugas',    badge: pendingCount },
    { to: '/dashboard/transaksi',   icon: Receipt,         label: 'Transaksi' },
    { to: '/dashboard/toko',        icon: Store,           label: 'Master Toko' },
    { to: '/dashboard/stok',        icon: Package,         label: 'Stok Gudang' },
    { to: '/dashboard/laporan',     icon: BarChart3,       label: 'Laporan' },
  ]
  const superNav = [
    { to: '/superadmin', icon: Users, label: 'Manajemen Akun' },
  ]

  const roles = Array.isArray(role) ? role : [role]

  const navItems =
    roles.includes('superadmin') ? superNav :
    roles.includes('manager')    ? managerNav :
    adminNav

  const SidebarContent = () => (
    <div className="flex flex-col h-full bg-[#1e3a5f]">
      {/* Logo */}
      <div className={cn('flex items-center gap-3 px-4 py-5', collapsed && 'justify-center')}>
        <div className="w-8 h-8 rounded-lg bg-teal-600 flex items-center justify-center flex-shrink-0 shadow">
          <Coins size={18} className="text-white" />
        </div>
        {!collapsed && (
          <div>
            <p className="text-white font-bold text-sm leading-tight">Tukar Koin</p>
            <p className="text-blue-300 text-xs">Indomaret Finance</p>
          </div>
        )}
      </div>

      <Separator className="bg-white/10" />

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {navItems.map((item) => (
          <NavItem key={item.to} {...item} collapsed={collapsed} />
        ))}
      </nav>

      <Separator className="bg-white/10" />

      {/* User */}
      <div className="p-3 space-y-1">
        <div className={cn('flex items-center gap-3 px-2 py-2', collapsed && 'justify-center')}>
          <div className="w-8 h-8 rounded-full bg-teal-700 flex items-center justify-center flex-shrink-0">
            <span className="text-white text-xs font-bold">
              {profile?.name?.charAt(0)?.toUpperCase() || 'U'}
            </span>
          </div>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-white text-sm font-medium truncate">{profile?.name}</p>
              <p className="text-blue-300 text-xs">
                {roles.map(r => ROLE_LABELS[r] || r).join(' & ')}
              </p>
            </div>
          )}
        </div>
        <button
          onClick={handleSignOut}
          className={cn(
            'flex items-center gap-2 w-full px-2 py-2 rounded-lg text-blue-200 hover:bg-white/10 hover:text-white transition-colors text-sm',
            collapsed && 'justify-center'
          )}
        >
          <LogOut size={15} />
          {!collapsed && <span>Keluar</span>}
        </button>
      </div>
    </div>
  )

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      {/* Desktop Sidebar */}
      <aside className={cn(
        'hidden lg:flex flex-col transition-all duration-300 ease-in-out flex-shrink-0 border-r border-[#152943]',
        collapsed ? 'w-16' : 'w-60'
      )}>
        <SidebarContent />
      </aside>

      {/* Mobile Sidebar */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <aside className="absolute left-0 top-0 bottom-0 w-60">
            <SidebarContent />
          </aside>
        </div>
      )}

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Bar */}
        <header className="h-14 bg-white border-b border-slate-200 flex items-center px-4 gap-3 flex-shrink-0 shadow-sm">
          <Button
            variant="ghost"
            size="icon"
            className="hidden lg:flex text-slate-500"
            onClick={() => setCollapsed(!collapsed)}
          >
            {collapsed ? <ChevronRight size={18} /> : <Menu size={18} />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden text-slate-500"
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            {mobileOpen ? <X size={18} /> : <Menu size={18} />}
          </Button>

          <div className="flex-1" />

          {pendingCount > 0 && (
            <div className="relative cursor-pointer">
              <Bell size={20} className="text-slate-500" />
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-rose-500 text-white text-xs rounded-full flex items-center justify-center font-bold">
                {pendingCount}
              </span>
            </div>
          )}

          <div className="flex items-center gap-2 border-l pl-4 ml-2">
            <div className="w-7 h-7 rounded-full bg-[#1e3a5f] flex items-center justify-center">
              <span className="text-white text-xs font-bold">
                {profile?.name?.charAt(0)?.toUpperCase() || 'U'}
              </span>
            </div>
            <div className="hidden sm:block">
              <p className="text-sm font-medium text-slate-700 leading-tight">{profile?.name}</p>
              <p className="text-xs text-slate-400">{roles.map(r => ROLE_LABELS[r] || r).join(' & ')}</p>
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
