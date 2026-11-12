import {
  boolean,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const categoriesTable = pgTable("nico_categories", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description").notNull().default(""),
  sortOrder: integer("sort_order").notNull().default(0),
  visible: boolean("visible").notNull().default(true),
  demo: boolean("demo").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const booksTable = pgTable("nico_books", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  author: text("author").notNull(),
  description: text("description").notNull().default(""),
  synopsis: text("synopsis").notNull().default(""),
  categoryId: integer("category_id").references(() => categoriesTable.id, {
    onDelete: "set null",
  }),
  price: integer("price").notNull().default(0),
  cost: integer("cost").notNull().default(0),
  stock: integer("stock").notNull().default(0),
  stockZeroAt: timestamp("stock_zero_at", { withTimezone: true }),
  featured: boolean("featured").notNull().default(false),
  visible: boolean("visible").notNull().default(true),
  demo: boolean("demo").notNull().default(false),
  coverUrl: text("cover_url"),
  extraImages: text("extra_images")
    .array()
    .notNull()
    .default(sql`ARRAY[]::text[]`),
  videoUrl: text("video_url"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const ordersTable = pgTable("nico_orders", {
  id: serial("id").primaryKey(),
  orderNumber: text("order_number").notNull().unique(),
  name: text("name").notNull(),
  phone: text("phone").notNull(),
  fulfillment: text("fulfillment").notNull(),
  address: text("address"),
  area: text("area"),
  notes: text("notes"),
  paymentPreference: text("payment_preference").notNull(),
  status: text("status").notNull().default("pending"),
  total: integer("total").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const orderItemsTable = pgTable("nico_order_items", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id")
    .notNull()
    .references(() => ordersTable.id, { onDelete: "cascade" }),
  bookId: integer("book_id")
    .notNull()
    .references(() => booksTable.id, { onDelete: "restrict" }),
  title: text("title").notNull(),
  author: text("author").notNull(),
  quantity: integer("quantity").notNull(),
  unitPrice: integer("unit_price").notNull(),
  unitCost: integer("unit_cost").notNull().default(0),
  subtotal: integer("subtotal").notNull(),
});

export const inventoryPurchasesTable = pgTable("nico_inventory_purchases", {
  id: serial("id").primaryKey(),
  bookId: integer("book_id")
    .notNull()
    .references(() => booksTable.id, { onDelete: "restrict" }),
  quantity: integer("quantity").notNull(),
  unitCost: integer("unit_cost").notNull(),
  supplier: text("supplier").notNull().default(""),
  notes: text("notes").notNull().default(""),
  purchasedAt: timestamp("purchased_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const financeExpensesTable = pgTable("nico_finance_expenses", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  category: text("category").notNull(),
  amount: integer("amount").notNull(),
  notes: text("notes").notNull().default(""),
  incurredAt: timestamp("incurred_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const storeSettingsTable = pgTable("nico_store_settings", {
  id: serial("id").primaryKey(),
  heroTitle: text("hero_title").notNull(),
  heroSubtitle: text("hero_subtitle").notNull(),
  story: text("story").notNull(),
  whatsappNumber: text("whatsapp_number").notNull(),
  greetingMessage: text("greeting_message").notNull(),
  address: text("address").notNull().default(""),
  openingHours: text("opening_hours").notNull().default(""),
  mapsUrl: text("maps_url").notNull().default(""),
  instagram: text("instagram").notNull().default(""),
  facebook: text("facebook").notNull().default(""),
  tiktok: text("tiktok").notNull().default(""),
  creditLink: text("credit_link").notNull().default(""),
  deliveryInfo: text("delivery_info").notNull().default(""),
  pickupAddress: text("pickup_address").notNull().default(""),
  pickupHours: text("pickup_hours").notNull().default(""),
  paymentMethods: jsonb("payment_methods")
    .$type<string[]>()
    .notNull()
    .default(sql`'["cash","transfer","coordinate"]'::jsonb`),
  lowStockThreshold: integer("low_stock_threshold").notNull().default(3),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type Category = typeof categoriesTable.$inferSelect;
export type Book = typeof booksTable.$inferSelect;
export type Order = typeof ordersTable.$inferSelect;
export type OrderItem = typeof orderItemsTable.$inferSelect;
export type InventoryPurchase = typeof inventoryPurchasesTable.$inferSelect;
export type FinanceExpense = typeof financeExpensesTable.$inferSelect;
export type StoreSettings = typeof storeSettingsTable.$inferSelect;
