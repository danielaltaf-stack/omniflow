#!/usr/bin/env python3
"""
Patch woob cragr module: add 'default=' to ALL Dict() calls
in get_main_account & iter_accounts classes to survive incomplete bank JSON.

Uses regex so it works regardless of single/double quotes in woob source.
"""

import re
import sys

path = "/root/.local/share/woob/modules/3.7/woob_modules/cragr/pages.py"

with open(path) as f:
    content = f.read()

original = content

# ── Fields that need default="" (strings) ──
string_fields = [
    # get_main_account (comptePrincipal/ prefix)
    "comptePrincipal/libelleUsuelProduit",
    "comptePrincipal/libelleProduit",
    "comptePrincipal/libellePartenaireBam",
    "comptePrincipal/rolePartenaireCalcule",
    "comptePrincipal/idElementContrat",
    "comptePrincipal/codeFamilleProduitBam",
    "comptePrincipal/codeFamilleContratBam",
    # iter_accounts (no prefix)
    "codeFamilleProduitBam",
    "codeFamilleContratBam",
    "libelleUsuelProduit",
    "libelleProduit",
    "libellePartenaireBam",
    "rolePartenaireCalcule",
    "idElementContrat",
    "numeroCompte",
]

# Fields that need default="EUR"
eur_fields = [
    "comptePrincipal/idDevise",
    "idDevise",
]

# Fields that need default=0 (integers)
int_fields = [
    "comptePrincipal/index",
    "index",
]

patched = 0

# Patch string fields → default=""
for field in string_fields:
    # Match Dict('field') or Dict("field") that do NOT already have 'default'
    pattern = rf'''Dict\((['"]){re.escape(field)}\1\)'''
    if not re.search(pattern, content):
        continue
    # Only replace if 'default' is not already present
    check = rf'''Dict\((['"]){re.escape(field)}\1,\s*default='''
    if re.search(check, content):
        continue
    replacement = rf'Dict(\1{field}\1, default="")'
    content, n = re.subn(pattern, replacement, content)
    if n:
        patched += n
        print(f"  [str]  {field}: {n} replacement(s)")

# Patch EUR fields → default="EUR"
for field in eur_fields:
    pattern = rf'''Dict\((['"]){re.escape(field)}\1\)'''
    if not re.search(pattern, content):
        continue
    check = rf'''Dict\((['"]){re.escape(field)}\1,\s*default='''
    if re.search(check, content):
        continue
    replacement = rf'Dict(\1{field}\1, default="EUR")'
    content, n = re.subn(pattern, replacement, content)
    if n:
        patched += n
        print(f"  [eur]  {field}: {n} replacement(s)")

# Patch int fields → default=0
for field in int_fields:
    pattern = rf'''Dict\((['"]){re.escape(field)}\1\)'''
    if not re.search(pattern, content):
        continue
    check = rf'''Dict\((['"]){re.escape(field)}\1,\s*default='''
    if re.search(check, content):
        continue
    replacement = rf'Dict(\1{field}\1, default=0)'
    content, n = re.subn(pattern, replacement, content)
    if n:
        patched += n
        print(f"  [int]  {field}: {n} replacement(s)")

# Write patched file
with open(path, "w") as f:
    f.write(content)

# Verify: find any remaining Dict('comptePrincipal/...') without default
with open(path) as f:
    text = f.read()

remaining = re.findall(
    r"Dict\(['\"](?:comptePrincipal/)?(\w+)['\"](?:\))",
    text,
)
# Filter to only our known fields
known = set(f.split("/")[-1] for f in string_fields + eur_fields + int_fields)
unpatched = [f for f in remaining if f in known]
if unpatched:
    print(f"WARNING: {len(unpatched)} field(s) still unpatched: {unpatched}")

print(f"\nPatched {patched} Dict() calls. Done.")
