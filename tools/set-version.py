"""Cut a release: promote the Unreleased changelog section to <version> everywhere.

    python tools/set-version.py 0.2.0 [--date 2026/10/1] [--keep 5] [--dry-run]

Single source of truth is the pair of changelogs (docs/CHANGELOG.md and
docs/zh-CN/CHANGELOG.md): the English file supplies the wording, the Chinese file
supplies the interface strings, and the two must have the same number of bullets
per section. Everything else is derived from them here:

  app.core.js            const VERSION
  index.html             the About dialog's release block (newest --keep shown)
  app.lang.js            English for that block's header and bullets
  docs/CHANGELOG.md      Unreleased -> v<version>
  docs/zh-CN/CHANGELOG.md  未发布 -> v<version>
  docs/README.md, docs/zh-CN/README.md   the "current version" line
  docs/data-formats.md, zh-CN            the appVersion example

Nothing is committed; review the diff, then tag. build-release.py refuses to
build when VERSION and the top changelog section disagree.
"""
import argparse
import datetime
import io
import re
import sys

CHANGELOG_EN = 'docs/CHANGELOG.md'
CHANGELOG_ZH = 'docs/zh-CN/CHANGELOG.md'
UNRELEASED = ('Unreleased', u'未发布')
VERSION_RE = r'\d+\.\d+\.\d+'
BULLET = re.compile(r'^- (.*)$')
BLOCK = re.compile(r'[ \t]*<div class="version-release">.*?</ul>\s*</div>\s*\n', re.S)
LANG_MARKER = u'/* Changelog: feature blurbs per release */'


def read(path):
    return io.open(path, encoding='utf-8').read()


def write(path, text, dry_run):
    action = 'would write' if dry_run else 'wrote'
    print('%s %s' % (action, path))
    if not dry_run:
        io.open(path, 'w', encoding='utf-8', newline='\n').write(text)


def sections(text):
    """[(title, body_lines)] for every `## ` section, in order."""
    out = []
    title = None
    body = []
    for line in text.splitlines():
        if line.startswith('## '):
            if title is not None:
                out.append((title, body))
            title = line[3:].strip()
            body = []
        elif title is not None:
            body.append(line)
    if title is not None:
        out.append((title, body))
    return out


def bullets(body):
    """Fold wrapped `- ` bullets into single lines."""
    out = []
    current = None
    for line in body:
        match = BULLET.match(line)
        if match:
            if current is not None:
                out.append(' '.join(current.split()))
            current = match.group(1)
        elif current is not None and line.strip():
            current += ' ' + line.strip()
    if current is not None:
        out.append(' '.join(current.split()))
    return out


def unreleased_bullets(text, label):
    wanted = u'/'.join(UNRELEASED)
    for title, body in sections(text):
        if title in UNRELEASED:
            found = bullets(body)
            if not found:
                raise SystemExit('%s has an empty "%s" section' % (label, title))
            return found
    raise SystemExit('no "%s" section in %s' % (wanted, label))


def plain(markdown):
    """Changelog markdown -> the flat sentence a dialog line or dictionary key needs."""
    text = re.sub(r'\[([^\]]*)\]\([^)]*\)', r'\1', markdown)
    text = re.sub(r'\*\*([^*]*)\*\*', r'\1', text)
    text = text.replace('`', '')
    return ' '.join(text.split())


def escape(text):
    return text.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')


def js_string(text):
    return text.replace('\\', '\\\\').replace("'", "\\'")


def promote_unreleased(path, version, date, dry_run):
    text = read(path)
    pattern = re.compile(r'^## (?:%s)$' % '|'.join(UNRELEASED), re.M)
    if not pattern.search(text):
        raise SystemExit('no Unreleased heading in %s' % path)
    if re.search(r'^## v%s ' % version, text, re.M):
        print('  %s already has a v%s section' % (path, version))
        return
    write(path, pattern.sub('## v%s — %s' % (version, date), text, count=1), dry_run)


def set_core_version(version, dry_run):
    path = 'app.core.js'
    text = read(path)
    pattern = re.compile(r"(const VERSION = ')[0-9][0-9.]*(';)")
    if not pattern.search(text):
        raise SystemExit('no VERSION constant in app.core.js')
    write(path, pattern.sub(r'\g<1>%s\g<2>' % version, text, count=1), dry_run)


