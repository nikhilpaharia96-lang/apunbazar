import { Router, type IRouter } from "express";
import { db, mainCategoriesTable, subCategoriesTable, childCategoriesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAdminAuth } from "../middleware/admin-auth";

const router: IRouter = Router();

// ── Main Categories ───────────────────────────────────────────────────────────
router.get("/main", async (_req, res): Promise<void> => {
  try {
    const items = await db.select().from(mainCategoriesTable);
    res.json(items);
  } catch (err) {
    console.error("GET /categories/main error:", err);
    res.status(500).json({ error: "Failed to fetch categories" });
  }
});

router.post("/main", requireAdminAuth, async (req, res): Promise<void> => {
  try {
    const { name, slug, description, imageUrl } = req.body;
    if (!name || !slug) { res.status(400).json({ error: "name and slug required" }); return; }
    const [item] = await db.insert(mainCategoriesTable).values({ name, slug, description, imageUrl }).returning();
    res.status(201).json(item);
  } catch (err) {
    console.error("POST /categories/main error:", err);
    res.status(500).json({ error: "Failed to create category" });
  }
});

router.put("/main/:id", requireAdminAuth, async (req, res): Promise<void> => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }
    const { name, slug, description, imageUrl } = req.body;
    const [item] = await db.update(mainCategoriesTable).set({ name, slug, description, imageUrl }).where(eq(mainCategoriesTable.id, id)).returning();
    if (!item) { res.status(404).json({ error: "Category not found" }); return; }
    res.json(item);
  } catch (err) {
    console.error("PUT /categories/main/:id error:", err);
    res.status(500).json({ error: "Failed to update category" });
  }
});

router.delete("/main/:id", requireAdminAuth, async (req, res): Promise<void> => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }
    await db.delete(mainCategoriesTable).where(eq(mainCategoriesTable.id, id));
    res.status(204).send();
  } catch (err) {
    console.error("DELETE /categories/main/:id error:", err);
    res.status(500).json({ error: "Failed to delete category" });
  }
});

// ── Sub Categories ────────────────────────────────────────────────────────────
router.get("/sub", async (req, res): Promise<void> => {
  try {
    const mainId = req.query.mainCategoryId ? parseInt(req.query.mainCategoryId as string) : null;
    const items = mainId
      ? await db.select().from(subCategoriesTable).where(eq(subCategoriesTable.mainCategoryId, mainId))
      : await db.select().from(subCategoriesTable);
    res.json(items);
  } catch (err) {
    console.error("GET /categories/sub error:", err);
    res.status(500).json({ error: "Failed to fetch sub-categories" });
  }
});

router.post("/sub", requireAdminAuth, async (req, res): Promise<void> => {
  try {
    const { name, slug, description, imageUrl, mainCategoryId } = req.body;
    if (!name || !slug || !mainCategoryId) { res.status(400).json({ error: "name, slug, mainCategoryId required" }); return; }
    const [item] = await db.insert(subCategoriesTable).values({ name, slug, description, imageUrl, mainCategoryId }).returning();
    res.status(201).json(item);
  } catch (err) {
    console.error("POST /categories/sub error:", err);
    res.status(500).json({ error: "Failed to create sub-category" });
  }
});

router.put("/sub/:id", requireAdminAuth, async (req, res): Promise<void> => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }
    const { name, slug, description, imageUrl, mainCategoryId } = req.body;
    const [item] = await db.update(subCategoriesTable).set({ name, slug, description, imageUrl, mainCategoryId }).where(eq(subCategoriesTable.id, id)).returning();
    if (!item) { res.status(404).json({ error: "Sub-category not found" }); return; }
    res.json(item);
  } catch (err) {
    console.error("PUT /categories/sub/:id error:", err);
    res.status(500).json({ error: "Failed to update sub-category" });
  }
});

router.delete("/sub/:id", requireAdminAuth, async (req, res): Promise<void> => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }
    await db.delete(subCategoriesTable).where(eq(subCategoriesTable.id, id));
    res.status(204).send();
  } catch (err) {
    console.error("DELETE /categories/sub/:id error:", err);
    res.status(500).json({ error: "Failed to delete sub-category" });
  }
});

// ── Child Categories ──────────────────────────────────────────────────────────
router.get("/child", async (req, res): Promise<void> => {
  try {
    const subId = req.query.subCategoryId ? parseInt(req.query.subCategoryId as string) : null;
    const items = subId
      ? await db.select().from(childCategoriesTable).where(eq(childCategoriesTable.subCategoryId, subId))
      : await db.select().from(childCategoriesTable);
    res.json(items);
  } catch (err) {
    console.error("GET /categories/child error:", err);
    res.status(500).json({ error: "Failed to fetch child categories" });
  }
});

router.post("/child", requireAdminAuth, async (req, res): Promise<void> => {
  try {
    const { name, slug, description, imageUrl, subCategoryId } = req.body;
    if (!name || !slug || !subCategoryId) { res.status(400).json({ error: "name, slug, subCategoryId required" }); return; }
    const [item] = await db.insert(childCategoriesTable).values({ name, slug, description, imageUrl, subCategoryId }).returning();
    res.status(201).json(item);
  } catch (err) {
    console.error("POST /categories/child error:", err);
    res.status(500).json({ error: "Failed to create child category" });
  }
});

router.put("/child/:id", requireAdminAuth, async (req, res): Promise<void> => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }
    const { name, slug, description, imageUrl, subCategoryId } = req.body;
    const [item] = await db.update(childCategoriesTable).set({ name, slug, description, imageUrl, subCategoryId }).where(eq(childCategoriesTable.id, id)).returning();
    if (!item) { res.status(404).json({ error: "Child category not found" }); return; }
    res.json(item);
  } catch (err) {
    console.error("PUT /categories/child/:id error:", err);
    res.status(500).json({ error: "Failed to update child category" });
  }
});

router.delete("/child/:id", requireAdminAuth, async (req, res): Promise<void> => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }
    await db.delete(childCategoriesTable).where(eq(childCategoriesTable.id, id));
    res.status(204).send();
  } catch (err) {
    console.error("DELETE /categories/child/:id error:", err);
    res.status(500).json({ error: "Failed to delete child category" });
  }
});

// ── Category Tree (navbar mega-menu) ─────────────────────────────────────────
router.get("/tree", async (_req, res): Promise<void> => {
  try {
    const [mains, subs, children] = await Promise.all([
      db.select().from(mainCategoriesTable),
      db.select().from(subCategoriesTable),
      db.select().from(childCategoriesTable),
    ]);

    const tree = mains.map((m) => ({
      ...m,
      subCategories: subs
        .filter((s) => s.mainCategoryId === m.id)
        .map((s) => ({
          ...s,
          childCategories: children.filter((c) => c.subCategoryId === s.id),
        })),
    }));

    res.json(tree);
  } catch (err) {
    console.error("GET /categories/tree error:", err);
    res.status(500).json({ error: "Failed to build category tree" });
  }
});

// GET /categories — flat list (used by product filter dropdowns)
router.get("/", async (_req, res): Promise<void> => {
  const items = await db.select().from(mainCategoriesTable);
  res.json(items);
});


export default router;
