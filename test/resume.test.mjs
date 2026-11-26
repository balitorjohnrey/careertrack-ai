import assert from 'node:assert/strict';
import { test } from 'node:test';
import { generateResume } from '../lib/server/ai.mjs';
import { papers, readResumeDraft, resumeInput, resumeParagraphs } from '../lib/resume.mjs';

test('résumé generation minimizes provider data, enforces the user quota and validates the complete draft', async (t) => {
  const env = {
    GROQ_API_KEY: 'test-placeholder',
    SUPABASE_URL: 'https://db.example.test',
    SUPABASE_PUBLISHABLE_KEY: 'test-publishable',
  };
  const before = Object.fromEntries(Object.keys(env).map((key) => [key, process.env[key]]));
  Object.assign(process.env, env);
  t.after(() => {
    for (const [key, value] of Object.entries(before)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });
  const user = { email: 'jules@example.test', token: 'scoped' };
  const workspace = { profile: { full_name: 'Jules Demo', contact: '09123456789' } };
  const details = {
    name: 'Jules Demo',
    email: user.email,
    portfolio: 'https://private.example.test',
    role: 'Design intern',
    skills: 'Figma',
    projects: 'Class project by Jules Demo, jules@example.test',
  };
  const valid = {
    summary: 'Design student with project experience.',
    skills: 'Figma',
    projects: 'Completed a class project.',
  };
  let reply = valid;
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (url, opts) => {
    const path = new URL(url).pathname;
    calls.push(path);
    if (path === '/rest/v1/rpc/ct_reserve_ai') return Response.json('ticket');
    if (path === '/rest/v1/rpc/ct_ai_failure') return new Response(null, { status: 204 });
    assert.equal(path, '/openai/v1/chat/completions');
    const payload = JSON.parse(opts.body);
    assert.deepEqual(payload.response_format, { type: 'json_object' });
    assert.deepEqual(Object.keys(JSON.parse(payload.messages[1].content)).sort(), [
      'projects',
      'role',
      'skills',
    ]);
    assert.doesNotMatch(
      payload.messages[1].content,
      /Jules Demo|@example|private\.example|09123456789/,
    );
    return Response.json({
      choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(reply) } }],
    });
  });
  await assert.rejects(generateResume(user, { details: { role: 'Intern' } }, workspace), {
    status: 400,
  });
  await assert.rejects(generateResume(user, { details, provider: 'OpenAI' }, workspace), {
    status: 409,
  });
  assert.equal(calls.length, 0);
  assert.deepEqual(await generateResume(user, { details, provider: 'Groq' }, workspace), {
    sections: valid,
  });
  assert.deepEqual(calls, ['/rest/v1/rpc/ct_reserve_ai', '/openai/v1/chat/completions']);
  reply = { summary: 'Only part of the document.' };
  await assert.rejects(generateResume(user, { details, provider: 'Groq' }, workspace), {
    status: 503,
  });
  assert.equal(calls.at(-1), '/rest/v1/rpc/ct_ai_failure');
});

test('exports use the reviewed header and sections in order and support A4 and short bond', () => {
  const header = {
    name: 'Jules Demo',
    role: 'Intern',
    email: '',
    phone: '',
    city: 'Panabo City',
    portfolio: '',
  };
  const sections = readResumeDraft(
    JSON.stringify({
      summary: 'Student designer.',
      skills: 'Figma\nSQL',
      certifications: 'Unrequested addition',
    }),
    resumeInput({ skills: 'Figma, SQL' }),
  );
  assert.deepEqual(
    resumeParagraphs(header, sections).map((p) => p.text),
    [
      'Jules Demo',
      'Intern',
      'Panabo City',
      'Professional summary',
      'Student designer.',
      'Skills',
      'Figma',
      'SQL',
    ],
  );
  assert.equal(papers.short.width, 8.5 * 1440);
  assert.equal(papers.short.height, 11 * 1440);
  assert.equal(papers.a4.width, Math.round((210 * 1440) / 25.4));
  assert.equal(papers.a4.height, Math.round((297 * 1440) / 25.4));
});
