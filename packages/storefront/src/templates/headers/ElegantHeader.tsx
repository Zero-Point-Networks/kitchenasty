import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext.js';
import { useCart } from '../../context/CartContext.js';
import { useTheme } from '../../context/ThemeContext.js';
import LanguageSwitcher from '../../components/LanguageSwitcher.js';

/**
 * Editorial masthead — the brand sits centered, the nav rides a thin rule
 * underneath, and a cart/account utility cluster floats to the right. The
 * whole header is sticky and shares the paper background of the page.
 */
export default function ElegantHeader() {
  const { t } = useTranslation();
  const { user, logout } = useAuth();
  const { itemCount, setIsOpen: openCart } = useCart();
  const { settings } = useTheme();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const navLinks = [
    { to: '/', label: t('nav.home') },
    { to: '/menu', label: t('nav.menu') },
    { to: '/locations', label: t('nav.locations') },
  ];

  function isActive(path: string) {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  }

  return (
    <header className="sticky top-0 z-40" style={{ background: 'var(--paper)' }}>
      {/* Masthead: centered wordmark */}
      <div className="border-b border-tobacco/40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 lg:py-5 grid grid-cols-3 items-center">
          {/* Left utility */}
          <div className="hidden md:flex items-center gap-4 font-mono-tabular text-[10px] uppercase tracking-eyebrow text-ink-mute">
            <span>Schwenningen</span>
            <span className="text-tobacco">·</span>
            <span>Mon — Fri</span>
          </div>

          {/* Wordmark */}
          <Link to="/" className="flex items-center justify-center gap-2.5 group col-span-3 md:col-span-1">
            {settings.logo ? (
              <img
                src={settings.logo}
                alt={settings.siteName}
                className="w-9 h-9 rounded-full object-cover ring-1 ring-tobacco/40"
              />
            ) : (
              <div className="w-9 h-9 rounded-full bg-ink flex items-center justify-center">
                <span className="text-paper font-display text-base">{settings.siteName.charAt(0)}</span>
              </div>
            )}
            <span className="font-display text-3xl lg:text-4xl tracking-tight-display text-ink leading-none group-hover:text-saffron transition-colors">
              {settings.siteName}
            </span>
          </Link>

          {/* Right utility */}
          <div className="hidden md:flex items-center justify-end gap-3 text-[11px] uppercase tracking-eyebrow font-ui">
            <LanguageSwitcher />
            <span className="text-tobacco/60">·</span>
            <button
              onClick={() => openCart(true)}
              className="relative inline-flex items-center gap-1.5 text-ink hover:text-saffron transition-colors"
              aria-label={t('nav.openCart')}
            >
              Basket
              <span className="font-mono-tabular text-ink-mute">
                {String(itemCount).padStart(2, '0')}
              </span>
            </button>
            {user ? (
              <>
                <span className="text-tobacco/60">·</span>
                <Link to="/account" className="text-ink hover:text-saffron transition-colors">
                  {user.name?.split(' ')[0] || 'Account'}
                </Link>
                <button onClick={logout} className="text-ink-mute hover:text-saffron transition-colors">
                  Sign out
                </button>
              </>
            ) : (
              <>
                <span className="text-tobacco/60">·</span>
                <Link to="/login" className="text-ink hover:text-saffron transition-colors">Sign in</Link>
                <Link
                  to="/register"
                  className="bg-ink text-paper px-3 py-1.5 hover:bg-saffron transition-colors"
                >
                  Sign up
                </Link>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Nav rule */}
      <div className="border-b border-tobacco/30">
        <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-11 hidden md:flex items-center justify-center gap-8">
          {navLinks.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className={`font-ui text-xs uppercase tracking-eyebrow transition-colors ${
                isActive(link.to) ? 'text-saffron' : 'text-ink hover:text-saffron'
              }`}
            >
              <span className={`pb-3 inline-block ${isActive(link.to) ? 'border-b-2 border-saffron' : ''}`}>
                {link.label}
              </span>
            </Link>
          ))}
        </nav>

        {/* Mobile bar */}
        <div className="md:hidden flex items-center justify-between max-w-7xl mx-auto px-4 h-11">
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="font-ui text-xs uppercase tracking-eyebrow text-ink"
            aria-label={t('nav.toggleMenu')}
          >
            {mobileOpen ? 'Close' : 'Menu'}
          </button>
          <button
            onClick={() => openCart(true)}
            className="relative font-ui text-xs uppercase tracking-eyebrow text-ink"
            aria-label={t('nav.openCart')}
          >
            Basket {String(itemCount).padStart(2, '0')}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="md:hidden border-b border-tobacco/30" style={{ background: 'var(--paper)' }}>
          <div className="max-w-7xl mx-auto px-4 py-3 space-y-1">
            {navLinks.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                onClick={() => setMobileOpen(false)}
                className={`block px-2 py-2 font-ui text-sm uppercase tracking-eyebrow ${
                  isActive(link.to) ? 'text-saffron' : 'text-ink'
                }`}
              >
                {link.label}
              </Link>
            ))}
            <div className="border-t border-tobacco/30 mt-2 pt-2 space-y-1">
              {user ? (
                <>
                  <Link to="/account" onClick={() => setMobileOpen(false)} className="block px-2 py-2 text-sm text-ink">{t('nav.myAccount')}</Link>
                  <button onClick={() => { logout(); setMobileOpen(false); }} className="block w-full text-left px-2 py-2 text-sm text-ink-mute">{t('nav.logout')}</button>
                </>
              ) : (
                <>
                  <Link to="/login" onClick={() => setMobileOpen(false)} className="block px-2 py-2 text-sm text-ink">{t('nav.login')}</Link>
                  <Link to="/register" onClick={() => setMobileOpen(false)} className="block px-2 py-2 text-sm text-saffron">{t('nav.signUp')}</Link>
                </>
              )}
              <div className="px-2 py-2"><LanguageSwitcher /></div>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
