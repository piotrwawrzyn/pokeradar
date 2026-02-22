import { useRef, useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { ProductsTab, type ProductsTabHandle } from './products-tab';
import { ProductSetsTab } from './product-sets-tab';
import { ProductTypesTab } from './product-types-tab';

export function AdminProductsPage() {
  const [activeTab, setActiveTab] = useState('products');
  const productsTabRef = useRef<ProductsTabHandle>(null);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Produkty</h1>
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <TabsList className="w-full sm:w-fit">
            <TabsTrigger value="products" className="flex-1 sm:flex-none">
              Produkty
            </TabsTrigger>
            <TabsTrigger value="sets" className="flex-1 sm:flex-none">
              Sety
            </TabsTrigger>
            <TabsTrigger value="types" className="flex-1 sm:flex-none">
              Typy produktów
            </TabsTrigger>
          </TabsList>
          {activeTab === 'products' && (
            <Button
              className="w-full sm:w-auto shrink-0"
              onClick={() => productsTabRef.current?.openCreate()}
            >
              <Plus className="h-4 w-4 mr-2" />
              Dodaj produkt
            </Button>
          )}
        </div>
        <TabsContent value="products">
          <ProductsTab ref={productsTabRef} />
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
