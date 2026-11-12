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
function countries(title){
  if(/[\u3040-\u30ff]/u.test(title)) return ['JP','KR'];
  if(/[\uac00-\ud7af]/u.test(title)) return ['KR'];
  if(/[\u4e00-\u9fff]/u.test(title)) return ['CN','TW','HK','KR'];
  return ['KR','US'];
}

for (const title of samples) {
  const rows=[];
  for(const country of countries(title)){
    const url=new URL('https://itunes.apple.com/search');
    url.searchParams.set('term',title);
    url.searchParams.set('media','music');
    url.searchParams.set('entity','song');
    url.searchParams.set('limit','25');
    url.searchParams.set('country',country);
    const res=await fetch(url,{headers:{'User-Agent':'NAMRA-Profile/1.0'}});
    const json=await res.json();
    for(const r of json.results||[]){
      const similarity=sim(r.trackName,title);
      if(similarity>=0.9 && r.artworkUrl100) rows.push({country,track:r.trackName,artist:r.artistName,album:r.collectionName,similarity,art:r.artworkUrl100});
    }
  }
  console.log(JSON.stringify({title,count:rows.length,top:rows.slice(0,5)},null,2));
}
