import bcrypt from "bcryptjs";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { and, asc, desc, eq, gte, gt, inArray, lt, lte, sql } from "drizzle-orm";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import express, { Router, type IRouter } from "express";
import {
  booksTable,
  categoriesTable,
  db,
  financeExpensesTable,
  inventoryPurchasesTable,
  orderItemsTable,
  ordersTable,
  storeSettingsTable,
} from "@workspace/db";
import {
  AdminLoginBody,
  AdminLoginResponse,
  ArchiveBookParams,
  ArchiveCategoryParams,
  CreateBookBody,
  CreateBookResponse,
  CreateCategoryBody,
  CreateCategoryResponse,
  CreateFinanceExpenseBody,
  CreateFinanceExpenseResponse,
  CreateInventoryPurchaseBody,
  CreateInventoryPurchaseResponse,
  GetAdminReportResponse,
  GetAdminBooksResponse,
  GetAdminCategoriesResponse,
  GetAdminDashboardResponse,
  GetAdminOrdersResponse,
  GetAdminSessionResponse,
  GetAdminSettingsResponse,
  UpdateBookBody,
  UpdateBookParams,
  UpdateBookResponse,
  UpdateCategoryBody,
  UpdateCategoryParams,
  UpdateCategoryResponse,
  UpdateOrderStatusBody,
  UpdateOrderStatusParams,
  UpdateOrderStatusResponse,
  UpdateStoreSettingsBody,
  UpdateStoreSettingsResponse,
} from "@workspace/api-zod";
import {
  adminBook,
  publicCategory,
  publicSettings,
  readStoreSettings,
} from "../lib/storeData.js";
import {
  clearAdminSession,
  configuredAdminEmail,
  getAdminEmail,
  requireAdmin,
  setAdminSession,
} from "../lib/adminAuth.js";
import { mediaUploadDir } from "../lib/mediaStorage.js";

const router: IRouter = Router();
const loginAttempts = new Map<string, number[]>();
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_LIMIT = 8;
const mediaFormats = {
  "image/jpeg": { extension: "jpg", maxBytes: 10 * 1024 * 1024 },
  "image/png": { extension: "png", maxBytes: 10 * 1024 * 1024 },
  "image/webp": { extension: "webp", maxBytes: 10 * 1024 * 1024 },
  "image/gif": { extension: "gif", maxBytes: 10 * 1024 * 1024 },
  "video/mp4": { extension: "mp4", maxBytes: 50 * 1024 * 1024 },
  "video/webm": { extension: "webm", maxBytes: 50 * 1024 * 1024 },
  "video/quicktime": { extension: "mov", maxBytes: 50 * 1024 * 1024 },
} as const;
type MediaMimeType = keyof typeof mediaFormats;
const coverMimeTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;
const videoMimeTypes = ["video/mp4", "video/webm", "video/quicktime"] as const;

class StockTransitionError extends Error {}
class StockCapacityError extends Error {}

function isMediaMimeType(value: string): value is MediaMimeType {
  return Object.prototype.hasOwnProperty.call(mediaFormats, value);
}

function isHandleUploadBody(value: unknown): value is HandleUploadBody {
  if (typeof value !== "object" || value === null) return false;
  const body = value as Record<string, unknown>;
  const payload = body["payload"];
  if (typeof payload !== "object" || payload === null) return false;
  const details = payload as Record<string, unknown>;

  if (body["type"] === "blob.generate-client-token") {
    return (
      typeof details["pathname"] === "string" &&
      typeof details["multipart"] === "boolean" &&
      (details["clientPayload"] === null || typeof details["clientPayload"] === "string")
    );
  }
  return body["type"] === "blob.upload-completed";
}

function vercelUploadPolicy(pathname: string, clientPayload: string | null) {
  const extension = pathname.match(/^catalog\/[0-9a-f-]{36}\.([a-z0-9]+)$/i)?.[1]?.toLowerCase();
  if (!extension) return null;

  const mimeType = Object.entries(mediaFormats).find(
    ([, format]) => format.extension === extension,
  )?.[0];
  if (!mimeType) return null;

  if (clientPayload === "cover" && mimeType.startsWith("image/")) {
    return {
      allowedContentTypes: [...coverMimeTypes],
      maximumSizeInBytes: 10 * 1024 * 1024,
      addRandomSuffix: true,
    };
  }
  if (clientPayload === "video" && mimeType.startsWith("video/")) {
    return {
      allowedContentTypes: [...videoMimeTypes],
      maximumSizeInBytes: 50 * 1024 * 1024,
      addRandomSuffix: true,
    };
  }
  return null;
}

