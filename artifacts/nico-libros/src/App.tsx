import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import { Route, Switch, useLocation, Router as WouterRouter, Link } from 'wouter';
import {
  getGetCatalogQueryKey, useGetCatalog, getGetBestsellersQueryKey, useGetBestsellers,
  getGetStoreSettingsQueryKey, useGetStoreSettings, useCreateOrder,
  useAdminLogin, getGetAdminSessionQueryKey, useGetAdminSession, useAdminLogout,
  getGetAdminDashboardQueryKey, useGetAdminDashboard, getGetAdminBooksQueryKey, useGetAdminBooks,
  useCreateBook, useUpdateBook, useArchiveBook, getGetAdminCategoriesQueryKey, useGetAdminCategories,
  useCreateCategory, useUpdateCategory, useArchiveCategory, getGetAdminOrdersQueryKey, useGetAdminOrders,
  useUpdateOrderStatus, getGetAdminSettingsQueryKey, useGetAdminSettings, useUpdateStoreSettings,
  getGetAdminReportQueryKey, useGetAdminReport, useCreateInventoryPurchase, useCreateFinanceExpense,
} from '@workspace/api-client-react';
import type { AdminBook, Book, Category, FinanceExpenseInput, InventoryPurchaseInput, StoreSettingsInput, OrderStatusInputStatus } from '@workspace/api-client-react';
import { ArrowRight, ArrowUpRight, BookOpen, Check, CircleAlert, Clock3, Instagram, MapPin, Menu, MessageCircle, Minus, Plus, Search, ShoppingBag, X } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import HeroBooks from './HeroBooks';
import historyImage from '../../../assets/nuestrahistoria.jpeg';
import uberDeliveryImage from '../../../assets/enviouber-public.png';
import nationalDeliveryImage from '../../../assets/enviopais.png';
import axelWebLogo from '../../../assets/axelweb.png';

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: 1, staleTime: 30_000 } } });
type CartLine = { book: Book; quantity: number };
type AdminBookRecord = AdminBook;
const money = (amount: number) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(amount);
const logo = `${import.meta.env.BASE_URL}nico-libros-logo.jpg`;
const ctaImage = `${import.meta.env.BASE_URL}nico-libros-reading-cta.jpg`;
const defaultWhatsAppNumber = '543878630562';
const legacyDefaultWhatsAppNumber = '5493510000000';
const mediaFileExtensions: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'video/quicktime': 'mov',
};
const fallbackStory = [
  '¡Hola! Soy Santiago Nicolás Rodríguez 👋',
  '',
  'Soy del interior de Salta y actualmente vivo en Córdoba Capital, donde me encuentro estudiando en la Universidad Tecnológica Nacional – Facultad Regional Córdoba (UTN FRC), ubicada en Ciudad Universitaria. 🎓',
  '',
  'Desde hace más de un año llevo adelante este emprendimiento dedicado a la reventa de libros importados. 📚🌎',
  '',
  'Mi objetivo es ofrecer una variedad de títulos, novedades y libros seleccionados a precios accesibles, brindando una atención responsable y acompañando a cada cliente durante el proceso de compra. 🤝',
  '',
  'Gracias por apoyar este emprendimiento 🙌🏽',
].join('\n');

