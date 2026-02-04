import { Outlet } from 'react-router-dom';
import { Header } from './header';
import { Toaster } from '@/components/ui/sonner';

export function MainLayout() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <Outlet />
      </main>
      <footer className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <p className="text-center text-[11px] text-muted-foreground/60 leading-relaxed">
          Pokémon oraz Pokémon TCG są znakami towarowymi należącymi do The Pokémon Company.
          Serwis Pokeradar nie jest powiązany ani sponsorowany przez The Pokémon Company.
        </p>
      </footer>
      <Toaster position="bottom-right" richColors />
    </div>
  );
}
