from urllib import request
from pathlib import Path
import re

BASE='https://weflab.com'
PAGE='https://weflab.com/page/guPK2ODAlGBvZWk'

def fetch(url):
    req=request.Request(url, headers={'User-Agent':'Mozilla/5.0','Referer':PAGE})
    with request.urlopen(req, timeout=30) as r:
        return r.read().decode('utf-8','ignore')

text=fetch(BASE+'/resource/dist/main.js?ver=20261109124502')
out=[]
out.append('main.js size=%d\n' % len(text))

patterns=[
    'alertlist:{',
    'alertlist:{load',
    'loadtype',
    'comm.alertlist.load=function',
    'alertlist.load=function',
    'alertlist.load',
    'alertlist_remote',
]
for pattern in patterns:
    out.append('\n=== PATTERN %s ===\n' % pattern)
    starts=[m.start() for m in re.finditer(re.escape(pattern),text,re.I)][:20]
    out.append('count=%d\n' % len(starts))
    for i in starts:
        sn=text[max(0,i-1800):min(len(text),i+5500)].replace('\n',' ')
        sn=re.sub(r'([A-Za-z0-9_-]{24,})','<TOKEN>',sn)
        out.append(sn+'\n\n')

# Find AJAX-like calls located near 'alertlist'
for m in re.finditer(r'\$\.ajax|\$\.post|\$\.get|fetch\(',text):
    i=m.start()
    window=text[max(0,i-3000):min(len(text),i+4500)]
    if 'alertlist' in window.lower():
        out.append('\n=== AJAX NEAR ALERTLIST ===\n')
        out.append(re.sub(r'([A-Za-z0-9_-]{24,})','<TOKEN>',window.replace('\n',' '))+'\n')

Path('probe-report.txt').write_text(''.join(out),encoding='utf-8')
