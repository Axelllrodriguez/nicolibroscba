import { eq, sql } from "drizzle-orm";
import { db, booksTable, categoriesTable, storeSettingsTable } from "@workspace/db";
import type { Book, Category, StoreSettings } from "@workspace/db";

const legacyDefaultWhatsAppNumber = "5493510000000";
const configuredWhatsAppNumber = process.env["STORE_WHATSAPP_NUMBER"]?.replace(/\D/g, "");
export const defaultWhatsAppNumber =
  configuredWhatsAppNumber && configuredWhatsAppNumber !== legacyDefaultWhatsAppNumber
    ? configuredWhatsAppNumber
    : "543878630562";

export const defaultSettings = {
  heroTitle: "Cada libro es el comienzo de una nueva historia.",
  heroSubtitle:
    "Descubrí tu próxima lectura en Nico Libros. Historias, conocimiento e inspiración, en un solo lugar.",
  story: [
    "¡Hola! Soy Santiago Nicolás Rodríguez 👋",
    "",
    "Soy del interior de Salta y actualmente vivo en Córdoba Capital, donde me encuentro estudiando en la Universidad Tecnológica Nacional – Facultad Regional Córdoba (UTN FRC), ubicada en Ciudad Universitaria. 🎓",
    "",
    "Desde hace más de un año llevo adelante este emprendimiento dedicado a la reventa de libros importados. 📚🌎",
    "",
    "Mi objetivo es ofrecer una variedad de títulos, novedades y libros seleccionados a precios accesibles, brindando una atención responsable y acompañando a cada cliente durante el proceso de compra. 🤝",
    "",
    "Gracias por apoyar este emprendimiento 🙌🏽",
  ].join("\n"),
  whatsappNumber: defaultWhatsAppNumber,
  greetingMessage: "¡Hola Nico Libros! Quiero consultar por un libro.",
  address: "Av. Cjal. Felipe Belardinelli 2940, X5016 Córdoba",
  openingHours: "",
  mapsUrl: "https://share.google/iUCwZaVHYC9mI3RIm",
  instagram: "https://www.instagram.com/nico.libros.cba",
  facebook: "https://www.facebook.com/nicolas.rodriguez.747924/",
  tiktok: "",
  creditLink: "https://axelrodriguezweb.framer.website/",
  deliveryInfo: "",
  pickupAddress: "",
  pickupHours: "",
  paymentMethods: ["cash", "transfer", "coordinate"],
  lowStockThreshold: 3,
};

const demoCategories = [
  ["Desarrollo personal", "desarrollo-personal", "Hábitos, foco y nuevas versiones de uno mismo."],
  ["Filosofía", "filosofia", "Preguntas viejas, siempre urgentes."],
  ["Finanzas y negocios", "finanzas-negocios", "Ideas para emprender, invertir y decidir mejor."],
  ["Historia", "historia", "Lo que fuimos para entender lo que somos."],
  ["Literatura", "literatura", "Clásicos, cuentos y poesía."],
  ["Novelas", "novelas", "Mundos enteros para perderse una tarde."],
  ["Otros géneros", "otros-generos", "Lo inclasificable también tiene su estante."],
  ["Psicología", "psicologia", "Entender la mente, propia y ajena."],
] as const;

const demoBooks = [
  ["Pequeños hábitos", "Martín Olmos", "desarrollo-personal", 15900, 7800, 2, true],
  ["La mañana silenciosa", "Inés Robles", "desarrollo-personal", 9800, 4500, 0, false],
  ["El arte de empezar", "Lucía Ferrer", "desarrollo-personal", 17400, 8200, 8, true],
  ["Preguntas para el insomnio", "Ramiro Vega", "filosofia", 16800, 8300, 4, true],
  ["Breve tratado del asombro", "Clara Domínguez", "filosofia", 14200, 6900, 2, false],
  ["Diálogos en el patio", "Héctor Bustos", "filosofia", 18500, 9200, 7, false],
  ["Capital paciente", "Diego Saravia", "finanzas-negocios", 24900, 12400, 9, true],
  ["Emprender sin ruido", "Carla Benítez", "finanzas-negocios", 21000, 10500, 6, true],
  ["Números claros", "Pablo Ríos", "finanzas-negocios", 12500, 5800, 1, false],
  ["Córdoba, ciudad docta", "Ana Villarreal", "historia", 19800, 9600, 5, true],
  ["Rutas del virreinato", "Jorge Castro", "historia", 16300, 7900, 3, false],
  ["Mapas del siglo XIX", "Valeria Sosa", "historia", 22100, 10900, 4, false],
  ["Cuentos del mediodía", "Laura Medina", "literatura", 11700, 5500, 7, true],
  ["Poemas de agua dulce", "Nicolás Ibarra", "literatura", 8900, 4100, 2, false],
  ["El jardín de los versos", "Paula Ortiz", "literatura", 13400, 6300, 5, false],
  ["La casa del río Suquía", "Julia Aranda", "novelas", 19900, 9800, 6, true],
  ["Viento de las sierras", "Tomás Quiroga", "novelas", 17400, 8500, 4, true],
  ["Cartas que no llegaron", "Elena Paz", "novelas", 8900, 4000, 1, false],
  ["Cocina de estación", "Mercedes Lugones", "otros-generos", 14500, 7000, 3, false],
  ["Atlas de aves serranas", "Gustavo Peralta", "otros-generos", 23900, 11900, 0, false],
  ["La mente que observa", "Sofía Herrera", "psicologia", 22300, 11000, 5, true],
  ["Vínculos", "Andrés Luna", "psicologia", 18600, 9000, 2, false],
  ["El peso de las emociones", "Marta Giménez", "psicologia", 16900, 8200, 4, false],
  ["Escuchar hacia adentro", "Bruno Acosta", "psicologia", 13200, 6400, 0, false],
] as const;

