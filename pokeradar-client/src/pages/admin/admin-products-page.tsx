import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ProductsTab } from './products-tab';
import { ProductSetsTab } from './product-sets-tab';
import { ProductTypesTab } from './product-types-tab';

export function AdminProductsPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Produkty</h1>
      <Tabs defaultValue="products" className="space-y-4">
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
