import { and, desc, eq, gte, gt, inArray, lte, sql } from "drizzle-orm";
import { Router, type IRouter } from "express";
import {
  booksTable,
  categoriesTable,
  db,
  orderItemsTable,
  ordersTable,
  type Book,
} from "@workspace/db";
import type { OrderInput } from "@workspace/api-zod";
import {
  CreateOrderBody,
  CreateOrderResponse,
  GetBestsellersResponse,
  GetCatalogQueryParams,
  GetCatalogResponse,
  GetStoreSettingsResponse,
} from "@workspace/api-zod";
import {
  publicBook,
  publicCategory,
  publicSettings,
  publicWhatsAppNumber,
  readStoreSettings,
} from "../lib/storeData.js";

const router: IRouter = Router();
const orderAttempts = new Map<string, number[]>();
const ORDER_WINDOW_MS = 15 * 60 * 1000;
const ORDER_LIMIT = 6;

type BookWithCategory = {
  book: Book;
  categoryName: string | null;
};
type StoreTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

class OrderInputError extends Error {}

function allowedOrderAttempt(ip: string): boolean {
  const now = Date.now();
  const active = (orderAttempts.get(ip) ?? []).filter(
    (timestamp) => now - timestamp < ORDER_WINDOW_MS,
  );
  if (active.length >= ORDER_LIMIT) {
    orderAttempts.set(ip, active);
    return false;
  }
  active.push(now);
  orderAttempts.set(ip, active);
  return true;
}

function safePhone(value: string): string | null {
  const digits = value.replace(/\D/g, "");
  return digits.length >= 10 && digits.length <= 13 ? digits : null;
}

async function orderWithItems(orderId: number) {
  const [order] = await db
    .select()
    .from(ordersTable)
    .where(eq(ordersTable.id, orderId))
    .limit(1);
  if (!order) return null;
  const items = await db
    .select({
      bookId: orderItemsTable.bookId,
      title: orderItemsTable.title,
      author: orderItemsTable.author,
      quantity: orderItemsTable.quantity,
      unitPrice: orderItemsTable.unitPrice,
      subtotal: orderItemsTable.subtotal,
    })
    .from(orderItemsTable)
    .where(eq(orderItemsTable.orderId, orderId));
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    name: order.name,
    phone: order.phone,
    fulfillment: order.fulfillment,
    address: order.address,
    area: order.area,
    notes: order.notes,
    paymentPreference: order.paymentPreference,
    status: order.status,
    total: order.total,
    items,
    createdAt: order.createdAt,
  };
}

router.get("/storefront/catalog", async (req, res): Promise<void> => {
  const normalizedQuery = {
    ...req.query,
    availableOnly:
      req.query["availableOnly"] === "true"
        ? true
        : req.query["availableOnly"] === "false"
          ? false
          : undefined,
  };
  const parsed = GetCatalogQueryParams.safeParse(normalizedQuery);
  if (!parsed.success) {
    res.status(400).json({ error: "Los filtros del catálogo no son válidos." });
    return;
  }

  const query = parsed.data;
  const filters = [eq(booksTable.visible, true), eq(categoriesTable.visible, true)];
  if (query.search?.trim()) {
    const term = `%${query.search.trim().replace(/[%_]/g, "\\$&")}%`;
    filters.push(
      sql`(${booksTable.title} ILIKE ${term} OR ${booksTable.author} ILIKE ${term})` as never,
    );
  }
  if (query.categoryId != null) filters.push(eq(booksTable.categoryId, query.categoryId));
  if (query.availableOnly) filters.push(gt(booksTable.stock, 0));
  if (query.maxPrice != null) filters.push(lte(booksTable.price, query.maxPrice));

  const orderBy =
    query.sort === "price_asc"
      ? [booksTable.price]
      : query.sort === "price_desc"
        ? [desc(booksTable.price)]
        : query.sort === "newest"
          ? [desc(booksTable.createdAt)]
          : [desc(booksTable.featured), desc(booksTable.createdAt)];
  const [rows, categories] = await Promise.all([
    db
      .select({ book: booksTable, categoryName: categoriesTable.name })
      .from(booksTable)
      .leftJoin(categoriesTable, eq(booksTable.categoryId, categoriesTable.id))
      .where(and(...filters))
      .orderBy(...orderBy),
    db
      .select()
      .from(categoriesTable)
      .where(eq(categoriesTable.visible, true))
      .orderBy(categoriesTable.sortOrder),
  ]);
  const books = rows.map(({ book, categoryName }) => publicBook(book, categoryName));
  const response = GetCatalogResponse.parse({
    categories: categories.map(publicCategory),
    books,
    total: books.length,
    demo: books.some((book) => book.demo) || categories.some((category) => category.demo),
  });
  res.json(response);
});

