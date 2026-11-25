import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { initializeLocal, localRPC } from '../lib/server/local.mjs';
import { buildAIInput, generateDraft } from '../lib/server/ai.mjs';
import { blankApplication, offsetDate, today, stages } from '../lib/domain.mjs';

let db;
before(async () => {
  db = await initializeLocal(new PGlite());
});
after(async () => {
  await db.close();
});
async function member() {
  const id = randomUUID();
  await db.query('insert into auth.users(id,email) values($1,$2)', [id, id + '@example.test']);
  return id;
}
const call = (id, name, args = {}) => localRPC(db, id, 'ct_' + name, args);
const record = () => ({
  ...blankApplication(),
  position: 'Design Intern',
  employer: 'Example Studio',
  deadline: offsetDate(1),
  requirements: 'Figma and user interviews',
});
test('opportunity, application and reminder changes are owned and atomic', async () => {
  const owner = await member(),
    other = await member();
  const data = record(),
    id = await call(owner, 'application', { data });
  assert.equal((await call(other, 'workspace')).applications.length, 0);
  await assert.rejects(call(other, 'application', { data: { ...data, id } }));
  await assert.rejects(call(other, 'remove_application', { target: id }));
  await assert.rejects(
    call(other, 'feedback', {
      data: {
        application_id: id,
        kind: 'skills',
        output_text: 'Example',
        input_hash: 'a',
        edited: false,
      },
    }),
  );
  await assert.rejects(
    call(owner, 'application', {
      data: { ...data, id, employer: 'Invalid edit', status: 'invalid' },
    }),
  );
  assert.equal((await call(owner, 'workspace')).applications[0].employer, data.employer);
  await call(owner, 'application', { data: { ...data, id, status: 'Interview' } });
  await call(owner, 'reminder', { target: id, due: data.deadline, acknowledge: false });
  await call(owner, 'reminder', { target: id, due: data.deadline, acknowledge: true });
  await call(owner, 'reminder', { target: id, due: data.deadline, acknowledge: false });
  const ws = await call(owner, 'workspace');
  assert.equal(ws.reminders.length, 1);
  assert.ok(ws.reminders[0].acknowledged_at);
  assert.equal(ws.applications[0].status, 'Interview');
  await call(owner, 'remove_application', { target: id });
  assert.equal((await call(owner, 'workspace')).reminders.length, 0);
  assert.equal(
    (await db.query('select * from public.job_opportunities where owner_id=$1', [owner])).rows
      .length,
    0,
  );
});
test('row policies isolate direct reads and protected writes are disallowed', async () => {
  const owner = await member(),
    other = await member();
  await call(owner, 'application', { data: record() });
  await db.transaction(async (tx) => {
    await tx.exec('set local role authenticated');
    await tx.query("select set_config('request.jwt.claim.sub',$1,true)", [other]);
    assert.equal((await tx.query('select * from public.applications')).rows.length, 0);
    assert.equal((await tx.query('select id from public.profiles')).rows[0].id, other);
  });
  await assert.rejects(
    db.transaction(async (tx) => {
      await tx.exec('set local role authenticated');
      await tx.query("select set_config('request.jwt.claim.sub',$1,true)", [other]);
      await tx.exec('update public.profiles set is_admin=true');
    }),
  );
  await assert.rejects(
    db.transaction(async (tx) => {
      await tx.exec('set local role anon');
      await tx.exec('select public.ct_workspace()');
    }),
  );
});
test('admins see aggregates, log maintenance and can suspend and restore access', async () => {
  const admin = await member(),
    student = await member();
  await assert.rejects(call(student, 'admin', { action: 'overview', data: {} }));
  await db.query('update public.profiles set is_admin=true where id=$1', [admin]);
  const reason = 'Pilot moderation test';
  const email = student + '@example.test';
  const result = await call(admin, 'admin', { action: 'suspend', data: { email, reason } });
  assert.equal(result.suspended, 1);
  assert.equal(result.profile, undefined);
  await assert.rejects(call(student, 'workspace'));
  await call(admin, 'admin', { action: 'restore', data: { email, reason } });
  assert.equal((await call(student, 'workspace')).profile.id, student);
  await call(admin, 'admin', { action: 'stages', data: { stages: stages.toReversed() } });
  assert.deepEqual((await call(student, 'workspace')).stages, stages.toReversed());
});
test('profile, résumé and reviewed feedback persist, report, edit and cascade on account removal', async () => {
  const owner = await member(),
    other = await member();
  await call(owner, 'profile', {
    data: {
      full_name: 'A. Test',
      program: 'IT',
      contact: '',
      graduation_year: '2027',
      is_admin: true,
    },
  });
  await call(owner, 'resume', {
    data: { summary: 'Student developer', skills: 'Git, SQL', experience: 'Database coursework' },
  });
  const id = await call(owner, 'feedback', {
    data: {
      kind: 'resume',
      output_text: 'Clarify the project description.',
      input_hash: 'abcd',
      edited: false,
    },
  });
  await call(owner, 'manage_feedback', { target: id, action: 'edit', value: 'Edited draft.' });
  await call(owner, 'manage_feedback', {
    target: id,
    action: 'report',
    value: 'Inaccurate information',
  });
  await assert.rejects(call(other, 'manage_feedback', { target: id, action: 'delete', value: '' }));
  const ws = await call(owner, 'workspace');
  assert.equal(ws.profile.is_admin, false);
  assert.equal(ws.resume.skills, 'Git, SQL');
  assert.equal(ws.feedback[0].edited, true);
  assert.equal(ws.feedback[0].report_reason, 'Inaccurate information');
  await call(owner, 'delete_account');
  for (const table of ['applications', 'resume_profiles', 'ai_feedback']) {
    assert.equal(
      (await db.query('select 1 from public.' + table + ' where owner_id=$1', [owner])).rows.length,
      0,
    );
  }
  await assert.rejects(call(owner, 'workspace'));
});
test('AI reservations enforce cooldown, per-user cap and project-wide monthly cap', async () => {
  const u = await member();
  await call(u, 'reserve_ai');
  await assert.rejects(call(u, 'reserve_ai'), { code: 'P0415' });
  await db.query(
    "insert into careertrack_private.ai_usage(owner_id,requested_at) select $1,now()-interval '1 hour' from generate_series(1,9)",
    [u],
  );
  await db.query(
    "update careertrack_private.ai_usage set requested_at=now()-interval '1 hour' where owner_id=$1",
    [u],
  );
  await assert.rejects(call(u, 'reserve_ai'), { code: 'P0415' });
  await db.exec(
    'insert into careertrack_private.ai_usage(owner_id) select null from generate_series(1,2000)',
  );
  await assert.rejects(call(await member(), 'reserve_ai'), { code: 'P0415' });
});
test('AI inputs minimize fields, redact identifiers, calculate progress and reject foreign targets', async () => {
  const user = { email: 'student@example.test' };
  const ws = {
    profile: { full_name: 'Alex Rivera', contact: '09123456789' },
    resume: {
      skills: 'UI, Figma',
      summary: 'Alex Rivera student@example.test 09123456789',
      experience: 'Student project',
    },
    applications: [{ ...record(), id: 'mine', notes: 'Private note', deadline: today() }],
    feedback: [],
  };
  const input = buildAIInput('skills', ws, user, 'mine');
  assert.doesNotMatch(JSON.stringify(input), /Alex|@|09123456789|Private note/);
  assert.equal(input.job_requirements, record().requirements);
  const progress = buildAIInput('progress', ws, user, null);
  assert.equal(progress.counts.Saved, 1);
  assert.equal(progress.upcoming_deadlines.length, 1);
  assert.equal(progress.skills, undefined);
  assert.throws(() => buildAIInput('resume', ws, user, 'foreign'));
  const savedKey = process.env.OPENAI_API_KEY;
  const savedGroqKey = process.env.GROQ_API_KEY;
  delete process.env.OPENAI_API_KEY;
  delete process.env.GROQ_API_KEY;
  try {
    await assert.rejects(generateDraft(user, { kind: 'resume' }, ws), { status: 503 });
  } finally {
    if (savedKey !== undefined) process.env.OPENAI_API_KEY = savedKey;
    if (savedGroqKey !== undefined) process.env.GROQ_API_KEY = savedGroqKey;
  }
});
