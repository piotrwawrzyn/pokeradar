import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { MainLayout } from '@/components/layout/main-layout';
import { WatchlistPage } from '@/pages/watchlist-page';
import { SettingsPage } from '@/pages/settings-page';
import { AuthCallbackPage } from '@/pages/auth-callback-page';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<MainLayout />}>
          <Route path="/" element={<WatchlistPage />} />
          <Route path="/ustawienia" element={<SettingsPage />} />
        </Route>
        <Route path="/auth/callback" element={<AuthCallbackPage />} />
      </Routes>
    </BrowserRouter>
  );
}
