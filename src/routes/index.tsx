import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { Dashboard } from '../pages/Dashboard';
import { ClientsList } from '../pages/ClientsList';
import { AddClient } from '../pages/AddClient';
import { AgentsList } from '../pages/AgentsList';
import { AddAgent } from '../pages/AddAgent';

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const user = useAuthStore((state) => state.user);
  
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  
  return <>{children}</>;
};

const AdminRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const user = useAuthStore((state) => state.user);
  
  if (!user || user.role !== 'admin') {
    return <Navigate to="/dashboard" replace />;
  }
  
  return <>{children}</>;
};

export const AppRoutes: React.FC = () => {
  return (
    <Routes>
      <Route path="/login" element={<Navigate to="/" replace />} />
      <Route
        path="/"
        element={
          <ProtectedRoute> 
             <Dashboard />
          </ProtectedRoute> 
        }
      />
      <Route
        path="/clients"
        element={
           <ProtectedRoute>
              <ClientsList />
           </ProtectedRoute>
        }
      />
      <Route
        path="/clients/add"
        element={
          <ProtectedRoute> 
             <AddClient />
          </ProtectedRoute>
        }
      />
      <Route
        path="/agents"
        element={
          <ProtectedRoute>
               <AdminRoute>
                  <AgentsList />
               </AdminRoute>
           </ProtectedRoute>
        }
      />
      <Route
        path="/agents/add"
        element={
            <ProtectedRoute>
              <AdminRoute>
                <AddAgent />
              </AdminRoute>
            </ProtectedRoute> 
        }
      />
    </Routes>
  );
};