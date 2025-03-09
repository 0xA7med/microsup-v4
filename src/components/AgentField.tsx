import React from 'react';

interface AgentFieldProps {
  label: string;
  children: React.ReactNode;
  className?: string;
}

export default function AgentField({ label, children, className = '' }: AgentFieldProps) {
  return (
    <div className={`${className}`}>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
        {label}
      </label>
      {children}
    </div>
  );
}
