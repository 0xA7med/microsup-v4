import os
import re
import json
import pandas as pd
import time
import argparse
from dotenv import load_dotenv
import requests
from tqdm import tqdm
import concurrent.futures

# تحميل متغيرات البيئة من ملف .env
load_dotenv()

# الحصول على مفاتيح API من متغيرات البيئة
OPENAI_API_KEY = os.getenv("VITE_OPENAI_API_KEY")
DEEPSEEK_API_KEY = os.getenv("VITE_DEEPSEEK_API_KEY")
GEMINI_API_KEY = os.getenv("VITE_GEMINI_API_KEY")

# تعريف نموذج الاستخراج
EXTRACTION_PROMPT = """
أنت مساعد متخصص في استخراج بيانات العملاء والأجهزة من محادثات واتساب.
استخرج البيانات التالية من النص:
1. اسم العميل
2. اسم المؤسسة (إن وجد)
3. نوع النشاط (إن وجد)
4. رقم الهاتف (أو أرقام الهواتف)
5. العنوان
6. رمز التفعيل (إن وجد)
7. نوع الجهاز (مثل: Android, iOS, Windows)
8. تاريخ بداية الاشتراك (إن وجد)
9. تاريخ نهاية الاشتراك (إن وجد)
10. نوع الاشتراك (إن وجد)
11. ملاحظات إضافية

مهم جداً: قدم البيانات بتنسيق JSON فقط، بدون أي نص إضافي قبل أو بعد JSON. استخدم التنسيق التالي بالضبط:

{{"clients": [
  {{
    "اسم العميل": "...",
    "اسم المؤسسة": "...",
    "نوع النشاط": "...",
    "الهاتف": "...",
    "الهاتف 2": "...",
    "العنوان": "...",
    "ملاحظات": "..."
  }}
],
"devices": [
  {{
    "اسم العميل": "...",
    "رمز التفعيل": "...",
    "نوع الجهاز": "...",
    "السعر": "...",
    "تاريخ بداية الاشتراك": "...",
    "تاريخ نهاية الاشتراك": "...",
    "نوع الاشتراك": "...",
    "ملاحظات": "..."
  }}
]}}

لا تضف أي تعليقات أو شرح، فقط قم بإرجاع JSON بالتنسيق المحدد أعلاه.
إذا كان هناك أكثر من عميل أو جهاز، قم بإضافتهم كعناصر إضافية في المصفوفات المناسبة.
إذا كانت بعض البيانات غير موجودة، استخدم سلسلة فارغة "".

النص المراد استخراج البيانات منه:
{text}
"""

def parse_whatsapp_data(file_path):
    """
    قراءة ملف محادثة واتساب وتقسيمه إلى سطور
    """
    with open(file_path, 'r', encoding='utf-8') as file:
        lines = file.readlines()
    
    # تنظيف السطور
    clean_lines = []
    for line in lines:
        line = line.strip()
        if line and not line.startswith('#') and not line.startswith('//'):
            # تحويل الفاصل ______ إلى فاصل مناسب
            line = line.replace('______', '____')
            clean_lines.append(line)
    
    return clean_lines

def extract_title_content(line):
    """
    استخراج العنوان والمحتوى من السطر
    """
    # البحث عن نمط "title": "..." و "contents": "..."
    title_match = re.search(r'"title":\s*"([^"]*)"', line)
    content_match = re.search(r'"contents":\s*"([^"]*)"', line)
    
    # إذا لم يتم العثور على النمط، نبحث عن فاصل ____
    if not title_match or not content_match:
        parts = line.split('____')
        if len(parts) >= 2:
            return parts[0].strip(), parts[1].strip()
    else:
        return title_match.group(1), content_match.group(1)
    
    # إذا لم نجد أي نمط، نعيد السطر كاملاً كمحتوى
    return "", line

