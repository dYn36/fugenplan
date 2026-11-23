import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const impact = '## Auswirkungen und offene Punkte';
const requirements = [
  { heading: '## Anlass und Änderung', hint: 'Beschreibe den betroffenen Ablauf vor und nach der Änderung.' },
  { heading: '## Prüfungen und Ergebnisse', hint: 'Nenne den Befehl oder die Schritte und das Ergebnis. Begründe ausstehende Prüfungen.' },
  { heading: impact, hint: 'Nenne Folgen und offene Punkte. Falls beides entfällt, genügt „Keine“.' },
  {
    heading: '### Rechenbeispiel',
    paths: ['src/lib/geometry.ts', 'src/lib/calibration.ts'],
    hint: 'Nenne Eingaben mit Einheit, Sollwert und tatsächliches Ergebnis. Begründe, falls die Änderung keinen Rechenweg betrifft.',
  },
  {
    heading: '### Bestandsdaten',
    paths: ['src/lib/library-file.ts', 'src/lib/workspace-file.ts', 'src/lib/pdf-storage.ts'],
    hint: 'Beschreibe den geprüften älteren Projektstand und das Ergebnis. Begründe, falls Bestandsdaten unberührt bleiben.',
  },
];

export function missingDetails(body, changedPaths) {
  const answered = new Set();
  const headings = [];
  let fence = '';
  let commentOpen = false;
  for (let line of body.split(/\r?\n/)) {
    if (!fence) {
      if (commentOpen) line = '<!--' + line;
      line = line.replace(/<!--.*?(-->|$)/g, (_, end) => {
        commentOpen = end !== '-->';
        return '';
      });
    }
    const marker = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(line);
    if (marker && !fence) {
      fence = marker[1];
      continue;
    }
    if (fence && marker && marker[1].startsWith(fence) && !marker[2].trim()) {
      fence = '';
      continue;
    }

    const heading = !fence && /^ {0,3}(#{1,6})[ \t]+(.+?)\s*$/.exec(line);
    if (heading) {
      const depth = heading[1].length;
      headings.length = depth;
      headings[depth - 1] = (heading[1] + ' ' + heading[2].replace(/[ \t]+#+$/, '').trim()).toLowerCase();
      continue;
    }

    const answer = line.trim().replace(/^(?:[-+*]|\d+[.)])(?:\s+|$)(?:\[[ xX]\]\s*)?/, '').trim();
    if (!/[\p{L}\p{N}]/u.test(answer) || /^(?:todo|tbd)[.!]?$/i.test(answer)) continue;
    for (const section of headings) {
      if (section && (section === impact.toLowerCase() || !/^(?:keine|n\/a)[.!]?$/i.test(answer))) {
        answered.add(section);
      }
    }
  }

  return requirements
    .filter(({ paths }) => !paths || paths.some(path => changedPaths.includes(path)))
    .filter(({ heading }) => !answered.has(heading.toLowerCase()))
    .map(({ heading, hint }) => `Ergänze „${heading}“. ${hint}`);
}

if (import.meta.main) {
  const { pull_request } = JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8'));
  // Der erste Elternstand des GitHub-Merge-Commits ist der Zielbranch vor dem PR.
  const paths = execFileSync('git', [
    'diff', '--no-renames', '--name-only', '-z', 'HEAD^1', 'HEAD', '--', 'src/lib/',
  ], { encoding: 'utf8' });
  const missing = missingDetails(pull_request.body ?? '', paths.split('\0'));
  for (const message of missing) console.error(`::error title=PR-Beschreibung ergänzen::${message}`);
  if (missing.length) process.exitCode = 1;
  else console.log('Alle für diesen Pull Request benötigten Abschnitte sind ausgefüllt.');
}
