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
  provider: 'gemini' | 'deepseek' = 'gemini',
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
    // التحقق من وجود مفتاح API
    if (!apiKey || apiKey.trim() === '') {
      apiKey = process.env.VITE_GEMINI_API_KEY || '';
      
      if (apiKey.trim() === '') {
        throw new Error('مفتاح API لـ Gemini غير موجود');
      }
    }

    console.log('استخدام Gemini API مع المفتاح:', apiKey.substring(0, 5) + '...');
    
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ 
      model: "gemini-1.5-pro",
      generationConfig: {
        maxOutputTokens: 8192,
        temperature: 0.1, // خفض درجة الحرارة لزيادة الدقة
      },
    });

    const prompt = `قم بتحليل بيانات العملاء التالية واستخرج منها معلومات دقيقة عن العملاء والأجهزة. يرجى تتبع التعليمات بدقة شديدة:
    
    كل سطر من النص يحتوي عادة على المعلومات التالية:
    1. رقم تسلسلي واسم العميل والتاريخ والموقع - مثال: "2936- خيرى حسانين منصور 2025/3/5 مؤسسة همس"
    2. اسم المؤسسة (إن وجد) - مثال: "مؤسسة همس لتجارة الأدوات الكهربيه والتوريدات العموميه"
    3. العنوان - مثال: "الصالحيه الجديده/شرقيه"
    4. رقم الهاتف (يبدأ عادة بـ 01 أو 00966) - مثال: "01028068768"
    5. نوع النشاط التجاري - مثال: "تجارة الادوات الكهربيه"
    6. رقم تعريفي أو رمز تفعيل - مثال: "9868142612121415514121313" أو "5059-5355-5859"
    
    هام جدًا - قواعد استخراج رموز التفعيل والأرقام التعريفية (3 حالات):
    
    الحالة الأولى: نظام رمز التفعيل القديم للأندرويد (بتنسيق XXXX-XXXX-XXXX):
    - يكون بتنسيق XXXX-XXXX-XXXX (أربعة أرقام - أربعة أرقام - أربعة أرقام) - مثال: "5059-5355-5859"
    - غالبًا ما يأتي مع رقم تعريفي منفصل
    - في هذه الحالة، ضع الرقم التعريفي في حقل "ملاحظات" الخاص بالجهاز
    - نوع الجهاز: "android"
    
    الحالة الثانية: النظام الحالي عبارة عن رقم تعريفي للأندرويد :
    - يكون سلسلة من الأرقام (10-20 رقم) بدون شرطات - مثال: "9868142612121415514121313"
    - يستخدم كرمز تفعيل مباشرة
    - في هذه الحالة، ضع الرقم التعريفي في حقل "رمز التفعيل"
    - نوع الجهاز: "android"
    
    الحالة الثالثة: رمز تفعيل الكمبيوتر:
    - يكون سلسلة طويلة جدًا من الأرقام (أكثر من 50 رقم)
    - في هذه الحالة، ضع الرقم في حقل "رمز التفعيل"
    - نوع الجهاز: "computer"
    
    قواعد عامة:
    - لكل عميل جهاز واحد أو أكثر
    - لكل جهاز رمز تفعيل واحد فقط
    - قد يكون لبعض العملاء رقم تعريفي فقط أو رمز تفعيل فقط وهذا أمر طبيعي
    - إذا كان هناك رقم تعريفي بدون رمز تفعيل، قم بإنشاء جهازًا جديدًا واستخدم الرقم التعريفي كرمز تفعيل
    
    قواعد تحديد نوع الاشتراك:
    - إذا ذُكر "دائم" أو "permanent" في النص، اجعل نوع الاشتراك "permanent"
    - إذا ذُكر "شهري" أو "monthly" أو "شهر" في النص، اجعل نوع الاشتراك "monthly"
    - إذا ذُكر "نصف سنوي" أو "semi_annual" أو "6 شهور" أو "ستة شهور" أو "نصف سنة" في النص، اجعل نوع الاشتراك "semi_annual"
    - إذا ذُكر "عام" أو "سنوي" أو "annual" أو "سنة" في النص، اجعل نوع الاشتراك "annual"
    - إذا لم يُذكر نوع الاشتراك، اجعله "permanent" كقيمة افتراضية
    
    قواعد تحديد تاريخ الاشتراك:
    - إذا ذُكر تاريخ بتنسيق YYYY/MM/DD أو YYYY-MM-DD، استخدمه كتاريخ بداية الاشتراك
    - إذا ذُكر تاريخ بعد اسم العميل، فهو غالبًا تاريخ بداية الاشتراك
    
    يجب أن يكون الإخراج بتنسيق JSON بالضبط كما يلي:
    \`\`\`json
    {
      "clients": [
        {
          "اسم العميل": "اسم العميل",
          "اسم المؤسسة": "اسم المؤسسة (إذا وجد، وإلا استخدم اسم العميل)",
          "نوع النشاط": "نوع النشاط التجاري",
          "الهاتف": "رقم الهاتف الرئيسي",
          "الهاتف 2": "رقم الهاتف الثانوي (إذا وجد)",
          "العنوان": "العنوان (إذا وجد)",
          "ملاحظات": "أي ملاحظات إضافية"
        }
      ],
      "devices": [
        {
          "اسم العميل": "اسم العميل (يجب أن يتطابق مع اسم العميل في مصفوفة العملاء)",
          "رمز التفعيل": "رمز التفعيل (بتنسيق XXXX-XXXX-XXXX أو سلسلة أرقام)",
          "نوع الجهاز": "android أو computer",
          "تاريخ بداية الاشتراك": "YYYY-MM-DD",
          "تاريخ نهاية الاشتراك": "",
          "نوع الاشتراك": "permanent أو annual أو semi_annual أو monthly",
          "ملاحظات": "الرقم التعريفي إذا كان منفصلاً عن رمز التفعيل"
        }
      ]
    }
    \`\`\`
    
    ملاحظات هامة:
    - استخرج جميع العملاء والأجهزة من النص
    - إذا تكرر نفس اسم العميل في أكثر من موضع، تأكد من دمج معلوماته وإنشاء سجل واحد له مع أجهزته المتعددة
    - تأكد من تطابق أسماء العملاء بين مصفوفة العملاء ومصفوفة الأجهزة
    - استخدم "permanent" و "annual" و "semi_annual" و "monthly" فقط في حقل نوع الاشتراك
    - لا تضيف أي حقول إضافية غير المذكورة أعلاه
    - لا تضيف أي نص إضافي قبل أو بعد JSON
    - تأكد من صحة تنسيق JSON (أقواس، فواصل، إلخ)
    
    محتوى بيانات العملاء:
    ${text}`;

    try {
      console.log('إرسال طلب إلى Gemini API...');
      const result = await model.generateContent(prompt);
      const responseText = result.response.text();
      console.log('تم استلام الرد من Gemini API');

      try {
        // محاولة استخراج JSON من النص
        const jsonMatch = responseText.match(/```json\s*([\s\S]*?)\s*```/) || responseText.match(/{[\s\S]*}/);
        let jsonStr = jsonMatch ? jsonMatch[0].replace(/```json|```/g, '') : responseText;

        // تنظيف النص من الأحرف غير المرئية والأحرف الخاصة
        let cleanJsonStr = jsonStr.replace(/[\u200B-\u200D\uFEFF]/g, '');

        // إصلاح بعض مشاكل JSON الشائعة
        cleanJsonStr = cleanJsonStr.replace(/,(\s*[}\]])/g, '$1'); // إزالة الفواصل الزائدة قبل الأقواس
        cleanJsonStr = cleanJsonStr.replace(/([{,])\s*"(\w+)":\s*null/g, '$1"$2":""'); // استبدال null بسلسلة فارغة
        cleanJsonStr = cleanJsonStr.replace(/([{,])\s*"(\w+)":\s*undefined/g, '$1"$2":""'); // استبدال undefined بسلسلة فارغة

        console.log('محاولة تحليل JSON:', cleanJsonStr.substring(0, 100) + '...');

        let parsedData;
        try {
          parsedData = JSON.parse(cleanJsonStr);
        } catch (parseError) {
          console.error('خطأ في التحليل الأول، محاولة إصلاح JSON:', parseError);

          // محاولة إصلاح JSON بشكل يدوي
          // 1. البحث عن آخر قوس مفتوح وإغلاقه
          const openBrackets = (cleanJsonStr.match(/{/g) || []).length;
          const closeBrackets = (cleanJsonStr.match(/}/g) || []).length;

          if (openBrackets > closeBrackets) {
            const diff = openBrackets - closeBrackets;
            cleanJsonStr = cleanJsonStr + '}'.repeat(diff);
          }

          // 2. البحث عن آخر قوس مربع مفتوح وإغلاقه
          const openSquareBrackets = (cleanJsonStr.match(/\[/g) || []).length;
          const closeSquareBrackets = (cleanJsonStr.match(/\]/g) || []).length;

          if (openSquareBrackets > closeSquareBrackets) {
            const diff = openSquareBrackets - closeSquareBrackets;
            cleanJsonStr = cleanJsonStr + ']'.repeat(diff);
          }

          // محاولة تحليل JSON مرة أخرى بعد الإصلاح
          try {
            parsedData = JSON.parse(cleanJsonStr);
          } catch (finalError) {
            console.error('فشل في تحليل JSON بعد محاولات الإصلاح:', finalError);

            // إنشاء هيكل بيانات بسيط للعودة
            parsedData = {
              clients: [],
              devices: []
            };
          }
        }

        // استخراج بيانات العملاء والأجهزة
        let clients: ClientData[] = parsedData.clients || [];
        let devices: DeviceData[] = parsedData.devices || [];
        
        // تنظيف بيانات العملاء
        clients = clients.map((client: ClientData) => {
          return {
            "اسم العميل": client["اسم العميل"] || "",
            "اسم المؤسسة": client["اسم المؤسسة"] || client["اسم العميل"] || "",
            "نوع النشاط": client["نوع النشاط"] || "",
            "الهاتف": client["الهاتف"] || "",
            "الهاتف 2": client["الهاتف 2"] || "",
            "العنوان": client["العنوان"] || "",
            "ملاحظات": client["ملاحظات"] || ""
          };
        });

        // تنظيف وتوحيد الأجهزة لكل عميل
        if (Array.isArray(devices)) {
          // تنظيف الأجهزة وإزالة التكرارات
          const cleanedDevices = [];
          const processedActivationCodes = new Set();
          
          for (const device of devices) {
            // تأكد من أن رمز التفعيل صالح ولم يتم معالجته من قبل
            if (device["رمز التفعيل"] && 
                !processedActivationCodes.has(device["رمز التفعيل"]) &&
                /^\d{4}-\d{4}-\d{4}$/.test(device["رمز التفعيل"].trim())) {
              
              // تسجيل الرمز كمعالج
              processedActivationCodes.add(device["رمز التفعيل"]);
              
              // إضافة الجهاز إلى المصفوفة النظيفة
              cleanedDevices.push({
                "اسم العميل": device["اسم العميل"] || "",
                "رمز التفعيل": device["رمز التفعيل"],
                "نوع الجهاز": device["نوع الجهاز"] || "android",
                "تاريخ بداية الاشتراك": device["تاريخ بداية الاشتراك"] || "",
                "تاريخ نهاية الاشتراك": device["تاريخ نهاية الاشتراك"] || "",
                "نوع الاشتراك": device["نوع الاشتراك"] || "دائم",
                "ملاحظات": device["ملاحظات"] || ""
              });
            }
          }
          
          // استبدال مصفوفة الأجهزة بالمصفوفة النظيفة
          devices = cleanedDevices;
        }

        // إذا لم تكن هناك أجهزة، قم بإنشاء جهاز افتراضي لكل عميل
        if (devices.length === 0 && clients.length > 0) {
          console.log('لم يتم العثور على أجهزة، إنشاء أجهزة افتراضية للعملاء');

          devices = clients.map((client: ClientData) => ({
            "اسم العميل": client["اسم العميل"],
            "رمز التفعيل": `ID-${Math.random().toString().substring(2, 6)}`,
            "نوع الجهاز": "android",
            "تاريخ بداية الاشتراك": new Date().toISOString().split('T')[0],
            "تاريخ نهاية الاشتراك": "",
            "نوع الاشتراك": "دائم",
            "ملاحظات": "تم إنشاؤه تلقائيًا"
          }));
        }

        return {
          clients: clients,
          devices: devices
        };
      } catch (error) {
        console.error('خطأ في تحليل JSON:', error);
        console.log('النص الأصلي:', responseText.substring(0, 200) + '...');
        
        // محاولة استخراج البيانات باستخدام طريقة بديلة
        return { clients: [], devices: [] };
      }
    } catch (apiError: any) {
      console.error('خطأ في استدعاء Gemini API:', apiError);
      
      if (apiError.message?.includes('API key')) {
        throw new Error('مفتاح API غير صالح.');
      } else {
        throw new Error(`خطأ في استدعاء Gemini API: ${apiError.message}`);
      }
    }
  } catch (error: any) {
    console.error('Error in extractUsingGemini:', error);
    throw error;
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
            content: 'أنت مساعد ذكي متخصص في استخراج بيانات العملاء والأجهزة من النصوص. قم بتحليل النص وإرجاع البيانات بتنسيق JSON.'
          },
          {
            role: 'user',
            content: `
            قم بتحليل المحتوي التالي واستخرج منها بيانات العملاء والأجهزة.
            
            المحتوي:
            ${text}
          
    كل سطر من النص يحتوي عادة على المعلومات التالية:
    1. رقم تسلسلي واسم العميل والتاريخ والموقع - مثال: "2936- خيرى حسانين منصور 2025/3/5 مؤسسة همس"
    2. اسم المؤسسة (إن وجد) - مثال: "مؤسسة همس لتجارة الأدوات الكهربيه والتوريدات العموميه"
    3. العنوان - مثال: "الصالحيه الجديده/شرقيه"
    4. رقم الهاتف (يبدأ عادة بـ 01 أو 00966) - مثال: "01028068768"
    5. نوع النشاط التجاري - مثال: "تجارة الادوات الكهربيه"
    6. رقم تعريفي أو رمز تفعيل - مثال: "9868142612121415514121313" أو "5059-5355-5859"
    
    هام جدًا - قواعد استخراج رموز التفعيل والأرقام التعريفية (3 حالات):
    
    الحالة الأولى: نظام رمز التفعيل القديم للأندرويد (بتنسيق XXXX-XXXX-XXXX):
    - يكون بتنسيق XXXX-XXXX-XXXX (أربعة أرقام - أربعة أرقام - أربعة أرقام) - مثال: "5059-5355-5859"
    - غالبًا ما يأتي مع رقم تعريفي منفصل
    - في هذه الحالة، ضع الرقم التعريفي في حقل "ملاحظات" الخاص بالجهاز
    - نوع الجهاز: "android"
    
    الحالة الثانية: النظام الحالي عبارة عن رقم تعريفي للأندرويد :
    - يكون سلسلة من الأرقام (10-20 رقم) بدون شرطات - مثال: "9868142612121415514121313"
    - يستخدم كرمز تفعيل مباشرة
    - في هذه الحالة، ضع الرقم التعريفي في حقل "رمز التفعيل"
    - نوع الجهاز: "android"
    
    الحالة الثالثة: رمز تفعيل الكمبيوتر:
    - يكون سلسلة طويلة جدًا من الأرقام (أكثر من 50 رقم)
    - في هذه الحالة، ضع الرقم في حقل "رمز التفعيل"
    - نوع الجهاز: "computer"
    
    قواعد عامة:
    - لكل عميل جهاز واحد أو أكثر
    - لكل جهاز رمز تفعيل واحد فقط
    - قد يكون لبعض العملاء رقم تعريفي فقط أو رمز تفعيل فقط وهذا أمر طبيعي
    - إذا كان هناك رقم تعريفي بدون رمز تفعيل، قم بإنشاء جهازًا جديدًا واستخدم الرقم التعريفي كرمز تفعيل
    
    قواعد تحديد نوع الاشتراك:
    - إذا ذُكر "دائم" أو "permanent" في النص، اجعل نوع الاشتراك "permanent"
    - إذا ذُكر "شهري" أو "monthly" أو "شهر" في النص، اجعل نوع الاشتراك "monthly"
    - إذا ذُكر "نصف سنوي" أو "semi_annual" أو "6 شهور" أو "ستة شهور" أو "نصف سنة" في النص، اجعل نوع الاشتراك "semi_annual"
    - إذا ذُكر "عام" أو "سنوي" أو "annual" أو "سنة" في النص، اجعل نوع الاشتراك "annual"
    - إذا لم يُذكر نوع الاشتراك، اجعله "permanent" كقيمة افتراضية
    
    قواعد تحديد تاريخ الاشتراك:
    - إذا ذُكر تاريخ بتنسيق YYYY/MM/DD أو YYYY-MM-DD، استخدمه كتاريخ بداية الاشتراك
    - إذا ذُكر تاريخ بعد اسم العميل، فهو غالبًا تاريخ بداية الاشتراك
    
    يجب أن يكون الإخراج بتنسيق JSON بالضبط كما يلي:
    {
      "clients": [
        {
          "اسم العميل": "اسم العميل",
          "اسم المؤسسة": "اسم المؤسسة (إذا وجد، وإلا استخدم اسم العميل)",
          "نوع النشاط": "نوع النشاط التجاري",
          "الهاتف": "رقم الهاتف الرئيسي",
          "الهاتف 2": "رقم الهاتف الثانوي (إذا وجد)",
          "العنوان": "العنوان (إذا وجد)",
          "ملاحظات": "أي ملاحظات إضافية"
        }
      ],
      "devices": [
        {
          "اسم العميل": "اسم العميل (يجب أن يتطابق مع اسم العميل في مصفوفة العملاء)",
          "رمز التفعيل": "رمز التفعيل (بتنسيق XXXX-XXXX-XXXX أو سلسلة أرقام)",
          "نوع الجهاز": "android أو computer",
          "تاريخ بداية الاشتراك": "YYYY-MM-DD",
          "تاريخ نهاية الاشتراك": "",
          "نوع الاشتراك": "permanent أو annual أو semi_annual أو monthly",
          "ملاحظات": "الرقم التعريفي إذا كان منفصلاً عن رمز التفعيل"
        }
      ]
    }
            
    ملاحظات هامة:
    - استخرج جميع العملاء والأجهزة من النص
    - من غير الطبيعي ان يكون اجمالي عدد الاجهزة المستخرجة اقل من عدد العملاء المستخرجين 
    - إذا تكرر نفس اسم العميل في أكثر من موضع، تأكد من دمج معلوماته وإنشاء سجل واحد له مع أجهزته المتعددة
    - تأكد من تطابق أسماء العملاء بين مصفوفة العملاء ومصفوفة الأجهزة
    - استخدم "permanent" و "annual" و "semi_annual" و "monthly" فقط في حقل نوع الاشتراك
    - لا تضيف أي حقول إضافية غير المذكورة أعلاه
    - لا تضيف أي نص إضافي قبل أو بعد JSON
    - تأكد من صحة تنسيق JSON (أقواس، فواصل، إلخ)
    
    محتوى بيانات العملاء:
    ${text}`
          }
        ],
        max_tokens: 4000,
        temperature: 0.1
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        timeout: 60000
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
    } catch (jsonError) {
      console.error('خطأ في تحليل JSON:', jsonError);
      
      // محاولة إصلاح JSON بشكل يدوي
      try {
        // 1. البحث عن آخر قوس مفتوح وإغلاقه
        const openBrackets = (content.match(/{/g) || []).length;
        const closeBrackets = (content.match(/}/g) || []).length;
        
        let fixedContent = content;
        if (openBrackets > closeBrackets) {
          const diff = openBrackets - closeBrackets;
          fixedContent = fixedContent + '}'.repeat(diff);
        }
        
        // 2. البحث عن آخر قوس مربع مفتوح وإغلاقه
        const openSquareBrackets = (fixedContent.match(/\[/g) || []).length;
        const closeSquareBrackets = (fixedContent.match(/\]/g) || []).length;
        
        if (openSquareBrackets > closeSquareBrackets) {
          const diff = openSquareBrackets - closeSquareBrackets;
          fixedContent = fixedContent + ']'.repeat(diff);
        }
        
        // 3. محاولة استخراج JSON من النص المصحح
        const jsonMatch = fixedContent.match(/```json\s*([\s\S]*?)\s*```/) || 
                          fixedContent.match(/{[\s\S]*"clients"[\s\S]*"devices"[\s\S]*}/);
        
        const jsonString = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : fixedContent;
        
        // تنظيف النص من الأحرف غير المرئية والأحرف الخاصة
        let cleanJsonStr = jsonString.trim().replace(/[\u200B-\u200D\uFEFF]/g, '');
        
        // إصلاح بعض مشاكل JSON الشائعة
        cleanJsonStr = cleanJsonStr.replace(/,(\s*[}\]])/g, '$1');
        cleanJsonStr = cleanJsonStr.replace(/([{,])\s*"(\w+)":\s*null/g, '$1"$2":""');
        cleanJsonStr = cleanJsonStr.replace(/([{,])\s*"(\w+)":\s*undefined/g, '$1"$2":""');
        
        jsonData = JSON.parse(cleanJsonStr);
        
        if (!jsonData.clients || !jsonData.devices) {
          throw new Error('بنية JSON غير صالحة بعد الإصلاح');
        }
      } catch (fixError) {
        console.error('فشل في تحليل JSON بعد محاولات الإصلاح:', fixError);
        // إرجاع هيكل بيانات فارغ
        return { clients: [], devices: [] };
      }
    }

    return jsonData;
  } catch (error) {
    console.error('خطأ في استخراج البيانات باستخدام DeepSeek:', error);
    // إرجاع هيكل بيانات فارغ
    return { clients: [], devices: [] };
  }
}