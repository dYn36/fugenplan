import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { missingDetails } from '../.github/scripts/pr-beschreibung.mjs';

const template = readFileSync(new URL('../.github/pull_request_template.md', import.meta.url), 'utf8');
const docs = template
  .replace('## Anlass und Änderung', '## Anlass und Änderung\nDer Link zur Anleitung führt jetzt zum PDF-Import.')
  .replace('## Prüfungen und Ergebnisse', '## Prüfungen und Ergebnisse\nLink geöffnet. Er führt zum Abschnitt „PDF importieren“.')
  .replace('## Auswirkungen und offene Punkte', '## Auswirkungen und offene Punkte\nKeine.');

test('für eine reine Textänderung genügt die kurz ausgefüllte Vorlage', () => {
  expect(missingDetails(docs, ['README.md'])).toEqual([]);
  expect(missingDetails(template, ['README.md'])).toHaveLength(3);
});

test.each([
  ['src/lib/geometry.ts', 'Rechenbeispiel'],
  ['src/lib/calibration.ts', 'Rechenbeispiel'],
  ['src/lib/library-file.ts', 'Bestandsdaten'],
  ['src/lib/workspace-file.ts', 'Bestandsdaten'],
  ['src/lib/pdf-storage.ts', 'Bestandsdaten'],
])('eine Änderung an %s fordert gezielt den Zusatz %s', (path, heading) => {
  expect(missingDetails(docs, [path])).toEqual([expect.stringContaining('### ' + heading)]);
});

test('ein Nachweis je betroffenem Bereich kann zugleich den Hauptabschnitt beantworten', () => {
  const body = [
    '## Anlass und Änderung', 'Neue Maßeinheit beim Import.',
    '## Prüfungen und Ergebnisse', '### Rechenbeispiel',
    '5 × 600 mm + 4 × 3 mm ergeben 3.012 mm. Der Plan zeigt 3.012 mm.',
    '## Auswirkungen und offene Punkte', '### Bestandsdaten',
    'Älteres Testprojekt geöffnet. Alle Raummaße und die hinterlegte PDF sind erhalten.',
  ].join('\r\n');
  expect(missingDetails(body, ['src/lib/calibration.ts', 'src/lib/library-file.ts'])).toEqual([]);
});

test('Überschriften in Code, leere Listen und Platzhalter erfüllen keine Pflichtangabe', () => {
  const body = [
    '## Anlass und Änderung', '<!-- Entwurf -->', '- [x]', 'TODO',
    '## Prüfungen und Ergebnisse', '~~~md', '### Rechenbeispiel', '<!--', '~~~',
    '## Auswirkungen und offene Punkte', 'Keine.',
  ].join('\n');
  expect(missingDetails(body, ['src/lib/geometry.ts'])).toEqual([
    expect.stringContaining('## Anlass und Änderung'), expect.stringContaining('### Rechenbeispiel'),
  ]);
});