function hasValidMediaSignature(buffer: Buffer, mimeType: MediaMimeType): boolean {
  switch (mimeType) {
    case "image/jpeg":
      return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
    case "image/png":
      return buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    case "image/webp":
      return buffer.length >= 12 && buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP";
    case "image/gif":
      return buffer.length >= 6 && ["GIF87a", "GIF89a"].includes(buffer.toString("ascii", 0, 6));
    case "video/mp4":
    case "video/quicktime":
      return buffer.length >= 12 && buffer.toString("ascii", 4, 8) === "ftyp";
    case "video/webm":
      return buffer.length >= 4 && buffer.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]));
  }
}

function isAllowedLogin(ip: string): boolean {
  const now = Date.now();
  const active = (loginAttempts.get(ip) ?? []).filter(
    (timestamp) => now - timestamp < LOGIN_WINDOW_MS,
  );
  if (active.length >= LOGIN_LIMIT) {
    loginAttempts.set(ip, active);
    return false;
  }
  active.push(now);
  loginAttempts.set(ip, active);
  return true;
}

function routeId(value: string | string[] | undefined): number | null {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw || !/^\d+$/.test(raw)) return null;
  const id = Number(raw);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

async function getAdminBook(id: number) {
  const [row] = await db
    .select({ book: booksTable, categoryName: categoriesTable.name })
    .from(booksTable)
    .leftJoin(categoriesTable, eq(booksTable.categoryId, categoriesTable.id))
    .where(eq(booksTable.id, id))
    .limit(1);
  return row ? adminBook(row.book, row.categoryName) : null;
}

async function getOrder(id: number) {
  const [order] = await db
    .select()
    .from(ordersTable)
    .where(eq(ordersTable.id, id))
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
    .where(eq(orderItemsTable.orderId, id));
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

router.post("/admin/login", async (req, res): Promise<void> => {
  const parsed = AdminLoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Ingresá un correo y una contraseña válidos." });
    return;
  }
  if (!isAllowedLogin(req.ip ?? "unknown")) {
    res.status(429).json({ error: "Demasiados intentos. Esperá unos minutos y probá otra vez." });
    return;
  }
  const email = configuredAdminEmail();
  const passwordHash = process.env["ADMIN_PASSWORD_HASH"];
  if (!email || !passwordHash || !process.env["SESSION_SECRET"]) {
    res.status(503).json({ error: "El acceso del administrador todavía no está configurado." });
    return;
  }
  const emailMatches = parsed.data.email.trim().toLowerCase() === email;
  const passwordMatches = await bcrypt.compare(parsed.data.password, passwordHash);
  if (!emailMatches || !passwordMatches) {
    req.log.warn({ ip: req.ip }, "Rejected admin login");
    res.status(401).json({ error: "El correo o la contraseña no coinciden." });
    return;
  }
  setAdminSession(res, email);
  res.json(AdminLoginResponse.parse({ authenticated: true, email }));
});

router.get("/admin/session", (req, res): void => {
  const email = getAdminEmail(req);
  res.json(
    GetAdminSessionResponse.parse({
      authenticated: Boolean(email),
      email: email ?? "",
    }),
  );
});

router.delete("/admin/session", (_req, res): void => {
  clearAdminSession(res);
  res.sendStatus(204);
});

router.post("/admin/media-token", async (req, res): Promise<void> => {
  const body: unknown = req.body;
  if (!isHandleUploadBody(body)) {
    res.status(400).json({ error: "La solicitud de carga no es válida." });
    return;
  }

  if (body.type === "blob.generate-client-token") {
    if (!getAdminEmail(req)) {
      res.status(401).json({ error: "Iniciá sesión para continuar." });
      return;
    }
    if (!vercelUploadPolicy(body.payload.pathname, body.payload.clientPayload)) {
      res.status(415).json({ error: "El archivo o el formato no está permitido." });
      return;
    }
  }

  if (!process.env["BLOB_READ_WRITE_TOKEN"]) {
    res.status(503).json({ error: "La carga en la nube todavía no está configurada." });
    return;
  }

  const result = await handleUpload({
    body,
    request: req,
    onBeforeGenerateToken: async (pathname, clientPayload) => {
      const policy = vercelUploadPolicy(pathname, clientPayload);
      if (!policy) {
        throw new Error("El archivo o el formato no está permitido.");
      }
      return policy;
    },
  });
  res.json(result);
});

router.use("/admin", requireAdmin);

