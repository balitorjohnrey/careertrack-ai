import { PGlite } from '@electric-sql/pglite';
import { mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import {
  randomBytes,
  randomUUID,
  createHash,
  scrypt as derive,
  timingSafeEqual,
} from 'node:crypto';
import { promisify } from 'node:util';
import { AppError, blankApplication, offsetDate } from '../domain.mjs';

const scrypt = promisify(derive);
const digest = (value) => createHash('sha256').update(value).digest('hex');
export async function initializeLocal(db) {
  if ((await db.query("select to_regclass('public.profiles') as existing")).rows[0].existing)
    return db;
  await db.exec(`
    create role authenticated;
    create role anon;
    create schema auth;
    create table auth.users(id uuid primary key, email text unique not null, raw_user_meta_data jsonb not null default '{}', salt text, password_hash text);
    create table auth.sessions(token text primary key, user_id uuid not null references auth.users on delete cascade, expires timestamptz not null);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema auth to authenticated, anon;
  `);
  await db.exec(
    await readFile(path.join(process.cwd(), 'supabase/migrations/001_careertrack.sql'), 'utf8'),
  );
  return db;
}
export async function localDB() {
  if (!globalThis.careertrackDB) {
    globalThis.careertrackDB = (async () => {
      const directory = path.resolve('.local', 'postgres');
      await mkdir(directory, { recursive: true });
      return initializeLocal(new PGlite(directory));
    })().catch((error) => {
      delete globalThis.careertrackDB;
      throw error;
    });
  }
  return globalThis.careertrackDB;
}
export async function localRPC(db, userID, name, args = {}) {
  // Both the procedure and named argument identifiers originate in the server dispatcher.
  if (!/^ct_[a-z_]+$/.test(name) || !Object.keys(args).every((k) => /^[a-z_]+$/.test(k)))
    throw new Error('Invalid procedure');
  return db.transaction(async (tx) => {
    await tx.exec('set local role authenticated');
    await tx.query("select set_config('request.jwt.claim.sub',$1,true)", [userID]);
    const params = Object.keys(args)
      .map((k, i) => `"${k}" => $${i + 1}`)
      .join(',');
    const { rows } = await tx.query(
      `select public.${name}(${params}) as result`,
      Object.values(args).map((v) => (v && typeof v === 'object' ? JSON.stringify(v) : v)),
    );
    return rows[0].result;
  });
}
async function issueSession(db, id) {
  const token = randomBytes(32).toString('hex');
  await db.query("insert into auth.sessions values($1,$2,now()+interval '7 days')", [
    digest(token),
    id,
  ]);
  return token;
}
export async function localAuth(action, { email, password, full_name }) {
  const db = await localDB();
  let id;
  if (action === 'login') {
    const row = (await db.query('select * from auth.users where email=$1', [email])).rows[0];
    const actual = await scrypt(password, row?.salt || 'unused-account-salt', 64);
    if (!row?.password_hash || !timingSafeEqual(actual, Buffer.from(row.password_hash, 'hex')))
      throw new AppError(401, 'Check your email and password.');
    id = row.id;
  } else {
    id = randomUUID();
    const demo = action === 'demo';
    const salt = randomBytes(16).toString('hex');
    const hash = demo ? null : (await scrypt(password, salt, 64)).toString('hex');
    try {
      await db.query('insert into auth.users values($1,$2,$3,$4,$5)', [
        id,
        demo ? `demo-${id}@example.invalid` : email,
        JSON.stringify({ full_name: demo ? 'Alex Rivera' : full_name, demo }),
        salt,
        hash,
      ]);
    } catch (error) {
      if (error.code === '23505')
        throw new AppError(409, 'An account already uses that email. Try signing in.');
      throw error;
    }
    if (demo) await seedDemo(db, id);
  }
  if (
    action !== 'demo' &&
    process.env.CAREERTRACK_LOCAL_ADMIN_EMAIL?.trim().toLowerCase() === email
  ) {
    await db.query('update public.profiles set is_admin=true where id=$1', [id]);
  }
  return issueSession(db, id);
}
export async function localSession(token) {
  if (!token) return null;
  const db = await localDB();
  return (
    (
      await db.query(
        "select u.id,u.email,coalesce((u.raw_user_meta_data->>'demo')::boolean,false) demo from auth.users u join auth.sessions s on s.user_id=u.id where s.token=$1 and expires>now()",
        [digest(token)],
      )
    ).rows[0] || null
  );
}
export async function localLogout(token) {
  if (token)
    await (await localDB()).query('delete from auth.sessions where token=$1', [digest(token)]);
}
async function seedDemo(db, id) {
  const rows = [
    [
      'Sora Studio',
      'Product Design Intern',
      'Interview',
      2,
      'Hybrid · Davao City',
      'Figma, prototyping, and user research',
    ],
    [
      'Northline Labs',
      'Frontend Developer Intern',
      'Applied',
      5,
      'Remote',
      'HTML, CSS, React, and Git',
    ],
    [
      'Fieldwork',
      'Research Assistant',
      'Saved',
      7,
      'Panabo City',
      'Interviewing, data analysis, and reporting',
    ],
    [
      'Orbit Systems',
      'Software Engineering Intern',
      'Assessment',
      12,
      'Remote',
      'JavaScript, SQL, and REST APIs',
    ],
    [
      'Common Ground',
      'Design Operations Intern',
      'Offer',
      null,
      'Davao City',
      'Documentation and project coordination',
    ],
  ];
  for (const [employer, position, status, days, location, requirements] of rows.reverse()) {
    await localRPC(db, id, 'ct_application', {
      data: {
        ...blankApplication(),
        employer,
        position,
        status,
        location,
        requirements,
        deadline: days === null ? '' : offsetDate(days),
        date_saved: offsetDate(-10),
        date_applied: status === 'Saved' ? '' : offsetDate(-5),
      },
    });
  }
  await localRPC(db, id, 'ct_resume', {
    data: {
      skills: 'Figma, HTML, CSS, Git, SQL',
      summary: 'Information technology student interested in accessible digital products.',
      experience:
        'Prototyped a campus event directory for a class project and interviewed five classmates.',
    },
  });
  await localRPC(db, id, 'ct_profile', {
    data: {
      full_name: 'Alex Rivera',
      program: 'Information Technology',
      graduation_year: '2027',
      contact: '',
    },
  });
}
