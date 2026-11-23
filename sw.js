// Le Dossard : fonctionnement hors connexion.
// La page est demandée au réseau d'abord (la dernière version en ligne gagne toujours) ;
// sans réseau, ou si le réseau met plus de 3 secondes, la copie gardée sur l'appareil prend le relais.
// Les polices et les icônes, qui ne changent pas, sont servies depuis la copie locale.
var CACHE = 'le-dossard-1';
var DELAI = 3000;
var FICHIERS = [
  './',
  'index.html',
  'manifest.webmanifest',
  'polices/barlow-400.woff2',
  'polices/barlow-500.woff2',
  'polices/barlow-600.woff2',
  'polices/barlow-condensed-600.woff2',
  'polices/barlow-condensed-700.woff2',
  'polices/barlow-condensed-800.woff2',
  'icones/favicon.svg',
  'icones/favicon-48.png',
  'icones/icone-192.png',
  'icones/icone-512.png',
  'icones/icone-masquable-512.png',
  'icones/apple-touch-icon.png'
];

self.addEventListener('install', function (ev) {
  ev.waitUntil(caches.open(CACHE).then(function (c) {
    return c.addAll(FICHIERS.map(function (u) { return new Request(u, { cache: 'reload' }); }));
  }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (ev) {
  ev.waitUntil(caches.keys().then(function (noms) {
    return Promise.all(noms.filter(function (n) { return n !== CACHE; }).map(function (n) { return caches.delete(n); }));
  }).then(function () { return self.clients.claim(); }));
});

function sansRecherche(adresse) { var u = new URL(adresse); u.search = ''; u.hash = ''; return u.href; }

function garder(adresse, reponse) {
  return caches.open(CACHE).then(function (c) { return c.put(sansRecherche(adresse), reponse); }).catch(function () {});
}

function copieLocale(requete, page) {
  return caches.match(requete, { ignoreSearch: true }).then(function (r) {
    return r || (page ? caches.match('./') : undefined);
  });
}

function copieDAbord(ev) {
  var requete = ev.request;
  ev.respondWith(copieLocale(requete, false).then(function (r) {
    if (r) return r;
    return fetch(requete).then(function (reponse) {
      if (reponse && reponse.ok) ev.waitUntil(garder(requete.url, reponse.clone()));
      return reponse;
    });
  }));
}

function reseauDAbord(ev) {
  var requete = ev.request, page = requete.mode === 'navigate';
  var locale = copieLocale(requete, page);
  var reseau = page ? fetch(requete.url, { cache: 'no-cache' }) : fetch(requete);
  ev.waitUntil(reseau.then(function (reponse) {
    if (reponse && reponse.ok && !reponse.redirected) return garder(requete.url, reponse.clone());
  }).catch(function () {}));
  ev.respondWith(new Promise(function (resoudre) {
    var rendu = false;
    function rendre(r) { if (!rendu && r) { rendu = true; resoudre(r); } }
    var attente = setTimeout(function () { locale.then(rendre); }, DELAI);
    reseau.then(function (reponse) {
      clearTimeout(attente);
      if (reponse && reponse.ok && !reponse.redirected) { rendre(reponse.clone()); return; }
      locale.then(function (r) { rendre(r || reponse); });
    }, function () {
      clearTimeout(attente);
      locale.then(function (r) { rendre(r || Response.error()); });
    });
  }));
}

self.addEventListener('fetch', function (ev) {
  var requete = ev.request;
  if (requete.method !== 'GET') return;
  var u = new URL(requete.url);
  if (u.origin !== self.location.origin) return;
  if (/\/(polices|icones)\//.test(u.pathname)) copieDAbord(ev);
  else reseauDAbord(ev);
});
