import axios from 'axios';
import { GoogleGenerativeAI } from '@google/generative-ai';

// تعريف أنواع البيانات
export interface ClientData {
  [key: string]: string;
}

export interface DeviceData {
  [key: string]: string;
}

export interface ExtractedData {
  clients: ClientData[];
  devices: DeviceData[];
}

/**
 * استخراج بيانات العملاء والأجهزة من محادثات واتساب باستخدام خدمات الذكاء الاصطناعي
 */
export async function extractDataFromWhatsAppChat(
  text: string,
  provider: 'gemini' | 'deepseek' = 'deepseek',
  apiKey: string = ''
): Promise<ExtractedData> {
  try {
    if (provider === 'gemini') {
      return await extractUsingGemini(text, apiKey);
    } else if (provider === 'deepseek') {
      return await extractUsingDeepSeek(text, apiKey);
    } else {
      throw new Error('مزود غير مدعوم');
    }
  } catch (error) {
    console.error("خطأ في استخراج البيانات:", error);
    // في حالة حدوث خطأ، نعيد مصفوفات فارغة
    return { clients: [], devices: [] };
  }
}

/**
 * استخراج البيانات باستخدام Gemini
 */
async function extractUsingGemini(text: string, apiKey: string): Promise<ExtractedData> {
  try {
    if (!apiKey || apiKey.trim() === '') {
      apiKey = process.env.VITE_GEMINI_API_KEY || '';
      if (apiKey.trim() === '') {
        throw new Error('مفتاح API لـ Gemini غير موجود');
      }
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ 
      model: "gemini-1.5-pro",
      generationConfig: {
        maxOutputTokens: 8192,
        temperature: 0.1,
      },
    });

    const prompt = `قم بتحليل المحتوى التالي واستخرج بيانات العملاء والأجهزة بدقة.

    قواعد استخراج البيانات:
    1. لكل عميل:
       - اسم العميل الكامل
       - رقم الهاتف (يبدأ بـ 01 أو 00966)
       - نوع النشاط التجاري (إذا وجد)
       - العنوان (إذا وجد)

    2. لكل جهاز:
       - اسم العميل المقابل
       - رمز التفعيل (أرقام فقط)
       - نوع الجهاز (android أو computer)
       - تاريخ بداية الاشتراك (إذا وجد)

    قواعد استخراج رموز التفعيل:
    1. الرموز الحديثة (الأكثر شيوعاً):
       - سلسلة أرقام طويلة (10-30 رقم) بدون شرطات أو مسافات
       - أمثلة: 91210106479153317956، 152412122811113131311540
       - نوع الجهاز: "android"

    2. رموز الكمبيوتر:
       - سلسلة أرقام طويلة جداً (أكثر من 50 رقم)
       - نوع الجهاز: "computer"

    3. الرموز القديمة (نادرة):
       - بتنسيق XXXX-XXXX-XXXX
       - أمثلة: 4955-5359-6567
       - نوع الجهاز: "android"

    قواعد عامة:
    - استخرج جميع الأرقام الطويلة (10-30 رقم) كرموز تفعيل للأندرويد
    - تجاهل الأرقام القصيرة (أقل من 10 أرقام) مثل أرقام الهواتف
    - لكل عميل، ابحث عن جميع رموز التفعيل المرتبطة به

    يجب أن يكون الإخراج بتنسيق JSON كما يلي:
    \`\`\`json
    {
      "clients": [
        {
          "اسم العميل": "اسم العميل",
          "الهاتف": "رقم الهاتف",
          "العنوان": "العنوان",
          "نوع النشاط": "نوع النشاط التجاري"
        }
      ],
      "devices": [
        {
          "اسم العميل": "اسم العميل المقابل",
          "رمز التفعيل": "الرمز المستخرج",
          "نوع الجهاز": "android أو computer",
          "تاريخ بداية الاشتراك": "تاريخ إذا وجد"
        }
      ]
    }
    \`\`\`

    تأكد من:
    - استخراج جميع الرموز الطويلة (10-30 رقم) للأندرويد
    - عدم تجاهل أي رمز طويل
    - مطابقة كل جهاز مع العميل المناسب
    - عدم تضمين أرقام الهواتف في رموز التفعيل
    - عدم تجاهل أي عميل لديه رقم هاتف صحيح

    المحتوى:
    ${text}`;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();

    // تحسين استخراج JSON من الرد
    const jsonMatch = responseText.match(/```json\s*([\s\S]*?)\s*```/) || responseText.match(/{[\s\S]*}/);
    let jsonStr = jsonMatch ? jsonMatch[0].replace(/```json|```/g, '') : responseText;

    // تنظيف JSON
    let cleanJsonStr = jsonStr
      .replace(/[\u200B-\u200D\uFEFF]/g, '')
      .replace(/,(\s*[}\]])/g, '$1')
      .replace(/([{,])\s*"(\w+)":\s*null/g, '$1"$2":""');

    // تحليل JSON
    let parsedData;
    try {
      parsedData = JSON.parse(cleanJsonStr);
    } catch (error) {
      console.error('Error parsing JSON:', error);
      return { clients: [], devices: [] };
    }

    // فلترة وتحسين البيانات المستخرجة
    const clients: ClientData[] = (parsedData.clients || []).map((client: any) => ({
      "اسم العميل": client["اسم العميل"] || "",
      "اسم المؤسسة": client["اسم المؤسسة"] || "",
      "نوع النشاط": client["نوع النشاط"] || "",
      "الهاتف": client["الهاتف"] || "",
      "الهاتف 2": client["الهاتف 2"] || "",
      "العنوان": client["العنوان"] || "",
      "ملاحظات": client["ملاحظات"] || ""
    }));

    // تحسين استخراج الأجهزة مع التركيز على الرموز الحديثة
    const devices: DeviceData[] = [];
    const processedCodes = new Set();

    (parsedData.devices || []).forEach((device: any) => {
      const activationCode = device["رمز التفعيل"]?.toString().trim() || "";
      
      // قبول جميع الرموز الطويلة (10-30 رقم) سواء كانت بشرطات أو بدونها
      if (activationCode && !processedCodes.has(activationCode)) {
        const isComputer = activationCode.length > 50;
        const isOldFormat = /^\d{4}-\d{4}-\d{4}$/.test(activationCode);
        const isModernAndroid = /^\d{10,30}$/.test(activationCode.replace(/-/g, ''));

        if (isComputer || isOldFormat || isModernAndroid) {
          devices.push({
            "اسم العميل": device["اسم العميل"] || "",
            "رمز التفعيل": activationCode,
            "نوع الجهاز": isComputer ? "computer" : "android",
            "تاريخ بداية الاشتراك": device["تاريخ بداية الاشتراك"] || "",
            "تاريخ نهاية الاشتراك": device["تاريخ نهاية الاشتراك"] || "",
            "نوع الاشتراك": device["نوع الاشتراك"] || "",
            "ملاحظات": device["ملاحظات"] || ""
          });
          processedCodes.add(activationCode);
        }
      }
    });

    return { clients, devices };
  } catch (error) {
    console.error('Error in extractUsingGemini:', error);
    return { clients: [], devices: [] };
  }
}

