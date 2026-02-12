import { Outlet, NavLink, Link } from 'react-router-dom';
import { AdminGuard } from '@/components/auth/admin-guard';
import { Toaster } from '@/components/ui/sonner';
import { Store, Package, Users, Bell, Settings, ArrowLeft } from 'lucide-react';

const NAV_ITEMS = [
  { to: '/admin/shops', label: 'Sklepy', icon: Store },
  { to: '/admin/products', label: 'Produkty', icon: Package },
  { to: '/admin/users', label: 'Użytkownicy', icon: Users },
  { to: '/admin/notifications', label: 'Powiadomienia', icon: Bell },
  { to: '/admin/settings', label: 'Ustawienia', icon: Settings },
];

function AdminLayoutContent() {
  return (
    <div className="min-h-screen bg-background text-foreground flex">
      {/* Sidebar */}
      <aside className="w-56 border-r border-border bg-card flex flex-col">
        <div className="p-4 border-b border-border">
          <Link
            to="/"
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground text-sm"
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
      </aside>

      {/* Main content */}
      <main className="flex-1 p-6 overflow-auto">
        <Outlet />
      </main>

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
