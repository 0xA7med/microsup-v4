import { NextApiRequest, NextApiResponse } from 'next';
import * as XLSX from 'xlsx';
import { Readable } from 'stream';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const workbook = XLSX.utils.book_new();
    
    const sampleData = [
      {
        'الاسم': 'عميل نموذجي 1',
        'رقم الهاتف': '0512345678',
        'رقم الهاتف 2': '0598765432',
        'العنوان': 'الرياض، السعودية',
        'نوع النشاط': 'متجر',
        'ملاحظات': 'ملاحظات للعميل'
      },
      {
        'الاسم': 'عميل نموذجي 2',
        'رقم الهاتف': '0512345679',
        'رقم الهاتف 2': '',
        'العنوان': 'جدة، السعودية',
        'نوع النشاط': 'مطعم',
        'ملاحظات': ''
      }
    ];

    const worksheet = XLSX.utils.json_to_sheet(sampleData);
    XLSX.utils.book_append_sheet(workbook, worksheet, 'العملاء');

    const instructionsData = [
      { 'تعليمات الاستيراد': 'يرجى اتباع التنسيق التالي لاستيراد العملاء:' },
      { 'تعليمات الاستيراد': '1. الاسم ورقم الهاتف حقول إلزامية' },
      { 'تعليمات الاستيراد': '2. باقي الحقول اختيارية' },
      { 'تعليمات الاستيراد': '3. يمكنك استخدام الأسماء العربية أو الإنجليزية للأعمدة' }
    ];

    const instructionsSheet = XLSX.utils.json_to_sheet(instructionsData);
    XLSX.utils.book_append_sheet(workbook, instructionsSheet, 'تعليمات');

    const excelBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    
    res.setHeader('Content-Disposition', 'attachment; filename=clients_import_template.xlsx');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');

    const readable = new Readable();
    readable._read = () => {};
    readable.push(excelBuffer);
    readable.push(null);

    readable.pipe(res);
  } catch (error) {
    console.error('Template generation error:', error);
    res.status(500).json({ error: 'Failed to generate template' });
  }
}
