import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import './index.css';

function Dashboard() {
  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-primary-600 text-white px-6 py-4">
        <h1 className="text-xl font-bold">KitchenAsty Admin</h1>
      </nav>
      <main className="p-6">
        <h2 className="text-2xl font-semibold text-gray-800 mb-4">Dashboard</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {['Orders Today', 'Revenue', 'Reservations', 'Active Items'].map((label) => (
            <div key={label} className="bg-white rounded-lg shadow p-6">
              <p className="text-sm text-gray-500">{label}</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">--</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/*" element={<Dashboard />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>,
);
