const { chromium } = require('playwright');
const B='http://127.0.0.1:8811/';
(async () => {
  const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium' });
  let ko=0;
  const dire=(n,ok,d='')=>{console.log((ok?'  OK   ':'  ÉCHEC')+'  '+n+(d?' — '+d:''));if(!ok)ko++;};

  // 1. Contour de focus visible sur le bandeau doré
  let ctx = await b.newContext({viewport:{width:1440,height:900}});
  let pg = await ctx.newPage();
  await pg.goto(B+'demander.html',{waitUntil:'networkidle'});
  const f = await pg.evaluate(()=>{
    const el = document.querySelector('.contact .btn-dark'); el.focus();
    const c = getComputedStyle(el);
    const lum = h => { const v=h.match(/\d+/g).map(Number).slice(0,3).map(x=>{x/=255;return x<=.03928?x/12.92:Math.pow((x+.055)/1.055,2.4)}); return .2126*v[0]+.7152*v[1]+.0722*v[2]; };
    const fond = getComputedStyle(document.querySelector('.contact')).backgroundColor;
    const l1=lum(c.outlineColor), l2=lum(fond);
    return {couleur:c.outlineColor, largeur:c.outlineWidth,
            ratio:+(((Math.max(l1,l2)+.05)/(Math.min(l1,l2)+.05)).toFixed(2))};
  });
  dire('focus visible sur le bandeau doré', f.ratio>=3, `${f.couleur} ${f.largeur} → ${f.ratio}:1 (il faut 3)`);
  await pg.close();

  // 2. Focus visible sur fond sombre
  pg = await ctx.newPage();
  await pg.goto(B+'index.html',{waitUntil:'networkidle'});
  const f2 = await pg.evaluate(()=>{
    const el=document.querySelector('.cta-band .btn'); el.focus();
    return getComputedStyle(el).outlineColor;
  });
  dire('focus adapté aux bandeaux sombres', f2.includes('247'), 'couleur : '+f2);
  await pg.close();

  // 3. Sans JavaScript : la navigation reste utilisable sur téléphone
  const sansJs = await b.newContext({viewport:{width:390,height:844}, javaScriptEnabled:false});
  pg = await sansJs.newPage();
  await pg.goto(B+'index.html',{waitUntil:'domcontentloaded'});
  await pg.waitForTimeout(300);
  const total = await pg.locator('.nav-links a').count();
  let visibles = 0;
  for (let i=0;i<total;i++) if (await pg.locator('.nav-links a').nth(i).isVisible()) visibles++;
  const burgerVisible = await pg.locator('.burger').isVisible();
  dire('sans JS : les liens du menu restent accessibles', visibles===total && !burgerVisible,
       `${visibles}/${total} liens visibles, burger affiché : ${burgerVisible}`);
  // NB : page.evaluate n'est pas fiable quand JavaScript est coupé.
  // On interroge donc la visibilité réelle via le sélecteur.
  const pgc = await sansJs.newPage();
  await pgc.goto(B+'demander.html',{waitUntil:'domcontentloaded'});
  await pgc.waitForTimeout(300);
  const copieVisible = await pgc.locator('.copy-btn').isVisible();
  dire('sans JS : le bouton « Copier » reste masqué', copieVisible===false);
  await sansJs.close();

  // 4. Fiche membre : la fin d'une bio longue est atteignable au clavier
  const petit = await b.newContext({viewport:{width:390,height:844}});
  pg = await petit.newPage();
  await pg.goto(B+'troupe.html',{waitUntil:'networkidle'});
  await pg.locator('.card').nth(1).click();   // Amandine, bio la plus longue
  await pg.waitForTimeout(400);
  await pg.keyboard.press('Tab');
  const cible = await pg.evaluate(()=>document.activeElement.className);
  dire('tabulation atteint la zone de texte', cible.includes('modal-text'), 'focus : '+cible);
  await pg.keyboard.press('End');
  await pg.waitForTimeout(300);
  const bas = await pg.evaluate(()=>{const e=document.querySelector('.modal-text');
    return {haut:e.scrollTop, max:e.scrollHeight-e.clientHeight};});
  dire('la fin de la bio est atteinte au clavier', bas.max===0 || bas.haut>0,
       `défilé de ${bas.haut} sur ${bas.max}`);
  await petit.close();

  // 5. Mouvement réduit
  const calme = await b.newContext({viewport:{width:1440,height:900}, reducedMotion:'reduce'});
  pg = await calme.newPage();
  await pg.goto(B+'index.html',{waitUntil:'networkidle'});
  const m = await pg.evaluate(()=>getComputedStyle(document.documentElement).scrollBehavior);
  dire('défilement animé désactivé si le système le demande', m==='auto', 'scroll-behavior: '+m);
  await calme.close();

  // 6. Les variables de couleur pilotent réellement tout
  pg = await ctx.newPage();
  await pg.goto(B+'index.html',{waitUntil:'networkidle'});
  const v = await pg.evaluate(()=>{
    document.documentElement.style.setProperty('--cream-rgb','0,128,255');
    document.documentElement.style.setProperty('--cream','#0080ff');
    return getComputedStyle(document.querySelector('.site-nav')).backgroundColor;
  });
  dire('changer --cream change bien la barre de navigation', v.includes('0, 128, 255'), v);
  await pg.close();
  await ctx.close();

  console.log(ko ? `\n>>> ${ko} test(s) en échec` : '\n>>> Tous les points signalés par la relecture sont corrigés');
  await b.close();
})();
