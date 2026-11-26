import { test } from 'node:test';
import assert from 'node:assert/strict';
import { authenticate, getSession, rpc } from '../lib/server/backend.mjs';
import { generateDraft } from '../lib/server/ai.mjs';
import { today } from '../lib/domain.mjs';

test('hosted sign-in distinguishes confirmation, credentials and site settings, and resends without a password', async (t) => {
  const previous = [process.env.SUPABASE_URL, process.env.SUPABASE_PUBLISHABLE_KEY];
  process.env.SUPABASE_URL = 'https://project.example.test';
  process.env.SUPABASE_PUBLISHABLE_KEY = 'test-publishable';
  t.after(() => {
    for (const [i, name] of ['SUPABASE_URL', 'SUPABASE_PUBLISHABLE_KEY'].entries()) {
      if (previous[i] === undefined) delete process.env[name];
      else process.env[name] = previous[i];
    }
  });
  const data = { email: 'student@example.test', password: 'unit-test-password' };
  const res = { setHeader: () => assert.fail('No session should be issued') };
  let status = 400;
  let body = { code: 400, error_code: 'email_not_confirmed' };
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(options.headers['X-Supabase-Api-Version'], '2024-01-01');
    if (new URL(url).pathname.endsWith('/resend')) {
      assert.deepEqual(JSON.parse(options.body), { type: 'signup', email: data.email });
    }
    return Response.json(body, { status });
  });
  assert.deepEqual(await authenticate('login', data, {}, res), { confirmEmail: true });
  body = { code: 'email_not_confirmed' };
  assert.deepEqual(await authenticate('login', data, {}, res), { confirmEmail: true });
  body = { code: 400, error_code: 'invalid_credentials' };
  await assert.rejects(authenticate('login', data, {}, res), { status: 401, message: /did not match/ });
  status = 401;
  body = { message: 'Invalid API key' };
  await assert.rejects(authenticate('login', data, {}, res), { status: 503, message: /publishable key/ });
  status = 422;
  body = { error_code: 'email_address_not_authorized' };
  await assert.rejects(authenticate('register', data, {}, res), { status: 503, message: /email delivery/ });
  await assert.rejects(authenticate('resend', data, {}, res), { status: 503, message: /email delivery/ });
  status = 429;
  await assert.rejects(authenticate('resend', data, {}, res), { status: 429 });
  status = 200;
  body = {};
  assert.deepEqual(await authenticate('resend', data, {}, res), { ok: true });
  await assert.rejects(authenticate('login', data, {}, res), /missing session/);
});