router.post(
  "/admin/media",
  (req, res, next) => {
    if (process.env["VERCEL"] === "1") {
      res.status(410).json({ error: "Usá la carga directa de medios en la nube." });
      return;
    }
    express.raw({ type: Object.keys(mediaFormats), limit: "50mb" })(req, res, next);
  },
  async (req, res): Promise<void> => {
    const mimeType = (req.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
    if (!isMediaMimeType(mimeType)) {
      res.status(415).json({ error: "Formato no compatible. Usá JPG, PNG, WebP, GIF, MP4, WebM o MOV." });
      return;
    }

    const buffer = req.body;
    if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
      res.status(400).json({ error: "No recibimos ningún archivo." });
      return;
    }
    const format = mediaFormats[mimeType];
    if (buffer.length > format.maxBytes) {
      const maxSize = format.maxBytes / (1024 * 1024);
      res.status(413).json({ error: `El archivo supera el límite de ${maxSize} MB.` });
      return;
    }
    if (!hasValidMediaSignature(buffer, mimeType)) {
      res.status(415).json({ error: "El archivo no coincide con el formato declarado." });
      return;
    }

    await mkdir(mediaUploadDir, { recursive: true });
    const filename = `${randomUUID()}.${format.extension}`;
    await writeFile(path.join(mediaUploadDir, filename), buffer, { flag: "wx", mode: 0o644 });
    res.status(201).json({ url: `/api/uploads/${filename}` });
  },
);

router.get("/admin/dashboard", async (_req, res): Promise<void> => {
  const now = new Date();
  const dayAgo = new Date(now);
  dayAgo.setHours(0, 0, 0, 0);
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const monthAgo = new Date(now.getFullYear(), now.getMonth(), 1);
  const salesStatuses = ["confirmed", "delivered", "picked_up"];

  async function unitsSince(start: Date) {
    const [result] = await db
      .select({ units: sql<number>`coalesce(sum(${orderItemsTable.quantity}), 0)`.mapWith(Number) })
      .from(orderItemsTable)
      .innerJoin(ordersTable, eq(orderItemsTable.orderId, ordersTable.id))
      .where(
        and(
          gte(ordersTable.confirmedAt, start),
          inArray(ordersTable.status, salesStatuses),
        ),
      );
    return result?.units ?? 0;
  }

  const [
    salesToday,
    salesWeek,
    salesMonth,
    revenueRows,
    pendingRows,
    settings,
    lowRows,
    outRows,
    topBooks,
  ] = await Promise.all([
    unitsSince(dayAgo),
    unitsSince(weekAgo),
    unitsSince(monthAgo),
    db
      .select({ revenue: sql<number>`coalesce(sum(${ordersTable.total}), 0)`.mapWith(Number) })
      .from(ordersTable)
      .where(
        and(
          gte(ordersTable.confirmedAt, monthAgo),
          inArray(ordersTable.status, salesStatuses),
        ),
      ),
    db
      .select({ count: sql<number>`count(*)`.mapWith(Number) })
      .from(ordersTable)
      .where(eq(ordersTable.status, "pending")),
    readStoreSettings(),
    db
      .select({ count: sql<number>`count(*)`.mapWith(Number) })
      .from(booksTable)
      .where(
        and(
          eq(booksTable.visible, true),
          gt(booksTable.stock, 0),
          lte(booksTable.stock, (await readStoreSettings()).lowStockThreshold),
        ),
      ),
    db
      .select({ count: sql<number>`count(*)`.mapWith(Number) })
      .from(booksTable)
      .where(and(eq(booksTable.visible, true), eq(booksTable.stock, 0))),
    db
      .select({
        title: orderItemsTable.title,
        units: sql<number>`sum(${orderItemsTable.quantity})`.mapWith(Number),
      })
      .from(orderItemsTable)
      .innerJoin(ordersTable, eq(orderItemsTable.orderId, ordersTable.id))
      .where(
        and(
          gte(ordersTable.confirmedAt, weekAgo),
          inArray(ordersTable.status, salesStatuses),
        ),
      )
      .groupBy(orderItemsTable.title)
      .orderBy(desc(sql`sum(${orderItemsTable.quantity})`))
      .limit(5),
  ]);

  res.json(
    GetAdminDashboardResponse.parse({
      salesToday,
      salesWeek,
      salesMonth,
      revenueMonth: revenueRows[0]?.revenue ?? 0,
      pendingOrders: pendingRows[0]?.count ?? 0,
      lowStockCount: lowRows[0]?.count ?? 0,
      outOfStockCount: outRows[0]?.count ?? 0,
      topBooks,
    }),
  );
});

