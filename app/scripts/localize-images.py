#!/usr/bin/env python3
"""Download team logos (all 30) + headshots referenced by static/mock fixtures, resize, store under static/img/,
and rewrite fixture URLs to our own paths (/img/teams/<abbr>.png, /img/players/<id>.png).
Headshots that fail to download are set to null (app shows a placeholder).
NOTE: images are ESPN-owned; OK for a non-commercial MVP only. Usage: python3 scripts/localize-images.py"""
import json, os, re, io, glob, urllib.request
from PIL import Image
ROOT = os.path.join(os.path.dirname(__file__), '..', 'static')
MOCK, IMG = os.path.join(ROOT, 'mock'), os.path.join(ROOT, 'img')
os.makedirs(IMG + '/teams', exist_ok=True); os.makedirs(IMG + '/players', exist_ok=True)
cache = {}
def fetch(url, out, size):
    if url in cache: return cache[url]
    ok = os.path.exists(out)
    if not ok:
        try:
            raw = urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'}), timeout=20).read()
            im = Image.open(io.BytesIO(raw)).convert('RGBA'); im.thumbnail((size, size))
            im.save(out, optimize=True); ok = True
        except Exception as e:
            print('skip', url, e)
    cache[url] = ok; return ok
def local(url):
    if not isinstance(url, str) or 'espncdn.com' not in url: return url
    m = re.search(r'teamlogos/nba/500/([a-z]+)\.png', url)
    if m:
        p = f'/img/teams/{m.group(1).upper()}.png'
        return p if fetch(url, IMG + p[4:], 128) else None
    m = re.search(r'headshots/nba/players/full/(\d+)\.png', url)
    if m:
        p = f'/img/players/{m.group(1)}.png'
        return p if fetch(url, IMG + p[4:], 120) else None
    return url
def walk(x):
    if isinstance(x, dict): return {k: (local(v) if k in ('logo_url', 'headshot_url', 'logo', 'headshot') else walk(v)) for k, v in x.items()}
    if isinstance(x, list): return [walk(v) for v in x]
    return x
for f in glob.glob(MOCK + '/**/*.json', recursive=True):
    d = json.load(open(f)); json.dump(walk(d), open(f, 'w'), ensure_ascii=False, separators=(',', ':'))
# all 30 logos even if not referenced
for t in json.load(open(MOCK + '/api/v1/teams.json'))['teams']:
    fetch(f"https://a.espncdn.com/i/teamlogos/nba/500/{t['abbr'].lower()}.png", f"{IMG}/teams/{t['abbr']}.png", 128)
n = lambda d: len(os.listdir(d)); sz = lambda d: sum(os.path.getsize(os.path.join(d, x)) for x in os.listdir(d))
print(f"logos {n(IMG+'/teams')} ({sz(IMG+'/teams')//1024} KB), headshots {n(IMG+'/players')} ({sz(IMG+'/players')//1024} KB)")
