import React, { useRef, useEffect } from 'react';

interface CustomerInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  isEditing: boolean;
}

export default function CustomerInput({ isEditing, className = '', ...props }: CustomerInputProps) {
  // تحديد ما إذا كان الحقل رقمياً لإضافة أسلوب إخفاء الأسهم
  const isNumberInput = props.type === 'number';
  const inputRef = useRef<HTMLInputElement>(null);
  
  // استخدام useEffect لتعطيل تغيير القيمة باستخدام بكرة الماوس
  useEffect(() => {
    const input = inputRef.current;
    if (input && isNumberInput) {
      const disableWheel = () => {
        // إزالة التركيز عند تمرير الماوس فوق الحقل
        input.addEventListener('wheel', (e) => {
          if (document.activeElement === input) {
            input.blur();
          }
        }, { passive: true });
        
        // منع التركيز على الحقل عند النقر عليه ببكرة الماوس
        input.addEventListener('mousedown', (e) => {
          if (e.button === 1) { // زر الماوس الأوسط (البكرة)
            e.preventDefault();
          }
        });
      };
      
      disableWheel();
    }
  }, [isNumberInput]);
  
  return (
    <input
      {...props}
      ref={inputRef}
      className={`mt-1 block w-full rounded-md shadow-sm focus:border-primary-500 focus:ring-primary-500 ${
        !isEditing 
          ? 'bg-gray-100 border-2 border-gray-300 dark:bg-gray-600 dark:border-gray-500 dark:text-gray-100' 
          : 'bg-white border-2 border-blue-200 dark:bg-gray-700 dark:border-blue-700 dark:text-white'
      } ${isNumberInput ? 'no-number-arrows' : ''} ${className}`}
      disabled={!isEditing}
      style={isNumberInput ? { 
        WebkitAppearance: 'none',
        MozAppearance: 'textfield',
        appearance: 'textfield' // إضافة خاصية appearance القياسية
      } : undefined}
    />
  );
}
