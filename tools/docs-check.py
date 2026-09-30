"""Checks the docs set: relative links, heading anchors, en/zh mirror parity.

Usage: python tools/docs-check.py
Exit code 0 means every link resolves and each English page has a zh-CN mirror
with the same heading structure.
"""
import io
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DOCS = os.path.join(ROOT, 'docs')
problems = []


def read(path):
    with io.open(path, 'r', encoding='utf-8-sig') as handle:
        return handle.read()


def slug(text):
    text = text.strip().lower()
    text = re.sub(r'[^\w\s-]', '', text, flags=re.UNICODE)
    return re.sub(r'\s+', '-', text)


def headings(text):
    return [(len(m.group(1)), m.group(2).strip())
            for m in re.finditer(r'^(#{1,6})[ \t]+(\S.*)$', text, re.M)]


def in_fence(text):
    mask = []
    inside = False
    for line in text.splitlines():
        if line.strip().startswith('```'):
            inside = not inside
        mask.append(inside)
    return mask


LINK = re.compile(r'\[[^\]]*\]\(([^)\s]+)')
files = [os.path.join(ROOT, 'README.md')]
for base, _dirs, names in os.walk(DOCS):
    files += [os.path.join(base, name) for name in names if name.endswith('.md')]
files.sort()
anchors = {os.path.normpath(p).lower(): [slug(t) for _lvl, t in headings(read(p))] for p in files}

for path in files:
    rel = os.path.relpath(path, ROOT).replace('\\', '/')
    mask = in_fence(read(path))
    for lineno, line in enumerate(read(path).splitlines()):
        if mask[lineno]:
            continue
        for target in LINK.findall(line):
            if target.startswith(('http', 'mailto:')):
                continue
            frag = ''
            if '#' in target:
                target, frag = target.split('#', 1)
            resolved = path if not target else \
                os.path.normpath(os.path.join(os.path.dirname(path), target))
            if not os.path.exists(resolved):
                problems.append('%s:%d: broken link %s' % (rel, lineno + 1, ascii(target)))
            elif frag and resolved.endswith('.md') \
                    and slug(frag) not in anchors.get(os.path.normpath(resolved).lower(), []):
                problems.append('%s:%d: anchor %s missing in %s'
                                % (rel, lineno + 1, ascii('#' + frag), target))

en = {n for n in os.listdir(DOCS) if n.endswith('.md')}
zh = {n for n in os.listdir(os.path.join(DOCS, 'zh-CN')) if n.endswith('.md')}
for name in sorted(en - zh):
    problems.append('docs/%s has no zh-CN mirror' % name)
for name in sorted(zh - en):
    problems.append('docs/zh-CN/%s has no English counterpart' % name)

for name in sorted(en & zh):
    en_h = headings(read(os.path.join(DOCS, name)))
    zh_h = headings(read(os.path.join(DOCS, 'zh-CN', name)))
    for level in range(1, 7):
        en_c = sum(1 for lvl, _t in en_h if lvl == level)
        zh_c = sum(1 for lvl, _t in zh_h if lvl == level)
        if en_c != zh_c:
            problems.append('%s: level-%d heading count %d (en) vs %d (zh)'
                            % (name, level, en_c, zh_c))

print('docs pages: %d' % len(files))
if problems:
    print('%d issue(s)' % len(problems))
    for p in problems:
        print('  ' + p)
    sys.exit(1)
print('docs check: 0 issues')
