export const setupMockAPI = () => {
  // تعريف مسار API النسخ الاحتياطي
  const originalFetch = window.fetch;
  window.fetch = async (url: RequestInfo | URL, options?: RequestInit) => {
    const urlString = url.toString();
    
    // إنشاء نسخة احتياطية
    if (urlString.includes('/api/backup/create-backup')) {
      // إنشاء ملف JSON وهمي
      const mockData = {
        clients: [],
        devices: [],
        agents: [],
        timestamp: new Date().toISOString()
      };
      
      const blob = new Blob([JSON.stringify(mockData, null, 2)], { type: 'application/json' });
      
      return new Response(blob, {
        headers: {
          'Content-Disposition': 'attachment; filename="microsup_backup.json"'
        }
      });
    }
    
    // استعادة نسخة احتياطية
    if (urlString.includes('/api/backup/restore-backup')) {
      return new Response(JSON.stringify({ success: true }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // استيراد العملاء
    if (urlString.includes('/api/clients/import-clients')) {
      return new Response(JSON.stringify({ imported: 5 }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // تنزيل قالب الاستيراد
    if (urlString.includes('/api/templates/generate-import-template')) {
      // تحويل المستخدم إلى صفحة فارغة بدلاً من تنزيل ملف حقيقي
      window.open('about:blank', '_blank');
      return new Response('', {
        status: 200
      });
    }
    
    // إذا لم يتم التعرف على المسار، استخدم الـ fetch الأصلي
    return originalFetch(url, options);
  };
};