def process_with_openai(text):
    """
    معالجة النص باستخدام OpenAI API
    """
    try:
        response = requests.post(
            "https://api.openai.com/v1/chat/completions",
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {OPENAI_API_KEY}"
            },
            json={
                "model": "gpt-4o",
                "messages": [
                    {"role": "system", "content": "أنت مساعد متخصص في استخراج البيانات من النصوص العربية. عليك إرجاع JSON فقط بدون أي نص إضافي."},
                    {"role": "user", "content": EXTRACTION_PROMPT.format(text=text)}
                ],
                "temperature": 0.2,
                "max_tokens": 4000,
                "response_format": {"type": "json_object"}
            },
            timeout=60
        )
        
        if response.status_code != 200:
            print(f"خطأ في OpenAI API: {response.status_code}")
            print(response.text)
            return None
        
        data = response.json()
        content = data["choices"][0]["message"]["content"]
        
        # محاولة تحليل JSON مباشرة
        try:
            return json.loads(content)
        except json.JSONDecodeError as e:
            print(f"خطأ في تحليل JSON: {e}")
            print(f"النص المستلم: {content}")
            
            # استخراج JSON من النص
            json_match = re.search(r'\{[\s\S]*\}', content)
            if json_match:
                try:
                    json_str = json_match.group(0)
                    # تنظيف النص من أي أحرف غير مطلوبة
                    json_str = re.sub(r'[\n\r\t]', '', json_str)
                    return json.loads(json_str)
                except json.JSONDecodeError as e:
                    print(f"خطأ في تحليل JSON بعد التنظيف: {e}")
                    # محاولة إصلاح JSON
                    try:
                        # إزالة الأحرف الخاصة والمسافات الزائدة
                        cleaned_json = re.sub(r'[\n\r\t]', '', content)
                        # استخراج JSON من النص المنظف
                        json_match = re.search(r'\{[\s\S]*\}', cleaned_json)
                        if json_match:
                            return json.loads(json_match.group(0))
                    except Exception as e:
                        print(f"فشل جميع محاولات تحليل JSON: {e}")
        
        # إذا فشل تحليل JSON، حاول استخراج البيانات يدوياً
        print("محاولة استخراج البيانات يدوياً من استجابة OpenAI...")
        clients = []
        devices = []
        
        # البحث عن قسم العملاء
        clients_section = re.search(r'"clients"\s*:\s*\[(.*?)\]', content, re.DOTALL)
        if clients_section:
            client_items = re.findall(r'\{(.*?)\}', clients_section.group(1), re.DOTALL)
            for item in client_items:
                client = {}
                # استخراج كل حقل
                for field in ["اسم العميل", "اسم المؤسسة", "نوع النشاط", "الهاتف", "الهاتف 2", "العنوان", "ملاحظات"]:
                    field_match = re.search(f'"{field}"\s*:\s*"([^"]*)"', item)
                    if field_match:
                        client[field] = field_match.group(1)
                    else:
                        client[field] = ""
                clients.append(client)
        
        # البحث عن قسم الأجهزة
        devices_section = re.search(r'"devices"\s*:\s*\[(.*?)\]', content, re.DOTALL)
        if devices_section:
            device_items = re.findall(r'\{(.*?)\}', devices_section.group(1), re.DOTALL)
            for item in device_items:
                device = {}
                # استخراج كل حقل
                for field in ["اسم العميل", "رمز التفعيل", "نوع الجهاز", "السعر", "تاريخ بداية الاشتراك", "تاريخ نهاية الاشتراك", "نوع الاشتراك", "ملاحظات"]:
                    field_match = re.search(f'"{field}"\s*:\s*"([^"]*)"', item)
                    if field_match:
                        device[field] = field_match.group(1)
                    else:
                        device[field] = ""
                devices.append(device)
        
        if clients or devices:
            return {"clients": clients, "devices": devices}
        
        return None
    
    except Exception as e:
        print(f"خطأ في استدعاء OpenAI API: {e}")
        print(f"تفاصيل الخطأ: {str(e)}")
        return None

