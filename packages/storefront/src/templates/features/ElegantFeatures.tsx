interface FeaturesProps {
  features: Array<{ icon: string; title: string; description: string }> | null;
  t: (key: string) => string;
}

function getDefaultFeatures(t: (key: string) => string) {
  return [
    { icon: '🕗', title: 'Order by 8 PM', description: "Lock in tomorrow's lunch the night before. Per-zone cutoffs visible at a glance." },
    { icon: '📍', title: 'Smart Geo-fence', description: 'We deliver across Schwenningen and the wider Black Forest region.' },
    { icon: '🍛', title: 'Built for Teams', description: "Group orders, daily-rotating chef's pick, monthly invoicing on the roadmap." },
  ];
}

/**
 * Editorial three-act feature spread. Each act gets a roman numeral, a
 * serif kicker, and a thin tobacco rule beneath. No icon chrome — typography
 * carries the story.
 */
export default function ElegantFeatures({ features, t }: FeaturesProps) {
  const items = features?.length ? features : getDefaultFeatures(t);
  const numerals = ['I', 'II', 'III', 'IV', 'V', 'VI'];

  return (
    <section className="relative py-20 lg:py-28" style={{ background: 'var(--paper)' }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section heading — magazine TOC vibe */}
        <div className="grid grid-cols-12 gap-6 mb-14">
          <div className="col-span-12 lg:col-span-5">
            <span className="eyebrow">In this issue</span>
            <h2 className="font-display mt-3 text-4xl sm:text-5xl text-ink leading-[0.95] tracking-tight-display">
              Three things we do
              <br />
              <span className="italic font-light text-saffron">very seriously.</span>
            </h2>
          </div>
          <div className="col-span-12 lg:col-span-6 lg:col-start-7 self-end">
            <p className="font-editorial text-lg text-ink-soft leading-relaxed max-w-md">
              Eat Inka is a small operation built on three obsessions: the
              cutoff that makes everything possible, the catchment that keeps
              it honest, and the meals that make it worth the wait.
            </p>
          </div>
        </div>

        <div className="rule-strong" />

        <ul className="grid grid-cols-1 md:grid-cols-3 gap-0">
          {items.map((feature, i) => (
            <li
              key={i}
              className={`group relative py-10 md:py-14 px-2 md:px-8 ${
                i > 0 ? 'md:border-l md:border-tobacco/40' : ''
              } ${i < items.length - 1 ? 'border-b md:border-b-0 border-tobacco/40' : ''}`}
            >
              <div className="flex items-baseline gap-3">
                <span className="font-mono-tabular text-xs tracking-eyebrow text-saffron">
                  {numerals[i]}
                </span>
                <span className="block h-px flex-1 bg-tobacco/40" />
              </div>

              {/* Icon as a quiet glyph, not the main event */}
              {feature.icon && (
                <div className="mt-6 text-2xl text-ink-soft">{feature.icon}</div>
              )}

              <h3 className="font-display mt-4 text-2xl text-ink leading-tight">
                {feature.title}
              </h3>
              <p className="font-editorial mt-3 text-base text-ink-soft leading-relaxed max-w-xs">
                {feature.description}
              </p>
            </li>
          ))}
        </ul>

        <div className="rule-strong" />
      </div>
    </section>
  );
}
