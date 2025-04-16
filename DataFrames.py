import pandas as pd
import re
import io
import json
import os
from datetime import datetime, timedelta

# Function to calculate end date based on start date and subscription type
# Note: This function is prepared but won't be used much as subscription type is mostly unknown
def calculate_end_date(start_date_str, subscription_type):
    if not start_date_str or pd.isna(start_date_str):
        return None
    try:
        start_date = pd.to_datetime(start_date_str, errors='coerce')
        if pd.isna(start_date):
            return None

        if subscription_type == 'شهري':
            # Assuming monthly means 30 days for simplicity, or use dateutil.relativedelta
            return start_date + timedelta(days=30)
        elif subscription_type == 'نصف سنوي':
            # Assuming 6 months = 182 days
            return start_date + timedelta(days=182)
        elif subscription_type == 'سنوي':
            return start_date + timedelta(days=365)
        elif subscription_type == 'دائم':
            return None # Or a specific marker like 'Permanent'
        else:
            # If type is unknown or not one of the standards, assume 1 year?
            # Or better, leave blank as per instructions if not calculable.
             return None # Defaulting to 1 year if type unknown but start date exists
            # return start_date + timedelta(days=365)
    except Exception:
        return None
    return None # Default return if calculation fails

# Function to extract data from a single conversation content
def extract_data(content, title, timestamp):
    customer_data = {
        "اسم العميل": None, "اسم المؤسسة": None, "نوع النشاط": None,
        "الهاتف": None, "الهاتف 2": None, "العنوان": None,
        "ملاحظات": [], "نوع الاشتراك": None,
        "تاريخ بداية الاشتراك": None, "تاريخ نهاية الاشتراك": None
    }
    device_data_list = []

    # --- Try extracting name from title first ---
    name_match_title = re.match(r'\d+[\s-]*([^0-9\(\)🔴+]+)', title)
    potential_name_title = name_match_title.group(1).strip() if name_match_title else None
    # Refine potential name by removing location hints if present early
    if potential_name_title:
       parts = potential_name_title.split()
       # Check common location keywords
       locations_in_title = ["اليمن", "المعادي", "القاهرة", "حلوان", "المحلة", "الكبرى", "شبين", "الكوم",
                             "مدينة", "نصر", "اسيوط", "فيصل", "الجيزه", "اكتوبر", "عمان", "اسوان",
                             "دمياط", "المنيا", "كفر", "الشيخ", "تونس", "مايو", "الخصوص", "الشرقية",
                             "دقهليه", "الفيوم", "الاسكندرية", "الزيتون", "الغردقة", "الفرافرة",
                             "فلسطين", "العاشر", "رمضان", "المنصورة"]
       # Very basic check: if the last word is a location, remove it
       # More robust checking would involve comparing against a list of known locations/keywords
       # For now, stick to extracting from `contents` as it seems more reliable.

    # --- Process 'contents' for details ---
    lines = content.split('\n')
    full_text = " ".join(lines).strip() # Join lines for easier regex matching across lines

    # --- Extract Phones ---
    # Regex for Egyptian numbers (01x) and potential landlines/international (longer sequences, maybe with country code)
    # Prioritize Egyptian mobile format, allow for optional country codes like 00968, 00970, 00216
    # Pattern: Optional Country Code -> Optional Space -> Optional Leading 0 -> Main Number (9-11 digits typical for Egypt mobile)
    # Or international format: 00 + code + number
    phone_pattern = r'(?:(?:00\d{1,5})?\s?0?([1-9]\d{8,11})|(\d{9,15}))' # Capture group 1 for Egyptian-like, group 2 for others
    phones = re.findall(phone_pattern, full_text)
    # Flatten list of tuples and remove duplicates/empty strings
    extracted_phones = list(dict.fromkeys([p[0] or p[1] for p in phones if p[0] or p[1]]))
    # Clean phone numbers (remove potential leading 0 if country code present implicitly)
    cleaned_phones = []
    for p in extracted_phones:
        p_cleaned = re.sub(r'\D', '', p) # Remove non-digits first
        # Basic check if it looks like an Egyptian mobile number structure
        if p_cleaned.startswith('01') and len(p_cleaned) == 11:
             cleaned_phones.append(p_cleaned)
        elif len(p_cleaned) >= 9: # Keep other plausible long numbers
             cleaned_phones.append(p_cleaned)


    if cleaned_phones:
        customer_data["الهاتف"] = cleaned_phones[0]
        if len(cleaned_phones) > 1:
            customer_data["الهاتف 2"] = cleaned_phones[1]

    # --- Extract Activation Codes and Associated Dates ---
    # Codes: Long numbers (12+ digits typically) or XXXX-XXXX-XXXX format
    code_pattern_long = r'\b(\d{12,})\b'
    code_pattern_dashed = r'\b(\d{4}-\d{4}-\d{4})\b' # Changed to be more specific for the activation format
    # Dates: YYYY/MM/DD or YYYY-MM-DD
    date_pattern = r'(\d{4}[/-]\d{1,2}[/-]\d{1,2})'

    # Find all potential codes and dates with context
    potential_codes_long = re.findall(code_pattern_long, full_text)
    potential_codes_dashed = re.findall(code_pattern_dashed, full_text)

    all_codes = potential_codes_long + potential_codes_dashed # Combine, long codes usually preferred if both exist for same device

    # Find segments related to activations (e.g., lines containing codes or activation keywords)
    activation_segments = []
    current_segment = {"codes": [], "date": None, "notes": [], "is_replacement": False}
    device_counter = 0
    first_device_processed = False

    for i, line in enumerate(lines):
        line = line.strip()
        if not line: continue

        line_codes_long = re.findall(code_pattern_long, line)
        line_codes_dashed = re.findall(code_pattern_dashed, line)
        line_codes = line_codes_long + line_codes_dashed
        line_date = re.search(date_pattern, line)
        is_new_activation = "تفعيل جهاز تاني" in line or "رقم 2 يوم" in line or "تفعيل لصاحبه" in line or ("تفعيل يوم" in line and device_counter > 0)
        is_replacement = "تم الاستبدال" in line or "بديل تاني" in line or "بيانات الجديد هي" in line

        # If new activation/replacement keyword or date found, and current segment has codes, finalize previous segment
        if (is_new_activation or is_replacement or line_date) and current_segment["codes"] and first_device_processed:
             activation_segments.append(current_segment)
             current_segment = {"codes": [], "date": None, "notes": [], "is_replacement": False}
             device_counter += 1

        # Add codes found in the current line
        current_segment["codes"].extend(line_codes)
        current_segment["codes"] = list(dict.fromkeys(current_segment["codes"])) # Remove duplicates within segment

        if line_date:
            current_segment["date"] = line_date.group(1)

        if is_replacement:
            current_segment["is_replacement"] = True
            current_segment["notes"].append("تم الاستبدال")

        # Add context/notes that are not codes, dates, or phones
        line_cleaned_for_notes = re.sub(code_pattern_long, '', line)
        line_cleaned_for_notes = re.sub(code_pattern_dashed, '', line_cleaned_for_notes)
        line_cleaned_for_notes = re.sub(date_pattern, '', line_cleaned_for_notes)
        for p in cleaned_phones: # Also remove phones from potential notes
             line_cleaned_for_notes = line_cleaned_for_notes.replace(p, '')
        note_candidate = line_cleaned_for_notes.strip()
        # Add meaningful notes, avoid generic activation phrases if date/code already captured
        if note_candidate and note_candidate not in ["تفعيل جهاز تاني", "رقم 2 يوم", "تفعيل لصاحبه", "تفعيل يوم", "تم الاستبدال", "بيانات الجديد هي"]:
             # Also avoid adding parts of the name/address again if they appear on the line
             # This check needs to be more robust, maybe checking against extracted name/address later
             current_segment["notes"].append(note_candidate)

        # Mark first device segment as processed after encountering its codes
        if not first_device_processed and current_segment["codes"]:
            first_device_processed = True
            device_counter += 1 # Count the first device

    # Add the last segment if it contains codes
    if current_segment["codes"]:
        activation_segments.append(current_segment)

    # If no segments found but codes exist, create a single segment
    if not activation_segments and all_codes:
         activation_segments.append({"codes": all_codes, "date": None, "notes": [], "is_replacement": False})
         # Try finding a date anywhere in the text if no segment date found
         first_date_found = re.search(date_pattern, full_text)
         if first_date_found:
             activation_segments[0]["date"] = first_date_found.group(1)


    # --- Extract Name, Address, Activity ---
    # Try to find name early in the text, often after the initial number/hyphen
    name = None
    address_parts = []
    activity = None
    notes_customer = []

    # Clean the first line for potential name extraction
    first_line_cleaned = re.sub(r'^\d+\s*[-\s]*', '', lines[0]).strip()
    # Remove codes and phones from the first line to isolate name/address/activity
    first_line_name_candidate = first_line_cleaned
    for code in all_codes:
        first_line_name_candidate = first_line_name_candidate.replace(code, '')
    for phone in cleaned_phones:
        first_line_name_candidate = first_line_name_candidate.replace(phone, '')

    # Simplistic: Assume name is the first few words before hitting a location or activity keyword
    # This is prone to errors and needs refinement based on patterns
    potential_name_parts = []
    # Keywords that might terminate a name
    name_terminators = ["النشاط", "مندوب", "محافظة", "شارع", "مدينة", "مركز", "محطة", "منطقة",
                      "محل", "مخزن", "شركة", "مصنع", "تجارة", "توزيع", "قطع غيار", "خدمات", "وكيل",
                      "القاهرة", "الجيزة", "حلوان", "المعادي", "امبابه", "المحلة", "المنوفيه", "اسيوط",
                      "اكتوبر", "دمياط", "المنيا", "كفر الشيخ", "تونس", "عمان", "اسوان", "شربين",
                      "الفيوم", "الاسكندرية", "الغردقة", "الفرافرة", "فلسطين", "العاشر", "المنصورة",
                      "🔴", "+"] # Added symbols often appearing after name

    found_name = False
    for word in first_line_name_candidate.split():
        word_clean = word.strip('()1234567890.,') # Clean punctuation/numbers
        if word_clean and not found_name:
            if word_clean in name_terminators:
                found_name = True
                break # Stop adding to name
            else:
                potential_name_parts.append(word)
        # Break early if name seems too long or improbable
        if len(potential_name_parts) > 4:
             found_name = True # Assume name found after 4 words max? Risky assumption.
             # break

    if potential_name_parts:
        name = " ".join(potential_name_parts).strip()
        # If name contains 'مندوب', it might be part of the description, remove it?
        # Example: "احمد جابر مندوب اسوان" -> Name: "احمد جابر", Note: "مندوب اسوان"
        if "مندوب" in name.split():
            name_parts_filtered = [p for p in name.split() if p != "مندوب"]
            customer_data["ملاحظات"].append(f"مندوب {name.split('مندوب')[-1].strip()}")
            name = " ".join(name_parts_filtered).strip()

    # If name extraction failed, fallback to title?
    if not name and potential_name_title:
         name = potential_name_title
         # Try cleaning title name similar to above
         potential_name_parts_title = []
         found_name_title = False
         for word in name.split():
              word_clean = word.strip('()1234567890.,')
              if word_clean and not found_name_title:
                   if word_clean in name_terminators:
                       found_name_title = True
                       break
                   else:
                       potential_name_parts_title.append(word)
              if len(potential_name_parts_title) > 4:
                   found_name_title = True
                   # break
         if potential_name_parts_title:
             name = " ".join(potential_name_parts_title).strip()


    # Extract Activity
    activity_match = re.search(r'(?:النشاط|تجارة|بيع|خدمات|توزيع|محل|مصنع|شركة|وكيل)\s*:?\s*([\w\s]+)', full_text, re.IGNORECASE)
    if activity_match:
        activity_text = activity_match.group(1).strip()
        # Clean up activity text (remove trailing codes/phones if regex captured too much)
        for code in all_codes: activity_text = activity_text.replace(code, '')
        for phone in cleaned_phones: activity_text = activity_text.replace(phone, '')
        # Take only the first part before a potential date or another keyword
        activity_text = re.split(r'\s*\d{4}[/-]\d{1,2}[/-]\d{1,2}\s*|\s*تفعيل|\s*رقم', activity_text)[0]
        activity = activity_text.strip()
    else:
        # Try finding activity keywords if "النشاط" is not present
        activity_keywords = ["مبيعات", "قطع غيار", "كروت شحن", "زيوت وشحوم وفلاتر", "مستحضرات تجميل",
                           "مصنع ملابس", "توزيع اجهزة كهربائية", "ادوات صحية", "ملابس زي اسلامي",
                           "شركة توزيع مواد غذائية", "توزيع منتجات", "تجارة جملة وتوزيع",
                           "مبيدات واسمدة وميكانيكا", "اقمشه", "تجارة مواد غذائية",
                           "موبيلات وكمبيوتر ودش", "اكسسوارات موبيل جمله", "ادفع الكتروني",
                           "اسمدة ومبيدات"]
        for key in activity_keywords:
            if key in full_text:
                activity = key
                break # Take the first match

    customer_data["نوع النشاط"] = activity

    # Extract Address (Combine location names found)
    # This is complex. Use known city/area names and keywords like شارع, مدينة, مركز
    locations = []
    # Very basic: find known location names in the text
    known_locations = ["امبابه", "الجيزة", "المعادي", "القاهرة", "حلوان", "المحلة الكبرى", "شبين الكوم",
                     "المنوفيه", "مدينة نصر", "اسيوط", "فيصل", "اكتوبر", "سلطنه عمان", "اسوان",
                     "دمياط", "المنيا", "مركز بني مزار", "كفر الشيخ", "صفاقص", "تونس", "مدينة 15 مايو",
                     "الخصوص", "كفر صقر", "الشرقية", "شربين", "دقهليه", "الفيوم", "المسلة العبودي",
                     "الاسكندرية", "اول السيوف", "الزيتون", "الغردقة", "الفرافرة", "غزه", "فلسطين",
                     "مدينة الفردوس", "المعموره", "العاشر من رمضان"]
    address_keywords = ["شارع", "مدينة", "مركز", "محافظة"]

    address_string = ""
    # Extract address based on first line content after name, or search full text
    remaining_first_line = first_line_name_candidate
    if name:
        remaining_first_line = first_line_name_candidate.replace(name, '').strip()

    # Simple approach: Look for location keywords and nearby words
    for loc in known_locations:
        if loc in full_text:
            locations.append(loc)
    # Look for street names etc.
    street_match = re.search(r'(\d+\s+شارع\s+[\w\s]+)', full_text)
    if street_match:
         locations.append(street_match.group(1).strip())

    # Combine unique location parts found
    customer_data["العنوان"] = " ".join(list(dict.fromkeys(locations))).strip()
    # Fallback: Use the remainder of the first line if it seems like an address
    if not customer_data["العنوان"] and remaining_first_line and len(remaining_first_line.split()) <= 5:
         customer_data["العنوان"] = remaining_first_line

    # Extract Notes (Customer Level) - Info not captured elsewhere
    # Keywords like مندوب, سوري بمصر, خايف يحول, تم الالغاء, بديل تاني, استنفذ استبداله, تفعيل لصاحبه
    if "مندوب" in full_text and "مندوب" not in (customer_data["ملاحظات"] or []): customer_data["ملاحظات"].append("مندوب")
    if "سوري بمصر" in full_text: customer_data["ملاحظات"].append("سوري بمصر")
    if "خايف يحول" in full_text: customer_data["ملاحظات"].append("خايف يحول")
    if "تم الالغاء واستبدل" in full_text: customer_data["ملاحظات"].append("تم الالغاء واستبدل")
    if "بديل تاني" in full_text: customer_data["ملاحظات"].append("بديل تاني") # Maybe device note?
    if "استنفذ استبداله" in full_text: customer_data["ملاحظات"].append("استنفذ استبداله")
    # Add any remaining parts of lines that weren't processed? Be careful.
    # Check for "جوجل بلاي" or "الفيس" mentioned generally
    if "جوجل بلاي" in full_text: customer_data["ملاحظات"].append("جوجل بلاي")
    if "الفيس" in full_text: customer_data["ملاحظات"].append("من الفيس بوك")
    if "🔴" in full_text: customer_data["ملاحظات"].append("علامة 🔴")
    if "🛑" in full_text: customer_data["ملاحظات"].append("علامة 🛑")

    # Assign final name
    customer_data["اسم العميل"] = name if name else "اسم غير معروف" # Assign a default if name extraction fails

    # --- Process Devices ---
    earliest_start_date = None
    device_records = []

    for segment in activation_segments:
        # Try to determine the primary activation code (prefer long numeric)
        primary_code = None
        secondary_code_note = None
        long_codes_in_segment = [c for c in segment["codes"] if re.match(r'^\d{12,}$', c)]
        dashed_codes_in_segment = [c for c in segment["codes"] if re.match(r'^\d{4}-\d{4}-\d{4}$', c)]

        if long_codes_in_segment:
            primary_code = long_codes_in_segment[0]
            if dashed_codes_in_segment:
                secondary_code_note = f"رمز اضافي: {dashed_codes_in_segment[0]}"
            elif len(long_codes_in_segment) > 1:
                 secondary_code_note = f"رمز اضافي: {long_codes_in_segment[1]}"
        elif dashed_codes_in_segment:
            primary_code = dashed_codes_in_segment[0]
            if len(dashed_codes_in_segment) > 1:
                 secondary_code_note = f"رمز اضافي: {dashed_codes_in_segment[1]}"

        if not primary_code and segment["codes"]: # Fallback if only other numbers exist
            primary_code = segment["codes"][0]


        if primary_code:
             device_type = 'computer' # Default
             if 'جوجل بلاي' in full_text or 'android' in full_text.lower(): # Check for android hints
                 device_type = 'android'

             device_start_date_str = segment["date"]
             device_start_date = None
             if device_start_date_str:
                 try:
                    device_start_date = pd.to_datetime(device_start_date_str, errors='coerce').strftime('%Y-%m-%d')
                 except:
                    device_start_date = None # Keep as None if format is wrong

             # Track earliest start date for the customer record
             if device_start_date:
                 current_dt = pd.to_datetime(device_start_date)
                 if earliest_start_date is None or current_dt < earliest_start_date:
                     earliest_start_date = current_dt

             # Combine notes
             device_notes = segment["notes"]
             if secondary_code_note:
                 device_notes.append(secondary_code_note)

             device_record = {
                "اسم العميل": customer_data["اسم العميل"],
                "رمز التفعيل": primary_code,
                "نوع الجهاز": device_type,
                "السعر": None, # Price not found in examples
                "تاريخ بداية الاشتراك": device_start_date,
                "تاريخ نهاية الاشتراك": None, # Cannot calculate without type
                "ملاحظات": "; ".join(device_notes) if device_notes else None
             }
             device_records.append(device_record)

    # --- Finalize Customer Data ---
    # Use the earliest device start date as the customer's start date
    if earliest_start_date:
        customer_data["تاريخ بداية الاشتراك"] = earliest_start_date.strftime('%Y-%m-%d')

    # Calculate customer end date (won't work well without type)
    customer_data["تاريخ نهاية الاشتراك"] = calculate_end_date(customer_data["تاريخ بداية الاشتراك"], customer_data["نوع الاشتراك"])

    # Join customer notes list into a string
    customer_data["ملاحظات"] = "; ".join(customer_data["ملاحظات"]) if customer_data["ملاحظات"] else None


    # --- Special Case Handling for multi-owner activations like #32 ---
    if "تفعيل لصاحبه" in full_text:
        # This indicates the main contact might differ from the device owner.
        # The current logic extracts the *first* name as the primary customer.
        # The additional activations are captured as devices linked to this primary customer.
        # We need to decide if these should be separate customers or just devices under the main contact.
        # The prompt says "كل محادثة تحتوي على بيانات عميل واحد فقط".
        # Let's stick to the primary contact as the 'العميل' and list all devices under them.
        # The device notes might capture the actual owner name mentioned after "تفعيل لصاحبه".
        # Let's refine the device notes for this case.
        owner_matches = re.finditer(r'تفعيل لصاحبه\s*([\w\s]+?)\s*(?:العاشر من رمضان|وكيل فوري|\d{4}[/-]\d{1,2}[/-]\d{1,2}|\d{10,})', full_text)
        owners = [m.group(1).strip() for m in owner_matches]
        owner_index = 0
        for i, dev in enumerate(device_records):
             # Try to associate owner name if found after "تفعيل لصاحبه" and it seems related to this device
             # Heuristic: Assume order matches, or check if device code is near the owner name text
             if "تفعيل لصاحبه" in (dev.get("ملاحظات") or "") and owner_index < len(owners):
                 dev["ملاحظات"] = f"تفعيل لصاحب: {owners[owner_index]}; {dev['ملاحظات']}"
                 owner_index += 1
             elif any(owner in (dev.get("ملاحظات") or "") for owner in owners): # If owner name somehow got into notes already
                 pass # Already noted, maybe improve formatting later
             elif i > 0 and owner_index < len(owners): # If it's not the first device and owners exist
                 # Tentatively assign based on order if no clear link
                 dev["ملاحظات"] = f"تفعيل لصاحب: {owners[owner_index]}; {dev.get('ملاحظات', '')}".strip('; ')
                 owner_index+=1


    return customer_data, device_records