def process_with_gemini(text):
    """
    معالجة النص باستخدام Gemini API
    """
    try:
        response = requests.post(
            "https://generativelanguage.googleapis.com/v1/models/gemini-pro:generateContent",
            headers={
                "Content-Type": "application/json",
                "x-goog-api-key": GEMINI_API_KEY
            },
            json={
                "contents": [
                    {
                        "role": "user",
                        "parts": [
                            {
                                "text": "أنت مساعد متخصص في استخراج البيانات من النصوص العربية. عليك إرجاع JSON فقط بدون أي نص إضافي."
                            }
                        ]
                    },
                    {
                        "role": "user",
                        "parts": [
                            {
                                "text": EXTRACTION_PROMPT.format(text=text)
                            }
                        ]
                    }
                ],
                "generationConfig": {
                    "temperature": 0.2,
                    "maxOutputTokens": 4000
                }
            },
            timeout=60
        )
        
        if response.status_code != 200:
            print(f"خطأ في Gemini API: {response.status_code}")
            print(response.text)
            return None
        
        data = response.json()
        content = data["candidates"][0]["content"]["parts"][0]["text"]
        
        # محاولة تحليل JSON مباشرة
        try:
            # تنظيف النص من أي أحرف غير مطلوبة
            content = content.strip()
            # إزالة أي نص قبل بداية JSON
            json_start = content.find('{')
            if json_start != -1:
                content = content[json_start:]
            # إزالة أي نص بعد نهاية JSON
            json_end = content.rfind('}')
            if json_end != -1:
                content = content[:json_end+1]
            
            # تحليل JSON
            return json.loads(content)
        except json.JSONDecodeError as e:
            print(f"خطأ في تحليل JSON: {e}")
            print(f"النص المستلم: {content}")
            
            # محاولة إصلاح JSON
            try:
                # إزالة الأحرف الخاصة والمسافات الزائدة
                cleaned_json = re.sub(r'[\n\r\t]', '', content)
                return json.loads(cleaned_json)
            except Exception as e:
                print(f"فشل محاولة تنظيف JSON: {e}")
        
        # إذا فشل تحليل JSON، حاول استخراج البيانات يدوياً
        print("محاولة استخراج البيانات يدوياً من استجابة Gemini...")
        
        # إنشاء هيكل البيانات الافتراضي
        result = {
            "clients": [],
            "devices": []
        }
        
        # البحث عن العملاء
        client_matches = re.finditer(r'"اسم العميل"\s*:\s*"([^"]*)"', content)
        for match in client_matches:
            client_name = match.group(1)
            if client_name:
                # البحث عن بيانات العميل الأخرى
                client = {"اسم العميل": client_name}
                
                # استخراج باقي البيانات
                for field in ["اسم المؤسسة", "نوع النشاط", "الهاتف", "الهاتف 2", "العنوان", "ملاحظات"]:
                    field_match = re.search(f'"{field}"\s*:\s*"([^"]*)"', content)
                    if field_match:
                        client[field] = field_match.group(1)
                    else:
                        client[field] = ""
                
                result["clients"].append(client)
        
        # البحث عن الأجهزة
        device_matches = re.finditer(r'"رمز التفعيل"\s*:\s*"([^"]*)"', content)
        for match in device_matches:
            activation_code = match.group(1)
            if activation_code:
                # البحث عن بيانات الجهاز الأخرى
                device = {"رمز التفعيل": activation_code}
                
                # استخراج باقي البيانات
                for field in ["اسم العميل", "نوع الجهاز", "السعر", "تاريخ بداية الاشتراك", "تاريخ نهاية الاشتراك", "نوع الاشتراك", "ملاحظات"]:
                    field_match = re.search(f'"{field}"\s*:\s*"([^"]*)"', content)
                    if field_match:
                        device[field] = field_match.group(1)
                    else:
                        device[field] = ""
                
                result["devices"].append(device)
        
        if result["clients"] or result["devices"]:
            return result
        
        return None
    
    except Exception as e:
        print(f"خطأ في استدعاء Gemini API: {e}")
        print(f"تفاصيل الخطأ: {str(e)}")
        return None

