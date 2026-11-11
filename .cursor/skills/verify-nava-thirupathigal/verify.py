#!/usr/bin/env python3
"""Verification runner for NavaThirupathigal. See SKILL.md."""
import json, os, re, subprocess, sys, time
from pathlib import Path
REPO = Path(__file__).resolve().parents[3]
CHROME = os.environ.get('CHROME_PATH', '/usr/bin/google-chrome')
failures = []
def check(name, ok, detail=''):
    print(('PASS' if ok else 'FAIL'), name, (':: ' + str(detail))[:400] if detail else '')
    if not ok: failures.append(name)
def run(cmd, **kw):
    return subprocess.run(cmd, capture_output=True, text=True, timeout=900, **kw)
def render(url, markers):
    proc = subprocess.run([CHROME, '--headless=new', '--no-sandbox', '--disable-gpu',
                           '--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1',
                           '--virtual-time-budget=9000', '--window-size=1280,900',
                           '--dump-dom', url], capture_output=True, text=True, timeout=120)
    dom = proc.stdout
    check('render: app boots', all(m in dom for m in markers), dom[:200])
    errs = [l for l in proc.stderr.splitlines() if 'console' in l.lower() and 'error' in l.lower()
            and not re.search(r'dbus|gpu|vulkan|ozone|fontconfig', l, re.I)]
    check('render: no js console errors', not errs, errs[:3])
def main():
    server = subprocess.Popen([sys.executable, '-m', 'http.server', '4231', '--bind', '127.0.0.1'], cwd=REPO, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        time.sleep(1.5)
        render('http://127.0.0.1:4231/', ['Nava Thirupathigal', 'id="map"'])
    finally:
        server.terminate()

    print('FAILURES=%d' % len(failures))
    with open(REPO / '.cursor/skills/verify-nava-thirupathigal/evidence.json', 'w') as f:
        json.dump({'repo': 'NavaThirupathigal', 'ts': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()), 'failures': failures}, f, indent=2)
    return 1 if failures else 0
if __name__ == '__main__':
    sys.exit(main())
