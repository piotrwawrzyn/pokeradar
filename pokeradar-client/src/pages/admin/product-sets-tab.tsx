import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { TableCell, TableRow } from '@/components/ui/table';
import { ConfirmDialog } from '@/components/admin/confirm-dialog';
import { CrudDialog } from '@/components/admin/crud-dialog';
import { ImageUpload } from '@/components/admin/image-upload';
import { EntityTable } from '@/components/admin/entity-table';
import {
  useAdminProducts,
  useAdminProductSets,
  useCreateProductSet,
  useUpdateProductSet,
  useDeleteProductSet,
  useUploadProductSetImage,
  useUploadSetImageOnly,
} from '@/hooks/use-admin';
import { useCrudDialog } from '@/hooks/use-crud-dialog';
import { useImageUpload } from '@/hooks/use-image-upload';
import { toast } from 'sonner';
import { Trash2 } from 'lucide-react';
import type { ProductSet } from '@/api/admin.api';
import { getErrorMessage, generateIdFromName } from '@/lib/error-utils';

export function ProductSetsTab() {
  const { data: sets, isLoading } = useAdminProductSets();
  const { data: products } = useAdminProducts();
  const createSet = useCreateProductSet();
  const updateSet = useUpdateProductSet();
  const deleteSet = useDeleteProductSet();
  const uploadImage = useUploadProductSetImage();
  const uploadSetImageOnly = useUploadSetImageOnly();

  const dialog = useCrudDialog<ProductSet>();
  const image = useImageUpload();

  const [formData, setFormData] = useState({
    name: '',
    series: '',
    releaseDate: '',
  });

  const resetForm = () => {
    image.reset();
    setFormData({ name: '', series: '', releaseDate: '' });
  };

  const populateForm = (set: ProductSet) => {
    image.reset();
    setFormData({
      name: set.name,
      series: set.series,
      releaseDate: set.releaseDate ? set.releaseDate.split('T')[0] : '',
    });
  };

  const handleSave = async () => {
    if (!dialog.selected && !image.imageFile) {
      toast.error('Obrazek jest wymagany');
      return;
    }

    const payload: any = {
      name: formData.name,
      series: formData.series,
      releaseDate: formData.releaseDate || undefined,
    };

    if (!dialog.selected) {
      payload.id = generateIdFromName(formData.name);
    }

    try {
      if (dialog.selected) {
        await updateSet.mutateAsync({ id: dialog.selected.id, data: payload });
        if (image.imageFile) {
          try {
            await uploadImage.mutateAsync({ id: dialog.selected.id, file: image.imageFile });
          } catch (imageError: any) {
            toast.error(getErrorMessage(imageError, 'Nie udało się przesłać obrazka'));
            return;
          }
        }
        toast.success('Set zaktualizowany');
      } else {
        let imageUrl = '';
        if (image.imageFile) {
          try {
            const uploadResult = await uploadSetImageOnly.mutateAsync({ file: image.imageFile });
            imageUrl = uploadResult.imageUrl;
          } catch (imageError: any) {
            toast.error(getErrorMessage(imageError, 'Nie udało się przesłać obrazka'));
            return;
          }
        }
        payload.imageUrl = imageUrl;
        await createSet.mutateAsync(payload);
        toast.success('Set utworzony');
      }
      dialog.closeEdit();
    } catch (error: any) {
      toast.error(getErrorMessage(error, 'Nie udało się zapisać setu'));
    }
  };

  const handleDelete = async () => {
    if (!dialog.selected) return;
    try {
      await deleteSet.mutateAsync(dialog.selected.id);
      toast.success('Set usunięty');
      dialog.closeDelete();
    } catch (error: any) {
      toast.error(getErrorMessage(error, 'Nie udało się usunąć setu'));
    }
  };

  const isPending = createSet.isPending || updateSet.isPending || uploadImage.isPending || uploadSetImageOnly.isPending;
  const affectedProducts = products?.filter((p) => p.productSetId === dialog.selected?.id) ?? [];

  return (
    <>
      <EntityTable
        isLoading={isLoading}
        onAdd={() => dialog.openCreate(resetForm)}
        addLabel="Dodaj set"
        isEmpty={!sets || sets.length === 0}
        emptyLabel="Brak setów"
        headers={[{ label: 'Obrazek', className: 'w-32' }, 'Nazwa', 'Seria', 'Produkty', 'Data wydania', { label: '', className: 'w-16' }]}
      >
        {sets?.map((set) => (
          <TableRow
            key={set.id}
            className="cursor-pointer hover:bg-muted/50"
            onClick={() => dialog.openEdit(set, populateForm)}
          >
            <TableCell className="text-center">
              {set.imageUrl && (
                <img
                  src={set.imageUrl}
                  alt={set.name}
                  className="h-10 max-w-20 rounded object-contain mx-auto"
                />
              )}
            </TableCell>
            <TableCell className="font-medium">{set.name}</TableCell>
            <TableCell>{set.series}</TableCell>
            <TableCell className="text-muted-foreground">
              {products?.filter((p) => p.productSetId === set.id).length ?? 0}
            </TableCell>
            <TableCell className="text-muted-foreground">
              {set.releaseDate ? new Date(set.releaseDate).toLocaleDateString('pl-PL', { year: 'numeric', month: '2-digit', day: '2-digit' }) : '-'}
            </TableCell>
            <TableCell>
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  dialog.openDelete(set);
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
        entityLabel="set"
        isPending={isPending}
        onSave={handleSave}
      >
        <div>
          <Label htmlFor="set-name" className="mb-2 block">Nazwa</Label>
          <Input
            id="set-name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          />
        </div>

        <div>
          <Label htmlFor="series" className="mb-2 block">Seria</Label>
          <Input
            id="series"
            value={formData.series}
            onChange={(e) => setFormData({ ...formData, series: e.target.value })}
          />
        </div>

        <div>
          <Label htmlFor="releaseDate" className="mb-2 block">Data wydania</Label>
          <Input
            id="releaseDate"
            type="date"
            value={formData.releaseDate}
            onChange={(e) => setFormData({ ...formData, releaseDate: e.target.value })}
          />
        </div>

        <ImageUpload
          id="set-image"
          label="Obrazek (PNG/WebP)"
          imagePreview={image.imagePreview}
          currentImageUrl={dialog.selected?.imageUrl}
          onChange={image.handleImageChange}
          disabled={isPending}
        />
      </CrudDialog>

      <ConfirmDialog
        open={dialog.deleteDialogOpen}
        onOpenChange={dialog.closeDelete}
        title="Usuń set"
        description={`Czy na pewno chcesz usunąć set "${dialog.selected?.name}"?`}
        onConfirm={handleDelete}
        loading={deleteSet.isPending}
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