router.get("/admin/reports", async (req, res): Promise<void> => {
  const fromValue = req.query["from"];
  const toValue = req.query["to"];
  const from = typeof fromValue === "string" ? new Date(fromValue) : null;
  const to = typeof toValue === "string" ? new Date(toValue) : null;
  if (
    !from ||
    !to ||
    Number.isNaN(from.getTime()) ||
    Number.isNaN(to.getTime()) ||
    from >= to
  ) {
    res.status(400).json({ error: "El período del informe no es válido." });
    return;
  }

  const confirmedSales = and(
    gte(ordersTable.confirmedAt, from),
    lt(ordersTable.confirmedAt, to),
    inArray(ordersTable.status, ["confirmed", "delivered", "picked_up"]),
  );
  const duration = to.getTime() - from.getTime();
  const timelineUnit = duration <= 24 * 60 * 60 * 1000
    ? "hour"
    : duration <= 62 * 24 * 60 * 60 * 1000
      ? "day"
      : "month";
  const timelineFormat = timelineUnit === "hour"
    ? "YYYY-MM-DD HH24:MI"
    : timelineUnit === "day"
      ? "YYYY-MM-DD"
      : "YYYY-MM";
  const grain = sql.raw(`'${timelineUnit}'`);
  const format = sql.raw(`'${timelineFormat}'`);
  const salesBucket = sql<string>`to_char(date_trunc(${grain}, ${ordersTable.confirmedAt} AT TIME ZONE 'America/Argentina/Cordoba'), ${format})`;
  const purchaseBucket = sql<string>`to_char(date_trunc(${grain}, ${inventoryPurchasesTable.purchasedAt} AT TIME ZONE 'America/Argentina/Cordoba'), ${format})`;
  const expenseBucket = sql<string>`to_char(date_trunc(${grain}, ${financeExpensesTable.incurredAt} AT TIME ZONE 'America/Argentina/Cordoba'), ${format})`;
  const [
    salesSummary,
    salesOrderCount,
    purchaseSummary,
    expenseSummary,
    topBooks,
    slowBooks,
    purchaseRows,
    expenseRows,
    salesTimeline,
    purchaseTimeline,
    expenseTimeline,
    categorySales,
    categories,
  ] = await Promise.all([
    db
      .select({
        units: sql<number>`coalesce(sum(${orderItemsTable.quantity}), 0)`.mapWith(Number),
        revenue: sql<number>`coalesce(sum(${orderItemsTable.subtotal}), 0)`.mapWith(Number),
        costOfGoods: sql<number>`coalesce(sum(${orderItemsTable.unitCost}::bigint * ${orderItemsTable.quantity}::bigint), 0)`.mapWith(Number),
      })
      .from(orderItemsTable)
      .innerJoin(ordersTable, eq(orderItemsTable.orderId, ordersTable.id))
      .where(confirmedSales),
    db
      .select({ count: sql<number>`count(*)`.mapWith(Number) })
      .from(ordersTable)
      .where(confirmedSales),
    db
      .select({
        units: sql<number>`coalesce(sum(${inventoryPurchasesTable.quantity}), 0)`.mapWith(Number),
        count: sql<number>`count(*)`.mapWith(Number),
        spend: sql<number>`coalesce(sum(${inventoryPurchasesTable.unitCost}::bigint * ${inventoryPurchasesTable.quantity}::bigint), 0)`.mapWith(Number),
      })
      .from(inventoryPurchasesTable)
      .where(
        and(
          gte(inventoryPurchasesTable.purchasedAt, from),
          lt(inventoryPurchasesTable.purchasedAt, to),
        ),
      ),
    db
      .select({
        count: sql<number>`count(*)`.mapWith(Number),
        spend: sql<number>`coalesce(sum(${financeExpensesTable.amount}), 0)`.mapWith(Number),
      })
      .from(financeExpensesTable)
      .where(
        and(
          gte(financeExpensesTable.incurredAt, from),
          lt(financeExpensesTable.incurredAt, to),
        ),
      ),
    db
      .select({
        bookId: orderItemsTable.bookId,
        title: orderItemsTable.title,
        units: sql<number>`sum(${orderItemsTable.quantity})`.mapWith(Number),
        stock: sql<number>`coalesce(${booksTable.stock}, 0)`.mapWith(Number),
        revenue: sql<number>`sum(${orderItemsTable.subtotal})`.mapWith(Number),
      })
      .from(orderItemsTable)
      .innerJoin(ordersTable, eq(orderItemsTable.orderId, ordersTable.id))
      .leftJoin(booksTable, eq(orderItemsTable.bookId, booksTable.id))
      .where(confirmedSales)
      .groupBy(orderItemsTable.bookId, orderItemsTable.title, booksTable.stock)
      .orderBy(desc(sql`sum(${orderItemsTable.quantity})`))
      .limit(8),
    (() => {
      const periodSales = db
        .select({
          bookId: orderItemsTable.bookId,
          units: sql<number>`sum(${orderItemsTable.quantity})`.mapWith(Number).as("units"),
          revenue: sql<number>`sum(${orderItemsTable.subtotal})`.mapWith(Number).as("revenue"),
        })
        .from(orderItemsTable)
        .innerJoin(ordersTable, eq(orderItemsTable.orderId, ordersTable.id))
        .where(confirmedSales)
        .groupBy(orderItemsTable.bookId)
        .as("period_sales");
      return db
        .select({
          bookId: booksTable.id,
          title: booksTable.title,
          units: sql<number>`coalesce(${periodSales.units}, 0)`.mapWith(Number),
          stock: booksTable.stock,
          revenue: sql<number>`coalesce(${periodSales.revenue}, 0)`.mapWith(Number),
        })
        .from(booksTable)
        .leftJoin(periodSales, eq(periodSales.bookId, booksTable.id))
        .where(and(eq(booksTable.visible, true), gt(booksTable.stock, 0)))
        .orderBy(
          asc(sql`coalesce(${periodSales.units}, 0)`),
          desc(booksTable.stock),
          asc(booksTable.title),
        )
        .limit(8);
    })(),
    db
      .select({
        id: inventoryPurchasesTable.id,
        bookId: inventoryPurchasesTable.bookId,
        bookTitle: booksTable.title,
        quantity: inventoryPurchasesTable.quantity,
        unitCost: inventoryPurchasesTable.unitCost,
        supplier: inventoryPurchasesTable.supplier,
        notes: inventoryPurchasesTable.notes,
        purchasedAt: inventoryPurchasesTable.purchasedAt,
      })
      .from(inventoryPurchasesTable)
      .innerJoin(booksTable, eq(inventoryPurchasesTable.bookId, booksTable.id))
      .where(
        and(
          gte(inventoryPurchasesTable.purchasedAt, from),
          lt(inventoryPurchasesTable.purchasedAt, to),
        ),
      )
      .orderBy(desc(inventoryPurchasesTable.purchasedAt))
      .limit(100),
    db
      .select({
        id: financeExpensesTable.id,
        title: financeExpensesTable.title,
        category: financeExpensesTable.category,
        amount: financeExpensesTable.amount,
        notes: financeExpensesTable.notes,
        incurredAt: financeExpensesTable.incurredAt,
      })
      .from(financeExpensesTable)
      .where(
        and(
          gte(financeExpensesTable.incurredAt, from),
          lt(financeExpensesTable.incurredAt, to),
        ),
      )
      .orderBy(desc(financeExpensesTable.incurredAt))
      .limit(100),
    db
      .select({
        bucket: salesBucket,
        units: sql<number>`sum(${orderItemsTable.quantity})`.mapWith(Number),
        revenue: sql<number>`sum(${orderItemsTable.subtotal})`.mapWith(Number),
      })
      .from(orderItemsTable)
      .innerJoin(ordersTable, eq(orderItemsTable.orderId, ordersTable.id))
      .where(confirmedSales)
      .groupBy(salesBucket)
      .orderBy(asc(salesBucket)),
    db
      .select({
        bucket: purchaseBucket,
        expenses: sql<number>`sum(${inventoryPurchasesTable.unitCost}::bigint * ${inventoryPurchasesTable.quantity}::bigint)`.mapWith(Number),
      })
      .from(inventoryPurchasesTable)
      .where(
        and(
          gte(inventoryPurchasesTable.purchasedAt, from),
          lt(inventoryPurchasesTable.purchasedAt, to),
        ),
      )
      .groupBy(purchaseBucket)
      .orderBy(asc(purchaseBucket)),
    db
      .select({
        bucket: expenseBucket,
        expenses: sql<number>`sum(${financeExpensesTable.amount})`.mapWith(Number),
      })
      .from(financeExpensesTable)
      .where(
        and(
          gte(financeExpensesTable.incurredAt, from),
          lt(financeExpensesTable.incurredAt, to),
        ),
      )
      .groupBy(expenseBucket)
      .orderBy(asc(expenseBucket)),
    db
      .select({
        categoryId: booksTable.categoryId,
        categoryName: sql<string>`coalesce(${categoriesTable.name}, 'Sin categoría')`,
        units: sql<number>`sum(${orderItemsTable.quantity})`.mapWith(Number),
        revenue: sql<number>`sum(${orderItemsTable.subtotal})`.mapWith(Number),
      })
      .from(orderItemsTable)
      .innerJoin(ordersTable, eq(orderItemsTable.orderId, ordersTable.id))
      .innerJoin(booksTable, eq(orderItemsTable.bookId, booksTable.id))
      .leftJoin(categoriesTable, eq(booksTable.categoryId, categoriesTable.id))
      .where(confirmedSales)
      .groupBy(booksTable.categoryId, categoriesTable.name)
      .orderBy(desc(sql`sum(${orderItemsTable.quantity})`)),
    db
      .select({
        categoryId: categoriesTable.id,
        categoryName: categoriesTable.name,
      })
      .from(categoriesTable)
      .orderBy(asc(categoriesTable.name)),
  ]);
  const revenue = salesSummary[0]?.revenue ?? 0;
  const costOfGoods = salesSummary[0]?.costOfGoods ?? 0;
  const timeline = new Map<string, { bucket: string; units: number; revenue: number; expenses: number }>();
  const getTimelinePoint = (bucket: string) => {
    let point = timeline.get(bucket);
    if (!point) {
      point = { bucket, units: 0, revenue: 0, expenses: 0 };
      timeline.set(bucket, point);
    }
    return point;
  };
  for (const point of salesTimeline) {
    const row = getTimelinePoint(point.bucket);
    row.units = point.units;
    row.revenue = point.revenue;
  }
  for (const point of [...purchaseTimeline, ...expenseTimeline]) {
    getTimelinePoint(point.bucket).expenses += point.expenses;
  }
  const categoryPerformance = new Map(
    categories.map(({ categoryId, categoryName }) => [
      categoryId,
      { categoryId, categoryName, units: 0, revenue: 0 },
    ]),
  );
  let uncategorized: (typeof categorySales)[number] | null = null;
  for (const category of categorySales) {
    const categoryId = category.categoryId;
    if (categoryId === null) {
      uncategorized = category;
    } else {
      categoryPerformance.set(categoryId, { ...category, categoryId });
    }
  }
  const sortedCategories = [
    ...categoryPerformance.values(),
    ...(uncategorized ? [uncategorized] : []),
  ].sort((a, b) => b.units - a.units || a.categoryName.localeCompare(b.categoryName));
  const report = GetAdminReportResponse.parse({
    salesUnits: salesSummary[0]?.units ?? 0,
    salesOrders: salesOrderCount[0]?.count ?? 0,
    revenue,
    costOfGoods,
    grossProfit: revenue - costOfGoods,
    purchaseUnits: purchaseSummary[0]?.units ?? 0,
    purchaseCount: purchaseSummary[0]?.count ?? 0,
    purchaseSpend: purchaseSummary[0]?.spend ?? 0,
    expenseCount: expenseSummary[0]?.count ?? 0,
    expenseSpend: expenseSummary[0]?.spend ?? 0,
    timelineUnit,
    salesTimeline: [...timeline.values()].sort((a, b) => a.bucket.localeCompare(b.bucket)),
    categoryPerformance: sortedCategories,
    topBooks,
    slowBooks,
    purchases: purchaseRows.map((purchase) => ({
      ...purchase,
      totalCost: purchase.quantity * purchase.unitCost,
    })),
    expenses: expenseRows,
  });
  res.json(report);
});

