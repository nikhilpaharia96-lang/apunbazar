import { useState } from "react";
import {
  useListProducts,
  useCreateProduct,
  useUpdateProduct,
  useDeleteProduct,
  getListProductsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Search } from "lucide-react";

const API = "/api";

const productSchema = z.object({
  name: z.string().min(2),
  description: z.string().min(5),
  price: z.coerce.number().positive(),
  originalPrice: z.coerce.number().optional(),
  categoryId: z.coerce.number().positive("Category is required"),
  imageUrl: z.string().url("Must be a valid URL"),
  stock: z.coerce.number().int().min(0),
  featured: z.boolean(),
  artisan: z.string().optional(),
  origin: z.string().optional(),
  tags: z.string().optional(),
  images: z.string().optional(),
});

type ProductForm = z.infer<typeof productSchema>;

export default function AdminProducts() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [selectedMainId, setSelectedMainId] = useState<number | null>(null);
  const [selectedSubId, setSelectedSubId] = useState<number | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data, isLoading } = useListProducts({ search: search || undefined, page, limit: 15 });

  const { data: mainCats = [] } = useQuery({
    queryKey: ["main-categories"],
    queryFn: async () => { const res = await fetch(`${API}/categories/main`); return res.json(); },
  });

  const { data: subCats = [] } = useQuery({
    queryKey: ["sub-categories", selectedMainId],
    enabled: !!selectedMainId,
    queryFn: async () => { const res = await fetch(`${API}/categories/sub?mainCategoryId=${selectedMainId}`); return res.json(); },
  });

  const { data: childCats = [] } = useQuery({
    queryKey: ["child-categories", selectedSubId],
    enabled: !!selectedSubId,
    queryFn: async () => { const res = await fetch(`${API}/categories/child?subCategoryId=${selectedSubId}`); return res.json(); },
  });

  const products = Array.isArray((data as any)?.products) ? (data as any).products : [];
  const createProduct = useCreateProduct();
  const updateProduct = useUpdateProduct();
  const deleteProduct = useDeleteProduct();

  const form = useForm<ProductForm>({
    resolver: zodResolver(productSchema),
    defaultValues: { name: "", description: "", price: 0, categoryId: 0, imageUrl: "", stock: 0, featured: false },
  });

  function openCreate() {
    setEditingId(null);
    setSelectedMainId(null);
    setSelectedSubId(null);
    form.reset({ name: "", description: "", price: 0, categoryId: 0, imageUrl: "", stock: 0, featured: false });
    setDialogOpen(true);
  }

  function openEdit(product: any) {
    setEditingId(product.id);
    setSelectedMainId(product.categoryId);
    form.reset({
      name: product.name, description: product.description, price: product.price,
      originalPrice: product.originalPrice ?? undefined, categoryId: product.categoryId,
      imageUrl: product.imageUrl, stock: product.stock, featured: product.featured,
      artisan: product.artisan ?? "", origin: product.origin ?? "",
      tags: product.tags?.join(", ") ?? "", images: product.images?.join("\n") ?? "",
    });
    setDialogOpen(true);
  }

  function onSubmit(values: ProductForm) {
    const payload = {
      ...values,
      images: values.images ? values.images.split("\n").map((u) => u.trim()).filter(Boolean) : [],
      tags: values.tags ? values.tags.split(",").map((t) => t.trim()).filter(Boolean) : [],
      originalPrice: values.originalPrice ?? null,
      artisan: values.artisan ?? null,
      origin: values.origin ?? null,
    };
    if (editingId) {
      updateProduct.mutate({ id: editingId, data: payload }, {
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListProductsQueryKey() }); setDialogOpen(false); toast({ title: "Product updated" }); },
      });
    } else {
      createProduct.mutate({ data: payload }, {
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListProductsQueryKey() }); setDialogOpen(false); toast({ title: "Product created" }); },
      });
    }
  }

  function handleDelete(id: number, name: string) {
    if (!confirm(`Delete "${name}"?`)) return;
    deleteProduct.mutate({ id }, {
      onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListProductsQueryKey() }); toast({ title: "Product deleted" }); },
    });
  }

  return (
    <div className="page-enter p-3 sm:p-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-serif text-2xl font-bold">Products</h1>
          <p className="text-muted-foreground text-sm">{(data as any)?.total ?? 0} products total</p>
        </div>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="h-4 w-4" /> Add Product
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search products..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} className="pl-10" />
      </div>

      <div className="border rounded-xl overflow-hidden bg-card">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-muted/50 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Product</th>
                <th className="text-left px-4 py-3 font-medium hidden md:table-cell">Category</th>
                <th className="text-left px-4 py-3 font-medium">Price</th>
                <th className="text-left px-4 py-3 font-medium hidden sm:table-cell">Stock</th>
                <th className="text-left px-4 py-3 font-medium hidden sm:table-cell">Featured</th>
                <th className="text-right px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="border-b">
                  <td className="px-4 py-3"><Skeleton className="h-8 w-48" /></td>
                  <td className="px-4 py-3 hidden md:table-cell"><Skeleton className="h-4 w-20" /></td>
                  <td className="px-4 py-3"><Skeleton className="h-4 w-16" /></td>
                  <td className="px-4 py-3 hidden sm:table-cell"><Skeleton className="h-4 w-10" /></td>
                  <td className="px-4 py-3 hidden sm:table-cell"><Skeleton className="h-4 w-10" /></td>
                  <td className="px-4 py-3"><Skeleton className="h-8 w-20 ml-auto" /></td>
                </tr>
              )) : products.map((product: any) => (
                <tr key={product.id} className="border-b last:border-0 hover:bg-muted/20">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                        <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover" />
                      </div>
                      <div>
                        <p className="font-medium line-clamp-1">{product.name}</p>
                        {product.artisan && <p className="text-muted-foreground text-xs">by {product.artisan}</p>}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <Badge variant="outline" className="text-xs">{product.categoryName}</Badge>
                  </td>
                  <td className="px-4 py-3 font-medium">₹{Number(product.price).toLocaleString("en-IN")}</td>
                  <td className="px-4 py-3 hidden sm:table-cell">
                    <span className={product.stock === 0 ? "text-destructive font-medium" : ""}>{product.stock}</span>
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell">
                    {product.featured ? <Badge className="bg-accent text-accent-foreground text-xs">Yes</Badge> : <span className="text-muted-foreground text-xs">No</span>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <Button size="sm" variant="ghost" onClick={() => openEdit(product)}><Pencil className="h-3.5 w-3.5" /></Button>
                      <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => handleDelete(product.id, product.name)}><Trash2 className="h-3.5 w-3.5" /></Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {(data as any)?.totalPages > 1 && (
        <div className="flex justify-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>Previous</Button>
          <span className="flex items-center px-3 text-sm">Page {page} of {(data as any).totalPages}</span>
          <Button variant="outline" size="sm" onClick={() => setPage((p) => p + 1)} disabled={page === (data as any).totalPages}>Next</Button>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Product" : "Add New Product"}</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField control={form.control} name="name" render={({ field }) => (
                  <FormItem className="col-span-2">
                    <FormLabel>Product Name</FormLabel>
                    <FormControl><Input placeholder="e.g. Muga Silk Saree" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="price" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Price (₹)</FormLabel>
                    <FormControl><Input type="number" step="0.01" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="originalPrice" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Original Price (₹)</FormLabel>
                    <FormControl><Input type="number" step="0.01" placeholder="Optional" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                {/* Main Category */}
                <FormField control={form.control} name="categoryId" render={({ field }) => (
                  <FormItem className="col-span-2">
                    <FormLabel>Main Category</FormLabel>
                    <Select value={String(field.value)} onValueChange={(v) => {
                      field.onChange(v);
                      setSelectedMainId(Number(v));
                      setSelectedSubId(null);
                    }}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Select main category..." /></SelectTrigger></FormControl>
                      <SelectContent>
                        {(mainCats as any[]).map((cat: any) => (
                          <SelectItem key={cat.id} value={String(cat.id)}>{cat.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />

                {/* Sub Category */}
                {(subCats as any[]).length > 0 && (
                  <div className="col-span-2 space-y-2">
                    <label className="text-sm font-medium leading-none">Sub Category</label>
                    <Select onValueChange={(v) => setSelectedSubId(Number(v))}>
                      <SelectTrigger><SelectValue placeholder="Select sub category..." /></SelectTrigger>
                      <SelectContent>
                        {(subCats as any[]).map((cat: any) => (
                          <SelectItem key={cat.id} value={String(cat.id)}>{cat.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Child Category */}
                {(childCats as any[]).length > 0 && (
                  <div className="col-span-2 space-y-2">
                    <label className="text-sm font-medium leading-none">Child Category</label>
                    <Select onValueChange={(v) => form.setValue("categoryId", Number(v))}>
                      <SelectTrigger><SelectValue placeholder="Select child category..." /></SelectTrigger>
                      <SelectContent>
                        {(childCats as any[]).map((cat: any) => (
                          <SelectItem key={cat.id} value={String(cat.id)}>{cat.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <FormField control={form.control} name="stock" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Stock</FormLabel>
                    <FormControl><Input type="number" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              <FormField control={form.control} name="description" render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl><Textarea rows={3} {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="imageUrl" render={({ field }) => (
                <FormItem>
                  <FormLabel>Image URL</FormLabel>
                  <FormControl><Input placeholder="https://..." {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="images" render={({ field }) => (
                <FormItem>
                  <FormLabel>Additional Images (ek line mein ek URL)</FormLabel>
                  <FormControl><Textarea rows={3} placeholder={"https://example.com/img1.jpg\nhttps://example.com/img2.jpg"} {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField control={form.control} name="artisan" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Artisan Name</FormLabel>
                    <FormControl><Input placeholder="Optional" {...field} /></FormControl>
                  </FormItem>
                )} />
                <FormField control={form.control} name="origin" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Origin</FormLabel>
                    <FormControl><Input placeholder="e.g. Sualkuchi, Assam" {...field} /></FormControl>
                  </FormItem>
                )} />
              </div>
              <FormField control={form.control} name="tags" render={({ field }) => (
                <FormItem>
                  <FormLabel>Tags (comma separated)</FormLabel>
                  <FormControl><Input placeholder="handmade, organic, traditional" {...field} /></FormControl>
                </FormItem>
              )} />
              <FormField control={form.control} name="featured" render={({ field }) => (
                <FormItem className="flex items-center gap-3">
                  <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                  <FormLabel className="!mt-0">Featured Product</FormLabel>
                </FormItem>
              )} />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={createProduct.isPending || updateProduct.isPending}>
                  {editingId ? "Update Product" : "Create Product"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}