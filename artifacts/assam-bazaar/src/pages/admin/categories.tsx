import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, ChevronRight, ChevronDown } from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { getAuthHeaders } from "@/lib/admin-auth";

const API = "/api";

function toSlug(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

// Authenticated request helper: sends the admin JWT, throws on any non-2xx
// response so the UI can show the real server error instead of a fake "success".
async function api(path: string, init: RequestInit = {}) {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeaders(),
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      if (body?.error) message = typeof body.error === "string" ? body.error : body.error.message ?? message;
    } catch { /* non-JSON response */ }
    if (res.status === 401) message = "Session expired. Please log in again.";
    throw new Error(message);
  }
  if (res.status === 204) return null;
  return res.json();
}

function useCategoryTree() {
  return useQuery({
    queryKey: ["categories-tree"],
    queryFn: async () => {
      const data = await api("/categories/tree");
      return Array.isArray(data) ? data : [];
    },
    retry: 1,
  });
}

function CategoryForm({ onSubmit, loading }: { onSubmit: (data: any) => void; loading: boolean }) {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [imageUrl, setImageUrl] = useState("");

  return (
    <div className="space-y-3">
      <div>
        <label className="text-sm font-medium">Name</label>
        <Input value={name} onChange={(e) => { setName(e.target.value); setSlug(toSlug(e.target.value)); }} placeholder="Category name" />
      </div>
      <div>
        <label className="text-sm font-medium">Slug</label>
        <Input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="category-slug" />
      </div>
      <div>
        <label className="text-sm font-medium">Description</label>
        <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional" />
      </div>
      <div>
        <label className="text-sm font-medium">Image URL</label>
        <Input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://..." />
      </div>
      <Button onClick={() => onSubmit({ name, slug, description, imageUrl })} disabled={loading} className="w-full">
        {loading ? "Saving..." : "Save"}
      </Button>
    </div>
  );
}

