import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ProductsTab } from './products-tab';
import { ProductSetsTab } from './product-sets-tab';
import { ProductTypesTab } from './product-types-tab';

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
