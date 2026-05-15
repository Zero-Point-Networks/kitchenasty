import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

export interface HeroPhoto {
  src: string;
  /** Translation key to render inside the photo frame chip. */
  captionKey: string;
}

interface Props {
  photos: HeroPhoto[];
  /** Duration each photo stays before crossfading away, in ms. */
  intervalMs?: number;
}

/**
 * Slow auto-rotating photo frame for the editorial hero. One image is
 * visible at a time; transitions are a 2 s crossfade with a gentle Ken-Burns
 * zoom on the active photo. Caption + tiny photo credit rotate in sync.
 *
 * Pauses cycling while the tab is hidden so we don't drift through the deck
 * unnoticed.
 */
export default function HeroGallery({ photos, intervalMs = 5500 }: Props) {
  const { t } = useTranslation();
  const [active, setActive] = useState(0);

  useEffect(() => {
    if (photos.length < 2) return;
    let timer = window.setInterval(tick, intervalMs);

    function tick() {
      setActive((i) => (i + 1) % photos.length);
    }
    function onVis() {
      window.clearInterval(timer);
      if (!document.hidden) timer = window.setInterval(tick, intervalMs);
    }
    document.addEventListener('visibilitychange', onVis);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [photos.length, intervalMs]);

  const current = photos[active];

  return (
    <div className="reveal-stack">
      {/* Photo frame — aspect-[4/5] keeps a tall portrait shape, magazine-like */}
      <div className="relative aspect-[4/5] overflow-hidden bg-paper-3 border border-tobacco/40">
        {photos.map((p, i) => (
          <img
            key={p.src}
            src={p.src}
            alt=""
            className={`absolute inset-0 w-full h-full object-cover transition-opacity ease-[cubic-bezier(0.4,0,0.2,1)] ${
              i === active ? 'opacity-100' : 'opacity-0'
            }`}
            style={{
              transitionDuration: '1800ms',
              animation: i === active ? 'kenburns 14s ease-out forwards' : 'none',
            }}
            loading={i === 0 ? 'eager' : 'lazy'}
          />
        ))}

        {/* Small editorial caption chip in the bottom-right corner */}
        <div className="absolute bottom-3 right-3 bg-paper/95 backdrop-blur-sm px-3 py-1.5">
          <span className="block font-mono-tabular text-[9px] uppercase tracking-eyebrow text-ink-mute">
            {t('editorial.galleryOnTheTable')} · {String(active + 1).padStart(2, '0')} / {String(photos.length).padStart(2, '0')}
          </span>
          <span className="block font-editorial text-xs italic text-ink-soft truncate max-w-[180px]">
            {t(current.captionKey)}
          </span>
        </div>

        {/* Tiny progress ticks pinned to the top edge */}
        <div className="absolute top-3 left-3 right-3 flex gap-1">
          {photos.map((_, i) => (
            <span
              key={i}
              className={`block flex-1 h-px transition-colors duration-700 ${
                i === active ? 'bg-saffron' : 'bg-paper/40'
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