router.get("/storefront/bestsellers", async (_req, res): Promise<void> => {
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const sales = await db
    .select({
      bookId: orderItemsTable.bookId,
      units: sql<number>`sum(${orderItemsTable.quantity})`.mapWith(Number),
    })
    .from(orderItemsTable)
    .innerJoin(ordersTable, eq(orderItemsTable.orderId, ordersTable.id))
    .where(
      and(
        gte(ordersTable.confirmedAt, weekAgo),
        inArray(ordersTable.status, ["confirmed", "delivered", "picked_up"]),
      ),
    )
    .groupBy(orderItemsTable.bookId)
    .orderBy(desc(sql`sum(${orderItemsTable.quantity})`))
    .limit(8);

  const useNovelties = sales.length === 0;
  const rows: BookWithCategory[] = useNovelties
    ? await db
        .select({ book: booksTable, categoryName: categoriesTable.name })
        .from(booksTable)
        .leftJoin(categoriesTable, eq(booksTable.categoryId, categoriesTable.id))
        .where(and(eq(booksTable.visible, true), gt(booksTable.stock, 0)))
        .orderBy(desc(booksTable.createdAt))
        .limit(8)
    : await db
        .select({ book: booksTable, categoryName: categoriesTable.name })
        .from(booksTable)
        .leftJoin(categoriesTable, eq(booksTable.categoryId, categoriesTable.id))
        .where(
          and(
            eq(booksTable.visible, true),
            inArray(
              booksTable.id,
              sales.map((sale) => sale.bookId),
            ),
          ),
        );

  const rankedRows = useNovelties
    ? rows
    : [...rows].sort(
        (a, b) =>
          sales.findIndex((sale) => sale.bookId === a.book.id) -
          sales.findIndex((sale) => sale.bookId === b.book.id),
      );
  res.json(
    GetBestsellersResponse.parse({
      books: rankedRows.map(({ book, categoryName }) => publicBook(book, categoryName)),
      usingNovelties: useNovelties,
    }),
  );
});

router.get("/storefront/settings", async (_req, res): Promise<void> => {
  const settings = await readStoreSettings();
  res.json(GetStoreSettingsResponse.parse(publicSettings(settings)));
});

router.post("/orders", async (req, res): Promise<void> => {
  const parsed = CreateOrderBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Revisá los datos del pedido e intentá de nuevo." });
    return;
  }
  if (!allowedOrderAttempt(req.ip ?? "unknown")) {
    res.status(429).json({ error: "Recibimos varios intentos. Esperá unos minutos y volvé a probar." });
    return;
  }

  const orderInput: OrderInput = parsed.data;
  const phone = safePhone(orderInput.phone);
  if (!phone) {
    res.status(400).json({ error: "Ingresá un WhatsApp argentino válido." });
    return;
  }
  if (
    orderInput.fulfillment === "delivery" &&
    (!orderInput.address?.trim() || !orderInput.area?.trim())
  ) {
    res.status(400).json({ error: "Para el envío necesitamos la dirección y el barrio o localidad." });
    return;
  }
  if (orderInput.items.some((item) => !Number.isSafeInteger(item.quantity) || item.quantity < 1)) {
    res.status(400).json({ error: "La cantidad de libros no es válida." });
    return;
  }

  const settings = await readStoreSettings();
  if (!settings.paymentMethods.includes(orderInput.paymentPreference)) {
    res.status(400).json({ error: "Elegí una forma de pago disponible." });
    return;
  }

  try {
    const orderId = await db.transaction(async (tx: StoreTransaction) => {
      const ids = orderInput.items.map((item) => item.bookId);
      if (new Set(ids).size !== ids.length) throw new OrderInputError("duplicate");
      const books: Book[] = await tx
        .select()
        .from(booksTable)
        .where(and(inArray(booksTable.id, ids), eq(booksTable.visible, true)));
      if (books.length !== ids.length) throw new OrderInputError("missing");
      const byId = new Map(books.map((book) => [book.id, book]));
      const lines = orderInput.items.map((line) => {
        const book = byId.get(line.bookId);
        if (!book || book.stock < line.quantity) throw new OrderInputError("stock");
        return {
          bookId: book.id,
          title: book.title,
          author: book.author,
          quantity: line.quantity,
          unitPrice: book.price,
          unitCost: book.cost,
          subtotal: book.price * line.quantity,
        };
      });
      const total = lines.reduce((sum, line) => sum + line.subtotal, 0);
      if (!Number.isSafeInteger(total)) throw new OrderInputError("total");
      const [created] = await tx
        .insert(ordersTable)
        .values({
          orderNumber: `new-${crypto.randomUUID()}`,
          name: orderInput.name.trim(),
          phone,
          fulfillment: orderInput.fulfillment,
          address: orderInput.fulfillment === "delivery" ? orderInput.address?.trim() ?? null : null,
          area: orderInput.fulfillment === "delivery" ? orderInput.area?.trim() ?? null : null,
          notes: orderInput.notes?.trim() || null,
          paymentPreference: orderInput.paymentPreference,
          status: "pending",
          total,
        })
        .returning({ id: ordersTable.id });
      await tx
        .update(ordersTable)
        .set({
          orderNumber: String(created.id).padStart(4, "0"),
          updatedAt: new Date(),
        })
        .where(eq(ordersTable.id, created.id));
      await tx.insert(orderItemsTable).values(
        lines.map((line) => ({ ...line, orderId: created.id })),
      );
      return created.id;
    });

    const order = await orderWithItems(orderId);
    if (!order) {
      res.status(500).json({ error: "No pudimos recuperar el pedido guardado." });
      return;
    }
    res.status(201).json(
      CreateOrderResponse.parse({
        order,
        whatsappNumber: publicWhatsAppNumber(settings.whatsappNumber),
      }),
    );
  } catch (error) {
    if (error instanceof OrderInputError) {
      const message =
        error.message === "stock"
          ? "Algún libro ya no tiene unidades suficientes. Actualizá el carrito."
          : error.message === "missing"
            ? "Uno de los libros ya no está disponible."
            : "El pedido contiene información repetida o inválida.";
      res.status(409).json({ error: message });
      return;
    }
    req.log.error({ err: error }, "Could not create order");
    res.status(500).json({ error: "No pudimos guardar el pedido. Probá de nuevo." });
  }
});

export default router;
