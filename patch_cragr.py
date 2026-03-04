#!/usr/bin/env python3
"""Patch woob cragr module: add defaults for all optional JSON fields
in get_main_account and iter_accounts to handle incomplete bank JSON."""

path = "/root/.local/share/woob/modules/3.7/woob_modules/cragr/pages.py"

with open(path) as f:
    content = f.read()

# ──── get_main_account: comptePrincipal/* fields ────

replacements = [
    # obj_type uses libelleUsuelProduit (appears twice: in Map and in logger)
    ('Dict("comptePrincipal/libelleUsuelProduit"))', 'Dict("comptePrincipal/libelleUsuelProduit", default=""))'),
    # obj_label uses libelleProduit and libellePartenaireBam
    ('Dict("comptePrincipal/libelleProduit"))', 'Dict("comptePrincipal/libelleProduit", default=""))'),
    ('Dict("comptePrincipal/libellePartenaireBam"))', 'Dict("comptePrincipal/libellePartenaireBam", default=""))'),
    # obj_currency
    ('Dict("comptePrincipal/idDevise"))', 'Dict("comptePrincipal/idDevise", default="EUR"))'),
    # obj_ownership
    ('Dict("comptePrincipal/rolePartenaireCalcule"))', 'Dict("comptePrincipal/rolePartenaireCalcule", default=""))'),
    # obj__index
    ('obj__index = Dict("comptePrincipal/index")', 'obj__index = Dict("comptePrincipal/index", default=0)'),
    # obj__id_element_contrat
    ('Dict("comptePrincipal/idElementContrat"))', 'Dict("comptePrincipal/idElementContrat", default=""))'),
    # codeFamilleProduitBam / codeFamilleContratBam (main account)
    ('Dict("comptePrincipal/codeFamilleProduitBam")', 'Dict("comptePrincipal/codeFamilleProduitBam", default="")'),
    ('Dict("comptePrincipal/codeFamilleContratBam")', 'Dict("comptePrincipal/codeFamilleContratBam", default="")'),

    # ──── iter_accounts: non-prefixed fields ────
    ('Dict("codeFamilleProduitBam"))', 'Dict("codeFamilleProduitBam", default=""))'),
    ('Dict("codeFamilleContratBam"))', 'Dict("codeFamilleContratBam", default=""))'),
    # libelleUsuelProduit in iter_accounts (obj_type condition + Map + logger)
    ('Dict("libelleUsuelProduit"))', 'Dict("libelleUsuelProduit", default=""))'),
    # libelleProduit in iter_accounts (obj_label + obj_type MANDAT CTO check)
    ('Dict("libelleProduit"))', 'Dict("libelleProduit", default=""))'),
    # libellePartenaireBam in iter_accounts (obj_label)
    ('Dict("libellePartenaireBam"))', 'Dict("libellePartenaireBam", default=""))'),
    # idDevise in iter_accounts
    ('Dict("idDevise"))', 'Dict("idDevise", default="EUR"))'),
    # rolePartenaireCalcule in iter_accounts
    ('Dict("rolePartenaireCalcule"))', 'Dict("rolePartenaireCalcule", default=""))'),
    # index in iter_accounts
    ('obj__index = Dict("index")', 'obj__index = Dict("index", default=0)'),
    # idElementContrat in iter_accounts
    ('Dict("idElementContrat"))', 'Dict("idElementContrat", default=""))'),
    # numeroCompte in iter_accounts
    ('Dict("numeroCompte"))', 'Dict("numeroCompte", default=""))'),
]

patched = 0
for old, new in replacements:
    if old in content:
        content = content.replace(old, new)
        patched += 1

with open(path, "w") as f:
    f.write(content)

# Verify
with open(path) as f:
    text = f.read()

# Check for any Dict("field") without default in the file
import re
missing = re.findall(r'Dict\("([^"]+)"\)(?!.*default)', text)
print(f"Patched {patched} replacements.")
print("Done.")

print(f"Patched {patched} replacements. Done.")
