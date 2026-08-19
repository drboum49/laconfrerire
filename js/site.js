/* ==========================================================================
   La Confrérire — script commun aux 4 pages
   1. Menu mobile (le bouton ☰)
   2. Fiche membre en fenêtre (page « La troupe » uniquement)
   3. Bouton « Copier l'adresse » (page « Demander un spectacle »)
   ========================================================================== */
(function () {
  'use strict';

  /* ----- 0. Marqueur « JavaScript actif » ---------------------------------
     Le CSS s'en sert pour n'activer le menu déroulant et le bouton
     « Copier l'adresse » que si le script a bien répondu. Sans lui, la page
     reste entièrement utilisable, simplement sans ces deux raffinements. */
  document.documentElement.classList.add('js');

  /* ----- 1. Menu mobile -------------------------------------------------- */
  var burger = document.querySelector('.burger');
  var links = document.getElementById('nav-links');
  if (burger && links) {
    burger.addEventListener('click', function () {
      var open = links.classList.toggle('open');
      burger.setAttribute('aria-expanded', open ? 'true' : 'false');
      burger.setAttribute('aria-label', open ? 'Fermer le menu' : 'Ouvrir le menu');
    });
    links.querySelectorAll('a').forEach(function (a) {
      a.addEventListener('click', function () {
        links.classList.remove('open');
        burger.setAttribute('aria-expanded', 'false');
        burger.setAttribute('aria-label', 'Ouvrir le menu');
      });
    });
  }

  /* ----- 1 bis. Agenda et liens Billetweb ---------------------------------
     Les données sont volontairement séparées dans js/agenda.js : pour
     modifier une date ou son lien de réservation, il n'est pas nécessaire de
     toucher à cette partie du code ni à la page spectacles.html. */
  var agendaList = document.getElementById('agenda-list');
  if (agendaList) {
    var emptyAgenda = document.querySelector('.empty-agenda');
    var evenements = Array.isArray(window.CONFRERIRE_AGENDA) ? window.CONFRERIRE_AGENDA : [];

    function addText(parent, tag, className, value) {
      var element = document.createElement(tag);
      if (className) element.className = className;
      element.textContent = value;
      parent.appendChild(element);
      return element;
    }

    evenements.forEach(function (evenement) {
      if (!evenement || !evenement.jour || !evenement.mois || !evenement.spectacle ||
          !evenement.lieu || !evenement.heure || !evenement.statut || !evenement.reservationUrl) {
        if (window.console) console.warn('Agenda : un spectacle incomplet a été ignoré.');
        return;
      }
      var item = document.createElement('li');
      item.className = 'date';
      var dateBox = document.createElement('div');
      dateBox.className = 'date-box';
      addText(dateBox, 'span', 'jour', evenement.jour);
      addText(dateBox, 'span', 'mois', evenement.mois);
      item.appendChild(dateBox);

      var details = document.createElement('div');
      addText(details, 'h3', '', evenement.spectacle);
      addText(details, 'p', 'lieu', evenement.lieu + ' — ' + evenement.heure);
      addText(details, 'span', 'statut', evenement.statut);
      item.appendChild(details);

      var reservation = document.createElement('a');
      reservation.className = 'btn btn-primary';
      reservation.href = evenement.reservationUrl;
      reservation.textContent = evenement.bouton || 'Réserver';
      if (/^https?:\/\//i.test(evenement.reservationUrl)) {
        reservation.target = '_blank';
        reservation.rel = 'noopener';
      }
      item.appendChild(reservation);
      agendaList.appendChild(item);
    });

    if (agendaList.children.length) {
      if (emptyAgenda) emptyAgenda.hidden = true;
    } else if (emptyAgenda) {
      emptyAgenda.hidden = false;
    }
  }

  /* ----- 2. Fiche membre ------------------------------------------------- */
  var overlay = document.getElementById('modalOverlay');
  if (overlay) {
    var closeBtn = document.getElementById('modalCloseBtn');
    var photo = document.getElementById('modalPhoto');
    var name = document.getElementById('modalName');
    var bio = document.getElementById('modalBio');
    var lastFocused = null;

    function openModal(card) {
      photo.src = card.dataset.photo || '';
      var nom = card.dataset.name || '';
      // « de » devient « d' » devant une voyelle
      photo.alt = nom ? ('Portrait ' + (/^[aeiouyàâéèêîôû]/i.test(nom) ? "d'" + nom : 'de ' + nom)) : '';
      name.textContent = card.dataset.name || '';
      bio.textContent = card.dataset.bio || '';
      lastFocused = document.activeElement;
      overlay.classList.add('is-open');
      overlay.removeAttribute('inert');
      document.body.style.overflow = 'hidden';
      closeBtn.focus();
    }
    function closeModal() {
      overlay.classList.remove('is-open');
      overlay.setAttribute('inert', '');
      document.body.style.overflow = '';
      if (lastFocused) lastFocused.focus();
    }

    document.querySelectorAll('.card').forEach(function (card) {
      card.addEventListener('click', function () { openModal(card); });
    });
    closeBtn.addEventListener('click', closeModal);
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) closeModal();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && overlay.classList.contains('is-open')) closeModal();
      // Garde le clavier à l'intérieur de la fenêtre tant qu'elle est ouverte
      if (e.key === 'Tab' && overlay.classList.contains('is-open')) {
        var focusables = overlay.querySelectorAll('button, a[href], [tabindex="0"]');
        if (!focusables.length) return;
        var first = focusables[0], last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    });
  }

  /* ----- 3. Copier l'adresse e-mail -------------------------------------- */
  var copyBtn = document.querySelector('.copy-btn');
  if (copyBtn && navigator.clipboard) {
    copyBtn.style.display = 'inline-block';   // masqué par défaut dans le CSS
    copyBtn.addEventListener('click', function () {
      var addr = document.getElementById('mail-addr').textContent.trim();
      navigator.clipboard.writeText(addr).then(function () {
        copyBtn.textContent = 'Copié !';
        setTimeout(function () { copyBtn.textContent = "Copier l'adresse"; }, 2000);
      });
    });
  }

  /* ----- 4. Flux Instagram automatique ------------------------------------
     Ne fait rien tant qu'aucune adresse de flux n'est renseignée dans
     index.html (attribut data-feed du <div id="flux-instagram">).
     Dès qu'elle l'est, les dernières publications remplacent les 3 vignettes
     fixes, dans la même grille et la même présentation.
     Si le service est injoignable, les 3 vignettes fixes restent affichées.
     ---------------------------------------------------------------------- */
  var fluxEl = document.getElementById('flux-instagram');
  var collage = document.querySelector('.insta-collage');
  var feedUrl = fluxEl && fluxEl.getAttribute('data-feed');

  if (feedUrl && collage && window.fetch) {
    var maxPhotos = parseInt(fluxEl.getAttribute('data-max'), 10) || 6;

    // Choisit la version d'image la plus adaptée parmi celles fournies
    function pickImage(post) {
      var s = post.sizes || {};
      var best = s.medium || s.large || s.small || s.full;
      if (best && best.mediaUrl) return best.mediaUrl;
      if (typeof best === 'string') return best;
      return post.mediaType === 'VIDEO' ? (post.thumbnailUrl || '') : (post.mediaUrl || '');
    }

    fetch(feedUrl)
      .then(function (r) {
        if (!r.ok) throw new Error('flux indisponible (' + r.status + ')');
        return r.json();
      })
      .then(function (data) {
        var posts = (data && data.posts) || [];
        var ignorees = 0;
        var items = posts.slice(0, maxPhotos).map(function (post) {
          // Une publication illisible est écartée seule, sans faire tomber
          // les autres : sinon un seul élément mal formé viderait la section.
          var src;
          try { src = pickImage(post); } catch (e) { src = null; }
          if (!src) { ignorees++; return null; }
          var a = document.createElement('a');
          a.className = 'insta-photo';
          a.href = (typeof post.permalink === 'string' && /^https?:\/\//.test(post.permalink))
                   ? post.permalink : 'https://www.instagram.com/laconfrerire/';
          a.target = '_blank';
          a.rel = 'noopener';
          var legende = post.altText || post.prunedCaption || post.caption || '';
          legende = legende.replace(/\s+/g, ' ').trim().slice(0, 120);
          a.setAttribute('aria-label',
            (legende || 'Publication Instagram de La Confrérire') + ' (nouvelle fenêtre)');
          var img = document.createElement('img');
          img.src = src;
          img.alt = legende;
          img.loading = 'lazy';
          a.appendChild(img);
          return a;
        }).filter(Boolean);

        if (ignorees && window.console) {
          console.warn('Flux Instagram : ' + ignorees + ' publication(s) illisible(s), ignorée(s).');
        }
        if (!items.length) return;   // rien d'exploitable : on garde les vignettes fixes
        collage.innerHTML = '';
        items.forEach(function (a) { collage.appendChild(a); });
      })
      .catch(function (err) {
        // Les 3 vignettes fixes restent en place : le visiteur ne voit pas de trou.
        if (window.console) console.warn('Flux Instagram :', err.message);
      });
  }
})();
