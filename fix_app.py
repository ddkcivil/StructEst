#!/usr/bin/env python3
with open(r'c:\\Users\\LENOVO\\Videos\\python\\structest-pro\\src\\App.tsx', 'r') as f:
    lines = f.readlines()

# Remove lines 282-311 (0-indexed: 281-310)
# Keep lines 1-281 and lines 312+
new_lines = lines[:281] + lines[311:]

with open(r'c:\\Users\\LENOVO\\Videos\\python\\structest-pro\\src\\App.tsx', 'w') as f:
    f.writelines(new_lines)

print(f"Removed {311-281} lines, file now has {len(new_lines)} lines")