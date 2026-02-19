import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { MainLayout } from '@/components/layout/main-layout';
import { AdminLayout } from '@/components/layout/admin-layout';
import { WatchlistPage } from '@/pages/watchlist-page';
import { SettingsPage } from '@/pages/settings-page';
import { AdminShopsPage } from '@/pages/admin/admin-shops-page';
import { AdminShopDetailPage } from '@/pages/admin/admin-shop-detail-page';
import { AdminProductsPage } from '@/pages/admin/admin-products-page';
import { AdminUsersPage } from '@/pages/admin/admin-users-page';
import { AdminUserDetailPage } from '@/pages/admin/admin-user-detail-page';
import { AdminNotificationsPage } from '@/pages/admin/admin-notifications-page';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<MainLayout />}>
          <Route path="/" element={<WatchlistPage />} />
          <Route path="/ustawienia" element={<SettingsPage />} />
        </Route>
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<Navigate to="/admin/shops" replace />} />
          <Route path="shops" element={<AdminShopsPage />} />
          <Route path="shops/:shopId" element={<AdminShopDetailPage />} />
          <Route path="products" element={<AdminProductsPage />} />
          <Route path="users" element={<AdminUsersPage />} />
          <Route path="users/:clerkId" element={<AdminUserDetailPage />} />
          <Route path="notifications" element={<AdminNotificationsPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
