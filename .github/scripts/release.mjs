import { execFileSync } from 'node:child_process';
import { appendFileSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const stableVersion = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
const git = (...args) => execFileSync('git', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }).trimEnd();
const readJson = path => JSON.parse(readFileSync(path, 'utf8'));

export function releaseTag(before, pkg, lock) {
  const version = pkg.version;
  if (!stableVersion.test(before) || !stableVersion.test(version) ||
      version !== lock.version || version !== lock.packages?.['']?.version) {
    throw new Error('Paket und Lockdatei müssen dieselbe stabile Versionsnummer enthalten.');
  }
  const [major, minor, patch] = before.split('.').map(Number);
  const next = [`${major}.${minor}.${patch + 1}`, `${major}.${minor + 1}.0`, `${major + 1}.0.0`];
  if (!next.includes(version)) throw new Error(`Ungültiger Versionssprung von ${before} auf ${version}.`);
  return `v${version}`;
}

function github(repository) {
  async function request(path, { body, method = body ? 'POST' : 'GET', optional = false } = {}) {
    const response = await fetch(`${process.env.GITHUB_API_URL}/${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${process.env.GH_TOKEN}`,
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json',
      },
      body: body && JSON.stringify(body),
    });
    if (optional && response.status === 404) return null;
    if (!response.ok) throw new Error(`GitHub ${response.status} für ${path}: ${(await response.json()).message}`);
    return response.json();
  }
  const [owner, name] = repository.split('/');
  return {
    rest: (path, options) => request(`repos/${repository}/${path}`, options),
    async graph(fields) {
      const query = `query($owner:String!, $name:String!) { repository(owner:$owner, name:$name) { ${fields} } }`;
      const result = await request('graphql', { body: { query, variables: { owner, name } } });
      if (result.errors?.length) throw new Error(result.errors.map(error => error.message).join('\n'));
      return result.data.repository;
    },
  };
}

// Commit-Betreff und Git-Namen als Text darstellen, auch wenn sie Markdown enthalten.
const html = text => text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
const markdownText = text => html(text).replace(/[\\`*_[\]~|]/g, '\\$&');

async function commitAuthors(oids, api) {
  const names = new Set();
  const pending = oids.map(oid => ({ oid, after: null }));
  while (pending.length) {
    const batch = pending.splice(0, 40);
    const fields = batch.map(({ oid, after }, i) => `c${i}: object(oid: ${JSON.stringify(oid)}) {
      ... on Commit { authors(first: 100, after: ${JSON.stringify(after)}) {
        nodes { name user { login url } } pageInfo { hasNextPage endCursor }
      } }
    }`);
    const data = await api.graph(fields.join('\n'));
    for (const [i, { oid }] of batch.entries()) {
      const { nodes, pageInfo } = data[`c${i}`].authors;
      for (const { name, user } of nodes) {
        if (user) names.add(`[<code>@${html(user.login)}</code>](${user.url})`);
        else if (name) names.add(`<code>${html(name)}</code>`);
      }
      if (pageInfo.hasNextPage) pending.push({ oid, after: pageInfo.endCursor });
    }
  }
  return [...names].sort();
}

export async function releaseNotes({ tag, sha, url, api, runGit = git }) {
  const tags = runGit('tag', '--merged', sha, '--sort=-version:refname', '--list', 'v*').split('\n');
  let previous;
  for (const name of tags.filter(name => name !== tag && stableVersion.test(name.slice(1)))) {
    const { release } = await api.graph(`release(tagName: ${JSON.stringify(name)}) { isDraft isPrerelease }`);
    if (release && !release.isDraft && !release.isPrerelease) {
      previous = name;
      break;
    }
  }
  const range = previous ? `${previous}..${sha}` : sha;
  const history = previous ? `${url}/compare/${previous}...${sha}` : `${url}/commits/${sha}`;
  const link = `[Vollständiger Git-Verlauf](${history})`;
  const commits = runGit('log', '--reverse', '--topo-order', '--format=%H%x09%s', range)
    .split('\n').filter(Boolean).map(line => {
      const [oid, ...subject] = line.split('\t');
      return { oid, subject: subject.join('\t') };
    });
  if (!commits.length) return { notes: `Seit ${previous} sind keine neuen Commits hinzugekommen.\n\n${link}`, link };

  const body = { tag_name: tag, target_commitish: sha };
  if (previous) body.previous_tag_name = previous;
  const generated = await api.rest('releases/generate-notes', { body });
  const prs = generated.body.trim()
    .replace(/^## What's Changed$/m, '## Änderungen aus Pull Requests')
    .replace(/^## New Contributors$/m, '## Erstmals Mitwirkende')
    .replace(/ by (@\S+) in (https:\/\/\S+\/pull\/\d+)$/gm, ' von $1 in $2')
    .replace(/^(\* @\S+) made their first contribution in (https:\/\/\S+\/pull\/\d+)$/gm, '$1 mit dem ersten Beitrag in $2')
    .replace(/^\*\*Full Changelog\*\*:[^\n]*$/m, '').trimEnd();

  const entries = commits.map(({ oid, subject }) =>
    `- [${oid.slice(0, 7)}](${url}/commit/${oid}) <code>${html(subject)}</code>`);
  const highlights = [];
  const sections = [
    ['Neue Funktionen', /^feat(?:\([^)]+\))?!?:\s+/],
    ['Fehlerkorrekturen', /^fix(?:\([^)]+\))?!?:\s+/],
  ];
  for (const [title, prefix] of sections) {
    const changes = commits.filter(({ subject }) => prefix.test(subject)).map(({ oid, subject }) =>
      `- ${markdownText(subject.replace(prefix, ''))} ([${oid.slice(0, 7)}](${url}/commit/${oid}))`);
    if (changes.length) highlights.push(`### ${title}\n\n${changes.join('\n')}`);
  }
  const authors = await commitAuthors(commits.map(commit => commit.oid), api);
  const notes = [
    ...(highlights.length ? ['## Was ist neu?', ...highlights] : []),
    prs, '## Mitwirkende an den Commits', authors.map(name => `- ${name}`).join('\n'),
    `<details><summary>Alle ${entries.length} Commits</summary>`, entries.join('\n'), '</details>', link,
  ].filter(Boolean).join('\n\n');
  return { notes, link };
}

