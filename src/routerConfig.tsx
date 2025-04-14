import React from 'react';
import { createBrowserRouter } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import ProtectedRoute from './components/ProtectedRoute';
import App from './App';

export const router = createBrowserRouter([
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    path: '/',
    element: (
      <ProtectedRoute>
        <App />
      </ProtectedRoute>
    ),
  },
  // Add more routes as needed, wrapping them in ProtectedRoute with optional role requirements
  {
    path: '/admin',
    element: (
      <ProtectedRoute requiredRole="admin">
        {/* Add your admin component here */}
        <div>Admin Dashboard</div>
      </ProtectedRoute>
    ),
  },
]); 