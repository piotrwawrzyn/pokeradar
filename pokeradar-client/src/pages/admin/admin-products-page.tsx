import React, { useState, useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusBadge } from '@/components/admin/status-badge';
import { ConfirmDialog } from '@/components/admin/confirm-dialog';
import {
  useAdminProducts,
  useAdminProductSets,
  useAdminProductTypes,
  useCreateProduct,
  useUpdateProduct,
  useDeleteProduct,
  useUploadImageOnly,
  useUploadProductImage,
  useCreateProductSet,
  useUpdateProductSet,
  useDeleteProductSet,
  useUploadProductSetImage,
  useCreateProductType,
  useUpdateProductType,
  useDeleteProductType,
} from '@/hooks/use-admin';
import { toast } from 'sonner';
import { Plus, ChevronDown, ChevronUp, Trash2, Loader2 } from 'lucide-react';
import type { AdminProduct, ProductSet, ProductType } from '@/api/admin.api';
import { getErrorMessage, generateIdFromName } from '@/lib/error-utils';

export function AdminProductsPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Produkty</h1>
      <Tabs defaultValue="products" className="space-y-4">
        <TabsList>
          <TabsTrigger value="products">Produkty</TabsTrigger>
          <TabsTrigger value="sets">Sety</TabsTrigger>
          <TabsTrigger value="types">Typy produktów</TabsTrigger>
        </TabsList>
        <TabsContent value="products">
          <ProductsTab />
        </TabsContent>
        <TabsContent value="sets">
          <ProductSetsTab />
        </TabsContent>
        <TabsContent value="types">
          <ProductTypesTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ProductsTab() {
  const { data: products, isLoading } = useAdminProducts();
  const { data: sets } = useAdminProductSets();
  const { data: types } = useAdminProductTypes();
  const createProduct = useCreateProduct();
  const updateProduct = useUpdateProduct();
  const deleteProduct = useDeleteProduct();
  const uploadImageOnly = useUploadImageOnly();
  const uploadImage = useUploadProductImage();

  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<AdminProduct | null>(null);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
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

  const handleOpenCreate = () => {
    setSelectedProduct(null);
    setImageFile(null);
    setImagePreview(null);
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
    setEditDialogOpen(true);
  };

  const handleOpenEdit = (product: AdminProduct) => {
    setSelectedProduct(product);
    setImageFile(null);
    setImagePreview(null);
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
    setEditDialogOpen(true);
  };

  const handleSave = async () => {
    // Validation: Must have either productTypeId OR custom search phrases
    const hasType = formData.productTypeId !== 'none';
    const hasSearchPhrases = customSearch && formData.searchPhrases.trim().length > 0;

    if (!hasType && !hasSearchPhrases) {
      setFormError('Musisz wybrać Typ lub podać własne Frazy wyszukiwania');
      return;
    }

    // Validation: Image is required for new products
    if (!selectedProduct && !imageFile) {
      setFormError('Obrazek jest wymagany');
      return;
    }

    setFormError(null);

    const payload: any = {
      name: formData.name,
      productSetId: formData.productSetId !== 'none' ? formData.productSetId : undefined,
      productTypeId: formData.productTypeId !== 'none' ? formData.productTypeId : undefined,
    };

    // Auto-generate id from name for create operation
    if (!selectedProduct) {
      payload.id = generateIdFromName(formData.name);
    }

    if (customSearch) {
      payload.search = {
        phrases: formData.searchPhrases ? formData.searchPhrases.split(',').map((s) => s.trim()) : undefined,
        exclude: formData.searchExclude ? formData.searchExclude.split(',').map((s) => s.trim()) : undefined,
        override: formData.searchOverride,
      };
    } else if (selectedProduct) {
      // Only set search to null for updates (to clear it), not for creates
      payload.search = null;
    }

    try {
      if (selectedProduct) {
        await updateProduct.mutateAsync({ id: selectedProduct.id, data: payload });
        if (imageFile) {
          try {
            await uploadImage.mutateAsync({ id: selectedProduct.id, file: imageFile });
          } catch (imageError: any) {
            toast.error(getErrorMessage(imageError, 'Nie udało się przesłać obrazka'));
            return; // Don't close dialog on image upload failure
          }
        }
        toast.success('Produkt zaktualizowany');
      } else {
        // For new products, upload image first, then create product with imageUrl
        let imageUrl = '';
        if (imageFile) {
          try {
            const uploadResult = await uploadImageOnly.mutateAsync({ file: imageFile });
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
      setEditDialogOpen(false);
    } catch (error: any) {
      toast.error(getErrorMessage(error, 'Nie udało się zapisać produktu'));
    }
  };

  const handleDelete = async () => {
    if (!selectedProduct) return;
    try {
      await deleteProduct.mutateAsync(selectedProduct.id);
      toast.success('Produkt usunięty');
      setDeleteDialogOpen(false);
    } catch (error: any) {
      toast.error(getErrorMessage(error, 'Nie udało się usunąć produktu'));
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setImageFile(file);

    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
      // Clear input to detach File object and prevent ERR_UPLOAD_FILE_CHANGED
      e.target.value = '';
    } else {
      setImagePreview(null);
    }
  };

  // Group products by set and sort sets by release date (most recent first)
  const productsBySet = useMemo(() => {
    const grouped = new Map<string, AdminProduct[]>();

    // Group products by set
    (products || []).forEach((product) => {
      const setId = product.productSetId || 'no-set';
      if (!grouped.has(setId)) {
        grouped.set(setId, []);
      }
      grouped.get(setId)!.push(product);
    });

    // Sort products within each group
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

    // Sort sets by release date (most recent first)
    const sortedEntries = Array.from(grouped.entries()).sort(([setIdA], [setIdB]) => {
      // No set always goes last
      if (setIdA === 'no-set') return 1;
      if (setIdB === 'no-set') return -1;

      const setA = sets?.find((s) => s.id === setIdA);
      const setB = sets?.find((s) => s.id === setIdB);

      const dateA = setA?.releaseDate ? new Date(setA.releaseDate).getTime() : 0;
      const dateB = setB?.releaseDate ? new Date(setB.releaseDate).getTime() : 0;

      return dateB - dateA; // Descending order (most recent first)
    });

    return new Map(sortedEntries);
  }, [products, sets]);

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
        <Button onClick={handleOpenCreate}>
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
              Array.from(productsBySet.entries()).map(([setId, setProducts], groupIndex) => {
                const set = sets?.find((s) => s.id === setId);
                const setName = setId === 'no-set' ? 'Bez setu' : set?.name || 'Nieznany set';

                return (
                  <React.Fragment key={setId}>
                    {/* Set header row */}
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

                    {/* Products in this set */}
                    {setProducts.map((product) => {
                      const isExpanded = expandedRows.has(product.id);
                      const isUnavailable = product.disabled || !product.bestPrice;
                      const type = types?.find((t) => t.id === product.productTypeId);

                      return (
                        <React.Fragment key={product.id}>
                          <TableRow
                            className={`cursor-pointer hover:bg-muted/50 ${isUnavailable ? 'opacity-50' : ''}`}
                            onClick={() => handleOpenEdit(product)}
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
                            setSelectedProduct(product);
                            setDeleteDialogOpen(true);
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

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto overflow-x-hidden">
          <DialogHeader>
            <DialogTitle>{selectedProduct ? 'Edytuj produkt' : 'Nowy produkt'}</DialogTitle>
            <DialogDescription>
              {selectedProduct
                ? 'Zaktualizuj informacje o produkcie'
                : 'Dodaj nowy produkt do systemu'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6 py-4 max-w-full">
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
                  onValueChange={(value) => setFormData({ ...formData, productSetId: value })}
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
                  onValueChange={(value) => setFormData({ ...formData, productTypeId: value })}
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

            <div>
              <Label htmlFor="image" className="mb-2 block">
                Obrazek (PNG/WebP, kwadratowy) <span className="text-red-500">*</span>
              </Label>
              <Input
                id="image"
                type="file"
                accept="image/png,image/webp"
                onChange={handleImageChange}
                required={!selectedProduct}
                disabled={createProduct.isPending || updateProduct.isPending || uploadImage.isPending || uploadImageOnly.isPending}
              />
              {imagePreview ? (
                <img
                  src={imagePreview}
                  alt="Preview"
                  className="mt-3 h-24 w-24 rounded object-cover border-2 border-border"
                />
              ) : selectedProduct?.imageUrl && (
                <img
                  src={selectedProduct.imageUrl}
                  alt="Current"
                  className="mt-3 h-24 w-24 rounded object-cover border-2 border-muted"
                />
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Anuluj
            </Button>
            <Button
              onClick={handleSave}
              disabled={createProduct.isPending || updateProduct.isPending || uploadImage.isPending || uploadImageOnly.isPending}
            >
              {(createProduct.isPending || updateProduct.isPending || uploadImage.isPending || uploadImageOnly.isPending) && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              {createProduct.isPending || updateProduct.isPending || uploadImage.isPending || uploadImageOnly.isPending ? 'Zapisywanie...' : 'Zapisz'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Usuń produkt"
        description={`Czy na pewno chcesz usunąć produkt "${selectedProduct?.name}"? Ta operacja usunie również wszystkie powiązane wpisy watchlisty, powiadomienia i wyniki.`}
        onConfirm={handleDelete}
        loading={deleteProduct.isPending}
      />
    </>
  );
}

function ProductSetsTab() {
  const { data: sets, isLoading } = useAdminProductSets();
  const createSet = useCreateProductSet();
  const updateSet = useUpdateProductSet();
  const deleteSet = useDeleteProductSet();
  const uploadImage = useUploadProductSetImage();

  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedSet, setSelectedSet] = useState<ProductSet | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    series: '',
    releaseDate: '',
  });

  const handleOpenCreate = () => {
    setSelectedSet(null);
    setImageFile(null);
    setImagePreview(null);
    setFormData({ name: '', series: '', releaseDate: '' });
    setEditDialogOpen(true);
  };

  const handleOpenEdit = (set: ProductSet) => {
    setSelectedSet(set);
    setImageFile(null);
    setImagePreview(null);
    setFormData({
      name: set.name,
      series: set.series,
      releaseDate: set.releaseDate ? set.releaseDate.split('T')[0] : '',
    });
    setEditDialogOpen(true);
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setImageFile(file);

    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
      // Clear input to detach File object and prevent ERR_UPLOAD_FILE_CHANGED
      e.target.value = '';
    } else {
      setImagePreview(null);
    }
  };

  const handleSave = async () => {
    const payload: any = {
      name: formData.name,
      series: formData.series,
      releaseDate: formData.releaseDate || undefined,
    };

    try {
      if (selectedSet) {
        await updateSet.mutateAsync({ id: selectedSet.id, data: payload });
        if (imageFile) {
          try {
            await uploadImage.mutateAsync({ id: selectedSet.id, file: imageFile });
          } catch (imageError: any) {
            toast.error(getErrorMessage(imageError, 'Nie udało się przesłać obrazka'));
            return; // Don't close dialog on image upload failure
          }
        }
        toast.success('Set zaktualizowany');
      } else {
        const result = await createSet.mutateAsync(payload);
        if (imageFile && result.id) {
          try {
            await uploadImage.mutateAsync({ id: result.id, file: imageFile });
          } catch (imageError: any) {
            toast.error(getErrorMessage(imageError, 'Nie udało się przesłać obrazka'));
            return; // Don't close dialog on image upload failure
          }
        }
        toast.success('Set utworzony');
      }
      setEditDialogOpen(false);
    } catch (error: any) {
      toast.error(getErrorMessage(error, 'Nie udało się zapisać setu'));
    }
  };

  const handleDelete = async () => {
    if (!selectedSet) return;
    try {
      await deleteSet.mutateAsync(selectedSet.id);
      toast.success('Set usunięty');
      setDeleteDialogOpen(false);
    } catch (error: any) {
      toast.error(getErrorMessage(error, 'Nie udało się usunąć setu'));
    }
  };

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
        <Button onClick={handleOpenCreate}>
          <Plus className="h-4 w-4 mr-2" />
          Dodaj set
        </Button>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-32">Obrazek</TableHead>
              <TableHead>Nazwa</TableHead>
              <TableHead>Seria</TableHead>
              <TableHead>Data wydania</TableHead>
              <TableHead className="w-16"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {!sets || sets.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                  Brak setów
                </TableCell>
              </TableRow>
            ) : (
              sets.map((set) => (
                <TableRow
                  key={set.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => handleOpenEdit(set)}
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
                    {set.releaseDate ? new Date(set.releaseDate).toLocaleDateString('pl-PL', { year: 'numeric', month: '2-digit', day: '2-digit' }) : '-'}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedSet(set);
                        setDeleteDialogOpen(true);
                      }}
                    >
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selectedSet ? 'Edytuj set' : 'Nowy set'}</DialogTitle>
            <DialogDescription>
              {selectedSet ? 'Zaktualizuj informacje o setcie' : 'Dodaj nowy set do systemu'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6 py-4">
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

            <div>
              <Label htmlFor="set-image" className="mb-2 block">Obrazek (PNG/WebP)</Label>
              <Input
                id="set-image"
                type="file"
                accept="image/png,image/webp"
                onChange={handleImageChange}
                disabled={createSet.isPending || updateSet.isPending || uploadImage.isPending}
              />
              {imagePreview ? (
                <img
                  src={imagePreview}
                  alt="Preview"
                  className="mt-3 h-24 w-24 rounded object-cover border-2 border-border"
                />
              ) : selectedSet?.imageUrl && (
                <img
                  src={selectedSet.imageUrl}
                  alt="Current"
                  className="mt-3 h-24 w-24 rounded object-cover border-2 border-muted"
                />
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Anuluj
            </Button>
            <Button
              onClick={handleSave}
              disabled={createSet.isPending || updateSet.isPending || uploadImage.isPending}
            >
              {(createSet.isPending || updateSet.isPending || uploadImage.isPending) && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              {createSet.isPending || updateSet.isPending || uploadImage.isPending ? 'Zapisywanie...' : 'Zapisz'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Usuń set"
        description={`Czy na pewno chcesz usunąć set "${selectedSet?.name}"? Upewnij się, że żaden produkt nie jest z nim powiązany.`}
        onConfirm={handleDelete}
        loading={deleteSet.isPending}
      />
    </>
  );
}

function ProductTypesTab() {
  const { data: types, isLoading } = useAdminProductTypes();
  const createType = useCreateProductType();
  const updateType = useUpdateProductType();
  const deleteType = useDeleteProductType();

  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedType, setSelectedType] = useState<ProductType | null>(null);

  const [formData, setFormData] = useState({
    id: '',
    name: '',
    searchPhrases: '',
    searchExclude: '',
  });

  const handleOpenCreate = () => {
    setSelectedType(null);
    setFormData({ id: '', name: '', searchPhrases: '', searchExclude: '' });
    setEditDialogOpen(true);
  };

  const handleOpenEdit = (type: ProductType) => {
    setSelectedType(type);
    setFormData({
      id: type.id,
      name: type.name,
      searchPhrases: type.search.phrases?.join(', ') || '',
      searchExclude: type.search.exclude?.join(', ') || '',
    });
    setEditDialogOpen(true);
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

    // Auto-generate id from name for create operation
    if (!selectedType) {
      payload.id = generateIdFromName(formData.name);
    }

    try {
      if (selectedType) {
        await updateType.mutateAsync({ id: selectedType.id, data: payload });
        toast.success('Typ produktu zaktualizowany');
      } else {
        await createType.mutateAsync(payload);
        toast.success('Typ produktu utworzony');
      }
      setEditDialogOpen(false);
    } catch (error: any) {
      toast.error(getErrorMessage(error, 'Nie udało się zapisać typu produktu'));
    }
  };

  const handleDelete = async () => {
    if (!selectedType) return;
    try {
      await deleteType.mutateAsync(selectedType.id);
      toast.success('Typ produktu usunięty');
      setDeleteDialogOpen(false);
    } catch (error: any) {
      toast.error(getErrorMessage(error, 'Nie udało się usunąć typu produktu'));
    }
  };

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
        <Button onClick={handleOpenCreate}>
          <Plus className="h-4 w-4 mr-2" />
          Dodaj typ produktu
        </Button>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nazwa</TableHead>
              <TableHead>Frazy wyszukiwania</TableHead>
              <TableHead>Wykluczenia</TableHead>
              <TableHead className="w-16"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {!types || types.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                  Brak typów produktów
                </TableCell>
              </TableRow>
            ) : (
              types.map((type) => (
                <TableRow
                  key={type.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => handleOpenEdit(type)}
                >
                  <TableCell className="font-medium">{type.name}</TableCell>
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
                        setSelectedType(type);
                        setDeleteDialogOpen(true);
                      }}
                    >
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selectedType ? 'Edytuj typ produktu' : 'Nowy typ produktu'}</DialogTitle>
            <DialogDescription>
              {selectedType ? 'Zaktualizuj informacje o typie produktu' : 'Dodaj nowy typ produktu do systemu'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6 py-4">
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
              <Label htmlFor="type-searchPhrases" className="mb-2 block">Frazy wyszukiwania (oddzielone przecinkami)</Label>
              <Textarea
                id="type-searchPhrases"
                value={formData.searchPhrases}
                onChange={(e) => setFormData({ ...formData, searchPhrases: e.target.value })}
                placeholder="np. V, VMAX, VSTAR"
              />
            </div>

            <div>
              <Label htmlFor="type-searchExclude" className="mb-2 block">Wykluczenia (oddzielone przecinkami)</Label>
              <Textarea
                id="type-searchExclude"
                value={formData.searchExclude}
                onChange={(e) => setFormData({ ...formData, searchExclude: e.target.value })}
                placeholder="np. proxy, damaged"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Anuluj
            </Button>
            <Button
              onClick={handleSave}
              disabled={createType.isPending || updateType.isPending}
            >
              {(createType.isPending || updateType.isPending) && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              {createType.isPending || updateType.isPending ? 'Zapisywanie...' : 'Zapisz'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Usuń typ produktu"
        description={`Czy na pewno chcesz usunąć typ produktu "${selectedType?.name}"? Upewnij się, że żaden produkt nie jest z nim powiązany.`}
        onConfirm={handleDelete}
        loading={deleteType.isPending}
      />
    </>
  );
}
