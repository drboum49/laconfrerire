const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium' });
  const ctx = await b.newContext({ viewport:{width:1440,height:900} });
  const lum = c => { const [r,g,bl]=c.map(v=>{v/=255;return v<=.03928?v/12.92:Math.pow((v+.055)/1.055,2.4)}); return .2126*r+.7152*g+.0722*bl; };
  const ratio = (a,b2) => { const l1=lum(a),l2=lum(b2); return (Math.max(l1,l2)+.05)/(Math.min(l1,l2)+.05); };
  const parse = s => (s.match(/[\d.]+/g)||[0,0,0]).slice(0,3).map(Number);
  let ko=0;
  for (const p of ['index','troupe','demander','spectacles']) {
    const pg = await ctx.newPage();
    await pg.goto('http://127.0.0.1:8811/'+p+'.html',{waitUntil:'networkidle'});
    const els = await pg.evaluate(() => {
      const nb = s => (s.match(/[\d.]+/g)||[]).map(Number);
      const fondEffectif = e => {
        // empile les fonds semi-transparents jusqu'au premier fond opaque
        const pile=[]; let n=e;
        while(n){ const v=nb(getComputedStyle(n).backgroundColor);
          if(v.length && !(v.length===4 && v[3]===0)) pile.push(v);
          if(v.length===3 || (v.length===4 && v[3]===1)) break;
          n=n.parentElement; }
        if(!pile.length) return 'rgb(255,255,255)';
        let out = pile[pile.length-1].slice(0,3);
        for(let i=pile.length-2;i>=0;i--){
          const c=pile[i], a=c.length===4?c[3]:1;
          out=[0,1,2].map(k=>Math.round(c[k]*a+out[k]*(1-a)));
        }
        return 'rgb('+out.join(',')+')';
      };
      return [...document.querySelectorAll('p,a,span,h1,h2,h3,li,small,button,b')]
        .filter(e => e.textContent.trim() && e.offsetParent !== null && e.children.length===0)
        .map(e => { const c=getComputedStyle(e);
          return {sel:e.tagName.toLowerCase()+'.'+(typeof e.className==='string'?e.className.split(' ')[0]:''),
                  txt:e.textContent.trim().slice(0,28), fg:c.color, bg:fondEffectif(e),
                  taille:parseFloat(c.fontSize), gras:c.fontWeight};
        });
    });
    for (const e of els) {
      const r = ratio(parse(e.fg), parse(e.bg));
      const grand = e.taille>=24 || (e.taille>=18.66 && +e.gras>=700);
      const seuil = grand ? 3 : 4.5;
      if (r < seuil) { console.log(`  ${p}.html  ${r.toFixed(2)}:1 (min ${seuil}) — ${e.sel} « ${e.txt} »`); ko++; }
    }
    await pg.close();
  }
  console.log(ko ? `\n>>> ${ko} contraste(s) insuffisant(s)` : '\n>>> Tous les textes respectent le contraste WCAG AA');
  await b.close();
})();
