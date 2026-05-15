import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useApi } from '../hooks/useApi.js';
import MenuItemModal from '../components/MenuItemModal.js';

interface Category {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
  parentId: string | null;
  _count: { menuItems: number };
  children: Category[];
}

interface MenuItem {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  price: number;
  image: string | null;
  isActive: boolean;
  trackStock: boolean;
  stockQty: number;
  category: { id: string; name: string };
  _count: { options: number; allergens: number; mealtimes: number };
}

interface MenuResponse {
  data: MenuItem[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

/**
 * Eat Inka menu — read as a printed menu/magazine spread. Each category is a
 * department; each dish is a horizontal "line" with a dotted leader and a
 * small square thumbnail. The grid renders 2 columns on wide viewports so
 * the page never feels like an ecommerce wall of identical cards.
 */
export default function Menu() {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedCategory, setSelectedCategory] = useState<string | null>(
    searchParams.get('category'),
  );
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [debouncedSearch, setDebouncedSearch] = useState(search);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);

  const { data: categories } = useApi<Category[]>('/api/menu/categories');

  // Fetch ALL items in one shot — the editorial layout reads better when
  // every dish in a category is visible together, so we skip pagination.
  const itemsUrl = useMemo(() => {
    const params = new URLSearchParams();
    if (selectedCategory) params.set('categoryId', selectedCategory);
    if (debouncedSearch) params.set('search', debouncedSearch);
    params.set('limit', '50');
    return `/api/menu/items?${params}`;
  }, [selectedCategory, debouncedSearch]);