router.get("/admin/books", async (_req, res): Promise<void> => {
  const rows = await db
    .select({ book: booksTable, categoryName: categoriesTable.name })
    .from(booksTable)
    .leftJoin(categoriesTable, eq(booksTable.categoryId, categoriesTable.id))
    .orderBy(desc(booksTable.createdAt));
  res.json(
    GetAdminBooksResponse.parse(
      rows.map(({ book, categoryName }) => adminBook(book, categoryName)),
    ),
  );
});

router.post("/admin/books", async (req, res): Promise<void> => {
  const parsed = CreateBookBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Revisá los datos del libro." });
    return;
  }
  const input = parsed.data;
  const [created] = await db
    .insert(booksTable)
    .values({
      ...input,
      title: input.title.trim(),
      author: input.author.trim(),
      description: input.description.trim(),
      synopsis: input.synopsis.trim(),
      stockZeroAt: input.stock === 0 ? new Date() : null,
      coverUrl: input.coverUrl?.trim() || null,
      videoUrl: input.videoUrl?.trim() || null,
    })
    .returning({ id: booksTable.id });
  const book = await getAdminBook(created.id);
  if (!book) {
    res.status(500).json({ error: "No pudimos recuperar el libro creado." });
    return;
  }
  res.status(201).json(CreateBookResponse.parse(book));
});

