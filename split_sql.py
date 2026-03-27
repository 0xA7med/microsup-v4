import os

def split_sql_file(filename, chunk_size=50):
    with open(filename, 'r', encoding='utf-8') as f:
        lines = f.readlines()
    
    if len(lines) < 3:
        return
    
    header = lines[0]  # INSERT INTO ... VALUES
    footer = lines[-1] # ON CONFLICT ...;
    data_lines = lines[1:-1]
    
    base_name = os.path.splitext(filename)[0]
    
    for i in range(0, len(data_lines), chunk_size):
        part_num = i // chunk_size
        chunk = data_lines[i:i + chunk_size]
        
        # Ensure each line (except the last one in the chunk) ends with a comma
        # And the last one ends correctly
        # The generated SQL files already have lines ending with a comma and newline
        
        # We need to make sure the last line in the chunk ends with a semicolon or we use the footer
        # Actually, the footer is a separate statement in my case?
        # Let's check the footer format in import_public.clients_0.sql
        
        # Footer is: ON CONFLICT (id) DO NOTHING;
        # But for PostgreSQL INSERT ... VALUES (...), (...);
        # we need the ON CONFLICT to be part of the same statement.
        
        chunk_content = "".join(chunk).strip()
        if chunk_content.endswith(','):
            chunk_content = chunk_content[:-1] # Remove trailing comma
        
        new_filename = f"{base_name}_part{part_num}.sql"
        with open(new_filename, 'w', encoding='utf-8') as f:
            f.write(header)
            f.write(chunk_content)
            f.write("\n" + footer)
            
    print(f"Split {filename} into {part_num + 1} parts.")

# Split all batch files
for i in range(8):
    split_sql_file(f"import_public.clients_{i}.sql")

for i in range(11):
    split_sql_file(f"import_public.devices_{i}.sql")
