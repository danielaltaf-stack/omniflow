"""
Runtime patch for woob cragr module — DEFINITIVE FIX.

The build-time file patch (patch_cragr.py) modifies the .py source on disk,
but Python uses pre-compiled .pyc bytecode cached from the Docker woob-init
stage.  The .pyc was created BEFORE the patch, so the patch is silently
ignored at runtime.

This module provides TWO complementary fixes:

1. **monkey_patch_woob_dict()** — modifies the live Dict class IN MEMORY.
   This is immune to .pyc caching because it changes the Python class object
   directly, not a file on disk.

2. **patch_cragr_pages()** — file-based patch kept as a belt-and-suspenders
   fallback.  Also deletes .pyc files so the next import picks up the
   patched .py source.
"""

import glob
import logging
import os
import re
import shutil

logger = logging.getLogger("omniflow.patch")

_MONKEY_PATCHED = False
_FILE_PATCHED = False


# ═══════════════════════════════════════════════════════════════════
# FIX 1 — In-memory monkey-patch (the definitive one)
# ═══════════════════════════════════════════════════════════════════

def monkey_patch_woob_dict() -> bool:
    """
    Monkey-patch woob's ``Dict.filter`` IN MEMORY so that missing JSON keys
    return ``""`` instead of raising ``ItemNotFound``.

    This is the definitive fix for the Crédit Agricole error::

        Element ['comptePrincipal', 'codeFamilleProduitBam'] not found

    Unlike file-based patches, this works regardless of .pyc bytecode
    caching because it modifies the live Python class object.
    """
    global _MONKEY_PATCHED
    if _MONKEY_PATCHED:
        return False

    try:
        from woob.browser.filters.json import Dict  # type: ignore
    except ImportError:
        logger.debug("[monkey-patch] woob not installed — skipping Dict patch")
        return False

    # Import ItemNotFound — try multiple paths for different woob versions
    ItemNotFound = None
    for mod_path, attr in [
        ("woob.browser.filters.base", "ItemNotFound"),
        ("woob.exceptions", "ItemNotFound"),
        ("woob.browser.filters.base", "FilterError"),
    ]:
        try:
            mod = __import__(mod_path, fromlist=[attr])
            ItemNotFound = getattr(mod, attr)
            break
        except (ImportError, AttributeError):
            continue

    if ItemNotFound is None:
        ItemNotFound = Exception  # ultimate fallback

    original_filter = Dict.filter

    def safe_filter(self, value):
        """Wrapped Dict.filter: returns '' on missing key instead of crashing."""
        try:
            return original_filter(self, value)
        except ItemNotFound:
            sel = "/".join(self.selector) if hasattr(self, "selector") else "?"
            logger.debug("[monkey-patch] Dict('%s') → key missing, returning ''", sel)
            return ""

    Dict.filter = safe_filter
    _MONKEY_PATCHED = True
    logger.info(
        "[monkey-patch] woob Dict.filter patched — missing JSON keys "
        "now return '' instead of raising ItemNotFound"
    )
    return True


# ═══════════════════════════════════════════════════════════════════
# FIX 2 — File-based patch (belt-and-suspenders fallback)
# ═══════════════════════════════════════════════════════════════════

def patch_cragr_pages() -> bool:
    """
    Find and patch cragr/pages.py at runtime.
    Also deletes .pyc caches so the patched .py source takes effect.
    Returns True if patches were applied, False if already patched or not found.
    """
    global _FILE_PATCHED
    if _FILE_PATCHED:
        return False

    # Auto-discover cragr/pages.py
    search_bases = [
        os.path.expanduser("~/.local/share/woob/modules"),
        "/root/.local/share/woob/modules",
        "/home/appuser/.local/share/woob/modules",
    ]

    path = None
    for base in search_bases:
        candidates = glob.glob(os.path.join(base, "*/woob_modules/cragr/pages.py"))
        if candidates:
            path = candidates[0]
            break

    if not path:
        logger.debug("[patch_cragr] cragr/pages.py not found — skipping file patch")
        return False

    try:
        with open(path) as f:
            content = f.read()
    except Exception as e:
        logger.warning("[patch_cragr] Cannot read %s: %s", path, e)
        return False

    # ── Patch ALL Dict('field') or Dict("field") without default= ──
    patches = [0]  # mutable counter for closure

    def _add_default(m):
        quote = m.group(1)
        field = m.group(2)
        patches[0] += 1
        return f'Dict({quote}{field}{quote}, default="")'

    pattern = re.compile(r'''Dict\((['"])([^'"]+)\1\)(?!\s*#.*default)''')

    new_content = []
    last_end = 0
    for m in pattern.finditer(content):
        start, end = m.start(), m.end()
        new_content.append(content[last_end:start])
        new_content.append(_add_default(m))
        last_end = end
    new_content.append(content[last_end:])
    new_content = "".join(new_content)

    count = patches[0]
    if count > 0:
        try:
            with open(path, "w") as f:
                f.write(new_content)
            logger.info("[patch_cragr] File-patched %d Dict() calls in %s", count, path)
        except PermissionError:
            logger.warning("[patch_cragr] Cannot write %s (permission denied)", path)
            return False

        # ── Delete ALL .pyc / __pycache__ for cragr so Python re-reads .py ──
        cragr_dir = os.path.dirname(path)
        for root, dirs, files in os.walk(cragr_dir):
            for d in dirs:
                if d == "__pycache__":
                    cache_dir = os.path.join(root, d)
                    try:
                        shutil.rmtree(cache_dir)
                        logger.info("[patch_cragr] Deleted bytecode cache: %s", cache_dir)
                    except Exception:
                        pass
    else:
        logger.debug("[patch_cragr] cragr/pages.py already fully patched")

    _FILE_PATCHED = True
    return count > 0


# ═══════════════════════════════════════════════════════════════════
# Combined entry point
# ═══════════════════════════════════════════════════════════════════

def apply_all_cragr_patches() -> None:
    """Apply both the in-memory monkey-patch AND the file-based patch."""
    monkey_patch_woob_dict()   # ← the one that actually works
    patch_cragr_pages()        # ← belt-and-suspenders fallback
