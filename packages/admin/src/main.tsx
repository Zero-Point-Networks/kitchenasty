import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import AdminLayout from './components/AdminLayout.js';
import Dashboard from './pages/Dashboard.js';
import LocationList from './pages/LocationList.js';
import LocationForm from './pages/LocationForm.js';
import CategoryList from './pages/CategoryList.js';
import CategoryForm from './pages/CategoryForm.js';
import MenuItemList from './pages/MenuItemList.js';
import MenuItemForm from './pages/MenuItemForm.js';
import TableList from './pages/TableList.js';
import OrderList from './pages/OrderList.js';
import OrderDetailPage from './pages/OrderDetail.js';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <AdminLayout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/locations" element={<LocationList />} />
          <Route path="/locations/new" element={<LocationForm />} />
          <Route path="/locations/:id" element={<LocationForm />} />
          <Route path="/locations/:locationId/tables" element={<TableList />} />
          <Route path="/menu" element={<Navigate to="/menu/items" replace />} />
          <Route path="/menu/categories" element={<CategoryList />} />
          <Route path="/menu/categories/new" element={<CategoryForm />} />
          <Route path="/menu/categories/:id" element={<CategoryForm />} />
          <Route path="/menu/items" element={<MenuItemList />} />
          <Route path="/menu/items/new" element={<MenuItemForm />} />
          <Route path="/menu/items/:id" element={<MenuItemForm />} />
          <Route path="/orders" element={<OrderList />} />
          <Route path="/orders/:id" element={<OrderDetailPage />} />
        </Routes>
      </AdminLayout>
    </BrowserRouter>
  </React.StrictMode>,
);
