#!/usr/bin/env python3
"""
Patch woob cragr module: add 'default=' to ALL Dict() calls
in get_main_account & iter_accounts classes to survive incomplete bank JSON.

Auto-detects woob modules path. Uses regex for quote-agnostic matching.
Falls back to a nuclear approach: patch EVERY Dict() without default.
"""

import glob
import os
import re
import sys

# ── Auto-detect woob cragr pages.py path ──
WOOB_BASE = os.path.expanduser("~/.local/share/woob/modules")
candidates = glob.glob(os.path.join(WOOB_BASE, "*/woob_modules/cragr/pages.py"))
if not candidates:
    # Try alternate locations
    for alt_base in [
        "/root/.local/share/woob/modules",
        "/home/appuser/.local/share/woob/modules",
    ]:
        candidates = glob.glob(os.path.join(alt_base, "*/woob_modules/cragr/pages.py"))
        if candidates:
            break

if not candidates:
    print("ERROR: cragr/pages.py not found! Searched in:")
    print(f"  {WOOB_BASE}/*/woob_modules/cragr/pages.py")
    # List what's actually there
    if os.path.isdir(WOOB_BASE):
        for d in os.listdir(WOOB_BASE):
            print(f"  Found: {WOOB_BASE}/{d}/")
    sys.exit(1)

path = candidates[0]
print(f"Found cragr pages.py: {path}")

with open(path) as f:
    content = f.read()

original = content
print(f"File size: {len(content)} bytes")

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
eur_fields = [
    "comptePrincipal/idDevise",
    "idDevise",
]
int_fields = [
    "comptePrincipal/index",
    "index",
]

patched = 0

def patch_field(field, default_val):
    """Patch a Dict('field') or Dict("field") to add default=value."""
    global content, patched
    escaped = re.escape(field)
    # Match Dict('field') or Dict("field") — NOT already having default
    pattern = rf"Dict\((['\"]){escaped}\1\)"
    already = rf"Dict\((['\"]){escaped}\1,\s*default="
    if re.search(already, content):
        print(f"  [skip] {field}: already has default")
        return
    matches = re.findall(pattern, content)
    if not matches:
        print(f"  [miss] {field}: no match found")
        return
    replacement = rf"Dict(\1{field}\1, default={default_val})"
    content, n = re.subn(pattern, replacement, content)
    if n:
        patched += n
        print(f"  [ok]   {field}: {n} replacement(s)")

# Apply targeted patches
print("\n── Targeted patching ──")
for field in string_fields:
    patch_field(field, '""')
for field in eur_fields:
    patch_field(field, '"EUR"')
for field in int_fields:
    patch_field(field, '0')

# ── NUCLEAR FALLBACK: catch ANY remaining Dict() without default ──
# This catches fields we missed or new fields added in future woob updates.
print("\n── Nuclear fallback: patching all remaining Dict() without default ──")

# Pattern: Dict('some/path') or Dict("some/path") without , default=
# We add default="" to all of them
nuclear_pattern = r"Dict\((['\"])([^'\"]+)\1\)"
nuclear_already = r"Dict\((['\"])([^'\"]+)\1,\s*default="

for match in re.finditer(nuclear_pattern, content):
    full_match = match.group(0)
    quote = match.group(1)
    field_name = match.group(2)
    
    # Skip if it already has default
    check_str = f"Dict({quote}{field_name}{quote}, default="
    if check_str in content:
        continue
    
    # Check if this specific occurrence still exists (wasn't already replaced)
    if full_match not in content:
        continue
    
    old = f"Dict({quote}{field_name}{quote})"
    new = f"Dict({quote}{field_name}{quote}, default=\"\")"
    content = content.replace(old, new, 1)
    patched += 1
    print(f"  [nuke] {field_name}: added default=\"\"")

# Write patched file
with open(path, "w") as f:
    f.write(content)

# ── Verification ──
print("\n── Verification ──")
with open(path) as f:
    text = f.read()

# Find any Dict() still without default
remaining = re.findall(r"Dict\(['\"][^'\"]+['\"](?:\))", text)
if remaining:
    print(f"WARNING: {len(remaining)} Dict() calls still without default:")
    for r in remaining[:10]:
        print(f"  {r}")
else:
    print("All Dict() calls now have defaults.")

changed = content != original
print(f"\nTotal patches: {patched}. File {'modified' if changed else 'UNCHANGED'}.")
