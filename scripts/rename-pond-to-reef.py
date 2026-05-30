#!/usr/bin/env python3
"""Rebrand pond → reef across the entire source tree.

Whole-identifier replacement ONLY — never replace substrings inside
words like "respond", "correspond", "ponder", "ponds", "pondering".
Two-pass approach: first specific patterns, then generic whole-word.
"""

import os
import re
import shutil
import json
from pathlib import Path

REEF_ROOT = Path("/Users/devgwardo/reef")

# Files to rename (relative to repo root)
FILE_RENAMES = {
    "bin/pond.js": "bin/reef.js",
    "bin/pondsh.js": "bin/reefsh.js",
    "bin/pond-mcp.js": "bin/reef-mcp.js",
    "deploy/pond-host.service": "deploy/reef-host.service",
    "deploy/pond-cgroup-delegate.sh": "deploy/reef-cgroup-delegate.sh",
    "deploy/pond-cgroup-watch.service": "deploy/reef-cgroup-watch.service",
    "deploy/pond-cgroup-watch.sh": "deploy/reef-cgroup-watch.sh",
    "deploy/pond-entrypoint.sh": "deploy/reef-entrypoint.sh",
}

# Explicit text replacements — ordered, first-match-wins per position
# These are literal string replacements (not regex), applied in order
# to avoid nested-word problems.
REPLACEMENTS_LITERAL = [
    # Domain
    ("pond.run", "reef.app"),
    # Package/binary names (longest first)
    ("pond-mcp", "reef-mcp"),
    ("pondsh", "reefsh"),
    # Service/binary names
    ("pond-host", "reef-host"),
    ("pond-cgroup", "reef-cgroup"),
    ("pond-entrypoint", "reef-entrypoint"),
    # Internal variable names (camelCase compounds)
    ("pondSrcDir", "reefSrcDir"),
    ("pondNodeModulesDir", "reefNodeModulesDir"),
    # Env file
    (".env.pond.server", ".env.reef.server"),
    # Env var prefixes
    ("POND_", "REEF_"),
    # Internal DB table prefixes
    ("_pond_", "_reef_"),
    ("_POND_", "_REEF_"),
    # Route middlewares
    ("/__pond/", "/__reef/"),
    # Prometheus metrics
    ("pond_route_", "reef_route_"),
    # State dir
    (".pond", ".reef"),
    # GitHub repo
    ("DevvGwardo/pond", "DevvGwardo/reef"),
    # npm title/description etc
    ('"pond"', '"reef"'),
    ("'pond'", "'reef'"),
    ("`pond`", "`reef`"),
    # Bin entries
    ('bin/pond.js', 'bin/reef.js'),
    ('bin/pondsh.js', 'bin/reefsh.js'),
    ('bin/pond-mcp.js', 'bin/reef-mcp.js'),
]

def literal_replace(text: str) -> str:
    """Apply literal replacements in order, non-overlapping."""
    result = text
    for old, new in REPLACEMENTS_LITERAL:
        if old in result:
            result = result.replace(old, new)
    return result

def word_boundary_replace(text: str) -> str:
    """Replace whole-word 'pond' (case variants) with 'reef'.
    
    Uses lookahead/lookbehind to ensure we only match when surrounded
    by non-letter characters (including start/end of string).
    This prevents matching inside words like 'respond', 'correspond'.
    """
    # Lowercase 'pond' → 'reef'
    text = re.sub(
        r'(?<![a-zA-Z])pond(?![a-zA-Z])',
        'reef',
        text,
    )
    # Title case 'Pond' → 'Reef'
    text = re.sub(
        r'(?<![a-zA-Z])Pond(?![a-zA-Z])',
        'Reef',
        text,
    )
    # Uppercase 'POND' → 'REEF' (as standalone word)
    # Note: POND_ prefix is already handled by literal replacements
    text = re.sub(
        r'(?<![a-zA-Z])POND(?![a-zA-Z])',
        'REEF',
        text,
    )
    return text