function setPageMeta(title: string, description: string, robots: string) {
  document.title = title;
  document.querySelector('meta[name="description"]')?.setAttribute('content', description);
  document.querySelector('meta[name="robots"]')?.setAttribute('content', robots);
  document.querySelector('meta[property="og:title"]')?.setAttribute('content', title);
  document.querySelector('meta[property="og:description"]')?.setAttribute('content', description);
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function Store() {
  const catalog = useGetCatalog();
  const bestsellers = useGetBestsellers();
  const settingsQuery = useGetStoreSettings();
  const settings = settingsQuery.data;
  const storeAddress = settings?.address || 'Av. Cjal. Felipe Belardinelli 2940, X5016 Córdoba';
  const storeMapsUrl = settings?.mapsUrl || 'https://share.google/iUCwZaVHYC9mI3RIm';
  const instagramUrl = settings?.instagram || 'https://www.instagram.com/nico.libros.cba';
  const facebookUrl = settings?.facebook || 'https://www.facebook.com/nicolas.rodriguez.747924/';
  const creditUrl = settings?.creditLink || 'https://axelrodriguezweb.framer.website/';
  const tiktokUrl = settings?.tiktok;
  const configuredWhatsAppNumber = settings?.whatsappNumber?.replace(/\D/g, '');
  const whatsappPhone = !configuredWhatsAppNumber || configuredWhatsAppNumber === legacyDefaultWhatsAppNumber
    ? defaultWhatsAppNumber
    : configuredWhatsAppNumber;
  const storyParagraphs = (settings?.story || fallbackStory).split(/\n\s*\n/).filter(Boolean);
  const storySplitIndex = Math.ceil(storyParagraphs.length / 2);
  const storyColumns = [
    storyParagraphs.slice(0, storySplitIndex),
    storyParagraphs.slice(storySplitIndex),
  ].filter(column => column.length > 0);
  useEffect(() => {
    setPageMeta(
      'Libros nuevos en Córdoba | Nico Libros',
      'Descubrí libros nuevos a precios accesibles en Nico Libros, una librería de Córdoba. Explorá el catálogo y coordiná tu pedido por WhatsApp.',
      'index, follow',
    );
  }, []);
  const createOrder = useCreateOrder();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<number | ''>('');
  const [sort, setSort] = useState('featured');
  const [available, setAvailable] = useState(false);
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [cart, setCart] = useState<CartLine[]>(() => {
    try { return JSON.parse(localStorage.getItem('nico-cart') || '[]') as CartLine[]; } catch { return []; }
  });
  const [cartOpen, setCartOpen] = useState(false);
  const [detail, setDetail] = useState<Book | null>(null);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);
  const [sentOrder, setSentOrder] = useState<string | null>(null);
  useEffect(() => { localStorage.setItem('nico-cart', JSON.stringify(cart)); }, [cart]);
  const categories = catalog.data?.categories ?? [];
  const books = useMemo(() => (catalog.data?.books ?? []).filter(book => {
    const term = query.trim().toLocaleLowerCase('es');
    return (!term || `${book.title} ${book.author} ${book.description}`.toLocaleLowerCase('es').includes(term))
      && (category === '' || book.categoryId === category) && (!available || book.stock > 0)
      && (!minPrice || book.price >= Number(minPrice)) && (!maxPrice || book.price <= Number(maxPrice));
  }).sort((a, b) => sort === 'newest' ? b.createdAt.localeCompare(a.createdAt) : sort === 'price_asc' ? a.price - b.price : sort === 'price_desc' ? b.price - a.price : Number(b.featured) - Number(a.featured)), [catalog.data, query, category, available, sort, minPrice, maxPrice]);
  const addToCart = (book: Book, quantity = 1) => {
    setCart(current => {
      if (book.stock < 1) return current;
      const found = current.find(line => line.book.id === book.id);
      if (found) return current.map(line => line.book.id === book.id ? { ...line, book, quantity: Math.min(book.stock, line.quantity + quantity) } : line);
      return [...current, { book, quantity: Math.min(book.stock, quantity) }];
    });
    setDetail(null);
    setCartOpen(true);
  };
  const changeQty = (id: number, delta: number) => setCart(current => current.map(line => line.book.id === id ? { ...line, quantity: Math.max(0, Math.min(line.book.stock, line.quantity + delta)) } : line).filter(line => line.quantity > 0));
  const total = cart.reduce((sum, line) => sum + line.book.price * line.quantity, 0);
  const waLink = (text: string) => `https://api.whatsapp.com/send/?phone=${whatsappPhone}&text=${encodeURIComponent(text)}&type=phone_number&app_absent=0`;
  const submitOrder = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const fulfillment = String(form.get('fulfillment') || 'delivery') as 'delivery' | 'pickup';
    const whatsappTab = window.open('about:blank', '_blank');
    if (whatsappTab) whatsappTab.opener = null;
    createOrder.mutate({ data: {
      name: String(form.get('name') || ''), phone: String(form.get('phone') || ''),
      fulfillment, address: fulfillment === 'delivery' ? String(form.get('address') || '') : null,
      area: fulfillment === 'delivery' ? String(form.get('area') || '') : null,
      notes: String(form.get('notes') || '') || null,
      paymentPreference: String(form.get('payment') || 'coordinate') as 'cash' | 'transfer' | 'coordinate',
      items: cart.map(line => ({ bookId: line.book.id, quantity: line.quantity })),
    } }, {
      onSuccess: result => {
        const order = result.order;
        const deliveryAddress = order.fulfillment === 'delivery'
          ? `${order.address || ''}${order.area ? `, ${order.area}` : ''}`
          : settings?.pickupAddress || 'Retiro en el local';
        const text = [
          '¡Hola Nico Libros! Quiero hacer un pedido 📚',
          `*Pedido #${order.orderNumber}*`,
          `*Nombre:* ${order.name}`,
          `*WhatsApp:* ${order.phone}`,
          `*Modalidad:* ${order.fulfillment === 'delivery' ? 'Envío a domicilio' : 'Retiro en el local'}`,
          `*Dirección:* ${deliveryAddress}`,
          '*Libros:*',
          ...order.items.map(item => `• ${item.quantity} x ${item.title} — ${money(item.subtotal)}`),
          `*Total:* ${money(order.total)}`,
          ...(order.notes ? [`*Observaciones:* ${order.notes}`] : []),
        ].join('\n');
        setSentOrder(order.orderNumber);
        setCart([]);
        setCheckoutOpen(false);
        const url = `https://api.whatsapp.com/send/?phone=${result.whatsappNumber.replace(/\D/g, '')}&text=${encodeURIComponent(text)}&type=phone_number&app_absent=0`;
        if (whatsappTab && !whatsappTab.closed) whatsappTab.location.href = url;
        else window.location.assign(url);
      },
      onError: () => { whatsappTab?.close(); },
    });
  };
  const jumpCatalog = () => document.querySelector('#catalogo')?.scrollIntoView({ behavior: 'smooth' });

  return <main className="paper-grain min-h-[100dvh]">
    <div className="bg-[#17263f] px-4 py-2 text-center text-[10px] tracking-[.12em] text-[#f5ead8] sm:text-[11px]">
      LIBROS PARA LEER MUCHO, SIN GASTAR DE MÁS <span className="mx-2 text-[#d5ad69]">·</span> CÓRDOBA, ARGENTINA
    </div>
    <header className="sticky top-0 z-40 border-b border-[#ded5c5] bg-[#f8f4eb]/95 backdrop-blur">
      <div className="mx-auto flex h-[74px] max-w-[1320px] items-center justify-between px-4 sm:px-7">
        <Link href="/" className="flex items-center gap-3" data-testid="link-home">
          <img src={logo} alt="Nico Libros" className="h-[49px] w-[70px] object-contain object-center" />
          <span className="hidden font-serif text-[17px] font-semibold tracking-tight sm:block">Nico <span className="italic text-[#7a293b]">Libros</span></span>
        </Link>
        <nav className={`${mobileNav ? 'absolute left-0 right-0 top-full flex border-b bg-[#f8f4eb] p-5 shadow-md' : 'hidden'} flex-col gap-5 text-[12px] sm:static sm:flex sm:flex-row sm:items-center sm:border-0 sm:bg-transparent sm:p-0 sm:shadow-none`}>
          <a href="#catalogo" onClick={() => setMobileNav(false)} className="hover:text-[#7a293b]">Catálogo</a>
          <a href="#historia" onClick={() => setMobileNav(false)} className="hover:text-[#7a293b]">Nuestra historia</a>
          <a href="#contacto" onClick={() => setMobileNav(false)} className="hover:text-[#7a293b]">Encontranos</a>
          <a href={waLink('Hola, quería consultar por sus libros.')} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-[#7a293b]">Hablemos <ArrowUpRight size={14}/></a>
        </nav>
        <div className="flex items-center gap-2">
          <button onClick={jumpCatalog} aria-label="Buscar libros" className="hidden p-2 hover:text-[#7a293b] sm:block"><Search size={18}/></button>
          <button onClick={() => setCartOpen(true)} data-testid="button-open-cart" className="relative flex items-center gap-2 border border-[#17263f] px-3 py-2 text-xs hover:bg-[#17263f] hover:text-[#f8f4eb]">
            <ShoppingBag size={16}/><span className="hidden sm:inline">Tu bolsa</span><span className="font-semibold">{cart.reduce((s, l) => s + l.quantity, 0)}</span>
          </button>
          <button onClick={() => setMobileNav(v => !v)} aria-label="Abrir navegación" className="p-2 sm:hidden"><Menu size={19}/></button>
        </div>
      </div>
    </header>

    <section className="relative isolate overflow-hidden bg-white">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-0"
        style={{
          backgroundImage: 'radial-gradient(circle at center, #FFF991 0%, transparent 70%)',
          opacity: 0.6,
          mixBlendMode: 'multiply',
        }}
      />
      <div className="relative z-10 mx-auto grid max-w-[1320px] items-center gap-5 px-5 pb-12 pt-12 md:grid-cols-[1.08fr_.92fr] md:px-10 md:pb-20 md:pt-20">
        <div className="fade-up relative z-10">
          <p className="eyebrow mb-5 flex items-center gap-3 text-[#7a293b]"><span className="h-px w-8 bg-[#7a293b]"/> UNA LIBRERÍA CORDOBESA, CERCA TUYO</p>
          <h1 className="serif max-w-[760px] text-[clamp(3rem,7vw,6.2rem)] leading-[.98] tracking-[-.055em]">{settings?.heroTitle || <>Un libro nuevo.<br/><em className="font-medium text-[#7a293b]">Un mundo cerca.</em></>}</h1>
          <p className="mt-6 max-w-[450px] text-[15px] leading-7 text-[#596170]">{settings?.heroSubtitle || 'Elegimos libros para que encuentres tu próxima lectura, con precios accesibles y atención de persona a persona.'}</p>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <button onClick={jumpCatalog} className="group flex items-center gap-4 bg-[#17263f] px-6 py-4 text-sm text-[#f8f4eb] transition hover:bg-[#7a293b]">Ir a la biblioteca <ArrowRight size={16} className="transition group-hover:translate-x-1"/></button>
            <a href={waLink(settings?.greetingMessage || '¡Hola Nico Libros! Quiero consultar por un libro.')} target="_blank" rel="noreferrer" className="flex items-center gap-2 border border-[#17263f]/25 px-5 py-4 text-sm transition hover:border-[#7a293f] hover:text-[#7a293b]">Contactame por WhatsApp <MessageCircle size={16}/></a>
          </div>
          <div className="mt-12 flex items-center gap-3 text-[11px] tracking-wide text-[#69707a]"><span className="h-px w-9 bg-[#c2b7a6]"/> LIBRERÍA LOCAL · CÓRDOBA</div>
        </div>
        <div className="relative mx-auto w-full max-w-[540px]">
          <HeroBooks />
        </div>
      </div>
      <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-[#d7cbb8]"/>
    </section>

    <section className="mx-auto max-w-[1320px] px-5 py-14 md:px-10 md:py-20">
      <div className="mb-8 flex items-end justify-between">
        <div><p className="eyebrow text-[#7a293b]">01 / POR DÓNDE EMPEZAMOS</p><h2 className="serif mt-3 text-3xl md:text-4xl">Elegí tu camino</h2></div>
        <button onClick={jumpCatalog} className="hidden items-center gap-2 text-xs underline underline-offset-4 sm:flex">Ver todo <ArrowRight size={14}/></button>
      </div>
      {catalog.isLoading ? <LoadingRow/> : catalog.isError ? <InlineError retry={() => catalog.refetch()} label="No pudimos cargar las categorías."/> :
        categories.length ? <div className="grid grid-cols-2 border-l border-t border-[#d9cfbf] sm:grid-cols-3 lg:grid-cols-4">
          {categories.slice(0, 8).map((item, index) => <button key={item.id} onClick={() => { setCategory(item.id); jumpCatalog(); }} className="group flex min-h-[108px] items-center justify-between border-b border-r border-[#d9cfbf] p-4 text-left transition hover:bg-[#eae1d2] md:p-6">
            <div><span className="eyebrow text-[#a08f79]">0{index + 1}</span><h3 className="serif mt-2 text-lg group-hover:text-[#7a293b] md:text-xl">{item.name}</h3></div><ArrowUpRight size={17} className="text-[#8a8c8c] transition group-hover:-translate-y-1 group-hover:translate-x-1 group-hover:text-[#7a293b]"/>
          </button>)}
        </div> : <div className="border border-dashed p-7 text-sm text-[#717783]">Todavía no hay categorías para mostrar. Volvé pronto.</div>}
    </section>

    <section className="bg-[#e9e1d3]">
      <div className="mx-auto max-w-[1320px] px-5 py-14 md:px-10 md:py-20">
        <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div><p className="eyebrow text-[#7a293b]">02 / UNA SELECCIÓN PARA VOS</p><h2 className="serif mt-3 text-3xl md:text-4xl">{bestsellers.data?.usingNovelties ? 'Últimas novedades' : 'Los más vendidos de la semana'}</h2><p className="mt-2 text-sm text-[#626978]">{bestsellers.data?.usingNovelties ? 'Todavía no hay ventas confirmadas esta semana; te mostramos las últimas novedades.' : 'Libros con pedidos confirmados en los últimos siete días.'}</p></div>
          {bestsellers.data?.usingNovelties && <span className="w-fit border border-[#b9a88e] px-3 py-2 text-[10px] uppercase tracking-[.12em] text-[#696252]">Novedades de la semana</span>}
        </div>
        {bestsellers.isLoading ? <LoadingRow/> : bestsellers.isError ? <InlineError retry={() => bestsellers.refetch()} label="No pudimos traer la selección."/> :
          bestsellers.data?.books?.length ? <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
            {bestsellers.data.books.slice(0, 4).map(book => <BookCard key={book.id} book={book} onOpen={setDetail} onAdd={addToCart}/>)}
          </div> : <div className="border border-dashed border-[#c9bda9] p-8 text-sm text-[#717783]">Todavía no hay una selección cargada. Mientras tanto, podés explorar el catálogo.</div>}
        <div className="mt-9 text-right"><button onClick={jumpCatalog} className="inline-flex items-center gap-2 text-xs underline underline-offset-4">Explorar el catálogo <ArrowRight size={14}/></button></div>
      </div>
    </section>

    <section id="historia" className="mx-auto grid max-w-[1320px] gap-8 px-5 py-16 md:grid-cols-[.7fr_1.3fr] md:px-10 md:py-24">
      <div>
        <p className="eyebrow text-[#7a293b]">03 / NUESTRA HISTORIA</p>
        <div className="mt-4 h-px w-16 bg-[#7a293b]"/>
        <figure className="mt-7 border border-[#d9cfbf] bg-[#f1eadc] p-2">
          <img
            src={historyImage}
            alt="Estantes y pilas de libros en el espacio de Nico Libros."
            loading="lazy"
            decoding="async"
            className="aspect-[4/3] w-full object-cover"
          />
        </figure>
      </div>
      <div className="min-w-0">
        <h2 className="serif max-w-[650px] text-4xl leading-[1.13] md:text-5xl">Creemos que un buen libro <em className="text-[#7a293b]">siempre encuentra</em> a su lector.</h2>
        <div className={`mt-6 grid gap-5 ${storyColumns.length > 1 ? 'lg:grid-cols-2' : ''}`}>
          {storyColumns.map((column, columnIndex) => (
            <div key={columnIndex} className="space-y-4">
              {column.map(paragraph => (
                <p key={paragraph} className="whitespace-pre-line text-[15px] leading-7 text-[#5f6672]">{paragraph}</p>
              ))}
            </div>
          ))}
        </div>
        <div className="mt-8 flex flex-wrap items-center gap-x-4 gap-y-3 border-t border-[#d9cfbf] pt-5">
          <BookOpen size={22} strokeWidth={1.2} className="shrink-0 text-[#7a293b]"/>
          <p className="serif text-xl italic sm:text-2xl">“Cada lectura abre una puerta.”</p>
          <p className="eyebrow ml-auto text-[#8c8c88]">NICO LIBROS · CÓRDOBA</p>
        </div>
      </div>
    </section>

    <section id="catalogo" className="scroll-mt-[90px] bg-[#f1eadc]">
      <div className="mx-auto max-w-[1320px] px-5 py-14 md:px-10 md:py-20">
        <div className="mb-8 grid gap-5 sm:grid-cols-[1fr_auto] sm:items-end">
          <div><p className="eyebrow text-[#7a293b]">04 / LIBROS PARA LLEVAR</p><h2 className="serif mt-3 text-4xl md:text-5xl">El catálogo</h2></div>
          <p className="max-w-[300px] text-sm leading-6 text-[#626978]">Buscá por título o autor, filtrá y elegí con calma. Si tenés dudas, te ayudamos.</p>
        </div>
        {catalog.data?.demo && <p className="mb-4 inline-flex items-center gap-2 border border-[#d4c1a0] bg-[#f7f0e2] px-3 py-2 text-[11px] text-[#725d39]"><CircleAlert size={14}/> Algunos contenidos son de demostración.</p>}
        <div className="mb-7 grid gap-3 border-y border-[#d4cbbd] py-4 md:grid-cols-[1fr_170px_170px_180px_auto]">
          <label className="flex items-center gap-3 border border-[#d4cbbd] bg-[#faf7f0] px-3"><Search size={17} className="text-[#747983]"/><input aria-label="Buscar en el catálogo" data-testid="input-catalog-search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Título, autor..." className="h-11 w-full bg-transparent text-sm outline-none"/></label>
          <select aria-label="Filtrar por categoría" value={category} onChange={e => setCategory(e.target.value ? Number(e.target.value) : '')} className="border border-[#d4cbbd] bg-[#faf7f0] px-3 text-sm"><option value="">Todas las categorías</option>{categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
          <select aria-label="Ordenar libros" value={sort} onChange={e => setSort(e.target.value)} className="border border-[#d4cbbd] bg-[#faf7f0] px-3 text-sm"><option value="featured">Recomendados</option><option value="newest">Más nuevos</option><option value="price_asc">Menor precio</option><option value="price_desc">Mayor precio</option></select>
          <div className="grid grid-cols-2 gap-2"><label className="sr-only" htmlFor="min-price">Precio mínimo</label><input id="min-price" type="number" min="0" value={minPrice} onChange={e => setMinPrice(e.target.value)} placeholder="Desde $" className="min-w-0 border border-[#d4cbbd] bg-[#faf7f0] px-3 text-sm"/><label className="sr-only" htmlFor="max-price">Precio máximo</label><input id="max-price" type="number" min="0" value={maxPrice} onChange={e => setMaxPrice(e.target.value)} placeholder="Hasta $" className="min-w-0 border border-[#d4cbbd] bg-[#faf7f0] px-3 text-sm"/></div>
          <button onClick={() => setAvailable(v => !v)} className={`border px-4 text-xs ${available ? 'border-[#7a293b] bg-[#7a293b] text-white' : 'border-[#d4cbbd] bg-[#faf7f0]'}`}>{available ? 'Con stock ✓' : 'Solo con stock'}</button>
        </div>
        <div className="mb-4 flex justify-between text-xs text-[#777b81]"><span>{catalog.isLoading ? 'Buscando libros…' : `${books.length} ${books.length === 1 ? 'libro' : 'libros'}`}</span><button onClick={() => { setQuery(''); setCategory(''); setSort('featured'); setAvailable(false); setMinPrice(''); setMaxPrice(''); }} className="underline underline-offset-4">Limpiar filtros</button></div>
        {catalog.isLoading ? <CatalogSkeleton/> : catalog.isError ? <InlineError retry={() => catalog.refetch()} label="No pudimos cargar el catálogo."/> :
          books.length ? <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">{books.map(book => <BookCard key={book.id} book={book} onOpen={setDetail} onAdd={addToCart}/>)}</div> :
             <div className="border border-dashed border-[#c9bda9] bg-[#f8f4eb] px-6 py-14 text-center"><BookOpen size={26} className="mx-auto text-[#7a293b]"/><h3 className="serif mt-3 text-2xl">No encontramos ese libro</h3><p className="mt-2 text-sm text-[#727782]">Probá con otro título o sacá alguno de los filtros.</p><button onClick={() => { setQuery(''); setCategory(''); setAvailable(false); setMinPrice(''); setMaxPrice(''); }} className="mt-5 text-xs underline">Ver todo el catálogo</button></div>}
      </div>
    </section>
    <section className="relative isolate overflow-hidden bg-[#17263f] text-[#f5eee3]">
      <img src={ctaImage} alt="" aria-hidden="true" className="absolute inset-0 h-full w-full object-cover"/>
      <div className="absolute inset-0 bg-gradient-to-r from-[#17263f]/95 via-[#17263f]/80 to-[#17263f]/25"/>
      <div className="relative mx-auto max-w-[1320px] px-5 py-16 md:px-10 md:py-24">
        <p className="eyebrow text-[#d7b676]">05 / UNA HISTORIA NUEVA</p>
        <h2 className="serif mt-4 max-w-[650px] text-4xl leading-tight md:text-6xl">Hay un libro <em className="text-[#e1c592]">esperando por vos.</em></h2>
        <p className="mt-4 max-w-[430px] text-sm leading-6 text-[#d3d8df]">Explorá el catálogo y encontrá tu próxima lectura, a tu ritmo.</p>
        <button onClick={jumpCatalog} className="mt-7 flex items-center gap-3 bg-[#f5eee3] px-6 py-4 text-sm text-[#17263f] hover:bg-[#e1c592]">Explorar el catálogo <ArrowRight size={16}/></button>
      </div>
    </section>
    <section id="contacto" className="scroll-mt-[90px] bg-[#f1eadc]">
      <div className="mx-auto max-w-[1320px] px-5 py-14 md:px-10 md:py-20">
        <div className="mb-8">
          <p className="eyebrow text-[#7a293b]">06 / ENCONTRANOS Y RECIBÍ TU PEDIDO</p>
          <h2 className="serif mt-3 text-4xl md:text-5xl">Redes, ubicación y envíos</h2>
        </div>
        <div className="grid gap-5 lg:grid-cols-[.8fr_1.2fr]">
          <section className="border border-[#d8d0c2] bg-[#f8f4eb] p-6 md:p-8">
            <p className="eyebrow text-[#7a293b]">SEGUIMOS EN CONTACTO</p>
            <h3 className="serif mt-3 text-2xl">Hablemos de libros</h3>
            <p className="mt-3 max-w-md text-sm leading-6 text-[#626978]">Escribinos para consultar por títulos, coordinar tu compra o conocer las novedades de Nico Libros.</p>
            <div className="mt-6 flex flex-wrap gap-2">
              <a href={waLink(settings?.greetingMessage || '¡Hola Nico Libros! Quiero consultar por un libro.')} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 bg-[#17263f] px-4 py-3 text-xs text-[#f8f4eb] transition hover:bg-[#7a293b]"><MessageCircle size={15}/> WhatsApp <ArrowUpRight size={13}/></a>
              <a href={instagramUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 border border-[#d8d0c2] px-4 py-3 text-xs hover:border-[#7a293b] hover:text-[#7a293b]"><Instagram size={15}/> Instagram <ArrowUpRight size={13}/></a>
              <a href={facebookUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 border border-[#d8d0c2] px-4 py-3 text-xs hover:border-[#7a293b] hover:text-[#7a293b]">Facebook <ArrowUpRight size={13}/></a>
              {tiktokUrl && <a href={tiktokUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 border border-[#d8d0c2] px-4 py-3 text-xs hover:border-[#7a293b] hover:text-[#7a293b]">TikTok <ArrowUpRight size={13}/></a>}
            </div>
          </section>
          <section className="overflow-hidden border border-[#d8d0c2] bg-[#f8f4eb]">
            <iframe title="Mapa de Nico Libros en Córdoba" src={`https://www.google.com/maps?q=${encodeURIComponent(storeAddress)}&output=embed`} loading="lazy" referrerPolicy="no-referrer-when-downgrade" className="h-56 w-full border-0 sm:h-64"/>
            <div className="flex flex-wrap items-center justify-between gap-4 p-5 md:px-7">
              <div><p className="eyebrow text-[#7a293b]">PUNTO DE RETIRO</p><p className="mt-2 text-sm text-[#4e5663]">{storeAddress}</p></div>
              <a href={storeMapsUrl} target="_blank" rel="noreferrer" className="inline-flex shrink-0 items-center gap-2 text-xs underline underline-offset-4 hover:text-[#7a293b]">Abrir en Google Maps <ArrowUpRight size={14}/></a>
            </div>
          </section>
        </div>

        <div className="mb-6 mt-14">
          <p className="eyebrow text-[#7a293b]">OPCIONES DE ENTREGA</p>
          <h3 className="serif mt-3 text-3xl md:text-4xl">Coordinamos el envío</h3>
        </div>
        <div className="grid gap-5 xl:grid-cols-2">
          <article className="grid overflow-hidden border border-[#d8d0c2] bg-[#f8f4eb] sm:grid-cols-[190px_1fr]">
            <img src={uberDeliveryImage} alt="Libros preparados para un envío en Córdoba." loading="lazy" decoding="async" className="aspect-[4/3] h-full w-full object-cover sm:aspect-auto"/>
            <div className="p-5 md:p-7">
              <p className="eyebrow text-[#7a293b]">CÓRDOBA CAPITAL</p>
              <h4 className="serif mt-2 text-2xl">Envío por Uber Moto</h4>
              <p className="mt-3 text-sm leading-6 text-[#626978]">Coordinamos el retiro y la entrega directamente con el cadete. El pedido se prepara una vez acreditado el pago.</p>
              <details className="mt-5 border-t border-[#e1d9cb] pt-4">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-medium hover:text-[#7a293b]">Cómo funciona y cuánto cuesta <ArrowUpRight size={15}/></summary>
                <ol className="mt-4 list-decimal space-y-3 pl-5 text-sm leading-6 text-[#626978]">
                  <li>Nos brindás el número de teléfono de quien recibirá el pedido para generar el PIN de seguridad y recibir las notificaciones del envío.</li>
                  <li>Realizás el pago de los libros antes de solicitar el envío.</li>
                  <li>Una vez acreditado el pago, preparamos y embalamos los libros para que estén listos para retirar.</li>
                  <li>Solicitamos Uber Envíos Moto, con nuestro punto de retiro y tu dirección como destino.</li>
                  <li>Cuando se asigna el cadete, te compartimos el enlace para seguir el recorrido en tiempo real.</li>
                  <li>Al recibir el pedido, proporcionás el PIN de seguridad para confirmar la entrega.</li>
                </ol>
                <div className="mt-5 border-l-2 border-[#d7b676] pl-4 text-sm leading-6 text-[#626978]">
                  <p className="font-semibold text-[#17263f]">Sobre el costo del envío</p>
                  <p className="mt-2">El envío corre por cuenta del comprador. Podés enviarnos tu dirección para cotizarlo antes de solicitarlo; se puede abonar en efectivo o por transferencia.</p>
                  <p className="mt-2">El precio puede variar por demanda, clima, distancia, horario y disponibilidad de cadetes. El valor definitivo es el que informa Uber al momento de pedir el viaje.</p>
                </div>
              </details>
            </div>
          </article>
          <article className="grid overflow-hidden border border-[#d8d0c2] bg-[#f8f4eb] sm:grid-cols-[190px_1fr]">
            <img src={nationalDeliveryImage} alt="Paquete listo para despachar a otra localidad." loading="lazy" decoding="async" className="aspect-[4/3] h-full w-full object-cover sm:aspect-auto"/>
            <div className="p-5 md:p-7">
              <p className="eyebrow text-[#7a293b]">ARGENTINA</p>
              <h4 className="serif mt-2 text-2xl">Envíos a todo el país</h4>
              <p className="mt-3 text-sm leading-6 text-[#626978]">Enviamos mediante Correo Argentino, Andreani y Vía Cargo para paquetes pesados.</p>
              <details className="mt-5 border-t border-[#e1d9cb] pt-4">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-medium hover:text-[#7a293b]">Cómo funciona y cómo cotizar <ArrowUpRight size={15}/></summary>
                <ol className="mt-4 list-decimal space-y-3 pl-5 text-sm leading-6 text-[#626978]">
                  <li>Nos enviás tus datos de envío.</li>
                  <li>Cotizamos el costo según el destino y las características del paquete.</li>
                  <li>Realizás el pago del pedido y del envío.</li>
                  <li>Preparamos y despachamos tu paquete.</li>
                  <li>Te enviamos el número de seguimiento para consultar el estado del pedido.</li>
                </ol>
                <div className="mt-5 border-l-2 border-[#d7b676] pl-4 text-sm leading-6 text-[#626978]">
                  <p>El costo del envío corre por cuenta del comprador. El valor puede variar según el destino, el peso, las dimensiones y la tarifa vigente del transporte.</p>
                  <p className="mt-2 font-semibold text-[#17263f]">Consultanos el costo antes de realizar tu compra.</p>
                </div>
              </details>
            </div>
          </article>
        </div>
      </div>
    </section>
    <footer className="bg-[#17263f] text-[#f5eee3]">
      <div className="mx-auto max-w-[1320px] px-5 py-12 md:px-10 md:py-16">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-[1.1fr_.8fr_.8fr]">
      <div><img src={logo} alt="Nico Libros" className="h-[90px] w-[125px] object-contain object-center"/><p className="serif mt-4 max-w-[300px] text-2xl leading-tight">Las historias también se encuentran en persona.</p></div>
          <div><p className="eyebrow text-[#d7b676]">VENÍ A SALUDAR</p><p className="mt-4 flex gap-2 text-sm"><MapPin size={16}/>{storeAddress}</p><p className="mt-3 whitespace-pre-line text-sm leading-6 text-[#c4c9d0]">{settings?.openingHours || 'Consultanos los horarios por WhatsApp'}</p><a href={storeMapsUrl} target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center gap-2 text-xs underline">Cómo llegar <ArrowUpRight size={13}/></a></div>
          <div><p className="eyebrow text-[#d7b676]">SEGUIMOS EN CONTACTO</p><a href={waLink(settings?.greetingMessage || '¡Hola Nico Libros!')} target="_blank" rel="noreferrer" className="mt-4 flex items-center gap-2 text-sm hover:text-[#d7b676]">WhatsApp <ArrowUpRight size={14}/></a><a href={instagramUrl} target="_blank" rel="noreferrer" className="mt-3 flex items-center gap-2 text-sm hover:text-[#d7b676]"><Instagram size={15}/> Instagram <ArrowUpRight size={14}/></a><a href={facebookUrl} target="_blank" rel="noreferrer" className="mt-3 inline-flex text-sm hover:text-[#d7b676]">Facebook <ArrowUpRight size={14}/></a>{tiktokUrl && <a href={tiktokUrl} target="_blank" rel="noreferrer" className="mt-3 inline-flex text-sm hover:text-[#d7b676]">TikTok <ArrowUpRight size={14}/></a>}</div>
        </div>
        <div className="mt-12 flex flex-col justify-between gap-3 border-t border-white/20 pt-5 text-[10px] tracking-wide text-[#b5bdc8] sm:flex-row"><span>© Nico Libros · Hecho en Córdoba</span><span>LEER, COMPARTIR, VOLVER.</span></div>
        <div className="mt-8 border-t border-white/20 pt-6">
          <div className="grid gap-6 border border-white/15 bg-[#111b30] p-5 sm:grid-cols-[minmax(0,1.1fr)_1fr] sm:items-center sm:p-7 md:gap-10">
            <a href={creditUrl} target="_blank" rel="noreferrer" aria-label="Axel Rodríguez Web, diseño web" className="mx-auto block w-full max-w-[480px]">
              <img src={axelWebLogo} alt="Axel Rodríguez Web — Diseño Web" loading="lazy" decoding="async" className="aspect-[3/1] w-full object-contain"/>
            </a>
            <div className="pr-14 text-center sm:pr-0 sm:text-left">
              <p className="eyebrow text-[#d7b676]">HECHO POR AXEL RODRÍGUEZ WEB</p>
              <p className="serif mt-2 text-2xl leading-tight sm:text-3xl">¿Querés una web o una tienda virtual como esta?</p>
              <a href={creditUrl} target="_blank" rel="noreferrer" className="mt-5 inline-flex items-center gap-3 bg-[#d7b676] px-5 py-3 text-sm font-medium text-[#17263f] transition hover:bg-[#f5eee3]">
                Conocé mi página <ArrowUpRight size={16}/>
              </a>
            </div>
          </div>
        </div>
      </div>
    </footer>
    <a href={waLink(settings?.greetingMessage || '¡Hola Nico Libros! Quiero consultar por un libro.')} target="_blank" rel="noreferrer" aria-label="Escribinos por WhatsApp" className="fixed bottom-5 right-5 z-40 flex items-center gap-2 border border-[#d7b676] bg-[#17263f] px-3 py-3 text-xs text-white shadow-lg transition hover:bg-[#7a293b] sm:px-4"><MessageCircle size={17}/><span className="hidden sm:inline">WhatsApp</span></a>
    {sentOrder && <div role="status" className="fixed bottom-20 left-1/2 z-[70] flex -translate-x-1/2 items-center gap-3 border border-[#a3b39c] bg-[#edf2e8] px-5 py-4 text-sm shadow-lg"><Check size={18} className="text-[#456346]"/> Pedido {sentOrder} creado. Se abrió WhatsApp para coordinarlo.<button onClick={() => setSentOrder(null)} aria-label="Cerrar aviso"><X size={16}/></button></div>}
    {detail && <BookDialog book={detail} onClose={() => setDetail(null)} onAdd={addToCart}/>}
    {cartOpen && <CartDrawer cart={cart} total={total} onClose={() => setCartOpen(false)} onQty={changeQty} onCheckout={() => { setCartOpen(false); setCheckoutOpen(true); }}/>}
    {checkoutOpen && <CheckoutDialog cart={cart} total={total} settings={settings} pending={createOrder.isPending} error={createOrder.isError} onClose={() => setCheckoutOpen(false)} onSubmit={submitOrder} retry={() => createOrder.reset()}/>}
  </main>;
}

function BookCard({ book, onOpen, onAdd }: { book: Book; onOpen: (book: Book) => void; onAdd: (book: Book, quantity?: number) => void }) {
  const [quantity, setQuantity] = useState(1);
  const stockLabel = book.stock <= 0 ? 'Sin stock' : book.stock <= 3 ? (book.stock === 1 ? 'Última unidad' : `Últimas ${book.stock} unidades`) : 'Disponible';
  return <article className="group min-w-0" data-testid={`card-book-${book.id}`}>
    <button onClick={() => onOpen(book)} className="book-card-container book-spine-effect relative block aspect-[.76] w-full overflow-hidden border border-[#d6cbb9] bg-[#e7ddce] text-left">
      {book.coverUrl ? <img src={book.coverUrl} alt={`Tapa de ${book.title}`} className="book-cover h-full w-full object-cover"/> :
        <div className="book-cover absolute inset-[9%] flex flex-col justify-between border border-[#d0c3ad] bg-[#eee4d2] p-4 text-center sm:p-6"><span className="eyebrow text-[#7a293b]">{book.categoryName || 'NICO LIBROS'}</span><span className="serif text-2xl leading-tight text-[#17263f] sm:text-3xl">{book.title}</span><span className="text-[10px] uppercase tracking-[.16em] text-[#6e6b63]">{book.author}</span></div>}
       {book.stock <= 0 && <span className="absolute left-2 top-2 z-10 bg-[#17263f] px-2 py-1 text-[9px] uppercase tracking-[.12em] text-white">Sin stock</span>}
      {book.demo && <span className="absolute right-2 top-2 z-10 bg-[#f7f0e2] px-2 py-1 text-[9px] text-[#725d39]">Demo</span>}
    </button>
    <div className="pt-3"><p className="truncate text-[10px] uppercase tracking-[.13em] text-[#827a6c]">{book.categoryName || 'LIBROS'}</p><button onClick={() => onOpen(book)} className="serif mt-1 line-clamp-2 min-h-[47px] text-[17px] leading-tight text-[#17263f] hover:text-[#7a293b]">{book.title}</button><p className="mt-1 truncate text-xs text-[#6d727b]">{book.author}</p><p className={`mt-2 text-[10px] ${book.stock <= 3 ? 'text-[#7a293b]' : 'text-[#536c4d]'}`}>{stockLabel}</p>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2"><span className="text-sm font-semibold">{money(book.price)}</span><div className="flex items-center border border-[#d4cbbd]"><button aria-label={`Restar cantidad de ${book.title}`} disabled={quantity <= 1} onClick={() => setQuantity(value => Math.max(1, value - 1))} className="p-2 disabled:opacity-40"><Minus size={12}/></button><span className="w-5 text-center text-xs">{quantity}</span><button aria-label={`Sumar cantidad de ${book.title}`} disabled={book.stock <= 0 || quantity >= book.stock} onClick={() => setQuantity(value => Math.min(book.stock, value + 1))} className="p-2 disabled:opacity-40"><Plus size={12}/></button></div><button disabled={book.stock <= 0} onClick={() => { onAdd(book, quantity); setQuantity(1); }} className="w-full border border-[#17263f] px-3 py-2 text-[10px] uppercase tracking-wide transition hover:bg-[#17263f] hover:text-white disabled:cursor-not-allowed disabled:border-[#c8c2b7] disabled:text-[#96938c]">Agregar al carrito</button></div>
    </div>
  </article>;
}
function LoadingRow() { return <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">{[0,1,2,3].map(n => <div key={n} className="animate-pulse"><div className="aspect-[.76] bg-[#e5ddcf]"/><div className="mt-3 h-3 w-2/3 bg-[#e5ddcf]"/><div className="mt-2 h-4 w-4/5 bg-[#e5ddcf]"/></div>)}</div>; }
function CatalogSkeleton() { return <LoadingRow/>; }
function InlineError({ retry, label }: { retry: () => void; label: string }) { return <div role="alert" className="flex flex-wrap items-center justify-between gap-4 border border-[#d8b7b3] bg-[#f5e8e4] p-5 text-sm text-[#702d36]"><span className="flex items-center gap-2"><CircleAlert size={17}/>{label}</span><button onClick={retry} className="underline underline-offset-4">Reintentar</button></div>; }
function Overlay({ children, onClose, side = false }: { children: ReactNode; onClose: () => void; side?: boolean }) { return <div className="fixed inset-0 z-[60] flex justify-end bg-[#101a2a]/50" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}><div className={`${side ? 'h-full w-full max-w-[470px] overflow-y-auto' : 'm-auto max-h-[92dvh] w-[calc(100%-24px)] max-w-[650px] overflow-y-auto'} bg-[#f8f4eb] shadow-2xl`}>{children}</div></div>; }
function BookDialog({ book, onClose, onAdd }: { book: Book; onClose: () => void; onAdd: (book: Book) => void }) { return <Overlay onClose={onClose}><div className="relative grid gap-6 p-6 sm:grid-cols-[.8fr_1.2fr] sm:p-9"><button onClick={onClose} aria-label="Cerrar detalle" className="absolute right-4 top-4"><X size={20}/></button><div className="aspect-[.76] max-h-[430px] overflow-hidden border border-[#d6cbb9] bg-[#e7ddce]">{book.coverUrl ? <img src={book.coverUrl} alt={`Tapa de ${book.title}`} className="h-full w-full object-cover"/> : <div className="flex h-full flex-col items-center justify-center p-5 text-center"><BookOpen size={38} className="text-[#7a293b]"/><p className="serif mt-6 text-3xl">{book.title}</p><p className="mt-3 text-xs">{book.author}</p></div>}</div><div className="flex flex-col justify-center"><p className="eyebrow text-[#7a293b]">{book.categoryName || 'NICO LIBROS'} {book.demo ? '· DEMO' : ''}</p><h2 className="serif mt-3 text-3xl leading-tight">{book.title}</h2><p className="mt-2 text-sm text-[#69707a]">{book.author}</p>{book.synopsis && <p className="mt-6 whitespace-pre-line text-sm font-medium leading-7 text-[#596170]">{book.synopsis}</p>}<p className="mt-4 whitespace-pre-line text-sm leading-7 text-[#596170]">{book.description || 'Consultanos por más información sobre este libro.'}</p>{book.videoUrl && <a href={book.videoUrl} target="_blank" rel="noreferrer" className="mt-4 text-sm text-[#7a293b] underline underline-offset-4">Ver video del libro</a>}<p className="serif mt-7 text-2xl">{money(book.price)}</p><p className={`mt-2 text-xs ${book.stock <= 3 ? 'text-[#7a293b]' : 'text-[#536c4d]'}`}>{book.stock <= 0 ? 'Sin stock' : book.stock <= 3 ? (book.stock === 1 ? 'Última unidad' : `Últimas ${book.stock} unidades`) : 'Disponible'}</p><button disabled={book.stock <= 0} onClick={() => onAdd(book)} className="mt-6 flex items-center justify-center gap-3 bg-[#17263f] px-5 py-4 text-sm text-white hover:bg-[#7a293b] disabled:cursor-not-allowed disabled:opacity-40"><ShoppingBag size={16}/> Agregar al carrito</button></div></div></Overlay>; }
function CartDrawer({ cart, total, onClose, onQty, onCheckout }: { cart: CartLine[]; total: number; onClose: () => void; onQty: (id: number, d: number) => void; onCheckout: () => void }) {
  return <Overlay onClose={onClose} side><div className="flex items-center justify-between border-b border-[#d9cfbf] px-6 py-5"><div><p className="eyebrow text-[#7a293b]">TU SELECCIÓN</p><h2 className="serif mt-1 text-2xl">La bolsa</h2></div><button onClick={onClose} aria-label="Cerrar bolsa"><X/></button></div>
    {cart.length ? <><div className="divide-y divide-[#ded5c5] px-6">{cart.map(line => <div key={line.book.id} className="flex gap-4 py-5"><div className="flex h-[84px] w-[65px] shrink-0 items-center justify-center border border-[#d6cbb9] bg-[#e7ddce] px-2 text-center"><span className="serif line-clamp-4 text-[11px]">{line.book.title}</span></div><div className="min-w-0 flex-1"><p className="serif line-clamp-2">{line.book.title}</p><p className="mt-1 text-xs text-[#717783]">{line.book.author}</p><div className="mt-3 flex items-center justify-between"><div className="flex items-center border border-[#d4cbbd]"><button aria-label="Restar uno" onClick={() => onQty(line.book.id, -1)} className="p-2"><Minus size={13}/></button><span className="w-6 text-center text-xs">{line.quantity}</span><button aria-label="Sumar uno" disabled={line.quantity >= line.book.stock} onClick={() => onQty(line.book.id, 1)} className="p-2 disabled:opacity-40"><Plus size={13}/></button></div><span className="text-sm font-semibold">{money(line.book.price * line.quantity)}</span></div></div></div>)}</div><div className="sticky bottom-0 border-t border-[#d9cfbf] bg-[#f8f4eb] px-6 py-5"><div className="flex justify-between text-sm"><span>Total estimado</span><b>{money(total)}</b></div><p className="mt-2 text-[11px] text-[#747983]">El envío se coordina al confirmar tu pedido.</p><button onClick={onCheckout} className="mt-5 w-full bg-[#17263f] py-4 text-sm text-white hover:bg-[#7a293b]">Continuar con el pedido <ArrowRight className="ml-2 inline" size={15}/></button></div></> :
      <div className="flex min-h-[65vh] flex-col items-center justify-center px-8 text-center"><ShoppingBag size={31} strokeWidth={1.3} className="text-[#7a293b]"/><h3 className="serif mt-4 text-2xl">Todavía está vacía</h3><p className="mt-2 text-sm text-[#717783]">Cuando encuentres un libro, acá lo guardamos.</p><button onClick={onClose} className="mt-5 text-xs underline underline-offset-4">Seguir mirando</button></div>}
  </Overlay>;
}
function CheckoutDialog({ cart, total, settings, pending, error, onClose, onSubmit, retry }: { cart: CartLine[]; total: number; settings?: { paymentMethods: string[]; deliveryInfo: string; pickupAddress: string; pickupHours: string }; pending: boolean; error: boolean; onClose: () => void; onSubmit: (e: FormEvent<HTMLFormElement>) => void; retry: () => void }) {
  const [fulfillment, setFulfillment] = useState('delivery');
  const payments = settings?.paymentMethods?.length ? settings.paymentMethods : ['cash', 'transfer', 'coordinate'];
  const paymentNames: Record<string, string> = { cash: 'Efectivo', transfer: 'Transferencia', coordinate: 'A coordinar' };
  return <Overlay onClose={onClose}><form onSubmit={onSubmit} className="p-6 sm:p-9"><div className="flex justify-between"><div><p className="eyebrow text-[#7a293b]">UN PASO MÁS</p><h2 className="serif mt-2 text-3xl">Coordinar el pedido</h2></div><button type="button" onClick={onClose} aria-label="Cerrar checkout"><X/></button></div><p className="mt-3 text-sm leading-6 text-[#68707a]">Dejanos tus datos. Una persona de Nico Libros te escribe por WhatsApp para confirmar.</p>
    <div className="mt-6 grid gap-4 sm:grid-cols-2"><Field label="Tu nombre"><input name="name" required minLength={2} maxLength={120} className="admin-input" placeholder="¿Cómo te llamás?"/></Field><Field label="Teléfono / WhatsApp"><input name="phone" type="tel" required minLength={8} maxLength={24} className="admin-input" placeholder="351 000 0000"/></Field></div>
    <Field label="¿Cómo lo recibís?" className="mt-5"><div className="grid grid-cols-2 gap-2"><label className={`border p-3 text-sm ${fulfillment === 'delivery' ? 'border-[#7a293b] bg-[#f0e6dc]' : 'border-[#d9cfbf]'}`}><input type="radio" name="fulfillment" value="delivery" checked={fulfillment === 'delivery'} onChange={() => setFulfillment('delivery')} className="mr-2 accent-[#7a293b]"/>Envío</label><label className={`border p-3 text-sm ${fulfillment === 'pickup' ? 'border-[#7a293b] bg-[#f0e6dc]' : 'border-[#d9cfbf]'}`}><input type="radio" name="fulfillment" value="pickup" checked={fulfillment === 'pickup'} onChange={() => setFulfillment('pickup')} className="mr-2 accent-[#7a293b]"/>Retiro</label></div></Field>
    {fulfillment === 'delivery' ? <div className="mt-4 grid gap-4 sm:grid-cols-2"><Field label="Dirección"><input name="address" required className="admin-input" placeholder="Calle y número"/></Field><Field label="Barrio / zona"><input name="area" required className="admin-input" placeholder="Tu zona"/></Field></div> : <p className="mt-4 border-l-2 border-[#7a293b] bg-[#f0e9dd] p-3 text-xs leading-5 text-[#666c73]">{settings?.pickupAddress || 'Coordinamos el punto de retiro por WhatsApp.'} {settings?.pickupHours}</p>}
    <Field label="Preferencia de pago" className="mt-5"><select name="payment" className="admin-input">{payments.map(payment => <option key={payment} value={payment}>{paymentNames[payment] || payment}</option>)}</select></Field>
    <Field label="Algo más que quieras contarnos" className="mt-4"><textarea name="notes" maxLength={500} rows={2} className="admin-input resize-y" placeholder="Opcional"/></Field>
    {settings?.deliveryInfo && <p className="mt-3 text-[11px] text-[#707680]">{settings.deliveryInfo}</p>}
    <div className="mt-5 border-t border-[#d9cfbf] pt-4"><div className="flex justify-between text-sm"><span>{cart.reduce((s,l) => s + l.quantity, 0)} libros · total estimado</span><b>{money(total)}</b></div></div>
    {error && <div role="alert" className="mt-4 flex items-center justify-between bg-[#f4e5e1] p-3 text-xs text-[#7a293b]"><span>No pudimos crear el pedido. Revisá tu conexión e intentá de nuevo.</span><button type="button" onClick={retry} className="underline">Reintentar</button></div>}
    <button disabled={pending || !cart.length} className="mt-5 w-full bg-[#17263f] py-4 text-sm text-white disabled:opacity-60">{pending ? 'Enviando pedido…' : 'Confirmar y seguir por WhatsApp'} <ArrowRight size={15} className="ml-2 inline"/></button>
  </form></Overlay>;
}
function Field({ label, children, className = '' }: { label: string; children: ReactNode; className?: string }) { return <label className={`block ${className}`}><span className="mb-2 block text-xs font-semibold text-[#4c5562]">{label}</span>{children}</label>; }

type AdminTab = 'dashboard' | 'books' | 'categories' | 'orders' | 'finance' | 'settings';
function Admin() {
  useEffect(() => {
    setPageMeta(
      'Administración | Nico Libros',
      'Acceso privado para administrar libros y pedidos de Nico Libros.',
      'noindex, nofollow',
    );
  }, []);
  const client = useQueryClient();
  const session = useGetAdminSession({ query: { queryKey: getGetAdminSessionQueryKey(), retry: false } });
  const login = useAdminLogin();
  const logout = useAdminLogout();
  const [tab, setTab] = useState<AdminTab>('dashboard');
  const [modal, setModal] = useState<'book' | 'category' | 'purchase' | 'expense' | null>(null);
  const [editBook, setEditBook] = useState<AdminBookRecord | null>(null);
  const [editCategory, setEditCategory] = useState<Category | null>(null);
  const [purchaseBook, setPurchaseBook] = useState<AdminBookRecord | null>(null);
  const [loginError, setLoginError] = useState('');
  const [adminNav, setAdminNav] = useState(false);
  const onLogin = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault(); const data = new FormData(e.currentTarget);
    login.mutate({ data: { email: String(data.get('email')), password: String(data.get('password')) } }, { onSuccess: () => { setLoginError(''); client.invalidateQueries({ queryKey: getGetAdminSessionQueryKey() }); }, onError: () => setLoginError('No pudimos iniciar sesión. Revisá tu correo y contraseña.') });
  };
  if (session.isLoading) return <AdminLoading/>;
  if (!session.data?.authenticated) return <AdminLogin onSubmit={onLogin} loading={login.isPending} error={loginError} retry={() => { setLoginError(''); session.refetch(); }}/>;
  const tabs: { id: AdminTab; label: string }[] = [{ id: 'dashboard', label: 'Resumen' }, { id: 'books', label: 'Libros' }, { id: 'categories', label: 'Categorías' }, { id: 'orders', label: 'Pedidos' }, { id: 'finance', label: 'Compras y finanzas' }, { id: 'settings', label: 'La tienda' }];
  return <div className="min-h-[100dvh] bg-[#f2eee5]">
    <header className="sticky top-0 z-40 border-b border-[#d8d0c2] bg-[#f8f4eb]"><div className="mx-auto flex h-[70px] max-w-[1440px] items-center justify-between px-4 md:px-8">
      <div className="flex items-center gap-3"><img src={logo} alt="Nico Libros" className="h-10 w-14 object-contain"/><div><p className="serif text-lg">Nico Libros</p><p className="eyebrow text-[8px] text-[#7a293b]">PANEL DE LA LIBRERÍA</p></div></div>
      <div className="flex items-center gap-3"><Link href="/" className="hidden text-xs underline underline-offset-4 sm:block">Ver tienda</Link><button onClick={() => { logout.mutate(undefined, { onSuccess: () => client.invalidateQueries({ queryKey: getGetAdminSessionQueryKey() }) }); }} disabled={logout.isPending} className="border border-[#d8d0c2] px-3 py-2 text-xs hover:bg-[#eee6d9]">{logout.isPending ? 'Saliendo…' : 'Cerrar sesión'}</button><button className="p-2 md:hidden" onClick={() => setAdminNav(v => !v)} aria-label="Abrir menú"><Menu size={19}/></button></div>
    </div></header>
    <div className="mx-auto grid max-w-[1440px] md:grid-cols-[220px_1fr]">
      <aside className={`${adminNav ? 'block' : 'hidden'} border-r border-[#d8d0c2] bg-[#f6f1e8] p-4 md:block md:min-h-[calc(100dvh-70px)] md:p-5`}>
        <p className="eyebrow mb-4 px-3 text-[#938873]">GESTIÓN</p>{tabs.map((item, i) => <button key={item.id} onClick={() => { setTab(item.id); setAdminNav(false); }} className={`mb-1 flex w-full items-center justify-between px-3 py-3 text-left text-sm ${tab === item.id ? 'bg-[#17263f] text-[#f8f4eb]' : 'text-[#505967] hover:bg-[#e9e1d3]'}`}><span>{item.label}</span><span className={`text-[10px] ${tab === item.id ? 'text-[#d5b776]' : 'text-[#9a958a]'}`}>0{i + 1}</span></button>)}
        <div className="mt-10 border-t border-[#d8d0c2] px-3 pt-5"><p className="eyebrow text-[#7a293b]">ESTADO</p><p className="mt-2 flex items-center gap-2 text-xs text-[#526b4e]"><span className="h-2 w-2 rounded-full bg-[#6c8c5e]"/> Sesión activa</p><p className="mt-1 truncate text-[11px] text-[#83868a]">{session.data.email}</p></div>
      </aside>
      <main className="min-w-0 px-4 py-7 md:px-8 md:py-10">
        {tab === 'dashboard' && <AdminDashboard/>}
        {tab === 'books' && <AdminBooks onCreate={() => { setEditBook(null); setModal('book'); }} onEdit={book => { setEditBook(book); setModal('book'); }} onPurchase={book => { setPurchaseBook(book); setModal('purchase'); }} onCreatePurchase={() => { setPurchaseBook(null); setModal('purchase'); }}/>}
        {tab === 'categories' && <AdminCategories onCreate={() => { setEditCategory(null); setModal('category'); }} onEdit={item => { setEditCategory(item); setModal('category'); }}/>}
        {tab === 'orders' && <AdminOrders/>}
        {tab === 'finance' && <AdminFinance onCreatePurchase={() => { setPurchaseBook(null); setModal('purchase'); }} onCreateExpense={() => setModal('expense')}/>}
        {tab === 'settings' && <AdminSettings/>}
      </main>
    </div>
    {modal === 'book' && <BookForm book={editBook} onClose={() => setModal(null)} onSaved={() => { setModal(null); client.invalidateQueries({ queryKey: getGetAdminBooksQueryKey() }); client.invalidateQueries({ queryKey: getGetCatalogQueryKey() }); client.invalidateQueries({ queryKey: getGetBestsellersQueryKey() }); }}/>}
    {modal === 'category' && <CategoryForm category={editCategory} onClose={() => setModal(null)} onSaved={() => { setModal(null); client.invalidateQueries({ queryKey: getGetAdminCategoriesQueryKey() }); client.invalidateQueries({ queryKey: getGetCatalogQueryKey() }); }}/>}
    {modal === 'purchase' && <PurchaseForm book={purchaseBook} onClose={() => setModal(null)} onSaved={() => { setModal(null); client.invalidateQueries({ queryKey: getGetAdminBooksQueryKey() }); client.invalidateQueries({ queryKey: getGetCatalogQueryKey() }); client.invalidateQueries({ queryKey: getGetBestsellersQueryKey() }); client.invalidateQueries({ queryKey: getGetAdminDashboardQueryKey() }); client.invalidateQueries({ queryKey: getGetAdminReportQueryKey() }); }}/>}
    {modal === 'expense' && <FinanceExpenseForm onClose={() => setModal(null)} onSaved={() => { setModal(null); client.invalidateQueries({ queryKey: getGetAdminReportQueryKey() }); }}/>}
  </div>;
}
function AdminLoading() { return <div className="min-h-[100dvh] bg-[#f2eee5] p-8"><div className="mx-auto max-w-5xl animate-pulse"><div className="h-14 bg-[#e3dacb]"/><div className="mt-10 h-8 w-1/3 bg-[#e3dacb]"/><div className="mt-7 grid grid-cols-2 gap-4 md:grid-cols-4">{[1,2,3,4].map(n => <div key={n} className="h-28 bg-[#e3dacb]"/>)}<div className="col-span-2 h-60 bg-[#e3dacb] md:col-span-4"/></div></div></div>; }
function AdminLogin({ onSubmit, loading, error, retry }: { onSubmit: (e: FormEvent<HTMLFormElement>) => void; loading: boolean; error: string; retry: () => void }) { return <main className="paper-grain grid min-h-[100dvh] place-items-center bg-[#f1eadc] p-5"><div className="grid w-full max-w-[860px] overflow-hidden border border-[#d8d0c2] bg-[#f8f4eb] shadow-lg md:grid-cols-[.9fr_1.1fr]"><div className="hidden bg-[#17263f] p-10 text-[#f5eee3] md:flex md:flex-col md:justify-between"><img src={logo} alt="Nico Libros" className="h-[105px] w-[145px] object-contain"/><div><p className="eyebrow text-[#d7b676]">GESTIÓN DE LIBRERÍA</p><h1 className="serif mt-4 text-4xl leading-tight">Una buena tienda también se cuida desde adentro.</h1></div><p className="text-xs text-[#b8c0cc]">Nico Libros · Córdoba</p></div><form onSubmit={onSubmit} className="p-7 sm:p-10"><Link href="/" className="text-xs underline underline-offset-4">← Volver a la tienda</Link><p className="eyebrow mt-9 text-[#7a293b]">ADMINISTRACIÓN</p><h2 className="serif mt-3 text-3xl">Qué bueno verte</h2><p className="mt-2 text-sm text-[#6b717a]">Ingresá para gestionar el catálogo y los pedidos.</p><Field label="Correo electrónico" className="mt-7"><input name="email" required type="email" autoComplete="username" className="admin-input" placeholder="tu@libreria.com"/></Field><Field label="Contraseña" className="mt-4"><input name="password" required type="password" minLength={8} autoComplete="current-password" className="admin-input" placeholder="••••••••"/></Field>{error && <div role="alert" className="mt-4 flex items-center justify-between bg-[#f4e5e1] p-3 text-xs text-[#7a293b]"><span>{error}</span><button type="button" onClick={retry} aria-label="Reintentar" className="underline">Reintentar</button></div>}<button disabled={loading} className="mt-6 w-full bg-[#17263f] py-4 text-sm text-white hover:bg-[#7a293b] disabled:opacity-60">{loading ? 'Ingresando…' : 'Ingresar al panel'} <ArrowRight size={15} className="ml-2 inline"/></button><p className="mt-5 text-[11px] leading-5 text-[#84878a]">Acceso exclusivo para el equipo de Nico Libros.</p></form></div></main>; }
function AdminTitle({ eyebrow, title, children }: { eyebrow: string; title: string; children?: ReactNode }) { return <div className="mb-7 flex flex-wrap items-end justify-between gap-4"><div><p className="eyebrow text-[#7a293b]">{eyebrow}</p><h1 className="serif mt-2 text-3xl md:text-4xl">{title}</h1></div>{children}</div>; }
function QueryError({ retry }: { retry: () => void }) { return <div role="alert" className="border border-[#d8b7b3] bg-[#f5e8e4] p-5 text-sm text-[#702d36]">No pudimos cargar estos datos. <button onClick={retry} className="ml-2 underline">Reintentar</button></div>; }
function AdminDashboard() {
  const q = useGetAdminDashboard({ query: { queryKey: getGetAdminDashboardQueryKey() } });
  if (q.isLoading) return <AdminLoading/>;
  return <><AdminTitle eyebrow="01 / VISTA GENERAL" title="El pulso de la tienda"/>{q.isError ? <QueryError retry={() => q.refetch()}/> : q.data ? <>
    <p className="mb-5 inline-flex items-center gap-2 border border-[#d4c1a0] bg-[#f7f0e2] px-3 py-2 text-[11px] text-[#725d39]"><CircleAlert size={14}/> Datos operativos del panel; no son reseñas ni estimaciones.</p>
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{[['Libros vendidos hoy', q.data.salesToday], ['Libros vendidos esta semana', q.data.salesWeek], ['Libros vendidos este mes', q.data.salesMonth], ['Ingresos del mes', money(q.data.revenueMonth)]].map(([label, value]) => <div key={String(label)} className="border border-[#d8d0c2] bg-[#f8f4eb] p-5"><p className="text-xs text-[#757b83]">{label}</p><p className="serif mt-3 text-2xl">{value}</p></div>)}</div>
    <div className="mt-5 grid gap-5 lg:grid-cols-[1.1fr_.9fr]"><div className="border border-[#d8d0c2] bg-[#f8f4eb] p-5"><h2 className="serif text-xl">Atención de stock</h2><div className="mt-5 grid grid-cols-2 gap-3"><div className="bg-[#eee7dc] p-4"><p className="text-xs text-[#717783]">Stock bajo</p><p className="serif mt-2 text-3xl">{q.data.lowStockCount}</p></div><div className="bg-[#f2e4e1] p-4"><p className="text-xs text-[#7a293b]">Agotados</p><p className="serif mt-2 text-3xl">{q.data.outOfStockCount}</p></div></div></div><div className="border border-[#d8d0c2] bg-[#f8f4eb] p-5"><h2 className="serif text-xl">Lecturas más pedidas</h2>{q.data.topBooks.length ? <div className="mt-4 divide-y divide-[#e1d9cb]">{q.data.topBooks.map((book, i) => <div key={`${book.title}-${i}`} className="flex items-center justify-between py-3 text-sm"><span className="flex items-center gap-3"><span className="serif italic text-[#7a293b]">0{i+1}</span>{book.title}</span><b>{book.units} u.</b></div>)}</div> : <p className="mt-5 text-sm text-[#747983]">Todavía no hay movimiento para mostrar.</p>}</div></div>
    <div className="mt-5 border-l-2 border-[#7a293b] bg-[#eee7dc] p-4 text-xs leading-5 text-[#666c73]"><Clock3 size={15} className="mr-2 inline"/> Los indicadores reflejan pedidos registrados en el sistema. No se muestran opiniones de clientes.</div>
  </> : <div className="border border-dashed p-10 text-center text-sm text-[#747983]">Todavía no hay datos para mostrar.</div>}</>;
}
type ReportRange = 'day' | 'week' | 'month' | 'year' | 'custom';

function dateInputValue(date: Date) {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 10);
}

type TimelineUnit = 'hour' | 'day' | 'month';

function cordobaDateParts(value: Date) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Argentina/Cordoba',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(value);
  const part = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find(item => item.type === type)?.value);
  return { year: part('year'), month: part('month'), day: part('day'), hour: part('hour') };
}

function timelineBucketKeys(from: string, to: string, unit: TimelineUnit) {
  const start = new Date(from);
  const end = new Date(to);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start >= end) return [];
  const pad = (value: number) => String(value).padStart(2, '0');
  const keys: string[] = [];
  if (unit === 'hour') {
    const cursor = new Date(start);
    cursor.setUTCMinutes(0, 0, 0);
    while (cursor < end) {
      const date = cordobaDateParts(cursor);
      keys.push(`${date.year}-${pad(date.month)}-${pad(date.day)} ${pad(date.hour)}:00`);
      cursor.setTime(cursor.getTime() + 60 * 60 * 1000);
    }
    return keys;
  }
  const first = cordobaDateParts(start);
  const last = cordobaDateParts(new Date(end.getTime() - 1));
  const cursor = new Date(Date.UTC(first.year, first.month - 1, unit === 'day' ? first.day : 1));
  const lastBucket = unit === 'day'
    ? Date.UTC(last.year, last.month - 1, last.day)
    : Date.UTC(last.year, last.month - 1, 1);
  while (cursor.getTime() <= lastBucket) {
    const year = cursor.getUTCFullYear();
    const month = pad(cursor.getUTCMonth() + 1);
    keys.push(unit === 'day' ? `${year}-${month}-${pad(cursor.getUTCDate())}` : `${year}-${month}`);
    cursor.setUTCDate(cursor.getUTCDate() + (unit === 'day' ? 1 : 0));
    if (unit === 'month') cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  return keys;
}

function timelineBucketLabel(bucket: string, unit: TimelineUnit, full = false) {
  if (unit === 'hour') return full ? `${bucket.slice(0, 10)} · ${bucket.slice(11)}` : bucket.slice(11, 16);
  if (unit === 'day') {
    return new Intl.DateTimeFormat('es-AR', full
      ? { dateStyle: 'medium', timeZone: 'UTC' }
      : { day: '2-digit', month: 'short', timeZone: 'UTC' })
      .format(new Date(`${bucket}T12:00:00Z`));
  }
  return new Intl.DateTimeFormat('es-AR', full
    ? { month: 'long', year: 'numeric', timeZone: 'UTC' }
    : { month: 'short', year: '2-digit', timeZone: 'UTC' })
    .format(new Date(`${bucket}-01T12:00:00Z`));
}

function AdminFinance({ onCreatePurchase, onCreateExpense }: { onCreatePurchase: () => void; onCreateExpense: () => void }) {
  const now = new Date();
  const [range, setRange] = useState<ReportRange>('month');
  const [fromInput, setFromInput] = useState(() => dateInputValue(new Date(now.getFullYear(), now.getMonth(), 1)));
  const [toInput, setToInput] = useState(() => dateInputValue(now));
  const period = useMemo(() => {
    let from: Date;
    let to: Date;
    if (range === 'custom') {
      if (!fromInput || !toInput) return null;
      from = new Date(`${fromInput}T00:00:00`);
      to = new Date(`${toInput}T00:00:00`);
      if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from > to) return null;
      to.setDate(to.getDate() + 1);
    } else {
      from = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      if (range === 'week') {
        from.setDate(from.getDate() - ((from.getDay() + 6) % 7));
      } else if (range === 'month') {
        from = new Date(now.getFullYear(), now.getMonth(), 1);
      } else if (range === 'year') {
        from = new Date(now.getFullYear(), 0, 1);
      }
      to = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    }
    return { from: from.toISOString(), to: to.toISOString() };
  }, [range, fromInput, toInput]);
  const params = period ?? { from: now.toISOString(), to: new Date(now.getTime() + 1).toISOString() };
  const report = useGetAdminReport(params, {
    query: { queryKey: getGetAdminReportQueryKey(params), enabled: period !== null },
  });
  const timelineData = useMemo(() => {
    if (!period || !report.data) return [];
    const points = new Map(report.data.salesTimeline.map(point => [point.bucket, point]));
    return timelineBucketKeys(period.from, period.to, report.data.timelineUnit).map(bucket => ({
      bucket,
      units: points.get(bucket)?.units ?? 0,
      revenue: points.get(bucket)?.revenue ?? 0,
      expenses: points.get(bucket)?.expenses ?? 0,
    }));
  }, [period, report.data]);
  const totalExpenses = (report.data?.purchaseSpend ?? 0) + (report.data?.expenseSpend ?? 0);
  const financeMetrics = report.data ? [
    ['Libros vendidos', report.data.salesUnits],
    ['Pedidos confirmados', report.data.salesOrders],
    ['Ingresos por ventas', money(report.data.revenue)],
    ['Costo de libros vendidos', money(report.data.costOfGoods)],
    ['Margen bruto estimado', money(report.data.grossProfit)],
    ['Libros comprados', report.data.purchaseUnits],
    ['Compras de inventario', money(report.data.purchaseSpend)],
    ['Otros gastos', money(report.data.expenseSpend)],
    ['Egresos totales', money(totalExpenses)],
    ['Flujo neto de caja estimado', money(report.data.revenue - totalExpenses)],
    ['Compras registradas', report.data.purchaseCount],
    ['Gastos registrados', report.data.expenseCount],
  ] : [];
  const dateLabel = (value: string) => new Intl.DateTimeFormat('es-AR', { dateStyle: 'medium' }).format(new Date(value));

  return <>
    <AdminTitle eyebrow="05 / NÚMEROS DE LA LIBRERÍA" title="Compras y finanzas">
      <div className="flex flex-wrap gap-2">
        <button onClick={onCreateExpense} className="border border-[#17263f] px-4 py-3 text-xs hover:bg-[#eee6d9]"><Plus size={15} className="mr-2 inline"/>Registrar gasto</button>
        <button onClick={onCreatePurchase} className="bg-[#17263f] px-4 py-3 text-xs text-white hover:bg-[#7a293b]"><Plus size={15} className="mr-2 inline"/>Registrar compra</button>
      </div>
    </AdminTitle>
    <div className="mb-5 flex flex-wrap items-end gap-3 border border-[#d8d0c2] bg-[#f8f4eb] p-4">
      <label className="text-xs font-semibold text-[#4c5562]">Período
        <select value={range} onChange={event => setRange(event.target.value as ReportRange)} className="admin-input mt-2 min-w-44">
          <option value="day">Hoy</option><option value="week">Esta semana</option><option value="month">Este mes</option><option value="year">Este año</option><option value="custom">Personalizado</option>
        </select>
      </label>
      {range === 'custom' && <>
        <label className="text-xs font-semibold text-[#4c5562]">Desde<input type="date" value={fromInput} max={toInput || undefined} onChange={event => setFromInput(event.target.value)} className="admin-input mt-2"/></label>
        <label className="text-xs font-semibold text-[#4c5562]">Hasta<input type="date" value={toInput} min={fromInput || undefined} onChange={event => setToInput(event.target.value)} className="admin-input mt-2"/></label>
      </>}
      {range === 'custom' && period && <p className="pb-3 text-xs text-[#717783]">{dateLabel(period.from)} – {dateLabel(new Date(new Date(period.to).getTime() - 1).toISOString())}</p>}
    </div>
    {!period ? <div role="alert" className="border border-[#d8b7b3] bg-[#f5e8e4] p-5 text-sm text-[#702d36]">Elegí un rango de fechas válido.</div> :
      report.isLoading ? <LoadingRow/> : report.isError ? <QueryError retry={() => report.refetch()}/> : report.data ? <>
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">{financeMetrics.map(([label, value]) => <div key={String(label)} className="border border-[#d8d0c2] bg-[#f8f4eb] p-4 sm:p-5"><p className="text-xs text-[#757b83]">{label}</p><p className="serif mt-3 text-xl sm:text-2xl">{value}</p></div>)}</div>
        <p className="mt-3 text-[11px] leading-5 text-[#747983]">El margen bruto descuenta el costo de los libros vendidos. El flujo neto estima ingresos por ventas menos compras de inventario y otros gastos; no incluye impuestos, comisiones ni gastos que no registres.</p>
        <div className="mt-6 grid gap-5 xl:grid-cols-2">
          <section className="min-w-0 border border-[#d8d0c2] bg-[#f8f4eb] p-5">
            <h2 className="serif text-xl">Libros vendidos en el período</h2>
            <p className="mt-1 text-xs text-[#747983]">La escala cambia entre horas, días y meses según el rango.</p>
            <div className="mt-4 h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={timelineData} margin={{ top: 8, right: 12, bottom: 4, left: -18 }}>
                  <CartesianGrid stroke="#e1d9cb" strokeDasharray="3 3" vertical={false}/>
                  <XAxis dataKey="bucket" tickFormatter={value => timelineBucketLabel(String(value), report.data.timelineUnit)} tick={{ fontSize: 10 }} minTickGap={18} axisLine={false} tickLine={false}/>
                  <YAxis allowDecimals={false} tick={{ fontSize: 10 }} axisLine={false} tickLine={false}/>
                  <Tooltip formatter={value => [`${Number(value)} libros`, 'Vendidos']} labelFormatter={value => timelineBucketLabel(String(value), report.data.timelineUnit, true)} contentStyle={{ background: '#f8f4eb', borderColor: '#d8d0c2' }}/>
                  <Bar dataKey="units" name="Libros vendidos" fill="#7a293b" radius={[3, 3, 0, 0]}/>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>
          <section className="min-w-0 border border-[#d8d0c2] bg-[#f8f4eb] p-5">
            <h2 className="serif text-xl">Ingresos y egresos</h2>
            <p className="mt-1 text-xs text-[#747983]">Ventas confirmadas frente a compras de libros y otros gastos.</p>
            <div className="mt-4 h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={timelineData} margin={{ top: 8, right: 12, bottom: 4, left: 0 }}>
                  <CartesianGrid stroke="#e1d9cb" strokeDasharray="3 3" vertical={false}/>
                  <XAxis dataKey="bucket" tickFormatter={value => timelineBucketLabel(String(value), report.data.timelineUnit)} tick={{ fontSize: 10 }} minTickGap={18} axisLine={false} tickLine={false}/>
                  <YAxis tickFormatter={value => `$${Number(value).toLocaleString('es-AR')}`} tick={{ fontSize: 10 }} axisLine={false} tickLine={false}/>
                  <Tooltip formatter={(value, name) => [money(Number(value)), name === 'Ingresos' ? 'Ingresos' : 'Egresos']} labelFormatter={value => timelineBucketLabel(String(value), report.data.timelineUnit, true)} contentStyle={{ background: '#f8f4eb', borderColor: '#d8d0c2' }}/>
                  <Bar dataKey="revenue" name="Ingresos" fill="#17263f" radius={[3, 3, 0, 0]}/>
                  <Bar dataKey="expenses" name="Egresos" fill="#b87961" radius={[3, 3, 0, 0]}/>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>
        </div>
        <div className="mt-6 grid gap-5 xl:grid-cols-2">
          <section className="min-w-0 border border-[#d8d0c2] bg-[#f8f4eb] p-5">
            <h2 className="serif text-xl">Libros: más vendidos</h2>
            {report.data.topBooks.length ? <div className="mt-4 h-64"><ResponsiveContainer width="100%" height="100%"><BarChart data={report.data.topBooks} layout="vertical" margin={{ top: 4, right: 12, bottom: 4, left: 4 }}><CartesianGrid stroke="#e1d9cb" strokeDasharray="3 3" horizontal={false}/><XAxis type="number" allowDecimals={false} tick={{ fontSize: 10 }} axisLine={false} tickLine={false}/><YAxis type="category" dataKey="title" width={142} tickFormatter={value => String(value).length > 19 ? `${String(value).slice(0, 18)}…` : String(value)} tick={{ fontSize: 10 }} axisLine={false} tickLine={false}/><Tooltip formatter={value => [`${Number(value)} libros`, 'Vendidos']} contentStyle={{ background: '#f8f4eb', borderColor: '#d8d0c2' }}/><Bar dataKey="units" name="Libros vendidos" fill="#17263f" radius={[0, 3, 3, 0]}/></BarChart></ResponsiveContainer></div> : <p className="mt-4 text-sm text-[#747983]">Todavía no hay ventas confirmadas.</p>}
          </section>
          <section className="min-w-0 border border-[#d8d0c2] bg-[#f8f4eb] p-5">
            <h2 className="serif text-xl">Libros: menos vendidos con stock</h2>
            {report.data.slowBooks.length ? <div className="mt-4 h-64"><ResponsiveContainer width="100%" height="100%"><BarChart data={report.data.slowBooks} layout="vertical" margin={{ top: 4, right: 12, bottom: 4, left: 4 }}><CartesianGrid stroke="#e1d9cb" strokeDasharray="3 3" horizontal={false}/><XAxis type="number" allowDecimals={false} tick={{ fontSize: 10 }} axisLine={false} tickLine={false}/><YAxis type="category" dataKey="title" width={142} tickFormatter={value => String(value).length > 19 ? `${String(value).slice(0, 18)}…` : String(value)} tick={{ fontSize: 10 }} axisLine={false} tickLine={false}/><Tooltip formatter={value => [`${Number(value)} libros`, 'Vendidos']} contentStyle={{ background: '#f8f4eb', borderColor: '#d8d0c2' }}/><Bar dataKey="units" name="Libros vendidos" fill="#b87961" radius={[0, 3, 3, 0]}/></BarChart></ResponsiveContainer></div> : <p className="mt-4 text-sm text-[#747983]">No hay libros visibles con stock para comparar.</p>}
          </section>
        </div>
        <div className="mt-6 grid gap-5 xl:grid-cols-2">
          <section className="min-w-0 border border-[#d8d0c2] bg-[#f8f4eb] p-5">
            <h2 className="serif text-xl">Categorías: más vendidas</h2>
            {report.data.categoryPerformance.length ? <div className="mt-4 h-72"><ResponsiveContainer width="100%" height="100%"><BarChart data={report.data.categoryPerformance.slice(0, 10)} layout="vertical" margin={{ top: 4, right: 12, bottom: 4, left: 4 }}><CartesianGrid stroke="#e1d9cb" strokeDasharray="3 3" horizontal={false}/><XAxis type="number" allowDecimals={false} tick={{ fontSize: 10 }} axisLine={false} tickLine={false}/><YAxis type="category" dataKey="categoryName" width={142} tick={{ fontSize: 10 }} axisLine={false} tickLine={false}/><Tooltip formatter={value => [`${Number(value)} libros`, 'Vendidos']} contentStyle={{ background: '#f8f4eb', borderColor: '#d8d0c2' }}/><Bar dataKey="units" name="Libros vendidos" fill="#8d7655" radius={[0, 3, 3, 0]}/></BarChart></ResponsiveContainer></div> : <p className="mt-4 text-sm text-[#747983]">Todavía no hay categorías para mostrar.</p>}
          </section>
          <section className="min-w-0 border border-[#d8d0c2] bg-[#f8f4eb] p-5">
            <h2 className="serif text-xl">Categorías: menos vendidas</h2>
            {report.data.categoryPerformance.length ? <div className="mt-4 h-72"><ResponsiveContainer width="100%" height="100%"><BarChart data={report.data.categoryPerformance.slice(-10).reverse()} layout="vertical" margin={{ top: 4, right: 12, bottom: 4, left: 4 }}><CartesianGrid stroke="#e1d9cb" strokeDasharray="3 3" horizontal={false}/><XAxis type="number" allowDecimals={false} tick={{ fontSize: 10 }} axisLine={false} tickLine={false}/><YAxis type="category" dataKey="categoryName" width={142} tick={{ fontSize: 10 }} axisLine={false} tickLine={false}/><Tooltip formatter={value => [`${Number(value)} libros`, 'Vendidos']} contentStyle={{ background: '#f8f4eb', borderColor: '#d8d0c2' }}/><Bar dataKey="units" name="Libros vendidos" fill="#b87961" radius={[0, 3, 3, 0]}/></BarChart></ResponsiveContainer></div> : <p className="mt-4 text-sm text-[#747983]">Todavía no hay categorías para mostrar.</p>}
          </section>
        </div>
        <div className="mt-6 grid gap-5 xl:grid-cols-2">
          <section className="border border-[#d8d0c2] bg-[#f8f4eb] p-5">
            <h2 className="serif text-xl">Más vendidos en el período</h2>
            {report.data.topBooks.length ? <div className="mt-4 divide-y divide-[#e1d9cb]">{report.data.topBooks.map((book, index) => <div key={book.bookId} className="flex items-center justify-between gap-4 py-3 text-sm"><span><span className="mr-3 text-[#7a293b]">0{index + 1}</span>{book.title}<small className="ml-2 text-[#777b81]">· quedan {book.stock}</small></span><b>{book.units} u.</b></div>)}</div> : <p className="mt-4 text-sm text-[#747983]">No hubo ventas confirmadas en este período.</p>}
          </section>
          <section className="border border-[#d8d0c2] bg-[#f8f4eb] p-5">
            <h2 className="serif text-xl">Con stock y pocas ventas</h2>
            {report.data.slowBooks.length ? <div className="mt-4 divide-y divide-[#e1d9cb]">{report.data.slowBooks.map(book => <div key={book.bookId} className="flex items-center justify-between gap-4 py-3 text-sm"><span>{book.title}<small className="ml-2 text-[#777b81]">· stock {book.stock}</small></span><b>{book.units} u.</b></div>)}</div> : <p className="mt-4 text-sm text-[#747983]">No hay libros visibles con stock en este período.</p>}
          </section>
        </div>
        <section className="mt-6 border border-[#d8d0c2] bg-[#f8f4eb]">
          <div className="border-b border-[#e1d9cb] p-5"><h2 className="serif text-xl">Compras de inventario</h2><p className="mt-1 text-xs text-[#747983]">Se muestran las últimas 100 compras del rango elegido.</p></div>
          {report.data.purchases.length ? <div className="overflow-x-auto"><table className="w-full min-w-[700px] text-left text-sm"><thead className="bg-[#eae3d7] text-[10px] uppercase tracking-wider text-[#707680]"><tr><th className="p-4">Fecha</th><th className="p-4">Libro</th><th className="p-4">Proveedor</th><th className="p-4">Unidades</th><th className="p-4">Costo total</th></tr></thead><tbody>{report.data.purchases.map(purchase => <tr key={purchase.id} className="border-t border-[#e5ddcf]"><td className="p-4">{new Intl.DateTimeFormat('es-AR', { dateStyle: 'short' }).format(new Date(purchase.purchasedAt))}</td><td className="p-4">{purchase.bookTitle}</td><td className="p-4">{purchase.supplier || '—'}</td><td className="p-4">{purchase.quantity}</td><td className="p-4">{money(purchase.totalCost)}</td></tr>)}</tbody></table></div> : <p className="p-8 text-sm text-[#747983]">Todavía no hay compras registradas en este período.</p>}
        </section>
        <section className="mt-6 border border-[#d8d0c2] bg-[#f8f4eb]">
          <div className="border-b border-[#e1d9cb] p-5"><h2 className="serif text-xl">Otros gastos</h2><p className="mt-1 text-xs text-[#747983]">Los últimos 100 gastos registrados en el rango elegido.</p></div>
          {report.data.expenses.length ? <div className="overflow-x-auto"><table className="w-full min-w-[700px] text-left text-sm"><thead className="bg-[#eae3d7] text-[10px] uppercase tracking-wider text-[#707680]"><tr><th className="p-4">Fecha</th><th className="p-4">Categoría</th><th className="p-4">Concepto</th><th className="p-4">Notas</th><th className="p-4">Monto</th></tr></thead><tbody>{report.data.expenses.map(expense => <tr key={expense.id} className="border-t border-[#e5ddcf]"><td className="p-4">{new Intl.DateTimeFormat('es-AR', { dateStyle: 'short' }).format(new Date(expense.incurredAt))}</td><td className="p-4">{expense.category}</td><td className="p-4">{expense.title}</td><td className="p-4">{expense.notes || '—'}</td><td className="p-4">{money(expense.amount)}</td></tr>)}</tbody></table></div> : <p className="p-8 text-sm text-[#747983]">Todavía no hay otros gastos en este período.</p>}
        </section>
      </> : null}
  </>;
}

function AdminBooks({ onCreate, onEdit, onPurchase, onCreatePurchase }: { onCreate: () => void; onEdit: (book: AdminBookRecord) => void; onPurchase: (book: AdminBookRecord) => void; onCreatePurchase: () => void }) {
  const client = useQueryClient(); const q = useGetAdminBooks({ query: { queryKey: getGetAdminBooksQueryKey() } }); const archive = useArchiveBook();
  const remove = (book: Book) => { if (window.confirm(`¿Archivar “${book.title}”?`)) archive.mutate({ id: book.id }, { onSuccess: () => { client.invalidateQueries({ queryKey: getGetAdminBooksQueryKey() }); client.invalidateQueries({ queryKey: getGetCatalogQueryKey() }); client.invalidateQueries({ queryKey: getGetBestsellersQueryKey() }); } }); };
  return <><AdminTitle eyebrow="02 / INVENTARIO" title="Libros"><div className="flex flex-wrap gap-2"><button onClick={onCreatePurchase} className="border border-[#17263f] px-4 py-3 text-xs hover:bg-[#eee6d9]">Registrar compra</button><button onClick={onCreate} className="bg-[#17263f] px-4 py-3 text-xs text-white hover:bg-[#7a293b]"><Plus size={15} className="mr-2 inline"/>Agregar libro</button></div></AdminTitle>{q.isLoading ? <LoadingRow/> : q.isError ? <QueryError retry={() => q.refetch()}/> : q.data?.length ? <div className="overflow-x-auto border border-[#d8d0c2] bg-[#f8f4eb]"><table className="w-full min-w-[850px] text-left text-sm"><thead className="bg-[#eae3d7] text-[10px] uppercase tracking-wider text-[#707680]"><tr><th className="p-4">Libro</th><th className="p-4">Categoría</th><th className="p-4">Precio</th><th className="p-4">Stock</th><th className="p-4">Estado</th><th className="p-4">Acciones</th></tr></thead><tbody>{q.data.map(book => <tr key={book.id} className="border-t border-[#e5ddcf]"><td className="p-4"><p className="serif text-base">{book.title}{book.demo && <span className="ml-2 text-[9px] text-[#8a6b39]">DEMO</span>}</p><p className="mt-1 text-xs text-[#777b81]">{book.author}</p></td><td className="p-4 text-xs">{book.categoryName || '—'}</td><td className="p-4">{money(book.price)}</td><td className="p-4">{book.stock}</td><td className="p-4"><span className={`text-xs ${book.stock === 0 || !book.visible ? 'text-[#7a293b]' : 'text-[#526b4e]'}`}>{book.stock === 0 ? 'Sin stock' : book.visible ? 'Disponible' : 'Oculto'}</span></td><td className="p-4"><div className="flex gap-3"><button onClick={() => onPurchase(book)} className="text-xs underline">Reponer</button><button onClick={() => onEdit(book)} className="text-xs underline">Editar</button><button onClick={() => remove(book)} disabled={archive.isPending} className="text-xs text-[#7a293b] underline disabled:opacity-50">Archivar</button></div></td></tr>)}</tbody></table></div> : <div className="border border-dashed border-[#c9bda9] p-10 text-center"><BookOpen className="mx-auto text-[#7a293b]"/><p className="serif mt-3 text-2xl">Todavía no hay libros</p><button onClick={onCreate} className="mt-4 text-xs underline">Cargar el primero</button></div>}</>;
}
function AdminCategories({ onCreate, onEdit }: { onCreate: () => void; onEdit: (category: Category) => void }) {
  const client = useQueryClient(); const q = useGetAdminCategories({ query: { queryKey: getGetAdminCategoriesQueryKey() } }); const archive = useArchiveCategory();
  const remove = (item: Category) => { if (window.confirm(`¿Archivar la categoría “${item.name}”?`)) archive.mutate({ id: item.id }, { onSuccess: () => { client.invalidateQueries({ queryKey: getGetAdminCategoriesQueryKey() }); client.invalidateQueries({ queryKey: getGetCatalogQueryKey() }); } }); };
  return <><AdminTitle eyebrow="03 / ORDENAR LA CASA" title="Categorías"><button onClick={onCreate} className="bg-[#17263f] px-4 py-3 text-xs text-white hover:bg-[#7a293b]"><Plus size={15} className="mr-2 inline"/>Nueva categoría</button></AdminTitle>{q.isLoading ? <LoadingRow/> : q.isError ? <QueryError retry={() => q.refetch()}/> : q.data?.length ? <div className="grid gap-3 sm:grid-cols-2">{q.data.map(item => <div key={item.id} className="flex items-start justify-between border border-[#d8d0c2] bg-[#f8f4eb] p-5"><div><p className="eyebrow text-[#8d806d]">{item.slug}{item.demo ? ' · DEMO' : ''}</p><h2 className="serif mt-2 text-xl">{item.name}</h2><p className="mt-2 text-sm text-[#717783]">{item.description || 'Sin descripción'}</p><p className="mt-3 text-[10px]">{item.visible ? 'Visible en la tienda' : 'Oculta'} · Orden {item.sortOrder}</p></div><div className="flex gap-3 text-xs"><button onClick={() => onEdit(item)} className="underline">Editar</button><button disabled={archive.isPending} onClick={() => remove(item)} className="text-[#7a293b] underline">Archivar</button></div></div>)}</div> : <div className="border border-dashed p-10 text-center text-sm text-[#747983]">No hay categorías cargadas todavía.</div>}</>;
}
function AdminOrders() {
  const client = useQueryClient();
  const q = useGetAdminOrders({ query: { queryKey: getGetAdminOrdersQueryKey() } });
  const update = useUpdateOrderStatus();
  const [statusError, setStatusError] = useState(false);
  const labels: Record<OrderStatusInputStatus, string> = { pending: 'Pendiente', confirmed: 'Confirmado', delivered: 'Entregado', picked_up: 'Retirado', cancelled: 'Cancelado' };
  const options: Record<OrderStatusInputStatus, OrderStatusInputStatus[]> = {
    pending: ['pending', 'confirmed', 'cancelled'],
    confirmed: ['confirmed', 'delivered', 'picked_up', 'cancelled'],
    delivered: ['delivered'],
    picked_up: ['picked_up'],
    cancelled: ['cancelled'],
  };
  return <><AdminTitle eyebrow="04 / DEL MOSTRADOR A TU CASA" title="Pedidos"/>
    {statusError && <p role="alert" className="mb-4 border border-[#d8b7b3] bg-[#f5e8e4] p-4 text-sm text-[#702d36]">No se pudo actualizar el pedido. Revisá el stock disponible e intentá de nuevo.</p>}
    {q.isLoading ? <LoadingRow/> : q.isError ? <QueryError retry={() => q.refetch()}/> : q.data?.length ? <div className="space-y-3">{q.data.map(order => <article key={order.id} className="border border-[#d8d0c2] bg-[#f8f4eb] p-4 sm:p-5"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="eyebrow text-[#7a293b]">{order.orderNumber} · {new Date(order.createdAt).toLocaleDateString('es-AR')}</p><h2 className="serif mt-2 text-xl">{order.name}</h2><a href={`tel:${order.phone}`} className="mt-1 inline-block text-xs text-[#596170] underline">{order.phone}</a></div><div className="text-right"><p className="serif text-xl">{money(order.total)}</p><select aria-label={`Estado de pedido ${order.orderNumber}`} value={order.status} onChange={e => update.mutate({ id: order.id, data: { status: e.target.value as OrderStatusInputStatus } }, { onSuccess: () => { setStatusError(false); client.invalidateQueries({ queryKey: getGetAdminOrdersQueryKey() }); client.invalidateQueries({ queryKey: getGetAdminDashboardQueryKey() }); client.invalidateQueries({ queryKey: getGetAdminReportQueryKey() }); }, onError: () => setStatusError(true) })} className="mt-2 border border-[#d8d0c2] bg-[#f8f4eb] px-2 py-2 text-xs">{options[order.status].map(status => <option key={status} value={status}>{labels[status]}</option>)}</select></div></div><div className="mt-4 grid gap-2 border-t border-[#e4dccf] pt-3 text-xs sm:grid-cols-2"><p><b>{order.fulfillment === 'pickup' ? 'Retiro' : 'Envío'}</b>{order.address ? ` · ${order.address}${order.area ? `, ${order.area}` : ''}` : ''}</p><p>Pago: {order.paymentPreference === 'cash' ? 'Efectivo' : order.paymentPreference === 'transfer' ? 'Transferencia' : 'A coordinar'}</p></div><div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs text-[#69707a]">{order.items.map((line, i) => <span key={`${line.bookId}-${i}`}>{line.quantity} × {line.title}</span>)}</div>{order.notes && <p className="mt-3 border-l-2 border-[#c4ae89] pl-3 text-xs text-[#636b74]">{order.notes}</p>}</article>)}</div> : <div className="border border-dashed p-12 text-center"><Clock3 className="mx-auto text-[#7a293b]"/><h2 className="serif mt-3 text-2xl">No hay pedidos todavía</h2><p className="mt-2 text-sm text-[#747983]">Cuando llegue uno nuevo, lo vas a encontrar acá.</p></div>}
  </>;
}
function AdminSettings() {
  const client = useQueryClient(); const q = useGetAdminSettings({ query: { queryKey: getGetAdminSettingsQueryKey() } }); const update = useUpdateStoreSettings();
  const [saved, setSaved] = useState(false);
  useEffect(() => { if (q.data) setSaved(false); }, [q.data]);
  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault(); const fd = new FormData(e.currentTarget);
    const value: StoreSettingsInput = {
      heroTitle: String(fd.get('heroTitle')), heroSubtitle: String(fd.get('heroSubtitle')), story: String(fd.get('story')),
      whatsappNumber: String(fd.get('whatsappNumber')), greetingMessage: String(fd.get('greetingMessage')),
      address: String(fd.get('address')), openingHours: String(fd.get('openingHours')), mapsUrl: String(fd.get('mapsUrl')),
      instagram: String(fd.get('instagram')), facebook: String(fd.get('facebook')), tiktok: String(fd.get('tiktok')),
      creditLink: String(fd.get('creditLink')), deliveryInfo: String(fd.get('deliveryInfo')), pickupAddress: String(fd.get('pickupAddress')),
      pickupHours: String(fd.get('pickupHours')), paymentMethods: fd.getAll('paymentMethods').map(String) as StoreSettingsInput['paymentMethods'],
      lowStockThreshold: Number(fd.get('lowStockThreshold')),
    };
    update.mutate({ data: value }, { onSuccess: () => { setSaved(true); client.invalidateQueries({ queryKey: getGetAdminSettingsQueryKey() }); client.invalidateQueries({ queryKey: getGetStoreSettingsQueryKey() }); } });
  };
  return <><AdminTitle eyebrow="06 / LA CASA" title="Datos de la tienda"/>{q.isLoading ? <LoadingRow/> : q.isError ? <QueryError retry={() => q.refetch()}/> : q.data ? <form onSubmit={submit} className="max-w-4xl border border-[#d8d0c2] bg-[#f8f4eb] p-5 sm:p-7">
    <h2 className="serif mb-5 text-xl">Portada e historia</h2><Field label="Título de portada"><input name="heroTitle" defaultValue={q.data.heroTitle} maxLength={240} className="admin-input"/></Field><Field label="Bajada de portada" className="mt-4"><textarea name="heroSubtitle" defaultValue={q.data.heroSubtitle} maxLength={600} rows={2} className="admin-input"/></Field><Field label="Nuestra historia" className="mt-4"><textarea name="story" defaultValue={q.data.story} maxLength={5000} rows={4} className="admin-input"/></Field>
    <h2 className="serif mb-5 mt-9 border-t border-[#e1d9cb] pt-6 text-xl">Contacto y redes</h2><div className="grid gap-4 sm:grid-cols-2"><Field label="WhatsApp (con código de país)"><input name="whatsappNumber" defaultValue={q.data.whatsappNumber && q.data.whatsappNumber !== legacyDefaultWhatsAppNumber ? q.data.whatsappNumber : defaultWhatsAppNumber} className="admin-input"/></Field><Field label="Mensaje de bienvenida"><input name="greetingMessage" defaultValue={q.data.greetingMessage} className="admin-input"/></Field><Field label="Dirección"><input name="address" defaultValue={q.data.address || 'Av. Cjal. Felipe Belardinelli 2940, X5016 Córdoba'} className="admin-input"/></Field><Field label="Horarios"><input name="openingHours" defaultValue={q.data.openingHours} className="admin-input"/></Field><Field label="Enlace a mapa"><input name="mapsUrl" defaultValue={q.data.mapsUrl || 'https://share.google/iUCwZaVHYC9mI3RIm'} className="admin-input"/></Field><Field label="Instagram"><input name="instagram" defaultValue={q.data.instagram || 'https://www.instagram.com/nico.libros.cba'} className="admin-input"/></Field><Field label="Facebook"><input name="facebook" defaultValue={q.data.facebook || 'https://www.facebook.com/nicolas.rodriguez.747924/'} className="admin-input"/></Field><Field label="TikTok"><input name="tiktok" defaultValue={q.data.tiktok} className="admin-input"/></Field><Field label="Enlace del crédito"><input name="creditLink" type="url" defaultValue={q.data.creditLink || 'https://axelrodriguezweb.framer.website/'} className="admin-input"/></Field></div>
    <h2 className="serif mb-5 mt-9 border-t border-[#e1d9cb] pt-6 text-xl">Entrega y pago</h2><div className="grid gap-4 sm:grid-cols-2"><Field label="Información de envíos"><textarea name="deliveryInfo" defaultValue={q.data.deliveryInfo} rows={2} className="admin-input"/></Field><Field label="Dirección de retiro"><input name="pickupAddress" defaultValue={q.data.pickupAddress} className="admin-input"/></Field><Field label="Horarios de retiro"><input name="pickupHours" defaultValue={q.data.pickupHours} className="admin-input"/></Field><Field label="Umbral de stock bajo"><input name="lowStockThreshold" type="number" min="1" max="20" defaultValue={q.data.lowStockThreshold} className="admin-input"/></Field></div>
    <fieldset className="mt-5"><legend className="mb-3 text-xs font-semibold">Medios de pago disponibles</legend><div className="flex flex-wrap gap-4 text-sm">{[['cash','Efectivo'],['transfer','Transferencia'],['coordinate','A coordinar']].map(([value,label])=><label key={value} className="flex items-center gap-2"><input type="checkbox" name="paymentMethods" value={value} defaultChecked={q.data.paymentMethods.includes(value)} className="accent-[#7a293b]"/>{label}</label>)}</div></fieldset>
    {update.isError && <p role="alert" className="mt-4 text-sm text-[#7a293b]">No pudimos guardar los cambios. Intentá de nuevo.</p>}{saved && <p role="status" className="mt-4 text-sm text-[#526b4e]">Cambios guardados.</p>}<button disabled={update.isPending} className="mt-7 bg-[#17263f] px-6 py-4 text-sm text-white hover:bg-[#7a293b] disabled:opacity-60">{update.isPending ? 'Guardando…' : 'Guardar cambios'} <Check size={15} className="ml-2 inline"/></button>
  </form> : <div className="border border-dashed p-10 text-sm">No hay ajustes de tienda disponibles.</div>}</>;
}

function mediaUrlInputValue(value?: string | null): string {
  return value?.startsWith("/api/uploads/")
    ? new URL(value, window.location.origin).toString()
    : value || "";
}

function normalizeMediaUrl(value: string): string | null | undefined {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") return undefined;
    if (url.origin === window.location.origin && url.pathname.startsWith("/api/uploads/")) {
      return `${url.pathname}${url.search}${url.hash}`;
    }
    return url.toString();
  } catch {
    return undefined;
  }
}

function BookForm({ book, onClose, onSaved }: { book: AdminBookRecord | null; onClose: () => void; onSaved: () => void }) {
  const categories = useGetAdminCategories({ query: { queryKey: getGetAdminCategoriesQueryKey() } });
  const create = useCreateBook();
  const update = useUpdateBook();
  const [uploadingCover, setUploadingCover] = useState(false);
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const saving = create.isPending || update.isPending;
  const mediaUploading = uploadingCover || uploadingVideo;
  const pending = saving || mediaUploading;

  const uploadMedia = async (
    input: HTMLInputElement,
    fieldName: "coverUrl" | "videoUrl",
    setUploading: (value: boolean) => void,
  ) => {
    const file = input.files?.[0];
    if (!file) return;
    const target = input.form?.elements.namedItem(fieldName);
    if (!(target instanceof HTMLInputElement)) {
      setUploadError("No encontramos el campo donde guardar el archivo.");
      input.value = "";
      return;
    }

    setUploadError(null);
    setUploading(true);
    try {
      const extension = mediaFileExtensions[file.type];
      const maxBytes = fieldName === "coverUrl" ? 10 * 1024 * 1024 : 50 * 1024 * 1024;
      if (!extension || file.size === 0 || file.size > maxBytes) {
        throw new Error(
          file.size > maxBytes
            ? `El archivo supera el límite de ${maxBytes / (1024 * 1024)} MB.`
            : "El archivo está vacío o su formato no es compatible.",
        );
      }

      if (import.meta.env.PROD) {
        const { upload } = await import('@vercel/blob/client');
        const blob = await upload(`catalog/${crypto.randomUUID()}.${extension}`, file, {
          access: "public",
          handleUploadUrl: "/api/admin/media-token",
          clientPayload: fieldName === "coverUrl" ? "cover" : "video",
          contentType: file.type,
          multipart: file.size > 5 * 1024 * 1024,
        });
        target.value = blob.url;
      } else {
        const response = await fetch("/api/admin/media", {
          method: "POST",
          headers: { "Content-Type": file.type },
          body: file,
        });
        const result = await response.json().catch(() => null) as { url?: unknown; error?: unknown } | null;
        if (!response.ok) {
          const message = typeof result?.error === "string"
            ? result.error
            : response.status === 413
              ? "El archivo supera el límite permitido."
              : `No se pudo subir el archivo (HTTP ${response.status}).`;
          throw new Error(message);
        }
        if (!result || typeof result.url !== "string") {
          throw new Error("La respuesta de carga no incluyó la dirección del archivo.");
        }
        target.value = new URL(result.url, window.location.origin).toString();
      }
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "No se pudo subir el archivo.");
    } finally {
      input.value = "";
      setUploading(false);
    }
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const coverUrl = normalizeMediaUrl(String(formData.get("coverUrl") || ""));
    const videoUrl = normalizeMediaUrl(String(formData.get("videoUrl") || ""));
    if (coverUrl === undefined || videoUrl === undefined) {
      setUploadError("Ingresá enlaces de portada y video válidos con http o https.");
      return;
    }
    const data = {
      title: String(formData.get("title")),
      author: String(formData.get("author")),
      description: String(formData.get("description")),
      synopsis: String(formData.get("synopsis")),
      categoryId: formData.get("categoryId") ? Number(formData.get("categoryId")) : null,
      price: Number(formData.get("price")),
      cost: Number(formData.get("cost") || 0),
      stock: Number(formData.get("stock")),
      featured: formData.get("featured") === "on",
      visible: formData.get("visible") === "on",
      demo: formData.get("demo") === "on",
      coverUrl,
      extraImages: [] as string[],
      videoUrl,
    };
    const success = () => onSaved();
    if (book) update.mutate({ id: book.id, data }, { onSuccess: success });
    else create.mutate({ data }, { onSuccess: success });
  };

  return <Overlay onClose={onClose}>
    <form onSubmit={submit} className="p-6 sm:p-8">
      <div className="flex justify-between">
        <div><p className="eyebrow text-[#7a293b]">CATÁLOGO</p><h2 className="serif mt-2 text-3xl">{book ? "Editar libro" : "Nuevo libro"}</h2></div>
        <button type="button" onClick={onClose} aria-label="Cerrar formulario"><X/></button>
      </div>
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <Field label="Título"><input name="title" required maxLength={180} defaultValue={book?.title} className="admin-input"/></Field>
        <Field label="Autor"><input name="author" required maxLength={120} defaultValue={book?.author} className="admin-input"/></Field>
        <Field label="Precio de venta"><input name="price" required type="number" min="0" step="1" defaultValue={book?.price ?? 0} className="admin-input"/></Field>
        <Field label="Costo unitario actual"><input name="cost" type="number" min="0" step="1" defaultValue={book?.cost ?? 0} className="admin-input"/></Field>
        <Field label="Stock actual"><input name="stock" required type="number" min="0" defaultValue={book?.stock ?? 0} className="admin-input"/></Field>
        <Field label="Categoría"><select name="categoryId" defaultValue={book?.categoryId ?? ""} className="admin-input"><option value="">Sin categoría</option>{categories.data?.map(category => <option key={category.id} value={category.id}>{category.name}</option>)}</select></Field>
      </div>
      <Field label="Sinopsis" className="mt-4"><textarea name="synopsis" rows={3} maxLength={5000} defaultValue={book?.synopsis} className="admin-input"/></Field>
      <Field label="Descripción" className="mt-4"><textarea name="description" rows={4} maxLength={5000} defaultValue={book?.description} className="admin-input"/></Field>
      <Field label="URL de portada (opcional)" className="mt-4"><input name="coverUrl" type="url" defaultValue={mediaUrlInputValue(book?.coverUrl)} className="admin-input" placeholder="https://..."/></Field>
      <Field label="Subir portada desde el dispositivo (JPG, PNG, WebP o GIF; hasta 10 MB)" className="mt-4">
        <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" disabled={pending} onChange={event => void uploadMedia(event.currentTarget, "coverUrl", setUploadingCover)} className="admin-input file:mr-3 file:border-0 file:bg-[#17263f] file:px-3 file:py-2 file:text-white disabled:opacity-60"/>
        {uploadingCover && <span className="mt-2 block text-xs text-[#626978]">Subiendo portada…</span>}
      </Field>
      <Field label="URL de video (opcional)" className="mt-4"><input name="videoUrl" type="url" defaultValue={mediaUrlInputValue(book?.videoUrl)} className="admin-input" placeholder="https://..."/></Field>
      <Field label="Subir video desde el dispositivo (MP4, WebM o MOV; hasta 50 MB)" className="mt-4">
        <input type="file" accept="video/mp4,video/webm,video/quicktime" disabled={pending} onChange={event => void uploadMedia(event.currentTarget, "videoUrl", setUploadingVideo)} className="admin-input file:mr-3 file:border-0 file:bg-[#17263f] file:px-3 file:py-2 file:text-white disabled:opacity-60"/>
        {uploadingVideo && <span className="mt-2 block text-xs text-[#626978]">Subiendo video…</span>}
      </Field>
      {uploadError && <p role="alert" className="mt-4 text-sm text-[#7a293b]">{uploadError}</p>}
      <div className="mt-5 flex flex-wrap gap-5 text-sm">
        {[["featured", "Destacar"], ["visible", "Visible"], ["demo", "Contenido de demostración"]].map(([name, label]) => <label key={name} className="flex items-center gap-2"><input name={name} type="checkbox" defaultChecked={name === "visible" ? book?.visible ?? true : name === "demo" ? book?.demo ?? false : book?.featured ?? false} className="accent-[#7a293b]"/>{label}</label>)}
      </div>
      {(create.isError || update.isError) && <p role="alert" className="mt-4 text-sm text-[#7a293b]">No se pudo guardar. Revisá los datos e intentá de nuevo.</p>}
      <button disabled={pending} className="mt-7 w-full bg-[#17263f] py-4 text-sm text-white disabled:opacity-60">{saving ? "Guardando…" : mediaUploading ? "Subiendo archivo…" : book ? "Guardar cambios" : "Crear libro"}</button>
    </form>
  </Overlay>;
}

function localDateTimeValue(date: Date) {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 16);
}

function PurchaseForm({ book, onClose, onSaved }: { book: AdminBookRecord | null; onClose: () => void; onSaved: () => void }) {
  const books = useGetAdminBooks({ query: { queryKey: getGetAdminBooksQueryKey() } });
  const create = useCreateInventoryPurchase();
  const [bookId, setBookId] = useState(book ? String(book.id) : '');
  const [unitCost, setUnitCost] = useState(book?.cost ?? 0);
  const selectedBook = books.data?.find(item => String(item.id) === bookId);
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const data: InventoryPurchaseInput = {
      bookId: Number(form.get('bookId')),
      quantity: Number(form.get('quantity')),
      unitCost: Number(form.get('unitCost')),
      supplier: String(form.get('supplier') || ''),
      notes: String(form.get('notes') || ''),
      purchasedAt: new Date(String(form.get('purchasedAt'))).toISOString(),
    };
    create.mutate({ data }, { onSuccess: onSaved });
  };
  return <Overlay onClose={onClose}><form onSubmit={submit} className="p-6 sm:p-8">
    <div className="flex justify-between"><div><p className="eyebrow text-[#7a293b]">INVENTARIO</p><h2 className="serif mt-2 text-3xl">Registrar compra</h2></div><button type="button" onClick={onClose} aria-label="Cerrar formulario"><X/></button></div>
    {books.isError ? <QueryError retry={() => books.refetch()}/> : <>
      <Field label="Libro" className="mt-6"><select name="bookId" required value={bookId} onChange={event => { setBookId(event.target.value); setUnitCost(books.data?.find(item => String(item.id) === event.target.value)?.cost ?? 0); }} className="admin-input"><option value="" disabled>Elegí un libro</option>{books.data?.map(item => <option key={item.id} value={item.id}>{item.title} · stock actual: {item.stock}</option>)}</select></Field>
      {selectedBook && <p className="mt-2 text-xs text-[#717783]">Al registrar la compra, el stock pasará de {selectedBook.stock} a {selectedBook.stock} + las unidades ingresadas.</p>}
      <div className="mt-4 grid gap-4 sm:grid-cols-2"><Field label="Unidades compradas"><input name="quantity" required type="number" min="1" max="100000" step="1" defaultValue="1" className="admin-input"/></Field><Field label="Costo por unidad"><input name="unitCost" required type="number" min="0" max="1000000000" step="1" value={unitCost} onChange={event => setUnitCost(Number(event.target.value))} className="admin-input"/></Field></div>
      <div className="mt-4 grid gap-4 sm:grid-cols-2"><Field label="Proveedor"><input name="supplier" maxLength={180} className="admin-input" placeholder="Opcional"/></Field><Field label="Fecha de compra"><input name="purchasedAt" required type="datetime-local" defaultValue={localDateTimeValue(new Date())} className="admin-input"/></Field></div>
      <Field label="Notas" className="mt-4"><textarea name="notes" rows={3} maxLength={1000} className="admin-input resize-y" placeholder="Factura, observaciones o referencia"/></Field>
      {!books.isLoading && !books.data?.length && <p role="alert" className="mt-4 text-sm text-[#7a293b]">Primero cargá un libro para poder registrar una compra.</p>}
      {create.isError && <p role="alert" className="mt-4 text-sm text-[#7a293b]">No se pudo registrar la compra. Revisá los datos e intentá de nuevo.</p>}
      <button disabled={create.isPending || books.isLoading || !books.data?.length} className="mt-7 w-full bg-[#17263f] py-4 text-sm text-white disabled:opacity-60">{create.isPending ? 'Registrando…' : 'Registrar compra y sumar stock'} <Check size={15} className="ml-2 inline"/></button>
    </>}
  </form></Overlay>;
}

function FinanceExpenseForm({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const create = useCreateFinanceExpense();
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const data: FinanceExpenseInput = {
      title: String(form.get('title') || ''),
      category: String(form.get('category') || ''),
      amount: Number(form.get('amount')),
      notes: String(form.get('notes') || ''),
      incurredAt: new Date(String(form.get('incurredAt'))).toISOString(),
    };
    create.mutate({ data }, { onSuccess: onSaved });
  };
  return <Overlay onClose={onClose}><form onSubmit={submit} className="p-6 sm:p-8">
    <div className="flex justify-between"><div><p className="eyebrow text-[#7a293b]">FINANZAS</p><h2 className="serif mt-2 text-3xl">Registrar gasto</h2></div><button type="button" onClick={onClose} aria-label="Cerrar formulario"><X/></button></div>
    <Field label="Concepto" className="mt-6"><input name="title" required maxLength={180} className="admin-input" placeholder="Ej.: alquiler, envío, servicio"/></Field>
    <div className="mt-4 grid gap-4 sm:grid-cols-2"><Field label="Categoría"><input name="category" required maxLength={80} className="admin-input" placeholder="Ej.: servicios"/></Field><Field label="Monto (ARS)"><input name="amount" required type="number" min="1" max="1000000000" step="1" className="admin-input"/></Field></div>
    <Field label="Fecha del gasto" className="mt-4"><input name="incurredAt" required type="datetime-local" defaultValue={localDateTimeValue(new Date())} className="admin-input"/></Field>
    <Field label="Notas" className="mt-4"><textarea name="notes" rows={3} maxLength={1000} className="admin-input resize-y" placeholder="Comprobante, proveedor u observaciones"/></Field>
    {create.isError && <p role="alert" className="mt-4 text-sm text-[#7a293b]">No se pudo registrar el gasto. Revisá los datos e intentá de nuevo.</p>}
    <button disabled={create.isPending} className="mt-7 w-full bg-[#17263f] py-4 text-sm text-white disabled:opacity-60">{create.isPending ? 'Registrando…' : 'Guardar gasto'} <Check size={15} className="ml-2 inline"/></button>
  </form></Overlay>;
}

function CategoryForm({ category, onClose, onSaved }: { category: Category | null; onClose: () => void; onSaved: () => void }) {
  const create = useCreateCategory(); const update = useUpdateCategory(); const pending = create.isPending || update.isPending;
  const submit = (e: FormEvent<HTMLFormElement>) => { e.preventDefault(); const fd = new FormData(e.currentTarget); const data = { name: String(fd.get('name')), slug: String(fd.get('slug')), description: String(fd.get('description')), sortOrder: Number(fd.get('sortOrder')), visible: fd.get('visible') === 'on', demo: fd.get('demo') === 'on' }; if (category) update.mutate({ id: category.id, data }, { onSuccess: onSaved }); else create.mutate({ data }, { onSuccess: onSaved }); };
  return <Overlay onClose={onClose}><form onSubmit={submit} className="p-6 sm:p-8"><div className="flex justify-between"><div><p className="eyebrow text-[#7a293b]">ORDENAR LA CASA</p><h2 className="serif mt-2 text-3xl">{category ? 'Editar categoría' : 'Nueva categoría'}</h2></div><button type="button" onClick={onClose} aria-label="Cerrar formulario"><X/></button></div><Field label="Nombre" className="mt-6"><input name="name" required maxLength={100} defaultValue={category?.name} className="admin-input"/></Field><Field label="Slug" className="mt-4"><input name="slug" required maxLength={120} defaultValue={category?.slug} className="admin-input" placeholder="narrativa-argentina"/></Field><Field label="Descripción" className="mt-4"><textarea name="description" maxLength={600} rows={3} defaultValue={category?.description} className="admin-input"/></Field><Field label="Orden" className="mt-4"><input name="sortOrder" type="number" defaultValue={category?.sortOrder ?? 0} className="admin-input"/></Field><div className="mt-5 flex gap-5 text-sm"><label className="flex items-center gap-2"><input name="visible" type="checkbox" defaultChecked={category?.visible ?? true} className="accent-[#7a293b]"/>Visible</label><label className="flex items-center gap-2"><input name="demo" type="checkbox" defaultChecked={category?.demo ?? false} className="accent-[#7a293b]"/>Contenido de demostración</label></div>{(create.isError || update.isError) && <p role="alert" className="mt-4 text-sm text-[#7a293b]">No se pudo guardar la categoría.</p>}<button disabled={pending} className="mt-7 w-full bg-[#17263f] py-4 text-sm text-white disabled:opacity-60">{pending ? 'Guardando…' : category ? 'Guardar cambios' : 'Crear categoría'}</button></form></Overlay>;
}

function Router() { return <RoutedErrorBoundary><Switch><Route path="/" component={Store}/><Route path="/admin" component={Admin}/><Route component={NotFound}/></Switch></RoutedErrorBoundary>; }
function App() { return <QueryClientProvider client={queryClient}><TooltipProvider><WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}><Router/></WouterRouter><Toaster/></TooltipProvider></QueryClientProvider>; }
export default App;
