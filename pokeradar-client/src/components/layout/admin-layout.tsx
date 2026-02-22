import { useState } from 'react';
import { Outlet, NavLink, Link } from 'react-router-dom';
import { AdminGuard } from '@/components/auth/admin-guard';
import { Toaster } from '@/components/ui/sonner';
import { Button } from '@/components/ui/button';
import { Store, Package, Users, Bell, ArrowLeft, Menu } from 'lucide-react';

const NAV_ITEMS = [
  { to: '/admin/shops', label: 'Sklepy', icon: Store },
  { to: '/admin/products', label: 'Produkty', icon: Package },
  { to: '/admin/users', label: 'Użytkownicy', icon: Users },
  { to: '/admin/notifications', label: 'Powiadomienia', icon: Bell },
];

function SidebarContent({ onNavClick }: { onNavClick?: () => void }) {
  return (
    <>
      <div className="p-4 border-b border-border">
        <Link
          to="/"
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground text-sm"
          onClick={onNavClick}
        >
          <ArrowLeft className="h-4 w-4" />
          Powrót do serwisu
        </Link>
        <h2 className="text-lg font-bold text-primary mt-2">Admin Panel</h2>
      </div>
      <nav className="flex-1 p-2 space-y-1">
        {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            onClick={onNavClick}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                isActive
                  ? 'bg-primary/10 text-primary font-medium'
                  : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
              }`
            }
          >
            <Icon className="h-4 w-4" />
            {label}
          </NavLink>
        ))}
      </nav>
    </>
  );
}

function AdminLayoutContent() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background text-foreground flex">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-56 shrink-0 border-r border-border bg-card flex-col">
        <SidebarContent />
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex" onClick={() => setMobileOpen(false)}>
          <aside
            className="w-64 bg-card border-r border-border flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <SidebarContent onNavClick={() => setMobileOpen(false)} />
          </aside>
          <div className="flex-1 bg-black/50" />
        </div>
      )}

      {/* Main area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile top bar */}
        <header className="md:hidden sticky top-0 z-30 bg-card border-b border-border flex items-center justify-between px-4 h-14 shrink-0">
          <h2 className="text-base font-bold text-primary">Admin Panel</h2>
          <Button variant="ghost" size="icon" onClick={() => setMobileOpen(true)}>
            <Menu className="h-5 w-5" />
          </Button>
        </header>

        {/* Page content */}
        <main className="flex-1 p-4 md:p-6 overflow-auto">
          <Outlet />
        </main>
      </div>

      <Toaster position="bottom-right" richColors />
    </div>
  );
}

export function AdminLayout() {
  return (
    <AdminGuard>
      <AdminLayoutContent />
    </AdminGuard>
  );
}
