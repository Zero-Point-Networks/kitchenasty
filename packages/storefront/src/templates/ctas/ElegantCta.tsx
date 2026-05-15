import { Link } from 'react-router-dom';

interface CtaProps {
  cta: { title?: string; description?: string; buttonText?: string; buttonLink?: string } | null;
  t: (key: string) => string;
}

/**
 * Closing folio — the magazine equivalent of "subscribe to our next issue".
 * Photo-backed, asymmetric, with a colophon-style invitation. Pairs visually
 * with the hero up top, bookending the page.
 */
export default function ElegantCta({ cta, t }: CtaProps) {
  // Always prefer translated editorial copy; seed-stored CTA is the fallback.
  const title = t('editorial.ctaTitle');
  const description = t('editorial.ctaDescription');
  const buttonText = t('editorial.ctaButton');
  const buttonLink = cta?.buttonLink || '/menu';

  return (
    <section className="relative isolate overflow-hidden" style={{ background: 'var(--ink)' }}>
      {/* Saffron warm wash on bottom */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(60% 80% at 80% 110%, rgba(194, 65, 12, 0.45) 0%, rgba(194, 65, 12, 0) 60%)',
        }}
      />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-28">
        <div className="grid grid-cols-12 gap-6 lg:gap-12 items-center">
          <div className="col-span-12 lg:col-span-7">
            <div className="flex items-center gap-3">
              <span className="block h-px w-10" style={{ background: 'var(--saffron)' }} />
              <span className="eyebrow" style={{ color: 'var(--saffron)' }}>{t('editorial.ctaEyebrow')}</span>
            </div>

            <h2 className="font-display mt-6 text-4xl sm:text-5xl lg:text-6xl leading-[0.98] tracking-tight-display text-paper">
              {title}
            </h2>

            <p className="font-editorial mt-7 text-lg leading-relaxed text-paper/75 max-w-xl">
              {description}
            </p>

            <div className="mt-10 flex flex-wrap items-center gap-4">
              <Link
                to={buttonLink}
                className="group inline-flex items-center gap-2 bg-paper text-ink px-7 py-3.5 font-ui text-sm font-medium tracking-wide hover:bg-saffron hover:text-paper transition-colors"
              >
                {buttonText}
                <span className="inline-block transition-transform group-hover:translate-x-1">→</span>
              </Link>
              <span className="font-mono-tabular text-[11px] uppercase tracking-eyebrow text-paper/60">
                {t('editorial.ctaFreeNote')}
              </span>
            </div>
          </div>

          {/* Colophon block — a "About this issue" card */}
          <aside className="col-span-12 lg:col-span-4 lg:col-start-9">
            <div className="border border-paper/20 p-7 backdrop-blur-sm">
              <span className="eyebrow text-paper/60">{t('editorial.colophonTitle')}</span>
              <dl className="mt-4 space-y-3 font-mono-tabular text-xs text-paper/70 uppercase tracking-wider">
                <Row k={t('editorial.detailsKitchen')} v={`${t('editorial.detailsKitchenValue')} · Schwenningen`} />
                <Row k={t('editorial.detailsCatchment')} v={t('editorial.detailsCatchmentValue')} />
                <Row k={t('editorial.detailsCutoff')} v="20:00 · 19:00 · 17:00" />
                <Row k={t('editorial.detailsDelivery')} v={t('editorial.detailsDeliveryValue')} />
              </dl>
            </div>
          </aside>
        </div>
      </div>
    </section>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-paper/15 pb-2 last:border-0">
      <dt className="text-paper/55">{k}</dt>
      <dd className="text-paper">{v}</dd>
    </div>
  );
}