router.patch("/admin/books/:id", async (req, res): Promise<void> => {
  const params = UpdateBookParams.safeParse(req.params);
  const parsed = UpdateBookBody.safeParse(req.body);
  if (!params.success || !parsed.success) {
    res.status(400).json({ error: "Los datos para actualizar el libro no son válidos." });
    return;
  }
  const id = params.data.id;
  const changes = parsed.data;
  const values = {
    ...changes,
    ...(changes.title !== undefined ? { title: changes.title.trim() } : {}),
    ...(changes.author !== undefined ? { author: changes.author.trim() } : {}),
    ...(changes.description !== undefined
      ? { description: changes.description.trim() }
      : {}),
    ...(changes.synopsis !== undefined
      ? { synopsis: changes.synopsis.trim() }
      : {}),
    ...(changes.coverUrl !== undefined
      ? { coverUrl: changes.coverUrl?.trim() || null }
      : {}),
    ...(changes.videoUrl !== undefined
      ? { videoUrl: changes.videoUrl?.trim() || null }
      : {}),
    ...(changes.stock !== undefined
      ? { stockZeroAt: changes.stock === 0 ? new Date() : null }
      : {}),
  };
  const [updated] = await db
    .update(booksTable)
    .set(values)
    .where(eq(booksTable.id, id))
    .returning({ id: booksTable.id });
  if (!updated) {
    res.status(404).json({ error: "No encontramos ese libro." });
    return;
  }
  const book = await getAdminBook(id);
  if (!book) {
    res.status(404).json({ error: "No encontramos ese libro." });
    return;
  }
  res.json(UpdateBookResponse.parse(book));
});

