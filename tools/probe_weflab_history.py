from urllib import request
from pathlib import Path
import re

BASE='https://weflab.com'
PAGE='https://weflab.com/page/guPK2ODAlGBvZWk'
req=request.Request(BASE+'/resource/dist/main.js?ver=20261109124502',headers={'User-Agent':'Mozilla/5.0','Referer':PAGE})
with request.urlopen(req,timeout=30) as r:
    text=r.read().decode('utf-8','ignore')

out=['size=%d\n' % len(text)]
patterns=['setup.alert={','alert:{stop','join_alert','alert_receive','socket:function(){','socket.io=io(','type:"join_','page_alert','alertlist_remote']
for pattern in patterns:
    out.append('\n=== %s ===\n' % pattern)
    starts=[m.start() for m in re.finditer(re.escape(pattern),text,re.I)][:40]
    out.append('count=%d\n' % len(starts))
    for i in starts:
        sn=text[max(0,i-2200):min(len(text),i+7000)].replace('\n',' ')
        sn=re.sub(r'([A-Za-z0-9_-]{24,})','<TOKEN>',sn)
        out.append(sn+'\n\n')
Path('probe-report.txt').write_text(''.join(out),encoding='utf-8')