def process_with_deepseek(text):
    """
    معالجة النص باستخدام DeepSeek API
    """
    try:
        response = requests.post(
            "https://api.deepseek.com/v1/chat/completions",
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {DEEPSEEK_API_KEY}"
            },
            json={
                "model": "deepseek-chat",
                "messages": [
                    {"role": "system", "content": "أنت مساعد متخصص في استخراج البيانات من النصوص العربية. عليك إرجاع JSON فقط بدون أي نص إضافي."},
                    {"role": "user", "content": EXTRACTION_PROMPT.format(text=text)}
                ],
                "temperature": 0.2,
                "max_tokens": 4000
            },
            timeout=60
        )
        
        if response.status_code != 200:
            print(f"خطأ في DeepSeek API: {response.status_code}")
            print(response.text)
            return None
        
        data = response.json()
        content = data["choices"][0]["message"]["content"]
        
        # محاولة تحليل JSON مباشرة
        try:
            # تنظيف النص من أي أحرف غير مطلوبة
            content = content.strip()
            # إزالة أي نص قبل بداية JSON
            json_start = content.find('{')
            if json_start != -1:
                content = content[json_start:]
            # إزالة أي نص بعد نهاية JSON
            json_end = content.rfind('}')
            if json_end != -1:
                content = content[:json_end+1]
            
            # تحليل JSON
            return json.loads(content)
        except json.JSONDecodeError as e:
            print(f"خطأ في تحليل JSON: {e}")
            print(f"النص المستلم: {content}")
            
            # محاولة إصلاح JSON
            try:
                # إزالة الأحرف الخاصة والمسافات الزائدة
                cleaned_json = re.sub(r'[\n\r\t]', '', content)
                return json.loads(cleaned_json)
            except Exception as e:
                print(f"فشل محاولة تنظيف JSON: {e}")
        
        # إذا فشل تحليل JSON، حاول استخراج البيانات يدوياً
        print("محاولة استخراج البيانات يدوياً من استجابة DeepSeek...")
        
        # إنشاء هيكل البيانات الافتراضي
        result = {
            "clients": [],
            "devices": []
        }
        
        # البحث عن العملاء
        client_matches = re.finditer(r'"اسم العميل"\s*:\s*"([^"]*)"', content)
        for match in client_matches:
            client_name = match.group(1)
            if client_name:
                # البحث عن بيانات العميل الأخرى
                client = {"اسم العميل": client_name}
                
                # استخراج باقي البيانات
                for field in ["اسم المؤسسة", "نوع النشاط", "الهاتف", "الهاتف 2", "العنوان", "ملاحظات"]:
                    field_match = re.search(f'"{field}"\s*:\s*"([^"]*)"', content)
                    if field_match:
                        client[field] = field_match.group(1)
                    else:
                        client[field] = ""
                
                result["clients"].append(client)
        
        # البحث عن الأجهزة
        device_matches = re.finditer(r'"رمز التفعيل"\s*:\s*"([^"]*)"', content)
        for match in device_matches:
            activation_code = match.group(1)
            if activation_code:
                # البحث عن بيانات الجهاز الأخرى
                device = {"رمز التفعيل": activation_code}
                
                # استخراج باقي البيانات
                for field in ["اسم العميل", "نوع الجهاز", "السعر", "تاريخ بداية الاشتراك", "تاريخ نهاية الاشتراك", "نوع الاشتراك", "ملاحظات"]:
                    field_match = re.search(f'"{field}"\s*:\s*"([^"]*)"', content)
                    if field_match:
                        device[field] = field_match.group(1)
                    else:
                        device[field] = ""
                
                result["devices"].append(device)
        
        if result["clients"] or result["devices"]:
            return result
        
        return None
    
    except Exception as e:
        print(f"خطأ في استدعاء DeepSeek API: {e}")
        print(f"تفاصيل الخطأ: {str(e)}")
        return None

