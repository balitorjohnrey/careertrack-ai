import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Bell,
  BriefcaseBusiness,
  CalendarDays,
  Check,
  ChevronRight,
  FileText,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings2,
  ShieldCheck,
  Sparkles,
  X,
} from 'lucide-react';
import { today, displayDate, upcoming, daysLeft } from '../lib/domain.mjs';
import { backendMode, getSession, rpc } from '../lib/server/backend.mjs';
import { api, Brand } from '../components/common';
import Public from '../components/Public';
import { Applications, ApplicationEditor, DeadlinePage, Overview } from '../components/Tracker';
import Feedback from '../components/Feedback';
import { Admin, Profile, Resume } from '../components/Settings';

const nav = [
  ['dashboard', 'Overview', LayoutDashboard],
  ['applications', 'Applications', BriefcaseBusiness],
  ['deadlines', 'Deadlines', CalendarDays],
  ['resume', 'Résumé & skills', FileText],
  ['feedback', 'AI feedback studio', Sparkles],
];
const more = [
  ['profile', 'Profile settings', Settings2],
  ['admin', 'Administration', ShieldCheck],
];
export async function getServerSideProps({ req, res, params, query }) {
  res.setHeader('Cache-Control', 'private, no-store, max-age=0');
  const [page = 'home', id = null, ...rest] = params.path || [];
  if (
    rest.length ||
    (id && page !== 'applications') ||
    !['home', 'login', 'register', ...nav.map((n) => n[0]), ...more.map((n) => n[0])].includes(page)
  )
    return { notFound: true };
  const mode = backendMode();
  const publicPage = ['home', 'login', 'register'].includes(page);
  try {
    const session = await getSession(req, res);
    if (publicPage)
      return session
        ? { redirect: { destination: '/dashboard', permanent: false } }
        : { props: { page, mode } };
    if (!session) return { redirect: { destination: '/login', permanent: false } };
    const initial = await rpc(session, 'ct_workspace');
    if (page === 'admin' && !initial.profile.is_admin) return { notFound: true };
    return {
      props: {
        page,
        id,
        mode,
        initial,
        user: { email: session.demo ? '' : session.email, demo: !!session.demo },
        day: today(),
        applicationId: typeof query.application === 'string' ? query.application : null,
      },
    };
  } catch (e) {
    res.statusCode = e.status || 503;
    return {
      props: {
        page: 'unavailable',
        message:
          e.status === 403
            ? 'Access to this account is suspended. Contact your project administrator.'
            : 'The workspace connection is unavailable. Check the server configuration and try again.',
      },
    };
  }
}
function Workspace({ page, id, initial, user, applicationId, day }) {
  const router = useRouter(),
    [ws, setWs] = useState(initial),
    [menu, setMenu] = useState(false),
    [toast, setToast] = useState('');
  const timer = useRef(null);
  useEffect(() => {
    setWs(initial);
    setMenu(false);
  }, [initial]);
  useEffect(() => () => clearTimeout(timer.current), []);
  const reload = useCallback(async () => setWs(await api('workspace')), []);
  const notify = (message) => {
    clearTimeout(timer.current);
    setToast(message);
    timer.current = setTimeout(() => setToast(''), 4500);
  };
  const logout = async () => {
    try {
      await api('auth/logout');
      window.location.assign('/');
    } catch (e) {
      notify(e.message);
    }
  };
  const name = ws.profile.full_name || 'Student',
    abbr = name
      .split(/\s+/)
      .map((s) => s[0])
      .slice(0, 2)
      .join('');
  const label = [...nav, ...more].find((n) => n[0] === page)?.[1];
  const reminderCount = upcoming(ws.applications, day).filter((a) => {
    const days = daysLeft(a.deadline, day);
    return (
      days <= 7 &&
      !ws.reminders.some(
        (r) =>
          r.application_id === a.id &&
          r.deadline === a.deadline &&
          r.window_days === (days <= 1 ? 1 : 7) &&
          r.acknowledged_at,
      )
    );
  }).length;
  function links(rows) {
    return rows.map(([p, title, Icon]) => (
      <Link
        key={p}
        href={'/' + p}
        className={'nav-item' + (page === p ? ' active' : '')}
        aria-current={page === p ? 'page' : undefined}
        onClick={() => setMenu(false)}
      >
        <Icon size={18} />
        {title}
        {p === 'deadlines' && reminderCount > 0 && (
          <span className="nav-count">{reminderCount}</span>
        )}
      </Link>
    ));
  }
  const shared = { ws, user, day, reload, notify, go: (path) => router.push(path) };
  return (
    <div className="workspace">
      {menu && (
        <button className="scrim" aria-label="Close navigation" onClick={() => setMenu(false)} />
      )}
      <aside className={'sidebar ' + (menu ? 'opened' : '')}>
        <div className="side-top">
          <Brand href="/dashboard" />
          <button
            className="mobile-only icon-button"
            aria-label="Close navigation"
            onClick={() => setMenu(false)}
          >
            <X />
          </button>
        </div>
        <div className="nav-group">
          <p>WORKSPACE</p>
          <nav>{links(nav)}</nav>
        </div>
        <div className="nav-group">
          <p>ACCOUNT</p>
          <nav>{links(more.filter((n) => n[0] !== 'admin' || ws.profile.is_admin))}</nav>
        </div>
        <div className="side-bottom">
          <Link href="/profile" className="user-chip">
            <b>{abbr}</b>
            <span>
              <strong>{name}</strong>
              <small>{user.demo ? 'Demo workspace' : 'Personal workspace'}</small>
            </span>
          </Link>
          <button title="Sign out" aria-label="Sign out" onClick={logout}>
            <LogOut size={17} />
          </button>
        </div>
      </aside>
      <main className="main-work">
        <header className="topbar">
          <div>
            <button
              className="mobile-only icon-button"
              aria-label="Open navigation"
              onClick={() => setMenu(true)}
            >
              <Menu size={21} />
            </button>
            <span>Workspace</span>
            <ChevronRight size={14} />
            <strong>{label}</strong>
          </div>
          <div>
            <span className="today-date">
              {displayDate(day, {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })}
            </span>
            <Link
              href="/deadlines"
              className="bell-link"
              aria-label={'Deadline reminders, ' + reminderCount + ' pending'}
            >
              <Bell size={18} />
              {reminderCount > 0 && <i />}
            </Link>
          </div>
        </header>
        <div className="content" key={page + '/' + (id || '')}>
          {page === 'dashboard' ? (
            <Overview {...shared} />
          ) : page === 'applications' ? (
            id ? (
              <ApplicationEditor {...shared} id={id} />
            ) : (
              <Applications ws={ws} />
            )
          ) : page === 'deadlines' ? (
            <DeadlinePage {...shared} />
          ) : page === 'resume' ? (
            <Resume {...shared} />
          ) : page === 'profile' ? (
            <Profile {...shared} />
          ) : page === 'admin' ? (
            <Admin {...shared} />
          ) : (
            <Feedback {...shared} applicationId={applicationId} />
          )}
        </div>
        {toast && (
          <div role="status" className="toast">
            <Check size={16} />
            {toast}
          </div>
        )}
      </main>
    </div>
  );
}
export default function Page(props) {
  const { page, mode } = props;
  useEffect(() => {
    if (window.location.hash.includes('access_token='))
      window.history.replaceState(null, '', window.location.pathname);
  }, []);
  return (
    <>
      <Head>
        <title>
          {[...nav, ...more].find((n) => n[0] === page)?.[1] || 'Student application tracker'} ·
          CareerTrack AI
        </title>
        <meta
          name="description"
          content="A private workspace for student job applications, deadlines and human-reviewed résumé feedback."
        />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.svg" />
      </Head>
      {page === 'unavailable' ? (
        <main className="status-screen">
          <Brand />
          <h1>Workspace unavailable</h1>
          <p>{props.message}</p>
          <button
            className="button dark"
            onClick={async () => {
              await api('auth/logout');
              window.location.assign('/');
            }}
          >
            Sign out
          </button>
        </main>
      ) : ['home', 'login', 'register'].includes(page) ? (
        <Public key={page} page={page} mode={mode} />
      ) : (
        <Workspace {...props} />
      )}
    </>
  );
}
