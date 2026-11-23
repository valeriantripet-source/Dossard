# Réassemble l'appli : ../index.html à partir des fichiers de ce dossier.
# Usage : python3 sources/construire.py
import os

ici = os.path.dirname(os.path.abspath(__file__))


def lire(nom):
    with open(os.path.join(ici, nom), encoding='utf-8') as f:
        return f.read()


page = lire('gabarit.html')
for repere, fichier in (('/*STYLE*/', 'style.css'), ('/*LOGIQUE*/', 'logique.js'),
                        ('/*ICONES*/', 'icones.js'), ('/*INTERFACE*/', 'interface.js')):
    contenu = lire(fichier)
    assert '</script' not in contenu.lower() and '</style' not in contenu.lower(), fichier
    assert page.count(repere) == 1, repere
    page = page.replace(repere, contenu.rstrip('\n'))

sortie = os.path.normpath(os.path.join(ici, '..', 'index.html'))
with open(sortie, 'w', encoding='utf-8') as f:
    f.write(page)
print('index.html', len(page.encode('utf-8')), 'octets')