# قراءة البيانات من ملف JSON
import os

# الحصول على المسار المطلق للملف الحالي
current_dir = os.path.dirname(os.path.abspath(__file__))
json_path = os.path.join(current_dir, 'src', 'data', 'whatsapp_chats.json')

try:
    with open(json_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
        chat_data = data.get('chats', [])
except FileNotFoundError:
    # محاولة بديلة إذا كان المسار غير صحيح
    alternative_path = os.path.join(current_dir, 'whatsapp_chats.json')
    try:
        with open(alternative_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
            chat_data = data.get('chats', [])
    except FileNotFoundError:
        print(f"لم يتم العثور على الملف في المسار: {json_path} أو {alternative_path}")
        chat_data = []

# إنشاء ملف Excel
if chat_data:
    output_file = os.path.join(current_dir, 'whatsapp_data.xlsx')
    output_file = create_excel_file(chat_data, output_file)
    print(f"تم إنشاء ملف Excel بنجاح: {output_file}")
    
    # عرض معاينة للبيانات
    clients_data, devices_data = extract_client_data(chat_data)
    clients_df = pd.DataFrame(clients_data)
    devices_df = pd.DataFrame(devices_data)
    
    print("\n--- ورقة العملاء (أول 5 صفوف) ---")
    print(clients_df.head())
    
    print("\n--- ورقة الأجهزة (أول 5 صفوف) ---")
    print(devices_df.head())
else:
    print("لم يتم العثور على بيانات للمعالجة")

def create_excel_file(chat_data, output_file):
    all_customers_data = {} # Use dict to handle duplicates by name
    all_devices_data = []

    for item in chat_data:
        content = item.get("contents", "")
        title = item.get("title", "")
        timestamp = item.get("timestamp", None)

        customer_info, device_info_list = extract_data(content, title, timestamp)

        customer_name = customer_info.get("اسم العميل", "اسم غير معروف")

        # If customer already exists, update with non-null info? Or just keep first entry?
        # Let's keep the first entry and add devices. If new info is found later, it's complex to merge.
        # Simple approach: Only add customer if name is new.
        if customer_name != "اسم غير معروف" and customer_name not in all_customers_data:
             all_customers_data[customer_name] = customer_info
        # Handle case where name was same (e.g. #11, #12), ensure devices are added
        # Also, update customer phone/address if the new entry has more info? (Add complexity)
        elif customer_name != "اسم غير معروف" and customer_name in all_customers_data:
             # Basic update: if current entry has phone2 and stored one doesn't, add it.
             existing_customer = all_customers_data[customer_name]
             if customer_info.get("الهاتف 2") and not existing_customer.get("الهاتف 2"):
                 existing_customer["الهاتف 2"] = customer_info["الهاتف 2"]
             # Update notes? Append new notes?
             if customer_info.get("ملاحظات") and customer_info["ملاحظات"] not in (existing_customer.get("ملاحظات") or ""):
                 existing_customer["ملاحظات"] = f"{existing_customer.get('ملاحظات', '')}; {customer_info['ملاحظات']}".strip('; ')


        # Add all extracted devices, ensuring they link to the final customer name
        for device in device_info_list:
            device["اسم العميل"] = customer_name # Ensure link is correct
            all_devices_data.append(device)


    # --- Create DataFrames ---
    customers_df = pd.DataFrame(list(all_customers_data.values()))
    devices_df = pd.DataFrame(all_devices_data)

    # --- Reorder columns as requested ---
    customer_cols_ordered = [
        "اسم العميل", "اسم المؤسسة", "نوع النشاط", "الهاتف", "الهاتف 2",
        "العنوان", "ملاحظات", "نوع الاشتراك", "تاريخ بداية الاشتراك",
        "تاريخ نهاية الاشتراك"
    ]
    device_cols_ordered = [
        "اسم العميل", "رمز التفعيل", "نوع الجهاز", "السعر",
        "تاريخ بداية الاشتراك", "تاريخ نهاية الاشتراك", "ملاحظات"
    ]

    # Ensure all required columns exist, fill missing with None or NaN
    for col in customer_cols_ordered:
        if col not in customers_df.columns:
            customers_df[col] = None
    for col in device_cols_ordered:
        if col not in devices_df.columns:
            devices_df[col] = None

    customers_df = customers_df[customer_cols_ordered]
    devices_df = devices_df[device_cols_ordered]

    # --- Create Excel file in memory ---
    output = io.BytesIO()
    with pd.ExcelWriter(output, engine='xlsxwriter') as writer:
        customers_df.to_excel(writer, sheet_name='العملاء', index=False)
        devices_df.to_excel(writer, sheet_name='الأجهزة', index=False)

        # Optional: Adjust column widths for better readability
        workbook = writer.book
        customers_sheet = writer.sheets['العملاء']
        devices_sheet = writer.sheets['الأجهزة']

        for i, col in enumerate(customers_df.columns):
            column_len = max(customers_df[col].astype(str).map(len).max(), len(col)) + 2
            customers_sheet.set_column(i, i, column_len)

        for i, col in enumerate(devices_df.columns):
            column_len = max(devices_df[col].astype(str).map(len).max(), len(col)) + 2
            devices_sheet.set_column(i, i, column_len)

    # --- Save the file (or return the bytes) ---
    excel_data = output.getvalue()

    # To save to a file:
    with open(output_file, 'wb') as f:
        f.write(excel_data)
    print(f"ملف Excel '{output_file}' تم إنشاؤه بنجاح.")

    return output_file