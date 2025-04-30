/**
 * أداة للتخزين الآمن للبيانات الحساسة في المتصفح
 * تستخدم التشفير البسيط لحماية البيانات المخزنة في localStorage
 */

/**
 * تشفير البيانات قبل تخزينها
 * @param data البيانات المراد تشفيرها
 * @returns البيانات المشفرة
 */
export const encryptData = (data: any): string => {
  try {
    // تحويل البيانات إلى سلسلة نصية
    const dataString = typeof data === 'string' ? data : JSON.stringify(data);
    
    // تشفير بسيط باستخدام Base64 (للتوضيح فقط - استخدم مكتبة تشفير حقيقية في الإنتاج)
    // في بيئة الإنتاج، استخدم مكتبة مثل CryptoJS أو Web Crypto API
    const encoded = btoa(
      encodeURIComponent(dataString).replace(/%([0-9A-F]{2})/g, (_, p1) => {
        return String.fromCharCode(parseInt(p1, 16));
      })
    );
    
    return encoded;
  } catch (error) {
    console.error('خطأ في تشفير البيانات:', error);
    return '';
  }
};

/**
 * فك تشفير البيانات المخزنة
 * @param encryptedData البيانات المشفرة
 * @returns البيانات الأصلية
 */
export const decryptData = (encryptedData: string): any => {
  try {
    // فك التشفير البسيط (للتوضيح فقط)
    const decoded = decodeURIComponent(
      Array.prototype.map
        .call(atob(encryptedData), (c) => {
          return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        })
        .join('')
    );
    
    // محاولة تحويل البيانات إلى كائن JSON
    try {
      return JSON.parse(decoded);
    } catch {
      // إذا لم تكن البيانات بتنسيق JSON، إرجاع السلسلة النصية كما هي
      return decoded;
    }
  } catch (error) {
    console.error('خطأ في فك تشفير البيانات:', error);
    return null;
  }
};

/**
 * تخزين البيانات بشكل آمن في localStorage
 * @param key مفتاح التخزين
 * @param data البيانات المراد تخزينها
 */
export const secureSet = (key: string, data: any): void => {
  try {
    const encryptedData = encryptData(data);
    localStorage.setItem(`secure_${key}`, encryptedData);
  } catch (error) {
    console.error('خطأ في تخزين البيانات بشكل آمن:', error);
  }
};

/**
 * استرجاع البيانات المخزنة بشكل آمن من localStorage
 * @param key مفتاح التخزين
 * @returns البيانات المسترجعة
 */
export const secureGet = (key: string): any => {
  try {
    const encryptedData = localStorage.getItem(`secure_${key}`);
    if (!encryptedData) return null;
    
    return decryptData(encryptedData);
  } catch (error) {
    console.error('خطأ في استرجاع البيانات المخزنة بشكل آمن:', error);
    return null;
  }
};

/**
 * حذف البيانات المخزنة بشكل آمن من localStorage
 * @param key مفتاح التخزين
 */
export const secureRemove = (key: string): void => {
  try {
    localStorage.removeItem(`secure_${key}`);
  } catch (error) {
    console.error('خطأ في حذف البيانات المخزنة بشكل آمن:', error);
  }
};

/**
 * التحقق من صلاحية الجلسة
 * @param maxAgeMinutes الحد الأقصى لعمر الجلسة بالدقائق
 * @returns true إذا كانت الجلسة صالحة، false إذا انتهت صلاحيتها
 */
export const isSessionValid = (maxAgeMinutes: number = 60): boolean => {
  try {
    const lastActivity = secureGet('lastActivity');
    if (!lastActivity) return false;
    
    const now = new Date().getTime();
    const lastActivityTime = new Date(lastActivity).getTime();
    
    // التحقق من أن الجلسة لم تتجاوز الحد الأقصى للعمر
    return now - lastActivityTime < maxAgeMinutes * 60 * 1000;
  } catch (error) {
    console.error('خطأ في التحقق من صلاحية الجلسة:', error);
    return false;
  }
};

/**
 * تحديث وقت آخر نشاط للمستخدم
 */
export const updateLastActivity = (): void => {
  secureSet('lastActivity', new Date().toISOString());
};

/**
 * تسجيل خروج المستخدم وحذف بيانات الجلسة
 */
export const clearSession = (): void => {
  secureRemove('currentUser');
  secureRemove('lastActivity');
  // حذف أي بيانات جلسة أخرى هنا
};
