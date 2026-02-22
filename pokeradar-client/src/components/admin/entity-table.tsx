import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Loader2, Plus } from 'lucide-react';

interface TableHeader {
  label: string;
  className?: string;
}

interface EntityTableProps {
  isLoading: boolean;
  onAdd: () => void;
  addLabel: string;
  isEmpty: boolean;
  emptyLabel: string;
  headers: (string | TableHeader)[];
  children: React.ReactNode;
}

export function EntityTable({
  isLoading,
  onAdd,
  addLabel,
  isEmpty,
  emptyLabel,
  headers,
  children,
}: EntityTableProps) {
  if (isLoading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center pointer-events-none">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <>
      <div className="flex justify-end mb-4">
        <Button className="w-full sm:w-auto" onClick={onAdd}>
          <Plus className="h-4 w-4 mr-2" />
          {addLabel}
        </Button>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              {headers.map((header, idx) => {
                const label = typeof header === 'string' ? header : header.label;
                const className = typeof header === 'string' ? undefined : header.className;
                return (
                  <TableHead key={label || idx} className={className}>
                    {label}
                  </TableHead>
                );
              })}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isEmpty ? (
              <TableRow>
                <TableCell
                  colSpan={headers.length}
                  className="text-center text-muted-foreground py-8"
                >
                  {emptyLabel}
                </TableCell>
              </TableRow>
            ) : (
              children
            )}
          </TableBody>
        </Table>
      </Card>
    </>
  );
}
