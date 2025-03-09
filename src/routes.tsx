import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { ClientsList } from './pages/ClientsList';
import { AddClient } from './pages/AddClient';
import { AgentsList } from './pages/AgentsList';
import { AddAgent } from './pages/AddAgent';
import PendingAgents from './pages/PendingAgents';
import { useAuthStore } from './store/authStore';

export const AppRoutes: React.FC = () => {
  const user = useAuthStore((state) => state.user);
  const isAdmin = user?.role === 'admin';

  return (
    <Routes>
      <Route path="/" element={<Navigate to="/clients" replace />} />
      <Route path="/clients" element={<ClientsList />} />
      <Route path="/clients/add" element={<AddClient />} />
      
      {/* المسارات الخاصة بالمديرين فقط */}
      {isAdmin ? (
        <>
          <Route path="/agents" element={<AgentsList />} />
          <Route path="/agents/add" element={<AddAgent />} />
          <Route path="/pending-agents" element={<PendingAgents />} />
        </>
      ) : (
        <>
          <Route path="/agents" element={<Navigate to="/clients" replace />} />
          <Route path="/agents/add" element={<Navigate to="/clients" replace />} />
          <Route path="/pending-agents" element={<Navigate to="/clients" replace />} />
        </>
      )}
      
      {/* مسار افتراضي للصفحات غير الموجودة */}
      <Route path="*" element={<Navigate to="/clients" replace />} />
    </Routes>
  );
};
