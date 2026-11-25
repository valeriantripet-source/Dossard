/* Le Dossard : logique pure (dates, programme, médailles, carnet, routine, poids). Aucun accès à la page. */
(function (root) {
  'use strict';

  // ---------- Dates (chaînes AAAA-MM-JJ, heure locale) ----------
  function pad(n) { return n < 10 ? '0' + n : '' + n; }
  function iso(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function dateDe(s) { var p = String(s).split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function dateValide(s) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(s))) return false;
    return iso(dateDe(s)) === s;
  }
  function plusJours(s, n) { var d = dateDe(s); d.setDate(d.getDate() + n); return iso(d); }
  function ecartJours(a, b) {
    var da = dateDe(a), db = dateDe(b);
    return Math.round((Date.UTC(db.getFullYear(), db.getMonth(), db.getDate()) -
      Date.UTC(da.getFullYear(), da.getMonth(), da.getDate())) / 86400000);
  }
  function prochainLundi(s) { var d = dateDe(s); return plusJours(s, (8 - d.getDay()) % 7); }

  // ---------- Formats ----------
  function fx(v, dec) {
    var s = dec != null ? Number(v).toFixed(dec) : String(Math.round(Number(v) * 10) / 10);
    return s.replace('.', ',');
  }
  function mil(n) { return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '\u00a0'); }
  function minTxt(sec) {
    var m = Math.floor(sec / 60), s = sec % 60;
    if (m && s) return m + ' min ' + pad(s);
    if (m) return m + ' min';
    return s + ' s';
  }
  function nombre(txt) {
    var t = String(txt == null ? '' : txt).trim().replace(/\s/g, '').replace(',', '.');
    if (!/^\d+(\.\d+)?$/.test(t)) return null;
    return Number(t);
  }

  // ---------- Séances ----------
  function E(t, s, l) { return { t: t, s: s, l: l }; }
  function total(etapes) { var t = 0; etapes.forEach(function (e) { t += e.s; }); return t; }
  function seance(type, titre, resume, etapes, extra) {
    var o = {
      type: type, titre: titre, resume: resume, etapes: etapes || [],
      min: etapes && etapes.length ? Math.round(total(etapes) / 60) : null,
      km: null, dp: null, conseil: '', test: null
    };
    if (extra) Object.keys(extra).forEach(function (k) { o[k] = extra[k]; });
    return o;
  }
  var PARLER = 'Cours à une allure où tu peux parler sans t’essouffler.';

  function alt(n, c, m) {
    var et = [E('marche', 300, 'Marche rapide')];
    for (var i = 0; i < n; i++) {
      et.push(E('course', c, 'Course lente ' + (i + 1) + '/' + n));
      if (i < n - 1) et.push(E('marche', m, 'Marche'));
    }
    et.push(E('marche', 300, 'Marche pour finir'));
    return seance('alt', 'Marche et course',
      '5 min de marche rapide, puis ' + n + ' × ' + minTxt(c) + ' de course lente avec ' + minTxt(m) +
      ' de marche entre chaque, et 5 min de marche pour finir.', et, { conseil: PARLER });
  }
  function suite(parts) {
    var et = [E('marche', 300, 'Marche rapide')], txt = [];
    parts.forEach(function (mn, i) {
      var c = i % 2 === 0;
      et.push(E(c ? 'course' : 'marche', mn * 60, c ? 'Course lente' : 'Marche'));
      txt.push(mn + ' min de ' + (c ? 'course' : 'marche'));
    });
    et.push(E('marche', 300, 'Marche pour finir'));
    return seance('alt', 'Marche et course',
      '5 min de marche rapide, puis ' + txt.join(', ') + ', et 5 min de marche pour finir.', et, { conseil: PARLER });
  }
  function continu(mn) {
    return seance('continu', 'Course continue',
      '5 min de marche rapide, ' + mn + ' min de course sans s’arrêter, 5 min de marche pour finir.',
      [E('marche', 300, 'Marche rapide'), E('course', mn * 60, 'Course continue'), E('marche', 300, 'Marche pour finir')],
      { conseil: 'Pars lentement : le but est de tenir la durée, pas d’aller vite.' });
  }
  function footing(mn, vallonne) {
    return seance('footing', vallonne ? 'Footing vallonné' : 'Footing',
      mn + ' min en endurance' + (vallonne ? ' sur un parcours vallonné' : '') +
      ', à une allure où tu peux tenir une conversation.',
      [E('course', mn * 60, 'Footing')], { conseil: 'Si tu es essoufflé, ralentis ou marche une minute.' });
  }
  function lignes(mn, n) {
    var et = [E('course', mn * 60, 'Footing')];
    for (var i = 0; i < n; i++) {
      et.push(E('fort', 20, 'Accélération ' + (i + 1) + '/' + n));
      et.push(E('marche', 60, 'Récupération en marchant'));
    }
    return seance('footing', 'Footing et accélérations',
      mn + ' min de footing, puis ' + n + ' accélérations progressives de 20 s, avec 1 min de marche entre chaque.',
      et, { conseil: 'Les accélérations restent souples : tu ne sprintes pas.' });
  }
  function cotes(n, sec) {
    // Montées courtes : retour en marchant. Montées de plus de 2 min : retour en trottinant, d'une durée égale.
    var longue = sec >= 240, trot = sec > 120;
    var rec = trot ? sec : Math.round(sec * 1.5 / 30) * 30;
    var et = [E('course', 600, 'Footing d\u2019échauffement')];
    for (var i = 0; i < n; i++) {
      et.push(E('fort', sec, 'Montée ' + (i + 1) + '/' + n));
      et.push(E(trot ? 'course' : 'marche', rec, trot ? 'Retour en trottinant' : 'Retour en marchant'));
    }
    et.push(E('course', 600, 'Retour au calme'));
    return seance('cotes', longue ? 'Côtes longues' : (sec <= 75 ? 'Côtes douces' : 'Côtes'),
      '10 min de footing, ' + n + ' × ' + minTxt(sec) + ' en côte' +
      (longue ? ', en marche active ou en petites foulées' : '') +
      (trot ? ' (retour en trottinant)' : ' (retour en marchant)') + ', 10 min de retour au calme.', et,
      { conseil: longue ? 'Quand la pente se redresse, marche mains sur les cuisses : c\u2019est la technique du trail.'
                        : 'Monte en petites foulées, buste droit, sans te mettre dans le rouge.' });
  }
  function soutenu(n, mn, rec) {
    var et = [E('course', 600, 'Footing d’échauffement')];
    for (var i = 0; i < n; i++) {
      et.push(E('fort', mn * 60, 'Allure soutenue ' + (i + 1) + '/' + n));
      if (i < n - 1) et.push(E('course', rec * 60, 'Récupération en trottinant'));
    }
    et.push(E('course', 600, 'Retour au calme'));
    return seance('soutenu', 'Allure soutenue',
      '10 min de footing, ' + n + ' × ' + mn + ' min à allure soutenue (' + rec +
      ' min de récupération en trottinant), 10 min de retour au calme.', et,
      { conseil: 'Allure soutenue : tu peux encore dire quelques mots, plus tenir une conversation.' });
  }
  function allureM(mn) {
    return seance('soutenu', 'Allure marathon',
      '10 min de footing, ' + mn + ' min à ton allure marathon, 10 min de retour au calme.',
      [E('course', 600, 'Footing d’échauffement'), E('fort', mn * 60, 'Allure marathon'), E('course', 600, 'Retour au calme')],
      { conseil: 'L’allure marathon est celle que tu te vois tenir des heures : confortable mais appliquée.' });
  }
  function descentes(n) {
    var et = [E('course', 600, 'Footing d’échauffement')];
    for (var i = 0; i < n; i++) {
      et.push(E('marche', 120, 'Montée en marchant ' + (i + 1) + '/' + n));
      et.push(E('fort', 60, 'Descente souple'));
    }
    et.push(E('course', 600, 'Retour au calme'));
    return seance('cotes', 'Descentes souples',
      '10 min de footing, ' + n + ' × 1 min de descente en souplesse (tu remontes en marchant 2 min), 10 min de retour au calme.',
      et, { conseil: 'Petits pas rapides, regard loin devant, bras écartés pour l’équilibre.' });
  }
  function longue(km) {
    return seance('longue', 'Sortie longue',
      fx(km) + ' km à allure tranquille. Tu peux marcher une minute de temps en temps si besoin.',
      [], { km: km, conseil: 'La sortie longue se court lentement : finis avec l’impression d’en avoir encore sous le pied.' });
  }
  function trail(km, dp) {
    return seance('trail', 'Sortie trail',
      fx(km) + ' km en terrain vallonné, avec environ ' + mil(dp) +
      ' m de dénivelé positif. Marche active dans les montées, trottine sur le plat et en descente.',
      [], { km: km, dp: dp, conseil: 'Emporte de l’eau et de quoi manger dès que la sortie dépasse 1 h 30.' });
  }
  var TESTS = {
    '5k': ['Test : 5 km sans marcher', '5 min de marche pour t’échauffer, puis 5 km d’une traite, à ton allure. En notant la séance, coche « sans marcher » pour décrocher la médaille.', { km: 5 }],
    '10k': ['Test : 10 km sans marcher', '10 min de footing très lent, puis 10 km d’une traite. En notant la séance, coche « sans marcher » pour décrocher la médaille.', { km: 10 }],
    'd500': ['Test : 500 m de dénivelé', 'Une sortie de 10 à 12 km avec 500 m de dénivelé positif. Marche dans les montées, cours le reste.', { km: 11, dp: 500 }],
    'semi': ['Test : semi-marathon', '21,1 km en une sortie, sur une course officielle ou en solo. Pars plus lentement que tu ne le penses.', { km: 21.1 }],
    'd1000': ['Test : 1 000 m de dénivelé', 'Une sortie de 16 à 20 km avec 1 000 m de dénivelé positif, en course officielle ou en solo.', { km: 18, dp: 1000 }],
    'marathon': ['Test : marathon', '42,2 km en une sortie. Bois et mange dès la première heure, et garde de la marge jusqu’au 30e kilomètre.', { km: 42.2 }],
    'd2000': ['Test : 2 000 m de dénivelé', 'Une sortie de 25 à 30 km avec 2 000 m de dénivelé positif : ta course de montagne.', { km: 28, dp: 2000 }]
  };
  function test(id) {
    var t = TESTS[id], extra = { test: id, conseil: 'Choisis un jour où tu te sens bien. Si ce n’est pas le jour, reporte : la médaille t’attendra.' };
    Object.keys(t[2]).forEach(function (k) { extra[k] = t[2][k]; });
    return seance('test', t[0], t[1], [], extra);
  }
  function S3(a, b, c, drapeau) { var o = { s: [a, b, c] }; if (drapeau) o[drapeau] = true; return o; }
  function x3(f) { return S3(f(), f(), f()); }

  // ---------- Les sept blocs de préparation (3 séances par semaine) ----------
  var BLOCS = {
    '5k': [
      x3(function () { return alt(6, 60, 120); }),
      x3(function () { return alt(8, 60, 120); }),
      x3(function () { return alt(7, 90, 120); }),
      x3(function () { return alt(6, 120, 120); }),
      S3(alt(5, 120, 120), alt(5, 120, 120), alt(5, 120, 120), 'allegee'),
      x3(function () { return alt(5, 180, 120); }),
      x3(function () { return alt(4, 300, 150); }),
      x3(function () { return alt(3, 480, 180); }),
      S3(alt(2, 720, 180), alt(2, 720, 180), suite([15, 3, 10])),
      S3(continu(20), alt(2, 720, 120), continu(22)),
      S3(continu(25), continu(20), continu(28)),
      S3(continu(30), continu(20), test('5k'), 'test')
    ],
    '10k': [
      S3(footing(30), footing(30), longue(6)),
      S3(footing(35), cotes(6, 60), longue(6.5)),
      S3(footing(35), cotes(8, 60), longue(7.5)),
      S3(footing(30), footing(30), longue(6), 'allegee'),
      S3(footing(40), soutenu(5, 2, 2), longue(8.5)),
      S3(footing(40), cotes(8, 75), longue(9)),
      S3(footing(40), soutenu(4, 3, 2), longue(9.5)),
      S3(footing(30), lignes(25, 4), test('10k'), 'test')
    ],
    'd500': [
      S3(footing(40), cotes(6, 120), trail(8, 200)),
      S3(footing(40), cotes(8, 120), trail(9, 300)),
      S3(footing(45), descentes(6), trail(10, 350)),
      S3(footing(35), footing(35, true), trail(8, 200), 'allegee'),
      S3(footing(45), cotes(4, 240), trail(10, 420)),
      S3(footing(35), footing(30), test('d500'), 'test')
    ],
    'semi': [
      S3(footing(40), soutenu(5, 3, 2), longue(11)),
      S3(footing(45), cotes(8, 90), longue(12)),
      S3(footing(45), soutenu(3, 6, 3), longue(13.5)),
      S3(footing(40), footing(35), longue(11), 'allegee'),
      S3(footing(50), soutenu(4, 6, 3), longue(15)),
      S3(footing(50), cotes(10, 90), longue(16)),
      S3(footing(50), soutenu(2, 12, 4), longue(18)),
      S3(footing(40), footing(40), longue(13), 'allegee'),
      S3(footing(45), soutenu(3, 8, 3), longue(16)),
      S3(footing(35), lignes(30, 4), test('semi'), 'test')
    ],
    'd1000': [
      S3(footing(45), cotes(6, 180), trail(12, 400)),
      S3(footing(45), cotes(8, 180), trail(14, 550)),
      S3(footing(50), descentes(8), trail(15, 650)),
      S3(footing(40), footing(40, true), trail(10, 300), 'allegee'),
      S3(footing(50), cotes(4, 300), trail(16, 750)),
      S3(footing(50), cotes(5, 300), trail(18, 850)),
      S3(footing(40), footing(35), trail(12, 400), 'allegee'),
      S3(footing(35), footing(30), test('d1000'), 'test')
    ],
    'marathon': [
      S3(footing(45), soutenu(4, 6, 3), longue(16)),
      S3(footing(50), allureM(20), longue(18)),
      S3(footing(50), soutenu(3, 8, 3), longue(20)),
      S3(footing(40), footing(40), longue(15), 'allegee'),
      S3(footing(55), allureM(25), longue(22)),
      S3(footing(55), soutenu(4, 8, 3), longue(24)),
      S3(footing(60), allureM(30), longue(26)),
      S3(footing(45), footing(40), longue(18), 'allegee'),
      S3(footing(60), soutenu(3, 10, 3), longue(26)),
      S3(footing(60), allureM(35), longue(28)),
      S3(footing(60), soutenu(2, 15, 4), longue(30)),
      S3(footing(45), footing(40), longue(20), 'allegee'),
      S3(footing(55), allureM(30), longue(28)),
      S3(footing(50), soutenu(3, 8, 3), longue(22)),
      S3(footing(40), allureM(15), longue(14), 'allegee'),
      S3(footing(30), lignes(25, 4), test('marathon'), 'test')
    ],
    'd2000': [
      S3(footing(50), cotes(5, 300), trail(15, 700)),
      S3(footing(50), cotes(6, 300), trail(17, 900)),
      S3(footing(55), descentes(8), trail(18, 1100)),
      S3(footing(40), footing(40, true), trail(12, 500), 'allegee'),
      S3(footing(55), cotes(3, 480), trail(20, 1300)),
      S3(footing(55), cotes(4, 480), trail(22, 1500)),
      S3(footing(60), descentes(10), trail(24, 1600)),
      S3(footing(45), footing(40), trail(14, 700), 'allegee'),
      S3(footing(60), cotes(4, 480), trail(24, 1700)),
      S3(footing(55), cotes(3, 480), trail(26, 1800)),
      S3(footing(45), footing(35), trail(14, 600), 'allegee'),
      S3(footing(35), footing(30), test('d2000'), 'test')
    ]
  };

  // ---------- Objectifs et médailles ----------
  var OBJECTIFS = [
    { id: '5k', nom: '5 km', gros: '5', unite: 'KM', court: '5K', deniv: false, titre: '5 km sans marcher',
      critere: 'Courir 5 km sans marcher.', prereq: [], ok: function (s) { return s.km >= 5 && !!s.cont; } },
    { id: '10k', nom: '10 km', gros: '10', unite: 'KM', court: '10K', deniv: false, titre: '10 km sans marcher',
      critere: 'Courir 10 km sans marcher.', prereq: ['5k'], ok: function (s) { return s.km >= 10 && !!s.cont; } },
    { id: 'd500', nom: '500 m D+', gros: '500', unite: 'M D+', court: '500', deniv: true, titre: '500 m de dénivelé',
      critere: 'Une sortie avec 500 m de dénivelé positif.', prereq: ['10k'], ok: function (s) { return s.dp >= 500; } },
    { id: 'semi', nom: 'Semi-marathon', gros: '21,1', unite: 'KM', court: '21K', deniv: false, titre: 'le semi-marathon',
      critere: 'Boucler 21,1 km en une sortie.', prereq: ['10k'], ok: function (s) { return s.km >= 21.09; } },
    { id: 'd1000', nom: '1\u00a0000 m D+', gros: '1000', unite: 'M D+', court: '1000', deniv: true, titre: '1\u00a0000 m de dénivelé',
      critere: 'Une sortie avec 1\u00a0000 m de dénivelé positif.', prereq: ['d500', 'semi'], ok: function (s) { return s.dp >= 1000; } },
    { id: 'marathon', nom: 'Marathon', gros: '42,2', unite: 'KM', court: '42K', deniv: false, titre: 'le marathon',
      critere: 'Boucler 42,2 km en une sortie.', prereq: ['semi'], ok: function (s) { return s.km >= 42.19; } },
    { id: 'd2000', nom: '2\u00a0000 m D+', gros: '2000', unite: 'M D+', court: '2000', deniv: true, titre: '2\u00a0000 m de dénivelé',
      critere: 'Une sortie avec 2\u00a0000 m de dénivelé positif.', prereq: ['d1000'], ok: function (s) { return s.dp >= 2000; } }
  ];
  function objectif(id) { for (var i = 0; i < OBJECTIFS.length; i++) if (OBJECTIFS[i].id === id) return OBJECTIFS[i]; return null; }
  function nouvellesMedailles(sortie, deja, ids) {
    // ids : les médailles du parcours ; sans cette liste, les sept comptent.
    var r = []; deja = deja || {};
    OBJECTIFS.forEach(function (o) { if ((!ids || ids.indexOf(o.id) >= 0) && !deja[o.id] && o.ok(sortie)) r.push(o.id); });
    return r;
  }
  function disponible(o, med) { return !med[o.id] && o.prereq.every(function (p) { return !!med[p]; }); }
  function manquants(o, med) { return o.prereq.filter(function (p) { return !med[p]; }); }

  // ---------- Bloc en cours ----------
  var DEPARTS = [
    { id: 'zero', depart: 0, nom: 'Je reprends en douceur', detail: 'Départ à la semaine 1 : marche et petites foulées d’1 minute.' },
    { id: 'cinq', depart: 6, nom: 'Je trottine déjà 5 minutes sans m’arrêter', detail: 'Départ à la semaine 7.' },
    { id: 'vingt', depart: 9, nom: 'Je cours déjà 20 minutes sans m’arrêter', detail: 'Départ à la semaine 10.' },
    { id: 'trente', depart: 11, nom: 'Je cours déjà 30 minutes', detail: 'Départ à la dernière semaine : celle du test des 5 km.' }
  ];
  // ---------- Objectif, étapes et rythme ----------
  // On choisit une distance et, si on veut, un dénivelé. Le parcours, ce sont ces médailles et tout ce qu'elles demandent d'abord.
  var BUTS = { dist: ['5k', '10k', 'semi', 'marathon'], deniv: ['d500', 'd1000', 'd2000'] };
  var NOMS_BUTS = { '5k': '5 km', '10k': '10 km', semi: 'semi-marathon', marathon: 'marathon', d500: '500 m de dénivelé', d1000: '1\u00a0000 m de dénivelé', d2000: '2\u00a0000 m de dénivelé' };
  function lireBut(p) {
    // Un programme créé avant le choix de l'objectif garde ses sept médailles : marathon et 2 000 m de dénivelé.
    var b = p && p.but;
    if (!b || BUTS.dist.indexOf(b.dist) < 0) return { dist: 'marathon', deniv: 'd2000' };
    return { dist: b.dist, deniv: BUTS.deniv.indexOf(b.deniv) >= 0 ? b.deniv : null };
  }
  function nomBut(but) { return NOMS_BUTS[but.dist] + (but.deniv ? ' et ' + NOMS_BUTS[but.deniv] : ''); }
  function etapes(but) {
    var vus = {};
    function ajoute(id) { if (!id || vus[id]) return; objectif(id).prereq.forEach(ajoute); vus[id] = 1; }
    ajoute(but.dist); ajoute(but.deniv);
    return OBJECTIFS.filter(function (o) { return vus[o.id]; });
  }
  function estBut(but, id) { return id === but.dist || id === but.deniv; }
  var RYTHMES = [
    { id: 'tranquille', nom: 'Tranquille', detail: 'Une semaine pour consolider toutes les deux semaines.' },
    { id: 'regulier', nom: 'Régulier', detail: 'Le plan tel qu’il est écrit.' },
    { id: 'rapide', nom: 'Rapide', detail: 'Des préparations plus courtes, pour qui court déjà.' }
  ];
  function lireRythme(p) { var r = p && p.rythme; return r === 'tranquille' || r === 'rapide' ? r : 'regulier'; }
  // Rythme rapide : les semaines gardées dans chaque préparation, les autres sautent. Le test reste toujours ;
  // les semaines allégées restent aussi, sauf dans la préparation 5 km, où la version rapide ne sert qu'à qui court déjà.
  var RAPIDE = { '5k': [0, 2, 3, 5, 6, 7, 9, 10, 11], '10k': [0, 2, 3, 4, 6, 7], d500: [0, 1, 3, 4, 5], semi: [0, 2, 3, 4, 5, 6, 7, 9],
    d1000: [1, 2, 3, 4, 5, 7], marathon: [1, 2, 3, 4, 5, 6, 7, 9, 10, 13, 14, 15], d2000: [1, 2, 3, 4, 5, 7, 8, 10, 11] };
  function sequence(obj, rythme, depart) {
    // Les semaines d'une préparation selon le rythme, dans l'ordre : { tpl } ou, pour une semaine de consolidation, { tpl, conso }.
    var tpl = BLOCS[obj], l = [], n = 0;
    for (var i = (depart || 0); i < tpl.length; i++) {
      if (rythme === 'rapide' && RAPIDE[obj].indexOf(i) < 0) continue;
      l.push({ tpl: i });
      if (rythme === 'tranquille' && !tpl[i].allegee && !tpl[i].test) { n++; if (n % 2 === 0) l.push({ tpl: i, conso: true }); }
    }
    return l;
  }
  function dureeParcours(ids, rythme, depart) {
    var n = 0; ids.forEach(function (id) { n += sequence(id, rythme, id === '5k' ? depart : 0).length; }); return n;
  }
  function rapidePermis(p) {
    // Le rythme rapide demande une base : il s'ouvre à qui court déjà 20 minutes, ou une fois les 5 km décrochés.
    return !!(p && (p.niveau === 'vingt' || p.niveau === 'trente' || (p.medailles && p.medailles['5k'])));
  }
  function rattraper(sorties, ids, med) {
    // Quand le parcours s'allonge : les médailles que des sorties déjà notées valent. Renvoie { id : date de la première sortie qui suffit }.
    var o = {};
    ids.forEach(function (id) {
      if (med && med[id]) return;
      var ob = objectif(id), d = null;
      (sorties || []).forEach(function (x) { if (ob.ok({ km: x.km || 0, dp: x.dp || 0, cont: x.cont }) && (!d || x.d < d)) d = x.d; });
      if (d) o[id] = d;
    });
    return o;
  }
  function semaineDe(cle, e) { return e.conso ? { id: cle + '-c' + e.tpl, tpl: e.tpl, ajout: true, conso: true } : { id: cle + '-s' + e.tpl, tpl: e.tpl }; }
  function nouveauBloc(obj, debut, depart, cle, rythme) {
    // cle : préfixe propre à ce bloc, pour que les séances notées d'un bloc ne comptent jamais dans un autre.
    cle = cle || 'b1';
    return { obj: obj, debut: debut, semaines: sequence(obj, rythme || 'regulier', depart).map(function (e) { return semaineDe(cle, e); }), n: BLOCS[obj].length, cle: cle };
  }
  function changerRythme(bloc, k, rythme) {
    // Les semaines jusqu'à la semaine k (comprise) restent telles quelles ; la suite est recalculée au nouveau rythme.
    var garde = bloc.semaines.slice(0, Math.max(0, k + 1)), t = -1, pris = {}, cle = bloc.cle || 'b1';
    garde.forEach(function (s) { pris[s.id] = 1; if (!s.pause && s.tpl > t) t = s.tpl; });
    if (!garde.length) { var p = bloc.semaines.filter(function (s) { return !s.pause; })[0]; t = (p ? p.tpl : 0) - 1; }
    var reste = sequence(bloc.obj, rythme, t + 1); // le compte des consolidations repart de la prochaine semaine
    bloc.semaines = garde.concat(reste.map(function (e) { var s = semaineDe(cle, e); if (pris[s.id]) s.id = idSemaine(bloc); return s; }));
    return bloc;
  }
  function idSemaine(bloc) { bloc.n = (bloc.n || 0) + 1; return (bloc.cle || 'b1') + '-x' + bloc.n; }
  function position(bloc, auj) {
    var n = bloc.semaines.length, j = ecartJours(bloc.debut, auj);
    var o = { n: n, jourJ: plusJours(bloc.debut, n * 7 - 1) };
    o.reste = ecartJours(auj, o.jourJ);
    if (j < 0) { o.etat = 'avant'; o.k = -1; o.dans = -j; }
    else if (j >= n * 7) { o.etat = 'apres'; o.k = n; }
    else { o.etat = 'encours'; o.k = Math.floor(j / 7); }
    return o;
  }
  function semaine(bloc, k) {
    var s = bloc.semaines[k]; if (!s) return null;
    var debut = plusJours(bloc.debut, k * 7);
    if (s.pause) return { id: s.id, pause: true, s: [], debut: debut, fin: plusJours(debut, 6), ajout: true };
    var t = BLOCS[bloc.obj][s.tpl];
    return { id: s.id, tpl: s.tpl, s: t.s, allegee: !!t.allegee, test: !!t.test, ajout: !!s.ajout, conso: !!s.conso, debut: debut, fin: plusJours(debut, 6) };
  }
  function faites(journal, semId) {
    var o = {};
    ((journal && journal.sorties) || []).forEach(function (x) { if (x.ref && x.ref.w === semId) o[x.ref.i] = x; });
    return o;
  }
  function nbFaites(journal, semId) { return Object.keys(faites(journal, semId)).length; }
  function refaire(bloc, k) { bloc.semaines.splice(k + 1, 0, { id: idSemaine(bloc), tpl: bloc.semaines[k].tpl, ajout: true }); }
  function refairePrecedente(bloc, k) { bloc.semaines.splice(k, 0, { id: idSemaine(bloc), tpl: bloc.semaines[k - 1].tpl, ajout: true }); }
  function decaler(bloc, k) { bloc.semaines.splice(k, 0, { id: idSemaine(bloc), pause: true }); }
  function retirer(bloc, k) { bloc.semaines.splice(k, 1); }
  function jMoins(reste) { return reste > 0 ? 'J-' + reste : (reste === 0 ? 'Jour J' : 'J+' + (-reste)); }
  function court(s) {
    var p = [];
    if (s.min != null) p.push(s.min + ' min');
    if (s.km != null) p.push(fx(s.km) + ' km');
    if (s.dp != null) p.push(mil(s.dp) + ' m D+');
    return p.join(' · ');
  }

  // ---------- Routine du matin ----------
  function routineDefaut() {
    return {
      exos: [
        { id: 'e1', nom: 'Pompes', dose: '2 × 10' },
        { id: 'e2', nom: 'Gainage', dose: '2 × 30 s' },
        { id: 'e3', nom: 'Crunchs', dose: '2 × 15' },
        { id: 'e4', nom: 'Squats', dose: '2 × 15' },
        { id: 'e5', nom: 'Mobilité des hanches', dose: '2 min' }
      ], jours: {}, n: 5
    };
  }
  function cochesDuJour(routine, d) {
    var j = routine.jours && routine.jours[d];
    if (j === true) return routine.exos.map(function (e) { return e.id; });
    return Array.isArray(j) ? j.slice() : [];
  }
  function jourComplet(routine, d) { return !!(routine.jours && routine.jours[d] === true); }
  function basculer(routine, d, id, coche) {
    var ids = cochesDuJour(routine, d), i = ids.indexOf(id);
    if (coche && i < 0) ids.push(id);
    if (!coche && i >= 0) ids.splice(i, 1);
    var tous = routine.exos.length > 0 && routine.exos.every(function (e) { return ids.indexOf(e.id) >= 0; });
    routine.jours = routine.jours || {};
    if (tous) routine.jours[d] = true;
    else if (ids.length) routine.jours[d] = ids;
    else delete routine.jours[d];
    return tous;
  }
  function serie(routine, auj) {
    var n = 0, d = auj;
    if (!jourComplet(routine, d)) d = plusJours(d, -1);
    while (jourComplet(routine, d) && n < 5000) { n++; d = plusJours(d, -1); }
    return n;
  }

  // ---------- Poids ----------
  function mesures(poids) {
    var m = (poids && poids.mesures) || {};
    return Object.keys(m).sort().map(function (d) { return { d: d, kg: m[d] }; });
  }
  // Les scores de sommeil sont rangés à côté des pesées, dans le même document : une nuit par date, celle du réveil.
  function nuits(poids) {
    var m = (poids && poids.nuits) || {};
    return Object.keys(m).sort().filter(function (d) { return typeof m[d] === 'number'; }).map(function (d) { return { d: d, s: m[d] }; });
  }
  function moyenne7(liste, d, cle) {
    cle = cle || 'kg';
    var debut = plusJours(d, -6), s = 0, n = 0;
    for (var i = 0; i < liste.length; i++) { var x = liste[i]; if (x.d >= debut && x.d <= d) { s += x[cle]; n++; } }
    return n ? s / n : null;
  }
  // Nuits d'affilée à 80 ou plus. « cours » : la série qui tient encore (jusqu'à aujourd'hui, ou hier si ce matin n'est pas noté) ;
  // « max » : la plus longue jamais faite. Un jour sans score coupe la série, comme une nuit sous 80.
  var SEUIL_NUIT = 80;
  function seriesNuits(liste, a) {
    var bonnes = {}, notees = {}, max = 0, n = 0, prec = null;
    (liste || []).forEach(function (x) {
      notees[x.d] = 1;
      if (x.s >= SEUIL_NUIT) { n = (prec && plusJours(prec, 1) === x.d) ? n + 1 : 1; prec = x.d; bonnes[x.d] = 1; if (n > max) max = n; }
      else { n = 0; prec = null; }
    });
    // Ce matin déjà noté : la série part d'aujourd'hui (et vaut zéro si la nuit est sous 80). Pas encore noté : elle tient jusqu'à hier.
    var cours = 0, d = notees[a] ? a : plusJours(a, -1);
    while (bonnes[d] && cours < 5000) { cours++; d = plusJours(d, -1); }
    return { cours: cours, max: max };
  }
  function statsNuits(liste, a) {
    if (!liste.length) return null;
    var der = liste[liste.length - 1], se = seriesNuits(liste, a);
    return { dernier: der, moy7: moyenne7(liste, der.d, 's'), cours: se.cours, max: se.max };
  }
  // Kilos perdus depuis la première pesée, lus sur la moyenne de 7 jours pour qu'un seul matin léger ne suffise pas.
  // « cours » : aujourd'hui ; « max » : au mieux.
  function pertePoids(liste) {
    if (!liste || liste.length < 2) return { cours: 0, max: 0 };
    var depart = liste[0].kg, cours = 0, max = 0;
    liste.forEach(function (x) { cours = depart - moyenne7(liste, x.d); if (cours > max) max = cours; });
    return { cours: Math.max(0, Math.round(cours * 10) / 10), max: Math.round(max * 10) / 10 };
  }
  function statsPoids(liste) {
    if (!liste.length) return null;
    var der = liste[liste.length - 1], m7 = moyenne7(liste, der.d), avant = moyenne7(liste, plusJours(der.d, -28));
    return { dernier: der, moy7: m7, avant: avant, ecart: (avant != null && m7 != null) ? m7 - avant : null };
  }
  function courbe(liste, L, H, cle) {
    // Géométrie d'une courbe : les valeurs du jour (gris) et leur moyenne sur 7 jours (bleu), une seule échelle.
    // cle : 'kg' pour les pesées (par défaut), 's' pour les scores de sommeil.
    cle = cle || 'kg';
    if (!liste || liste.length < 2) return null;
    var g = { x0: 34, x1: L - 44, yh: 12, yb: H - 28 };
    var d0 = liste[0].d, d1 = liste[liste.length - 1].d, span = Math.max(1, ecartJours(d0, d1));
    var vals = liste.map(function (x) { return x[cle]; });
    var mn = Math.min.apply(null, vals), mx = Math.max.apply(null, vals), bas, haut, pas;
    if (cle === 's') {
      // Scores sur 100 : des graduations rondes (de 5 en 5, de 10 en 10...), jamais au-dessus de 100, quatre intervalles au plus.
      var ronds = [5, 10, 20, 50];
      for (var k = 0; k < ronds.length; k++) {
        pas = ronds[k]; bas = Math.floor(mn / pas) * pas; haut = Math.min(100, Math.ceil(mx / pas) * pas);
        if (haut - bas < 2 * pas) { if (haut + pas <= 100 && (mn - bas) >= (haut - mx)) haut += pas; else bas = Math.max(0, bas - pas); }
        if (haut - bas < 2 * pas) { if (haut + pas <= 100) haut += pas; else bas = Math.max(0, bas - pas); }
        if ((haut - bas) / pas <= 4) break;
      }
    } else {
      bas = Math.floor(mn - 0.3); haut = Math.ceil(mx + 0.3);
      if (haut - bas < 2) { if ((mn - bas) < (haut - mx)) bas -= 1; else haut += 1; }
      pas = 1; while ((haut - bas) / pas > 4) pas *= 2;
      bas = Math.floor(bas / pas) * pas; haut = Math.ceil(haut / pas) * pas;
    }
    function X(d) { return g.x0 + (g.x1 - g.x0) * ecartJours(d0, d) / span; }
    function Y(v) { return g.yb - (v - bas) / (haut - bas) * (g.yb - g.yh); }
    var pts = liste.map(function (x) { var p = { d: x.d, moy: moyenne7(liste, x.d, cle), x: X(x.d), y: Y(x[cle]) }; p[cle] = x[cle]; return p; });
    pts.forEach(function (p) { p.ym = Y(p.moy); });
    var ticks = []; for (var v = bas; v <= haut + 1e-9; v += pas) ticks.push({ v: v, y: Y(v) });
    return { g: g, pts: pts, ticks: ticks, bas: bas, haut: haut, d0: d0, d1: d1, milieu: plusJours(d0, Math.round(span / 2)), span: span };
  }

  // ---------- Carnet : calendrier des sorties ----------
  function lundiDe(s) { return plusJours(s, -((dateDe(s).getDay() + 6) % 7)); }
  function plusMois(m, n) { var p = String(m).split('-'), d = new Date(+p[0], +p[1] - 1 + n, 1); return d.getFullYear() + '-' + pad(d.getMonth() + 1); }
  function grilleMois(m) {
    // Semaines entières, du lundi au dimanche, qui couvrent le mois m (AAAA-MM).
    var fin = plusJours(plusMois(m, 1) + '-01', -1), d = lundiDe(m + '-01'), lignes = [];
    while (d <= fin) {
      var l = [];
      for (var i = 0; i < 7; i++) { l.push({ d: d, dans: d.slice(0, 7) === m }); d = plusJours(d, 1); }
      lignes.push(l);
    }
    return lignes;
  }
  function parJour(sorties) { var o = {}; (sorties || []).forEach(function (x) { (o[x.d] = o[x.d] || []).push(x); }); return o; }
  function duMois(sorties, m) { return (sorties || []).filter(function (x) { return String(x.d).slice(0, 7) === m; }); }
  function somme(sorties, cle) { var s = 0; (sorties || []).forEach(function (x) { s += x[cle] || 0; }); return s; }
  function totaux(sorties) { return { n: (sorties || []).length, km: Math.round(somme(sorties, 'km') * 100) / 100, dp: Math.round(somme(sorties, 'dp')) }; }
  var RANG_RES = { facile: 1, correct: 2, dur: 3 };
  function resumeJour(liste) {
    // Ce que la case du calendrier montre pour un jour : distance et durée cumulées, ressenti le plus dur.
    var t = totaux(liste), res = null;
    liste.forEach(function (x) { if (RANG_RES[x.res] && (!res || RANG_RES[x.res] > RANG_RES[res])) res = x.res; });
    return { n: t.n, km: t.km, dp: t.dp, min: somme(liste, 'min'), res: res || 'correct' };
  }
  function seanceAFaire(bloc, journal, d) {
    // Première séance encore à faire dans la semaine du plan qui contient la date d ; null s'il n'y en a pas.
    if (!bloc) return null;
    var j = ecartJours(bloc.debut, d); if (j < 0) return null;
    var k = Math.floor(j / 7), sem = semaine(bloc, k); if (!sem || sem.pause) return null;
    var f = faites(journal, sem.id);
    for (var i = 0; i < sem.s.length; i++) if (!f[i]) return { w: sem.id, i: i, k: k, s: sem.s[i] };
    return null;
  }

  // ---------- Médailles bonus ----------
  function parSemaine(sorties) { var o = {}; (sorties || []).forEach(function (x) { var l = lundiDe(x.d); o[l] = (o[l] || 0) + 1; }); return o; }
  function semainesPleines(sorties, auj) {
    // max : plus longue suite de semaines (lundi-dimanche) à trois sorties ou plus ; cours : suite qui tient encore aujourd'hui.
    var o = parSemaine(sorties), max = 0, n = 0, prec = null;
    Object.keys(o).sort().forEach(function (l) {
      if (o[l] < 3) return;
      n = (prec && ecartJours(prec, l) === 7) ? n + 1 : 1; prec = l; if (n > max) max = n;
    });
    var cours = 0, l = lundiDe(auj);
    if (!(o[l] >= 3)) l = plusJours(l, -7);
    while (o[l] >= 3) { cours++; l = plusJours(l, -7); }
    return { max: max, cours: cours };
  }
  function serieMax(routine) {
    var j = (routine && routine.jours) || {}, max = 0, n = 0, prec = null;
    Object.keys(j).filter(function (d) { return j[d] === true; }).sort().forEach(function (d) {
      n = (prec && ecartJours(prec, d) === 1) ? n + 1 : 1; prec = d; if (n > max) max = n;
    });
    return max;
  }
  function enHiver(d) { var m = +String(d).slice(5, 7); return m === 12 || m <= 2; }
  function nbHiver(sorties) { return (sorties || []).filter(function (x) { return enHiver(x.d); }).length; }
  function reposLong(sorties, auj) {
    // Sept jours entiers sans sortie, après une première sortie.
    var l = (sorties || []).map(function (x) { return x.d; }).sort();
    if (!l.length) return false;
    for (var i = 1; i < l.length; i++) if (ecartJours(l[i - 1], l[i]) >= 8) return true;
    return ecartJours(l[l.length - 1], auj) >= 8;
  }
  function un(sorties, test) { return (sorties || []).some(test); }
  function combien(sorties, test) { return (sorties || []).filter(test).length; }
  // Treize médailles évolutives (bronze, argent, or) et deux uniques.
  // mesure : la valeur du moment ; record : le meilleur déjà atteint, quand une série peut retomber.
  var NIVEAUX = ['bronze', 'argent', 'or'], NOMS_NIVEAUX = ['Bronze', 'Argent', 'Or'], VERS = ['le bronze', 'l’argent', 'l’or'];
  // Un quatrième rang, secret : le platine n'apparaît qu'une fois l'or décroché.
  var RANGS = NIVEAUX.concat(['platine']);
  function pl(n, un, plusieurs) { return n + ' ' + (n > 1 ? plusieurs : un); }
  function semainesTxt(n) { return pl(n, 'semaine', 'semaines'); }
  function matinsTxt(n) { return pl(n, 'matin', 'matins'); }
  function sortiesTxt(n) { return pl(n, 'sortie', 'sorties'); }
  function nuitsTxt(n) { return pl(n, 'nuit', 'nuits'); }
  function randosTxt(n) { return pl(n, 'randonnée', 'randonnées'); }
  // Chamois : chaque palier demande une distance ET un dénivelé, dans la même sortie. Le quatrième est le platine.
  var CHAMOIS = [{ km: 3, dp: 100 }, { km: 8, dp: 500 }, { km: 12, dp: 1000 }, { km: 20, dp: 1400 }];
  function rangChamois(x) { var n = 0; CHAMOIS.forEach(function (q, i) { if (x && (x.km || 0) >= q.km && (x.dp || 0) >= q.dp) n = i + 1; }); return n; }
  function meilleureChamois(sorties) {
    // La sortie qui va le plus haut dans les paliers ; à égalité, celle qui a le plus de dénivelé.
    var m = null, r = 0;
    (sorties || []).forEach(function (x) { var n = rangChamois(x); if (n > r || (n > 0 && n === r && (x.dp || 0) > (m.dp || 0))) { m = x; r = n; } });
    return { rang: r, sortie: m };
  }
  var BONUS = [
    { id: 'bornes', nom: 'Les bornes', icone: 'bornes', critere: 'Kilomètres cumulés.',
      mesure: function (c) { return somme(c.sorties, 'km'); },
      fmt: function (v) { return (v >= 1000 ? mil(Math.floor(v)) : fx(Math.floor(v * 10) / 10)) + ' km'; }, reste: function (r) { return fx(Math.ceil(r * 10) / 10) + ' km'; },
      paliers: [{ s: 100, t: '100 km', l: '100 km cumulés', mot: 'Cent kilomètres au compteur.' },
                { s: 250, t: '250 km', l: '250 km cumulés', mot: 'Deux cent cinquante kilomètres : le compteur tourne.' },
                { s: 500, t: '500 km', l: '500 km cumulés', mot: 'Cinq cents kilomètres. Ça commence à faire du chemin.' }],
      platine: { s: 1000, t: '1\u00a0000 km', l: '1\u00a0000 km cumulés', mot: 'Mille kilomètres au compteur. Chapeau.' } },
    { id: 'sommets', nom: 'Les sommets', icone: 'dole', critere: 'Dénivelé cumulé : un sommet par palier.',
      mesure: function (c) { return somme(c.sorties, 'dp'); },
      fmt: function (v) { return mil(v) + ' m'; }, reste: function (r) { return mil(Math.ceil(r)) + ' m'; },
      vers: function (p, r) { return p.t + ' est à ' + mil(Math.ceil(r)) + ' m.'; },
      paliers: [{ s: 1677, t: 'La Dôle', l: '1\u00a0677 m de dénivelé cumulés', icone: 'dole', fait: 'La Dôle est gravie.', mot: 'En cumulé, tu as grimpé la hauteur de la Dôle.' },
                { s: 4478, t: 'Le Cervin', l: '4\u00a0478 m de dénivelé cumulés', icone: 'cervin', fait: 'Le Cervin est gravi.', mot: 'En cumulé, tu as grimpé la hauteur du Cervin.' },
                { s: 8849, t: 'L’Everest', l: '8\u00a0849 m de dénivelé cumulés', icone: 'everest', fait: 'L’Everest est gravi.', mot: 'Du niveau de la mer au toit du monde, en cumulé.' }],
      platine: { s: 21900, t: 'Olympus Mons', l: '21\u00a0900 m de dénivelé cumulés', icone: 'olympus', fait: 'Olympus Mons est gravi.', mot: 'En cumulé, tu as grimpé le plus haut volcan de Mars.' } },
    { id: 'metronome', nom: 'Métronome', icone: 'metronome', critere: 'Semaines pleines d’affilée : trois sorties ou plus dans la semaine.',
      mesure: function (c) { return semainesPleines(c.sorties, c.auj).cours; }, record: function (c) { return semainesPleines(c.sorties, c.auj).max; },
      fmt: semainesTxt, reste: semainesTxt,
      paliers: [{ s: 1, t: '1', l: '1 semaine pleine', mot: 'Trois sorties en une semaine : le rythme est là.' },
                { s: 4, t: '4', l: '4 semaines pleines d’affilée', mot: 'Quatre semaines pleines de suite. Réglé comme une horloge.' },
                { s: 12, t: '12', l: '12 semaines pleines d’affilée', mot: 'Douze semaines pleines d’affilée : un bloc entier sans fausse note.' }],
      platine: { s: 26, t: '26', l: '26 semaines pleines d’affilée', mot: 'Vingt-six semaines pleines d’affilée : six mois sans fausse note.' } },
    { id: 'routine', nom: 'Routine de fer', icone: 'routine', critere: 'Matins de routine d’affilée.',
      mesure: function (c) { return c.routine ? serie(c.routine, c.auj) : 0; }, record: function (c) { return serieMax(c.routine); },
      fmt: matinsTxt, reste: matinsTxt,
      paliers: [{ s: 7, t: '7', l: '7 matins d’affilée', mot: 'Sept matins de suite : la routine s’installe.' },
                { s: 30, t: '30', l: '30 matins d’affilée', mot: 'Trente matins de suite. Les pompes n’ont qu’à bien se tenir.' },
                { s: 100, t: '100', l: '100 matins d’affilée', mot: 'Cent matins d’affilée. C’est devenu une seconde nature.' }],
      platine: { s: 365, t: '365', l: '365 matins d’affilée', mot: 'Une année entière de matins, sans en manquer un.' } },
    { id: 'givre', nom: 'Givré', icone: 'givre', critere: 'Sorties entre décembre et février.',
      mesure: function (c) { return nbHiver(c.sorties); },
      fmt: sortiesTxt, reste: sortiesTxt,
      paliers: [{ s: 10, t: '10', l: '10 sorties d’hiver', mot: 'Dix sorties en plein hiver. Même pas froid.' },
                { s: 25, t: '25', l: '25 sorties d’hiver', mot: 'Vingt-cinq sorties d’hiver : le froid ne t’arrête plus.' },
                { s: 50, t: '50', l: '50 sorties d’hiver', mot: 'Cinquante sorties d’hiver. Givré pour de bon.' }],
      platine: { s: 75, t: '75', l: '75 sorties d’hiver', mot: 'Soixante-quinze sorties d’hiver. L’hiver, c’est ta saison.' } },
    { id: 'grimpeur', nom: 'Grimpeur', icone: 'grimpeur', critere: 'Sorties à 300 m de dénivelé ou plus.',
      mesure: function (c) { return combien(c.sorties, function (x) { return (x.dp || 0) >= 300; }); },
      fmt: sortiesTxt, reste: sortiesTxt,
      paliers: [{ s: 5, t: '5', l: '5 sorties à 300 m de dénivelé ou plus', mot: 'Cinq sorties qui montent vraiment. Les mollets s’y font.' },
                { s: 20, t: '20', l: '20 sorties à 300 m de dénivelé ou plus', mot: 'Vingt sorties qui grimpent. La pente devient ton terrain.' },
                { s: 50, t: '50', l: '50 sorties à 300 m de dénivelé ou plus', mot: 'Cinquante sorties à 300 m ou plus. Grimpeur, pour de bon.' }],
      platine: { s: 100, t: '100', l: '100 sorties à 300 m de dénivelé ou plus', mot: 'Cent sorties qui grimpent. La montagne te connaît.' } },
    { id: 'fidele', nom: 'Fidèle au poste', icone: 'fidele', critere: 'Semaines avec au moins une sortie, d’affilée ou non.',
      mesure: function (c) { return Object.keys(parSemaine(c.sorties)).length; },
      fmt: semainesTxt, reste: semainesTxt,
      paliers: [{ s: 10, t: '10', l: '10 semaines avec au moins une sortie', mot: 'Dix semaines où tu as répondu présent.' },
                { s: 26, t: '26', l: '26 semaines avec au moins une sortie', mot: 'Vingt-six semaines courues : l’équivalent de six mois.' },
                { s: 52, t: '52', l: '52 semaines avec au moins une sortie', mot: 'Cinquante-deux semaines courues : l’équivalent d’une année entière.' }],
      platine: { s: 104, t: '104', l: '104 semaines avec au moins une sortie', mot: 'Cent quatre semaines courues : l’équivalent de deux années.' } },
    { id: 'long', nom: 'Au long cours', icone: 'long', critere: 'Sorties de 10 km ou plus.',
      mesure: function (c) { return combien(c.sorties, function (x) { return (x.km || 0) >= 10; }); },
      fmt: sortiesTxt, reste: sortiesTxt,
      paliers: [{ s: 5, t: '5', l: '5 sorties de 10 km ou plus', mot: 'Cinq sorties de 10 km ou plus. La distance s’apprivoise.' },
                { s: 20, t: '20', l: '20 sorties de 10 km ou plus', mot: 'Vingt sorties longues. L’endurance s’installe.' },
                { s: 50, t: '50', l: '50 sorties de 10 km ou plus', mot: 'Cinquante sorties de 10 km ou plus. Le long cours, c’est chez toi.' }],
      platine: { s: 100, t: '100', l: '100 sorties de 10 km ou plus', mot: 'Cent sorties longues. La distance n’a plus de secret.' } },
    { id: 'loir', nom: 'Loir', icone: 'loir', critere: 'Nuits d’affilée avec un score de sommeil de 80 ou plus.',
      mesure: function (c) { return seriesNuits(c.sommeil, c.auj).cours; }, record: function (c) { return seriesNuits(c.sommeil, c.auj).max; },
      fmt: nuitsTxt, reste: nuitsTxt,
      paliers: [{ s: 3, t: '3', l: '3 nuits d’affilée à 80 ou plus', mot: 'Trois bonnes nuits de suite. Le repos fait partie de l’entraînement.' },
                { s: 6, t: '6', l: '6 nuits d’affilée à 80 ou plus', mot: 'Six nuits d’affilée à 80 ou plus. Le sommeil devient un allié.' },
                { s: 10, t: '10', l: '10 nuits d’affilée à 80 ou plus', mot: 'Dix nuits d’affilée à 80 ou plus. Tu dors comme un loir.' }],
      platine: { s: 15, t: '15', l: '15 nuits d’affilée à 80 ou plus', mot: 'Quinze nuits d’affilée à 80 ou plus. La récupération n’a plus de secret.' } },
    { id: 'sac', nom: 'Sac allégé', icone: 'sac', critere: 'Kilos perdus depuis ta première pesée, lus sur la moyenne de 7 jours. Sans se presser.',
      mesure: function (c) { return pertePoids(c.poids).cours; }, record: function (c) { return pertePoids(c.poids).max; },
      fmt: function (v) { return fx(v) + ' kg'; }, reste: function (r) { return fx(Math.ceil(r * 10) / 10) + ' kg'; },
      paliers: [{ s: 5, t: '5 kg', l: '5 kg de moins qu’à ta première pesée', mot: 'Cinq kilos de moins qu’au départ. Le sac est plus léger.' },
                { s: 10, t: '10 kg', l: '10 kg de moins qu’à ta première pesée', mot: 'Dix kilos de moins : dix litres d’eau que tu ne portes plus.' },
                { s: 15, t: '15 kg', l: '15 kg de moins qu’à ta première pesée', mot: 'Quinze kilos de moins qu’au départ. Les montées le sentent.' }],
      platine: { s: 25, t: '25 kg', l: '25 kg de moins qu’à ta première pesée', mot: 'Vingt-cinq kilos de moins qu’au départ. Le même dossard, un tout autre coureur.' } },
    { id: 'rando', nom: 'Randonneur', icone: 'rando', critere: 'Randonnées notées : coche « C’était une randonnée » en notant ta sortie.',
      mesure: function (c) { return combien(c.sorties, function (x) { return !!x.rando; }); },
      fmt: randosTxt, reste: randosTxt,
      paliers: [{ s: 3, t: '3', l: '3 randonnées', mot: 'Trois randonnées au carnet. Le sentier te va bien.' },
                { s: 10, t: '10', l: '10 randonnées', mot: 'Dix randonnées. Les chaussures sont faites à ton pied.' },
                { s: 25, t: '25', l: '25 randonnées', mot: 'Vingt-cinq randonnées. Les panneaux jaunes n’ont plus de secret.' }],
      platine: { s: 50, t: '50', l: '50 randonnées', mot: 'Cinquante randonnées. Randonneur, pour de bon.' } },
    // Chamois : la mesure est le rang du meilleur palier atteint par une seule sortie (0 à 4).
    { id: 'chamois', nom: 'Chamois', icone: 'chamois', critere: 'Une sortie à la fois longue et qui grimpe : la distance et le dénivelé comptent dans la même sortie.',
      mesure: function (c) { return meilleureChamois(c.sorties).rang; },
      valeur: function (c) { var m = meilleureChamois(c.sorties).sortie; return m ? fx(m.km) + ' km · ' + mil(m.dp) + ' m' : 'Pas encore'; },
      fmt: function (v) { return v + ' sur 3'; },
      vers: function (p) { return p.v; },
      paliers: [{ s: 1, t: '3 km · 100 m', l: '3 km et 100 m de dénivelé dans la même sortie', v: 'Pour le bronze : une sortie d’au moins 3 km avec 100 m de dénivelé ou plus.',
                  mot: 'Trois kilomètres et 100 m de dénivelé dans la même sortie : ça grimpe.' },
                { s: 2, t: '8 km · 500 m', l: '8 km et 500 m de dénivelé dans la même sortie', v: 'Pour l’argent : une sortie d’au moins 8 km avec 500 m de dénivelé ou plus.',
                  mot: 'Huit kilomètres et 500 m de dénivelé d’une traite. Le pied montagnard.' },
                { s: 3, t: '12 km · 1\u00a0000 m', l: '12 km et 1\u00a0000 m de dénivelé dans la même sortie', v: 'Pour l’or : une sortie d’au moins 12 km avec 1\u00a0000 m de dénivelé ou plus.',
                  mot: 'Douze kilomètres et 1\u00a0000 m de dénivelé dans la même sortie. Un vrai chamois.' }],
      platine: { s: 4, t: '20 km · 1\u00a0400 m', l: '20 km et 1\u00a0400 m de dénivelé dans la même sortie', v: 'Pour le platine : une sortie d’au moins 20 km avec 1\u00a0400 m de dénivelé ou plus.',
                 mot: 'Vingt kilomètres et 1\u00a0400 m de dénivelé dans la même sortie. La montagne est à toi.' } },
    { id: 'jambes', nom: 'Jambes légères', icone: 'jambes', critere: 'Sorties notées « facile ».',
      mesure: function (c) { return combien(c.sorties, function (x) { return x.res === 'facile'; }); },
      fmt: sortiesTxt, reste: sortiesTxt,
      paliers: [{ s: 10, t: '10', l: '10 sorties notées « facile »', mot: 'Dix sorties notées « facile ». Les jambes répondent.' },
                { s: 30, t: '30', l: '30 sorties notées « facile »', mot: 'Trente sorties faciles. Ce qui coûtait hier passe tout seul.' },
                { s: 75, t: '75', l: '75 sorties notées « facile »', mot: 'Soixante-quinze sorties faciles. La forme est là.' }],
      platine: { s: 150, t: '150', l: '150 sorties notées « facile »', mot: 'Cent cinquante sorties faciles. Des jambes légères, pour de bon.' } },
    { id: 'joursans', nom: 'Jour sans', icone: 'joursans', critere: 'Une sortie notée « dur ».',
      mot: 'Les jours sans font partie du jeu. Celui-là est noté.',
      ok: function (c) { return un(c.sorties, function (x) { return x.res === 'dur'; }); } },
    { id: 'marmotte', nom: 'Marmotte', icone: 'marmotte', critere: 'Sept jours de suite sans courir.',
      mot: 'Une semaine entière sans courir. Le repos compte aussi.',
      ok: function (c) { return reposLong(c.sorties, c.auj); } }
  ];
  function bonus(id) { for (var i = 0; i < BONUS.length; i++) if (BONUS[i].id === id) return BONUS[i]; return null; }
  // poids : la liste des pesées ; sommeil : la liste des nuits (voir mesures() et nuits()).
  function contexte(c) { return { sorties: (c && c.sorties) || [], routine: (c && c.routine) || null, poids: (c && c.poids) || [], sommeil: (c && c.sommeil) || [], auj: c.auj }; }
  // Une médaille décrochée se note par une clé : « marmotte » pour une unique, « bornes-2 » pour l'argent des bornes.
  function clesBonus(avecSecrets) {
    var l = [];
    BONUS.forEach(function (b) { if (b.paliers) b.paliers.forEach(function (p, i) { l.push(b.id + '-' + (i + 1)); }); else l.push(b.id); });
    if (avecSecrets) BONUS.forEach(function (b) { if (b.paliers) l.push(b.id + '-4'); });
    return l;
  }
  function totalBonus(gagnees) {
    // Ce qu'il y a à décrocher, vu d'ici : les 41 médailles, plus un platine pour chaque or déjà décroché.
    var n = clesBonus().length;
    BONUS.forEach(function (b) { if (b.paliers && gagnees && gagnees[b.id + '-3']) n++; });
    return n;
  }
  function lireCle(cle) {
    var m = /^(.+)-([1234])$/.exec(String(cle)), b = bonus(m ? m[1] : cle);
    if (!b || !!m !== !!b.paliers) return null;
    return { b: b, n: m ? +m[2] : 0, p: m ? (+m[2] === 4 ? b.platine : b.paliers[m[2] - 1]) : null };
  }
  function bonusGagnes(c) {
    c = contexte(c); var l = [];
    BONUS.forEach(function (b) {
      if (!b.paliers) { if (b.ok(c)) l.push(b.id); return; }
      var v = Math.max(b.mesure(c), b.record ? b.record(c) : 0);
      b.paliers.forEach(function (p, i) { if (v >= p.s) l.push(b.id + '-' + (i + 1)); });
      if (v >= b.platine.s) l.push(b.id + '-4');
    });
    return l;
  }
  function niveauBonus(id, gagnees) { var n = 0; for (var i = 1; i <= 4; i++) if (gagnees && gagnees[id + '-' + i]) n = i; return n; }
  function suiviBonus(id, c, niveau) {
    // Ce qu'affiche la ligne d'une médaille évolutive : la valeur du moment, la part du rail remplie
    // (le premier palier est à 20 % du rail, le deuxième à 60 %, le troisième au bout) et la phrase de suivi.
    var b = bonus(id); c = contexte(c); niveau = niveau || 0;
    var v = b.mesure(c), s = b.paliers.map(function (p) { return p.s; }), part;
    if (v >= s[2]) part = 1;
    else if (v >= s[1]) part = 0.6 + 0.4 * (v - s[1]) / (s[2] - s[1]);
    else if (v >= s[0]) part = 0.2 + 0.4 * (v - s[0]) / (s[1] - s[0]);
    else part = 0.2 * v / s[0];
    part = Math.max(part, [0, 0.2, 0.6, 1, 1][niveau]);
    var q = niveau === 4 ? b.platine : (niveau ? b.paliers[niveau - 1] : null);
    var fait = q ? (q.fait || (niveau === 4 ? 'Platine' : NOMS_NIVEAUX[niveau - 1]) + ' décroché.') : '', suite = '';
    if (niveau < 4) {
      var p = niveau === 3 ? b.platine : b.paliers[niveau], r = Math.max(0, p.s - v);
      suite = b.vers ? b.vers(p, r) : 'Encore ' + b.reste(r) + ' avant ' + (niveau === 3 ? 'le platine' : VERS[niveau]) + '.';
    }
    var o = { valeur: b.valeur ? b.valeur(c) : b.fmt(v), part: Math.round(part * 1000) / 1000, phrase: (fait + ' ' + suite).trim() };
    // Une fois l'or décroché : la part du chemin faite entre l'or et le platine.
    if (niveau >= 3) o.partPlatine = niveau === 4 ? 1 : Math.round(Math.max(0, Math.min(1, (v - s[2]) / (b.platine.s - s[2]))) * 1000) / 1000;
    return o;
  }
  var ANCIENNES = { cent: 'bornes-1', cervin: 'sommets-2', everest: 'sommets-3', semaine: 'metronome-1', metronome: 'metronome-2', routine30: 'routine-2', givre: 'givre-1', chamois: 'chamois-1' };
  // Les thèmes de la vitrine : chaque médaille bonus est rangée dans un thème, trois par thème au plus.
  var THEMES = [
    { id: 'km', nom: 'Kilomètres', ids: ['rando', 'bornes', 'long'] },
    { id: 'deniv', nom: 'Dénivelé', ids: ['sommets', 'grimpeur', 'chamois'] },
    { id: 'regul', nom: 'Régularité', ids: ['metronome', 'fidele', 'routine'] },
    { id: 'temps', nom: 'Par tous les temps', ids: ['givre', 'joursans', 'marmotte'] },
    { id: 'forme', nom: 'Forme', ids: ['loir', 'sac', 'jambes'] }
  ];
  function paliersBonus(id, c, gagnees) {
    // Pour la fiche d'une médaille évolutive : chaque palier, son seuil, sa date s'il est décroché, sinon ce qui manque.
    var b = bonus(id); c = contexte(c); var v = b.mesure(c);
    var liste = b.paliers.slice(), noms = NOMS_NIVEAUX.concat(['Platine']);
    if (gagnees && gagnees[id + '-3']) liste.push(b.platine); // le palier secret ne se montre qu'une fois l'or décroché
    return liste.map(function (p, i) {
      var date = (gagnees && gagnees[id + '-' + (i + 1)]) || null;
      return { niveau: RANGS[i], nom: noms[i], seuil: p.icone ? p.t + ' · ' + mil(p.s) + ' m' : (/[a-z]/i.test(p.t) ? p.t : b.fmt(p.s)), date: date, reste: date || !b.reste ? null : b.reste(Math.max(0, p.s - v)) };
    });
  }
  function migrerBonus(anciens) {
    // Les médailles notées avant les paliers gardent leur date ; celles qui n'existent plus sont laissées de côté.
    var valides = {}, o = {};
    clesBonus(true).forEach(function (k) { valides[k] = 1; });
    Object.keys(anciens || {}).forEach(function (k) { var n = valides[k] ? k : ANCIENNES[k]; if (n && valides[n] && !o[n]) o[n] = anciens[k]; });
    return o;
  }

  // ---------- Course cible ----------
  // Une course datée devient l'objectif du programme : d'abord les médailles qu'elle demande, puis une préparation à sa mesure.
  function lundiDe(s) { return plusJours(s, -((dateDe(s).getDay() + 6) % 7)); }
  function besoinsCourse(c) {
    return { dist: c.km >= 42.19 ? 'marathon' : (c.km >= 21.09 ? 'semi' : (c.km >= 10 ? '10k' : '5k')),
             deniv: c.dp >= 2000 ? 'd2000' : (c.dp >= 1000 ? 'd1000' : (c.dp >= 500 ? 'd500' : null)) };
  }
  // L'objectif que pose la course, sans jamais laisser de côté une médaille déjà décrochée ou en préparation.
  function butCourse(c, p) {
    var b = besoinsCourse(c), deja = Object.keys((p && p.medailles) || {}).concat(p && p.bloc ? [p.bloc.obj] : []);
    function haut(liste, id) { var k = liste.indexOf(id); deja.forEach(function (d) { k = Math.max(k, liste.indexOf(d)); }); return k < 0 ? null : liste[k]; }
    return { dist: haut(BUTS.dist, b.dist) || '5k', deniv: haut(BUTS.deniv, b.deniv) };
  }
  var ACQUIS = { '5k': 5, '10k': 10, semi: 21.1, marathon: 42.2, d500: 500, d1000: 1000, d2000: 2000 };
  function demi(v) { return Math.round(v * 2) / 2; }
  function cinquante(v) { return Math.round(v / 50) * 50; }
  // La préparation finale : n semaines (1 à 10). La sortie longue monte jusqu'à 85 % environ de la distance et du dénivelé de
  // la course, avec une semaine plus légère toutes les trois semaines ; puis une semaine allégée, puis la semaine de la course.
  function semainesCourse(c, n) {
    var b = besoinsCourse(c), bkm = ACQUIS[b.dist], bdp = b.deniv ? ACQUIS[b.deniv] : 0, vallonne = c.dp >= 300;
    var pkm = Math.max(4, demi(c.km * 0.85)), pdp = cinquante(c.dp * 0.85);
    var skm = Math.min(pkm, Math.max(4, demi(Math.min(pkm * 0.7, bkm * 0.75)))), sdp = Math.min(pdp, cinquante(Math.min(pdp * 0.7, Math.max(bdp * 0.8, 150))));
    var sortie = function (km, dp) { return vallonne && dp >= 50 ? trail(km, dp) : longue(km); };
    var l = [], m = Math.max(0, n - 2), f1 = c.km < 10 ? 30 : 45, f2 = c.km < 10 ? 25 : 50;
    for (var i = 0; i < m; i++) {
      var t = m > 1 ? i / (m - 1) : 1, km = skm + (pkm - skm) * t, dp = sdp + (pdp - sdp) * t, leger = m >= 4 && (i + 1) % 3 === 0 && i < m - 1;
      l.push(leger ? S3(footing(f1 - 5, vallonne), footing(f2 - 15 < 20 ? 20 : f2 - 15), sortie(demi(km * 0.75), cinquante(dp * 0.7)), 'allegee')
                   : S3(footing(f1, vallonne), footing(f2), sortie(demi(km), cinquante(dp))));
    }
    if (n >= 2) l.push(S3(footing(f1 - 5, vallonne), footing(c.km < 10 ? 20 : 30), sortie(demi(pkm * 0.5), cinquante(pdp * 0.4)), 'allegee'));
    var resume = fx(c.km) + ' km' + (c.dp ? ' et ' + mil(c.dp) + ' m de dénivelé positif' : '') + '. Pars plus lentement que tu ne le penses, bois et mange dès la première heure.';
    l.push(S3(footing(c.km < 10 ? 20 : 30), footing(20), seance('test', 'Jour J : ta course', resume, [], { km: c.km, dp: c.dp || null, test: 'course',
      conseil: 'Rien de nouveau le jour de la course : ni chaussures, ni ravitaillement que tu n’as pas déjà essayés.' }), 'test'));
    return l;
  }
  // Le calendrier vers la course, à partir d'aujourd'hui : la préparation en cours, puis chaque médaille à la suite, puis la
  // préparation finale. accelere : au rythme rapide dès qu'il est permis ; sinon au rythme actuel, jamais plus vite que régulier.
  function calendrierCourse(p, auj, c, accelere) {
    var but = butCourse(c, p), med = (p && p.medailles) || {}, base = lireRythme(p) === 'tranquille' ? 'tranquille' : 'regulier';
    var permis = rapidePermis(p), l = [], suite = prochainLundi(auj), ry = function () { return accelere && permis ? 'rapide' : base; };
    var aFaire = etapes(but).filter(function (o) { return !med[o.id]; });
    if (p && p.bloc && aFaire.some(function (o) { return o.id === p.bloc.obj; })) {
      var bl = JSON.parse(JSON.stringify(p.bloc)), pos = position(bl, auj);
      if (pos.etat !== 'apres' && ry() !== lireRythme(p)) changerRythme(bl, pos.etat === 'avant' ? -1 : pos.k, ry());
      pos = position(bl, auj);
      l.push({ id: bl.obj, debut: bl.debut, fin: pos.jourJ, n: bl.semaines.length, encours: true, rythme: ry() });
      if (plusJours(pos.jourJ, 1) > suite) suite = plusJours(pos.jourJ, 1);
      if (bl.obj === '5k') permis = true;
      aFaire = aFaire.filter(function (o) { return o.id !== bl.obj; });
    }
    aFaire.forEach(function (o) {
      var dep = 0; if (o.id === '5k') DEPARTS.forEach(function (d) { if (p && d.id === p.niveau) dep = d.depart; });
      var n = sequence(o.id, ry(), dep).length, fin = plusJours(suite, n * 7 - 1);
      l.push({ id: o.id, debut: suite, fin: fin, n: n, rythme: ry() }); suite = plusJours(fin, 1);
      if (o.id === '5k') permis = true;
    });
    // Les semaines entre la dernière médaille et la course, semaine de la course comprise
    var lundi = lundiDe(c.d), W = Math.floor(ecartJours(suite, lundi) / 7) + 1;
    var o = { but: but, accelere: !!accelere, etapes: l, pretLe: l.length ? l[l.length - 1].fin : null, semaines: Math.max(0, W), jourJ: c.d };
    if (W >= 1) {
      var nb = Math.min(W, 10), sem = semainesCourse(c, nb), km = 0, dp = 0;
      sem.forEach(function (s) { var x = s.s[2]; if (x.type !== 'test') { km = Math.max(km, x.km || 0); dp = Math.max(dp, x.dp || 0); } });
      o.finale = { n: nb, debut: plusJours(lundi, -(nb - 1) * 7), semaines: sem, km: km, dp: dp };
      o.marge = W - nb; o.verdict = nb >= 4 ? 'pret' : 'juste';
    } else {
      o.verdict = 'court'; o.manque = 1 - W;
      l.forEach(function (e) { if (!o.ou && c.d <= e.fin) o.ou = { id: e.id, k: c.d < e.debut ? 0 : Math.floor(ecartJours(e.debut, c.d) / 7) + 1, n: e.n }; });
      o.acquises = l.filter(function (e) { return e.fin < c.d; }).map(function (e) { return e.id; });
    }
    return o;
  }

  // ---------- Vrais dossards de course ----------
  // Les couleurs d'un dossard photographié. px : les octets RGBA d'une petite image de l × h points.
  // On ne regarde que le centre de la photo, là où se trouve le dossard. Renvoie le papier (fond), le bandeau
  // (accent) et les couleurs franches relevées (palette), en « #RRGGBB ».
  function hexa(c) { return '#' + c.map(function (v) { return ('0' + Math.max(0, Math.min(255, Math.round(v))).toString(16)).slice(-2); }).join('').toUpperCase(); }
  function couleurValide(h) { return typeof h === 'string' && /^#[0-9A-Fa-f]{6}$/.test(h); }
  function rvb(h) { return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]; }
  function luminance(c) {
    var f = function (v) { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]);
  }
  function contraste(a, b) { var x = luminance(a), y = luminance(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); }
  // L'encre lisible sur une couleur : l'encre de l'appli, ou le blanc.
  function encreSur(h) { var c = rvb(couleurValide(h) ? h : '#FFFFFF'); return contraste(c, [16, 20, 24]) >= contraste(c, [255, 255, 255]) ? '#101418' : '#FFFFFF'; }
  // Écart entre deux couleurs, où l'éclairage (en pleine lumière ou à l'ombre) compte moins que la teinte.
  function clair(c) { return (0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]) / 255; }
  function ecart(a, b) {
    var ya = clair(a) * 255, yb = clair(b) * 255, dy = (ya - yb) * 0.45, du = (a[2] - ya) - (b[2] - yb), dv = (a[0] - ya) - (b[0] - yb);
    return Math.sqrt(dy * dy + du * du + dv * dv);
  }
  function vif(c) { return (Math.max(c[0], c[1], c[2]) - Math.min(c[0], c[1], c[2])) / 255; }
  // Deux couleurs de même teinte, l'une n'étant que l'autre à l'ombre.
  function pleine(c) { var m = Math.max(c[0], c[1], c[2], 1); return [c[0] * 255 / m, c[1] * 255 / m, c[2] * 255 / m]; }
  function memeTeinte(a, b) { return ecart(pleine(a), pleine(b)) < 40; }
  function couleursProches(a, b) { return couleurValide(a) && couleurValide(b) && ecart(rvb(a), rvb(b)) < 40; }
  function couleursDossard(px, l, h) {
    var N = l * h, i, j, x, y, k, c;
    // 1. Les teintes voisines sont réunies autour de la plus fréquente d'entre elles.
    var cases = {}, cle = new Array(N);
    for (i = 0; i < N; i++) {
      j = i * 4; k = px[j + 3] < 128 ? -1 : (px[j] >> 4) << 8 | (px[j + 1] >> 4) << 4 | (px[j + 2] >> 4); cle[i] = k;
      if (k < 0) continue;
      c = cases[k] || (cases[k] = { s: [0, 0, 0], n: 0, g: -1 }); c.s[0] += px[j]; c.s[1] += px[j + 1]; c.s[2] += px[j + 2]; c.n++;
    }
    var groupes = [];
    Object.keys(cases).map(function (k) { var e = cases[k]; e.c = [e.s[0] / e.n, e.s[1] / e.n, e.s[2] / e.n]; return e; })
      .sort(function (a, b) { return b.n - a.n; })
      .forEach(function (e) {
        for (var g = 0; g < groupes.length; g++) if (ecart(groupes[g].c, e.c) < 40) { e.g = g; return; }
        e.g = groupes.length; groupes.push({ c: e.c, p: 0, bord: 0 });
      });
    if (!groupes.length) return { fond: '#FFFFFF', accent: '#101418', palette: [] };
    var grp = new Array(N); for (i = 0; i < N; i++) grp[i] = cle[i] < 0 ? -1 : cases[cle[i]].g;
    // 2. Le décor (un maillot, une table) : les couleurs des bords de la photo, suivies de proche en proche.
    //    Le numéro, même de la couleur du maillot, n'en fait pas partie : le papier l'en sépare.
    var bx = Math.max(2, Math.round(l * 0.06)), by = Math.max(2, Math.round(h * 0.06)), nbBord = 0;
    var auBord = function (x, y) { return x < bx || x >= l - bx || y < by || y >= h - by; };
    for (y = 0; y < h; y++) for (x = 0; x < l; x++) if (auBord(x, y) && grp[y * l + x] >= 0) { groupes[grp[y * l + x]].bord++; nbBord++; }
    var duBord = function (q) { return grp[q] >= 0 && groupes[grp[q]].bord / nbBord >= 0.05; };
    var decor = new Uint8Array(N), pile = [];
    for (y = 0; y < h; y++) for (x = 0; x < l; x++) { i = y * l + x; if (auBord(x, y) && duBord(i)) { decor[i] = 1; pile.push(i); } }
    var voisin = function (q) { if (!decor[q] && duBord(q)) { decor[q] = 1; pile.push(q); } };
    while (pile.length) {
      i = pile.pop(); x = i % l;
      if (x > 0) voisin(i - 1); if (x < l - 1) voisin(i + 1); if (i >= l) voisin(i - l); if (i < N - l) voisin(i + l);
    }
    // Ce qui reste doit former un bloc plein (un dossard), pas des traits épars (un numéro). Sinon la photo est cadrée
    // sur le dossard seul, et c'est son papier qu'on vient d'écarter : dans ce cas, il n'y a pas de décor.
    var xs = [], ys = [], plein = false, croissant = function (a, b) { return a - b; };
    for (y = 0; y < h; y++) for (x = 0; x < l; x++) { i = y * l + x; if (!decor[i] && grp[i] >= 0) { xs.push(x); ys.push(y); } }
    if (xs.length >= N * 0.03) {
      xs.sort(croissant); ys.sort(croissant);
      var q = function (t, f) { return t[Math.min(t.length - 1, Math.floor(t.length * f))]; };
      var x0 = q(xs, 0.05), x1 = q(xs, 0.95), y0 = q(ys, 0.05), y1 = q(ys, 0.95), dedans = 0;
      for (y = y0; y <= y1; y++) for (x = x0; x <= x1; x++) { i = y * l + x; if (!decor[i] && grp[i] >= 0) dedans++; }
      plein = dedans >= (x1 - x0 + 1) * (y1 - y0 + 1) * 0.5;
    }
    var avecDecor = plein; if (!plein) decor = new Uint8Array(N);
    // Le décor déborde un peu sur le dossard : son ombre, et le liseré où les deux couleurs se mêlent. On l'élargit de deux points.
    for (var tour = 0; avecDecor && tour < 2; tour++) {
      var large = new Uint8Array(decor);
      for (y = 0; y < h; y++) for (x = 0; x < l; x++) {
        i = y * l + x;
        if (!decor[i] && ((x > 0 && decor[i - 1]) || (x < l - 1 && decor[i + 1]) || (y > 0 && decor[i - l]) || (y < h - 1 && decor[i + l]))) large[i] = 1;
      }
      decor = large;
    }
    // 3. Le dossard : ce qui reste. Le milieu de la photo compte plus que ses bords.
    //    Le papier : la couleur la plus présente, avec un avantage aux couleurs claires.
    var total, papier, poids = function (g) { return g.p * (0.3 + 0.7 * clair(g.c)); };
    var mesurer = function () {
      total = 0; groupes.forEach(function (g) { g.p = 0; });
      for (var y = 0; y < h; y++) for (var x = 0; x < l; x++) {
        var i = y * l + x; if (decor[i] || grp[i] < 0) continue;
        var u = (x + 0.5) / l * 2 - 1, v = (y + 0.5) / h * 2 - 1, w = Math.exp(-(u * u + v * v) * 2);
        groupes[grp[i]].p += w; total += w;
      }
      papier = groupes.slice().sort(function (a, b) { return poids(b) - poids(a); })[0];
    };
    mesurer();
    // Un « papier » presque noir : c'est le numéro d'une photo cadrée serré. On reprend sans écarter de décor.
    if (avecDecor && clair(papier.c) < 0.25) { decor = new Uint8Array(N); mesurer(); }
    // La couleur du papier en pleine lumière : la moyenne de ses points les plus clairs (les autres sont à l'ombre d'un pli).
    var ip = groupes.indexOf(papier), pts = [], pc = [0, 0, 0];
    for (i = 0; i < N; i++) if (grp[i] === ip && !decor[i]) pts.push([px[i * 4], px[i * 4 + 1], px[i * 4 + 2]]);
    pts.sort(function (a, b) { return clair(b) - clair(a); });
    var nbHaut = Math.max(1, Math.round(pts.length * 0.3));
    for (i = 0; i < nbHaut; i++) for (j = 0; j < 3; j++) pc[j] += pts[i][j] / nbHaut;
    var m = Math.max(pc[0], pc[1], pc[2], 1);
    // Un papier photographié est toujours un peu à l'ombre, ou sous une lumière jaune ou bleutée. Presque sans teinte,
    // ou teinté comme le fait un éclairage (du rouge au bleu, dans l'ordre), c'est du blanc : on en tire l'éclairage,
    // couleur par couleur. Coloré, on le ravive seulement. Les autres couleurs suivent la même correction.
    var teinte = (m - Math.min(pc[0], pc[1], pc[2])) / m, eclairage = (pc[0] >= pc[1] && pc[1] >= pc[2]) || (pc[2] >= pc[1] && pc[1] >= pc[0]);
    var blanc = clair(pc) > 0.3 && (teinte < 0.12 || (teinte < 0.22 && eclairage)), kc = Math.min(1.8, Math.max(1, 240 / m));
    var gains = blanc ? pc.map(function (t) { return Math.min(1.8, Math.max(1, 240 / Math.max(t, 1))); }) : [kc, kc, kc];
    var corrige = function (t) { return hexa([t[0] * gains[0], t[1] * gains[1], t[2] * gains[2]]); };
    var fond = blanc ? '#FFFFFF' : corrige(pc);
    // Les couleurs franches du dossard, de la plus marquante à la moins marquante. La première sert de bandeau.
    // Le bord d'un chiffre mêle le papier et l'encre : ce mélange n'est pas une couleur du dossard.
    var encre = null;
    groupes.forEach(function (g) { if (g !== papier && g.p / total >= 0.03 && (!encre || clair(g.c) < clair(encre.c))) encre = g; });
    var melange = function (t) {
      if (!encre || clair(encre.c) > 0.3) return false;
      var a = papier.c, b = encre.c, ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], n2 = ab[0] * ab[0] + ab[1] * ab[1] + ab[2] * ab[2];
      var k = n2 ? ((t[0] - a[0]) * ab[0] + (t[1] - a[1]) * ab[1] + (t[2] - a[2]) * ab[2]) / n2 : 0;
      if (k < 0.1 || k > 0.9) return false;
      var d0 = t[0] - a[0] - k * ab[0], d1 = t[1] - a[1] - k * ab[1], d2 = t[2] - a[2] - k * ab[2];
      return Math.sqrt(d0 * d0 + d1 * d1 + d2 * d2) < 30;
    };
    var franches = [];
    groupes.filter(function (g) { return g !== papier && g.p / total >= 0.01 && vif(g.c) >= 0.25 && ecart(g.c, papier.c) >= 40 && !memeTeinte(g.c, papier.c) && !melange(g.c); })
      .sort(function (a, b) { return vif(b.c) * Math.sqrt(b.p) - vif(a.c) * Math.sqrt(a.p); })
      .forEach(function (g) { if (franches.length < 4 && franches.every(function (f) { return ecart(f, g.c) >= 60 && !memeTeinte(f, g.c); })) franches.push(g.c); });
    var palette = franches.map(corrige);
    return { fond: fond, accent: palette[0] || encreSur(fond), palette: palette };
  }

  root.DT = {
    lundiDe: lundiDe, plusMois: plusMois, grilleMois: grilleMois, parJour: parJour, duMois: duMois, totaux: totaux,
    resumeJour: resumeJour, seanceAFaire: seanceAFaire,
    BONUS: BONUS, NIVEAUX: NIVEAUX, bonus: bonus, clesBonus: clesBonus, lireCle: lireCle, bonusGagnes: bonusGagnes, niveauBonus: niveauBonus,
    suiviBonus: suiviBonus, migrerBonus: migrerBonus, CHAMOIS: CHAMOIS, rangChamois: rangChamois, THEMES: THEMES, paliersBonus: paliersBonus, RANGS: RANGS, totalBonus: totalBonus,
    BUTS: BUTS, lireBut: lireBut, nomBut: nomBut, etapes: etapes, estBut: estBut, RYTHMES: RYTHMES, lireRythme: lireRythme, RAPIDE: RAPIDE, sequence: sequence,
    dureeParcours: dureeParcours, rapidePermis: rapidePermis, rattraper: rattraper, changerRythme: changerRythme, semainesPleines: semainesPleines, serieMax: serieMax,
    iso: iso, dateDe: dateDe, dateValide: dateValide, plusJours: plusJours, ecartJours: ecartJours, prochainLundi: prochainLundi,
    fx: fx, mil: mil, minTxt: minTxt, nombre: nombre,
    BLOCS: BLOCS, OBJECTIFS: OBJECTIFS, DEPARTS: DEPARTS, objectif: objectif,
    nouvellesMedailles: nouvellesMedailles, disponible: disponible, manquants: manquants,
    nouveauBloc: nouveauBloc, position: position, semaine: semaine, faites: faites, nbFaites: nbFaites,
    refaire: refaire, refairePrecedente: refairePrecedente, decaler: decaler, retirer: retirer, jMoins: jMoins, court: court,
    routineDefaut: routineDefaut, cochesDuJour: cochesDuJour, jourComplet: jourComplet, basculer: basculer, serie: serie,
    mesures: mesures, moyenne7: moyenne7, statsPoids: statsPoids, courbe: courbe,
    nuits: nuits, seriesNuits: seriesNuits, statsNuits: statsNuits, pertePoids: pertePoids, SEUIL_NUIT: SEUIL_NUIT,
    couleursDossard: couleursDossard, encreSur: encreSur, couleurValide: couleurValide, couleursProches: couleursProches,
    besoinsCourse: besoinsCourse, butCourse: butCourse, semainesCourse: semainesCourse, calendrierCourse: calendrierCourse, lundiDe: lundiDe
  };
})(typeof window !== 'undefined' ? window : globalThis);