export default function AdminCategories() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: tree = [], isLoading, isError, error, refetch: reload } = useCategoryTree();

  const [dialog, setDialog] = useState<{ type: "main" | "sub" | "child"; parentId?: number; parentName?: string } | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const refetch = () => queryClient.invalidateQueries({ queryKey: ["categories-tree"] });

  const createMain = useMutation({
    mutationFn: (data: any) => api("/categories/main", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => { refetch(); setDialog(null); toast({ title: "Main category created" }); },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const createSub = useMutation({
    mutationFn: (data: any) => api("/categories/sub", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => { refetch(); setDialog(null); toast({ title: "Sub category created" }); },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const createChild = useMutation({
    mutationFn: (data: any) => api("/categories/child", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => { refetch(); setDialog(null); toast({ title: "Child category created" }); },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMain = useMutation({
    mutationFn: (id: number) => api(`/categories/main/${id}`, { method: "DELETE" }),
    onSuccess: () => { refetch(); toast({ title: "Deleted" }); },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteSub = useMutation({
    mutationFn: (id: number) => api(`/categories/sub/${id}`, { method: "DELETE" }),
    onSuccess: () => { refetch(); toast({ title: "Deleted" }); },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteChild = useMutation({
    mutationFn: (id: number) => api(`/categories/child/${id}`, { method: "DELETE" }),
    onSuccess: () => { refetch(); toast({ title: "Deleted" }); },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  function handleSubmit(data: any) {
    if (!dialog) return;
    if (dialog.type === "main") createMain.mutate(data);
    if (dialog.type === "sub") createSub.mutate({ ...data, mainCategoryId: dialog.parentId });
    if (dialog.type === "child") createChild.mutate({ ...data, subCategoryId: dialog.parentId });
  }

  function toggleExpand(key: string) {
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  return (
    <div className="page-enter p-3 sm:p-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-serif text-2xl font-bold">Categories</h1>
          <p className="text-muted-foreground text-sm">4-level hierarchy: Main → Sub → Child → Products</p>
        </div>
        <Button onClick={() => setDialog({ type: "main" })} className="gap-2">
          <Plus className="h-4 w-4" /> Add Main Category
        </Button>
      </div>

      {isError ? (
        <div className="text-center py-20 space-y-3">
          <p className="text-destructive font-medium">Could not load categories</p>
          <p className="text-sm text-muted-foreground">{(error as Error)?.message}</p>
          <Button variant="outline" onClick={() => reload()}>Try again</Button>
        </div>
      ) : isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12 rounded-lg" />)}
        </div>
      ) : tree.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <p>No categories yet. Add a Main Category to get started.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {tree.map((main: any) => (
            <div key={main.id} className="border rounded-xl overflow-hidden">
              {/* Main Category */}
              <div className="flex items-center justify-between px-4 py-3 bg-primary/5 hover:bg-primary/10 transition-colors">
                <div className="flex items-center gap-2 cursor-pointer" onClick={() => toggleExpand(`main-${main.id}`)}>
                  {expanded[`main-${main.id}`] ? <ChevronDown className="h-4 w-4 text-primary" /> : <ChevronRight className="h-4 w-4 text-primary" />}
                  <span className="font-semibold text-primary">{main.name}</span>
                  <span className="text-xs text-muted-foreground">({main.subCategories?.length ?? 0} sub)</span>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => setDialog({ type: "sub", parentId: main.id, parentName: main.name })}>
                    <Plus className="h-3 w-3" /> Sub
                  </Button>
                  <Button size="sm" variant="ghost" className="h-7 text-destructive hover:text-destructive" onClick={() => { if (confirm(`Delete "${main.name}"?`)) deleteMain.mutate(main.id); }}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>

              {/* Sub Categories */}
              {expanded[`main-${main.id}`] && (
                <div className="pl-6 border-t">
                  {main.subCategories?.length === 0 ? (
                    <p className="text-xs text-muted-foreground py-3 px-4">No sub categories yet</p>
                  ) : (
                    main.subCategories?.map((sub: any) => (
                      <div key={sub.id} className="border-b last:border-0">
                        <div className="flex items-center justify-between px-4 py-2.5 bg-accent/5 hover:bg-accent/10 transition-colors">
                          <div className="flex items-center gap-2 cursor-pointer" onClick={() => toggleExpand(`sub-${sub.id}`)}>
                            {expanded[`sub-${sub.id}`] ? <ChevronDown className="h-3.5 w-3.5 text-accent-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-accent-foreground" />}
                            <span className="font-medium text-sm">{sub.name}</span>
                            <span className="text-xs text-muted-foreground">({sub.childCategories?.length ?? 0} child)</span>
                          </div>
                          <div className="flex gap-2">
                            <Button size="sm" variant="outline" className="h-6 text-xs gap-1" onClick={() => setDialog({ type: "child", parentId: sub.id, parentName: sub.name })}>
                              <Plus className="h-3 w-3" /> Child
                            </Button>
                            <Button size="sm" variant="ghost" className="h-6 text-destructive hover:text-destructive" onClick={() => { if (confirm(`Delete "${sub.name}"?`)) deleteSub.mutate(sub.id); }}>
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>

                        {/* Child Categories */}
                        {expanded[`sub-${sub.id}`] && (
                          <div className="pl-6 border-t bg-muted/20">
                            {sub.childCategories?.length === 0 ? (
                              <p className="text-xs text-muted-foreground py-2 px-4">No child categories yet</p>
                            ) : (
                              sub.childCategories?.map((child: any) => (
                                <div key={child.id} className="flex items-center justify-between px-4 py-2 border-b last:border-0">
                                  <div className="flex items-center gap-2">
                                    <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground" />
                                    <span className="text-sm">{child.name}</span>
                                    <span className="text-xs text-muted-foreground font-mono">{child.slug}</span>
                                  </div>
                                  <Button size="sm" variant="ghost" className="h-6 text-destructive hover:text-destructive" onClick={() => { if (confirm(`Delete "${child.name}"?`)) deleteChild.mutate(child.id); }}>
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </div>
                              ))
                            )}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <Dialog open={!!dialog} onOpenChange={() => setDialog(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {dialog?.type === "main" && "Add Main Category"}
              {dialog?.type === "sub" && `Add Sub Category under "${dialog.parentName}"`}
              {dialog?.type === "child" && `Add Child Category under "${dialog.parentName}"`}
            </DialogTitle>
          </DialogHeader>
          <CategoryForm
            onSubmit={handleSubmit}
            loading={createMain.isPending || createSub.isPending || createChild.isPending}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(null)}>Cancel</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}