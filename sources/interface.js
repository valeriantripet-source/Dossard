/* Le Dossard : interface (affichage, saisies, enregistrement des données). */
(function () {
  'use strict';
  var D = window.DT;
  var vue = document.getElementById('vue'), feuille = document.getElementById('feuille'),
      annonce = document.getElementById('annonce'), onglets = document.getElementById('onglets');
  var ROUTES = ['objectif', 'plan', 'carnet', 'routine', 'poids', 'medailles'];
  var NOMS = ['profil', 'journal', 'routine', 'poids'];
  var S = { pret: false, lent: false, mode: 'attente', sync: 'ok',
            docs: { profil: null, journal: null, routine: null, poids: null },
            f: null, ui: { plage: 28, ouv: {}, suppr: null, edit: false, sel: null, mois: null }, aRendre: false };

  function auj() { return window.DT_AUJ || D.iso(new Date()); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function r1(v) { return Math.round(v * 10) / 10; }
  var fCourt = new Intl.DateTimeFormat('fr-CH', { day: 'numeric', month: 'short' });
  var fJour = new Intl.DateTimeFormat('fr-CH', { weekday: 'short', day: 'numeric', month: 'short' });
  var fLong = new Intl.DateTimeFormat('fr-CH', { weekday: 'long', day: 'numeric', month: 'long' });
  var fAn = new Intl.DateTimeFormat('fr-CH', { day: 'numeric', month: 'long', year: 'numeric' });
  function dCourt(s) { return fCourt.format(D.dateDe(s)); }
  function dJour(s) { return fJour.format(D.dateDe(s)); }
  function dLong(s) { return fLong.format(D.dateDe(s)); }
  function dAn(s) { return fAn.format(D.dateDe(s)); }
  var fMois = new Intl.DateTimeFormat('fr-CH', { month: 'long', year: 'numeric' });
  var fMoisNom = new Intl.DateTimeFormat('fr-CH', { month: 'long' });
  function dMois(m) { return fMois.format(D.dateDe(m + '-01')); }

  function P() { return S.docs.profil; }
  function Jn() { return S.docs.journal || (S.docs.journal = { sorties: [] }); }
  function Rt() { return S.docs.routine || (S.docs.routine = D.routineDefaut()); }
  function Pd() { return S.docs.poids || (S.docs.poids = { mesures: {} }); }
  function medailles() { var p = P(); return (p && p.medailles) || {}; }
  function cleBloc(p) { p.nbBlocs = (p.nbBlocs || 0) + 1; return 'b' + p.nbBlocs; }
  function bonus() { var p = P(); return (p && p.bonus) || {}; }
  function ctxBonus() { var pd = Pd(); return { sorties: Jn().sorties, routine: Rt(), poids: D.mesures(pd), sommeil: D.nuits(pd), auj: auj() }; }
  // Le parcours : les médailles de l'objectif choisi, dans l'ordre. Un programme d'avant ce choix garde les sept.
  function butCourant() { return D.lireBut(P()); }
  function parcours() { return D.etapes(butCourant()); }
  function idsParcours() { return parcours().map(function (o) { return o.id; }); }
  function nbGagnees() { var med = medailles(); return parcours().filter(function (o) { return med[o.id]; }).length; }
  function dureeBloc(o) { return D.sequence(o.id, D.lireRythme(P()), 0).length; }
  function pastille(o, cls) { return '<span class="pm' + (o.deniv ? ' d' : '') + (cls ? ' ' + cls : '') + '">' + (o.deniv ? triangle() : '') + '<span>' + o.court + '</span></span>'; }
  // Note les médailles bonus nouvellement méritées et renvoie leurs identifiants.
  function majBonus() {
    var p = P(); if (!p) return [];
    var avant = p.bonus || {}, deja = D.migrerBonus(avant), repris = JSON.stringify(deja) !== JSON.stringify(avant);
    var neuves = D.bonusGagnes(ctxBonus()).filter(function (k) { return !deja[k]; });
    neuves.forEach(function (k) { deja[k] = auj(); });
    if (neuves.length || repris) { p.bonus = deja; garder('profil'); }
    return neuves;
  }
  // « Les bornes (argent) », « La Dôle (bronze) », « Marmotte »
  function nomCle(k) { var x = D.lireCle(k); return x.n ? (x.p.icone ? x.p.t : x.b.nom) + ' (' + D.RANGS[x.n - 1] + ')' : x.b.nom; }
  function direBonus(cles) {
    if (cles.length) dire((cles.length > 1 ? 'Médailles bonus : ' : 'Médaille bonus : ') + cles.map(nomCle).join(', ') + '.');
  }
  var bonusVu = false;
  // Au premier affichage des données : médailles bonus méritées entre deux visites (une semaine de repos, par exemple).
  function apresPret() { if (bonusVu || !S.pret || !P()) return; bonusVu = true; direBonus(majBonus()); }

  // ---------- Enregistrement des données ----------
  var Depot = (function () {
    var refs = {}, files = {}, recu = {}, confirme = {}, minuterie = null;
    function cle(n) { return 'dossard:' + n; }
    function clone(v) { return v == null ? null : JSON.parse(JSON.stringify(v)); }
    function lireLocal(n) { try { var t = localStorage.getItem(cle(n)); return t ? JSON.parse(t) : null; } catch (e) { return null; } }
    function ecrireLocal(n, v) {
      try { if (v == null) localStorage.removeItem(cle(n)); else localStorage.setItem(cle(n), JSON.stringify(v)); return true; }
      catch (e) { return false; }
    }
    function tous(o) { return NOMS.every(function (n) { return o[n]; }); }
    function local() {
      S.mode = 'local';
      NOMS.forEach(function (n) { S.docs[n] = lireLocal(n); });
      S.pret = true; rendre(); apresPret();
    }
    function ecouter(db, uid) {
      S.mode = 'nuage';
      NOMS.forEach(function (n) {
        refs[n] = db.doc('data/users/' + uid + '/' + n);
        files[n] = { sale: false, enCours: false, minuterie: null };
        refs[n].onSnapshot(function (snap) {
          var meta = snap.metadata || {}, f = files[n];
          if (meta.hasPendingWrites || f.enCours || f.sale) return; // nos propres écritures priment
          var v = snap.exists ? clone(snap.data()) : null;
          var change = JSON.stringify(v) !== JSON.stringify(S.docs[n]);
          if (change) S.docs[n] = v;
          recu[n] = true; if (!meta.fromCache) confirme[n] = true;
          var avant = S.pret;
          // Sans profil, on attend la réponse confirmée du serveur avant de proposer d'en créer un.
          S.pret = tous(recu) && (S.docs.profil != null || tous(confirme));
          if (S.pret && minuterie) { clearTimeout(minuterie); minuterie = null; S.lent = false; }
          if (change || S.pret !== avant) rendreFond();
          apresPret();
        }, function () { S.sync = 'coupe'; rendreFond(); });
      });
      minuterie = setTimeout(function () { minuterie = null; if (!S.pret) { S.lent = true; rendre(); } }, 10000);
    }
    async function ouvrir() {
      var c = window.claude, db = null, user = null, uid = null;
      // La page peut démarrer un peu avant que l'hôte n'expose window.claude : on patiente jusqu'à 1,5 s.
      // La version autonome (site GitHub Pages) n'a pas d'hôte : elle passe tout de suite à l'enregistrement local.
      for (var i = 0; !window.DOSSARD_AUTONOME && i < 30 && !(c && typeof c.use === 'function'); i++) { await attendre(50); c = window.claude; }
      if (!c || typeof c.use !== 'function') { local(); return; }
      try { var r = await Promise.all([c.use('db'), c.use('user')]); db = r[0]; user = r[1]; } catch (e) { db = null; }
      try { uid = user ? await user.id() : null; } catch (e) { uid = null; }
      if (!db || !uid) { local(); return; }
      try { ecouter(db, uid); } catch (e) { local(); }
    }
    function attendre(ms) { return new Promise(function (ok) { setTimeout(ok, ms); }); }
    async function vider(n) {
      var f = files[n]; if (!f || f.enCours || !f.sale) return;
      f.enCours = true; f.sale = false;
      var corps = clone(S.docs[n]), ok = false, err = null;
      for (var essai = 0; essai < 2 && !ok; essai++) {
        try { if (corps == null) await refs[n].delete(); else await refs[n].set(corps); ok = true; }
        catch (e) { err = e; if (!e || e.code !== 'unavailable') break; await attendre(500 + Math.random() * 1000); }
      }
      f.enCours = false;
      if (ok) { if (S.sync !== 'ok') { S.sync = 'ok'; rendreFond(); } if (f.sale) vider(n); }
      else { f.sale = true; S.sync = (err && err.code === 'quota_exceeded') ? 'plein' : 'echec'; rendreFond(); }
    }
    function enregistrer(n) {
      if (S.mode !== 'nuage') { if (!ecrireLocal(n, S.docs[n])) S.sync = 'echec'; return; }
      var f = files[n]; f.sale = true;
      clearTimeout(f.minuterie);
      f.minuterie = setTimeout(function () { vider(n); }, 350);
    }
    function reessayer() {
      S.sync = 'ok';
      if (S.mode === 'nuage') NOMS.forEach(function (n) { if (files[n] && files[n].sale) vider(n); });
      else NOMS.forEach(function (n) { if (!ecrireLocal(n, S.docs[n])) S.sync = 'echec'; });
      rendre();
    }
    function aLocal() { return S.mode === 'nuage' && lireLocal('profil') != null; }
    function reprendreLocal() {
      NOMS.forEach(function (n) { var v = lireLocal(n); if (v != null) { S.docs[n] = v; enregistrer(n); } });
    }
    return { ouvrir: ouvrir, enregistrer: enregistrer, reessayer: reessayer, aLocal: aLocal, reprendreLocal: reprendreLocal };
  })();
  function garder() { for (var i = 0; i < arguments.length; i++) Depot.enregistrer(arguments[i]); }

  // ---------- Petits morceaux d'affichage ----------
  function dire(msg) {
    annonce.textContent = msg;
    clearTimeout(dire.t); dire.t = setTimeout(function () { annonce.textContent = ''; }, 3200);
  }
  function icone(nom) {
    var p = {
      reglages: '<circle cx="12" cy="12" r="3.2"></circle><path d="M12 2.8v2.6M12 18.6v2.6M2.8 12h2.6M18.6 12h2.6M5.5 5.5l1.8 1.8M16.7 16.7l1.8 1.8M18.5 5.5l-1.8 1.8M7.3 16.7l-1.8 1.8"></path>',
      fermer: '<path d="M6 6l12 12M18 6L6 18"></path>',
      coche: '<path d="M5 12.5l4.5 4.5L19 7.5"></path>',
      gauche: '<path d="M15 5l-7 7 7 7"></path>',
      droite: '<path d="M9 5l7 7-7 7"></path>'
    }[nom];
    return '<svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">' + p + '</svg>';
  }
  function triangle() { return '<svg aria-hidden="true" width="9" height="7" viewBox="0 0 9 7"><path d="M4.5 0L9 7H0z" fill="currentColor"></path></svg>'; }
  function boutonReglages() { return '<button class="rond" type="button" data-a="reglages" aria-label="Réglages">' + icone('reglages') + '</button>'; }
  function medaille(o, classe) {
    return '<span class="med' + (classe ? ' ' + classe : '') + (o.deniv ? ' d' : '') + '"><span class="ruban"></span><span class="disque">' +
      (o.deniv ? triangle() : '') + '<span>' + o.court + '</span></span></span>';
  }
  var ICONES = window.DT_ICONES || {};
  // niveau : bronze, argent, or ou platine ; vide tant que rien n'est décroché. Une médaille unique décrochée est d'emblée en or.
  function medailleBonus(icone, niveau) {
    return '<span class="med bonus' + (niveau ? ' ' + niveau : '') + '"><span class="ruban"></span><span class="disque">' +
      '<svg aria-hidden="true" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' +
      (ICONES[icone] || '') + '</svg></span></span>';
  }
  function medailleCle(k) { var x = D.lireCle(k); return medailleBonus(x.n ? (x.p.icone || x.b.icone) : x.b.icone, x.n ? D.RANGS[x.n - 1] : 'or'); }
  function iconeBonus(b, niv) {
    if (!b.paliers) return b.icone;
    var p = niv === 4 ? b.platine : b.paliers[Math.max(0, niv - 1)];
    return p.icone || b.paliers[Math.min(2, Math.max(0, niv - 1))].icone || b.icone;
  }
  function pointsBonus(b, niv, gagnee) {
    // Trois points pour une médaille évolutive (bronze, argent, or), un seul pour une unique : son or.
    var h = '<span class="pts" aria-hidden="true">';
    if (!b.paliers) return h + '<i' + (gagnee ? ' class="or"' : '') + '></i></span>';
    D.NIVEAUX.forEach(function (n, k) { h += '<i' + (k < niv ? ' class="' + n + '"' : '') + '></i>'; });
    if (niv >= 3) h += '<i' + (niv === 4 ? ' class="platine"' : '') + '></i>'; // le palier secret, visible une fois l'or décroché
    return h + '</span>';
  }
  function caseBonus(b, bo, ctx) {
    var niv = b.paliers ? D.niveauBonus(b.id, bo) : 0, gagnee = b.paliers ? niv > 0 : !!bo[b.id];
    var ico = iconeBonus(b, niv);
    var dit = b.nom + ', ' + (b.paliers ? (niv ? D.RANGS[niv - 1] + ' décroché, ' : 'aucun palier pour l’instant, ') + D.suiviBonus(b.id, ctx, niv).valeur : (gagnee ? 'décrochée' : 'pas encore décrochée'));
    return '<li><button class="case' + (gagnee ? '' : ' non') + '" type="button" data-a="fiche" data-bonus="' + b.id + '" aria-label="' + esc(dit) + '">' +
      medailleBonus(ico, b.paliers ? (niv ? D.RANGS[niv - 1] : '') : (gagnee ? 'or' : '')) + '<b>' + esc(b.nom) + '</b>' + pointsBonus(b, niv, gagnee) + '</button></li>';
  }
  function pisteBonus(b, niv, su) {
    var lab = b.paliers.map(function (q, k) { return D.NIVEAUX[k] + ' : ' + q.t + (k < niv ? ', décroché' : ''); }).join(' ; ');
    var h = '<div class="piste" role="img" aria-label="' + esc('Paliers. ' + lab) + '"><i class="rail"><b style="width:' + (su.part * 100).toFixed(1) + '%"></b></i>';
    b.paliers.forEach(function (q, k) {
      h += '<span class="pas' + (k < niv ? ' ok' : '') + '"><i class="pt' + (k < niv ? ' ' + D.NIVEAUX[k] : '') + '"></i><span class="pl">' + esc(q.t) + '</span></span>';
    });
    return h + '</div>';
  }
  function classeMed(o) {
    var med = medailles(), bloc = P() && P().bloc;
    return med[o.id] ? 'gagnee' : (bloc && bloc.obj === o.id ? 'cours' : '');
  }
  function ratelier() {
    var n = nbGagnees(), liste = parcours(), tot = liste.length;
    var h = '<a class="ratelier" href="#medailles" aria-label="Porte-médailles : ' + n + ' sur ' + tot + '"><span class="rang"><span class="sur gris">Porte-médailles</span><span class="sur gris">' + n + ' sur ' + tot + '</span></span><span class="barre"></span><span class="medailles' + (tot < 4 ? ' peu' : '') + '">';
    liste.forEach(function (o) { h += medaille(o, classeMed(o)); });
    return h + '</span></a>';
  }
  function dossard(o, prenom, droite) {
    var t = o.gros.length >= 4 ? ' l' : (o.gros.length === 3 ? ' m' : '');
    return '<div class="dossard"><div class="dossard-haut">Objectif · ' + esc(o.titre) + '</div>' +
      '<div class="dossard-num"><span class="num' + t + '">' + o.gros + '</span><span class="unite' + (o.deniv ? ' d' : '') + '">' + o.unite + '</span></div>' +
      '<div class="dossard-bas"><span class="nom">' + esc(prenom) + '</span><span class="jmoins">' + esc(droite) + '</span></div>' +
      '<i class="trou a" aria-hidden="true"></i><i class="trou b" aria-hidden="true"></i><i class="trou c" aria-hidden="true"></i><i class="trou e" aria-hidden="true"></i></div>';
  }
  function segments(pos) {
    var h = '<div class="segments" aria-hidden="true" style="grid-template-columns:repeat(' + pos.n + ',minmax(0,1fr))">';
    for (var k = 0; k < pos.n; k++) h += '<i class="' + (pos.etat === 'apres' || k < pos.k ? 'fait' : (k === pos.k ? 'ici' : '')) + '"></i>';
    return h + '</div>';
  }
  function faits(s) {
    var c = [];
    if (s.min != null) c.push('<div class="fait"><b>' + s.min + '</b><span>min</span></div>');
    if (s.km != null) c.push('<div class="fait"><b>' + D.fx(s.km) + '</b><span>km</span></div>');
    if (s.dp != null) c.push('<div class="fait"><b>' + D.mil(s.dp) + '</b><span>m D+</span></div>');
    return c.length ? '<div class="faits">' + c.join('') + '</div>' : '';
  }
  function banniere() {
    if (S.sync === 'ok') return '';
    var t = S.sync === 'plein' ? 'L’espace de données de cette page est plein : tes dernières saisies ne sont pas enregistrées.'
      : S.sync === 'coupe' ? 'La liaison avec tes données est coupée. Ce que tu vois peut dater, et tes saisies ne sont plus enregistrées.'
      : 'Tes dernières saisies n’ont pas pu être enregistrées. Elles restent affichées tant que la page est ouverte.';
    return '<div class="alerte" role="alert"><span>' + t + '</span>' + (S.sync === 'echec' ? '<button class="lien" type="button" data-a="reessayer">Réessayer</button>' : '') + '</div>';
  }

  // ---------- Écrans ----------
  function vueChargement() {
    var h = '<section class="bandeau"><p class="sur">Le Dossard</p><h1 class="geant">Un instant</h1><p>Tes données arrivent.</p></section>';
    if (S.lent || S.sync === 'coupe') h += '<div class="bloc"><p>Tes données ne répondent pas encore. La page continue d’attendre : inutile de la recharger.</p></div>';
    return h;
  }
  var NOMS_TUILES = { '5k': ['5 km', 'sans marcher'], '10k': ['10 km', 'sans marcher'], semi: ['Semi', '21,1 km'], marathon: ['Marathon', '42,2 km'] };
  function etapesCreation(but) {
    var n = 0;
    return D.etapes(but).map(function (o) {
      var fin = D.estBut(but, o.id); if (!fin) n++;
      return '<span class="pas-e">' + pastille(o, fin ? 'but' : 'etape') + '<b>' + esc(o.nom) + '</b><small>' + (fin ? 'Objectif' : 'Étape ' + n) + '</small></span>';
    }).join('');
  }
  function rythmesCreation(but, niveau, choisi, debut) {
    // Les trois rythmes, avec la durée du parcours et le mois d'arrivée estimé. Le rapide reste fermé à qui reprend.
    var ids = D.etapes(but).map(function (o) { return o.id; }), dep = 0, h = '', ouvert = D.rapidePermis({ niveau: niveau });
    D.DEPARTS.forEach(function (d) { if (d.id === niveau) dep = d.depart; });
    D.RYTHMES.forEach(function (r) {
      var ferme = r.id === 'rapide' && !ouvert, n = D.dureeParcours(ids, r.id, dep);
      h += '<label class="rythme"><input id="ob-ry-' + r.id + '" type="radio" name="rythme" value="' + r.id + '" data-c="creation"' + (r.id === choisi ? ' checked' : '') + (ferme ? ' disabled' : '') + '>' +
        '<span class="r-in"><span class="rd"></span><span><span class="r-nom">' + r.nom + '</span><small>' + esc(r.detail) + (ferme ? ' S’ouvre à partir de « Je cours déjà 20 minutes ».' : '') + '</small>' +
        (!ferme && D.dateValide(debut) ? '<span class="r-date">Arrivée vers ' + fMois.format(D.dateDe(D.plusJours(debut, n * 7 - 1))) + '</span>' : '') + '</span>' +
        (ferme ? '' : '<span class="r-sem"><b>' + n + '</b><span>' + (n > 1 ? 'semaines' : 'semaine') + '</span></span>') + '</span></label>';
    });
    return h;
  }
  function majCreation(el) {
    // Chaque choix met à jour les étapes, les durées et les dates, sans toucher au reste du formulaire.
    var f = document.querySelector('form[data-f="demarrer"]'); if (!f) return;
    var but = { dist: f.dist.value, deniv: f.deniv.value || null }, niv = f.niveau.value, ry = f.rythme.value || 'regulier', l = D.etapes(but);
    if (ry === 'rapide' && !D.rapidePermis({ niveau: niv })) ry = 'regulier';
    document.getElementById('ob-nb').textContent = l.length + (l.length > 1 ? ' médailles' : ' médaille');
    document.getElementById('ob-etapes').innerHTML = etapesCreation(but);
    document.getElementById('ob-rythmes').innerHTML = rythmesCreation(but, niv, ry, f.debut.value);
    if (el && el.name === 'rythme') { var r = document.getElementById(el.id); if (r) { try { r.focus({ preventScroll: true }); } catch (e) {} } }
  }
  function vueDepart() {
    var but = D.lireBut(null), debut = D.prochainLundi(auj()), nbE = D.etapes(but).length;
    var h = '<section class="bandeau"><p class="sur">Le Dossard</p><h1 class="geant">Ton premier dossard</h1>' +
      '<p>Dis où tu veux arriver. L’appli pose les étapes et le calendrier.</p></section>';
    if (Depot.aLocal()) h += '<div class="bloc"><div class="encadre"><strong>Des données du Dossard existent déjà dans ce navigateur.</strong>' +
      '<span>Elles datent d’une visite où l’enregistrement dans ton compte n’était pas disponible.</span>' +
      '<div class="actions-sem" style="border:0"><button class="lien" type="button" data-a="reprendre-local">Les reprendre</button></div></div></div>';
    h += '<form class="bloc" data-f="demarrer" novalidate>' +
      '<div class="champ"><label for="ob-prenom">Ton prénom, pour le dossard</label><input id="ob-prenom" name="prenom" type="text" maxlength="20" autocomplete="given-name" value="' + (window.DOSSARD_AUTONOME ? '' : 'Val') + '"></div>' +
      '<fieldset class="champ"><legend>Ton objectif</legend><div class="tuiles deux">';
    D.BUTS.dist.forEach(function (id) {
      h += '<label class="tuile"><input id="ob-dist-' + id + '" type="radio" name="dist" value="' + id + '" data-c="creation"' + (id === but.dist ? ' checked' : '') + '><span class="t-in">' + pastille(D.objectif(id)) +
        '<span><b>' + NOMS_TUILES[id][0] + '</b><small>' + NOMS_TUILES[id][1] + '</small></span></span></label>';
    });
    h += '</div></fieldset><fieldset class="champ"><legend>Avec du dénivelé, en une sortie ?</legend><div class="tuiles quatre">';
    [''].concat(D.BUTS.deniv).forEach(function (id) {
      var o = id ? D.objectif(id) : null;
      h += '<label class="tuile"><input id="ob-deniv-' + (id || 'sans') + '" type="radio" name="deniv" value="' + id + '" data-c="creation"' + (id === (but.deniv || '') ? ' checked' : '') + '><span class="t-in">' +
        (o ? pastille(o) : '<span class="pm"><span>–</span></span>') + '<b>' + (o ? D.mil(+o.court) + ' m' : 'Sans') + '</b></span></label>';
    });
    h += '</div></fieldset><div class="champ"><div class="rang"><span class="sur gris">Tes étapes</span><span class="sur gris" id="ob-nb">' + nbE + ' médailles</span></div>' +
      '<div class="parcours-e" id="ob-etapes" aria-live="polite">' + etapesCreation(but) + '</div><p class="aide">Chaque étape a sa médaille, son dossard et sa préparation.</p></div>' +
      '<fieldset class="champ"><legend>Où en es-tu aujourd’hui ?</legend>';
    D.DEPARTS.forEach(function (d, i) {
      h += '<label class="choix"><input id="ob-niv-' + d.id + '" type="radio" name="niveau" value="' + d.id + '" data-c="creation"' + (i === 0 ? ' checked' : '') + '><span>' + esc(d.nom) + '<small>' + esc(d.detail) + '</small></span></label>';
    });
    h += '</fieldset><fieldset class="champ"><legend>Ton rythme</legend><div id="ob-rythmes">' + rythmesCreation(but, 'zero', 'regulier', debut) + '</div>' +
      '<p class="aide">Dates estimées si tout s’enchaîne. Tu peux toujours refaire une semaine, faire une pause ou changer de rythme.</p></fieldset>' +
      '<div class="champ"><label for="ob-debut">Date de la première semaine</label><input id="ob-debut" name="debut" type="date" data-c="creation" value="' + debut + '">' +
      '<p class="aide">Tu peux choisir une date lointaine. La routine du matin et la pesée sont ouvertes tout de suite.</p></div>' +
      '<p class="aide">Ce programme est un cadre général de reprise. Fais-le valider et adapter par ton équipe médicale avant la première séance.</p>' +
      '<p class="erreur" id="ob-erreur" role="alert" hidden></p>' +
      '<button class="btn" type="submit">Créer mon programme</button></form>';
    return h;
  }
  function carteChoix(o) {
    return '<section class="carte"><div class="rang"><h2 class="titre-seance">' + esc(o.nom) + '</h2>' + medaille(o, '') + '</div>' +
      '<p class="resume">' + esc(o.critere) + ' Préparation : ' + dureeBloc(o) + ' semaines.</p>' +
      '<button class="btn" type="button" data-a="choisir" data-obj="' + o.id + '">Choisir cet objectif</button></section>';
  }
  function carteSeance(s, semId, i, etiquette) {
    return '<section class="carte"><p class="sur gris">' + etiquette + '</p><h2 class="titre-seance">' + esc(s.titre) + '</h2>' +
      '<p class="resume">' + esc(s.resume) + '</p>' + faits(s) +
      '<div class="actions"><button class="btn" type="button" data-a="ouvrir-seance" data-mode="saisie" data-sem="' + semId + '" data-i="' + i + '">Noter la séance</button></div>' +
      '<button class="lien" type="button" data-a="ouvrir-seance" data-sem="' + semId + '" data-i="' + i + '">Voir le détail de la séance</button></section>';
  }
  function carteFeuVert(pos) {
    // La question se pose avant la première séance : à partir de deux semaines avant le départ, et tant qu'elle reste sans réponse.
    if (P().feuVert || (pos.etat === 'avant' && pos.dans > 14)) return '';
    return '<section class="encadre"><strong>As-tu le feu vert de ton médecin ?</strong>' +
      '<span>Ce programme est un cadre général. Avant la première séance, fais-le valider par ton équipe médicale : elle seule peut l’adapter à ta reprise.</span>' +
      '<div class="actions-sem" style="border:0"><button class="lien" type="button" data-a="feu-oui">Oui, je l’ai</button></div></section>';
  }
  function carteDuJour(bloc, pos, a) {
    var jn = Jn(), h = '';
    if (pos.etat === 'avant') {
      var prem = D.semaine(bloc, 0).s[0];
      return '<section class="carte"><p class="sur gris">Avant le départ · dans ' + pos.dans + (pos.dans > 1 ? ' jours' : ' jour') + '</p>' +
        '<h2 class="titre-seance">Départ ' + dLong(bloc.debut) + '</h2>' +
        '<p class="resume">Première séance : ' + esc(prem.titre.toLowerCase()) + (prem.min ? ', ' + prem.min + ' min' : '') +
        '. D’ici là, la routine du matin et la pesée sont ouvertes.</p></section>' + carteFeuVert(pos);
    }
    if (pos.etat === 'apres') {
      var der = D.semaine(bloc, pos.n - 1), it = -1;
      der.s.forEach(function (s, i) { if (s.type === 'test') it = i; });
      return '<section class="carte"><p class="sur gris">Bloc terminé</p><h2 class="titre-seance">Le jour J est passé</h2>' +
        '<p class="resume">Pas de pression : passe ton test quand tu te sens prêt, ou ajoute une semaine de préparation.</p><div class="actions">' +
        (it >= 0 ? '<button class="btn" type="button" data-a="ouvrir-seance" data-sem="' + der.id + '" data-i="' + it + '">Passer le test</button>' : '') +
        '<button class="btn sec" type="button" data-a="refaire" data-k="' + (pos.n - 1) + '">Ajouter une semaine</button></div></section>';
    }
    var sem = D.semaine(bloc, pos.k), f = D.faites(jn, sem.id), nf = Object.keys(f).length;
    h += carteFeuVert(pos);
    if (pos.k >= 1 && !sem.pause && nf === 0) {
      var prec = D.semaine(bloc, pos.k - 1);
      if (!prec.pause && D.nbFaites(jn, prec.id) < 2 && !(bloc.vu && bloc.vu[prec.id])) {
        h += '<section class="encadre"><strong>La semaine dernière est restée incomplète.</strong><span>Tu peux la refaire maintenant : le jour J recule d’une semaine.</span>' +
          '<div class="actions-sem" style="border:0"><button class="lien" type="button" data-a="refaire-prec" data-k="' + pos.k + '">La refaire</button>' +
          '<button class="lien" type="button" data-a="ignorer-prec" data-sem="' + prec.id + '">Continuer comme prévu</button></div></section>';
      }
    }
    if (sem.pause) {
      return h + '<section class="carte"><p class="sur gris">Cette semaine</p><h2 class="titre-seance">Semaine de pause</h2>' +
        '<p class="resume">Pas de séance prévue. Le programme reprend ' + dLong(D.plusJours(sem.fin, 1)) + '.</p>' +
        '<div class="actions"><button class="btn sec" type="button" data-a="retirer-sem" data-k="' + pos.k + '">Retirer la pause</button></div></section>';
    }
    var i = -1;
    for (var k = 0; k < sem.s.length; k++) if (!f[k]) { i = k; break; }
    if (i < 0) {
      return h + '<section class="carte"><p class="sur gris">Cette semaine · 3 séances sur 3</p><h2 class="titre-seance">Semaine bouclée</h2>' +
        '<p class="resume">Les trois séances sont faites. ' + (pos.k < pos.n - 1 ? 'La suite démarre ' + dLong(D.plusJours(sem.fin, 1)) + '.' : 'C’était la dernière semaine du bloc.') + '</p></section>';
    }
    return h + carteSeance(sem.s[i], sem.id, i, 'Prochaine séance · ' + (i + 1) + ' sur 3 cette semaine');
  }
  function vueObjectif() {
    var p = P(), bloc = p.bloc, med = medailles(), nb = nbGagnees(), tot = parcours().length, a = auj(), h = '';
    if (!bloc) {
      h += '<section class="bandeau"><div class="rang"><span class="sur">' + (nb >= tot ? 'Objectif atteint' : 'Objectif ' + (nb + 1) + ' sur ' + tot) + '</span>' + boutonReglages() + '</div>';
      if (nb >= tot) h += '<h1 class="geant">Tout est décroché</h1><p>' + (tot >= 7 ? 'Les sept médailles sont' : (tot > 1 ? 'Les ' + tot + ' médailles de ton parcours sont' : 'La médaille de ton parcours est')) + ' sur ton porte-médailles, ' + esc(p.prenom) + '.</p></section><div class="bloc">' +
        (tot < 7 ? '<div class="carte"><h2 class="sur gris">Et maintenant ?</h2><p class="resume">Tu peux viser plus loin. Choisis un nouvel objectif dans les Réglages : tes médailles restent.</p><div class="actions"><button class="btn sec petit" type="button" data-a="reglages">Choisir un nouvel objectif</button></div></div>' : '');
      else {
        h += '<h1 class="geant">Choisis ton prochain dossard</h1><p>' + (nb ? 'Une médaille de plus au mur. La suivante se choisit ici.' : 'Aucun objectif en cours pour l’instant.') + '</p></section><div class="bloc">';
        parcours().forEach(function (o) { if (D.disponible(o, med)) h += carteChoix(o); });
      }
      return h + ratelier() + '</div>';
    }
    var o = D.objectif(bloc.obj), pos = D.position(bloc, a);
    var droite = pos.etat === 'avant' ? 'Avant le départ' : (pos.etat === 'apres' ? 'Bloc terminé' : 'Semaine ' + (pos.k + 1) + ' sur ' + pos.n);
    h += '<section class="bandeau"><div class="rang"><span class="sur">Objectif ' + Math.min(tot, nb + 1) + ' sur ' + tot + ' · ' + droite + '</span>' + boutonReglages() + '</div>' +
      dossard(o, p.prenom, D.jMoins(pos.reste)) +
      '<div class="prepa"><div class="rang"><span class="petit">Préparation : ' + esc(o.nom) + '</span><span class="sur">Jour J · ' + dCourt(pos.jourJ) + '</span></div>' + segments(pos) + '</div></section>';
    return h + '<div class="bloc">' + carteDuJour(bloc, pos, a) + ratelier() + '</div>';
  }

  function ligneSeance(s, semId, i, sortie) {
    return '<button class="ligne" type="button" data-a="ouvrir-seance" data-sem="' + semId + '" data-i="' + i + '">' +
      '<span class="pastille' + (sortie ? ' ok' : '') + '">' + (sortie ? '<svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"></path></svg>' : (i + 1)) + '</span>' +
      '<span class="l-g"><span class="l-titre">' + esc(s.titre) + '</span><span class="l-info">' + esc(D.court(s)) + (sortie ? ' · faite le ' + dCourt(sortie.d) : '') + '</span></span>' +
      '<span class="chevron" aria-hidden="true">›</span></button>';
  }
  function blocSemaine(bloc, k, pos, jn) {
    var sem = D.semaine(bloc, k), f = D.faites(jn, sem.id), nf = Object.keys(f).length;
    var ici = pos.etat === 'encours' && pos.k === k;
    var defaut = ici || (pos.etat === 'avant' && k === 0) || (pos.etat === 'apres' && k === pos.n - 1);
    var ouvert = S.ui.ouv[sem.id] != null ? S.ui.ouv[sem.id] : defaut, puces = '';
    if (ici) puces += '<span class="puce ici">En cours</span>';
    if (sem.pause) puces += '<span class="puce">Pause</span>';
    else {
      if (sem.test) puces += '<span class="puce">Test</span>';
      if (sem.allegee) puces += '<span class="puce">Allégée</span>';
      if (sem.conso) puces += '<span class="puce">Consolidation</span>';
      else if (sem.ajout) puces += '<span class="puce">Ajoutée</span>';
    }
    var h = '<details class="sem" data-sem="' + sem.id + '"' + (ouvert ? ' open' : '') + '><summary><span class="sem-g"><span class="sem-titre">Semaine ' + (k + 1) + '</span>' +
      '<span class="sem-dates">du ' + dCourt(sem.debut) + ' au ' + dCourt(sem.fin) + '</span></span><span class="sem-d">' + puces +
      (sem.pause ? '' : '<span class="compte" aria-label="' + nf + ' séances faites sur 3">' + nf + '/3</span>') + '</span></summary>';
    if (sem.pause) h += '<p class="aide">Pas de séance cette semaine.</p>';
    sem.s.forEach(function (s, i) { h += ligneSeance(s, sem.id, i, f[i]); });
    var act = '', aVenir = pos.etat === 'avant' || k >= pos.k;
    if (ici && !sem.pause) act += '<button class="lien" type="button" data-a="refaire" data-k="' + k + '">Refaire cette semaine ensuite</button>' +
      '<button class="lien" type="button" data-a="decaler" data-k="' + k + '">Décaler d’une semaine</button>';
    if (sem.ajout && aVenir && nf === 0) act += '<button class="lien" type="button" data-a="retirer-sem" data-k="' + k + '">' + (sem.pause ? 'Retirer la pause' : 'Retirer cette semaine') + '</button>';
    if (act) h += '<div class="actions-sem">' + act + '</div>';
    return h + '</details>';
  }
  var RESSENTIS = { facile: 'Facile', correct: 'Correct', dur: 'Dur' };
  function detailSortie(x) {
    var p = [];
    if (x.km) p.push(D.fx(x.km) + ' km');
    if (x.dp) p.push(D.mil(x.dp) + ' m D+');
    if (x.min) p.push(x.min + ' min');
    if (x.cont) p.push('sans marcher');
    if (x.res && RESSENTIS[x.res]) p.push(RESSENTIS[x.res].toLowerCase());
    return p.join(' · ');
  }
  var JOURS = [['L', 'lundi'], ['M', 'mardi'], ['M', 'mercredi'], ['J', 'jeudi'], ['V', 'vendredi'], ['S', 'samedi'], ['D', 'dimanche']];
  function valeurCase(r) { return r.km ? D.fx(r.km) : (r.min ? r.min + '′' : ''); }
  function titreSortie(x) { return x.titre || 'Sortie libre'; }
  function calendrier(m, pj, a, jourJ) {
    var h = '<table class="cal"><caption class="cache">Sorties de ' + esc(dMois(m)) + '</caption><thead><tr>';
    JOURS.forEach(function (j) { h += '<th scope="col"><abbr title="' + j[1] + '">' + j[0] + '</abbr></th>'; });
    h += '</tr></thead><tbody>';
    D.grilleMois(m).forEach(function (ligne) {
      h += '<tr>';
      ligne.forEach(function (c) {
        if (!c.dans) { h += '<td></td>'; return; }
        var js = pj[c.d], n = +c.d.slice(8), cl = [], lab = dLong(c.d);
        if (c.d === a) { cl.push('auj'); lab += ', aujourd’hui'; }
        if (c.d === jourJ) { cl.push('jj'); lab += ', jour J'; }
        if (js) {
          var r = D.resumeJour(js); cl.push(r.res);
          lab += ' : ' + js.map(function (x) { return titreSortie(x) + ', ' + detailSortie(x); }).join(' ; ') + '. Corriger';
          h += '<td><button type="button" class="' + cl.join(' ') + '" data-a="corriger" data-id="' + esc(js[0].id) + '" aria-label="' + esc(lab) + '"><span class="haut"><span class="j">' + n + '</span>' + (r.dp ? '<span class="dp">+' + r.dp + '</span>' : '') + '</span>' +
            '<span class="v">' + esc(valeurCase(r)) + (js.length > 1 ? '<small>×' + js.length + '</small>' : '') + '</span></button></td>';
        } else if (c.d > a) {
          h += '<td><span class="case ' + cl.join(' ') + '"><span class="j">' + n + '</span>' + (c.d === jourJ ? '<span class="v">J</span><span class="cache">, jour J</span>' : '') + '</span></td>';
        } else {
          h += '<td><button type="button" class="' + cl.join(' ') + '" data-a="sortie-libre" data-d="' + c.d + '" aria-label="' + esc(lab + ' : rien de noté. Ajouter une sortie') + '"><span class="j">' + n + '</span></button></td>';
        }
      });
      h += '</tr>';
    });
    return h + '</tbody></table><p class="legende cal-leg"><span><i class="facile"></i>Facile</span><span><i class="correct"></i>Correct</span><span><i class="dur"></i>Dur</span></p>' +
      '<p class="aide">Dans chaque case : les kilomètres en bas, le dénivelé en haut à droite.</p>';
  }
  function vueCarnet() {
    var a = auj(), mAuj = a.slice(0, 7), m = S.ui.mois || mAuj, p = P();
    var liste = D.duMois(Jn().sorties, m), t = D.totaux(liste), jourJ = p.bloc ? D.position(p.bloc, a).jourJ : null;
    var mMax = jourJ && jourJ.slice(0, 7) > mAuj ? jourJ.slice(0, 7) : mAuj, nom = fMoisNom.format(D.dateDe(m + '-01'));
    var h = '<section class="bandeau"><div class="rang"><span class="sur">Carnet</span><span class="sur">' + esc(dMois(m)) + '</span></div>' +
      '<h1 class="geant">' + t.n + (t.n > 1 ? ' sorties' : ' sortie') + '</h1><p>' +
      (t.n ? D.fx(t.km) + ' km et ' + D.mil(t.dp) + ' m de dénivelé ' + (m === mAuj ? 'ce mois-ci.' : 'sur le mois.')
           : (m === mAuj ? 'Rien de noté ce mois-ci pour l’instant.' : 'Rien de noté sur ce mois.')) + '</p></section><div class="bloc">';
    h += '<div class="mois"><button class="rond" type="button" id="mois-prec" data-a="mois" data-n="-1" aria-label="Mois précédent">' + icone('gauche') + '</button>' +
      '<h2 class="mois-nom">' + esc(dMois(m)) + '</h2>' +
      '<button class="rond" type="button" id="mois-suiv" data-a="mois" data-n="1" aria-label="Mois suivant"' + (m >= mMax ? ' disabled' : '') + '>' + icone('droite') + '</button></div>';
    h += calendrier(m, D.parJour(liste), a, jourJ);
    h += '<button class="btn" type="button" data-a="sortie-libre">Ajouter une sortie</button>';
    h += '<div class="carte"><h2 class="sur gris">Sorties ' + (/^[aoàâ]/i.test(nom) ? 'd’' : 'de ') + esc(nom) + '</h2>';
    if (!liste.length) return h + '<p class="aide">Touche un jour du calendrier pour y noter une sortie.</p></div></div>';
    h += '<ul class="liste serree">';
    liste.slice().sort(function (x, y) { return x.d < y.d ? 1 : (x.d > y.d ? -1 : 0); }).forEach(function (x) {
      h += '<li><button class="ligne sortie" type="button" data-a="corriger" data-id="' + esc(x.id) + '"><span class="l-g"><span class="l-date">' + dJour(x.d) + '</span>' +
        '<span class="l-titre">' + esc(titreSortie(x)) + '</span><span class="l-info">' + esc(detailSortie(x)) + (x.note ? ' · ' + esc(x.note) : '') + '</span></span>' +
        '<span class="chevron" aria-hidden="true">›</span></button></li>';
    });
    return h + '</ul></div></div>';
  }
  function boutonSuppr(genre, id) {
    var cle = genre + ':' + id;
    if (S.ui.suppr === cle) return '<span class="conf"><button class="lien danger" type="button" id="oui-' + esc(cle) + '" data-a="suppr-oui" data-genre="' + genre + '" data-id="' + esc(id) + '">Supprimer</button>' +
      '<button class="lien" type="button" data-a="suppr-non">Garder</button></span>';
    return '<button class="lien" type="button" id="sup-' + esc(cle) + '" data-a="suppr" data-cle="' + esc(cle) + '">Effacer</button>';
  }
  function vuePlan() {
    var p = P(), bloc = p.bloc, a = auj(), h = '';
    if (!bloc) {
      return '<section class="bandeau"><div class="rang"><span class="sur">Plan</span></div><h1 class="geant">Pas de plan en cours</h1>' +
        '<p>Choisis un objectif pour obtenir sa préparation semaine par semaine.</p></section>' +
        '<div class="bloc"><a class="btn" href="#medailles">Choisir un objectif</a></div>';
    }
    var o = D.objectif(bloc.obj), pos = D.position(bloc, a), jn = Jn();
    h += '<section class="bandeau"><div class="rang"><span class="sur">Plan · ' + pos.n + ' semaines</span><span class="sur">' + D.jMoins(pos.reste) + '</span></div>' +
      '<h1 class="geant">' + esc(o.nom) + '</h1><p>Trois séances par semaine, les jours qui t’arrangent, avec au moins un jour de repos entre deux. Jour J : ' + dLong(pos.jourJ) + '.</p></section><div class="bloc serre">';
    for (var k = 0; k < pos.n; k++) h += blocSemaine(bloc, k, pos, jn);
    return h + '</div>';
  }

  function vueRoutine() {
    var rt = Rt(), a = auj(), ids = D.cochesDuJour(rt, a), n = D.serie(rt, a), h = '';
    h += '<section class="bandeau"><div class="rang"><span class="sur">Routine du matin</span><span class="sur">Aujourd’hui : ' + ids.length + ' sur ' + rt.exos.length + '</span></div>' +
      '<h1 class="geant">' + n + (n > 1 ? ' matins' : ' matin') + '</h1><p>' + (n ? 'd’affilée avec la routine complète.' : 'd’affilée pour l’instant. La série démarre dès que tout est coché.') + '</p>' +
      '<div class="segments" aria-hidden="true" style="grid-template-columns:repeat(7,minmax(0,1fr))">';
    for (var i = 6; i >= 0; i--) { var d = D.plusJours(a, -i); h += '<i class="' + (D.jourComplet(rt, d) ? 'fait' : (i === 0 ? 'ici' : '')) + '"></i>'; }
    h += '</div></section><div class="bloc"><div class="rang"><h2 class="sur gris">Ta routine</h2>' +
      '<button class="lien" type="button" id="rt-edit" data-a="routine-edit">' + (S.ui.edit ? 'Terminer' : 'Modifier') + '</button></div>';
    if (!S.ui.edit) {
      if (!rt.exos.length) h += '<p class="aide">Ta routine est vide. Passe par « Modifier » pour ajouter un exercice.</p>';
      h += '<ul class="exos">';
      rt.exos.forEach(function (e) {
        h += '<li><label class="exo"><input id="ex-' + esc(e.id) + '" type="checkbox" data-c="exo" data-id="' + esc(e.id) + '"' + (ids.indexOf(e.id) >= 0 ? ' checked' : '') + '>' +
          '<span class="exo-nom">' + esc(e.nom) + '</span><span class="exo-dose">' + esc(e.dose) + '</span></label></li>';
      });
      h += '</ul><p class="aide">Des exercices au poids du corps, sans matériel. Règle les doses sur ta forme du moment.</p>' +
        '<a class="lien" href="#poids">Ensuite : note ta pesée et ta nuit</a>';
    } else {
      h += '<ul>';
      rt.exos.forEach(function (e, i) {
        h += '<li class="exo-edit"><div class="duo"><div class="champ"><label for="en-' + esc(e.id) + '">Exercice</label><input id="en-' + esc(e.id) + '" type="text" maxlength="40" value="' + esc(e.nom) + '" data-c="exo-nom" data-id="' + esc(e.id) + '"></div>' +
          '<div class="champ"><label for="ed-' + esc(e.id) + '">Dose</label><input id="ed-' + esc(e.id) + '" type="text" maxlength="20" value="' + esc(e.dose) + '" data-c="exo-dose" data-id="' + esc(e.id) + '"></div></div>' +
          '<div class="actions-sem" style="border:0">' +
          (i > 0 ? '<button class="lien" type="button" id="eh-' + esc(e.id) + '" data-a="exo-haut" data-id="' + esc(e.id) + '">Monter</button>' : '') +
          (i < rt.exos.length - 1 ? '<button class="lien" type="button" id="eb-' + esc(e.id) + '" data-a="exo-bas" data-id="' + esc(e.id) + '">Descendre</button>' : '') +
          '<button class="lien danger" type="button" data-a="exo-suppr" data-id="' + esc(e.id) + '">Retirer</button></div></li>';
      });
      h += '</ul><form class="carte" data-f="exo-ajout" novalidate><h2 class="sur gris">Ajouter un exercice</h2><div class="duo">' +
        '<div class="champ"><label for="ea-nom">Exercice</label><input id="ea-nom" name="nom" type="text" maxlength="40" placeholder="Fentes"></div>' +
        '<div class="champ"><label for="ea-dose">Dose</label><input id="ea-dose" name="dose" type="text" maxlength="20" placeholder="2 × 12"></div></div>' +
        '<p class="erreur" id="ea-erreur" role="alert" hidden></p><button class="btn sec petit" type="submit">Ajouter</button></form>';
    }
    return h + '</div>';
  }

  // Les deux courbes de la page Suivi : le poids et le score de sommeil. Même dessin, mêmes gestes de lecture.
  var COURBES = {
    'courbe': { rep: 'repere', lec: 'lecture', quoi: 'Courbe de poids', pas: 'chaque pesée',
      val: function (v) { return D.fx(v, 1); }, fin: function (v) { return D.fx(v, 1) + ' kg'; },
      lire: function (p) { return dJour(p.d) + ' : ' + D.fx(p.kg, 1) + ' kg · moyenne sur 7 jours ' + D.fx(p.moy, 1) + ' kg'; } },
    'courbe-nuit': { rep: 'repere-nuit', lec: 'lecture-nuit', quoi: 'Courbe du score de sommeil', pas: 'chaque nuit',
      val: function (v) { return String(Math.round(v)); }, fin: function (v) { return Math.round(v) + ' sur 100'; },
      lire: function (p) { return dJour(p.d) + ' : ' + p.s + ' sur 100 · moyenne sur 7 nuits ' + Math.round(p.moy); } }
  };
  function svgCourbe(c, id) {
    id = id || 'courbe';
    var o = COURBES[id], g = c.g, r = r1, der = c.pts[c.pts.length - 1];
    var h = '<svg id="' + id + '" class="courbe" viewBox="0 0 350 190" tabindex="0" role="img" aria-label="' + esc(o.quoi + ' du ' + dCourt(c.d0) + ' au ' + dCourt(c.d1) +
      '. Dernière moyenne sur 7 jours : ' + o.fin(der.moy) + '. Flèches gauche et droite pour lire ' + o.pas + '.') + '">';
    c.ticks.forEach(function (t) {
      h += '<line class="grille" x1="' + g.x0 + '" x2="' + g.x1 + '" y1="' + r(t.y) + '" y2="' + r(t.y) + '"></line>' +
        '<text class="axe" x="' + (g.x0 - 8) + '" y="' + r(t.y + 4) + '" text-anchor="end">' + t.v + '</text>';
    });
    h += '<text class="axe" x="' + g.x0 + '" y="182">' + dCourt(c.d0) + '</text>';
    if (c.span >= 12) h += '<text class="axe" x="' + r(g.x0 + (g.x1 - g.x0) * D.ecartJours(c.d0, c.milieu) / c.span) + '" y="182" text-anchor="middle">' + dCourt(c.milieu) + '</text>';
    h += '<text class="axe" x="' + g.x1 + '" y="182" text-anchor="end">' + dCourt(c.d1) + '</text>';
    function chemin(cle) { return 'M' + c.pts.map(function (p) { return r(p.x) + ' ' + r(p[cle]); }).join('L'); }
    h += '<path class="brut" d="' + chemin('y') + '"></path><path class="moy" d="' + chemin('ym') + '"></path>' +
      '<line id="' + o.rep + '" class="repere" x1="0" x2="0" y1="' + g.yh + '" y2="' + g.yb + '" visibility="hidden"></line>' +
      '<circle class="anneau" cx="' + r(der.x) + '" cy="' + r(der.ym) + '" r="6"></circle><circle class="point" cx="' + r(der.x) + '" cy="' + r(der.ym) + '" r="4"></circle>' +
      '<text class="valeur" x="' + r(der.x + 10) + '" y="' + r(der.ym + 4) + '">' + o.val(der.moy) + '</text>';
    return h + '</svg>';
  }
  function carteCourbe(c, id, titre, jours, moyenne) {
    var o = COURBES[id];
    return '<div class="carte"><h2 class="sur gris">' + titre + '</h2>' + svgCourbe(c, id) +
      '<p class="lecture" id="' + o.lec + '" aria-live="polite">' + esc(o.lire(c.pts[c.pts.length - 1])) + '</p>' +
      '<p class="legende"><span><i></i>' + jours + '</span><span><i class="m"></i>' + moyenne + '</span></p></div>';
  }
  function vuePoids() {
    // La page Suivi : la pesée et le score de sommeil du matin, chacun avec sa courbe.
    var pd = Pd(), liste = D.mesures(pd), nuits = D.nuits(pd), a = auj(), plage = S.ui.plage, h = '';
    var st = D.statsPoids(liste), sn = D.statsNuits(nuits, a);
    function vis(l) { return plage ? l.filter(function (x) { return x.d >= D.plusJours(a, -plage + 1); }) : l; }
    var nomPlage = plage === 28 ? '4 dernières semaines' : (plage === 91 ? '3 derniers mois' : 'Depuis le début');
    h += '<section class="bandeau"><div class="rang"><span class="sur">Suivi</span><span class="sur">' + nomPlage + '</span></div><div class="deux-gros">' +
      '<div><div class="gros-poids"><span class="num">' + (st ? D.fx(st.dernier.kg, 1) : '–') + '</span><span class="unite">KG</span></div>' +
      '<p>' + (st ? 'Pesée · ' + dJour(st.dernier.d) : 'Aucune pesée') + '</p></div>' +
      '<div><div class="gros-poids"><span class="num">' + (sn ? sn.dernier.s : '–') + '</span><span class="unite">/100</span></div>' +
      '<p>' + (sn ? 'Nuit · ' + dJour(sn.dernier.d) : 'Aucune nuit notée') + '</p></div></div></section><div class="bloc">';
    h += '<form class="carte" data-f="pesee" novalidate><div class="duo"><div class="champ"><label for="pe-kg">Pesée, en kg</label>' +
      '<input class="grand" id="pe-kg" name="kg" type="text" inputmode="decimal" autocomplete="off" placeholder="' + (st ? D.fx(st.dernier.kg, 1) : '75,0') + '"></div>' +
      '<div class="champ"><label for="pe-nuit">Score de sommeil</label>' +
      '<input class="grand" id="pe-nuit" name="nuit" type="text" inputmode="numeric" autocomplete="off" placeholder="' + (sn ? sn.dernier.s : '80') + '"></div></div>' +
      '<div class="champ"><label for="pe-date">Date</label><input class="grand" style="font-size:18px" id="pe-date" name="date" type="date" value="' + a + '" max="' + a + '"></div>' +
      '<p class="aide">Remplis l’un, l’autre ou les deux. Le score de sommeil est celui que ta montre affiche au réveil, sur 100.</p>' +
      '<p class="erreur" id="pe-erreur" role="alert" hidden></p><button class="btn" type="submit">Enregistrer</button></form>';
    h += '<div class="plages" role="group" aria-label="Période affichée">' +
      [[28, '4 semaines'], [91, '3 mois'], [0, 'Tout']].map(function (x) {
        return '<button type="button" id="pl-' + x[0] + '" data-a="plage" data-j="' + x[0] + '" aria-pressed="' + (plage === x[0]) + '">' + x[1] + '</button>';
      }).join('') + '</div>';
    var c = D.courbe(vis(liste), 350, 190), cn = D.courbe(vis(nuits), 350, 190, 's');
    S.ui.courbes = { 'courbe': c, 'courbe-nuit': cn };
    // Le poids
    if (c) h += carteCourbe(c, 'courbe', 'Poids du matin · kg', 'Pesées', 'Moyenne sur 7 jours');
    else h += '<p class="aide">' + (liste.length >= 2 ? 'Moins de deux pesées sur cette période : élargis la période pour voir la courbe de poids.' : 'La courbe de poids apparaît à partir de deux pesées.') + '</p>';
    if (st) {
      h += '<div class="cellules"><div class="cellule"><b>' + D.fx(st.moy7, 1) + '<small>KG</small></b><span>Moyenne sur 7 jours</span></div>';
      if (st.avant != null) {
        h += '<div class="cellule"><b>' + D.fx(st.avant, 1) + '<small>KG</small></b><span>Il y a 4 semaines</span></div>' +
          '<div class="cellule"><b>' + (st.ecart > 0.04 ? '+' : (st.ecart < -0.04 ? '−' : '')) + D.fx(Math.abs(st.ecart), 1) + '<small>KG</small></b><span>Écart</span></div>';
      }
      h += '</div>';
    }
    // Le sommeil
    if (cn) h += carteCourbe(cn, 'courbe-nuit', 'Score de sommeil · sur 100', 'Nuits', 'Moyenne sur 7 nuits');
    else h += '<p class="aide">' + (nuits.length >= 2 ? 'Moins de deux nuits sur cette période : élargis la période pour voir la courbe de sommeil.' : 'La courbe de sommeil apparaît à partir de deux nuits notées.') + '</p>';
    if (sn) {
      h += '<div class="cellules"><div class="cellule"><b>' + Math.round(sn.moy7) + '</b><span>Moyenne sur 7 nuits</span></div>' +
        '<div class="cellule"><b>' + sn.cours + '</b><span>' + (sn.cours > 1 ? 'Nuits' : 'Nuit') + ' d’affilée à ' + D.SEUIL_NUIT + ' ou plus</span></div>' +
        '<div class="cellule"><b>' + sn.max + '</b><span>Meilleure série</span></div></div>';
    }
    if (st) {
      h += '<div class="carte"><h2 class="sur gris">Dernières pesées</h2><ul class="liste">';
      liste.slice(-7).reverse().forEach(function (x) {
        h += '<li><span class="l-g"><span class="l-date">' + dJour(x.d) + '</span><span class="l-titre">' + D.fx(x.kg, 1) + ' kg</span></span>' + boutonSuppr('pesee', x.d) + '</li>';
      });
      h += '</ul></div>';
    }
    if (sn) {
      h += '<div class="carte"><h2 class="sur gris">Dernières nuits</h2><ul class="liste">';
      nuits.slice(-7).reverse().forEach(function (x) {
        h += '<li><span class="l-g"><span class="l-date">' + dJour(x.d) + '</span><span class="l-titre">' + x.s + ' sur 100</span></span>' + boutonSuppr('nuit', x.d) + '</li>';
      });
      h += '</ul></div>';
    }
    return h + '</div>';
  }

  function etatObjectif(o) {
    // Où en est une médaille du parcours : sert à la carte « prochaine étape » et à sa fiche.
    var med = medailles(), bloc = P().bloc;
    if (med[o.id]) return { cle: 'gagnee', texte: 'Décrochée le ' + dAn(med[o.id]) + '.' };
    if (bloc && bloc.obj === o.id) return { cle: 'cours', texte: 'Objectif en cours · ' + D.jMoins(D.position(bloc, auj()).reste) };
    if (D.disponible(o, med)) return { cle: 'dispo', texte: 'Disponible · ' + dureeBloc(o) + ' semaines de préparation' };
    return { cle: 'attente', texte: 'À débloquer : il faut d’abord ' + D.manquants(o, med).map(function (x) { return D.objectif(x).nom; }).join(' et ') + '.' };
  }
  function vueMedailles() {
    // La vitrine : le parcours en une ligne, la suite dans une carte, puis les bonus en grille par thème. Le détail s'ouvre au toucher.
    var med = medailles(), nb = nbGagnees(), liste = parcours(), tot = liste.length, bo = bonus(), ctx = ctxBonus();
    var nbBo = D.clesBonus(true).filter(function (k) { return bo[k]; }).length, totBo = D.totalBonus(bo);
    var etats = liste.map(etatObjectif), cours = null, dispo = [];
    var h = '<section class="bandeau"><div class="rang"><span class="sur">Médailles</span><span class="sur">Bonus : ' + nbBo + ' sur ' + totBo + '</span></div>' +
      '<h1 class="geant">' + nb + ' sur ' + tot + '</h1><p>' + (nb >= tot ? 'Objectif atteint : ' : 'Objectif : ') + esc(D.nomBut(butCourant())) + '.</p></section><div class="bloc serre">' +
      '<div class="rang"><h2 class="sur gris">Ton parcours</h2><span class="sur gris">' + nb + ' sur ' + tot + '</span></div><div class="vitrine-parcours"><div class="barre"></div><ul class="medailles' + (tot < 4 ? ' peu' : '') + '">';
    liste.forEach(function (o, k) {
      if (etats[k].cle === 'cours') cours = o; else if (etats[k].cle === 'dispo') dispo.push(o);
      h += '<li><button class="vm" type="button" data-a="fiche" data-obj="' + o.id + '" aria-label="' + esc(o.nom + ' : ' + etats[k].texte) + '">' + medaille(o, classeMed(o)) + '</button></li>';
    });
    h += '</ul></div>';
    if (cours || dispo.length) {
      h += '<div class="prochaine">';
      if (cours) h += '<p class="sur gris">Objectif en cours</p><div class="pr-ligne"><div><h3>' + esc(cours.nom) + '</h3><p>' + esc(cours.critere) + ' ' + esc(D.jMoins(D.position(P().bloc, auj()).reste)) + '.</p></div><a class="btn sec petit" href="#plan">Le plan</a></div>';
      if (dispo.length) h += '<p class="sur gris">' + (cours ? 'Aussi disponible' : (dispo.length > 1 ? 'Prochaines étapes, au choix' : 'Prochaine étape')) + '</p>';
      dispo.forEach(function (o) {
        h += '<div class="pr-ligne"><div><h3>' + esc(o.nom) + '</h3><p>' + esc(o.critere) + ' ' + dureeBloc(o) + ' semaines de préparation.</p></div>' +
          '<button class="btn sec petit" type="button" data-a="choisir" data-obj="' + o.id + '" aria-label="' + esc('Choisir l’objectif ' + o.nom) + '">Choisir</button></div>';
      });
      h += '</div>';
    }
    h += '<div class="rang entete-bonus"><h2 class="sur gris">Bonus</h2><span class="sur gris">' + nbBo + ' sur ' + totBo + '</span></div>';
    D.THEMES.forEach(function (t) {
      h += '<h3 class="theme sur gris">' + esc(t.nom) + '</h3><ul class="trois">';
      t.ids.forEach(function (id) { h += caseBonus(D.bonus(id), bo, ctx); });
      h += '</ul>';
    });
    return h + '<p class="aide">Trois points : bronze, argent, or. Un seul point : une médaille unique, en or d’emblée. Touche une médaille pour voir son détail.</p></div>';
  }
  function fFiche() {
    // La fiche d'une médaille, ouverte depuis la vitrine
    var f = S.f, h;
    if (f.obj) {
      var o = D.objectif(f.obj), e = etatObjectif(o), agir = e.cle === 'dispo' || e.cle === 'cours';
      h = tete(o.nom, !agir) + '<div class="bloc fiche">' + medaille(o, classeMed(o)) + '<p class="f-crit">' + esc(o.critere) + '</p><p class="f-etat">' + esc(e.texte) + '</p>';
      if (e.cle === 'dispo') h += '<button class="btn" type="button" data-a="choisir" data-obj="' + o.id + '" data-focus>Choisir cet objectif</button>';
      else if (e.cle === 'cours') h += '<button class="btn sec" type="button" data-a="aller-plan" data-focus>Voir le plan</button>';
      return h + '</div>';
    }
    var b = D.bonus(f.bonus), bo = bonus(), ctx = ctxBonus();
    if (!b.paliers) {
      return tete(b.nom, true) + '<div class="bloc fiche">' + medailleBonus(b.icone, bo[b.id] ? 'or' : '') + '<p class="f-crit">' + esc(b.critere) + '</p>' +
        '<p class="f-etat">' + (bo[b.id] ? 'Décrochée le ' + dAn(bo[b.id]) + '.' : 'Pas encore décrochée.') + '</p>' + (bo[b.id] ? '<p class="f-mot">' + esc(b.mot) + '</p>' : '') + '</div>';
    }
    var niv = D.niveauBonus(b.id, bo), su = D.suiviBonus(b.id, ctx, niv);
    h = tete(b.nom, true) + '<div class="bloc fiche">' + medailleBonus(iconeBonus(b, niv), niv ? D.RANGS[niv - 1] : '') +
      '<p class="f-val">' + esc(su.valeur) + '</p><p class="f-crit">' + esc(b.critere) + '</p>' + pisteBonus(b, Math.min(3, niv), su) +
      (niv >= 3 ? '<div class="secret"><div class="rang"><span class="sur">Palier secret · platine</span><span class="sur">' + esc(b.platine.icone ? b.platine.t : b.platine.l) + '</span></div>' +
        '<i class="jauge" role="img" aria-label="' + esc('Vers le platine : ' + Math.round(su.partPlatine * 100) + ' %') + '"><b style="width:' + (su.partPlatine * 100).toFixed(1) + '%"></b></i></div>' : '') +
      '<p class="f-etat">' + esc(su.phrase) + '</p><ul class="paliers">';
    D.paliersBonus(b.id, ctx, bo).forEach(function (q) {
      h += '<li' + (q.date ? ' class="ok"' : '') + '><i class="pt' + (q.date ? ' ' + q.niveau : '') + '"></i><b>' + q.nom + '</b><span>' + esc(q.seuil) + ' · ' + (q.date ? 'décroché le ' + dAn(q.date) : 'encore ' + esc(q.reste)) + '</span></li>';
    });
    return h + '</ul></div>';
  }

  // ---------- Feuilles ----------
  function tete(titre, focus) {
    return '<div class="tete"><h1 id="f-titre">' + esc(titre) + '</h1><button class="rond" style="margin:0" type="button" data-a="fermer" aria-label="Fermer"' + (focus ? ' data-focus' : '') + '>' + icone('fermer') + '</button></div>';
  }
  var LIBRE = { type: 'libre', titre: 'Sortie libre', resume: '', etapes: [], min: null, km: null, dp: null, conseil: '' };
  function sortieParId(id) { var l = Jn().sorties; for (var i = 0; i < l.length; i++) if (l[i].id === id) return l[i]; return null; }
  function seanceDuPlan(ref) {
    var bloc = P() && P().bloc; if (!ref || !bloc) return null;
    for (var k = 0; k < bloc.semaines.length; k++) if (bloc.semaines[k].id === ref.w) return D.semaine(bloc, k).s[ref.i] || null;
    return null;
  }
  // La feuille ouverte désigne soit une séance du plan (sem, i), soit une sortie déjà notée (id), soit une sortie libre à créer.
  function sortieCourante() {
    var f = S.f; if (!f) return null;
    if (f.id) return sortieParId(f.id);
    return f.libre ? null : (D.faites(Jn(), f.sem)[f.i] || null);
  }
  function seanceCourante() {
    var f = S.f; if (!f) return null;
    if (f.id) { var x = sortieParId(f.id); return (x && seanceDuPlan(x.ref)) || LIBRE; }
    return f.libre ? LIBRE : seanceDuPlan({ w: f.sem, i: f.i });
  }
  function fSeance() {
    var s = seanceCourante(), x = sortieCourante();
    if (!s) return tete('Séance') + '<div class="bloc"><p>Cette séance n’existe plus dans ton plan.</p></div>';
    var h = tete(s.titre) + '<div class="bloc"><p class="resume" style="font-size:16px;line-height:22px">' + esc(s.resume) + '</p>' + faits(s);
    if (s.conseil) h += '<p class="aide">' + esc(s.conseil) + '</p>';
    if (x) h += '<div class="encadre"><strong>Séance notée le ' + dLong(x.d) + '</strong><span>' + esc(detailSortie(x)) + (x.note ? ' · ' + esc(x.note) : '') + '</span>' +
      '<div class="actions-sem" style="border:0">' + boutonSuppr('sortie', x.id) + '</div></div>';
    h += '<div class="actions"><button class="btn" type="button" data-a="noter" data-focus>' + (x ? 'Corriger la saisie' : 'Noter la séance') + '</button></div>';
    if (s.etapes.length > 1) {
      h += '<h2 class="sur gris" style="margin-top:8px">Déroulé</h2><ol class="etapes">';
      s.etapes.forEach(function (e) { h += '<li class="' + (e.t === 'marche' ? '' : 'fort') + '"><b>' + D.minTxt(e.s) + '</b><span>' + esc(e.l) + '</span></li>'; });
      h += '</ol>';
    }
    return h + '</div>';
  }
  function fSaisie() {
    var f = S.f, s = seanceCourante() || LIBRE, x = sortieCourante(), a = auj(), p = P(), med = medailles();
    var libre = s.type === 'libre', pre = s.type !== 'test' && !libre;
    var km = x ? (x.km ? D.fx(x.km) : '') : (pre && s.km != null ? D.fx(s.km) : '');
    var dp = x ? (x.dp || '') : (pre && s.dp != null ? s.dp : '');
    var min = x ? (x.min || '') : (s.min != null ? s.min : '');
    var res = x && x.res ? x.res : 'correct', date = x ? x.d : (f.date || a);
    var titre = x ? titreSortie(x) : (libre ? '' : s.titre);
    var h = tete(x ? 'Corriger la sortie' : (libre ? 'Noter une sortie' : 'Noter la séance')) + '<form class="bloc" data-f="sortie" novalidate>' +
      '<p class="resume">' + (titre ? esc(titre) + '. ' : '') + 'Recopie la distance et le dénivelé depuis ta montre.</p>' +
      '<div class="champ"><label for="so-date">Date</label><input id="so-date" name="date" type="date" value="' + date + '" max="' + a + '"></div>' +
      '<div class="duo"><div class="champ"><label for="so-km">Distance, en km</label><input id="so-km" name="km" type="text" inputmode="decimal" autocomplete="off" value="' + esc(km) + '" data-focus></div>' +
      '<div class="champ"><label for="so-dp">Dénivelé, en mètres</label><input id="so-dp" name="dp" type="text" inputmode="numeric" autocomplete="off" value="' + esc(dp) + '"></div></div>' +
      '<fieldset class="champ"><legend>Comment tu t’es senti</legend><div class="seg">';
    Object.keys(RESSENTIS).forEach(function (k) {
      h += '<label><input id="so-res-' + k + '" type="radio" name="res" value="' + k + '"' + (k === res ? ' checked' : '') + '><span>' + RESSENTIS[k] + '</span></label>';
    });
    h += '</div></fieldset>' +
      '<div class="champ"><label for="so-min">Durée, en minutes (facultatif)</label><input id="so-min" name="min" type="text" inputmode="numeric" autocomplete="off" value="' + esc(min) + '"></div>' +
      '<div class="champ"><label for="so-note">Note (facultatif)</label><input id="so-note" name="note" type="text" maxlength="120" value="' + esc(x && x.note ? x.note : '') + '"></div>';
    // La case « sans marcher » ne sert qu'aux médailles 5 km et 10 km : elle disparaît une fois les deux décrochées.
    if (!(med['5k'] && med['10k']) || (x && x.cont)) {
      h += '<label class="choix"><input id="so-cont" name="cont" type="checkbox"' + (x && x.cont ? ' checked' : '') + '><span>J’ai couru toute la distance sans marcher<small>Nécessaire pour les médailles 5 km et 10 km.</small></span></label>';
    }
    if (!x && libre && p.bloc && D.position(p.bloc, a).etat !== 'avant') {
      h += '<label class="choix"><input id="so-plan" name="plan" type="checkbox" checked><span>Compter comme une séance du plan<small>Elle valide la première séance encore à faire dans la semaine de cette date.</small></span></label>';
    }
    h += '<p class="erreur" id="so-erreur" role="alert" hidden></p><button class="btn" type="submit">Enregistrer</button>';
    if (x) h += '<div class="actions-sem" style="border:0">' + boutonSuppr('sortie', x.id) + '</div>';
    return h + '</form>';
  }
  function fBravo() {
    var ids = S.f.gagnees || [], bs = S.f.bonus || [], h, autres;
    if (ids.length) {
      var o = D.objectif(ids[ids.length - 1]);
      autres = ids.slice(0, -1).map(function (i) { return D.objectif(i).nom; }).concat(bs.map(nomCle));
      h = '<div class="bravo"><p class="sur">' + (ids.length > 1 ? ids.length + ' médailles décrochées' : 'Médaille décrochée') + '</p>' +
        '<h1 class="geant" id="f-titre">' + esc(o.nom) + '</h1>' + medaille(o, 'gagnee') +
        '<p class="mot">' + esc(o.critere.replace(/\.$/, '')) + ' : c’est fait, ' + esc(P().prenom) + '.</p>';
    } else {
      var x = D.lireCle(bs[0]);
      autres = bs.slice(1).map(nomCle);
      h = '<div class="bravo"><p class="sur">' + (bs.length > 1 ? bs.length + ' médailles bonus' : (x.n ? ['Médaille de bronze', 'Médaille d’argent', 'Médaille d’or', 'Médaille de platine'][x.n - 1] : 'Médaille d’or')) + '</p>' +
        '<h1 class="geant" id="f-titre">' + esc(x.n && x.p.icone ? x.p.t : x.b.nom) + '</h1>' + medailleCle(bs[0]) +
        (x.n ? '<p class="palier">' + esc(x.p.l) + '</p>' : '') +
        '<p class="mot">' + esc(x.n ? x.p.mot : x.b.mot) + '</p>' +
        (x.n === 3 ? '<p class="indice">Un dernier palier, secret, vient de s’ouvrir.</p>' : '');
    }
    if (autres.length) h += '<p>Avec, au passage : ' + autres.map(esc).join(', ') + '.</p>';
    var suite = ids.length && nbGagnees() < parcours().length ? 'Choisir le prochain objectif' : 'Voir mes médailles';
    return h + '<div class="actions"><button class="btn clair" type="button" data-a="apres-bravo" data-focus>' + suite + '</button>' +
      '<button class="btn sec" style="color:#FFFFFF;border-color:#FFFFFF" type="button" data-a="fermer">Fermer</button></div></div>';
  }
  function fChoisir() {
    var o = D.objectif(S.f.obj), p = P(), a = auj(), n = dureeBloc(o);
    var h = tete('Nouvel objectif') + '<form class="bloc" data-f="lancer-bloc" novalidate><div style="background:var(--bleu);margin:-20px -20px 0;padding:18px 20px 22px;display:flex;flex-direction:column">' + dossard(o, p.prenom, n + ' sem.') + '</div>' +
      '<p class="resume" style="font-size:16px;line-height:22px">' + esc(o.critere) + ' La préparation dure ' + n + ' semaines, à raison de trois séances par semaine.</p>';
    if (o.id === '5k') {
      h += '<fieldset class="champ"><legend>Où en es-tu aujourd’hui ?</legend>';
      D.DEPARTS.forEach(function (d, i) {
        h += '<label class="choix"><input id="ch-niv-' + d.id + '" type="radio" name="niveau" value="' + d.id + '"' + (i === 0 ? ' checked' : '') + '><span>' + esc(d.nom) + '<small>' + esc(d.detail) + '</small></span></label>';
      });
      h += '</fieldset>';
    }
    h += '<div class="champ"><label for="ch-debut">Date de la première semaine</label><input id="ch-debut" name="debut" type="date" value="' + D.prochainLundi(a) + '" data-focus></div>';
    if (p.bloc) h += '<p class="aide">Ton objectif en cours (' + esc(D.objectif(p.bloc.obj).nom) + ') sera remplacé. Tes sorties déjà notées restent dans le carnet.</p>';
    return h + '<p class="erreur" id="ch-erreur" role="alert" hidden></p><button class="btn" type="submit">Lancer la préparation</button></form>';
  }
  function exportTexte() {
    return JSON.stringify({ app: 'le-dossard', v: 1, exporte: auj(), profil: P(), journal: Jn(), routine: Rt(), poids: Pd() });
  }
  function fReglages() {
    var p = P(), h = tete('Réglages') + '<div class="bloc">';
    h += '<form class="carte" data-f="prenom" novalidate><div class="champ"><label for="rg-prenom">Prénom sur le dossard</label><div class="en-ligne"><input id="rg-prenom" name="prenom" type="text" maxlength="20" value="' + esc(p.prenom) + '"><button class="btn petit" type="submit">Changer</button></div></div></form>';
    if (p.bloc) {
      h += '<form class="carte" data-f="debut" novalidate><div class="champ"><label for="rg-debut">Première semaine du bloc en cours</label><div class="en-ligne"><input id="rg-debut" name="debut" type="date" value="' + p.bloc.debut + '"><button class="btn petit" type="submit">Changer</button></div>' +
        '<p class="aide">Changer cette date déplace toutes les semaines et le jour J.</p></div></form>';
    }
    var but = butCourant(), ry = D.lireRythme(p), nbP = parcours().length, rapide = D.rapidePermis(p);
    h += '<form class="carte" data-f="objectif" novalidate><h2 class="sur gris">Ton objectif</h2><div class="duo"><div class="champ"><label for="rg-dist">Distance</label><select id="rg-dist" name="dist">';
    D.BUTS.dist.forEach(function (id) { h += '<option value="' + id + '"' + (id === but.dist ? ' selected' : '') + '>' + esc(D.objectif(id).nom) + '</option>'; });
    h += '</select></div><div class="champ"><label for="rg-deniv">Dénivelé</label><select id="rg-deniv" name="deniv"><option value="">Sans</option>';
    D.BUTS.deniv.forEach(function (id) { h += '<option value="' + id + '"' + (id === but.deniv ? ' selected' : '') + '>' + esc(D.objectif(id).nom) + '</option>'; });
    h += '</select></div></div><p class="aide">Aujourd’hui : ' + esc(D.nomBut(but)) + ', soit ' + nbP + (nbP > 1 ? ' médailles' : ' médaille') + '. Les médailles déjà décrochées restent.</p>' +
      '<button class="btn sec petit" type="submit">Changer d’objectif</button></form>';
    h += '<form class="carte" data-f="rythme" novalidate><fieldset class="champ"><legend>Ton rythme</legend>';
    D.RYTHMES.forEach(function (r) {
      var ferme = r.id === 'rapide' && !rapide;
      h += '<label class="choix"><input id="rg-ry-' + r.id + '" type="radio" name="rythme" value="' + r.id + '"' + (r.id === ry ? ' checked' : '') + (ferme ? ' disabled' : '') + '><span>' + r.nom +
        '<small>' + esc(r.detail) + (ferme ? ' S’ouvre une fois les 5 km décrochés.' : '') + '</small></span></label>';
    });
    h += '</fieldset><p class="aide">Le changement vaut pour les semaines qui restent et pour les prochaines préparations.</p><button class="btn sec petit" type="submit">Changer de rythme</button></form>';
    h += '<p class="erreur" id="rg-erreur" role="alert" hidden></p>';
    h += '<div class="carte"><h2 class="sur gris">Feu vert médical</h2><p class="resume">' + (p.feuVert ? 'Confirmé le ' + dAn(p.feuVert) + '.' : 'Pas encore confirmé. La question t’attend sur l’accueil avant la première séance.') + '</p></div>';
    h += '<div class="carte"><h2 class="sur gris">Tes données</h2><p class="resume">' + (S.mode === 'nuage'
      ? 'Elles sont enregistrées avec cette page, dans un espace privé lié à ton compte : tu les retrouves sur tous tes appareils.'
      : 'Elles sont enregistrées dans ce navigateur uniquement. Fais une copie de temps en temps.') + '</p>' +
      '<div class="actions"><button class="btn sec petit" type="button" data-a="copier">Copier mes données</button></div>' +
      (S.ui.copie ? '<div class="champ"><label for="rg-copie">Copie de tes données</label><textarea id="rg-copie" readonly>' + esc(S.ui.copie) + '</textarea><p class="aide">Si la copie automatique a échoué, sélectionne ce texte et copie-le.</p></div>' : '') +
      '<form class="carte" data-f="importer" novalidate><div class="champ"><label for="rg-import">Restaurer une copie</label><textarea id="rg-import" name="texte" placeholder="Colle ici une copie de tes données"></textarea></div>' +
      '<label class="choix"><input id="rg-import-ok" name="ok" type="checkbox"><span>Remplacer toutes mes données actuelles par cette copie</span></label>' +
      '<button class="btn sec petit" type="submit">Restaurer</button></form></div>';
    h += '<form class="carte" data-f="effacer" novalidate><h2 class="sur gris">Tout effacer</h2><div class="champ"><label for="rg-efface">Écris EFFACER pour repartir de zéro</label><div class="en-ligne"><input id="rg-efface" name="mot" type="text" autocomplete="off"><button class="btn petit" style="background:var(--alerte)" type="submit">Effacer</button></div></div></form>';
    h += '<div class="carte"><h2 class="sur gris">À propos du programme</h2><p class="aide">Trois séances par semaine, une progression par petits paliers et une semaine allégée toutes les trois ou quatre semaines. Le premier bloc alterne marche et course. La routine du matin ajoute le renforcement. C’est un cadre général, pas un avis médical : en cas de douleur, de fatigue inhabituelle ou de doute, lève le pied et parles-en à ton médecin.</p></div>';
    return h + '</div>';
  }
  function rendreFeuille(focus) {
    var f = S.f;
    var fond = document.getElementById('app');
    if (!f) { feuille.hidden = true; feuille.innerHTML = ''; document.body.classList.remove('fige'); fond.inert = false; return; }
    var actif = document.activeElement && document.activeElement.id, h;
    if (f.type === 'seance') h = f.mode === 'saisie' ? fSaisie() : f.mode === 'bravo' ? fBravo() : fSeance();
    else if (f.type === 'choisir') h = fChoisir();
    else if (f.type === 'fiche') h = fFiche();
    else h = fReglages();
    feuille.innerHTML = '<div class="panneau" role="dialog" aria-modal="true" aria-labelledby="f-titre">' + h + '</div>';
    feuille.hidden = false; document.body.classList.add('fige'); fond.inert = true;
    var cible = focus ? feuille.querySelector('[data-focus]') : (actif ? document.getElementById(actif) : null);
    if (cible) { try { cible.focus({ preventScroll: !focus }); } catch (e) {} }
  }
  function ouvrirFeuille(f) { S.f = f; S.ui.suppr = null; rendreFeuille(true); }
  function fermerFeuille(sansRendu) { S.f = null; S.ui.copie = null; rendreFeuille(); if (!sansRendu) rendre(); }
  function haut() {
    var e = S.ui.versBonus ? vue.querySelector('.entete-bonus') : null; S.ui.versBonus = false;
    if (e) e.scrollIntoView(); else window.scrollTo(0, 0);
  }
  function allerA(r) { if (route() === r) { rendre(); haut(); } else location.hash = '#' + r; }

  // ---------- Rendu ----------
  function route() { var h = (location.hash || '').replace(/^#/, ''); return ROUTES.indexOf(h) >= 0 ? h : 'objectif'; }
  function rendre() {
    S.aRendre = false;
    var actif = document.activeElement && vue.contains(document.activeElement) ? document.activeElement.id : null;
    var r = route(), nav = false, h;
    if (!S.pret) h = vueChargement();
    else if (!P()) h = banniere() + vueDepart();
    else {
      nav = true;
      h = banniere() + (r === 'plan' ? vuePlan() : r === 'carnet' ? vueCarnet() : r === 'routine' ? vueRoutine() : r === 'poids' ? vuePoids() : r === 'medailles' ? vueMedailles() : vueObjectif());
    }
    vue.innerHTML = h; vue.setAttribute('data-vue', !S.pret ? 'chargement' : (nav ? r : 'depart'));
    onglets.hidden = !nav;
    Array.prototype.forEach.call(onglets.querySelectorAll('a'), function (a) {
      if (a.getAttribute('href') === '#' + r) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
    if (actif) { var el = document.getElementById(actif); if (el) { try { el.focus({ preventScroll: true }); } catch (e) {} } }
  }
  // Rendu demandé par l'arrière-plan (données reçues, état de l'enregistrement) : on n'interrompt pas une saisie en cours.
  function rendreFond() {
    var el = document.activeElement;
    if (el && vue.contains(el) && /^(INPUT|TEXTAREA)$/.test(el.tagName) && el.type !== 'checkbox' && el.type !== 'radio') { S.aRendre = true; return; }
    rendre();
  }
  function erreur(id, msg) { var el = document.getElementById(id); if (el) { el.textContent = msg; el.hidden = !msg; } }

  // ---------- Actions ----------
  function blocEtPos() { var b = P().bloc; return { b: b, pos: D.position(b, auj()) }; }
  function indexSemaine(bloc, id) { for (var k = 0; k < bloc.semaines.length; k++) if (bloc.semaines[k].id === id) return k; return -1; }
  function selCourbe(i, id) {
    id = id || 'courbe';
    var c = (S.ui.courbes || {})[id], o = COURBES[id]; if (!c) return;
    i = Math.max(0, Math.min(c.pts.length - 1, i)); (S.ui.sel || (S.ui.sel = {}))[id] = i;
    var p = c.pts[i], rep = document.getElementById(o.rep), lec = document.getElementById(o.lec);
    if (rep) { rep.setAttribute('x1', r1(p.x)); rep.setAttribute('x2', r1(p.x)); rep.setAttribute('visibility', 'visible'); }
    if (lec) lec.textContent = o.lire(p);
  }
  function pointeCourbe(ev) {
    var svg = ev.target.closest && ev.target.closest('svg.courbe'), c = svg && (S.ui.courbes || {})[svg.id]; if (!c) return;
    var b = svg.getBoundingClientRect(), x = (ev.clientX - b.left) / b.width * 350, best = 0, d = Infinity;
    c.pts.forEach(function (p, i) { var e = Math.abs(p.x - x); if (e < d) { d = e; best = i; } });
    selCourbe(best, svg.id);
  }
  var ACTIONS = {
    'reglages': function () { ouvrirFeuille({ type: 'reglages' }); },
    'fermer': function () { fermerFeuille(); },
    'fiche': function (el) { ouvrirFeuille({ type: 'fiche', obj: el.getAttribute('data-obj'), bonus: el.getAttribute('data-bonus') }); },
    'aller-plan': function () { fermerFeuille(true); allerA('plan'); },
    'reessayer': function () { Depot.reessayer(); },
    'reprendre-local': function () { Depot.reprendreLocal(); allerA('objectif'); dire('Données de ce navigateur reprises.'); },
    'ouvrir-seance': function (el) {
      ouvrirFeuille({ type: 'seance', mode: el.getAttribute('data-mode') === 'saisie' ? 'saisie' : 'detail', sem: el.getAttribute('data-sem'), i: +el.getAttribute('data-i') });
    },
    'sortie-libre': function (el) { ouvrirFeuille({ type: 'seance', mode: 'saisie', libre: true, date: el.getAttribute('data-d') || null }); },
    'corriger': function (el) { ouvrirFeuille({ type: 'seance', mode: 'saisie', id: el.getAttribute('data-id') }); },
    'noter': function () { S.f.mode = 'saisie'; rendreFeuille(true); },
    'feu-oui': function () { P().feuVert = auj(); garder('profil'); rendre(); dire('C’est noté. Bonne reprise.'); },
    'mois': function (el) {
      var n = +el.getAttribute('data-n');
      S.ui.mois = D.plusMois(S.ui.mois || auj().slice(0, 7), n); rendre();
      var b = document.getElementById(n < 0 ? 'mois-prec' : 'mois-suiv'); if (b && !b.disabled) b.focus();
    },
    'apres-bravo': function () { var seulBonus = !(S.f.gagnees || []).length; fermerFeuille(true); S.ui.versBonus = seulBonus; allerA('medailles'); },
    'refaire': function (el) { var x = blocEtPos(); D.refaire(x.b, +el.getAttribute('data-k')); garder('profil'); rendre(); dire('Semaine ajoutée : le jour J recule de 7 jours.'); },
    'refaire-prec': function (el) {
      var x = blocEtPos(), k = +el.getAttribute('data-k'), prec = x.b.semaines[k - 1];
      x.b.vu = x.b.vu || {}; if (prec) x.b.vu[prec.id] = 1; // la question ne se repose pas pour cette semaine
      D.refairePrecedente(x.b, k); garder('profil'); rendre(); dire('La semaine est reprogrammée. Le jour J recule de 7 jours.');
    },
    'ignorer-prec': function (el) { var b = P().bloc; b.vu = b.vu || {}; b.vu[el.getAttribute('data-sem')] = 1; garder('profil'); rendre(); },
    'decaler': function (el) { var x = blocEtPos(); D.decaler(x.b, +el.getAttribute('data-k')); garder('profil'); rendre(); dire('Semaine de pause ajoutée : tout le plan glisse de 7 jours.'); },
    'retirer-sem': function (el) { var x = blocEtPos(); D.retirer(x.b, +el.getAttribute('data-k')); garder('profil'); rendre(); dire('Semaine retirée : le jour J avance de 7 jours.'); },
    'suppr': function (el) {
      S.ui.suppr = el.getAttribute('data-cle'); if (S.f) rendreFeuille(); rendre();
      var b = (S.f ? feuille : vue).querySelector('[data-a="suppr-oui"]'); if (b) b.focus();
    },
    'suppr-non': function () { S.ui.suppr = null; if (S.f) rendreFeuille(); rendre(); },
    'suppr-oui': function (el) {
      var genre = el.getAttribute('data-genre'), id = el.getAttribute('data-id');
      S.ui.suppr = null;
      if (genre === 'sortie') {
        var jn = Jn(); jn.sorties = jn.sorties.filter(function (x) { return x.id !== id; }); garder('journal'); dire('Sortie effacée.');
        if (S.f && S.f.mode === 'saisie') { fermerFeuille(); return; } // la sortie qu'on corrigeait n'existe plus
      } else if (genre === 'nuit') { var pn = Pd(); if (pn.nuits) delete pn.nuits[id]; garder('poids'); dire('Nuit effacée.'); }
      else { delete Pd().mesures[id]; garder('poids'); dire('Pesée effacée.'); }
      if (S.f) rendreFeuille(); rendre();
    },
    'routine-edit': function () { S.ui.edit = !S.ui.edit; rendre(); var b = document.getElementById('rt-edit'); if (b) b.focus(); },
    'exo-haut': function (el) { deplacerExo(el.getAttribute('data-id'), -1); },
    'exo-bas': function (el) { deplacerExo(el.getAttribute('data-id'), 1); },
    'exo-suppr': function (el) {
      var rt = Rt(), id = el.getAttribute('data-id');
      rt.exos = rt.exos.filter(function (e) { return e.id !== id; });
      garder('routine'); rendre();
    },
    'plage': function (el) { S.ui.plage = +el.getAttribute('data-j'); rendre(); var b = document.getElementById('pl-' + S.ui.plage); if (b) b.focus(); },
    'choisir': function (el) { ouvrirFeuille({ type: 'choisir', obj: el.getAttribute('data-obj') }); },
    'copier': function () {
      var t = exportTexte();
      function repli() { S.ui.copie = t; rendreFeuille(); var z = document.getElementById('rg-copie'); if (z) { z.focus(); z.select(); } }
      try { navigator.clipboard.writeText(t).then(function () { dire('Tes données sont copiées. Colle-les dans une note pour les garder.'); }, repli); } catch (e) { repli(); }
    }
  };
  function deplacerExo(id, sens) {
    var rt = Rt(), i = -1;
    rt.exos.forEach(function (e, k) { if (e.id === id) i = k; });
    var j = i + sens; if (i < 0 || j < 0 || j >= rt.exos.length) return;
    var t = rt.exos[i]; rt.exos[i] = rt.exos[j]; rt.exos[j] = t;
    garder('routine'); rendre();
    var b = document.getElementById((sens < 0 ? 'eh-' : 'eb-') + id) || document.getElementById((sens < 0 ? 'eb-' : 'eh-') + id); if (b) b.focus();
  }
  function lireDate(v, idErr, futurePermise) {
    if (!D.dateValide(v)) { erreur(idErr, 'Choisis une date valide.'); return null; }
    if (!futurePermise && v > auj()) { erreur(idErr, 'Cette date est dans le futur : choisis aujourd’hui ou un jour passé.'); return null; }
    return v;
  }
  var FORMS = {
    'demarrer': function (f) {
      var prenom = f.prenom.value.trim(), niv = f.niveau.value, debut = f.debut.value, dep = 0;
      if (!prenom) { erreur('ob-erreur', 'Écris ton prénom : il s’affiche sur le dossard.'); f.prenom.focus(); return; }
      if (!D.dateValide(debut)) { erreur('ob-erreur', 'Choisis la date de ta première semaine.'); f.debut.focus(); return; }
      D.DEPARTS.forEach(function (d) { if (d.id === niv) dep = d.depart; });
      var but = D.BUTS.dist.indexOf(f.dist.value) >= 0 ? { dist: f.dist.value, deniv: D.BUTS.deniv.indexOf(f.deniv.value) >= 0 ? f.deniv.value : null } : D.lireBut(null);
      var ry = D.lireRythme({ rythme: f.rythme.value });
      if (ry === 'rapide' && !D.rapidePermis({ niveau: niv })) ry = 'regulier';
      S.docs.profil = { v: 1, prenom: prenom, cree: auj(), feuVert: null, medailles: {}, passes: [], nbBlocs: 1, but: but, rythme: ry, niveau: niv, bloc: D.nouveauBloc('5k', debut, dep, 'b1', ry) };
      if (!S.docs.routine) S.docs.routine = D.routineDefaut();
      garder('profil', 'routine'); allerA('objectif'); dire('Ton programme est créé.');
    },
    'sortie': function (f) {
      var s = seanceCourante() || LIBRE, anc = sortieCourante(), p = P(), jn = Jn();
      var d = lireDate(f.date.value, 'so-erreur'); if (!d) { f.date.focus(); return; }
      var tMin = f.min.value.trim(), tKm = f.km.value.trim(), tDp = f.dp.value.trim();
      var min = tMin ? D.nombre(tMin) : null, km = tKm ? D.nombre(tKm) : null, dp = tDp ? D.nombre(tDp) : null;
      if (tKm && (km == null || km > 300)) { erreur('so-erreur', 'La distance se note en kilomètres. Exemple : 4,6.'); f.km.focus(); return; }
      if (tDp && (dp == null || dp > 15000)) { erreur('so-erreur', 'Le dénivelé se note en mètres, sans décimale. Exemple : 90.'); f.dp.focus(); return; }
      if (tMin && (min == null || min < 1 || min > 1440)) { erreur('so-erreur', 'La durée se note en minutes, entre 1 et 1440. Exemple : 35.'); f.min.focus(); return; }
      if (!km && !min) { erreur('so-erreur', 'Note au moins la distance ou la durée.'); f.km.focus(); return; }
      var libre = !!(S.f.libre || S.f.id);
      var ref = anc ? (anc.ref || null) : (libre ? null : { w: S.f.sem, i: S.f.i }), titre = anc ? titreSortie(anc) : s.titre;
      if (!anc && libre && f.plan && f.plan.checked) {
        var cible = D.seanceAFaire(p.bloc, jn, d);
        if (cible) { ref = { w: cible.w, i: cible.i }; titre = cible.s.titre; }
      }
      var x = { id: anc ? anc.id : 'o' + Date.now().toString(36) + Math.floor(Math.random() * 1296).toString(36), d: d,
        min: min ? Math.round(min) : null, km: km ? Math.round(km * 100) / 100 : null, dp: dp ? Math.round(dp) : null,
        cont: f.cont ? !!f.cont.checked : !!(anc && anc.cont), res: f.res.value || 'correct', note: f.note.value.trim().slice(0, 120), titre: titre, ref: ref };
      jn.sorties = jn.sorties.filter(function (y) { return y.id !== x.id; }); jn.sorties.push(x);
      if (route() === 'carnet') S.ui.mois = d.slice(0, 7);
      var gagnees = D.nouvellesMedailles({ km: x.km || 0, dp: x.dp || 0, cont: x.cont }, p.medailles || {}, idsParcours());
      if (gagnees.length) {
        p.medailles = p.medailles || {};
        gagnees.forEach(function (id) { p.medailles[id] = d; });
        if (p.bloc && p.medailles[p.bloc.obj]) { p.passes = p.passes || []; p.passes.push({ obj: p.bloc.obj, debut: p.bloc.debut, fin: d }); p.bloc = null; }
        garder('profil');
      }
      garder('journal');
      var bs = majBonus();
      if (gagnees.length || bs.length) { S.f = { type: 'seance', mode: 'bravo', gagnees: gagnees, bonus: bs }; rendreFeuille(true); rendre(); return; }
      fermerFeuille(); dire(anc ? 'Sortie corrigée.' : 'Sortie enregistrée.');
    },
    'pesee': function (f) {
      // La pesée, le score de sommeil, ou les deux, pour une même date.
      var d = lireDate(f.date.value, 'pe-erreur'); if (!d) { f.date.focus(); return; }
      var tk = f.kg.value.trim(), tn = f.nuit.value.trim(), kg = null, nuit = null;
      if (!tk && !tn) { erreur('pe-erreur', 'Écris ta pesée, ton score de sommeil, ou les deux.'); f.kg.focus(); return; }
      if (tk) { kg = D.nombre(tk); if (kg == null || kg < 25 || kg > 300) { erreur('pe-erreur', 'Écris ton poids en kilos, par exemple 80,4.'); f.kg.focus(); return; } }
      if (tn) { nuit = D.nombre(tn); if (nuit == null || nuit > 100 || Math.round(nuit) !== nuit) { erreur('pe-erreur', 'Le score de sommeil est un nombre entier entre 0 et 100.'); f.nuit.focus(); return; } }
      var pd = Pd();
      if (kg != null) pd.mesures[d] = Math.round(kg * 10) / 10;
      if (nuit != null) { if (!pd.nuits) pd.nuits = {}; pd.nuits[d] = nuit; }
      garder('poids'); S.ui.sel = null;
      // Une médaille du sommeil ou du poids vient d'être décrochée : on la fête. Les autres, s'il y en a en attente, sont simplement annoncées.
      var bs = majBonus(), fete = bs.filter(function (k) { return /^(loir|sac)-/.test(k); }); rendre();
      if (fete.length) { dire(''); ouvrirFeuille({ type: 'seance', mode: 'bravo', gagnees: [], bonus: fete.concat(bs.filter(function (k) { return fete.indexOf(k) < 0; })) }); return; }
      dire((kg != null && nuit != null ? 'Pesée et score de sommeil du ' + dCourt(d) + ' enregistrés.' : kg != null ? 'Pesée du ' + dCourt(d) + ' enregistrée.' : 'Score de sommeil du ' + dCourt(d) + ' enregistré.') +
        (bs.length ? ' ' + (bs.length > 1 ? 'Médailles bonus : ' : 'Médaille bonus : ') + bs.map(nomCle).join(', ') + '.' : ''));
    },
    'exo-ajout': function (f) {
      var nom = f.nom.value.trim(), dose = f.dose.value.trim(), rt = Rt();
      if (!nom) { erreur('ea-erreur', 'Donne un nom à l’exercice.'); f.nom.focus(); return; }
      rt.n = (rt.n || rt.exos.length) + 1;
      rt.exos.push({ id: 'e' + rt.n, nom: nom.slice(0, 40), dose: dose.slice(0, 20) });
      garder('routine'); rendre(); var z = document.getElementById('ea-nom'); if (z) z.focus();
    },
    'lancer-bloc': function (f) {
      var p = P(), id = S.f.obj, debut = f.debut.value, dep = 0;
      if (!D.dateValide(debut)) { erreur('ch-erreur', 'Choisis la date de ta première semaine.'); f.debut.focus(); return; }
      if (id === '5k' && f.niveau) D.DEPARTS.forEach(function (d) { if (d.id === f.niveau.value) dep = d.depart; });
      if (p.bloc) { p.passes = p.passes || []; p.passes.push({ obj: p.bloc.obj, debut: p.bloc.debut, fin: auj(), arret: true }); }
      p.bloc = D.nouveauBloc(id, debut, dep, cleBloc(p), D.lireRythme(p)); S.ui.ouv = {};
      garder('profil'); fermerFeuille(true); allerA('objectif');
      dire('Nouvel objectif : ' + D.objectif(id).nom + '.');
    },
    'objectif': function (f) {
      var p = P(), but = { dist: f.dist.value, deniv: f.deniv.value || null }, med = p.medailles || {};
      if (D.BUTS.dist.indexOf(but.dist) < 0) return;
      var ids = D.etapes(but).map(function (o) { return o.id; });
      var hors = Object.keys(med).concat(p.bloc ? [p.bloc.obj] : []).filter(function (id, k, l) { return ids.indexOf(id) < 0 && l.indexOf(id) === k; });
      if (hors.length) { erreur('rg-erreur', 'Ce parcours laisserait de côté ' + hors.map(function (id) { return D.objectif(id).nom; }).join(' et ') + ', que tu as déjà décroché ou que tu prépares. Choisis un objectif qui le contient.'); return; }
      p.but = but; p.medailles = med;
      var rat = D.rattraper(Jn().sorties, ids, med); Object.keys(rat).forEach(function (id) { med[id] = rat[id]; });
      garder('profil'); rendre(); rendreFeuille(); dire('Objectif : ' + D.nomBut(but) + '.');
    },
    'rythme': function (f) {
      var p = P(), r = D.lireRythme({ rythme: f.rythme.value }), nom = '';
      if (r === 'rapide' && !D.rapidePermis(p)) { erreur('rg-erreur', 'Le rythme rapide s’ouvre une fois les 5 km décrochés.'); return; }
      D.RYTHMES.forEach(function (x) { if (x.id === r) nom = x.nom.toLowerCase(); });
      p.rythme = r;
      if (p.bloc) { var pos = D.position(p.bloc, auj()); D.changerRythme(p.bloc, pos.etat === 'avant' ? -1 : (pos.etat === 'apres' ? p.bloc.semaines.length - 1 : pos.k), r); S.ui.ouv = {}; }
      garder('profil'); rendre(); rendreFeuille();
      dire('Rythme ' + nom + (p.bloc ? ' : jour J le ' + dCourt(D.position(p.bloc, auj()).jourJ) + '.' : '.'));
    },
    'prenom': function (f) {
      var v = f.prenom.value.trim();
      if (!v) { erreur('rg-erreur', 'Le prénom ne peut pas rester vide.'); f.prenom.focus(); return; }
      P().prenom = v.slice(0, 20); garder('profil'); erreur('rg-erreur', ''); rendre(); dire('Prénom mis à jour.');
    },
    'debut': function (f) {
      var v = f.debut.value;
      if (!D.dateValide(v)) { erreur('rg-erreur', 'Choisis une date valide pour la première semaine.'); f.debut.focus(); return; }
      P().bloc.debut = v; garder('profil'); erreur('rg-erreur', ''); rendre(); dire('Le plan démarre maintenant ' + dLong(v) + '.');
    },
    'importer': function (f) {
      var o = null;
      try { o = JSON.parse(f.texte.value); } catch (e) { o = null; }
      if (!o || o.app !== 'le-dossard' || !o.profil || typeof o.profil.prenom !== 'string') { erreur('rg-erreur', 'Ce texte n’est pas une copie du Dossard. Colle la copie entière, sans la modifier.'); f.texte.focus(); return; }
      if (!f.ok.checked) { erreur('rg-erreur', 'Coche la case pour confirmer le remplacement de tes données.'); f.ok.focus(); return; }
      S.docs.profil = o.profil;
      S.docs.journal = (o.journal && Array.isArray(o.journal.sorties)) ? o.journal : { sorties: [] };
      S.docs.routine = (o.routine && Array.isArray(o.routine.exos)) ? o.routine : D.routineDefaut();
      S.docs.poids = (o.poids && o.poids.mesures && typeof o.poids.mesures === 'object') ? o.poids : { mesures: {} };
      if (S.docs.poids.nuits != null && typeof S.docs.poids.nuits !== 'object') delete S.docs.poids.nuits;
      garder('profil', 'journal', 'routine', 'poids'); fermerFeuille(); dire('Copie restaurée.');
    },
    'effacer': function (f) {
      if (f.mot.value.trim() !== 'EFFACER') { erreur('rg-erreur', 'Écris EFFACER en majuscules pour confirmer.'); f.mot.focus(); return; }
      S.docs.profil = null; S.docs.journal = { sorties: [] }; S.docs.routine = D.routineDefaut(); S.docs.poids = { mesures: {} };
      S.ui = { plage: 28, ouv: {}, suppr: null, edit: false, sel: null, mois: null };
      garder('profil', 'journal', 'routine', 'poids'); fermerFeuille(); window.scrollTo(0, 0); dire('Tout est effacé.');
    }
  };
  var CHANGES = {
    'creation': function (el) { majCreation(el); },
    'exo': function (el) {
      var rt = Rt(), tout = D.basculer(rt, auj(), el.getAttribute('data-id'), el.checked);
      garder('routine'); rendre();
      var bs = tout ? majBonus() : [];
      if (bs.length) direBonus(bs);
      else if (tout) dire('Routine complète. ' + D.serie(rt, auj()) + (D.serie(rt, auj()) > 1 ? ' matins d’affilée.' : ' matin au compteur.'));
    },
    'exo-nom': function (el) { majExo(el, 'nom', 40); },
    'exo-dose': function (el) { majExo(el, 'dose', 20); }
  };
  function majExo(el, champ, max) {
    var id = el.getAttribute('data-id'), v = el.value.trim().slice(0, max);
    Rt().exos.forEach(function (e) { if (e.id === id) { if (champ === 'nom' && !v) { el.value = e.nom; return; } e[champ] = v; } });
    garder('routine');
  }

  // ---------- Écoute ----------
  document.addEventListener('click', function (ev) {
    if (ev.target === feuille && S.f) { fermerFeuille(); return; }
    var el = ev.target.closest('[data-a]'); if (!el) return;
    var fn = ACTIONS[el.getAttribute('data-a')]; if (fn) fn(el, ev);
  });
  document.addEventListener('submit', function (ev) {
    var f = ev.target.closest('form[data-f]'); if (!f) return;
    ev.preventDefault();
    var fn = FORMS[f.getAttribute('data-f')]; if (fn) fn(f);
  });
  document.addEventListener('change', function (ev) {
    var el = ev.target.closest('[data-c]'); if (!el) return;
    var fn = CHANGES[el.getAttribute('data-c')]; if (fn) fn(el);
  });
  document.addEventListener('input', function (ev) {
    var f = ev.target.closest && ev.target.closest('form[data-f]'), e = f && f.querySelector('.erreur');
    if (e && !e.hidden) { e.hidden = true; e.textContent = ''; }
  });
  document.addEventListener('focusout', function () { if (S.aRendre) setTimeout(function () { if (S.aRendre) rendreFond(); }, 0); });
  document.addEventListener('toggle', function (ev) {
    var d = ev.target; if (d && d.matches && d.matches('details.sem')) S.ui.ouv[d.getAttribute('data-sem')] = d.open;
  }, true);
  document.addEventListener('pointermove', pointeCourbe);
  document.addEventListener('pointerdown', pointeCourbe);
  document.addEventListener('keydown', function (ev) {
    if (ev.key === 'Escape' && S.f) { fermerFeuille(); return; }
    var idc = ev.target && ev.target.id, cc = idc && COURBES[idc] && (S.ui.courbes || {})[idc];
    if ((ev.key === 'ArrowLeft' || ev.key === 'ArrowRight') && cc) {
      ev.preventDefault();
      var sel = (S.ui.sel || {})[idc], i = sel == null ? cc.pts.length - 1 : sel;
      selCourbe(i + (ev.key === 'ArrowLeft' ? -1 : 1), idc);
    }
  });
  window.addEventListener('hashchange', function () {
    S.ui.suppr = null; S.ui.sel = null; S.ui.edit = false; S.ui.mois = null;
    rendre(); haut();
    try { vue.focus({ preventScroll: true }); } catch (e) {}
  });

  rendre();
  Depot.ouvrir();
})();