def extract_data_locally(text):
    """
    استخراج البيانات محلياً باستخدام التعبيرات المنتظمة
    """
    # تحسين التعبيرات المنتظمة لاستخراج البيانات بشكل أكثر دقة
    name_regex = re.compile(r'(?:اسم العميل|اسم المستخدم|العميل)[:\s]+([^\n،]+)', re.I)
    company_regex = re.compile(r'(?:مؤسسة|شركة|مصنع|محل|متجر|مندوب مبيعات|موبيل|طيور)\s+([^\n،]+)', re.I)
    activity_regex = re.compile(r'(?:نوع النشاط|النشاط)[:\s]+([^\n،]+)', re.I)
    phone_regex = re.compile(r'(?:^|\n|[^0-9])(\d{10,12}|00\d{10,12}|\+\d{10,12})')
    address_regex = re.compile(r'(?:العنوان|المدينة|المنطقة|شارع)[:\s]+([^\n]+)', re.I)
    address_regex2 = re.compile(r'(?:شارع|مدينة|محافظة|المنطقة|منطقة|اسيوط|القاهرة|حلوان|المنيا|الاسكندرية|الشرقية|الجيزة|المحلة|شبين|دمياط|كفر)\s+([^،\n]+)', re.I)
    code_regex = re.compile(r'(?:رمز التفعيل|كود التفعيل|الكود)[:\s]+([a-zA-Z0-9-]+)', re.I)
    code_regex2 = re.compile(r'([a-zA-Z0-9]{4,}-[a-zA-Z0-9]{4,}(?:-[a-zA-Z0-9]{4,})?)')
    device_regex = re.compile(r'(?:نوع الجهاز|الجهاز)[:\s]+([^\n،]+)', re.I)
    device_type_regex = re.compile(r'(?:اندرويد|ايفون|ويندوز|android|ios|windows)', re.I)
    
    # استخراج العنوان والمحتوى
    title, content = extract_title_content(text)
    full_text = f"{title}\n{content}"
    
    # استخراج اسم العميل
    client_name = ""
    name_match = name_regex.search(full_text)
    if not name_match:
        # استخراج الاسم من العنوان
        title_match = re.search(r'(\d+)[-\s]*(.+?)(?:\s*[-–]\s*|\s+\d+|\s*\(|\s*$)', title)
        if title_match:
            client_name = title_match.group(2).strip().replace('🛑', '').replace('🔴', '')
    else:
        client_name = name_match.group(1).strip()
    
    # استخراج اسم المؤسسة
    company_name = ""
    company_match = company_regex.search(full_text)
    if company_match:
        company_name = company_match.group(1).strip()
    
    # استخراج نوع النشاط
    activity_type = ""
    activity_match = activity_regex.search(full_text)
    if activity_match:
        activity_type = activity_match.group(1).strip()
    else:
        # البحث عن كلمات تدل على النشاط
        activity_keywords = ["مستحضرات تجميل", "قطع غيار", "محل", "متجر", "مندوب مبيعات", "موبيل", "طيور"]
        for keyword in activity_keywords:
            if keyword in full_text:
                activity_match = re.search(f"{keyword}\\s*([^\\n،]+)", full_text)
                if activity_match:
                    activity_type = keyword + " " + activity_match.group(1).strip()
                    break
                else:
                    activity_type = keyword
                    break
    
    # استخراج أرقام الهاتف
    phones = phone_regex.findall(full_text)
    phone1 = phones[0].replace("+", "").replace("00", "") if phones else ""
    phone2 = phones[1].replace("+", "").replace("00", "") if len(phones) > 1 else ""
    
    # استخراج العنوان
    address = ""
    address_match = address_regex.search(full_text)
    if not address_match:
        address_match = address_regex2.search(full_text)
    
    if address_match:
        address = address_match.group(0).strip()
    
    # استخراج رموز التفعيل
    activation_codes = []
    code_matches = code_regex.findall(full_text)
    if code_matches:
        activation_codes.extend(code_matches)
    
    code_matches2 = code_regex2.findall(full_text)
    if code_matches2:
        activation_codes.extend(code_matches2)
    
    # استخراج نوع الجهاز
    device_type = "Android"  # افتراضي
    device_match = device_regex.search(full_text)
    if device_match:
        device_type = device_match.group(1).strip()
    else:
        device_type_match = device_type_regex.search(full_text)
        if device_type_match:
            device_type_text = device_type_match.group(0).lower()
            if "اندرويد" in device_type_text or "android" in device_type_text:
                device_type = "Android"
            elif "ايفون" in device_type_text or "ios" in device_type_text:
                device_type = "iOS"
            elif "ويندوز" in device_type_text or "windows" in device_type_text:
                device_type = "Windows"
    
    # إنشاء كائن العميل
    client = {
        "اسم العميل": client_name,
        "اسم المؤسسة": company_name,
        "نوع النشاط": activity_type,
        "الهاتف": phone1,
        "الهاتف 2": phone2,
        "العنوان": address,
        "ملاحظات": f"تم استخراجه محلياً - {title}"
    }
    
    # إنشاء كائنات الأجهزة
    devices = []
    for code in activation_codes:
        device = {
            "اسم العميل": client_name,
            "رمز التفعيل": code,
            "نوع الجهاز": device_type,
            "السعر": "",
            "تاريخ بداية الاشتراك": "",
            "تاريخ نهاية الاشتراك": "",
            "نوع الاشتراك": "",
            "ملاحظات": f"تم استخراجه محلياً - {title}"
        }
        devices.append(device)
    
    # إذا لم يتم العثور على أي رمز تفعيل، إنشاء جهاز افتراضي
    if not devices:
        device = {
            "اسم العميل": client_name,
            "رمز التفعيل": "",
            "نوع الجهاز": device_type,
            "السعر": "",
            "تاريخ بداية الاشتراك": "",
            "تاريخ نهاية الاشتراك": "",
            "نوع الاشتراك": "",
            "ملاحظات": f"تم استخراجه محلياً - {title}"
        }
        devices.append(device)
    
    return {"clients": [client], "devices": devices}

