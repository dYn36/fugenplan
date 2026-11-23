import { expect, test, vi } from 'vitest';
import { publishRelease, releaseNotes, releaseTag } from '../.github/scripts/release.mjs';

const sha = 'a'.repeat(40);
const other = 'b'.repeat(40);
const url = 'https://github.com/example/project';
const tag = 'v1.0.1';
const releaseUrl = `${url}/releases/tag/${tag}`;
const lock = (version: string) => ({ version, packages: { '': { version } } });

test.each(['1.2.4', '1.3.0', '2.0.0'])('Paket und Lockdatei ergeben den Tag v%s', version => {
  expect(releaseTag('1.2.3', { version }, lock(version))).toBe('v' + version);
});

test('gleiche, kleinere oder abweichende Versionen ergeben keinen Release-Tag', () => {
  for (const version of ['1.2.3', '1.2.2', '1.2.5', '1.3.0-beta.1']) {
    expect(() => releaseTag('1.2.3', { version }, lock(version))).toThrow();
  }
  expect(() => releaseTag('1.2.3', { version: '1.2.4' }, lock('1.2.3'))).toThrow();
  expect(() => releaseTag('1.2.3', { version: '1.2.4' }, { ...lock('1.2.3'), version: '1.2.4' })).toThrow();
});

const authors = (name: string, login?: string, next?: string) => ({
  authors: {
    nodes: [{ name, user: login ? { login, url: 'https://github.com/' + login } : null }],
    pageInfo: { hasNextPage: Boolean(next), endCursor: next || null },
  },
});

test.each([false, true])('Release-Notizen mit vorigem Tag %s verwenden genau den zugehörigen Verlauf', async previous => {
  const tags = previous ? ['v2.0.0', tag, 'v1.0.1-beta.1', 'v1.0.0'].join('\n') : '';
  const runGit = vi.fn().mockReturnValueOnce(tags).mockReturnValueOnce(`${other}\tfeat(plan): Direkter Commit <Plan>\n${sha}\tMerge PR #3`);
  const api = {
    rest: vi.fn().mockResolvedValue({ body: `## What's Changed\n* Plan neu by @team in ${url}/pull/3` }),
    graph: vi.fn(async (fields: string) => {
      if (fields.includes('release(tagName: "v2.0.0")')) return { release: null };
      if (fields.includes('release(tagName: "v1.0.0")')) return { release: { isDraft: false, isPrerelease: false } };
      if (fields.includes('seite2')) return { c0: authors('Gast') };
      return { c0: authors('Alias', 'team', 'seite2'), c1: authors('Team', 'team') };
    }),
  };
  const { notes, link } = await releaseNotes({ tag, sha, url, api, runGit });
  const payload = api.rest.mock.calls[0][1].body;
  expect(payload).toEqual({ tag_name: tag, target_commitish: sha, ...(previous ? { previous_tag_name: 'v1.0.0' } : {}) });
  expect(runGit.mock.calls[0]).toEqual(['tag', '--merged', sha, '--sort=-version:refname', '--list', 'v*']);
  expect(runGit.mock.calls[1].at(-1)).toBe(previous ? `v1.0.0..${sha}` : sha);
  expect(link).toContain(previous ? `/compare/v1.0.0...${sha}` : `/commits/${sha}`);
  expect(notes).toContain(`${url}/pull/3`);
  expect(notes).toContain(`${url}/commit/${other}`);
  expect(notes).toContain('### Neue Funktionen\n\n- Direkter Commit &lt;Plan&gt;');
  expect(notes).toContain('Plan neu von @team in ');
  expect(notes).toContain('[<code>@team</code>](https://github.com/team)');
  expect(notes.match(/<code>@team<\/code>/g)).toHaveLength(1);
  expect(api.graph.mock.calls.some(([query]) => query.includes('seite2'))).toBe(true);
  expect(notes).toContain('<code>Gast</code>');
});

const ref = { object: { type: 'commit', sha } };
const makeNotes = () => Promise.resolve({ notes: 'Änderungen', link: url });

test('nach einem Abbruch am vorhandenen Tag fortsetzen und ein veröffentlichtes Release erhalten', async () => {
  const rest = vi.fn()
    .mockResolvedValueOnce(null).mockResolvedValueOnce({}).mockRejectedValueOnce(Error('Unterbrechung'))
    .mockResolvedValueOnce(ref).mockResolvedValueOnce({ html_url: releaseUrl })
    .mockResolvedValueOnce(ref);
  const graph = vi.fn().mockResolvedValueOnce({ release: null }).mockResolvedValueOnce({ release: null })
    .mockResolvedValueOnce({ release: { isDraft: false, url: releaseUrl } });
  const args = { api: { rest, graph }, tag, sha, makeNotes: vi.fn(makeNotes) };
  await expect(publishRelease(args)).rejects.toThrow('Unterbrechung');
  await expect(publishRelease(args)).resolves.toBe(releaseUrl);
  await expect(publishRelease(args)).resolves.toBe(releaseUrl);
  expect(rest.mock.calls.filter(([path]) => path === 'git/refs')).toEqual([
    ['git/refs', { body: { ref: 'refs/tags/v1.0.1', sha } }],
  ]);
  expect(rest.mock.calls[4][1].body).toMatchObject({ target_commitish: sha, tag_name: tag, body: 'Änderungen' });
  expect(args.makeNotes).toHaveBeenCalledTimes(2);
});

test('ein Tag auf einem anderen Commit und ein manueller Entwurf bleiben geschützt', async () => {
  const rest = vi.fn().mockResolvedValueOnce({ object: { type: 'tag', sha: 'c'.repeat(40) } }).mockResolvedValueOnce({ sha: other });
  const graph = vi.fn().mockResolvedValue({ release: { isDraft: true, databaseId: 42 } });
  await expect(publishRelease({ api: { rest, graph }, tag, sha, makeNotes })).rejects.toThrow('anderen Commit');
  expect(graph).not.toHaveBeenCalled();
  rest.mockResolvedValueOnce(ref).mockResolvedValueOnce({ author: { login: 'inhaber' }, target_commitish: sha });
  await expect(publishRelease({ api: { rest, graph }, tag, sha, makeNotes })).rejects.toThrow('Entwurf');
  expect(rest.mock.calls.every(([, options]) => !options?.body)).toBe(true);
});

test('übergroße Notizen werden vor der Veröffentlichung vollständig an den eigenen Entwurf angehängt', async () => {
  const notes = 'a'.repeat(125_001);
  const rest = vi.fn().mockResolvedValueOnce(ref).mockResolvedValueOnce({
    author: { login: 'github-actions[bot]' }, target_commitish: sha, name: 'Fugenplan v1.0.1', id: 17,
  }).mockResolvedValueOnce({ html_url: releaseUrl });
  const graph = vi.fn().mockResolvedValue({ release: { isDraft: true, databaseId: 17 } });
  const attachNotes = vi.fn().mockResolvedValue(undefined);
  await publishRelease({ api: { rest, graph }, sha, tag, makeNotes: () => ({ notes, link: url }), attachNotes });
  expect(attachNotes).toHaveBeenCalledWith(notes);
  expect(rest.mock.calls[2][0]).toBe('releases/17');
  expect(rest.mock.calls[2][1]).toMatchObject({ method: 'PATCH', body: { draft: false, body: expect.stringContaining('Release-Notizen.md') } });
  expect(attachNotes.mock.invocationCallOrder[0]).toBeLessThan(rest.mock.invocationCallOrder[2]);
});
