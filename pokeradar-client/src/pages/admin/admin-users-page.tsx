import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { PageLoader } from '@/components/ui/page-loader';
import { SearchInput } from '@/components/ui/search-input';
import { StatusBadge } from '@/components/admin/status-badge';
import { useAdminUserSearch } from '@/hooks/use-admin';
import { useDebounce } from '@/hooks/use-debounce';

export function AdminUsersPage() {
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebounce(query, 400);
  const { data: users, isLoading } = useAdminUserSearch(debouncedQuery);
  const navigate = useNavigate();

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Wyszukaj użytkownika</h1>

      <SearchInput
        value={query}
        onChange={setQuery}
        placeholder="Wpisz email lub imię..."
        className="mb-6"
      />

      {!debouncedQuery.trim() && (
        <p className="text-muted-foreground text-sm">Wpisz zapytanie, aby wyszukać użytkowników.</p>
      )}

      {debouncedQuery.trim() && isLoading && <PageLoader />}

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
                  {user.telegramLinked && <StatusBadge status="ok" label="Telegram" />}
                  {user.discordLinked && <StatusBadge status="ok" label="Discord" />}
                  {!user.telegramLinked && !user.discordLinked && (
                    <StatusBadge status="inactive" label="Brak kanałów" />
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