  const [items, setItems] = useState<MenuItem[]>([]);
  const [itemsLoading, setItemsLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    setItemsLoading(true);
    fetch(itemsUrl)
      .then((res) => res.json())
      .then((json: MenuResponse) => setItems(json.data))
      .finally(() => setItemsLoading(false));
  }, [itemsUrl]);

  useEffect(() => {
    const params: Record<string, string> = {};
    if (selectedCategory) params.category = selectedCategory;
    if (debouncedSearch) params.search = debouncedSearch;
    setSearchParams(params, { replace: true });
  }, [selectedCategory, debouncedSearch, setSearchParams]);

  const activeCategories = useMemo(
    () => (categories || []).filter((c) => c.isActive && !c.parentId),
    [categories],
  );
  const activeItems = useMemo(
    () => items.filter((i) => i.isActive && (!i.trackStock || i.stockQty > 0)),
    [items],
  );

  // Group items by category so we can render each as a labeled department
  const itemsByCat = useMemo(() => {
    const map = new Map<string, MenuItem[]>();
    for (const item of activeItems) {
      const list = map.get(item.category.id) || [];
      list.push(item);
      map.set(item.category.id, list);
    }
    return map;
  }, [activeItems]);

  const numerals = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];

  return (
    <div className="relative">
      {/* Masthead — the menu has its own banner-line */}
      <header className="relative" style={{ background: 'var(--paper-2)' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16">
          <div className="grid grid-cols-12 gap-6">
            <div className="col-span-12 lg:col-span-7">
              <div className="flex items-center gap-3">
                <span className="block h-px w-10 bg-saffron" />
                <span className="eyebrow text-saffron">The Bill of Fare</span>
              </div>
              <h1 className="font-display mt-5 text-5xl lg:text-7xl leading-[0.95] tracking-tight-display text-ink">
                Today's kitchen, <span className="italic text-saffron">tomorrow's</span> table.
              </h1>
            </div>
            <div className="col-span-12 lg:col-span-4 lg:col-start-9 self-end">
              <p className="font-editorial text-base leading-relaxed text-ink-soft">
                A small menu, written each morning. Pick by 20:00 tonight and
                we'll have it at your desk before the post-lunch lull.
              </p>
            </div>
          </div>

          {/* Filter row — categories as horizontal "department" chips, search as a thin underline */}
          <div className="rule mt-10" />
          <div className="flex flex-col lg:flex-row gap-4 lg:items-center justify-between mt-5">
            <nav className="flex flex-wrap gap-x-6 gap-y-2 items-baseline">
              <FilterChip active={!selectedCategory} onClick={() => setSelectedCategory(null)}>
                All
              </FilterChip>
              {activeCategories.map((cat) => (
                <FilterChip
                  key={cat.id}
                  active={selectedCategory === cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                >
                  {cat.name}
                  <span className="ml-1 text-[10px] font-mono-tabular text-ink-mute">
                    {cat._count.menuItems.toString().padStart(2, '0')}
                  </span>
                </FilterChip>
              ))}
            </nav>
            <div className="relative max-w-xs w-full lg:w-64">
              <input
                type="text"
                placeholder={t('menu.searchPlaceholder')}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-transparent border-0 border-b border-ink/40 focus:border-saffron outline-none px-0 py-2 font-ui text-sm placeholder:text-ink-mute"
              />
              <span className="absolute right-0 bottom-2 font-mono-tabular text-[10px] text-ink-mute uppercase tracking-eyebrow">
                find ↵
              </span>
            </div>
          </div>
          <div className="rule mt-3" />
        </div>
      </header>

      {/* The bill itself */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 lg:py-20">
        {itemsLoading && (
          <div className="text-center py-20 font-mono-tabular text-xs uppercase tracking-eyebrow text-ink-mute">
            Setting the table…
          </div>
        )}

        {!itemsLoading && activeItems.length === 0 && (
          <div className="text-center py-20">
            <p className="font-editorial italic text-ink-mute">No dishes match that search.</p>
          </div>
        )}

        {!itemsLoading && activeCategories
          .filter((cat) => itemsByCat.has(cat.id))
          .map((cat, ci) => {
            const dishes = itemsByCat.get(cat.id) || [];
            return (
              <section key={cat.id} className={ci > 0 ? 'mt-16 lg:mt-20' : ''}>
                <header className="mb-8 lg:mb-10">
                  <div className="flex items-baseline gap-4">
                    <span className="font-mono-tabular text-sm tracking-eyebrow text-saffron">
                      {numerals[ci]}
                    </span>
                    <h2 className="font-display text-3xl lg:text-4xl text-ink leading-none">
                      {cat.name}
                    </h2>
                    <span className="block flex-1 h-px bg-tobacco/40" />
                    <span className="font-mono-tabular text-xs text-ink-mute">
                      {dishes.length.toString().padStart(2, '0')} dishes
                    </span>
                  </div>
                </header>

                <ul className="grid grid-cols-1 lg:grid-cols-2 gap-x-12 lg:gap-x-16 gap-y-7">
                  {dishes.map((item, ii) => (
                    <Dish
                      key={item.id}
                      item={item}
                      index={ii + 1}
                      onSelect={() => setSelectedItemId(item.id)}
                    />
                  ))}
                </ul>
              </section>
            );
          })}
      </div>

      {/* Item detail modal */}
      {selectedItemId && (
        <MenuItemModal itemId={selectedItemId} onClose={() => setSelectedItemId(null)} />
      )}
    </div>
  );
}

/** A single line in the printed menu. */
function Dish({
  item,
  index,
  onSelect,
}: {
  item: MenuItem;
  index: number;
  onSelect: () => void;
}) {
  const hindi = HINDI_NAMES[item.slug];
  const tags = DISH_TAGS[item.slug];

  return (
    <li>
      <button
        onClick={onSelect}
        className="group w-full text-left flex gap-5 items-start hover:bg-paper-100/60 -mx-2 px-2 py-1 transition-colors"
      >
        {item.image && (
          <div className="relative shrink-0 w-20 h-20 lg:w-24 lg:h-24 overflow-hidden grayscale group-hover:grayscale-0 transition-all duration-300">
            <img
              src={item.image}
              alt=""
              className="absolute inset-0 w-full h-full object-cover"
            />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2">
            <span className="font-mono-tabular text-[10px] text-ink-mute tracking-wider tabular-nums">
              {String(index).padStart(2, '0')}
            </span>
            <h3 className="font-display text-xl lg:text-2xl text-ink leading-tight group-hover:text-saffron transition-colors">
              {item.name}
            </h3>
            <span className="menu-leader" aria-hidden />
            <span className="font-mono-tabular text-base text-ink whitespace-nowrap">
              €{item.price.toFixed(2)}
            </span>
          </div>
          {hindi && (
            <div className="eyebrow eyebrow-mute mt-1.5">
              {hindi}
            </div>
          )}
          {item.description && (
            <p className="font-editorial italic text-sm text-ink-soft mt-2 leading-snug line-clamp-2">
              {item.description}
            </p>
          )}
          {tags && (
            <div className="mt-2 flex items-center gap-2 font-mono-tabular text-[10px] uppercase tracking-eyebrow">
              {tags.map((tag) => (
                <span
                  key={tag.label}
                  className={tag.kind === 'veg' ? 'text-bottle' : 'text-tobacco'}
                >
                  {tag.label}
                </span>
              ))}
            </div>
          )}
        </div>
      </button>
    </li>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`group font-ui text-sm transition-colors ${
        active ? 'text-saffron' : 'text-ink hover:text-saffron'
      }`}
    >
      <span className={`pb-1 inline-block ${active ? 'border-b-2 border-saffron' : 'border-b-2 border-transparent'}`}>
        {children}
      </span>
    </button>
  );
}

// Static editorial enrichments — pure presentation; not stored in the DB.
// We add the Hindi-transliterated dish name as small caps, plus dietary tags.
const HINDI_NAMES: Record<string, string> = {
  'eatinka-butter-chicken': 'Murgh Makhani',
  'eatinka-tikka-masala': 'Murgh Tikka Masala',
  'eatinka-rogan-josh': 'Gosht Rogan Josh',
  'eatinka-paneer-masala': 'Paneer Tikka Masala',
  'eatinka-dal-tadka': 'Dal Tadka',
  'eatinka-chana-masala': 'Chana Masala',
  'eatinka-basmati': 'Basmati Chawal',
  'eatinka-garlic-naan': 'Lehsuni Naan',
  'eatinka-plain-naan': 'Naan',
  'eatinka-samosa': 'Samosa',
  'eatinka-mango-lassi': 'Aam Lassi',
  'eatinka-masala-chai': 'Masala Chai',
};

const DISH_TAGS: Record<string, Array<{ label: string; kind: 'veg' | 'note' }>> = {
  'eatinka-paneer-masala': [{ label: 'Vegetarian', kind: 'veg' }],
  'eatinka-dal-tadka': [{ label: 'Vegan', kind: 'veg' }],
  'eatinka-chana-masala': [{ label: 'Vegan', kind: 'veg' }],
  'eatinka-basmati': [{ label: 'Vegan', kind: 'veg' }],
  'eatinka-garlic-naan': [{ label: 'Vegetarian', kind: 'veg' }],
  'eatinka-plain-naan': [{ label: 'Vegetarian', kind: 'veg' }],
  'eatinka-samosa': [{ label: 'Vegetarian', kind: 'veg' }],
  'eatinka-mango-lassi': [{ label: 'Vegetarian', kind: 'veg' }],
  'eatinka-masala-chai': [{ label: 'Vegetarian', kind: 'veg' }],
};
