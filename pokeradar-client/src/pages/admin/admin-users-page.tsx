import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { StatusBadge } from '@/components/admin/status-badge';
import { useAdminUserSearch } from '@/hooks/use-admin';
import { Loader2, Search } from 'lucide-react';
import { useDebounce } from '@/hooks/use-debounce';

export function AdminUsersPage() {
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebounce(query, 400);
  const { data: users, isLoading } = useAdminUserSearch(debouncedQuery);
  const navigate = useNavigate();

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Wyszukaj użytkownika</h1>

      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Wpisz email lub imię..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {!debouncedQuery.trim() && (
        <p className="text-muted-foreground text-sm">
          Wpisz zapytanie, aby wyszukać użytkowników.
        </p>
      )}

      {debouncedQuery.trim() && isLoading && (
        <div className="fixed inset-0 flex items-center justify-center pointer-events-none">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      )}

      {debouncedQuery.trim() && !isLoading && users && users.length === 0 && (
        <p className="text-muted-foreground text-sm">Nie znaleziono użytkowników.</p>
      )}

      {users && users.length > 0 && (
        <Card>
          <div className="divide-y divide-border">
            {users.map((user) => (
              <div
                key={user.clerkId}
                className="flex items-center justify-between p-4 cursor-pointer hover:bg-accent/50 transition-colors"
                onClick={() => navigate(`/admin/users/${user.clerkId}`)}
              >
                <div>
                  <div className="font-medium">{user.displayName}</div>
                  <div className="text-xs text-muted-foreground">{user.email}</div>
                </div>
                <div className="flex gap-2">
                  {user.isAdmin && <StatusBadge status="ok" label="Admin" />}
                  {user.telegramLinked ? (
                    <StatusBadge status="ok" label="Telegram" />
                  ) : (
                    <StatusBadge status="inactive" label="Brak Telegram" />
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