export async function publishRelease({ api, tag, sha, makeNotes, attachNotes }) {
  const ref = await api.rest(`git/ref/tags/${tag}`, { optional: true });
  if (ref) {
    const oid = ref.object.type === 'tag' ? (await api.rest(`commits/${tag}`)).sha : ref.object.sha;
    if (oid !== sha) throw new Error(`${tag} zeigt auf einen anderen Commit.`);
  }
  const { release } = await api.graph(`release(tagName: ${JSON.stringify(tag)}) { databaseId isDraft url }`);
  if (release && !release.isDraft) {
    if (!ref) throw new Error(`Dem veröffentlichten Release ${tag} fehlt der Tag.`);
    return release.url;
  }
  let draft;
  if (release) {
    draft = await api.rest(`releases/${release.databaseId}`);
    if (draft.author.login !== 'github-actions[bot]' || draft.target_commitish !== sha || draft.name !== `Fugenplan ${tag}`) {
      throw new Error(`Vorhandenen Release-Entwurf für ${tag} zuerst auf GitHub prüfen.`);
    }
  }
  const { notes, link } = await makeNotes();
  if (!ref) await api.rest('git/refs', { body: { ref: `refs/tags/${tag}`, sha } });
  const asFile = notes.length > 125_000;
  const description = asFile ? `Die vollständigen Notizen stehen im Anhang Release-Notizen.md. ${link}` : notes;
  const data = { tag_name: tag, target_commitish: sha, name: `Fugenplan ${tag}`, body: description };
  if (!asFile && !draft) {
    return (await api.rest('releases', { body: { ...data, make_latest: 'legacy' } })).html_url;
  }
  // GitHub erlaubt bei unveränderlichen Releases das Hochladen von Anhängen nur vor der Veröffentlichung.
  if (!draft) draft = await api.rest('releases', { body: { ...data, draft: true } });
  if (asFile) await attachNotes(notes);
  return (await api.rest(`releases/${draft.id}`, {
    method: 'PATCH', body: { body: description, draft: false, make_latest: 'legacy' },
  })).html_url;
}

async function run() {
  const mode = process.argv[2];
  if (!['prepare', 'publish'].includes(mode)) throw new Error('Erwartet wird prepare oder publish.');
  const preparing = mode === 'prepare';
  const before = JSON.parse(git('show', preparing ? 'HEAD:package.json' : 'HEAD^1:package.json')).version;
  if (preparing) {
    const { BUMP } = process.env;
    if (!['patch', 'minor', 'major'].includes(BUMP)) throw new Error('Wähle patch, minor oder major.');
    execFileSync('npm', ['version', BUMP, '--no-git-tag-version', '--ignore-scripts'], { stdio: 'inherit' });
  }
  const tag = releaseTag(before, readJson('package.json'), readJson('package-lock.json'));
  const sha = git('rev-parse', 'HEAD');
  const { GITHUB_REPOSITORY: repository, GITHUB_SERVER_URL: server, RUNNER_TEMP: temp } = process.env;
  const api = github(repository);
  const makeNotes = () => releaseNotes({ tag, sha, url: `${server}/${repository}`, api });
  if (preparing) {
    if (git('tag', '--list', tag)) throw new Error(`Der Tag ${tag} existiert bereits.`);
    const { notes, link } = await makeNotes();
    const preview = notes.length <= 60_000 ? notes : `Die vollständige Liste erscheint im Release. ${link}`;
    const pr = [
      '## Anlass und Änderung', `Fugenplan von ${before} auf ${tag.slice(1)} anheben.`,
      '## Prüfungen und Ergebnisse', 'Die Version in package.json und beide Einträge der Lockdatei stimmen überein.',
      '## Auswirkungen und offene Punkte',
      'Dein Merge veröffentlicht das GitHub-Release. Die endgültigen Notizen werden für den zusammengeführten Commit neu erstellt.',
      '---', '## Vorschau der Release-Notizen', preview,
    ].join('\n\n');
    writeFileSync(join(temp, 'fugenplan-release-pr.md'), pr);
    appendFileSync(process.env.GITHUB_OUTPUT, `tag=${tag}\n`);
    return;
  }
  const attachNotes = notes => {
    const file = join(temp, 'Release-Notizen.md');
    writeFileSync(file, notes + '\n');
    execFileSync('gh', ['release', 'upload', tag, file, '--repo', repository, '--clobber'], { stdio: 'inherit' });
  };
  const url = await publishRelease({ api, tag, sha, makeNotes, attachNotes });
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, `[GitHub-Release ${tag}](${url})\n`);
}

if (import.meta.main) await run();