def replace_in_file(path: Path) -> bool:
    """Apply all replacements to a file. Returns True if changed."""
    try:
        content = path.read_text(encoding='utf-8')
    except (UnicodeDecodeError, OSError):
        return False
    
    # First pass: literal replacements (specific patterns)
    new_content = literal_replace(content)
    
    # Second pass: word-boundary replacements (generic)
    new_content = word_boundary_replace(new_content)
    
    if new_content != content:
        path.write_text(new_content, encoding='utf-8')
        return True
    return False


def rename_files():
    for src_rel, dst_rel in FILE_RENAMES.items():
        src = REEF_ROOT / src_rel
        dst = REEF_ROOT / dst_rel
        if src.exists():
            dst.parent.mkdir(parents=True, exist_ok=True)
            if dst.exists():
                dst.unlink()
            src.rename(dst)
            print(f"  {src_rel} → {dst_rel}")
        else:
            print(f"  [not found] {src_rel}")

def process_all_files():
    text_extensions = {'.ts', '.tsx', '.mjs', '.js', '.json', '.md', '.txt',
                       '.sh', '.yml', '.yaml', '.css', '.html', '.nft',
                       '.service', '.example', '.dockerignore'}
    
    changed = 0
    processed = 0
    
    for root, dirs, files in os.walk(REEF_ROOT):
        # Skip excluded dirs
        rel_root = os.path.relpath(root, REEF_ROOT)
        skip_dirs = {'.git', 'node_modules', 'output', '.pond', '.reef'}
        dirs[:] = [d for d in dirs if d not in skip_dirs]
        
        if rel_root.startswith('.git') or rel_root.startswith('node_modules'):
            continue
            
        for fname in files:
            path = Path(root) / fname
            ext = path.suffix.lower()
            
            # Only process text files
            if ext not in text_extensions and fname not in ('.gitignore', '.gitattributes', '.prettierignore'):
                continue
            if fname == 'rename-pond-to-reef.py':
                continue
            if fname == 'package-lock.json':
                continue
                
            processed += 1
            if replace_in_file(path):
                changed += 1
    
    print(f"  Files scanned: {processed}")
    print(f"  Files modified: {changed}")

def post_process_verify():
    """Verify no obvious issues and fix edge cases."""
    
    # Check package.json is properly renamed
    pkg_path = REEF_ROOT / "package.json"
    if pkg_path.exists():
        pkg = json.loads(pkg_path.read_text())
        name = pkg.get("name", "")
        if "reef" not in name:
            print(f"  WARNING: package.json name may not be updated: {name}")
        else:
            print(f"  package.json name: {name}")
            if "bin" in pkg:
                print(f"  package.json bin entries: {list(pkg['bin'].keys())}")
    
    # Quick scan for remaining 'pond' in source files
    remaining = []
    for root, dirs, files in os.walk(REEF_ROOT):
        rel_root = os.path.relpath(root, REEF_ROOT)
        if rel_root.startswith('.git') or rel_root.startswith('node_modules'):
            continue
        for fname in files:
            path = Path(root) / fname
            if path.suffix not in ('.ts', '.tsx', '.mjs', '.js', '.json', '.md', '.txt', '.sh'):
                continue
            if fname == 'rename-pond-to-reef.py':
                continue
            if fname == 'package-lock.json':
                continue
            try:
                content = path.read_text(encoding='utf-8')
                for i, line in enumerate(content.split('\n'), 1):
                    if re.search(r'(?<![a-zA-Z])pond(?![a-zA-Z])', line, re.IGNORECASE):
                        remaining.append(f"{path.relative_to(REEF_ROOT)}:{i}: {line.strip()[:100]}")
            except:
                pass
    
    if remaining:
        print(f"\n  ⚠️  Remaining 'pond' references ({len(remaining)}):")
        for r in remaining[:20]:
            print(f"    {r}")
        if len(remaining) > 20:
            print(f"    ... and {len(remaining)-20} more")
    else:
        print(f"  ✅ No remaining 'pond' references found")

def main():
    print("=== Renaming files ===")
    rename_files()
    
    print("\n=== Replacing content ===")
    process_all_files()
    
    print("\n=== Post-processing verification ===")
    post_process_verify()
    
    print("\nDone!")

if __name__ == "__main__":
    main()