def main():
    parser = argparse.ArgumentParser(description='استخراج بيانات العملاء والأجهزة من محادثات واتساب')
    parser.add_argument('input_file', help='مسار ملف المدخلات')
    parser.add_argument('--output', default='extracted_data.xlsx', help='مسار ملف المخرجات (Excel)')
    parser.add_argument('--model', default='local', choices=['openai', 'gemini', 'deepseek', 'local'], 
                        help='نموذج الذكاء الاصطناعي المستخدم')
    parser.add_argument('--max-lines', type=int, default=0, help='الحد الأقصى لعدد السطور للمعالجة (0 للكل)')
    parser.add_argument('--batch-size', type=int, default=100, help='حجم الدفعة للمعالجة المتزامنة')
    parser.add_argument('--max-workers', type=int, default=5, help='الحد الأقصى لعدد العمليات المتوازية')
    parser.add_argument('--checkpoint', type=int, default=500, help='عدد السطور بين نقاط الحفظ المؤقتة')
    parser.add_argument('--resume', action='store_true', help='استئناف المعالجة من آخر نقطة حفظ')
    
    args = parser.parse_args()
    
    if not os.path.exists(args.input_file):
        print(f"خطأ: الملف {args.input_file} غير موجود")
        return
    
    # التحقق من مفتاح API
    if args.model == 'openai' and not OPENAI_API_KEY:
        print("خطأ: مفتاح API لـ OpenAI غير موجود في ملف .env")
        return
    elif args.model == 'gemini' and not GEMINI_API_KEY:
        print("خطأ: مفتاح API لـ Gemini غير موجود في ملف .env")
        return
    elif args.model == 'deepseek' and not DEEPSEEK_API_KEY:
        print("خطأ: مفتاح API لـ DeepSeek غير موجود في ملف .env")
        return
    
    # قراءة البيانات
    lines = parse_whatsapp_data(args.input_file)
    
    if args.max_lines > 0:
        lines = lines[:args.max_lines]
    
    print(f"تم العثور على {len(lines)} سطر للمعالجة")
    
    all_clients = []
    all_devices = []
    
    # ملف الحفظ المؤقت
    checkpoint_file = f"{os.path.splitext(args.output)[0]}_checkpoint.json"
    
    # استئناف المعالجة من نقطة الحفظ إذا طلب المستخدم ذلك
    start_index = 0
    if args.resume and os.path.exists(checkpoint_file):
        try:
            with open(checkpoint_file, 'r', encoding='utf-8') as f:
                checkpoint_data = json.load(f)
                start_index = checkpoint_data.get('processed_lines', 0)
                all_clients = checkpoint_data.get('clients', [])
                all_devices = checkpoint_data.get('devices', [])
                print(f"استئناف المعالجة من السطر {start_index}...")
        except Exception as e:
            print(f"خطأ في قراءة ملف نقطة الحفظ: {e}")
    
    # معالجة البيانات في دفعات
    total_lines = len(lines)
    for batch_start in range(start_index, total_lines, args.batch_size):
        batch_end = min(batch_start + args.batch_size, total_lines)
        batch = lines[batch_start:batch_end]
        
        print(f"معالجة الدفعة {batch_start//args.batch_size + 1} من {(total_lines-1)//args.batch_size + 1} ({batch_start}-{batch_end-1})...")
        
        # معالجة الدفعة الحالية
        with concurrent.futures.ThreadPoolExecutor(max_workers=args.max_workers) as executor:
            futures = []
            for line in batch:
                if args.model == 'openai':
                    futures.append(executor.submit(process_with_openai, line))
                elif args.model == 'gemini':
                    futures.append(executor.submit(process_with_gemini, line))
                elif args.model == 'deepseek':
                    futures.append(executor.submit(process_with_deepseek, line))
                else:  # local
                    futures.append(executor.submit(extract_data_locally, line))
            
            for i, future in enumerate(tqdm(concurrent.futures.as_completed(futures), total=len(futures), desc=f"معالجة الدفعة {batch_start//args.batch_size + 1}")):
                try:
                    result = future.result()
                    if result and 'clients' in result and 'devices' in result:
                        all_clients.extend(result['clients'])
                        all_devices.extend(result['devices'])
                    else:
                        line_index = batch_start + i
                        print(f"تحذير: فشل معالجة السطر {line_index+1}")
                        # محاولة المعالجة المحلية كخطة بديلة
                        if args.model != 'local':
                            print("محاولة المعالجة المحلية...")
                            result = extract_data_locally(lines[line_index])
                            if result and 'clients' in result and 'devices' in result:
                                all_clients.extend(result['clients'])
                                all_devices.extend(result['devices'])
                except Exception as e:
                    line_index = batch_start + i
                    print(f"خطأ في معالجة السطر {line_index+1}: {e}")
        
        # حفظ نقطة تفتيش مؤقتة بعد كل عدد محدد من السطور
        if (batch_end % args.checkpoint == 0 or batch_end == total_lines) and batch_end > start_index:
            checkpoint_data = {
                'processed_lines': batch_end,
                'clients': all_clients,
                'devices': all_devices,
                'timestamp': time.time()
            }
            
            with open(checkpoint_file, 'w', encoding='utf-8') as f:
                json.dump(checkpoint_data, f, ensure_ascii=False, indent=2)
            
            print(f"تم حفظ نقطة تفتيش مؤقتة بعد معالجة {batch_end} سطر")
            
            # حفظ ملف Excel مؤقت أيضًا
            temp_clients_df = pd.DataFrame(all_clients)
            temp_devices_df = pd.DataFrame(all_devices)
            
            temp_output = f"{os.path.splitext(args.output)[0]}_temp.xlsx"
            with pd.ExcelWriter(temp_output) as writer:
                temp_clients_df.to_excel(writer, sheet_name='العملاء', index=False)
                temp_devices_df.to_excel(writer, sheet_name='الأجهزة', index=False)
            
            print(f"تم حفظ البيانات المؤقتة في {temp_output}")
    
    # تحويل البيانات إلى DataFrames
    clients_df = pd.DataFrame(all_clients)
    devices_df = pd.DataFrame(all_devices)
    
    # تنظيف البيانات
    for df in [clients_df, devices_df]:
        for col in df.columns:
            df[col] = df[col].astype(str).apply(lambda x: x if x != 'nan' else '')
    
    # حفظ البيانات في ملف Excel
    with pd.ExcelWriter(args.output) as writer:
        clients_df.to_excel(writer, sheet_name='العملاء', index=False)
        devices_df.to_excel(writer, sheet_name='الأجهزة', index=False)
    
    print(f"تم استخراج {len(all_clients)} عميل و {len(all_devices)} جهاز")
    print(f"تم حفظ البيانات في {args.output}")
    
    # حذف ملف نقطة الحفظ بعد الانتهاء بنجاح
    if os.path.exists(checkpoint_file):
        os.remove(checkpoint_file)

if __name__ == "__main__":
    main()
