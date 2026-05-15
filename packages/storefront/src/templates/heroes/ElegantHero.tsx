import { Link } from 'react-router-dom';

interface HeroProps {
  hero: {
    title?: string;
    subtitle?: string;
    ctaPrimaryText?: string;
    ctaPrimaryLink?: string;
    ctaSecondaryText?: string;
    ctaSecondaryLink?: string;
    backgroundImage?: string;
  } | null;
  t: (key: string) => string;
}

/**
 * Editorial hero — a full-width typographic spread with no first-screen
 * photo. The wordmark sits silent up top, then a massive Fraunces headline
 * carries the moment, with a drop-cap intro paragraph and two restrained
 * CTAs. Photography arrives below, in a "Today's Kitchen" specimen strip
 * of three numbered dish cards.
 */
export default function ElegantHero({ hero, t }: HeroProps) {
  const issueDate = new Date();
  const folio = formatFolio(issueDate);

  return (
    <section className="relative isolate" style={{ background: 'var(--paper)' }}>
      {/* Folio strip — magazine top-of-page */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-5 pb-2">
        <div className="flex items-center justify-between text-[10px] tracking-eyebrow uppercase font-ui text-ink-mute">
          <span>Vol. 01 · No. 01</span>
          <span className="hidden sm:inline font-mono-tabular tracking-wider">{folio}</span>
          <span className="hidden sm:inline">Tomorrow's Lunch · Daily Edition</span>
        </div>
        <div className="rule-strong mt-3" />
      </div>

      {/* The big editorial moment — pure type, full width */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 sm:pt-16 lg:pt-24 pb-16 lg:pb-24 reveal-stack">
        <div className="flex items-center gap-3">
          <span className="block h-px w-12 bg-saffron" />
          <span className="eyebrow text-saffron">Corporate Lunch · Schwenningen</span>
          <span className="block h-px flex-1 bg-tobacco/40" />
          <span className="hidden sm:inline-block font-mono-tabular text-[10px] tracking-eyebrow uppercase text-ink-mute">
            Open by 20:00 tonight
          </span>
        </div>

        <h1 className="font-display mt-8 sm:mt-10 text-[3.25rem] sm:text-[5.5rem] lg:text-[8.5rem] leading-[0.88] tracking-tight-display text-ink">
          Tomorrow's lunch,
          <br />
          <span className="italic font-light">locked in</span>
          <span className="font-light"> </span>
          <span>tonight</span>
          <span className="text-saffron">.</span>
        </h1>

        <div className="mt-10 lg:mt-14 grid grid-cols-12 gap-6">
          <p className="font-editorial col-span-12 lg:col-span-7 text-lg lg:text-xl leading-relaxed text-ink-soft drop-cap">
            {hero?.subtitle ||
              'Authentic Indian dishes from Moksha — delivered to your team by noon. We open the kitchen book at sundown; you reserve, we cook, the rest takes care of itself.'}
          </p>

          {/* Right-hand details card — small, dense, magazine-sidebar style */}
          <aside className="col-span-12 lg:col-span-4 lg:col-start-9 self-end">
            <div className="border-t-2 border-ink pt-4">
              <dl className="grid grid-cols-2 gap-y-3 font-mono-tabular text-xs uppercase tracking-eyebrow">
                <dt className="text-ink-mute">Kitchen</dt>
                <dd className="text-ink text-right">Moksha</dd>
                <dt className="text-ink-mute">Catchment</dt>
                <dd className="text-ink text-right">3 Zones · 12 km</dd>
                <dt className="text-ink-mute">Cutoff</dt>
                <dd className="text-saffron text-right">20:00 · 19:00 · 17:00</dd>
                <dt className="text-ink-mute">Delivery</dt>
                <dd className="text-ink text-right">Mon — Fri · 12:00</dd>
              </dl>
            </div>
          </aside>
        </div>

        <div className="mt-12 flex flex-wrap items-center gap-4">
          <Link
            to={hero?.ctaPrimaryLink || '/menu'}
            className="group inline-flex items-center gap-3 bg-ink text-paper px-8 py-4 font-ui text-sm font-medium tracking-wide hover:bg-saffron transition-colors"
          >
            {hero?.ctaPrimaryText || t('home.viewMenu')}
            <span className="inline-block transition-transform group-hover:translate-x-1">→</span>
          </Link>
          <Link
            to={hero?.ctaSecondaryLink || '/locations'}
            className="inline-flex items-center gap-2 border-b border-ink/40 text-ink hover:text-saffron hover:border-saffron px-1 pb-1 font-ui text-sm tracking-wide transition-colors"
          >
            {hero?.ctaSecondaryText || 'See the catchment'}
          </Link>
          <span className="ml-auto hidden sm:inline-block font-editorial italic text-sm text-ink-mute">
            — &nbsp;Established with Moksha, 2026
          </span>
        </div>
      </div>

      <div className="rule-strong" />

      {/* "Today's Kitchen" specimen strip — three dish polaroids */}
      <SpecimenStrip />

      <div className="rule-strong" />
    </section>
  );
}

interface Specimen {
  num: string;
  image: string;
  name: string;
  hindi: string;
  note: string;
  price: string;
}

const SPECIMENS: Specimen[] = [
  {
    num: '01',
    image: '/uploads/eatinka/pexels-pixabay-277253.jpg',
    name: 'Butter Chicken',
    hindi: 'Murgh Makhani',
    note: 'Tomato, cashew, fenugreek. Mild heat.',
    price: '11.50',
  },
  {
    num: '02',
    image: '/uploads/eatinka/pexels-fotios-photos-1351238.jpg',
    name: 'Lamb Rogan Josh',
    hindi: 'Gosht Rogan Josh',
    note: 'Kashmiri chilies, ginger, garam masala.',
    price: '13.50',
  },
  {
    num: '03',
    image: '/uploads/eatinka/pexels-ella-olsson-572949-1640777.jpg',
    name: 'Paneer Tikka Masala',
    hindi: 'Paneer · Vegetarian',
    note: 'Char-grilled cottage cheese in a rich masala.',
    price: '10.90',
  },
];

function SpecimenStrip() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 lg:py-20">
      <div className="flex items-baseline gap-4 mb-10">
        <span className="font-mono-tabular text-xs tracking-eyebrow uppercase text-ink-mute">
          Today's Kitchen
        </span>
        <span className="block flex-1 h-px bg-tobacco/40" />
        <span className="font-editorial italic text-sm text-ink-soft hidden sm:inline">
          Three of twelve dishes opening tomorrow
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-10">
        {SPECIMENS.map((s) => (
          <SpecimenCard key={s.num} specimen={s} />
        ))}
      </div>
    </div>
  );
}

