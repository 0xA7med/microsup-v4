import React from 'react';

interface CustomerTextAreaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  isEditing: boolean;
}

export default function CustomerTextArea({ isEditing, className = '', ...props }: CustomerTextAreaProps) {
  return (
    <textarea
      {...props}
      className={`mt-1 block w-full rounded-md shadow-sm focus:border-primary-500 focus:ring-primary-500 ${
        !isEditing 
          ? 'bg-gray-100 border-2 border-gray-300 dark:bg-gray-600 dark:border-gray-500 dark:text-gray-100' 
          : 'bg-white border-2 border-blue-200 dark:bg-gray-700 dark:border-blue-700 dark:text-white'
      } ${className}`}
      disabled={!isEditing}
    />
  );
}
