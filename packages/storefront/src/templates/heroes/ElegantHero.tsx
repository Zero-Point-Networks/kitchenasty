import { Link } from 'react-router-dom';
import HeroGallery, { type HeroPhoto } from '../../components/HeroGallery.js';
import { useInView } from '../../hooks/useInView.js';

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
          <span>{t('editorial.folioVolume')}</span>
          <span className="hidden sm:inline font-mono-tabular tracking-wider">{folio}</span>
          <span className="hidden sm:inline">{t('editorial.folioDailyEdition')}</span>
        </div>
        <div className="rule-strong mt-3" />
      </div>

      {/* The big editorial moment — pure type, full width */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 sm:pt-16 lg:pt-24 pb-16 lg:pb-24 reveal-stack">
        <div className="flex items-center gap-3">
          <span className="block h-px w-12 bg-saffron" />
          <span className="eyebrow text-saffron">{t('editorial.heroEyebrow')}</span>
          <span className="block h-px flex-1 bg-tobacco/40" />
          <span className="hidden sm:inline-block font-mono-tabular text-[10px] tracking-eyebrow uppercase text-ink-mute">
            {t('editorial.heroOpenBy')}
          </span>
        </div>

        <div className="mt-8 lg:mt-10 grid grid-cols-12 gap-6 lg:gap-10">
          {/* LEFT — Headline + drop-cap subtitle + CTA */}
          <div className="col-span-12 lg:col-span-8">
            <h1 className="font-display text-[3.25rem] sm:text-[5rem] lg:text-[7.5rem] leading-[0.9] tracking-tight-display text-ink">
              {t('editorial.heroTitleLine1')}
              <br />
              <span className="italic font-light">{t('editorial.heroTitleLine2')}</span>
              <span className="font-light"> </span>
              <span>{t('editorial.heroTitleLine3')}</span>
              <span className="text-saffron heartbeat">.</span>
            </h1>

            <p className="font-editorial mt-8 lg:mt-10 max-w-xl text-lg lg:text-xl leading-relaxed text-ink-soft drop-cap">
              {t('editorial.heroSubtitle')}
            </p>

            <div className="mt-10 flex flex-wrap items-center gap-4">
              <Link
                to={hero?.ctaPrimaryLink || '/menu'}
                className="group inline-flex items-center gap-3 bg-ink text-paper px-8 py-4 font-ui text-sm font-medium tracking-wide hover:bg-saffron transition-colors"
              >
                {t('editorial.heroCtaPrimary')}
                <span className="inline-block transition-transform group-hover:translate-x-1">→</span>
              </Link>
              <p className="font-editorial italic text-sm text-ink-mute">
                {t('editorial.heroEstablished')}
              </p>
            </div>
          </div>

          {/* RIGHT — Rotating photo frame stacked above the magazine-sidebar dl */}
          <aside className="col-span-12 lg:col-span-4 flex flex-col">
            <HeroGallery photos={HERO_PHOTOS} />
            <div className="border-t-2 border-ink pt-4 mt-6">
              <dl className="grid grid-cols-2 gap-y-3 font-mono-tabular text-xs uppercase tracking-eyebrow">
                <dt className="text-ink-mute">{t('editorial.detailsKitchen')}</dt>
                <dd className="text-ink text-right">{t('editorial.detailsKitchenValue')}</dd>
                <dt className="text-ink-mute">{t('editorial.detailsCatchment')}</dt>
                <dd className="text-ink text-right">{t('editorial.detailsCatchmentValue')}</dd>
                <dt className="text-ink-mute">{t('editorial.detailsCutoff')}</dt>
                <dd className="text-saffron text-right whitespace-nowrap">20:00</dd>
                <dt className="text-ink-mute">{t('editorial.detailsDelivery')}</dt>
                <dd className="text-ink text-right">{t('editorial.detailsDeliveryValue')}</dd>
              </dl>
            </div>
          </aside>
        </div>
      </div>

      <div className="rule-strong" />

      {/* "Today's Kitchen" specimen strip — three dish polaroids */}
      <SpecimenStrip t={t} />

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

function SpecimenStrip({ t }: { t: (k: string) => string }) {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 lg:py-20">
      <div className="flex items-baseline gap-4 mb-10">
        <span className="font-mono-tabular text-xs tracking-eyebrow uppercase text-ink-mute">
          {t('editorial.todaysKitchen')}
        </span>
        <span className="block flex-1 h-px bg-tobacco/40" />
        <span className="font-editorial italic text-sm text-ink-soft hidden sm:inline">
          {t('editorial.todaysKitchenNote')}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-10">
        {SPECIMENS.map((s, i) => (
          <SpecimenCard key={s.num} specimen={s} index={i + 1} />
        ))}
      </div>
    </div>
  );
}

function SpecimenCard({ specimen, index }: { specimen: Specimen; index: number }) {
  const { ref, visible } = useInView<HTMLAnchorElement>();
  const delayClass = `reveal-on-scroll-${Math.min(index, 3)}`;
  return (
    <Link
      ref={ref}
      to="/menu"
      className={`group block reveal-on-scroll ${delayClass} ${visible ? 'is-visible' : ''}`}
    >
      <div className="relative aspect-[4/5] overflow-hidden bg-paper-3">
        <img
          src={specimen.image}
          alt={specimen.name}
          className="absolute inset-0 w-full h-full object-cover transition-transform duration-[1400ms] ease-out group-hover:scale-[1.05]"
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

const HERO_PHOTOS: HeroPhoto[] = [
  { src: '/uploads/eatinka/pexels-fotios-photos-1351238.jpg', captionKey: 'editorial.gallery.rogan-josh' },
  { src: '/uploads/eatinka/pexels-pixabay-277253.jpg', captionKey: 'editorial.gallery.butter-chicken' },
  { src: '/uploads/eatinka/pexels-ella-olsson-572949-1640777.jpg', captionKey: 'editorial.gallery.paneer' },
  { src: '/uploads/eatinka/pexels-mareefe-678414.jpg', captionKey: 'editorial.gallery.dal-tadka' },
];

function formatFolio(d: Date): string {
  const days = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
  const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  return `${days[d.getDay()]} ${String(d.getDate()).padStart(2, '0')} ${months[d.getMonth()]} ${d.getFullYear()}`;
}
