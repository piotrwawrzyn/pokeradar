import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { TableCell, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
} from '@/components/ui/dropdown-menu';
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
import { DeleteRowButton } from '@/components/admin/delete-row-button';
import { AffectedProductsList } from '@/components/admin/affected-products-list';
import { ChevronDown, X } from 'lucide-react';
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
    matchingRequired: '',
    matchingForbidden: '',
    contains: [] as string[],
  });

  const resetForm = () => {
    setFormData({ id: '', name: '', matchingRequired: '', matchingForbidden: '', contains: [] });
  };

  const populateForm = (type: ProductType) => {
    setFormData({
      id: type.id,
      name: type.name,
      matchingRequired: type.matchingProfile.required.join(', '),
      matchingForbidden: type.matchingProfile.forbidden?.join(', ') || '',
      contains: type.contains ?? [],
    });
  };

  const handleSave = async () => {
    const payload: any = {
      name: formData.name,
      matchingProfile: {
        required: formData.matchingRequired
          ? formData.matchingRequired.split(',').map((s) => s.trim())
          : [],
        forbidden: formData.matchingForbidden
          ? formData.matchingForbidden.split(',').map((s) => s.trim())
          : [],
      },
      contains: formData.contains,
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
          'Wymagane tokeny',
          'Zabronione tokeny',
          'Zawiera',
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
              {type.matchingProfile.required.join(', ') || '-'}
            </TableCell>
            <TableCell className="text-muted-foreground text-sm">
              {type.matchingProfile.forbidden?.join(', ') || '-'}
            </TableCell>
            <TableCell className="text-muted-foreground text-sm">
              {type.contains?.length
                ? type.contains.map((id) => types?.find((t) => t.id === id)?.name ?? id).join(', ')
                : '-'}
            </TableCell>
            <TableCell>
              <DeleteRowButton onClick={() => dialog.openDelete(type)} />
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
          <Label htmlFor="type-matchingRequired" className="mb-2 block">
            Wymagane tokeny (oddzielone przecinkami) <span className="text-red-500">*</span>
          </Label>
          <Textarea
            id="type-matchingRequired"
            value={formData.matchingRequired}
            onChange={(e) => setFormData({ ...formData, matchingRequired: e.target.value })}
            placeholder="np. Booster, Box"
          />
        </div>

        <div>
          <Label htmlFor="type-matchingForbidden" className="mb-2 block">
            Zabronione tokeny (oddzielone przecinkami)
          </Label>
          <Textarea
            id="type-matchingForbidden"
            value={formData.matchingForbidden}
            onChange={(e) => setFormData({ ...formData, matchingForbidden: e.target.value })}
            placeholder="np. proxy, damaged"
          />
        </div>

        <div>
          <Label className="mb-2 block">Zawiera typy (składniki)</Label>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                className="w-full justify-between font-normal"
                type="button"
              >
                <span className="text-muted-foreground text-sm">
                  {formData.contains.length === 0
                    ? 'Wybierz typy składowe…'
                    : `${formData.contains.length} wybranych`}
                </span>
                <ChevronDown className="size-4 shrink-0 opacity-50" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-[--radix-dropdown-menu-trigger-width]">
              {types
                ?.filter((t) => t.id !== dialog.selected?.id)
                .map((t) => (
                  <DropdownMenuCheckboxItem
                    key={t.id}
                    checked={formData.contains.includes(t.id)}
                    onCheckedChange={(checked) => {
                      setFormData({
                        ...formData,
                        contains: checked
                          ? [...formData.contains, t.id]
                          : formData.contains.filter((id) => id !== t.id),
                      });
                    }}
                    onSelect={(e) => e.preventDefault()}
                  >
                    {t.name}
                  </DropdownMenuCheckboxItem>
                ))}
            </DropdownMenuContent>
          </DropdownMenu>
          {formData.contains.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {formData.contains.map((id) => {
                const name = types?.find((t) => t.id === id)?.name ?? id;
                return (
                  <Badge
                    key={id}
                    variant="secondary"
                    className="gap-1.5 px-2.5 py-1 text-sm pr-1.5"
                  >
                    {name}
                    <button
                      type="button"
                      onClick={() =>
                        setFormData({
                          ...formData,
                          contains: formData.contains.filter((c) => c !== id),
                        })
                      }
                      className="rounded-full hover:bg-muted-foreground/20 p-0.5"
                    >
                      <X className="size-3.5" />
                    </button>
                  </Badge>
                );
              })}
            </div>
          )}
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
        <AffectedProductsList products={affectedProducts} />
      </ConfirmDialog>
    </>
  );
}
