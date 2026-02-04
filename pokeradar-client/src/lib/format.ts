const plnFormatter = new Intl.NumberFormat('pl-PL', {
  style: 'currency',
  currency: 'PLN',
});

export function formatPLN(amount: number | null): string {
  if (amount === null) return '—';
  return plnFormatter.format(amount);
}

export function formatDate(isoString: string | undefined): string {
  if (!isoString) return '—';
  return new Date(isoString).toLocaleDateString('pl-PL', {
    year: 'numeric',
    month: 'long',
  });
}
