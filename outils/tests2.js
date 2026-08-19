const { chromium } = require('playwright');
const B='http://127.0.0.1:8811/';
(async () => {
  const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium' });
  const ctx = await b.newContext({ viewport:{width:1440,height:900} });
  let ko = 0;
  const dire = (nom, ok, detail='') => { console.log((ok?'  OK   ':'  ÉCHEC') + '  ' + nom + (detail?' — '+detail:'')); if(!ok) ko++; };

  // --- Polices réellement appliquées ---
  let pg = await ctx.newPage();
  await pg.goto(B+'index.html',{waitUntil:'networkidle'});
  const f = await pg.evaluate(async () => {
    await document.fonts.ready;
    return {
      chargees: [...document.fonts].filter(f=>f.status==='loaded').map(f=>f.family+' '+f.weight+' '+f.style),
      corps: getComputedStyle(document.body).fontFamily.split(',')[0],
      titre: getComputedStyle(document.querySelector('h1')).fontFamily.split(',')[0]
    };
  });
  dire('polices locales chargées', f.chargees.length>=2, f.chargees.join(' / '));
  dire('corps de texte en Jost', f.corps.includes('Jost'));
  dire('titres en Fraunces', f.titre.includes('Fraunces'));

  // --- srcset : la petite image sur mobile, la grande sur grand écran ---
  await pg.close();
  for (const [w, attendu] of [[390,'1400'],[1440,'nb-serieux.jpg']]) {
    const c2 = await b.newContext({ viewport:{width:w,height:800}, deviceScaleFactor:1 });
    const p2 = await c2.newPage();
    let choisie='';
    p2.on('response', r => { if (r.url().includes('groupe-nb-serieux')) choisie = r.url().split('/').pop(); });
    await p2.goto(B+'index.html',{waitUntil:'networkidle'});
    dire(`visuel d'accueil à ${w}px`, choisie.includes(attendu), 'téléchargé : '+choisie);
    await c2.close();
  }

  // --- Menu mobile ---
  const cm = await b.newContext({ viewport:{width:390,height:844} });
  pg = await cm.newPage();
  await pg.goto(B+'demander.html',{waitUntil:'networkidle'});
  await pg.click('.burger');
  dire('menu mobile s\'ouvre', await pg.isVisible('.nav-links.open'));
  dire('menu mobile annonce son état', await pg.getAttribute('.burger','aria-expanded')==='true');
  await pg.click('.nav-links a[href="index.html"]');
  await pg.waitForLoadState('networkidle');
  dire('un lien du menu navigue bien', pg.url().endsWith('index.html'));
  await cm.close();

  // --- Fiche membre : souris, clavier, Échap, retour du focus ---
  pg = await ctx.newPage();
  await pg.goto(B+'troupe.html',{waitUntil:'networkidle'});
  await pg.locator('.card').nth(4).click();
  await pg.waitForTimeout(400);
  const nom = await pg.textContent('#modalName');
  const src = await pg.getAttribute('#modalPhoto','src');
  dire('fiche membre s\'ouvre au clic', nom==='Laurent', 'nom affiché : '+nom);
  dire('photo couleur chargée', src.includes('laurent-couleur'));
  dire('image réellement affichée', await pg.evaluate(()=>document.querySelector('#modalPhoto').naturalWidth>0));
  await pg.keyboard.press('Escape');
  await pg.waitForTimeout(300);
  dire('Échap referme', !(await pg.isVisible('.modal-overlay.is-open')));
  dire('focus rendu à la carte', await pg.evaluate(()=>document.activeElement.classList.contains('card')));
  // ouverture au clavier
  await pg.keyboard.press('Enter');
  await pg.waitForTimeout(300);
  dire('ouverture au clavier (Entrée)', await pg.isVisible('.modal-overlay.is-open'));
  await pg.keyboard.press('Escape');
  // le fond ne défile pas quand la fiche est ouverte
  await pg.locator('.card').first().click();
  await pg.waitForTimeout(200);
  dire('page bloquée derrière la fiche', await pg.evaluate(()=>document.body.style.overflow==='hidden'));
  await pg.keyboard.press('Escape');
  await pg.waitForTimeout(200);
  dire('défilement rendu à la fermeture', await pg.evaluate(()=>document.body.style.overflow===''));
  await pg.close();

  // --- Lien d'évitement au clavier ---
  pg = await ctx.newPage();
  await pg.goto(B+'index.html',{waitUntil:'networkidle'});
  await pg.keyboard.press('Tab');
  const premier = await pg.evaluate(()=>document.activeElement.className);
  dire('1re tabulation = « Aller au contenu »', premier.includes('skip-link'));
  await pg.close();

  // --- Bouton copier l'adresse ---
  const cc = await b.newContext({ viewport:{width:1440,height:900}, permissions:['clipboard-read','clipboard-write'] });
  pg = await cc.newPage();
  await pg.goto(B+'demander.html',{waitUntil:'networkidle'});
  await pg.click('.copy-btn');
  await pg.waitForTimeout(300);
  const presse = await pg.evaluate(()=>navigator.clipboard.readText());
  dire('bouton « Copier l\'adresse »', presse==='laconfrerire@gmail.com', 'copié : '+presse);
  dire('retour visuel après copie', (await pg.textContent('.copy-btn'))==='Copié !');
  await cc.close();

  // --- Ancres internes ---
  pg = await ctx.newPage();
  await pg.goto(B+'demander.html',{waitUntil:'networkidle'});
  await pg.click('a[href="#formats"]');
  await pg.waitForTimeout(600);
  dire('ancre « Voir nos formats »', await pg.evaluate(()=>{
    const r=document.getElementById('formats').getBoundingClientRect();
    return r.top > -50 && r.top < 200;
  }));
  await pg.close();

  console.log(ko ? `\n>>> ${ko} test(s) en échec` : '\n>>> Tous les tests fonctionnels passent');
  await b.close();
})();
