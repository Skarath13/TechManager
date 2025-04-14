import React from 'react';
import { Outlet } from 'react-router-dom';
import { Navbar } from './components/Navbar';

export function AppLayout() {
  return (
    <div>
      <Navbar />
      <div className="container mx-auto px-4 py-8">
        <Outlet />
      </div>
    </div>
  );
}

export default AppLayout;
