import csv
import os

def clean_val(val):
    if val is None or val.strip().lower() == 'null' or val.strip() == '':
        return 'NULL'
    # Escape single quotes
    return "'" + val.replace("'", "''") + "'"

def format_date(val):
    if val is None or val.strip().lower() == 'null' or val.strip() == '':
        return 'NULL'
    # Truncate to date part if it's a timestamp
    return "'" + val.strip().split(' ')[0] + "'"

def generate_batches(csv_path, table_name, columns_mapping, batch_size=500):
    if not os.path.exists(csv_path):
        print(f"File not found: {csv_path}")
        return
    
    with open(csv_path, mode='r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        rows = list(reader)
    
    total = len(rows)
    for i in range(0, total, batch_size):
        batch = rows[i:i+batch_size]
        file_index = i // batch_size
        output_file = f"import_{table_name}_{file_index}.sql"
        
        target_cols = [m['target'] for m in columns_mapping]
        sql = f"INSERT INTO {table_name} ({', '.join(target_cols)}) VALUES\n"
        
        values = []
        for row in batch:
            v_list = []
            for m in columns_mapping:
                raw_val = row.get(m['source'])
                if m.get('type') == 'date':
                    v_list.append(format_date(raw_val))
                else:
                    v_list.append(clean_val(raw_val))
            values.append(f"({', '.join(v_list)})")
        
        sql += ",\n".join(values)
        
        # Build DO UPDATE clause
        update_clauses = [f"{col} = EXCLUDED.{col}" for col in target_cols if col != 'id']
        sql += f"\nON CONFLICT (id) DO UPDATE SET\n  {', '.join(update_clauses)};"
        
        with open(output_file, "w", encoding="utf-8") as f_out:
            f_out.write(sql)
        print(f"Generated {output_file} ({len(batch)} rows)")

if __name__ == "__main__":
    base_path = r"f:\Ai Local\mshre3\MicroSUB MicroPOS V1\قاعدة البيانات"
    
    # 1. Agents
    agents_map = [
        {'source': 'id', 'target': 'id'},
        {'source': 'created_at', 'target': 'created_at'},
        {'source': 'email', 'target': 'email'},
        {'source': 'name', 'target': 'name'},
        {'source': 'role', 'target': 'role'},
        {'source': 'password', 'target': 'password'},
        {'source': 'approval_status', 'target': 'approval_status'},
        {'source': 'phone', 'target': 'phone'},
        {'source': 'address', 'target': 'address'},
        {'source': 'created_by', 'target': 'created_by'},
    ]
    generate_batches(os.path.join(base_path, "agents_rows.csv"), "public.agents", agents_map)
    
    # 2. Clients
    clients_map = [
        {'source': 'id', 'target': 'id'},
        {'source': 'created_at', 'target': 'created_at'},
        {'source': 'client_name', 'target': 'client_name'},
        {'source': 'organization_name', 'target': 'organization_name'},
        {'source': 'activity_type', 'target': 'activity_type'},
        {'source': 'phone', 'target': 'phone'},
        {'source': 'phone2', 'target': 'phone2'},
        {'source': 'address', 'target': 'address'},
        {'source': 'notes', 'target': 'notes'},
        {'source': 'agent_id', 'target': 'agent_id'},
        {'source': 'subscription_type', 'target': 'subscription_type'},
        {'source': 'subscription_start', 'target': 'subscription_start', 'type': 'date'},
        {'source': 'subscription_end', 'target': 'subscription_end', 'type': 'date'},
        {'source': 'active_devices_count', 'target': 'active_devices_count'},
        {'source': 'device_count', 'target': 'device_count'},
        {'source': 'created_by', 'target': 'created_by'},
    ]
    generate_batches(os.path.join(base_path, "clients_rows.csv"), "public.clients", clients_map, batch_size=500)
    
    # 3. Devices
    devices_map = [
        {'source': 'id', 'target': 'id'},
        {'source': 'client_id', 'target': 'client_id'},
        {'source': 'activation_code', 'target': 'activation_code'},
        {'source': 'device_type', 'target': 'device_type'},
        {'source': 'subscription_start', 'target': 'subscription_start', 'type': 'date'},
        {'source': 'subscription_end', 'target': 'subscription_end', 'type': 'date'},
        {'source': 'price', 'target': 'price'},
        {'source': 'approval_status', 'target': 'approval_status'},
        {'source': 'approval_date', 'target': 'approval_date'},
        {'source': 'approved_by', 'target': 'approved_by'},
        {'source': 'rejection_reason', 'target': 'rejection_reason'},
        {'source': 'email', 'target': 'email'},
        {'source': 'notes', 'target': 'notes'},
        {'source': 'created_at', 'target': 'created_at'},
        {'source': 'updated_at', 'target': 'updated_at'},
        {'source': 'subscription_type', 'target': 'subscription_type'},
    ]
    generate_batches(os.path.join(base_path, "devices_rows.csv"), "public.devices", devices_map, batch_size=500)
