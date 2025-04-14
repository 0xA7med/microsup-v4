import React from 'react';

interface StatCardProps {
  title: string;
  value: string;
  icon: React.ReactElement;
  iconBgColor?: string;
  onClick?: () => void;
}

const StatCard: React.FC<StatCardProps> = ({ 
  title, 
  value, 
  icon, 
  iconBgColor = 'bg-blue-500',
  onClick 
}) => {
  const cardClasses = [
    'bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg',
    'transition-all hover:shadow-xl hover:scale-105',
    onClick ? 'cursor-pointer' : ''
  ].filter(Boolean).join(' ');

  return (
    <div 
      className={cardClasses}
      onClick={onClick}
    >
      <div className="p-5">
        <div className="flex items-center">
          <div className={`flex-shrink-0 ${iconBgColor} rounded-md p-3`}>
            {icon}
          </div>
          <div className="mr-5 w-0 flex-1">
            <dl>
              <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">
                {title}
              </dt>
              <dd className="flex items-baseline">
                <div className="text-2xl font-semibold text-gray-900 dark:text-white">
                  {value}
                </div>
              </dd>
            </dl>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StatCard;