/**
 * استخراج البيانات باستخدام DeepSeek
 */
async function extractUsingDeepSeek(text: string, apiKey: string): Promise<ExtractedData> {
  try {
    const response = await axios.post(
      'https://api.deepseek.com/v1/chat/completions',
      {
        model: 'deepseek-chat',
        messages: [
          {
            role: 'system',
            content: 'أنت مساعد ذكي متخصص في استخراج بيانات العملاء والأجهزة من النصوص. قم بتحليل النص وإرجاع البيانات بتنسيق JSON دون إضافة أي قيم افتراضية غير ضرورية.'
          },
          {
            role: 'user',
            content: `
            قم بتحليل المحتوي التالي واستخرج منها بيانات العملاء والأجهزة.
            
            المحتوي:
            ${text}
          
    قواعد استخراج البيانات:
    1. لكل عميل:
       - اسم العميل الكامل
       - رقم الهاتف (يبدأ بـ 01 أو 00966)
       - نوع النشاط التجاري (إذا وجد)
       - العنوان (إذا وجد)

    2. لكل جهاز:
       - اسم العميل المقابل
       - رمز التفعيل (أرقام فقط)
       - نوع الجهاز (android أو computer)
       - تاريخ بداية الاشتراك (إذا وجد)

    قواعد استخراج رموز التفعيل:
    1. الرموز الحديثة (الأكثر شيوعاً):
       - سلسلة أرقام طويلة (10-30 رقم) بدون شرطات أو مسافات
       - أمثلة: 91210106479153317956، 152412122811113131311540
       - نوع الجهاز: "android"

    2. رموز الكمبيوتر:
       - سلسلة أرقام طويلة جداً (أكثر من 50 رقم)
       - نوع الجهاز: "computer"

    3. الرموز القديمة (نادرة):
       - بتنسيق XXXX-XXXX-XXXX
       - أمثلة: 4955-5359-6567
       - نوع الجهاز: "android"

    قواعد عامة:
    - استخرج جميع الأرقام الطويلة (10-30 رقم) كرموز تفعيل للأندرويد
    - تجاهل الأرقام القصيرة (أقل من 10 أرقام) مثل أرقام الهواتف
    - لكل عميل، ابحث عن جميع رموز التفعيل المرتبطة به

    يجب أن يكون الإخراج بتنسيق JSON كما يلي:
    \`\`\`json
    {
      "clients": [
        {
          "اسم العميل": "اسم العميل",
          "الهاتف": "رقم الهاتف",
          "العنوان": "العنوان",
          "نوع النشاط": "نوع النشاط التجاري"
        }
      ],
      "devices": [
        {
          "اسم العميل": "اسم العميل المقابل",
          "رمز التفعيل": "الرمز المستخرج",
          "نوع الجهاز": "android أو computer",
          "تاريخ بداية الاشتراك": "تاريخ إذا وجد"
        }
      ]
    }
    \`\`\`

    تأكد من:
    - استخراج جميع الرموز الطويلة (10-30 رقم) للأندرويد
    - عدم تجاهل أي رمز طويل
    - مطابقة كل جهاز مع العميل المناسب
    - عدم تضمين أرقام الهواتف في رموز التفعيل
    - عدم تجاهل أي عميل لديه رقم هاتف صحيح
            `
          }
        ],
        temperature: 0.1,
        max_tokens: 4000,
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        // timeout: 160000
      }
    );

    // التحقق من وجود بيانات في الاستجابة
    if (!response.data || !response.data.choices || !response.data.choices[0] || !response.data.choices[0].message) {
      console.error('استجابة DeepSeek غير صالحة:', response.data);
      throw new Error('استجابة DeepSeek غير صالحة');
    }

    const content = response.data.choices[0].message.content;
    
    // استخراج JSON من النص
    let jsonData: ExtractedData;
    try {
      // البحث عن نمط JSON في النص
      const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/) || 
                        content.match(/{[\s\S]*"clients"[\s\S]*"devices"[\s\S]*}/);
      
      const jsonString = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : content;
      
      // تنظيف النص من الأحرف غير المرئية والأحرف الخاصة
      let cleanJsonStr = jsonString.trim().replace(/[\u200B-\u200D\uFEFF]/g, '');
      
      // إصلاح بعض مشاكل JSON الشائعة
      cleanJsonStr = cleanJsonStr.replace(/,(\s*[}\]])/g, '$1'); // إزالة الفواصل الزائدة قبل الأقواس
      cleanJsonStr = cleanJsonStr.replace(/([{,])\s*"(\w+)":\s*null/g, '$1"$2":""'); // استبدال null بسلسلة فارغة
      cleanJsonStr = cleanJsonStr.replace(/([{,])\s*"(\w+)":\s*undefined/g, '$1"$2":""'); // استبدال undefined بسلسلة فارغة
      
      // محاولة تحليل JSON
      jsonData = JSON.parse(cleanJsonStr);
      
      // التحقق من صحة البنية
      if (!jsonData.clients || !jsonData.devices) {
        throw new Error('بنية JSON غير صالحة: لا توجد حقول clients أو devices');
      }
      // التحقق من أن عدد الأجهزة لا يقل عن عدد العملاء
      if (jsonData.devices.length < jsonData.clients.length) {
        console.warn("تحذير: عدد الأجهزة أقل من عدد العملاء، قد تكون البيانات غير مكتملة");
      }
      return jsonData;
    } catch (jsonError) {
      console.error('خطأ في تحليل JSON:', jsonError);
      throw new Error('فشل في تحليل البيانات المستخرجة');
    }
  } catch (error) {
    console.error('خطأ في استخراج البيانات باستخدام DeepSeek:', error);
    throw error;
  }
}