import React from 'react';
import { createBrowserRouter, createRoutesFromElements, Route } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import ProtectedRoute from './components/ProtectedRoute';
import OrderForm from './components/OrderForm';
import { TransactionManager } from './components/TransactionManager';
import { TechSummary } from './components/TechSummary';
import Checkout from './components/Checkout';
import { AppLayout } from './App';

export const router = createBrowserRouter(
  createRoutesFromElements(
    <Route>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
        <Route index element={<OrderForm />} />
        <Route path="transactions" element={<TransactionManager />} />
        <Route path="tech_summary" element={<TechSummary />} />
        <Route path="checkout" element={<Checkout />} />
      </Route>
    </Route>
  )
); 