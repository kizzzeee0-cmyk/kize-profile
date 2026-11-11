from urllib import request, parse
from pathlib import Path
import json, re, datetime

PAGE='https://weflab.com/page/guPK2ODAlGBvZWk'
API='https://weflab.com/api/'

def get(url):
    req=request.Request(url,headers={'User-Agent':'Mozilla/5.0','Referer':PAGE})
    with request.urlopen(req,timeout=30) as r:
        return r.read().decode('utf-8','ignore')

html=get(PAGE)
m=re.search(r'const loginData = (\{.*?\});\s*</script>', html, re.S)
if not m:
    raise SystemExit('loginData not found')
login=json.loads(m.group(1))

now=datetime.datetime.now()
start=(now-datetime.timedelta(days=2)).strftime('%Y%m%d0000')
end=(now+datetime.timedelta(days=1)).strftime('%Y%m%d0000')

attempts=[
  ('page-original', login.get('type','page'), login.get('pageid','alert')),
  ('page-alertlist', 'page', 'alertlist'),
  ('setup-alertlist', 'setup', 'alertlist'),
]

out=[]
for label,pagetype,pageid in attempts:
    fields={
      'type':'alertlist_load',
      'pagetype':pagetype,
      'idx':login.get('idx',''),
      'pageid':pageid,
      'preset':login.get('preset','0'),
      'lastdate':'',
      'filter[start]':start,
      'filter[end]':end,
      'filter[min]':'',
      'filter[type]':'',
      'filter[search]':'',
      'ver[server]':str(login.get('config',{}).get('ver',{}).get('server','')),
      'ver[socket]':str(login.get('config',{}).get('ver',{}).get('socket','')),
    }
    data=parse.urlencode(fields).encode()
    req=request.Request(API,data=data,headers={
      'User-Agent':'Mozilla/5.0',
      'Referer':PAGE,
      'Content-Type':'application/x-www-form-urlencoded; charset=UTF-8',
      'X-Requested-With':'XMLHttpRequest',
      'Accept':'application/json, text/javascript, */*; q=0.01',
    })
    try:
        with request.urlopen(req,timeout=30) as r:
            raw=r.read().decode('utf-8','ignore')
            status=r.status
    except Exception as e:
        out.append(f'=== {label} ===\nerror={type(e).__name__}: {e}\n')
        continue

    out.append(f'=== {label} ===\nstatus={status}\n')
    try:
        obj=json.loads(raw)
        out.append('top_keys='+','.join(sorted(obj.keys()))+'\n')
        out.append('result='+str(obj.get('result'))+'\n')
        out.append('total='+str(obj.get('total'))+'\n')
        rows=obj.get('data') if isinstance(obj.get('data'),list) else []
        out.append('row_count='+str(len(rows))+'\n')
        if rows:
            row=rows[0]
            out.append('row_keys='+','.join(sorted(row.keys()))+'\n')
            out.append('has_name='+str(bool(row.get('name')))+'\n')
            out.append('has_id='+str(bool(row.get('id')))+'\n')
            out.append('roulette='+repr(row.get('roulette'))+'\n')
            out.append('create_time='+repr(row.get('create_time'))+'\n')
            out.append('uid='+repr(row.get('uid'))+'\n')
    except Exception:
        out.append('raw_head='+raw[:500].replace('\n',' ')+'\n')

Path('probe-report.txt').write_text(''.join(out),encoding='utf-8')
