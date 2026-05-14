import { Outlet } from 'react-router-dom';
import Header from './Header.js';
import Footer from './Footer.js';
import CartDrawer from './CartDrawer.js';
import CookieBanner from './CookieBanner.js';
import CutoffBanner from './CutoffBanner.js';

export default function Layout() {
  return (
    <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-gray-950 dark:text-gray-100">
      <CutoffBanner />
      <Header />
      <main className="flex-1">
        <Outlet />
      </main>
      <Footer />
      <CartDrawer />
      <CookieBanner />
    </div>
  );
}
