import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

interface Allergen {
  id: string;
  name: string;
}

// Verified-working Unsplash photo IDs for each allergen, served from
// images.unsplash.com directly (no API key). If a photo ever 404s, the
// AllergenThumb component below falls back to a serif-letter monogram so
// the layout never breaks.
const ALLERGEN_PHOTOS: Record<string, string> = {
  Gluten:     'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=240&h=240&fit=crop&q=70',
  Dairy:      'https://images.unsplash.com/photo-1550583724-b2692b85b150?w=240&h=240&fit=crop&q=70',
  Eggs:       'https://images.unsplash.com/photo-1582722872445-44dc5f7e3c8f?w=240&h=240&fit=crop&q=70',
  Nuts:       'https://images.unsplash.com/photo-1606923829589-9f9f8a51b9c4?w=240&h=240&fit=crop&q=70',
  Peanuts:    'https://images.unsplash.com/photo-1599481238640-86b34c6dab1c?w=240&h=240&fit=crop&q=70',
  Soy:        'https://images.unsplash.com/photo-1546554137-f86b9593a222?w=240&h=240&fit=crop&q=70',
  Mustard:    'https://images.unsplash.com/photo-1528750717929-32abb73d3bd9?w=240&h=240&fit=crop&q=70',
  Sesame:     'https://images.unsplash.com/photo-1565299585323-38d6b0865b47?w=240&h=240&fit=crop&q=70',
  Celery:     'https://images.unsplash.com/photo-1582281171774-3a39c25be64a?w=240&h=240&fit=crop&q=70',
  Sulphites:  'https://images.unsplash.com/photo-1547595628-c61a29f496f0?w=240&h=240&fit=crop&q=70',
  Fish:       'https://images.unsplash.com/photo-1485921325833-c519f76c4927?w=240&h=240&fit=crop&q=70',
  Crustaceans:'https://images.unsplash.com/photo-1582106074815-b066ce04a06d?w=240&h=240&fit=crop&q=70',
  Shellfish:  'https://images.unsplash.com/photo-1559329007-40df8a9345d8?w=240&h=240&fit=crop&q=70',
  Molluscs:   'https://images.unsplash.com/photo-1559329007-40df8a9345d8?w=240&h=240&fit=crop&q=70',
  Lupin:      'https://images.unsplash.com/photo-1591870155284-d3e09f4b5e22?w=240&h=240&fit=crop&q=70',
};

/** Thumbnail that falls back to a serif monogram if the image fails to load. */
function AllergenThumb({ name }: { name: string }) {
  const src = ALLERGEN_PHOTOS[name];
  const [failed, setFailed] = useState(!src);
  if (failed) {
    return (
      <div className="relative shrink-0 w-20 h-20 border border-tobacco/40 bg-paper-100 flex items-center justify-center">
        <span className="font-display text-3xl text-saffron leading-none">
          {name.charAt(0)}
        </span>
      </div>
    );
  }
  return (
    <div className="relative shrink-0 w-20 h-20 overflow-hidden grayscale border border-tobacco/30 bg-paper-100">
      <img
        src={src}
        alt=""
        loading="lazy"
        onError={() => setFailed(true)}
        className="absolute inset-0 w-full h-full object-cover"
      />
    </div>
  );
}

interface MenuItem {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
  category: { id: string; name: string };
  allergens?: { allergen: Allergen }[];
}

/**
 * Public allergens page — required by EU regulation 1169/2011 for German
 * food service. Groups dishes by the allergens they contain so a customer
 * with a known allergy can scan one column and confirm safe choices.
 */
export default function Allergens() {
  const { t } = useTranslation();
  const [items, setItems] = useState<MenuItem[]>([]);
  const [allAllergens, setAllAllergens] = useState<Allergen[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch('/api/menu/items?limit=100').then((r) => r.json()),
      fetch('/api/menu/allergens').then((r) => r.json()),
    ])
      .then(([menuJson, alJson]) => {
        setItems((menuJson.data ?? []).filter((i: MenuItem) => i.isActive));
        setAllAllergens(alJson.data ?? []);
      })
      .finally(() => setLoading(false));
  }, []);

  // Build: { allergenName: MenuItem[] }
  const byAllergen: Record<string, MenuItem[]> = {};
  for (const a of allAllergens) byAllergen[a.name] = [];
  for (const item of items) {
    for (const link of item.allergens ?? []) {
      const list = byAllergen[link.allergen.name];
      if (list) list.push(item);
    }
  }

  return (
    <div className="relative">
      <header className="relative" style={{ background: 'var(--paper-2)' }}>
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16">
          <div className="flex items-center gap-3">
            <span className="block h-px w-10 bg-saffron" />
            <span className="eyebrow text-saffron">EU 1169/2011</span>
          </div>
          <h1 className="font-display mt-5 text-5xl lg:text-6xl leading-[0.95] tracking-tight-display text-ink">
            {t('editorial.allergensPageTitle')}
          </h1>
          <p className="font-editorial mt-4 max-w-2xl text-base lg:text-lg leading-relaxed text-ink-soft">
            {t('editorial.allergensPageIntro')}
          </p>
          <div className="rule-strong mt-8" />
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-14 lg:py-20">
        {loading && (
          <p className="font-mono-tabular text-xs uppercase tracking-eyebrow text-ink-mute text-center py-16">
            …
          </p>
        )}

        {!loading && allAllergens.length === 0 && (
          <p className="font-editorial italic text-ink-mute text-center py-16">
            No allergens declared yet.
          </p>
        )}

        <ul className="divide-y divide-tobacco/30">
          {allAllergens.map((a) => {
            const dishes = byAllergen[a.name] ?? [];
            return (
              <li key={a.id} className="py-7 grid grid-cols-12 gap-5 items-start">
                {/* Photo + name column */}
                <div className="col-span-12 md:col-span-4 flex items-center gap-4">
                  <AllergenThumb name={a.name} />
                  <div>
                    <h2 className="font-display text-2xl text-ink leading-tight">{a.name}</h2>
                    <p className="font-editorial italic text-sm text-ink-soft mt-1">
                      {t(`editorial.allergens.${a.name.toLowerCase()}`, { defaultValue: a.name })}
                    </p>
                  </div>
                </div>
                {/* Dishes column */}
                <div className="col-span-12 md:col-span-8 md:pt-2">
                  {dishes.length === 0 ? (
                    <p className="font-editorial italic text-sm text-bottle">
                      {t('editorial.allergensNoneInDish')}
                    </p>
                  ) : (
                    <ul className="flex flex-wrap gap-2">
                      {dishes.map((d) => (
                        <li
                          key={d.id}
                          className="font-mono-tabular text-[10px] uppercase tracking-wider bg-paper-100 border border-tobacco/30 px-2.5 py-1"
                        >
                          {d.name}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
