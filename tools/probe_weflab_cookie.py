from urllib import request, parse
from http.cookiejar import CookieJar
from pathlib import Path
import json, re, datetime

PAGE='https://weflab.com/page/guPK2ODAlGBvZWk'
API='https://weflab.com/api/'

jar=CookieJar()
opener=request.build_opener(request.HTTPCookieProcessor(jar))
opener.addheaders=[('User-Agent','Mozilla/5.0')]

with opener.open(PAGE,timeout=30) as r:
    html=r.read().decode('utf-8','ignore')
    page_status=r.status

m=re.search(r'const loginData = (\{.*?\});\s*</script>',html,re.S)
if not m:
    raise SystemExit('loginData not found')
login=json.loads(m.group(1))

now=datetime.datetime.now()
start=(now-datetime.timedelta(days=2)).strftime('%Y%m%d0000')
end=(now+datetime.timedelta(days=1)).strftime('%Y%m%d0000')
fields={
  'type':'alertlist_load',
  'pagetype':login.get('type','page'),
  'idx':login.get('idx',''),
  'pageid':login.get('pageid',''),
  'preset':login.get('preset','0'),
  'lastdate':'',
  'filter[start]':start,
  'filter[end]':end,
  'filter[min]':'',
  'filter[type]':'',
  'filter[search]':'',
}
req=request.Request(API,data=parse.urlencode(fields).encode(),headers={
  'User-Agent':'Mozilla/5.0',
  'Referer':PAGE,
  'Content-Type':'application/x-www-form-urlencoded; charset=UTF-8',
  'X-Requested-With':'XMLHttpRequest',
  'Accept':'application/json, text/javascript, */*; q=0.01',
})
with opener.open(req,timeout=30) as r:
    raw=r.read().decode('utf-8','ignore')
    api_status=r.status

obj=json.loads(raw)
rows=obj.get('data') if isinstance(obj.get('data'),list) else []
out={
  'page_status':page_status,
  'cookie_count':sum(1 for _ in jar),
  'api_status':api_status,
  'result':obj.get('result'),
  'total':obj.get('total'),
  'row_count':len(rows),
  'row_keys':sorted(rows[0].keys()) if rows else [],
  'first_has_name':bool(rows and rows[0].get('name')),
  'first_has_id':bool(rows and rows[0].get('id')),
  'first_has_roulette':bool(rows and rows[0].get('roulette')),
}
Path('probe-report.txt').write_text(json.dumps(out,ensure_ascii=False,indent=2),encoding='utf-8')
