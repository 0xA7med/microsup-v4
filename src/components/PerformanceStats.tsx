import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface PerformanceStatsProps {
  lastUpdated: number | null;
}

const PerformanceStats: React.FC<PerformanceStatsProps> = ({ lastUpdated }) => {
  const [loadTime, setLoadTime] = useState<number | null>(null);
  const [performanceData, setPerformanceData] = useState<any[]>([]);

  useEffect(() => {
    // قياس وقت التحميل
    if (window.performance && lastUpdated) {
      // استخدام Performance API الحديثة
      const pageLoadTime = performance.now();
      setLoadTime(pageLoadTime);

      // إضافة بيانات جديدة للرسم البياني
      const now = new Date();
      setPerformanceData(prev => {
        const newData = [...prev];
        if (newData.length > 10) {
          newData.shift(); // إزالة أقدم نقطة إذا كان لدينا أكثر من 10 نقاط
        }
        newData.push({
          time: `${now.getHours()}:${now.getMinutes()}:${now.getSeconds()}`,
          loadTime: pageLoadTime,
        });
        return newData;
      });
    }
  }, [lastUpdated]);

  if (!performanceData.length) {
    return null;
  }

  return (
    <div className="mt-6 bg-white dark:bg-gray-800 rounded-lg shadow p-6">
      <h2 className="text-xl font-semibold mb-4">إحصائيات الأداء</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-4">
        <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
          <h3 className="text-lg font-medium mb-2">وقت التحميل الحالي</h3>
          <p className="text-3xl font-bold text-blue-500">{loadTime ? `${(loadTime / 1000).toFixed(2)} ثانية` : 'جاري القياس...'}</p>
        </div>
        
        <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
          <h3 className="text-lg font-medium mb-2">آخر تحديث</h3>
          <p className="text-xl font-medium">
            {lastUpdated ? new Date(lastUpdated).toLocaleString() : 'غير متوفر'}
          </p>
        </div>
      </div>
      
      <div className="h-64 mt-4">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={performanceData}
            margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="time" />
            <YAxis label={{ value: 'وقت التحميل (مللي ثانية)', angle: -90, position: 'insideLeft' }} />
            <Tooltip formatter={(value: number) => [`${value} مللي ثانية`, 'وقت التحميل']} />
            <Legend />
            <Line type="monotone" dataKey="loadTime" stroke="#8884d8" activeDot={{ r: 8 }} name="وقت التحميل" />
          </LineChart>
        </ResponsiveContainer>
      </div>
      
      <div className="mt-4 text-sm text-gray-500">
        <p>* يتم قياس وقت التحميل من بداية التنقل حتى اكتمال تحميل المحتوى.</p>
        <p>* يمكن أن تختلف الأوقات بناءً على حالة الشبكة وحجم البيانات.</p>
      </div>
    </div>
  );
};

export default PerformanceStats;