router.delete("/admin/books/:id", async (req, res): Promise<void> => {
  const params = ArchiveBookParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "El identificador del libro no es válido." });
    return;
  }
  await db
    .update(booksTable)
    .set({ visible: false })
    .where(eq(booksTable.id, params.data.id));
  res.sendStatus(204);
});

router.get("/admin/categories", async (_req, res): Promise<void> => {
  const categories = await db
    .select()
    .from(categoriesTable)
    .orderBy(categoriesTable.sortOrder);
  res.json(GetAdminCategoriesResponse.parse(categories.map(publicCategory)));
});

router.post("/admin/categories", async (req, res): Promise<void> => {
  const parsed = CreateCategoryBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Revisá los datos de la categoría." });
    return;
  }
  const input = parsed.data;
  const [category] = await db
    .insert(categoriesTable)
    .values({
      ...input,
      name: input.name.trim(),
      slug: input.slug.trim().toLowerCase(),
      description: input.description.trim(),
    })
    .returning();
  res.status(201).json(CreateCategoryResponse.parse(publicCategory(category)));
});

router.patch("/admin/categories/:id", async (req, res): Promise<void> => {
  const params = UpdateCategoryParams.safeParse(req.params);
  const parsed = UpdateCategoryBody.safeParse(req.body);
  if (!params.success || !parsed.success) {
    res.status(400).json({ error: "Los datos para actualizar la categoría no son válidos." });
    return;
  }
  const changes = parsed.data;
  const [category] = await db
    .update(categoriesTable)
    .set({
      ...changes,
      ...(changes.name !== undefined ? { name: changes.name.trim() } : {}),
      ...(changes.slug !== undefined
        ? { slug: changes.slug.trim().toLowerCase() }
        : {}),
      ...(changes.description !== undefined
        ? { description: changes.description.trim() }
        : {}),
    })
    .where(eq(categoriesTable.id, params.data.id))
    .returning();
  if (!category) {
    res.status(404).json({ error: "No encontramos esa categoría." });
    return;
  }
  res.json(UpdateCategoryResponse.parse(publicCategory(category)));
});

router.delete("/admin/categories/:id", async (req, res): Promise<void> => {
  const params = ArchiveCategoryParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "El identificador de la categoría no es válido." });
    return;
  }
  await db
    .update(categoriesTable)
    .set({ visible: false })
    .where(eq(categoriesTable.id, params.data.id));
  res.sendStatus(204);
});

router.get("/admin/orders", async (_req, res): Promise<void> => {
  const orders = await db
    .select({ id: ordersTable.id })
    .from(ordersTable)
    .orderBy(desc(ordersTable.createdAt))
    .limit(100);
  const rows = await Promise.all(orders.map(({ id }) => getOrder(id)));
  res.json(GetAdminOrdersResponse.parse(rows.filter((row) => row !== null)));
});

router.patch("/admin/orders/:id", async (req, res): Promise<void> => {
  const params = UpdateOrderStatusParams.safeParse(req.params);
  const parsed = UpdateOrderStatusBody.safeParse(req.body);
  if (!params.success || !parsed.success) {
    res.status(400).json({ error: "El estado del pedido no es válido." });
    return;
  }
  const id = params.data.id;
  const nextStatus = parsed.data.status;
  try {
    await db.transaction(async (tx) => {
      const [order] = await tx
        .select()
        .from(ordersTable)
        .where(eq(ordersTable.id, id))
        .limit(1);
      if (!order) throw new Error("not_found");
      if (order.status === nextStatus) return;

      const allowed =
        (order.status === "pending" &&
          (nextStatus === "confirmed" || nextStatus === "cancelled")) ||
        (order.status === "confirmed" &&
          ["delivered", "picked_up", "cancelled"].includes(nextStatus));
      if (!allowed) throw new Error("invalid_transition");

      const items = await tx
        .select()
        .from(orderItemsTable)
        .where(eq(orderItemsTable.orderId, id));
      if (order.status === "pending" && nextStatus === "confirmed") {
        for (const item of items) {
          const [book] = await tx
            .update(booksTable)
            .set({
              stock: sql`${booksTable.stock} - ${item.quantity}`,
              stockZeroAt: sql`CASE WHEN ${booksTable.stock} - ${item.quantity} = 0 THEN NOW() ELSE ${booksTable.stockZeroAt} END`,
            })
            .where(
              and(
                eq(booksTable.id, item.bookId),
                gte(booksTable.stock, item.quantity),
              ),
            )
            .returning({ id: booksTable.id });
          if (!book) throw new StockTransitionError("stock");
        }
      }
      if (order.status === "confirmed" && nextStatus === "cancelled") {
        for (const item of items) {
          await tx
            .update(booksTable)
            .set({
              stock: sql`${booksTable.stock} + ${item.quantity}`,
              stockZeroAt: null,
            })
            .where(eq(booksTable.id, item.bookId));
        }
      }
      await tx
        .update(ordersTable)
        .set({
          status: nextStatus,
          confirmedAt:
            nextStatus === "confirmed" ? new Date() : order.confirmedAt,
          updatedAt: new Date(),
        })
        .where(eq(ordersTable.id, id));
    });
  } catch (error) {
    if (error instanceof StockTransitionError) {
      res.status(409).json({ error: "No hay stock suficiente para confirmar este pedido." });
      return;
    }
    if (error instanceof Error && error.message === "not_found") {
      res.status(404).json({ error: "No encontramos ese pedido." });
      return;
    }
    if (error instanceof Error && error.message === "invalid_transition") {
      res.status(409).json({ error: "Ese cambio de estado no está permitido." });
      return;
    }
    throw error;
  }
  const updated = await getOrder(id);
  if (!updated) {
    res.status(404).json({ error: "No encontramos ese pedido." });
    return;
  }
  res.json(UpdateOrderStatusResponse.parse(updated));
});

