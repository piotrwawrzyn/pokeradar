import React, { useState, useMemo, forwardRef, useImperativeHandle } from 'react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { StatusBadge } from '@/components/admin/status-badge';
import { ConfirmDialog } from '@/components/admin/confirm-dialog';
import { CrudDialog } from '@/components/admin/crud-dialog';
import { ImageUpload } from '@/components/admin/image-upload';
import {
  useAdminProducts,
  useAdminProductSets,
  useAdminProductTypes,
  useCreateProduct,
  useUpdateProduct,
  useDeleteProduct,
  useUploadImageOnly,
  useUploadProductImage,
} from '@/hooks/use-admin';
import { useCrudDialog } from '@/hooks/use-crud-dialog';
import { useImageUpload } from '@/hooks/use-image-upload';
import { useExpandedRows } from '@/hooks/use-expanded-rows';
import { toast } from 'sonner';
import { PageLoader } from '@/components/ui/page-loader';
import { EmptyTableRow } from '@/components/ui/empty-table-row';
import { ExternalLink } from '@/components/ui/external-link';
import { DeleteRowButton } from '@/components/admin/delete-row-button';
import { ChevronDown, ChevronUp } from 'lucide-react';
import type { AdminProduct } from '@/api/admin.api';
import { getErrorMessage, generateIdFromName } from '@/lib/error-utils';
import { formatPLN } from '@/lib/format';

export interface ProductsTabHandle {
  openCreate: () => void;
}

