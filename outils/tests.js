const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium' });
  const pages = ['index','troupe','demander','spectacles'];
  const largeurs = [320, 390, 768, 1024, 1440, 1920];
  let souci = 0;

  for (const w of largeurs) {
    const ctx = await b.newContext({ viewport:{width:w, height:900} });
    for (const p of pages) {
      const pg = await ctx.newPage();
      const errs = [];
      pg.on('console', m => { if (m.type()==='error') errs.push(m.text()); });
      pg.on('pageerror', e => errs.push('JS: '+e.message));
      pg.on('requestfailed', r => errs.push('ressource: '+r.url().split('/').pop()));
      await pg.goto('http://127.0.0.1:8811/'+p+'.html', {waitUntil:'networkidle'});
      await pg.waitForTimeout(400);
      const r = await pg.evaluate(() => {
        const doc = document.documentElement;
        const debord = [...document.querySelectorAll('body *')]
          .filter(e => e.getBoundingClientRect().right > doc.clientWidth + 1)
          .map(e => e.tagName.toLowerCase() + (e.className && typeof e.className==='string' ? '.'+e.className.split(' ')[0] : ''));
        const police = getComputedStyle(document.body).fontFamily.split(',')[0];
        return {
          scrollH: doc.scrollWidth > doc.clientWidth,
          debord: [...new Set(debord)].slice(0,4),
          police
        };
      });
      const pbs = [];
      if (r.scrollH) pbs.push('DÉFILEMENT HORIZONTAL');
      if (r.debord.length) pbs.push('déborde: '+r.debord.join(', '));
      if (errs.length) pbs.push('erreurs: '+errs.slice(0,3).join(' | '));
      if (pbs.length) { console.log(`  ${w}px ${p}: ${pbs.join(' ; ')}`); souci++; }
      await pg.close();
    }
  }
  console.log(souci ? `\n>>> ${souci} problème(s)` : '\n>>> Aucun débordement, aucune erreur console, sur 6 largeurs x 4 pages');
  await b.close();
})();