test('hosted adapters use scoped sessions and generate, reuse and fail drafts without mutating records', async (t) => {
  const previous = Object.fromEntries(
    ['SUPABASE_URL', 'SUPABASE_PUBLISHABLE_KEY', 'OPENAI_API_KEY', 'GROQ_API_KEY', 'GROQ_MODEL'].map((k) => [k, process.env[k]]),
  );
  Object.assign(process.env, {
    SUPABASE_URL: 'https://project.example.test',
    SUPABASE_PUBLISHABLE_KEY: 'test-publishable',
    OPENAI_API_KEY: 'test-placeholder',
  });
  delete process.env.GROQ_API_KEY;
  delete process.env.GROQ_MODEL;
  t.after(() => {
    for (const [k, v] of Object.entries(previous))
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    delete globalThis.ctAIBackoff;
  });
  const user = { id: 'student-id', email: 'student@example.test' },
    session = {
      user,
      access_token: 'access-for-test',
      refresh_token: 'refresh-for-test',
      expires_in: 3600,
    };
  const ws = {
    profile: { full_name: 'Student Test', contact: '' },
    resume: { summary: 'Developed a class project.', skills: 'SQL', experience: 'Database design' },
    applications: [
      {
        id: 'owned',
        position: 'Developer',
        status: 'Applied',
        deadline: today(),
        requirements: 'SQL',
      },
    ],
    feedback: [],
  };
  let cookies,
    aiCalls = 0,
    reservations = 0,
    failures = 0,
    limited = false,
    confirm = false;
  const res = {
    setHeader: (name, value) => {
      if (name === 'Set-Cookie') cookies = value;
    },
  };
  t.mock.method(globalThis, 'fetch', async (url, opts) => {
    const path = new URL(url).pathname;
    if (path.endsWith('/chat/completions')) {
      aiCalls++;
      const payload = JSON.parse(opts.body);
      if (process.env.GROQ_API_KEY) {
        assert.equal(url, 'https://api.groq.com/openai/v1/chat/completions');
        assert.equal(opts.headers.Authorization, 'Bearer groq-test-placeholder');
        assert.equal(payload.model, 'openai/gpt-oss-20b');
        assert.equal(payload.reasoning_effort, 'low');
        assert.equal(payload.store, undefined);
      } else {
        assert.equal(url, 'https://api.openai.com/v1/chat/completions');
        assert.equal(opts.headers.Authorization, 'Bearer test-placeholder');
        assert.equal(payload.store, false);
      }
      assert.ok(payload.messages[0].content.includes('Never invent'));
      assert.doesNotMatch(payload.messages[1].content, /@example|student-id/);
      return Response.json(
        limited
          ? {}
          : { choices: [{ message: { content: 'Consider describing your class project.' } }] },
        { status: limited ? 429 : 200 },
      );
    }
    assert.equal(opts.headers.apikey, 'test-publishable');
    if (path === '/auth/v1/signup') return Response.json(confirm ? { user } : session);
    if (path === '/auth/v1/token') return Response.json(session);
    assert.equal(opts.headers.Authorization, 'Bearer access-for-test');
    if (path === '/auth/v1/user') return Response.json(user);
    if (path === '/rest/v1/rpc/ct_workspace') return Response.json(ws);
    if (path === '/rest/v1/rpc/ct_reserve_ai') {
      reservations++;
      return Response.json('reservation');
    }
    if (path === '/rest/v1/rpc/ct_ai_failure') {
      failures++;
      return new Response(null, { status: 204 });
    }
    throw new Error('Unexpected provider operation ' + path);
  });
  const credentials = {
    email: user.email,
    password: 'example-placeholder',
    full_name: 'Student Test',
  };
  confirm = true;
  assert.deepEqual(await authenticate('register', credentials, {}, res), { confirmEmail: true });
  confirm = false;
  await authenticate('login', credentials, {}, res);
  assert.ok(cookies.every((c) => c.includes('HttpOnly')));
  const signed = await getSession({ cookies: { ct_refresh: session.refresh_token } }, res);
  assert.equal(signed.id, user.id);
  assert.equal(
    (await getSession({ cookies: { ct_access: session.access_token } }, res)).id,
    user.id,
  );
  assert.deepEqual(await rpc(signed, 'ct_workspace'), ws);
  for (const kind of ['skills', 'resume', 'progress']) {
    const request = { kind, application_id: kind === 'progress' ? null : 'owned' };
    const draft = await generateDraft(signed, request, ws);
    assert.equal(draft.kind, kind);
    assert.equal(draft.cached, false);
    assert.equal(ws.feedback.length, 0);
    const reviewed = { ...ws, feedback: [draft] };
    assert.equal((await generateDraft(signed, request, reviewed)).cached, true);
  }
  assert.equal(aiCalls, 3);
  assert.equal(reservations, 3);
  process.env.GROQ_API_KEY = 'groq-test-placeholder';
  await assert.rejects(generateDraft(signed, { kind: 'resume', provider: 'OpenAI' }, ws), { status: 409 });
  for (const kind of ['skills', 'resume', 'progress']) {
    const draft = await generateDraft(signed, { kind, provider: 'Groq', application_id: kind === 'skills' ? 'owned' : null }, ws);
    assert.equal(draft.cached, false);
    assert.equal(draft.kind, kind);
  }
  assert.equal(reservations, 6);
  limited = true;
  await assert.rejects(generateDraft(signed, { kind: 'progress' }, ws), { status: 503 });
  await assert.rejects(generateDraft(signed, { kind: 'progress' }, ws), { status: 503 });
  assert.equal(failures, 1);
  assert.equal(aiCalls, 7);
});
