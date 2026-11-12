const samples = ['永不失联的爱','看着我的眼睛说','생각을 멈추다 보면'];

function normalize(v) {
  return String(v || '').normalize('NFKC').trim().toLowerCase().replace(/[\p{P}\p{S}]+/gu,'').replace(/\s+/g,' ');
}
function sim(a,b) {
  a=normalize(a); b=normalize(b);
  if(!a||!b) return 0;
  if(a===b) return 1;
  const rows=Array.from({length:a.length+1},(_,i)=>i);
  for(let j=1;j<=b.length;j++){
    let prev=rows[0]; rows[0]=j;
    for(let i=1;i<=a.length;i++){
      const cur=rows[i];
      const cost=a[i-1]===b[j-1]?0:1;
      rows[i]=Math.min(rows[i]+1,rows[i-1]+1,prev+cost);
      prev=cur;
    }
  }
  return 1-rows[a.length]/Math.max(a.length,b.length);
}

for (const title of samples) {
  const url=new URL('https://api.deezer.com/search');
  url.searchParams.set('q',title);
  url.searchParams.set('limit','30');
  const res=await fetch(url,{headers:{'User-Agent':'NAMRA-Profile/1.0'}});
  const json=await res.json();
  const rows=(json.data||[])
    .map(r=>({track:r.title_short||r.title,artist:r.artist?.name,album:r.album?.title,similarity:sim(r.title_short||r.title,title),art:r.album?.cover_xl||r.album?.cover_big}))
    .filter(r=>r.similarity>=0.9 && r.art);
  console.log(JSON.stringify({title,count:rows.length,top:rows.slice(0,8)},null,2));
}
