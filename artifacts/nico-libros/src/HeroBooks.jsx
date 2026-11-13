import { useEffect, useRef } from 'react';
import './HeroBooks.css';
import habitsCover from '../../../assets/libro1.png';
import happinessCover from '../../../assets/libro2.png';
import believeCover from '../../../assets/libro3.png';

const BOOKS = [
  {
    title: 'Hábitos Atómicos',
    image: habitsCover,
    clip: 'polygon(4.5% 4%, 86% 2%, 88% 2%, 96% 6%, 97% 8%, 97% 96%, 90% 99%, 5% 98%)',
    x: '2%',
    y: '6%',
    rotY: -8,
    rotZ: -6,
    fall: 1100,
    spin: -40,
    delay: '0s',
  },
  {
    title: 'Si lo crees, lo creas',
    image: believeCover,
    clip: 'polygon(3.5% 4%, 85% 1.5%, 87% 1.5%, 96% 4%, 97% 7%, 97% 95%, 89% 98%, 4% 97%)',
    x: '38%',
    y: '-6%',
    rotY: -6,
    rotZ: 5,
    fall: 900,
    spin: 55,
    delay: '-2s',
  },
  {
    title: 'La felicidad: más allá de la ilusión',
    image: happinessCover,
    clip: 'polygon(7% 4%, 83% 3%, 85% 3%, 92% 6%, 93% 9%, 93% 95%, 86% 98%, 8% 98%)',
    x: '18%',
    y: '40%',
    rotY: -10,
    rotZ: -3,
    fall: 1300,
    spin: -70,
    delay: '-4s',
  },
];

export default function HeroBooks() {
  const stageRef = useRef(null);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    let frame = 0;
    let mouseFrame = 0;
    let targetMx = 0;
    let targetMy = 0;
    let currentMx = 0;
    let currentMy = 0;

    const hero = stage.closest('section');

    const updateProgress = () => {
      const heroHeight = hero?.offsetHeight || window.innerHeight;
      const progress = Math.min(Math.max(window.scrollY / (heroHeight * 0.85), 0), 1);
      stage.style.setProperty('--p', progress.toFixed(4));
      frame = 0;
    };

    const scheduleUpdate = () => {
      if (!frame) frame = window.requestAnimationFrame(updateProgress);
    };

    const onMouseMove = (e) => {
      const rect = (hero || stage).getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width;
      const y = (e.clientY - rect.top) / rect.height;
      targetMx = (Math.max(0, Math.min(1, x)) - 0.5) * 2;
      targetMy = (Math.max(0, Math.min(1, y)) - 0.5) * 2;
    };

    const onMouseLeave = () => {
      targetMx = 0;
      targetMy = 0;
    };

    const updateMouse = () => {
      currentMx += (targetMx - currentMx) * 0.08;
      currentMy += (targetMy - currentMy) * 0.08;
      stage.style.setProperty('--mx', currentMx.toFixed(4));
      stage.style.setProperty('--my', currentMy.toFixed(4));
      mouseFrame = window.requestAnimationFrame(updateMouse);
    };

    scheduleUpdate();
    mouseFrame = window.requestAnimationFrame(updateMouse);

    window.addEventListener('scroll', scheduleUpdate, { passive: true });
    window.addEventListener('resize', scheduleUpdate);

    if (hero) {
      hero.addEventListener('mousemove', onMouseMove, { passive: true });
      hero.addEventListener('mouseleave', onMouseLeave, { passive: true });
    }

    return () => {
      window.removeEventListener('scroll', scheduleUpdate);
      window.removeEventListener('resize', scheduleUpdate);
      if (hero) {
        hero.removeEventListener('mousemove', onMouseMove);
        hero.removeEventListener('mouseleave', onMouseLeave);
      }
      if (frame) window.cancelAnimationFrame(frame);
      if (mouseFrame) window.cancelAnimationFrame(mouseFrame);
    };
  }, []);

  return (
    <div className="hero-books" ref={stageRef} aria-hidden="true">
      {BOOKS.map((book) => (
        <div
          key={book.title}
          className="book-slot"
          style={{
            '--x': book.x,
            '--y': book.y,
            '--fall': `${book.fall}px`,
            '--spin': `${book.spin}deg`,
            '--rotZ': `${book.rotZ}deg`,
          }}
        >
          <div className="book-float" style={{ animationDelay: book.delay }}>
            <div className="book" style={{ '--rotY': `${book.rotY}deg` }}>
              <img
                className="book__image"
                src={book.image}
                alt=""
                draggable="false"
                style={{ '--clip': book.clip }}
              />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
