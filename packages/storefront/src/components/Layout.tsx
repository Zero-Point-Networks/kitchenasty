import { Outlet } from 'react-router-dom';
import Header from './Header.js';
import Footer from './Footer.js';
import CartDrawer from './CartDrawer.js';
import CookieBanner from './CookieBanner.js';
import CutoffBanner from './CutoffBanner.js';

export default function Layout() {
  return (
    <div className="min-h-screen flex flex-col text-ink relative" style={{ background: 'var(--paper)' }}>
      <CutoffBanner />
      <Header />
      <main className="flex-1 relative">
        <Outlet />
      </main>
      <Footer />
      <CartDrawer />
      <CookieBanner />
    </div>
  );
}
