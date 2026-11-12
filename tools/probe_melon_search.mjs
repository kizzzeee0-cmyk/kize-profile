const qs=['기억을 걷는 시간 넬','DINOSAUR AKMU','200% AKMU'];
for (const q of qs) {
  const url='https://www.melon.com/search/song/index.htm?section=all&searchGnbYn=Y&kkoSpl=N&kkoDpType=RESULT&q='+encodeURIComponent(q);
  const res=await fetch(url,{headers:{
    'User-Agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/157 Safari/537.36',
    'Referer':'https://www.melon.com/',
    'Accept-Language':'ko-KR,ko;q=0.9,en;q=0.8'
  }});
  const html=await res.text();
  console.log('QUERY',q,'STATUS',res.status,'LEN',html.length);
  const idx=html.search(/goSongDetail|album/images|artistName/);
  console.log(html.slice(Math.max(0,idx-1500),idx+5000));
}
