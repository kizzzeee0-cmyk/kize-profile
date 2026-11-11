from urllib import request
from pathlib import Path
import re

BASE='https://weflab.com'
PAGE='https://weflab.com/page/guPK2ODAlGBvZWk'

def fetch(url, referer=None):
    headers={'User-Agent':'Mozilla/5.0'}
    if referer:
        headers['Referer']=referer
    req=request.Request(url, headers=headers)
    with request.urlopen(req, timeout=30) as r:
        return r.status, dict(r.headers), r.read().decode('utf-8','ignore'), r.geturl()

report=[]
for label,url,ref in [
    ('PAGE',PAGE,None),
    ('ALERTLIST',BASE+'/alertlist',PAGE),
    ('MAINJS',BASE+'/resource/dist/main.js?ver=20261109124502',PAGE),
    ('VENDORPAGE',BASE+'/resource/dist/vendor_page.js?ver=20260707165406',PAGE),
]:
    try:
        status,headers,text,final=fetch(url,ref)
    except Exception as e:
        report.append(f'=== {label} ERROR ===\n{type(e).__name__}: {e}\n')
        continue
    report.append(f'=== {label} ===\nstatus={status}\nfinal={final}\nsize={len(text)}\n')
    if label=='PAGE':
        title=re.search(r'<title>(.*?)</title>',text,re.S)
        report.append('title='+(title.group(1).strip() if title else '')+'\n')
        report.append('alertlist_marker='+str('alertlist_table' in text)+'\n')
    elif label=='ALERTLIST':
        title=re.search(r'<title>(.*?)</title>',text,re.S)
        report.append('title='+(title.group(1).strip() if title else '')+'\n')
        for needle in ['alertlist_table','btn_roulette_static','로그인','loginData']:
            report.append(f'{needle}={needle in text}\n')
    else:
        needles=['alertlist','roulette_static','btn_roulette_static','alertlist_table','socket.on','socket.emit','loginData.userid','pageid','donation']
        for needle in needles:
            starts=[m.start() for m in re.finditer(re.escape(needle),text,re.I)][:8]
            report.append(f'\n-- {needle} occurrences={len(starts)} --\n')
            for i in starts:
                snippet=text[max(0,i-220):min(len(text),i+520)].replace('\n',' ')
                snippet=re.sub(r'[\"\'](?:[A-Za-z0-9_-]{18,})[\"\']','"<token>"',snippet)
                report.append(snippet+'\n')

Path('probe-report.txt').write_text(''.join(report),encoding='utf-8')
