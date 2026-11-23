/* Le Dossard : icônes des médailles bonus. Dessins au trait sur une grille de 24, couleur héritée du disque. */
(function (root) {
  'use strict';
  var P = ' fill="currentColor" stroke="none"';
  root.DT_ICONES = {
    // Une chaussure de course
    premier: '<path d="M3 17.5v-6l3.4 1.3c.9.3 1.9-.1 2.3-.9l1-2.1 4.3 3.6c.9.8 2 1.3 3.2 1.5l2 .4c1.1.2 1.8 1.1 1.8 2.2"></path>' +
      '<path d="M3 17.5h18v1.2a1.8 1.8 0 0 1-1.8 1.8H4.8A1.8 1.8 0 0 1 3 18.7z"></path><path d="M11.3 12.3l1.3-1.5M13.7 14.1l1.2-1.4"></path>',
    // Un métronome
    metronome: '<path d="M9.2 3.5h5.6l3.7 17h-13z"></path><path d="M6.4 16.3h11.2M12 16.3l4.3-9.7"></path><circle cx="14.7" cy="10.2" r="1.7"' + P + '></circle>',
    // Le soleil qui se lève
    routine: '<path d="M2.5 17.5h19M7.5 21h9"></path><path d="M6.8 17.5a5.2 5.2 0 0 1 10.4 0"></path><path d="M12 6.3v2.7M5 10l1.9 1.9M19 10l-1.9 1.9"></path>',
    // Une route qui file vers l'horizon
    bornes: '<path d="M8.6 3.5L3.8 20.5M15.4 3.5l4.8 17"></path><path d="M12 4v2.6M12 10.2v3.2M12 17v3.5"></path>',
    // La Dôle : la crête du Jura et la boule blanche du sommet
    dole: '<path d="M2.5 20l4.4-3.7 3.5-1.1 4.3-4.8h3.3l1.2 3.9 2.8 5.7z"' + P.replace(' stroke="none"', '') + '></path><circle cx="16.3" cy="7.3" r="2.6"></circle>',
    // Le Cervin : sa pointe penchée et son épaule
    cervin: '<path d="M2.5 20l3.9-4.5 2.4-5.5 1.8-6.4 2.1 1.7 1 4 2.2 1.2 1.7 3.7 3.9 5.8z"></path>' +
      '<path d="M10.6 3.6l2.1 1.7 1 4 2.2 1.2 1.7 3.7 3.9 5.8h-8.3l-1.7-6.600.9-3.8z"' + P + '></path>',
    // L'Everest : un massif et son drapeau au sommet
    everest: '<path d="M2.5 20l6.8-10.3 3.2 4.6 2.3-3.1 6.7 8.8z"></path><path d="M9.3 9.7V3.4"></path><path d="M9.3 3.4l4.2 1.6-4.2 1.7z"' + P + '></path>' +
      '<path d="M6.5 14l1.7 1.3 1.1-1.6 1.5 1.5 1.4-1.7"></path>',
    // Olympus Mons : un volcan-bouclier très large, son cratère, et une lune de Mars au-dessus
    olympus: '<path d="M2.5 19.5c3.2-.8 5.6-5.4 7.3-8.5h4.4c1.7 3.1 4.1 7.7 7.3 8.5z"></path><path d="M9.8 11c.9 1.1 3.5 1.1 4.4 0"></path><circle cx="18.6" cy="5.4" r="1.9"></circle>',
    // Un nuage et sa pluie
    joursans: '<path d="M7.2 15.5a4.2 4.2 0 0 1-.3-8.4 5.6 5.6 0 0 1 10.8 1.2 3.6 3.6 0 0 1-.5 7.2z"></path><path d="M8.6 18.3l-.9 2.6M12.5 18.3l-.9 2.6M16.4 18.3l-.9 2.6"></path>',
    // Une montagne et la flèche qui monte
    grimpeur: '<path d="M2.8 20.5L10.5 9l4 5.5 2.3-3 4.4 9z"></path><path d="M17.5 3.5v4.8M15.3 5.6l2.2-2.2 2.2 2.2"></path>',
    // Un calendrier coché
    fidele: '<rect x="4" y="5.5" width="16" height="14.5" rx="2"></rect><path d="M4 10h16M8.2 3.6v3.6M15.8 3.6v3.6"></path><path d="M8.9 15.1l2.2 2.1 4-4.3"></path>',
    // Un itinéraire qui serpente jusqu'au drapeau
    long: '<circle cx="5.5" cy="18.5" r="2"></circle><path d="M7.5 18.5H15a3 3 0 0 0 0-6H9a3 3 0 0 1 0-6h5"></path><path d="M17.5 3.3v6.4"></path><path d="M17.5 3.3l3.8 1.5-3.8 1.6z"' + P + '></path>',
    // Un flocon
    givre: [0, 60, 120, 180, 240, 300].map(function (a) { return '<path transform="rotate(' + a + ' 12 12)" d="M12 12V2.6M9.7 5.1L12 7.4l2.3-2.3"></path>'; }).join(''),
    // Une tête de chamois, cornes en crochet
    chamois: '<path d="M10.3 9.6V5.3a2 2 0 0 0-3.5-1.3M13.7 9.6V5.3a2 2 0 0 1 3.5-1.3"></path>' +
      '<path d="M7.9 11.3c0-1 .8-1.7 1.8-1.7h4.6c1 0 1.800.7 1.8 1.7 0 2.9-.9 5.4-1.9 7.2-.5 1-1.3 1.5-2.2 1.5s-1.7-.5-2.2-1.5c-1-1.8-1.9-4.3-1.9-7.2z"></path>' +
      '<path d="M7.9 11.7L4.3 10.4c-.1 1.7 1 3.1 2.9 3.5M16.1 11.7l3.6-1.3c.1 1.7-1 3.1-2.9 3.5"></path>' +
      '<circle cx="10.3" cy="13.3" r=".9"' + P + '></circle><circle cx="13.7" cy="13.3" r=".9"' + P + '></circle><path d="M11 17.8h2l-1 1.2z"' + P + '></path>',
    // Une marmotte debout, qui s'assoupit
    marmotte: '<path d="M15.2 10.8c1.500.1 2.9-.5 3-1.800.1-1.2-1-2-2.3-2.3-.7-1.3-1.9-2.1-3.3-2.1-2.6 0-4.5 1.9-5 4.6-1.4 1.7-2.2 3.9-2.2 6.3 0 1.900.6 3.7 1.5 5h10.4c.9-1.2 1.4-2.7 1.3-4.3-.1-1.5-.7-2.8-1.6-3.8-.7-.5-1.3-1-1.8-1.6z"></path>' +
      '<circle cx="9.7" cy="5.2" r="1.4"' + P + '></circle><circle cx="13.9" cy="7.5" r=".85"' + P + '></circle><circle cx="17.7" cy="8.3" r=".8"' + P + '></circle>' +
      '<path d="M14.3 13.2l2.2 2M6.7 19.1l-3 1.3M18.8 2.4h2.7l-2.7 3h2.7"></path>'
  };
})(typeof window !== 'undefined' ? window : globalThis);
