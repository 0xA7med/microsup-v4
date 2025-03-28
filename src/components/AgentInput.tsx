import React from 'react';

export interface AgentInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  icon?: React.ReactNode;
  name: string;
  placeholder?: string;
  type?: string;
  className?: string;
  value?: any;
  required?: boolean;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  // بما أن InputHTMLAttributes تحتوي بالفعل على جميع خصائص input العادية
  // مثل type و value و placeholder وname، لا داعي لإضافتها هنا مرة أخرى
}

export default function AgentInput({ icon, className = '', ...props }: AgentInputProps) {
  return (
    <div className="relative">
      {icon && (
        <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
          {icon}
        </div>
      )}
      <input
        {...props}
        className={`mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 shadow-sm focus:border-primary-500 focus:ring-primary-500 py-3 ${
          icon ? 'pr-10' : ''
        } ${className || ''}`}
        dir="rtl"
      />
    </div>
  );
}
