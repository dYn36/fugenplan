# PDF-Speicherung nach Neuladen und Browser-Neustart

Prüfdatum: 28. Oktober 2026.

## Anlass und gesicherter Befund

Im untersuchten Edge-Profil fehlte die Original-PDF der ersten Etage tatsächlich in IndexedDB. Der Verweis auf diese PDF, ihre sechs Räume und der Maßstab waren weiterhin in den Projektdaten vorhanden. Die neue PDF der zweiten Etage war gespeichert und ihre SHA-256-Prüfsumme stimmte mit der gespeicherten Kennung überein. Der Fehler war daher durch die fehlenden Original-Bytes erklärbar.

Der Grund für den früheren Verlust ist nicht belegt. Der verbliebene Speicherstand enthält kein Löschprotokoll. Der Anwendungscode enthält keine Funktion zum Löschen von PDF-Datensätzen. Die Übernahme des älteren Speicherformats erhält die PDF-Kennung und verwendet dieselbe IndexedDB-Datenbank. Beide gezielten Edge-Neustarttests bestanden bereits vor der zusätzlichen Absicherung.

Der Browser meldete den Speicher vor und nach der Wiederherstellung als nicht dauerhaft geschützt (`persisted() === false`). Edge kann ungeschützte Websitedaten bei Speicherknappheit entfernen. Eine Freigabe für dauerhaften Speicher hängt vom Browser ab. Das belegt keinen solchen Löschvorgang in diesem konkreten Fall. Quellen: [Microsoft: Store data on the device](https://learn.microsoft.com/en-us/microsoft-edge/progressive-web-apps/how-to/offline#data-eviction), [MDN: StorageManager.persist](https://developer.mozilla.org/en-US/docs/Web/API/StorageManager/persist).

## Wiederherstellung des betroffenen Stands

Die identische Originaldatei wurde im ursprünglichen Projektordner gefunden. Ihre SHA-256-Prüfsumme entsprach der bereits gespeicherten Dokumentkennung. Die gleichnamige Datei im Downloads-Ordner hatte eine andere Prüfsumme und wurde nicht verwendet.

Die Wiederherstellung erfolgte über die normale Dateiauswahl der Anwendung. Danach waren beide PDFs mit gültiger Prüfsumme gespeichert. Der kanonische Vergleich aller Projektinhalte vor und nach der Wiederherstellung war identisch; reine Auswahlzustände wurden dabei ausgenommen. Räume, Maße und PDF-Zuordnungen blieben erhalten. Die Original-PDF wurde anschließend nach einem Neuladen tatsächlich dargestellt. Eine vollständige Projektdatei mit beiden PDFs und allen sechs Räumen wurde zusätzlich exportiert und geprüft.

Private PDFs, Projektdaten, Speicherberichte und der Screenshot des echten Grundrisses bleiben außerhalb von Git. Sie liegen nur lokal in der Projektsicherung bzw. im ignorierten Testausgabeordner.

## Zusätzliche Absicherung

Die Änderungen in [pdf-storage.ts](../src/lib/pdf-storage.ts) härten künftige Schreibvorgänge ab:

- Beim Import wird `navigator.storage.persist()` angefordert, sofern der Speicher noch nicht geschützt ist. Fehlende APIs, Ablehnung und Fehler verhindern eine normale lokale Speicherung nicht.
- PDF-Schreibtransaktionen verwenden `durability: 'strict'`. Der Aufrufer wartet weiterhin auf den Abschluss der Transaktion.
- Die gespeicherten Bytes werden anschließend erneut gelesen und vollständig mit dem Original verglichen. Eine Abweichung verhindert die Übernahme des neuen Grundrisses in die Projektdaten.
- Der PDF-Editor zeigt bei fehlenden Bytes „Original-PDF nicht geladen“. Zuvor stand dort auch ohne verfügbare Datei „PDF auf diesem Gerät“.

Die historische Ursache bleibt offen. Die zusätzlichen Schreibprüfungen ersetzen keine externe Projektsicherung und verhindern kein bewusstes Löschen von Browserdaten. Die Bedeutung von `durability: 'strict'` beschreibt [MDN: IDBDatabase.transaction](https://developer.mozilla.org/en-US/docs/Web/API/IDBDatabase/transaction#strict).

## Browserfälle

[pdf-storage.e2e.spec.ts](../tests/pdf-storage.e2e.spec.ts) enthält drei Fälle:

1. Zwei unterschiedliche PDFs in zwei Etagen laden, Maßstäbe und Räume erfassen, den Browserprozess schließen, mit demselben Profil neu starten, beide PDFs zeichnen, erneut laden und beide Originaldateien exportieren.
2. Eine tatsächlich importierte PDF samt Raum und Maßstab im alten Metadatenformat Version 2 hinterlegen. Die PDF-Bytes bleiben in IndexedDB. Den Browser beenden, das alte Projekt übernehmen, eine zweite Etage mit eigener PDF ergänzen und nochmals mit demselben Profil neu starten. Räume, Maßstäbe und beide Originaldateien vergleichen.
3. Eine abweichende Speicherung nach einer nominell erfolgreichen Schreibtransaktion simulieren. Der neue Grundriss muss abgelehnt werden; die vorherige Etage bleibt erhalten. Nach Entfernen des simulierten Fehlers durch Neuladen muss ein erneuter Import gelingen.

Die Neustartfälle verwenden eigene temporäre Profilordner. `launchPersistentContext()` startet einen Browserprozess; das Schließen dieses Kontexts beendet den Browser. Danach wird ein neuer Prozess mit demselben Ordner gestartet. Die Tests kopieren keinen `storageState` und verändern keine Nutzerprofile. Die Übernahme aus Version 2 und der simulierte Schreibfehler sind ausdrücklich erzeugte Testbedingungen. Referenz: [Playwright: launchPersistentContext](https://playwright.dev/docs/api/class-browsertype#browser-type-launch-persistent-context).

[pdf-storage.test.ts](../tests/pdf-storage.test.ts) prüft zusätzlich die Anforderung von Speicherschutz, eine bestehende Freigabe, Ablehnung, fehlende APIs und Fehler der Berechtigungsprüfung.

## Wiederholen

Ergebnisse gegen den Produktionsbuild:

| Prüfung | Ergebnis |
| --- | --- |
| Microsoft Edge 156.0.4314.42 | 3 von 3 Speicherfällen bestanden. |
| Chromium 156.0.8078.4 | 3 von 3 Speicherfällen als Teil des Gesamtlaufs bestanden. |
| WebKit 27.2 | 3 von 3 Speicherfällen als Teil des Gesamtlaufs bestanden. |
| Vollständige Browsersammlung | 144 von 144 Prüfungen bestanden; keine Wiederholungen, übersprungenen oder instabilen Fälle. |
| Fachtests | 230 von 230 Tests in 8 Dateien bestanden. |
| TypeScript und Produktionsbuild | Erfolgreich. |

Lokale Berichte: [Microsoft Edge](../test-results/pdf-storage-edge/report/index.html), [vollständiger Gesamtlauf](../test-results/pdf-storage-all/report/index.html). Die GitHub-Prüfung bewahrt ihren Bericht unter dem Artefaktnamen `pdf-speicher-pruefung` auf.

Nach `npm run build` und dem Start eines separaten Vorschau-Servers auf Port 52501:

```sh
PLAYWRIGHT_BASE_URL=http://127.0.0.1:52501 \
PLAYWRIGHT_RESULTS_DIR=test-results/pdf-storage-edge \
npm run test:e2e:edge -- tests/pdf-storage.e2e.spec.ts

PLAYWRIGHT_BASE_URL=http://127.0.0.1:52501 \
PLAYWRIGHT_RESULTS_DIR=test-results/pdf-storage-all \
npm run test:e2e:all
```

Der Edge-Lauf benötigt ein installiertes Microsoft Edge. Die Repository-Prüfung führt die drei Speicherfälle in Chromium und WebKit gegen den Produktionsbuild aus. Die lokale vollständige Browsersammlung und ihre Grenzen stehen in der [Gesamtprüfung](E2E-GESAMTPRUEFUNG.md).
