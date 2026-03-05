"""
Runtime patch for woob cragr module.
Adds default= to ALL Dict() calls in cragr/pages.py that don't have one.
Runs at app startup so it works even if the Docker build-time patch failed.

This is a safety net — the Dockerfile also applies patch_cragr.py at build time.
"""

import glob
import logging
import os
import re

logger = logging.getLogger("omniflow.patch")

_PATCHED = False


def patch_cragr_pages() -> bool:
    """
    Find and patch cragr/pages.py at runtime.
    Returns True if patches were applied, False if already patched or not found.
    """
    global _PATCHED
    if _PATCHED:
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
        logger.debug("[patch_cragr] cragr/pages.py not found — skipping runtime patch")
        return False

    try:
        with open(path) as f:
            content = f.read()
    except Exception as e:
        logger.warning("[patch_cragr] Cannot read %s: %s", path, e)
        return False

    original = content

    # ── Patch ALL Dict('field') or Dict("field") without default= ──
    # Strategy: use re.sub with a callback that checks context
    patches = [0]  # mutable counter for closure

    def _add_default(m):
        """Add default="" to a Dict() call if it doesn't already have one."""
        quote = m.group(1)
        field = m.group(2)
        patches[0] += 1
        return f'Dict({quote}{field}{quote}, default="")'

    # Match Dict('field') or Dict("field") but NOT Dict('field', default=...)
    # Negative lookahead: not followed by comma+default
    pattern = re.compile(r'''Dict\((['"])([^'"]+)\1\)(?!\s*#.*default)''')

    # First pass: check which ones DON'T already have default
    new_content = []
    last_end = 0
    for m in pattern.finditer(content):
        # Verify this Dict() doesn't already have default= somewhere
        # (our pattern already ensures the closing ) is right after the field)
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
            logger.info(
                "[patch_cragr] Runtime patched %d Dict() calls in %s",
                count, path,
            )
        except PermissionError:
            logger.warning(
                "[patch_cragr] Cannot write %s (permission denied). "
                "Dict() calls not patched — bank sync may fail for Crédit Agricole.",
                path,
            )
            return False
    else:
        logger.debug("[patch_cragr] cragr/pages.py already fully patched")

    _PATCHED = True
    return patches > 0