router.post("/admin/purchases", async (req, res): Promise<void> => {
  const parsed = CreateInventoryPurchaseBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Revisá los datos de la compra." });
    return;
  }
  const input = parsed.data;
  try {
    const purchase = await db.transaction(async (tx) => {
      const [book] = await tx
        .select({
          id: booksTable.id,
          title: booksTable.title,
          stock: booksTable.stock,
        })
        .from(booksTable)
        .where(eq(booksTable.id, input.bookId))
        .for("update");
      if (!book) return null;
      const nextStock = book.stock + input.quantity;
      if (!Number.isSafeInteger(nextStock) || nextStock > 2_147_483_647) {
        throw new StockCapacityError("stock_capacity");
      }

      const [created] = await tx
        .insert(inventoryPurchasesTable)
        .values({
          bookId: book.id,
          quantity: input.quantity,
          unitCost: input.unitCost,
          supplier: input.supplier.trim(),
          notes: input.notes.trim(),
          purchasedAt: input.purchasedAt,
        })
        .returning({ id: inventoryPurchasesTable.id });
      await tx
        .update(booksTable)
        .set({
          stock: nextStock,
          cost: input.unitCost,
          stockZeroAt: null,
        })
        .where(eq(booksTable.id, book.id));
      return {
        id: created.id,
        bookId: book.id,
        bookTitle: book.title,
        quantity: input.quantity,
        unitCost: input.unitCost,
        totalCost: input.quantity * input.unitCost,
        supplier: input.supplier.trim(),
        notes: input.notes.trim(),
        purchasedAt: input.purchasedAt,
      };
    });
    if (!purchase) {
      res.status(404).json({ error: "No encontramos ese libro." });
      return;
    }
    res.status(201).json(CreateInventoryPurchaseResponse.parse(purchase));
  } catch (error) {
    if (error instanceof StockCapacityError) {
      res.status(409).json({ error: "El nuevo stock supera el límite permitido." });
      return;
    }
    throw error;
  }
});

router.post("/admin/expenses", async (req, res): Promise<void> => {
  const parsed = CreateFinanceExpenseBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Revisá los datos del gasto." });
    return;
  }
  const input = parsed.data;
  const [expense] = await db
    .insert(financeExpensesTable)
    .values({
      title: input.title.trim(),
      category: input.category.trim(),
      amount: input.amount,
      notes: input.notes.trim(),
      incurredAt: input.incurredAt,
    })
    .returning({
      id: financeExpensesTable.id,
      title: financeExpensesTable.title,
      category: financeExpensesTable.category,
      amount: financeExpensesTable.amount,
      notes: financeExpensesTable.notes,
      incurredAt: financeExpensesTable.incurredAt,
    });
  res.status(201).json(CreateFinanceExpenseResponse.parse(expense));
});

router.get("/admin/settings", async (_req, res): Promise<void> => {
  const settings = await readStoreSettings();
  res.json(GetAdminSettingsResponse.parse(publicSettings(settings)));
});

router.put("/admin/settings", async (req, res): Promise<void> => {
  const parsed = UpdateStoreSettingsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Revisá la información de la tienda." });
    return;
  }
  const input = parsed.data;
  const [updated] = await db
    .insert(storeSettingsTable)
    .values({ id: 1, ...input, whatsappNumber: input.whatsappNumber.replace(/\D/g, "") })
    .onConflictDoUpdate({
      target: storeSettingsTable.id,
      set: {
        ...input,
        whatsappNumber: input.whatsappNumber.replace(/\D/g, ""),
        updatedAt: new Date(),
      },
    })
    .returning();
  res.json(UpdateStoreSettingsResponse.parse(publicSettings(updated)));
});

export default router;
