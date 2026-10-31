#!/usr/bin/env python3
import os

path = r'c:\Users\LENOVO\Videos\python\structest-pro\src\App.tsx'
with open(path, 'r', encoding='utf8') as f:
    content = f.read()

# Fix 1: Replace | 'f work' with | 'Formwork' in the type definition
content = content.replace("| 'f work", "| 'Formwork")

# Fix 2: Replace { name: 'f work with { name: 'Formwork' in PREDEFINED_CATEGORIES
content = content.replace("{ name: 'f work", "{ name: 'Formwork")

with open(path, 'w', encoding='utf8') as f:
    f.write(content)

print('Done fixing categories')