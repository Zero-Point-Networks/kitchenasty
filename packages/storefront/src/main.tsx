import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import './index.css';

function Home() {
  return (
    <div className="min-h-screen bg-white">
      <nav className="bg-primary-600 text-white px-6 py-4 flex items-center justify-between">
        <h1 className="text-xl font-bold">KitchenAsty</h1>
        <div className="space-x-4">
          <a href="/menu" className="hover:text-primary-200">Menu</a>
          <a href="/reservations" className="hover:text-primary-200">Reservations</a>
          <a href="/login" className="hover:text-primary-200">Login</a>
        </div>
      </nav>
      <main className="max-w-4xl mx-auto px-6 py-16 text-center">
        <h2 className="text-4xl font-bold text-gray-900 mb-4">
          Order Delicious Food Online
        </h2>
        <p className="text-lg text-gray-600 mb-8">
          Browse our menu, place your order for delivery or pickup, and enjoy!
        </p>
        <a
          href="/menu"
          className="inline-block bg-primary-600 text-white px-8 py-3 rounded-lg text-lg font-semibold hover:bg-primary-700 transition-colors"
        >
          View Menu
        </a>
      </main>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/*" element={<Home />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>,
);
