# Drittanbieter

Fugenplan verwendet diese Bibliotheken im Browser. Die Versionen sind in `package-lock.json` festgelegt.

| Bestandteil | Lizenz | Verwendung |
| --- | --- | --- |
| React, React DOM, Scheduler | MIT | Oberfläche |
| Phosphor Icons | MIT | Symbole |
| Manrope | SIL Open Font License 1.1 | Lokal geladene Schrift |
| PDF.js | Apache 2.0 | PDF-Verarbeitung, Schriften und Decoder |
| Clipper | Boost Software License 1.0 | Konturversatz |
| JSBN, enthalten in Clipper | Lizenz von Tom Wu | Ganzzahlarithmetik |
| polygon-clipping, splaytree | MIT | Schnittflächen |
| robust-predicates | Unlicense | Geometrische Prädikate |

Vite erzeugt bei jedem Build `dist/third-party-licenses.txt` mit den Lizenztexten der gebündelten Pakete. Ergänzende Texte liegen in [public/licenses](public/licenses), weil einige Pakete Lizenztexte nur in ihrer Dokumentation oder in eingebettetem Code mitliefern. Beide Ausgaben gehören zum veröffentlichten Build.

Die PDF.js-Zusatzdateien enthalten außerdem ihre mitgelieferten Lizenzhinweise unter `pdfjs/<Version>/`. Die Anwendung verändert die Bibliotheken und die Schriftdateien nicht.

Diese Hinweise betreffen die genannten Drittanbieter. Für den eigenen Anwendungscode ist noch keine Open-Source-Lizenz festgelegt.