export const ProductsTab = forwardRef<ProductsTabHandle, object>(function ProductsTab(_, ref) {
  const { data: products, isLoading } = useAdminProducts();
  const { data: sets } = useAdminProductSets();
  const { data: types } = useAdminProductTypes();
  const createProduct = useCreateProduct();
  const updateProduct = useUpdateProduct();
  const deleteProduct = useDeleteProduct();
  const uploadImageOnly = useUploadImageOnly();
  const uploadImage = useUploadProductImage();

  const dialog = useCrudDialog<AdminProduct>();
  const image = useImageUpload();
  const { toggleRow, isExpanded } = useExpandedRows();
  const [formError, setFormError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    productSetId: '',
    productTypeId: '',
  });

  // Auto-fill product name as "{set} {type}" when both are selected and name is still empty (create mode only)
  const tryAutoFillName = (updated: typeof formData) => {
    if (!dialog.selected && !updated.name && updated.productSetId && updated.productTypeId) {
      const setName = sets?.find((s) => s.id === updated.productSetId)?.name ?? '';
      const typeName = types?.find((t) => t.id === updated.productTypeId)?.name ?? '';
      updated.name = `${setName} ${typeName}`;
    }
  };

  const resetForm = () => {
    image.reset();
    setFormError(null);
    setFormData({
      name: '',
      productSetId: '',
      productTypeId: '',
    });
  };

  useImperativeHandle(ref, () => ({
    openCreate: () => dialog.openCreate(resetForm),
  }));

  const populateForm = (product: AdminProduct) => {
    image.reset();
    setFormError(null);
    setFormData({
      name: product.name,
      productSetId: product.productSetId,
      productTypeId: product.productTypeId,
    });
  };

  const handleSave = async () => {
    if (!formData.productSetId || !formData.productTypeId) {
      setFormError('Set i Typ produktu są wymagane');
      return;
    }

    if (!dialog.selected && !image.imageFile) {
      setFormError('Obrazek jest wymagany');
      return;
    }

    setFormError(null);

    const payload: any = {
      name: formData.name,
      productSetId: formData.productSetId,
      productTypeId: formData.productTypeId,
    };

    if (!dialog.selected) {
      payload.id = generateIdFromName(formData.name);
    }

    try {
      if (dialog.selected) {
        await updateProduct.mutateAsync({ id: dialog.selected.id, data: payload });
        if (image.imageFile) {
          try {
            await uploadImage.mutateAsync({ id: dialog.selected.id, file: image.imageFile });
          } catch (imageError: any) {
            toast.error(getErrorMessage(imageError, 'Nie udało się przesłać obrazka'));
            return;
          }
        }
        toast.success('Produkt zaktualizowany');
      } else {
        let imageUrl = '';
        if (image.imageFile) {
          try {
            const uploadResult = await uploadImageOnly.mutateAsync({ file: image.imageFile });
            imageUrl = uploadResult.imageUrl;
          } catch (imageError: any) {
            toast.error(getErrorMessage(imageError, 'Nie udało się przesłać obrazka'));
            return;
          }
        }
        payload.imageUrl = imageUrl;
        await createProduct.mutateAsync(payload);
        toast.success('Produkt utworzony');
      }
      dialog.closeEdit();
    } catch (error: any) {
      toast.error(getErrorMessage(error, 'Nie udało się zapisać produktu'));
    }
  };

  const handleDelete = async () => {
    if (!dialog.selected) return;
    try {
      await deleteProduct.mutateAsync(dialog.selected.id);
      toast.success('Produkt usunięty');
      dialog.closeDelete();
    } catch (error: any) {
      toast.error(getErrorMessage(error, 'Nie udało się usunąć produktu'));
    }
  };

  // Group products by set and sort sets by release date (most recent first)
  const productsBySet = useMemo(() => {
    const grouped = new Map<string, AdminProduct[]>();

    (products || []).forEach((product) => {
      const setId = product.productSetId || 'no-set';
      if (!grouped.has(setId)) {
        grouped.set(setId, []);
      }
      grouped.get(setId)!.push(product);
    });

    grouped.forEach((productList) => {
      productList.sort((a, b) => {
        const aDisabled = a.disabled || !a.bestPrice;
        const bDisabled = b.disabled || !b.bestPrice;
        if (aDisabled && !bDisabled) return 1;
        if (!aDisabled && bDisabled) return -1;
        if (!aDisabled && !bDisabled && a.bestPrice && b.bestPrice) {
          return a.bestPrice - b.bestPrice;
        }
        return a.name.localeCompare(b.name);
      });
    });

    const sortedEntries = Array.from(grouped.entries()).sort(([setIdA], [setIdB]) => {
      if (setIdA === 'no-set') return 1;
      if (setIdB === 'no-set') return -1;

      const setA = sets?.find((s) => s.id === setIdA);
      const setB = sets?.find((s) => s.id === setIdB);

      const dateA = setA?.releaseDate ? new Date(setA.releaseDate).getTime() : 0;
      const dateB = setB?.releaseDate ? new Date(setB.releaseDate).getTime() : 0;

      return dateB - dateA;
    });

    return new Map(sortedEntries);
  }, [products, sets]);

  const isPending =
    createProduct.isPending ||
    updateProduct.isPending ||
    uploadImage.isPending ||
    uploadImageOnly.isPending;

  if (isLoading) {
    return <PageLoader />;
  }

  return (
    <>
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10"></TableHead>
              <TableHead className="w-16">Obrazek</TableHead>
              <TableHead>Nazwa</TableHead>
              <TableHead>Set</TableHead>
              <TableHead>Typ produktu</TableHead>
              <TableHead className="text-right">Najlepsza cena</TableHead>
              <TableHead className="text-center">Sklepy</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-16"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {productsBySet.size === 0 ? (
              <EmptyTableRow colSpan={9} message="Brak produktów" />
            ) : (
              Array.from(productsBySet.entries()).map(([setId, setProducts]) => {
                const set = sets?.find((s) => s.id === setId);
                const setName = setId === 'no-set' ? 'Bez setu' : set?.name || 'Nieznany set';

                return (
                  <React.Fragment key={setId}>
                    <TableRow className="bg-muted/50 hover:bg-muted/50">
                      <TableCell colSpan={9} className="font-semibold text-sm py-3">
                        {setName}
                        {set?.releaseDate && (
                          <span className="ml-2 text-muted-foreground font-normal">
                            (
                            {new Date(set.releaseDate).toLocaleDateString('pl-PL', {
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric',
                            })}
                            )
                          </span>
                        )}
                      </TableCell>
                    </TableRow>

                    {setProducts.map((product) => {
                      const expanded = isExpanded(product.id);
                      const isUnavailable = product.disabled || !product.bestPrice;
                      const type = types?.find((t) => t.id === product.productTypeId);

                      return (
                        <React.Fragment key={product.id}>
                          <TableRow
                            className={`cursor-pointer hover:bg-muted/50 ${isUnavailable ? 'opacity-50' : ''}`}
                            onClick={() => dialog.openEdit(product, populateForm)}
                          >
                            <TableCell
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleRow(product.id);
                              }}
                            >
                              {expanded ? (
                                <ChevronUp className="h-4 w-4" />
                              ) : (
                                <ChevronDown className="h-4 w-4" />
                              )}
                            </TableCell>
                            <TableCell>
                              {product.imageUrl && (
                                <img
                                  src={product.imageUrl}
                                  alt={product.name}
                                  className="h-10 w-10 rounded object-cover"
                                />
                              )}
                            </TableCell>
                            <TableCell className="font-medium">{product.name}</TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {setName}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {type?.name || '-'}
                            </TableCell>
                            <TableCell className="text-right">
                              {product.bestPrice ? formatPLN(product.bestPrice) : '-'}
                            </TableCell>
                            <TableCell className="text-center">
                              {product.shopFinds.length}
                            </TableCell>
                            <TableCell>
                              {product.disabled ? (
                                <StatusBadge status="inactive" label="Wyłączony" />
                              ) : product.bestPrice ? (
                                <StatusBadge status="ok" label="Aktywny" />
                              ) : (
                                <StatusBadge status="inactive" label="Niedostępny" />
                              )}
                            </TableCell>
                            <TableCell>
                              <DeleteRowButton onClick={() => dialog.openDelete(product)} />
                            </TableCell>
                          </TableRow>
                          {expanded && (
                            <TableRow>
                              <TableCell colSpan={9} className="bg-muted/30">
                                <div className="p-4">
                                  <p className="text-sm font-semibold mb-2">
                                    Wyniki ze sklepów (ostatnia godzina):
                                  </p>
                                  {(() => {
                                    const hourAgo = Date.now() - 60 * 60 * 1000;
                                    const recentFinds = product.shopFinds.filter((f) => {
                                      const isRecent = new Date(f.timestamp).getTime() >= hourAgo;
                                      const hasUrl = f.productUrl && f.productUrl !== '';
                                      const hasValidData = f.isAvailable || f.price !== null;
                                      return isRecent && hasUrl && hasValidData;
                                    });

                                    if (recentFinds.length === 0) {
                                      return (
                                        <p className="text-sm text-muted-foreground">
                                          Brak wyników z ostatniej godziny
                                        </p>
                                      );
                                    }

                                    return (
                                      <div className="space-y-2">
                                        {recentFinds
                                          .sort((a, b) => {
                                            if (!a.isAvailable && b.isAvailable) return 1;
                                            if (a.isAvailable && !b.isAvailable) return -1;
                                            if (
                                              a.isAvailable &&
                                              b.isAvailable &&
                                              a.price &&
                                              b.price
                                            ) {
                                              return a.price - b.price;
                                            }
                                            return 0;
                                          })
                                          .map((find, idx) => (
                                            <div
                                              key={idx}
                                              className={`flex items-center justify-between py-2 px-3 rounded border text-sm ${
                                                !find.isAvailable
                                                  ? 'opacity-50 border-muted bg-muted/30'
                                                  : 'border-border bg-background'
                                              }`}
                                            >
                                              <div className="flex items-center gap-3 min-w-0 flex-1">
                                                <span className="font-medium shrink-0">
                                                  {find.shopName}
                                                </span>
                                                {find.productTitle && (
                                                  <span
                                                    className="text-muted-foreground text-xs truncate"
                                                    title={find.productTitle}
                                                  >
                                                    {find.productTitle}
                                                  </span>
                                                )}
                                              </div>
                                              <div className="flex items-center gap-4 shrink-0">
                                                {find.isAvailable ? (
                                                  <>
                                                    <span className="text-green-500 font-semibold min-w-[80px] text-right">
                                                      {find.price ? formatPLN(find.price) : '-'}
                                                    </span>
                                                    <ExternalLink
                                                      href={find.productUrl}
                                                      className="text-blue-500 hover:text-blue-600 hover:underline font-medium"
                                                    >
                                                      Zobacz
                                                    </ExternalLink>
                                                  </>
                                                ) : (
                                                  <>
                                                    <span className="text-muted-foreground min-w-[80px] text-right">
                                                      {find.price
                                                        ? `${find.price.toFixed(2)} zł`
                                                        : 'Niedostępny'}
                                                    </span>
                                                    <ExternalLink
                                                      href={find.productUrl}
                                                      className="text-blue-500 hover:text-blue-600 hover:underline font-medium"
                                                    >
                                                      Zobacz
                                                    </ExternalLink>
                                                  </>
                                                )}
                                              </div>
                                            </div>
                                          ))}
                                      </div>
                                    );
                                  })()}
                                </div>
                              </TableCell>
                            </TableRow>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </React.Fragment>
                );
              })
            )}
          </TableBody>
        </Table>
      </Card>

      <CrudDialog
        open={dialog.editDialogOpen}
        onOpenChange={dialog.closeEdit}
        isEdit={!!dialog.selected}
        entityLabel="produkt"
        isPending={isPending}
        onSave={handleSave}
        className="max-w-2xl max-h-[90vh] overflow-y-auto overflow-x-hidden"
      >
        <div className="max-w-full space-y-6">
          {formError && (
            <div className="p-3 rounded bg-red-50 border border-red-200 text-red-700 text-sm">
              {formError}
            </div>
          )}

          <div>
            <Label htmlFor="name" className="mb-2 block">
              Nazwa <span className="text-red-500">*</span>
            </Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
              className="w-full"
            />
          </div>

          <div className="flex gap-4">
            <div className="w-48">
              <Label htmlFor="productSetId" className="mb-2 block">
                Set <span className="text-red-500">*</span>
              </Label>
              <Select
                value={formData.productSetId}
                onValueChange={(value) => {
                  const updated = { ...formData, productSetId: value };
                  tryAutoFillName(updated);
                  setFormData(updated);
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Wybierz set" />
                </SelectTrigger>
                <SelectContent>
                  {sets?.map((set) => (
                    <SelectItem key={set.id} value={set.id}>
                      {set.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="w-48">
              <Label htmlFor="productTypeId" className="mb-2 block">
                Typ produktu <span className="text-red-500">*</span>
              </Label>
              <Select
                value={formData.productTypeId}
                onValueChange={(value) => {
                  const updated = { ...formData, productTypeId: value };
                  tryAutoFillName(updated);
                  setFormData(updated);
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Wybierz typ produktu" />
                </SelectTrigger>
                <SelectContent>
                  {types?.map((type) => (
                    <SelectItem key={type.id} value={type.id}>
                      {type.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <ImageUpload
            id="image"
            label="Obrazek (PNG/WebP, kwadratowy)"
            imagePreview={image.imagePreview}
            currentImageUrl={dialog.selected?.imageUrl}
            onChange={image.handleImageChange}
            required={!dialog.selected}
            disabled={isPending}
          />
        </div>
      </CrudDialog>

      <ConfirmDialog
        open={dialog.deleteDialogOpen}
        onOpenChange={dialog.closeDelete}
        title="Usuń produkt"
        description={`Czy na pewno chcesz usunąć produkt "${dialog.selected?.name}"? Ta operacja usunie również wszystkie powiązane wpisy watchlisty, powiadomienia i wyniki.`}
        onConfirm={handleDelete}
        loading={deleteProduct.isPending}
      />
    </>
  );
});