function SpecimenCard({ specimen }: { specimen: Specimen }) {
  return (
    <Link
      to="/menu"
      className="group block"
    >
      <div className="relative aspect-[4/5] overflow-hidden bg-paper-3">
        <img
          src={specimen.image}
          alt={specimen.name}
          className="absolute inset-0 w-full h-full object-cover transition-transform duration-[1200ms] ease-out group-hover:scale-[1.04]"
        />
        {/* Diagonal "exam stamp" with the number */}
        <div className="absolute top-3 left-3 bg-paper px-2.5 py-1">
          <span className="font-mono-tabular text-[10px] tracking-eyebrow uppercase text-ink-mute">
            No.&nbsp;
          </span>
          <span className="font-display text-base text-ink">{specimen.num}</span>
        </div>
      </div>
      <div className="mt-4 flex items-baseline gap-3">
        <h3 className="font-display text-xl text-ink leading-tight group-hover:text-saffron transition-colors">
          {specimen.name}
        </h3>
        <span className="block flex-1 border-b border-dotted border-ink/30 translate-y-[-4px]" />
        <span className="font-mono-tabular text-sm text-ink">€{specimen.price}</span>
      </div>
      <div className="eyebrow eyebrow-mute mt-1.5">{specimen.hindi}</div>
      <p className="font-editorial italic text-sm text-ink-soft mt-2 leading-snug">
        {specimen.note}
      </p>
    </Link>
  );
}

function formatFolio(d: Date): string {
  const days = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
  const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  return `${days[d.getDay()]} ${String(d.getDate()).padStart(2, '0')} ${months[d.getMonth()]} ${d.getFullYear()}`;
}