def set_dialog_block(version, date, zh_lines, en_lines, keep, dry_run):
    path = 'index.html'
    text = read(path)
    short_date = '/'.join([date.split('/')[0][2:], date.split('/')[1], date.split('/')[2]])
    header = u'v%s 版本 · %s' % (version, short_date)
    en_header = u'v%s · %s' % (version, short_date)
    if u'>%s<' % header in text:
        raise SystemExit('index.html already shows %s' % ascii(header))
    block = [u'          <div class="version-release">',
             u'            <strong>%s</strong>' % escape(header),
             u'            <ul>']
    block += [u'              <li>%s</li>' % escape(line) for line in zh_lines]
    block += [u'            </ul>', u'          </div>', '']
    new_block = u'\n'.join(block)

    anchor = re.compile(r'(<div class="version-changelog-title">[^<]*</div>\s*\n)')
    match = anchor.search(text)
    if not match:
        raise SystemExit('no version-changelog-title anchor in index.html')
    text = text[:match.end()] + new_block + text[match.end():]

    found = list(BLOCK.finditer(text))
    dropped = 0
    for extra in found[keep:][::-1]:
        text = text[:extra.start()] + text[extra.end():]
        dropped += 1
    write(path, text, dry_run)
    if dropped:
        print('  trimmed %d oldest release block(s) from the dialog' % dropped)
    return header, en_header


def set_dictionary(header, en_header, zh_lines, en_lines, dry_run):
    path = 'app.lang.js'
    text = read(path)
    if u"'%s':" % js_string(header) in text:
        print('  app.lang.js already translates this release')
        return
    marker = re.compile(r'([ \t]*%s\n)' % re.escape(LANG_MARKER))
    match = marker.search(text)
    if not match:
        raise SystemExit('no changelog marker in app.lang.js')
    lines = [u"    '%s': '%s'," % (js_string(header), js_string(en_header))]
    for zh, en in zip(zh_lines, en_lines):
        if zh == en:
            continue
        lines.append(u"    '%s': '%s'," % (js_string(zh), js_string(en)))
    write(path, text[:match.end()] + u'\n'.join(lines) + u'\n' + text[match.end():], dry_run)


def set_readme_version(version, dry_run):
    for path, pattern in (
        ('docs/README.md', re.compile(r'(Current version: \*\*v?)[0-9][0-9.]*(\*\*)')),
        ('docs/zh-CN/README.md', re.compile(u'(当前版本：\\*\\*v?)[0-9][0-9.]*(\\*\\*)')),
    ):
        text = read(path)
        if not pattern.search(text):
            print('  skipped %s (no current-version line)' % path)
            continue
        write(path, pattern.sub(r'\g<1>%s\g<2>' % version, text, count=1), dry_run)


def set_data_formats_version(version, dry_run):
    for path in ('docs/data-formats.md', 'docs/zh-CN/data-formats.md'):
        text = read(path)
        pattern = re.compile(r'("appVersion": ")[0-9][0-9.]*(")')
        if not pattern.search(text):
            print('  skipped %s (no appVersion example)' % path)
            continue
        write(path, pattern.sub(r'\g<1>%s\g<2>' % version, text, count=1), dry_run)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('version', help='bare semver, e.g. 0.2.0 (the tag gets the v prefix)')
    parser.add_argument('--date', default=None, help='YYYY/M/D, defaults to today')
    parser.add_argument('--keep', type=int, default=5, help='release blocks left in the dialog')
    parser.add_argument('--dry-run', action='store_true')
    args = parser.parse_args()

    if not re.match(r'^%s$' % VERSION_RE, args.version):
        raise SystemExit('version must be bare semver, e.g. 0.2.0')
    date = args.date or '%d/%d/%d' % tuple(datetime.date.today().timetuple()[:3])
    if not re.match(r'^\d{4}/\d{1,2}/\d{1,2}$', date):
        raise SystemExit('--date must be YYYY/M/D')

    en_text, zh_text = read(CHANGELOG_EN), read(CHANGELOG_ZH)
    en_lines = [plain(line) for line in unreleased_bullets(en_text, CHANGELOG_EN)]
    zh_lines = [plain(line) for line in unreleased_bullets(zh_text, CHANGELOG_ZH)]
    if len(en_lines) != len(zh_lines):
        raise SystemExit('%s has %d bullets, %s has %d - the mirrors must match' % (
            CHANGELOG_EN, len(en_lines), CHANGELOG_ZH, len(zh_lines)))

    print('release v%s (%s), %d bullet(s)' % (args.version, date, len(zh_lines)))
    promote_unreleased(CHANGELOG_EN, args.version, date, args.dry_run)
    promote_unreleased(CHANGELOG_ZH, args.version, date, args.dry_run)
    set_core_version(args.version, args.dry_run)
    header, en_header = set_dialog_block(args.version, date, zh_lines, en_lines, args.keep, args.dry_run)
    set_dictionary(header, en_header, zh_lines, en_lines, args.dry_run)
    set_readme_version(args.version, args.dry_run)
    set_data_formats_version(args.version, args.dry_run)
    if not args.dry_run:
        print('now: python build-release.py, review the diff, then')
        print('     git commit -a -m "chore(release): v%s" && git tag v%s'
              % (args.version, args.version))
    return 0


if __name__ == '__main__':
    sys.exit(main())
