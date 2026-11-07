/**
 * fix-apunbazar.js
 * Run: node fix-apunbazar.js
 * 
 * Fixes:
 * 1. Adds `images TEXT[]` column to products
 * 2. Adds `slug` column if missing (fixes /products/undefined)
 * 3. Seeds proper slug + multiple images for every product
 */

const { Client } = require('pg');

if (!process.env.DATABASE_URL) { console.error('Set DATABASE_URL first'); process.exit(1); }
const client = new Client({
  connectionString: process.env.DATABASE_URL
});

// Helper: make slug from name
function slugify(name) {
  return name.toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}

// Multiple Unsplash images per product category
const PRODUCT_IMAGES = {
  // Handloom / textiles
  handloom: [
    "https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=600&q=80",
    "https://images.unsplash.com/photo-1558769132-cb1aea458c5e?w=600&q=80",
    "https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=600&q=80",
  ],
  // Tea
  tea: [
    "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=600&q=80",
    "https://images.unsplash.com/photo-1544787219-7f47ccb76574?w=600&q=80",
    "https://images.unsplash.com/photo-1563822249366-3efb23b8e0c9?w=600&q=80",
  ],
  // Handicrafts / bamboo
  handicraft: [
    "https://images.unsplash.com/photo-1605000797499-95a51c5269ae?w=600&q=80",
    "https://images.unsplash.com/photo-1558171813-0c44dd95b3cf?w=600&q=80",
    "https://images.unsplash.com/photo-1513519245088-0e12902e5a38?w=600&q=80",
  ],
  // Organic food / rice / spices
  organic: [
    "https://images.unsplash.com/photo-1586201375761-83865001e31c?w=600&q=80",
    "https://images.unsplash.com/photo-1509358271058-acd22cc93898?w=600&q=80",
    "https://images.unsplash.com/photo-1596040033229-a9821ebd058d?w=600&q=80",
  ],
  // Bags / accessories
  bags: [
    "https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=600&q=80",
    "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=600&q=80",
    "https://images.unsplash.com/photo-1566150905458-1bf1fc113f0d?w=600&q=80",
  ],
  // Default fallback
  default: [
    "https://images.unsplash.com/photo-1560472354-b33ff0c44a43?w=600&q=80",
    "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600&q=80",
    "https://images.unsplash.com/photo-1491553895911-0055eca6402d?w=600&q=80",
  ],
};

function getImagesForProduct(name, categoryName) {
  const n = (name + ' ' + categoryName).toLowerCase();
  if (n.includes('tea') || n.includes('chai')) return PRODUCT_IMAGES.tea;
  if (n.includes('silk') || n.includes('mekhela') || n.includes('gamosa') || n.includes('handloom') || n.includes('textile') || n.includes('fabric') || n.includes('saree') || n.includes('sador')) return PRODUCT_IMAGES.handloom;
  if (n.includes('bamboo') || n.includes('craft') || n.includes('handicraft') || n.includes('cane') || n.includes('pottery') || n.includes('basket') || n.includes('mask')) return PRODUCT_IMAGES.handicraft;
  if (n.includes('rice') || n.includes('organic') || n.includes('spice') || n.includes('mustard') || n.includes('joha') || n.includes('food')) return PRODUCT_IMAGES.organic;
  if (n.includes('bag') || n.includes('jute') || n.includes('tote') || n.includes('sling')) return PRODUCT_IMAGES.bags;
  return PRODUCT_IMAGES.default;
}

async function run() {
  await client.connect();
  console.log('✅ Connected to database');

  // 1. Add images[] column if not exists
  await client.query(`
    ALTER TABLE products 
    ADD COLUMN IF NOT EXISTS images TEXT[] NOT NULL DEFAULT '{}';
  `);
  console.log('✅ images[] column ready');

  // 2. Fix slug — make sure every product has a proper slug
  //    First check if slug column exists and has data
  const { rows: products } = await client.query(`SELECT id, name, slug, image_url, category_id FROM products ORDER BY id`);
  console.log(`📦 Found ${products.length} products`);

  // Get categories for mapping
  const { rows: categories } = await client.query(`SELECT id, name FROM categories`);
  const catMap = {};
  categories.forEach(c => { catMap[c.id] = c.name; });

  let fixedSlugs = 0;
  let fixedImages = 0;

  for (const p of products) {
    const updates = [];
    const values = [];
    let idx = 1;

    // Fix slug if missing or 'undefined'
    if (!p.slug || p.slug === 'undefined' || p.slug === '') {
      const newSlug = slugify(p.name) + '-' + p.id;
      updates.push(`slug = $${idx++}`);
      values.push(newSlug);
      fixedSlugs++;
    }

    // Set images array
    const catName = catMap[p.category_id] || '';
    const imgs = getImagesForProduct(p.name, catName);
    // Use existing image_url as first if it looks like a real URL
    let finalImgs = imgs;
    if (p.image_url && p.image_url.startsWith('http')) {
      finalImgs = [p.image_url, imgs[1] || imgs[0], imgs[2] || imgs[0]];
    }
    updates.push(`images = $${idx++}`);
    values.push(finalImgs);
    fixedImages++;

    if (updates.length > 0) {
      values.push(p.id);
      await client.query(
        `UPDATE products SET ${updates.join(', ')} WHERE id = $${idx}`,
        values
      );
    }
  }

  console.log(`✅ Fixed slugs: ${fixedSlugs} products`);
  console.log(`✅ Set images[]: ${fixedImages} products`);

  // 3. Verify
  const { rows: sample } = await client.query(`SELECT id, name, slug, array_length(images,1) as img_count FROM products LIMIT 5`);
  console.log('\n📋 Sample check:');
  sample.forEach(p => console.log(`  [${p.id}] ${p.name} | slug: ${p.slug} | images: ${p.img_count}`));

  await client.end();
  console.log('\n🎉 All done! Restart your API server now.');
}

run().catch(e => { console.error('❌ Error:', e.message); process.exit(1); });
