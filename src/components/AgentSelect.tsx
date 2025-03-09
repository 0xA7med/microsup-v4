import React from 'react';

interface AgentSelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  icon?: React.ReactNode;
}

export default function AgentSelect({ icon, className = '', children, ...props }: AgentSelectProps) {
  return (
    <div className="relative">
      {icon && (
        <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
          {icon}
        </div>
      )}
      <select
        {...props}
        className={`mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 shadow-sm focus:border-primary-500 focus:ring-primary-500 ${
          icon ? 'pr-10' : ''
        } ${className}`}
        dir="rtl"
      >
        {children}
      </select>
    </div>
  );
}
