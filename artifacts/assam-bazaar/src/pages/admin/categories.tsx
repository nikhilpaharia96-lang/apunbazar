diff --git a/artifacts/api-server/src/routes/categories.ts b/artifacts/api-server/src/routes/categories.ts
index 7006cd7..8c2712e 100644
--- a/artifacts/api-server/src/routes/categories.ts
+++ b/artifacts/api-server/src/routes/categories.ts
@@ -1,6 +1,7 @@
 import { Router, type IRouter } from "express";
 import { db, mainCategoriesTable, subCategoriesTable, childCategoriesTable } from "@workspace/db";
 import { eq } from "drizzle-orm";
+import { requireAdminAuth } from "../middleware/admin-auth";
 
 const router: IRouter = Router();
 
@@ -15,7 +16,7 @@ router.get("/main", async (_req, res): Promise<void> => {
   }
 });
 
-router.post("/main", async (req, res): Promise<void> => {
+router.post("/main", requireAdminAuth, async (req, res): Promise<void> => {
   try {
     const { name, slug, description, imageUrl } = req.body;
     if (!name || !slug) { res.status(400).json({ error: "name and slug required" }); return; }
@@ -27,7 +28,7 @@ router.post("/main", async (req, res): Promise<void> => {
   }
 });
 
-router.put("/main/:id", async (req, res): Promise<void> => {
+router.put("/main/:id", requireAdminAuth, async (req, res): Promise<void> => {
   try {
     const id = parseInt(req.params.id);
     if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }
@@ -41,7 +42,7 @@ router.put("/main/:id", async (req, res): Promise<void> => {
   }
 });
 
-router.delete("/main/:id", async (req, res): Promise<void> => {
+router.delete("/main/:id", requireAdminAuth, async (req, res): Promise<void> => {
   try {
     const id = parseInt(req.params.id);
     if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }
@@ -67,7 +68,7 @@ router.get("/sub", async (req, res): Promise<void> => {
   }
 });
 
-router.post("/sub", async (req, res): Promise<void> => {
+router.post("/sub", requireAdminAuth, async (req, res): Promise<void> => {
   try {
     const { name, slug, description, imageUrl, mainCategoryId } = req.body;
     if (!name || !slug || !mainCategoryId) { res.status(400).json({ error: "name, slug, mainCategoryId required" }); return; }
@@ -79,7 +80,7 @@ router.post("/sub", async (req, res): Promise<void> => {
   }
 });
 
-router.put("/sub/:id", async (req, res): Promise<void> => {
+router.put("/sub/:id", requireAdminAuth, async (req, res): Promise<void> => {
   try {
     const id = parseInt(req.params.id);
     if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }
@@ -93,7 +94,7 @@ router.put("/sub/:id", async (req, res): Promise<void> => {
   }
 });
 
-router.delete("/sub/:id", async (req, res): Promise<void> => {
+router.delete("/sub/:id", requireAdminAuth, async (req, res): Promise<void> => {
   try {
     const id = parseInt(req.params.id);
     if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }
@@ -119,7 +120,7 @@ router.get("/child", async (req, res): Promise<void> => {
   }
 });
 
-router.post("/child", async (req, res): Promise<void> => {
+router.post("/child", requireAdminAuth, async (req, res): Promise<void> => {
   try {
     const { name, slug, description, imageUrl, subCategoryId } = req.body;
     if (!name || !slug || !subCategoryId) { res.status(400).json({ error: "name, slug, subCategoryId required" }); return; }
@@ -131,7 +132,7 @@ router.post("/child", async (req, res): Promise<void> => {
   }
 });
 
-router.put("/child/:id", async (req, res): Promise<void> => {
+router.put("/child/:id", requireAdminAuth, async (req, res): Promise<void> => {
   try {
     const id = parseInt(req.params.id);
     if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }
@@ -145,7 +146,7 @@ router.put("/child/:id", async (req, res): Promise<void> => {
   }
 });
 
-router.delete("/child/:id", async (req, res): Promise<void> => {
+router.delete("/child/:id", requireAdminAuth, async (req, res): Promise<void> => {
   try {
     const id = parseInt(req.params.id);
     if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }
diff --git a/artifacts/assam-bazaar/src/pages/admin/categories.tsx b/artifacts/assam-bazaar/src/pages/admin/categories.tsx
index 7d0d843..592ff76 100644
--- a/artifacts/assam-bazaar/src/pages/admin/categories.tsx
+++ b/artifacts/assam-bazaar/src/pages/admin/categories.tsx
@@ -7,6 +7,7 @@ import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "
 import { useToast } from "@/hooks/use-toast";
 import { Plus, Trash2, ChevronRight, ChevronDown } from "lucide-react";
 import { useQuery, useMutation } from "@tanstack/react-query";
+import { getAuthHeaders } from "@/lib/admin-auth";
 
 const API = "/api";
 
@@ -14,13 +15,38 @@ function toSlug(name: string) {
   return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
 }
 
+// Authenticated request helper: sends the admin JWT, throws on any non-2xx
+// response so the UI can show the real server error instead of a fake "success".
+async function api(path: string, init: RequestInit = {}) {
+  const res = await fetch(`${API}${path}`, {
+    ...init,
+    headers: {
+      "Content-Type": "application/json",
+      ...getAuthHeaders(),
+      ...(init.headers ?? {}),
+    },
+  });
+  if (!res.ok) {
+    let message = `Request failed (${res.status})`;
+    try {
+      const body = await res.json();
+      if (body?.error) message = typeof body.error === "string" ? body.error : body.error.message ?? message;
+    } catch { /* non-JSON response */ }
+    if (res.status === 401) message = "Session expired. Please log in again.";
+    throw new Error(message);
+  }
+  if (res.status === 204) return null;
+  return res.json();
+}
+
 function useCategoryTree() {
   return useQuery({
     queryKey: ["categories-tree"],
     queryFn: async () => {
-      const res = await fetch(`${API}/categories/tree`);
-      return res.json();
+      const data = await api("/categories/tree");
+      return Array.isArray(data) ? data : [];
     },
+    retry: 1,
   });
 }
 
@@ -58,7 +84,7 @@ function CategoryForm({ onSubmit, loading }: { onSubmit: (data: any) => void; lo
 export default function AdminCategories() {
   const { toast } = useToast();
   const queryClient = useQueryClient();
-  const { data: tree = [], isLoading } = useCategoryTree();
+  const { data: tree = [], isLoading, isError, error, refetch: reload } = useCategoryTree();
 
   const [dialog, setDialog] = useState<{ type: "main" | "sub" | "child"; parentId?: number; parentName?: string } | null>(null);
   const [expanded, setExpanded] = useState<Record<string, boolean>>({});
@@ -66,33 +92,39 @@ export default function AdminCategories() {
   const refetch = () => queryClient.invalidateQueries({ queryKey: ["categories-tree"] });
 
   const createMain = useMutation({
-    mutationFn: (data: any) => fetch(`${API}/categories/main`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }).then(r => r.json()),
+    mutationFn: (data: any) => api("/categories/main", { method: "POST", body: JSON.stringify(data) }),
     onSuccess: () => { refetch(); setDialog(null); toast({ title: "Main category created" }); },
+    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
   });
 
   const createSub = useMutation({
-    mutationFn: (data: any) => fetch(`${API}/categories/sub`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }).then(r => r.json()),
+    mutationFn: (data: any) => api("/categories/sub", { method: "POST", body: JSON.stringify(data) }),
     onSuccess: () => { refetch(); setDialog(null); toast({ title: "Sub category created" }); },
+    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
   });
 
   const createChild = useMutation({
-    mutationFn: (data: any) => fetch(`${API}/categories/child`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }).then(r => r.json()),
+    mutationFn: (data: any) => api("/categories/child", { method: "POST", body: JSON.stringify(data) }),
     onSuccess: () => { refetch(); setDialog(null); toast({ title: "Child category created" }); },
+    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
   });
 
   const deleteMain = useMutation({
-    mutationFn: (id: number) => fetch(`${API}/categories/main/${id}`, { method: "DELETE" }),
+    mutationFn: (id: number) => api(`/categories/main/${id}`, { method: "DELETE" }),
     onSuccess: () => { refetch(); toast({ title: "Deleted" }); },
+    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
   });
 
   const deleteSub = useMutation({
-    mutationFn: (id: number) => fetch(`${API}/categories/sub/${id}`, { method: "DELETE" }),
+    mutationFn: (id: number) => api(`/categories/sub/${id}`, { method: "DELETE" }),
     onSuccess: () => { refetch(); toast({ title: "Deleted" }); },
+    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
   });
 
   const deleteChild = useMutation({
-    mutationFn: (id: number) => fetch(`${API}/categories/child/${id}`, { method: "DELETE" }),
+    mutationFn: (id: number) => api(`/categories/child/${id}`, { method: "DELETE" }),
     onSuccess: () => { refetch(); toast({ title: "Deleted" }); },
+    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
   });
 
   function handleSubmit(data: any) {
@@ -118,7 +150,13 @@ export default function AdminCategories() {
         </Button>
       </div>
 
-      {isLoading ? (
+      {isError ? (
+        <div className="text-center py-20 space-y-3">
+          <p className="text-destructive font-medium">Could not load categories</p>
+          <p className="text-sm text-muted-foreground">{(error as Error)?.message}</p>
+          <Button variant="outline" onClick={() => reload()}>Try again</Button>
+        </div>
+      ) : isLoading ? (
         <div className="space-y-2">
           {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12 rounded-lg" />)}
         </div>
