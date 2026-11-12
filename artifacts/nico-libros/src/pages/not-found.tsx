import { useEffect } from 'react';
import { Link } from 'wouter';
import { ArrowLeft, BookOpen } from 'lucide-react';

export default function NotFound() {
  useEffect(() => {
    document.title = 'Página no encontrada | Nico Libros';
    document.querySelector('meta[name="robots"]')?.setAttribute('content', 'noindex, nofollow');
  }, []);

  return (
    <main className="paper-grain grid min-h-[100dvh] place-items-center bg-[#f1eadc] p-5 text-[#17263f]">
      <div className="w-full max-w-xl border border-[#d8d0c2] bg-[#f8f4eb] p-8 text-center sm:p-12">
        <BookOpen size={34} strokeWidth={1.3} className="mx-auto text-[#7a293b]" />
        <p className="eyebrow mt-5 text-[#7a293b]">404 · ESTA PÁGINA NO ESTÁ EN EL ESTANTE</p>
        <h1 className="serif mt-4 text-4xl leading-tight">No encontramos lo que buscabas.</h1>
        <p className="mt-4 text-sm leading-6 text-[#626978]">Volvé a la tienda y seguí buscando tu próxima lectura.</p>
        <Link href="/" className="mt-7 inline-flex items-center gap-2 bg-[#17263f] px-5 py-3 text-sm text-white hover:bg-[#7a293b]">
          <ArrowLeft size={15} /> Volver a Nico Libros
        </Link>
      </div>
    </main>
  );
}
