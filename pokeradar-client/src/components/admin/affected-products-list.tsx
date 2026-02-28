interface AffectedProduct {
  id: string;
  name: string;
}

interface AffectedProductsListProps {
  products: AffectedProduct[];
}

export function AffectedProductsList({ products }: AffectedProductsListProps) {
  if (products.length === 0) return null;

  return (
    <div className="text-sm mt-2">
      <p className="font-medium mb-1">Następujące produkty zostaną usunięte:</p>
      <ul className="list-disc pl-5 space-y-0.5 text-muted-foreground">
        {products.map((p) => (
          <li key={p.id}>{p.name}</li>
        ))}
      </ul>
      <p className="text-muted-foreground mt-2">
        Usunięte zostaną również wszystkie powiązane wpisy watchlisty, powiadomienia i wyniki.
      </p>
    </div>
  );
}
