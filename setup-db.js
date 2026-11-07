const { Client } = require('pg');

if (!process.env.DATABASE_URL) { console.error('Set DATABASE_URL first'); process.exit(1); }
const client = new Client({
  connectionString: process.env.DATABASE_URL
});

async function setup() {
  await client.connect();
  console.log('Connected!');
  
  await client.query(`
    CREATE TABLE IF NOT EXISTS categories (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      description TEXT,
      image_url TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS products (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      description TEXT,
      price NUMERIC NOT NULL,
      image_url TEXT,
      category_id INTEGER,
      stock INTEGER DEFAULT 0,
      featured BOOLEAN DEFAULT FALSE,
      artisan TEXT,
      origin TEXT,
      rating NUMERIC DEFAULT 0,
      created_at TIMESTAMP DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS cart_items (
      id SERIAL PRIMARY KEY,
      session_id TEXT NOT NULL,
      product_id INTEGER NOT NULL,
      quantity INTEGER DEFAULT 1,
      created_at TIMESTAMP DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS wishlist_items (
      id SERIAL PRIMARY KEY,
      session_id TEXT NOT NULL,
      product_id INTEGER NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS orders (
      id SERIAL PRIMARY KEY,
      session_id TEXT,
      items JSONB NOT NULL,
      total NUMERIC NOT NULL,
      status TEXT DEFAULT 'pending',
      customer_name TEXT,
      customer_email TEXT,
      customer_phone TEXT,
      address TEXT,
      city TEXT,
      state TEXT,
      pincode TEXT,
      payment_method TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);
  
  console.log('All tables created successfully!');
  await client.end();
}

setup().catch(console.error);