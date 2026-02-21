import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { TableCell, TableRow } from '@/components/ui/table';
import { ConfirmDialog } from '@/components/admin/confirm-dialog';
import { CrudDialog } from '@/components/admin/crud-dialog';
import { EntityTable } from '@/components/admin/entity-table';
import {
  useAdminProducts,
  useAdminProductTypes,
  useCreateProductType,
  useUpdateProductType,
  useDeleteProductType,
} from '@/hooks/use-admin';
import { useCrudDialog } from '@/hooks/use-crud-dialog';
import { toast } from 'sonner';
import { Trash2 } from 'lucide-react';
import type { ProductType } from '@/api/admin.api';
import { getErrorMessage, generateIdFromName } from '@/lib/error-utils';

export function ProductTypesTab() {
  const { data: types, isLoading } = useAdminProductTypes();
  const { data: products } = useAdminProducts();
  const createType = useCreateProductType();
  const updateType = useUpdateProductType();
  const deleteType = useDeleteProductType();

  const dialog = useCrudDialog<ProductType>();

  const [formData, setFormData] = useState({
    id: '',
    name: '',
    searchPhrases: '',
    searchExclude: '',
  });

  const resetForm = () => {
    setFormData({ id: '', name: '', searchPhrases: '', searchExclude: '' });
  };

  const populateForm = (type: ProductType) => {
    setFormData({
      id: type.id,
      name: type.name,
      searchPhrases: type.search.phrases?.join(', ') || '',
      searchExclude: type.search.exclude?.join(', ') || '',
    });
  };

  const handleSave = async () => {
    const payload: any = {
      name: formData.name,
      search: {
        phrases: formData.searchPhrases
          ? formData.searchPhrases.split(',').map((s) => s.trim())
          : [],
        exclude: formData.searchExclude
          ? formData.searchExclude.split(',').map((s) => s.trim())
          : [],
      },
    };

    if (!dialog.selected) {
      payload.id = generateIdFromName(formData.name);
    }

    try {
      if (dialog.selected) {
        await updateType.mutateAsync({ id: dialog.selected.id, data: payload });
        toast.success('Typ produktu zaktualizowany');
      } else {
        await createType.mutateAsync(payload);
        toast.success('Typ produktu utworzony');
      }
      dialog.closeEdit();
    } catch (error: any) {
      toast.error(getErrorMessage(error, 'Nie udało się zapisać typu produktu'));
    }
  };

  const handleDelete = async () => {
    if (!dialog.selected) return;
    try {
      await deleteType.mutateAsync(dialog.selected.id);
      toast.success('Typ produktu usunięty');
      dialog.closeDelete();
    } catch (error: any) {
      toast.error(getErrorMessage(error, 'Nie udało się usunąć typu produktu'));
    }
  };

  const isPending = createType.isPending || updateType.isPending;
  const affectedProducts = products?.filter((p) => p.productTypeId === dialog.selected?.id) ?? [];

  return (
    <>
      <EntityTable
        isLoading={isLoading}
        onAdd={() => dialog.openCreate(resetForm)}
        addLabel="Dodaj typ produktu"
        isEmpty={!types || types.length === 0}
        emptyLabel="Brak typów produktów"
        headers={[
          'Nazwa',
          'Produkty',
          'Frazy wyszukiwania',
          'Wykluczenia',
          { label: '', className: 'w-16' },
        ]}
      >
        {types?.map((type) => (
          <TableRow
            key={type.id}
            className="cursor-pointer hover:bg-muted/50"
            onClick={() => dialog.openEdit(type, populateForm)}
          >
            <TableCell className="font-medium">{type.name}</TableCell>
            <TableCell className="text-muted-foreground">
              {products?.filter((p) => p.productTypeId === type.id).length ?? 0}
            </TableCell>
            <TableCell className="text-muted-foreground text-sm">
              {type.search.phrases?.join(', ') || '-'}
            </TableCell>
            <TableCell className="text-muted-foreground text-sm">
              {type.search.exclude?.join(', ') || '-'}
            </TableCell>
            <TableCell>
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  dialog.openDelete(type);
                }}
              >
                <Trash2 className="h-4 w-4 text-red-500" />
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </EntityTable>

      <CrudDialog
        open={dialog.editDialogOpen}
        onOpenChange={dialog.closeEdit}
        isEdit={!!dialog.selected}
        entityLabel="typ produktu"
        isPending={isPending}
        onSave={handleSave}
      >
        <div>
          <Label htmlFor="type-name" className="mb-2 block">
            Nazwa <span className="text-red-500">*</span>
          </Label>
          <Input
            id="type-name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          />
        </div>

        <div>
          <Label htmlFor="type-searchPhrases" className="mb-2 block">
            Frazy wyszukiwania (oddzielone przecinkami)
          </Label>
          <Textarea
            id="type-searchPhrases"
            value={formData.searchPhrases}
            onChange={(e) => setFormData({ ...formData, searchPhrases: e.target.value })}
            placeholder="np. V, VMAX, VSTAR"
          />
        </div>

        <div>
          <Label htmlFor="type-searchExclude" className="mb-2 block">
            Wykluczenia (oddzielone przecinkami)
          </Label>
          <Textarea
            id="type-searchExclude"
            value={formData.searchExclude}
            onChange={(e) => setFormData({ ...formData, searchExclude: e.target.value })}
            placeholder="np. proxy, damaged"
          />
        </div>
      </CrudDialog>

      <ConfirmDialog
        open={dialog.deleteDialogOpen}
        onOpenChange={dialog.closeDelete}
        title="Usuń typ produktu"
        description={`Czy na pewno chcesz usunąć typ produktu "${dialog.selected?.name}"?`}
        onConfirm={handleDelete}
        loading={deleteType.isPending}
      >
        {affectedProducts.length > 0 && (
          <div className="text-sm mt-2">
            <p className="font-medium mb-1">Następujące produkty zostaną usunięte:</p>
            <ul className="list-disc pl-5 space-y-0.5 text-muted-foreground">
              {affectedProducts.map((p) => (
                <li key={p.id}>{p.name}</li>
              ))}
            </ul>
            <p className="text-muted-foreground mt-2">
              Usunięte zostaną również wszystkie powiązane wpisy watchlisty, powiadomienia i wyniki.
            </p>
          </div>
        )}
      </ConfirmDialog>
    </>
  );
}
