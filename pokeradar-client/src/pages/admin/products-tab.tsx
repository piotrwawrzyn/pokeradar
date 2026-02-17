import React, { useState, useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
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
import { Skeleton } from '@/components/ui/skeleton';
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
import { toast } from 'sonner';
import { Plus, ChevronDown, ChevronUp, Trash2 } from 'lucide-react';
import type { AdminProduct } from '@/api/admin.api';
import { getErrorMessage, generateIdFromName } from '@/lib/error-utils';

export function ProductsTab() {
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
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [customSearch, setCustomSearch] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    productSetId: 'none',
    productTypeId: 'none',
    searchPhrases: '',
    searchExclude: '',
    searchOverride: false,
  });

  const toggleRow = (id: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Auto-fill product name as "{set} {type}" when both are selected and name is still empty (create mode only)
  const tryAutoFillName = (updated: typeof formData) => {
    if (!dialog.selected && !updated.name && updated.productSetId !== 'none' && updated.productTypeId !== 'none') {
      const setName = sets?.find((s) => s.id === updated.productSetId)?.name ?? '';
      const typeName = types?.find((t) => t.id === updated.productTypeId)?.name ?? '';
      updated.name = `${setName} ${typeName}`;
    }
  };

  const resetForm = () => {
    image.reset();
    setCustomSearch(false);
    setFormError(null);
    setFormData({
      name: '',
      productSetId: 'none',
      productTypeId: 'none',
      searchPhrases: '',
      searchExclude: '',
      searchOverride: false,
    });
  };

  const populateForm = (product: AdminProduct) => {
    image.reset();
    setFormError(null);
    const hasCustomSearch = Boolean(product.search?.phrases?.length || product.search?.exclude?.length || product.search?.override);
    setCustomSearch(hasCustomSearch);
    setFormData({
      name: product.name,
      productSetId: product.productSetId || 'none',
      productTypeId: product.productTypeId || 'none',
      searchPhrases: product.search?.phrases?.join(', ') || '',
      searchExclude: product.search?.exclude?.join(', ') || '',
      searchOverride: product.search?.override || false,
    });
  };

  const handleSave = async () => {
    const hasType = formData.productTypeId !== 'none';
    const hasSearchPhrases = customSearch && formData.searchPhrases.trim().length > 0;

    if (!hasType && !hasSearchPhrases) {
      setFormError('Musisz wybrać Typ lub podać własne Frazy wyszukiwania');
      return;
    }

    if (!dialog.selected && !image.imageFile) {
      setFormError('Obrazek jest wymagany');
      return;
    }

    setFormError(null);

    const payload: any = {
      name: formData.name,
      productSetId: formData.productSetId !== 'none' ? formData.productSetId : undefined,
      productTypeId: formData.productTypeId !== 'none' ? formData.productTypeId : undefined,
    };

    if (!dialog.selected) {
      payload.id = generateIdFromName(formData.name);
    }

    if (customSearch) {
      payload.search = {
        phrases: formData.searchPhrases ? formData.searchPhrases.split(',').map((s) => s.trim()) : undefined,
        exclude: formData.searchExclude ? formData.searchExclude.split(',').map((s) => s.trim()) : undefined,
        override: formData.searchOverride,
      };
    } else if (dialog.selected) {
      payload.search = null;
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

  const isPending = createProduct.isPending || updateProduct.isPending || uploadImage.isPending || uploadImageOnly.isPending;

  if (isLoading) {
    return (
      <Card className="p-6">
        <Skeleton className="h-96" />
      </Card>
    );
  }

  return (
    <>
      <div className="flex justify-end mb-4">
        <Button onClick={() => dialog.openCreate(resetForm)}>
          <Plus className="h-4 w-4 mr-2" />
          Dodaj produkt
        </Button>
      </div>

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
              <TableRow>
                <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                  Brak produktów
                </TableCell>
              </TableRow>
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
                            ({new Date(set.releaseDate).toLocaleDateString('pl-PL', {
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric'
                            })})
                          </span>
                        )}
                      </TableCell>
                    </TableRow>

                    {setProducts.map((product) => {
                      const isExpanded = expandedRows.has(product.id);
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
                              {isExpanded ? (
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
                              {product.bestPrice ? `${product.bestPrice.toFixed(2)} zł` : '-'}
                            </TableCell>
                            <TableCell className="text-center">{product.shopFinds.length}</TableCell>
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
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  dialog.openDelete(product);
                                }}
                              >
                                <Trash2 className="h-4 w-4 text-red-500" />
                              </Button>
                            </TableCell>
                          </TableRow>
                          {isExpanded && (
                            <TableRow>
                              <TableCell colSpan={9} className="bg-muted/30">
                                <div className="p-4">
                                  <p className="text-sm font-semibold mb-2">Wyniki ze sklepów (ostatnia godzina):</p>
                                  {(() => {
                                    const hourAgo = Date.now() - 60 * 60 * 1000;
                                    const recentFinds = product.shopFinds.filter((f) => {
                                      const isRecent = new Date(f.timestamp).getTime() >= hourAgo;
                                      const hasUrl = f.productUrl && f.productUrl !== '';
                                      const hasValidData = f.isAvailable || f.price !== null;
                                      return isRecent && hasUrl && hasValidData;
                                    });

                                    if (recentFinds.length === 0) {
                                      return <p className="text-sm text-muted-foreground">Brak wyników z ostatniej godziny</p>;
                                    }

                                    return (
                                      <div className="space-y-2">
                                        {recentFinds
                                          .sort((a, b) => {
                                            if (!a.isAvailable && b.isAvailable) return 1;
                                            if (a.isAvailable && !b.isAvailable) return -1;
                                            if (a.isAvailable && b.isAvailable && a.price && b.price) {
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
                                              <span className="font-medium min-w-[150px]">{find.shopName}</span>
                                              <div className="flex items-center gap-4">
                                                {find.isAvailable ? (
                                                  <>
                                                    <span className="text-green-500 font-semibold min-w-[80px] text-right">
                                                      {find.price ? `${find.price.toFixed(2)} zł` : '-'}
                                                    </span>
                                                    <a
                                                      href={find.productUrl}
                                                      target="_blank"
                                                      rel="noopener noreferrer"
                                                      className="text-blue-500 hover:text-blue-600 hover:underline font-medium"
                                                      onClick={(e) => e.stopPropagation()}
                                                    >
                                                      Zobacz
                                                    </a>
                                                  </>
                                                ) : (
                                                  <>
                                                    <span className="text-muted-foreground min-w-[80px] text-right">Niedostępny</span>
                                                    <a
                                                      href={find.productUrl}
                                                      target="_blank"
                                                      rel="noopener noreferrer"
                                                      className="text-blue-500 hover:text-blue-600 hover:underline font-medium"
                                                      onClick={(e) => e.stopPropagation()}
                                                    >
                                                      Zobacz
                                                    </a>
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
              <Label htmlFor="productSetId" className="mb-2 block">Set</Label>
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
                  <SelectItem value="none">Brak</SelectItem>
                  {sets?.map((set) => (
                    <SelectItem key={set.id} value={set.id}>
                      {set.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="w-48">
              <Label htmlFor="productTypeId" className="mb-2 block">Typ produktu</Label>
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
                  <SelectItem value="none">Brak</SelectItem>
                  {types?.map((type) => (
                    <SelectItem key={type.id} value={type.id}>
                      {type.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center space-x-2 pt-2">
            <Switch
              id="customSearch"
              checked={customSearch}
              onCheckedChange={setCustomSearch}
            />
            <Label htmlFor="customSearch">Dostosuj frazy wyszukiwania</Label>
          </div>

          {customSearch && (
            <div className="space-y-6 pl-4 border-l-2 border-muted">
              <div>
                <Label htmlFor="searchPhrases" className="mb-2 block">
                  Frazy wyszukiwania (oddzielone przecinkami)
                </Label>
                <Input
                  id="searchPhrases"
                  value={formData.searchPhrases}
                  onChange={(e) => setFormData({ ...formData, searchPhrases: e.target.value })}
                  placeholder="np. Surging Sparks Booster Box"
                />
              </div>

              <div>
                <Label htmlFor="searchExclude" className="mb-2 block">Wykluczenia (oddzielone przecinkami)</Label>
                <Input
                  id="searchExclude"
                  value={formData.searchExclude}
                  onChange={(e) => setFormData({ ...formData, searchExclude: e.target.value })}
                  placeholder="np. case, etb"
                />
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="searchOverride"
                  checked={formData.searchOverride}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, searchOverride: checked })
                  }
                />
                <Label htmlFor="searchOverride">Nadpisz frazy typu produktu</Label>
              </div>
            </div>
          )}

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
}
