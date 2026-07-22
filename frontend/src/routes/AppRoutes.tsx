import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import AuthLayout from '../layouts/AuthLayout';
import DashboardLayout from '../layouts/DashboardLayout';
import Login from '../pages/auth/Login';
import Register from '../pages/auth/Register';
import ForgotPassword from '../pages/auth/ForgotPassword';
import Unauthorized from '../pages/auth/Unauthorized';
import ProtectedRoute from './ProtectedRoute';
import RoleRoute from './RoleRoute';
import Dashboard from '../pages/dashboard/Dashboard';
import Profile from '../pages/profile/Profile';
import Products from '../pages/products/Products';
import Categories from '../pages/categories/Categories';
import Sales from '../pages/sales/Sales';

export const AppRoutes: React.FC = () => {
  return (
    <Routes>
      {/* Auth routes layout wrapper */}
      <Route element={<AuthLayout />}>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
      </Route>

      {/* Permission errors */}
      <Route path="/unauthorized" element={<Unauthorized />} />

      {/* Protected views layout wrapper */}
      <Route element={<ProtectedRoute />}>
        <Route element={<DashboardLayout />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route element={<RoleRoute allowedRoles={['COMPANY_ADMIN', 'SUPER_ADMIN']} />}>
            <Route path="/products" element={<Products />} />
            <Route path="/categories" element={<Categories />} />
          </Route>
          <Route element={<RoleRoute allowedRoles={['COMPANY_ADMIN', 'ANALYST', 'SUPER_ADMIN']} />}>
            <Route path="/sales" element={<Sales />} />
          </Route>
          <Route path="/profile" element={<Profile />} />
        </Route>
      </Route>

      {/* Redirect wildcards */}
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
};
export default AppRoutes;