export async function ensureSeedData(): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(1381187907)`);

    const settings = await tx.select().from(storeSettingsTable).limit(1);
    if (!settings[0]) {
      await tx.insert(storeSettingsTable).values({ id: 1, ...defaultSettings });
    }

    const existingCategories = await tx.select({ id: categoriesTable.id }).from(categoriesTable).limit(1);
    if (existingCategories.length === 0) {
      await tx.insert(categoriesTable).values(
        demoCategories.map(([name, slug, description], index) => ({
          name,
          slug,
          description,
          sortOrder: index + 1,
          visible: true,
          demo: true,
        })),
      );
    }

    const existingBooks = await tx.select({ id: booksTable.id }).from(booksTable).limit(1);
    if (existingBooks.length === 0) {
      const categories = await tx.select().from(categoriesTable);
      const categoryIds = new Map(categories.map((category) => [category.slug, category.id]));
      await tx.insert(booksTable).values(
        demoBooks.map(([title, author, categorySlug, price, cost, stock, featured]) => ({
          title,
          author,
          categoryId: categoryIds.get(categorySlug) ?? null,
          price,
          cost,
          stock,
          stockZeroAt: stock === 0 ? new Date() : null,
          featured,
          visible: true,
          demo: true,
          description: `Un título de demostración de Nico Libros. Reemplazá estos datos por la descripción real desde el panel.`,
          coverUrl: null,
        })),
      );
    }
  });
}

export async function readStoreSettings(): Promise<StoreSettings> {
  const rows = await db.select().from(storeSettingsTable).limit(1);
  if (rows[0]) return rows[0];
  const [created] = await db
    .insert(storeSettingsTable)
    .values({ id: 1, ...defaultSettings })
    .returning();
  return created;
}

export async function getCategoryName(categoryId: number | null): Promise<string | null> {
  if (categoryId == null) return null;
  const [category] = await db
    .select({ name: categoriesTable.name })
    .from(categoriesTable)
    .where(eq(categoriesTable.id, categoryId))
    .limit(1);
  return category?.name ?? null;
}

export function publicCategory(category: Category) {
  return {
    id: category.id,
    name: category.name,
    slug: category.slug,
    description: category.description,
    sortOrder: category.sortOrder,
    visible: category.visible,
    demo: category.demo,
  };
}

export function publicSettings(settings: StoreSettings) {
  return {
    heroTitle: settings.heroTitle,
    heroSubtitle: settings.heroSubtitle,
    story: settings.story,
    whatsappNumber: publicWhatsAppNumber(settings.whatsappNumber),
    greetingMessage: settings.greetingMessage,
    address: settings.address,
    openingHours: settings.openingHours,
    mapsUrl: settings.mapsUrl,
    instagram: settings.instagram,
    facebook: settings.facebook,
    tiktok: settings.tiktok,
    creditLink: settings.creditLink,
    deliveryInfo: settings.deliveryInfo,
    pickupAddress: settings.pickupAddress,
    pickupHours: settings.pickupHours,
    paymentMethods: settings.paymentMethods,
    lowStockThreshold: settings.lowStockThreshold,
  };
}

export function publicWhatsAppNumber(value: string): string {
  const number = value.replace(/\D/g, "");
  return !number || number === legacyDefaultWhatsAppNumber
    ? defaultWhatsAppNumber
    : number;
}

export function publicBook(book: Book, categoryName: string | null) {
  return {
    id: book.id,
    title: book.title,
    author: book.author,
    description: book.description,
    synopsis: book.synopsis,
    categoryId: book.categoryId,
    categoryName,
    price: book.price,
    stock: book.stock,
    featured: book.featured,
    visible: book.visible,
    demo: book.demo,
    coverUrl: book.coverUrl,
    extraImages: book.extraImages,
    videoUrl: book.videoUrl,
    createdAt: book.createdAt,
  };
}

export function adminBook(book: Book, categoryName: string | null) {
  return {
    ...publicBook(book, categoryName),
    cost: book.cost,
  };
}
