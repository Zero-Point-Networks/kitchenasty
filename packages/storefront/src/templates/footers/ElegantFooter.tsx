import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../context/ThemeContext.js';

/**
 * Compact editorial footer — one row of inline links on desktop, stacked on
 * mobile. Wordmark left, legal links right, copyright underneath. No
 * overblown three-column layout; the page already says everything it needs
 * to.
 */
export default function ElegantFooter() {
  const { t } = useTranslation();
  const { settings } = useTheme();
  const year = new Date().getFullYear();

  const navLinks = [
    { to: '/menu', label: t('nav.menu') },
    { to: '/locations', label: t('nav.locations') },
    { to: '/allergens', label: t('editorial.allergensPageTitle') },
  ];
  const legalLinks = [
    { to: '/impressum', label: t('footer.impressum') },
    { to: '/privacy-policy', label: t('footer.privacyPolicy') },
    { to: '/terms', label: t('footer.termsAndConditions') },
  ];

  return (
    <footer className="relative" style={{ background: 'var(--paper-2)' }}>
      <div className="rule-strong" />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-10">
        <div className="flex flex-col lg:flex-row lg:items-center gap-5 lg:gap-8">
          {/* Wordmark */}
          <Link to="/" className="flex items-center gap-2.5 shrink-0 group">
            {settings.logo ? (
              <img
                src={settings.logo}
                alt={settings.siteName}
                className="w-8 h-8 rounded-full object-cover ring-1 ring-tobacco/40"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-ink flex items-center justify-center">
                <span className="text-paper font-display text-xs">{settings.siteName.charAt(0)}</span>
              </div>
            )}
            <span className="font-display text-xl text-ink leading-none group-hover:text-saffron transition-colors">
              {settings.siteName}
            </span>
          </Link>

          {/* Inline links — site nav */}
          <nav className="flex flex-wrap gap-x-5 gap-y-2 items-center">
            {navLinks.map((l) => (
              <Link
                key={l.to}
                to={l.to}
                className="font-ui text-xs uppercase tracking-eyebrow text-ink hover:text-saffron transition-colors"
              >
                {l.label}
              </Link>
            ))}
          </nav>

          {/* Spacer */}
          <span className="hidden lg:block flex-1" />

          {/* Legal links */}
          <nav className="flex flex-wrap gap-x-5 gap-y-2 items-center">
            {legalLinks.map((l) => (
              <Link
                key={l.to}
                to={l.to}
                className="font-ui text-xs uppercase tracking-eyebrow text-ink-soft hover:text-saffron transition-colors"
              >
                {l.label}
              </Link>
            ))}
            <button
              onClick={() => window.dispatchEvent(new Event('open-cookie-settings'))}
              className="font-ui text-xs uppercase tracking-eyebrow text-ink-soft hover:text-saffron transition-colors"
            >
              {t('footer.cookieSettings')}
            </button>
          </nav>
        </div>

        {/* Slim copyright stripe under a hairline rule */}
        <div className="rule mt-6 mb-4" />
        <div className="flex flex-wrap items-center justify-between gap-2 font-mono-tabular text-[10px] uppercase tracking-eyebrow text-ink-mute">
          <span>&copy; {year} {settings.siteName} · Made with Moksha · Schwenningen</span>
          <span className="hidden sm:inline">Vol. 01 · No. 01 · Cutoff 20:00</span>
        </div>
      </div>
    </footer>
  );
}
