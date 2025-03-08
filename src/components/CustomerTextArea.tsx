import React from 'react';

interface CustomerTextAreaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  isEditing: boolean;
}

export default function CustomerTextArea({ isEditing, className = '', ...props }: CustomerTextAreaProps) {
  return (
    <textarea
      {...props}
      className={`mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 shadow-sm focus:border-primary-500 focus:ring-primary-500 ${
        !isEditing ? 'bg-gray-50 dark:bg-gray-600' : ''
      } ${className}`}
      disabled={!isEditing}
    />
  );
}
