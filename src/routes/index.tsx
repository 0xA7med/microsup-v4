import React from 'react';
import { Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { ClientsList } from '../pages/ClientsList';
import { AgentsList } from '../pages/AgentsList';
import { PendingAgents } from '../pages/PendingAgents';
import DashboardNew from '../pages/DashboardNew';
import AddClientRedirect from '../pages/AddClientRedirect';
import AddAgentRedirect from '../pages/AddAgentRedirect';

// مكون لحماية المسارات
const ProtectedRoute: React.FC<{
  children?: React.ReactNode;
  requiredRole?: string | null;
}> = ({ children, requiredRole = null }) => {
  const { user } = useAuthStore();
  
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  
  if (requiredRole === 'admin' && user.role !== 'admin') {
    return <Navigate to="/" replace />;
  }
  
  if (requiredRole === 'manager' && user.role !== 'admin' && user.role !== 'manager') {
    return <Navigate to="/" replace />;
  }
  
  return <>{children || <Outlet />}</>;
};

export const AppRoutes: React.FC = () => {
  return (
    <Routes>
      <Route path="/login" element={<Navigate to="/" replace />} />
      
      {/* الصفحة الرئيسية / لوحة التحكم */}
      <Route 
        path="/" 
        element={
          <ProtectedRoute>
            <DashboardNew />
          </ProtectedRoute>
        } 
      />
      
      {/* صفحة قائمة العملاء */}
      <Route 
        path="/clients" 
        element={
          <ProtectedRoute>
            <ClientsList />
          </ProtectedRoute>
        } 
      />
      
      {/* صفحة إضافة عميل جديد */}
      <Route 
        path="/add-client" 
        element={
          <ProtectedRoute>
            <AddClientRedirect />
          </ProtectedRoute>
        } 
      />
      
      {/* صفحة قائمة المندوبين */}
      <Route 
        path="/agents" 
        element={
          <ProtectedRoute requiredRole="manager">
            <AgentsList />
          </ProtectedRoute>
        } 
      />
      
      {/* صفحة إضافة مندوب جديد */}
      <Route 
        path="/add-agent" 
        element={
          <ProtectedRoute requiredRole="admin">
            <AddAgentRedirect />
          </ProtectedRoute>
        } 
      />
      
      {/* صفحة طلبات المندوبين المعلقة */}
      <Route 
        path="/pending-agents" 
        element={
          <ProtectedRoute requiredRole="admin">
            <PendingAgents />
          </ProtectedRoute>
        } 
      />
      
      {/* صفحة الأجهزة المعلقة */}
      <Route 
        path="/pending-devices" 
        element={
          <ProtectedRoute requiredRole="manager">
            <div>صفحة الأجهزة المعلقة</div>
          </ProtectedRoute>
        } 
      />
      
      {/* توجيه أي مسار غير معرف إلى الصفحة الرئيسية */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};