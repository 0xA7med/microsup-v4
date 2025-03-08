import React from 'react';

interface CustomerSelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  isEditing: boolean;
  children: React.ReactNode;
}

export default function CustomerSelect({ isEditing, children, className = '', ...props }: CustomerSelectProps) {
  return (
    <select
      {...props}
      className={`mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 shadow-sm focus:border-primary-500 focus:ring-primary-500 ${
        !isEditing ? 'bg-gray-50 dark:bg-gray-600' : ''
      } ${className}`}
      disabled={!isEditing}
    >
      {children}
    </select>
  );
}
