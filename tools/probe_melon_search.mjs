const headers={
  'User-Agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/157 Safari/537.36',
  'Referer':'https://www.melon.com/',
  'Accept-Language':'ko-KR,ko;q=0.9,en;q=0.8'
};

for (const albumId of ['2249127','10081450','374383']) {
  const url='https://www.melon.com/album/detail.htm?albumId='+albumId;
  const res=await fetch(url,{headers});
  const html=await res.text();
  const og=html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ||
    html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
  const img=html.match(/https?:\/\/cdnimg\.melon\.co\.kr\/[^"'\s>]+(?:500|1000)\.jpg[^"'\s>]*/i);
  console.log(JSON.stringify({albumId,status:res.status,len:html.length,og:og?.[1]||'',img:img?.[0]||''}));
}
