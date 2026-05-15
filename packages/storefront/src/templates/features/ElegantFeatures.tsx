import { useInView } from '../../hooks/useInView.js';

interface FeaturesProps {
  features: Array<{ icon: string; title: string; description: string }> | null;
  t: (key: string) => string;
}

function getDefaultFeatures(t: (key: string) => string) {
  return [
    { icon: '🕗', title: t('editorial.featureOrderBy'), description: t('editorial.featureOrderByDesc') },
    { icon: '📍', title: t('editorial.featureGeofence'), description: t('editorial.featureGeofenceDesc') },
    { icon: '🍛', title: t('editorial.featureTeams'), description: t('editorial.featureTeamsDesc') },
  ];
}

/**
 * Editorial three-act feature spread. Each act gets a roman numeral, a
 * serif kicker, and a thin tobacco rule beneath. No icon chrome — typography
 * carries the story.
 */
export default function ElegantFeatures({ features, t }: FeaturesProps) {
  // Always use translated defaults so language switching works; seed-provided
  // features fall through only when the locale has nothing to say.
  const defaults = getDefaultFeatures(t);
  const items = features?.length === defaults.length ? defaults : (features?.length ? features : defaults);
  const numerals = ['I', 'II', 'III', 'IV', 'V', 'VI'];

  return (
    <section className="relative py-20 lg:py-28" style={{ background: 'var(--paper)' }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section heading — magazine TOC vibe */}
        <div className="grid grid-cols-12 gap-6 mb-14">
          <div className="col-span-12 lg:col-span-5">
            <span className="eyebrow">{t('editorial.featuresEyebrow')}</span>
            <h2 className="font-display mt-3 text-4xl sm:text-5xl text-ink leading-[0.95] tracking-tight-display">
              {t('editorial.featuresTitleLine1')}
              <br />
              <span className="italic font-light text-saffron">{t('editorial.featuresTitleLine2')}</span>
            </h2>
          </div>
          <div className="col-span-12 lg:col-span-6 lg:col-start-7 self-end">
            <p className="font-editorial text-lg text-ink-soft leading-relaxed max-w-md">
              {t('editorial.featuresIntro')}
            </p>
          </div>
        </div>

        <div className="rule-strong" />

        <ul className="grid grid-cols-1 md:grid-cols-3 gap-0">
          {items.map((feature, i) => (
            <FeatureItem
              key={i}
              feature={feature}
              numeral={numerals[i]}
              index={i}
              isLast={i === items.length - 1}
            />
          ))}
        </ul>

        <div className="rule-strong" />
      </div>
    </section>
  );
}

function FeatureItem({
  feature,
  numeral,
  index,
  isLast,
}: {
  feature: { icon: string; title: string; description: string };
  numeral: string;
  index: number;
  isLast: boolean;
}) {
  const { ref, visible } = useInView<HTMLLIElement>();
  const delayClass = `reveal-on-scroll-${Math.min(index + 1, 3)}`;
  return (
    <li
      ref={ref}
      className={`group relative py-10 md:py-14 px-2 md:px-8 reveal-on-scroll ${delayClass} ${
        visible ? 'is-visible' : ''
      } ${index > 0 ? 'md:border-l md:border-tobacco/40' : ''} ${
        !isLast ? 'border-b md:border-b-0 border-tobacco/40' : ''
      }`}
    >
      <div className="flex items-baseline gap-3">
        <span className="font-mono-tabular text-xs tracking-eyebrow text-saffron">{numeral}</span>
        <span className="block h-px flex-1 bg-tobacco/40" />
      </div>

      {feature.icon && <div className="mt-6 text-2xl text-ink-soft">{feature.icon}</div>}

      <h3 className="font-display mt-4 text-2xl text-ink leading-tight">{feature.title}</h3>
      <p className="font-editorial mt-3 text-base text-ink-soft leading-relaxed max-w-xs">
        {feature.description}
      </p>
    </li>
  );
}
