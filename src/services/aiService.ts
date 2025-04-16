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

    const prompt = `قم بتحليل محادثة واتساب التالية واستخرج منها معلومات دقيقة عن العملاء والأجهزة. يرجى تتبع التعليمات بدقة شديدة:

    كل مقطع من النص يحتوي عادة على المعلومات التالية:
    1. رقم تسلسلي واسم العميل والموقع (المدينة) - مثال: "41- محمد حسن ابو الفتوح مدينة نصر"
    2. نوع النشاط التجاري - مثال: "استيراد وتصدير اونلاين"
    3. رقم الهاتف (يبدأ عادة بـ 01) - مثال: "01002675333"
    4. رقم تعريفي (رقم مكون من 12-15 رقم او اكثردون شرطات) - مثال: "291010010129"
    5. رمز التفعيل (بتنسيق XXXX-XXXX-XXXX حيث X هو رقم) - مثال: "5059-5355-5859"

    هام جدًا - قواعد استخراج رموز التفعيل والأرقام التعريفية:
    - رمز التفعيل يكون دائمًا بتنسيق XXXX-XXXX-XXXX (أربعة أرقام - أربعة أرقام - أربعة أرقام)
    - الرقم التعريفي يكون سلسلة طويلة من الأرقام (12-15 رقم او اكثر) بدون شرطات
    - لكل عميل جهاز واحد أو أكثر
    - لكل جهاز رمز تفعيل واحد فقط
    - قد يظهر الرقم التعريفي ورمز التفعيل متتاليين وفي هذه الحالة هما لنفس الجهاز
    - ضع الرقم التعريفي في حقل "ملاحظات" الخاص بالجهاز وليس كجهاز منفصل
    - قد يكون لبعض العملاء رقم تعريفي فقط أو رمز تفعيل فقط وهذا أمر طبيعي
    - إذا كان هناك رقم تعريفي بدون رمز تفعيل، قم بإنشاء جهازًا جديدًا باستخدام الرقم التعريفي كرقم التعريفي
    - من المفترض ان يكون النتاج النهائي  في معظم الحالات هوا عدد اجهزة مساوي او اكثر لعدد العملاء 
    - إذا وجدت عدد العملاء المستخرج اكثر من عدد الاجهزة حاول التاكد مجددا من انك قمت باستخراج كل شئ بشكل صحيح
    
    انتبه جيداً للحالات التالية:
    - وجود علامة 🛑 أو 🔴 أو عبارة "تم الاستبدال" أو "مستبدل" تشير إلى أن العميل قام باستبدال جهاز
    - قد تكون هناك أجهزة متعددة مشار إليها برقم تسلسلي إضافي (مثل 91- أو 92-)
    - إذا تكرر رمز التفعيل نفسه لنفس العميل، سجله مرة واحدة فقط

    قم بإرجاع النتائج بتنسيق JSON كما يلي:
    
    {
      "clients": [
        {
          "اسم العميل": "الاسم الكامل",
          "اسم المؤسسة": "اسم المؤسسة إن وجد",
          "نوع النشاط": "نوع النشاط التجاري",
          "الهاتف": "رقم الهاتف الرئيسي",
          "الهاتف 2": "رقم هاتف ثاني إن وجد",
          "العنوان": "المدينة أو الموقع المذكور",
          "ملاحظات": "أي ملاحظات إضافية"
        }
      ],
      "devices": [
        {
          "اسم العميل": "الاسم الكامل (نفس اسم العميل المرتبط بالجهاز)",
          "رمز التفعيل": "رمز التفعيل بتنسيق XXXX-XXXX-XXXX",
          "نوع الجهاز": "android",
          "تاريخ بداية الاشتراك": "",
          "تاريخ نهاية الاشتراك": "",
          "نوع الاشتراك": "دائم",
          "ملاحظات": "الرقم التعريفي: XXX... ( إن وجد بدون كلمة الرقم التعريفي) + أي ملاحظات أخرى"
        }
      ]
    }
    
    تعليمات مهمة لمعالجة الرموز والأرقام:
    1. أي رقم بتنسيق XXXX-XXXX-XXXX يعتبر رمز تفعيل لجهاز
    2. أي رقم مكون من 12-15 رقم متصل (بدون شرطات) هو رقم تعريفي وليس رمز تفعيل
    3. ضع الرقم التعريفي في حقل "ملاحظات" للجهاز بصيغة "الرقم التعريفي: XXX..."
    4. لا تنشئ جهازًا منفصلاً للرقم التعريفي، بل أضفه كملاحظة للجهاز ذي رمز التفعيل المرتبط به
    5. إذا وُجد رقم تعريفي بدون رمز تفعيل، أنشئ جهازًا مع رمز تفعيل افتراضي بصيغة "ID-XXXX" (حيث XXXX هي آخر 4 أرقام من الرقم التعريفي)
    6. إذا تكرر نفس اسم العميل في أكثر من موضع، تأكد من دمج معلوماته وإنشاء سجل واحد له مع أجهزته المتعددة

    المحادثة: ${text}
    `;

    try {
      const result = await model.generateContent(prompt);
      const response = await result.response;
      const responseText = response.text();

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

        let data;
        try {
          data = JSON.parse(cleanJsonStr);
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
            data = JSON.parse(cleanJsonStr);
          } catch (finalError) {
            console.error('فشل في تحليل JSON بعد محاولات الإصلاح:', finalError);

            // إنشاء هيكل بيانات بسيط للعودة
            data = {
              clients: [],
              devices: []
            };
          }
        }

        // تنظيف وتوحيد الأجهزة لكل عميل
        let devices = Array.isArray(data.devices) ? data.devices : [];
        const clients = Array.isArray(data.clients) ? data.clients : [];
        
        // التحقق من الأجهزة وإصلاح أي مشاكل
        if (devices.length > 0) {
          // إنشاء مصفوفة نظيفة من الأجهزة
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

          devices = clients.map(client => ({
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
        return {
          clients: [],
          devices: []
        };
      }
    } catch (apiError: any) {
      console.error('خطأ في استدعاء Gemini API:', apiError);

      if (apiError.message && apiError.message.includes('API key not valid')) {
        throw new Error('مفتاح API لـ Gemini غير صالح');
      } else if (apiError.message && apiError.message.includes('not found')) {
        throw new Error('نموذج Gemini غير موجود أو غير متاح');
      } else {
        throw apiError;
      }
    }
  } catch (error) {
    console.error('خطأ في استخراج البيانات باستخدام Gemini:', error);
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
            content: 'أنت مساعد ذكي متخصص في استخراج البيانات من محادثات واتساب. مهمتك هي تحليل المحادثة واستخراج بيانات العملاء والأجهزة بتنسيق JSON.'
          },
          {
            role: 'user',
            content: `
            قم بتحليل محادثة واتساب التالية واستخرج منها بيانات العملاء والأجهزة.
            
            المحادثة:
            ${text}
            
            هام جدًا - قواعد استخراج رموز التفعيل والأرقام التعريفية:
            - رمز التفعيل يكون دائمًا بتنسيق XXXX-XXXX-XXXX (أربعة أرقام - أربعة أرقام - أربعة أرقام)
            - الرقم التعريفي يكون سلسلة طويلة من الأرقام (12-15 رقم) بدون شرطات
            - لكل عميل جهاز واحد أو أكثر
            - لكل جهاز رمز تفعيل واحد فقط
            - قد يظهر الرقم التعريفي ورمز التفعيل متتاليين وفي هذه الحالة هما لنفس الجهاز
            - ضع الرقم التعريفي في حقل "ملاحظات" الخاص بالجهاز وليس كجهاز منفصل
            - قد يكون لبعض العملاء رقم تعريفي فقط أو رمز تفعيل فقط وهذا أمر طبيعي
            
            قم بإرجاع البيانات بتنسيق JSON كالتالي:
            {
              "clients": [
                {
                  "اسم العميل": "اسم العميل",
                  "اسم المؤسسة": "اسم المؤسسة",
                  "نوع النشاط": "نوع النشاط",
                  "الهاتف": "رقم الهاتف",
                  "الهاتف 2": "رقم هاتف آخر",
                  "العنوان": "العنوان",
                  "ملاحظات": "أي ملاحظات"
                }
              ],
              "devices": [
                {
                  "رمز التفعيل": "رمز التفعيل (بتنسيق XXXX-XXXX-XXXX)",
                  "اسم العميل": "اسم العميل",
                  "نوع الجهاز": "android",
                  "تاريخ بداية الاشتراك": "",
                  "تاريخ نهاية الاشتراك": "",
                  "نوع الاشتراك": "دائم",
                  "ملاحظات": "الرقم التعريفي: XXX... (إن وجد) + أي ملاحظات أخرى مثل استبدال أو جديد"
                }
              ]
            }
            
            تعليمات مهمة:
            1. أي رقم بتنسيق XXXX-XXXX-XXXX يعتبر رمز تفعيل لجهاز
            2. لا تنشئ جهازًا منفصلاً للرقم التعريفي، بل أضفه كملاحظة للجهاز ذي رمز التفعيل
            3. وجود علامة 🛑 أو 🔴 أو عبارة "تم الاستبدال" أو "مستبدل" تشير إلى أن العميل قام باستبدال جهاز
            4. إذا تكرر نفس اسم العميل في أكثر من موضع، تأكد من دمج معلوماته وإنشاء سجل واحد له مع أجهزته المتعددة
            5. إذا وُجد رقم تعريفي بدون رمز تفعيل، أنشئ جهازًا مع رمز تفعيل افتراضي بصيغة "ID-XXXX" (حيث XXXX هي آخر 4 أرقام من الرقم التعريفي)
            6. أرجع البيانات بتنسيق JSON فقط بدون أي نص إضافي
            `
          }
        ],
        temperature: 0.1, // خفض درجة الحرارة لزيادة الدقة
        max_tokens: 4000
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        }
      }
    );

    const responseText = response.data.choices[0].message.content;

    try {
      // محاولة استخراج JSON من النص
      const jsonMatch = responseText.match(/```json\s*([\s\S]*?)\s*```/) || responseText.match(/{[\s\S]*}/);
      const jsonStr = jsonMatch ? jsonMatch[0].replace(/```json|```/g, '') : responseText;
      const cleanJsonStr = jsonStr.replace(/[\u200B-\u200D\uFEFF]/g, ''); // إزالة الأحرف غير المرئية

      const data = JSON.parse(cleanJsonStr);

      // تنظيف وتوحيد الأجهزة لكل عميل
      let devices = Array.isArray(data.devices) ? data.devices : [];
      const clients = Array.isArray(data.clients) ? data.clients : [];
      
      // التحقق من الأجهزة وإصلاح أي مشاكل
      if (devices.length > 0) {
        // إنشاء مصفوفة نظيفة من الأجهزة
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

        devices = clients.map(client => ({
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
      console.error('Error parsing DeepSeek response:', error);
      console.log('Raw response:', responseText);

      // إذا فشل التحليل، نعيد هيكل بيانات فارغ
      return { clients: [], devices: [] };
    }
  } catch (error: any) {
    console.error('Error calling DeepSeek API:', error);

    if (error.response?.status === 400) {
      throw new Error('طلب غير صالح. تحقق من تنسيق البيانات.');
    } else if (error.response?.status === 401) {
      throw new Error('مفتاح API غير صالح.');
    } else if (error.response?.status === 402 || error.response?.status === 429) {
      throw new Error('تم تجاوز حصة API أو الرصيد غير كافٍ.');
    } else {
      throw new Error(`خطأ في استدعاء DeepSeek API: ${error.message}`);
    }
  }
}

// /**
//  * دالة مساعدة للتحقق من صحة رمز التفعيل
//  */
// function isValidActivationCode(code: string): boolean {
//   return /^\d{4}-\d{4}-\d{4}$/.test(code.trim());
// }

// /**
//  * دالة مساعدة للتحقق من صحة الرقم التعريفي
//  */
// function isValidIdentificationNumber(num: string): boolean {
//   return /^\d{12,15}$/.test(num.trim());
// }

// /**
//  * دالة مساعدة لإزالة التكرارات من مصفوفة الأجهزة
//  */
// function removeDuplicateDevices(devices: DeviceData[]): DeviceData[] {
//   const seen = new Set();
//   return devices.filter(device => {
//     const duplicate = seen.has(device["رمز التفعيل"]);
//     seen.add(device["رمز التفعيل"]);
//     return !duplicate;
//   });
// }