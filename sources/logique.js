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
  function moyenne7(liste, d) {
    var debut = plusJours(d, -6), s = 0, n = 0;
    for (var i = 0; i < liste.length; i++) { var x = liste[i]; if (x.d >= debut && x.d <= d) { s += x.kg; n++; } }
    return n ? s / n : null;
  }
  function statsPoids(liste) {
    if (!liste.length) return null;
    var der = liste[liste.length - 1], m7 = moyenne7(liste, der.d), avant = moyenne7(liste, plusJours(der.d, -28));
    return { dernier: der, moy7: m7, avant: avant, ecart: (avant != null && m7 != null) ? m7 - avant : null };
  }
  function courbe(liste, L, H) {
    // Géométrie de la courbe : pesées (gris) et moyenne sur 7 jours (bleu), une seule échelle.
    if (!liste || liste.length < 2) return null;
    var g = { x0: 34, x1: L - 44, yh: 12, yb: H - 28 };
    var d0 = liste[0].d, d1 = liste[liste.length - 1].d, span = Math.max(1, ecartJours(d0, d1));
    var kgs = liste.map(function (x) { return x.kg; });
    var mn = Math.min.apply(null, kgs), mx = Math.max.apply(null, kgs);
    var bas = Math.floor(mn - 0.3), haut = Math.ceil(mx + 0.3);
    if (haut - bas < 2) { if ((mn - bas) < (haut - mx)) bas -= 1; else haut += 1; }
    var pas = 1; while ((haut - bas) / pas > 4) pas *= 2;
    bas = Math.floor(bas / pas) * pas; haut = Math.ceil(haut / pas) * pas;
    function X(d) { return g.x0 + (g.x1 - g.x0) * ecartJours(d0, d) / span; }
    function Y(v) { return g.yb - (v - bas) / (haut - bas) * (g.yb - g.yh); }
    var pts = liste.map(function (x) { return { d: x.d, kg: x.kg, moy: moyenne7(liste, x.d), x: X(x.d), y: Y(x.kg) }; });
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
  // Cinq médailles évolutives (bronze, argent, or) et quatre uniques.
  // mesure : la valeur du moment ; record : le meilleur déjà atteint, quand une série peut retomber.
  var NIVEAUX = ['bronze', 'argent', 'or'], NOMS_NIVEAUX = ['Bronze', 'Argent', 'Or'], VERS = ['le bronze', 'l’argent', 'l’or'];
  // Un quatrième rang, secret : le platine n'apparaît qu'une fois l'or décroché.
  var RANGS = NIVEAUX.concat(['platine']);
  function pl(n, un, plusieurs) { return n + ' ' + (n > 1 ? plusieurs : un); }
  function semainesTxt(n) { return pl(n, 'semaine', 'semaines'); }
  function matinsTxt(n) { return pl(n, 'matin', 'matins'); }
  function sortiesTxt(n) { return pl(n, 'sortie', 'sorties'); }
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
    { id: 'premier', nom: 'Premier pas', icone: 'premier', critere: 'Ta première sortie notée.',
      mot: 'La première est notée : le carnet est ouvert.',
      ok: function (c) { return c.sorties.length >= 1; } },
    { id: 'joursans', nom: 'Jour sans', icone: 'joursans', critere: 'Une sortie notée « dur ».',
      mot: 'Les jours sans font partie du jeu. Celui-là est noté.',
      ok: function (c) { return un(c.sorties, function (x) { return x.res === 'dur'; }); } },
    { id: 'chamois', nom: 'Chamois', icone: 'chamois', critere: 'Plus de 100 m de dénivelé par kilomètre, sur une sortie d’au moins 3 km.',
      mot: 'Plus de 100 m de dénivelé par kilomètre : ça grimpe.',
      ok: function (c) { return un(c.sorties, function (x) { return x.km >= 3 && (x.dp || 0) / x.km >= 100; }); } },
    { id: 'marmotte', nom: 'Marmotte', icone: 'marmotte', critere: 'Sept jours de suite sans courir.',
      mot: 'Une semaine entière sans courir. Le repos compte aussi.',
      ok: function (c) { return reposLong(c.sorties, c.auj); } }
  ];
  function bonus(id) { for (var i = 0; i < BONUS.length; i++) if (BONUS[i].id === id) return BONUS[i]; return null; }
  function contexte(c) { return { sorties: (c && c.sorties) || [], routine: (c && c.routine) || null, auj: c.auj }; }
  // Une médaille décrochée se note par une clé : « marmotte » pour une unique, « bornes-2 » pour l'argent des bornes.
  function clesBonus(avecSecrets) {
    var l = [];
    BONUS.forEach(function (b) { if (b.paliers) b.paliers.forEach(function (p, i) { l.push(b.id + '-' + (i + 1)); }); else l.push(b.id); });
    if (avecSecrets) BONUS.forEach(function (b) { if (b.paliers) l.push(b.id + '-4'); });
    return l;
  }
  function totalBonus(gagnees) {
    // Ce qu'il y a à décrocher, vu d'ici : les 28 médailles, plus un platine pour chaque or déjà décroché.
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
    var o = { valeur: b.fmt(v), part: Math.round(part * 1000) / 1000, phrase: (fait + ' ' + suite).trim() };
    // Une fois l'or décroché : la part du chemin faite entre l'or et le platine.
    if (niveau >= 3) o.partPlatine = niveau === 4 ? 1 : Math.round(Math.max(0, Math.min(1, (v - s[2]) / (b.platine.s - s[2]))) * 1000) / 1000;
    return o;
  }
  var ANCIENNES = { cent: 'bornes-1', cervin: 'sommets-2', everest: 'sommets-3', semaine: 'metronome-1', metronome: 'metronome-2', routine30: 'routine-2', givre: 'givre-1' };
  // Les thèmes de la vitrine : chaque médaille bonus est rangée dans un thème, trois par thème.
  var THEMES = [
    { id: 'km', nom: 'Kilomètres', ids: ['premier', 'bornes', 'long'] },
    { id: 'deniv', nom: 'Dénivelé', ids: ['sommets', 'grimpeur', 'chamois'] },
    { id: 'regul', nom: 'Régularité', ids: ['metronome', 'fidele', 'routine'] },
    { id: 'temps', nom: 'Par tous les temps', ids: ['givre', 'joursans', 'marmotte'] }
  ];
  function paliersBonus(id, c, gagnees) {
    // Pour la fiche d'une médaille évolutive : chaque palier, son seuil, sa date s'il est décroché, sinon ce qui manque.
    var b = bonus(id); c = contexte(c); var v = b.mesure(c);
    var liste = b.paliers.slice(), noms = NOMS_NIVEAUX.concat(['Platine']);
    if (gagnees && gagnees[id + '-3']) liste.push(b.platine); // le palier secret ne se montre qu'une fois l'or décroché
    return liste.map(function (p, i) {
      var date = (gagnees && gagnees[id + '-' + (i + 1)]) || null;
      return { niveau: RANGS[i], nom: noms[i], seuil: p.icone ? p.t + ' · ' + mil(p.s) + ' m' : (/[a-z]/i.test(p.t) ? p.t : b.fmt(p.s)), date: date, reste: date ? null : b.reste(Math.max(0, p.s - v)) };
    });
  }
  function migrerBonus(anciens) {
    // Les médailles notées avant les paliers gardent leur date ; celles qui n'existent plus sont laissées de côté.
    var valides = {}, o = {};
    clesBonus(true).forEach(function (k) { valides[k] = 1; });
    Object.keys(anciens || {}).forEach(function (k) { var n = valides[k] ? k : ANCIENNES[k]; if (n && valides[n] && !o[n]) o[n] = anciens[k]; });
    return o;
  }

  root.DT = {
    lundiDe: lundiDe, plusMois: plusMois, grilleMois: grilleMois, parJour: parJour, duMois: duMois, totaux: totaux,
    resumeJour: resumeJour, seanceAFaire: seanceAFaire,
    BONUS: BONUS, NIVEAUX: NIVEAUX, bonus: bonus, clesBonus: clesBonus, lireCle: lireCle, bonusGagnes: bonusGagnes, niveauBonus: niveauBonus,
    suiviBonus: suiviBonus, migrerBonus: migrerBonus, THEMES: THEMES, paliersBonus: paliersBonus, RANGS: RANGS, totalBonus: totalBonus,
    BUTS: BUTS, lireBut: lireBut, nomBut: nomBut, etapes: etapes, estBut: estBut, RYTHMES: RYTHMES, lireRythme: lireRythme, RAPIDE: RAPIDE, sequence: sequence,
    dureeParcours: dureeParcours, rapidePermis: rapidePermis, rattraper: rattraper, changerRythme: changerRythme, semainesPleines: semainesPleines, serieMax: serieMax,
    iso: iso, dateDe: dateDe, dateValide: dateValide, plusJours: plusJours, ecartJours: ecartJours, prochainLundi: prochainLundi,
    fx: fx, mil: mil, minTxt: minTxt, nombre: nombre,
    BLOCS: BLOCS, OBJECTIFS: OBJECTIFS, DEPARTS: DEPARTS, objectif: objectif,
    nouvellesMedailles: nouvellesMedailles, disponible: disponible, manquants: manquants,
    nouveauBloc: nouveauBloc, position: position, semaine: semaine, faites: faites, nbFaites: nbFaites,
    refaire: refaire, refairePrecedente: refairePrecedente, decaler: decaler, retirer: retirer, jMoins: jMoins, court: court,
    routineDefaut: routineDefaut, cochesDuJour: cochesDuJour, jourComplet: jourComplet, basculer: basculer, serie: serie,
    mesures: mesures, moyenne7: moyenne7, statsPoids: statsPoids, courbe: courbe
  };
})(typeof window !== 'undefined' ? window : globalThis);
