import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  ArrowUpRight,
  Bell,
  BriefcaseBusiness,
  CalendarDays,
  Check,
  ChevronRight,
  Clock3,
  Flag,
  Layers3,
  MapPin,
  Plus,
  Search,
  SlidersHorizontal,
  Sparkles,
} from 'lucide-react';
import { api, Empty, ErrorBox, Field, Mark, Pill, SectionHead, useAction } from './common';
import { blankApplication, counts, daysLeft, displayDate, upcoming } from '../lib/domain.mjs';

export const addLink = (
  <Link href="/applications/new" className="button dark">
    <Plus size={17} /> Add application
  </Link>
);
function CardHeading({ icon: Icon, title, href, label }) {
  return (
    <div className="card-heading">
      <h2>
        {Icon && <Icon size={19} />} {title}
      </h2>
      {href && (
        <Link className="text-link" href={href}>
          {label || 'View all'} <ChevronRight size={15} />
        </Link>
      )}
    </div>
  );
}
function JobRows({ items }) {
  return items.length ? (
    <div className="job-rows">
      {items.map((a) => (
        <Link key={a.id} href={'/applications/' + a.id} className="job-row">
          <Mark name={a.employer} />
          <div className="job-name">
            <strong>{a.position}</strong>
            <span>{a.employer}</span>
          </div>
          <Pill status={a.status} />
          <span className="row-date">{displayDate(a.deadline)}</span>
          <ChevronRight size={16} />
        </Link>
      ))}
    </div>
  ) : (
    <Empty title="Your tracker is ready">Add your first application to see it here.</Empty>
  );
}
function DeadlineRows({ items, day }) {
  return items.length ? (
    <div>
      {items.map((a) => (
        <Link key={a.id} className="due-row" href={'/applications/' + a.id}>
          <div className="date-tile">
            <span>{displayDate(a.deadline, { month: 'short' })}</span>
            <b>{Number(a.deadline.slice(-2))}</b>
          </div>
          <div>
            <strong>{a.position}</strong>
            <span>
              {a.employer} ·{' '}
              {daysLeft(a.deadline, day) === 0
                ? 'Today'
                : daysLeft(a.deadline, day) === 1
                  ? 'Tomorrow'
                  : daysLeft(a.deadline, day) + ' days'}
            </span>
          </div>
        </Link>
      ))}
    </div>
  ) : (
    <Empty title="No upcoming deadlines">Add a deadline to an open application.</Empty>
  );
}
function Reminders({ ws, reload, day }) {
  const { busy, error, run } = useAction();
  const pending = upcoming(ws.applications, day)
    .filter((a) => daysLeft(a.deadline, day) <= 7)
    .map((a) => {
      const window = daysLeft(a.deadline, day) <= 1 ? 1 : 7;
      const log = ws.reminders.find(
        (r) => r.application_id === a.id && r.deadline === a.deadline && r.window_days === window,
      );
      return { ...a, log };
    })
    .filter((a) => !a.log?.acknowledged_at);
  const key = JSON.stringify(
    pending
      .filter((a) => !a.log)
      .slice(0, 100)
      .map((a) => ({ id: a.id, deadline: a.deadline })),
  );
  useEffect(() => {
    const items = JSON.parse(key);
    if (!items.length) return;
    api('reminders', { items })
      .then(reload)
      .catch(() => {});
  }, [key]); // Only a reminder actually displayed in this panel counts as shown.
  if (!pending.length) return null;
  return (
    <section className="card reminder-card">
      <CardHeading title="In-system reminders" icon={Bell} />
      <p className="card-note">
        Shown within 7 days of a deadline, with a final reminder at 1 day.
      </p>
      {pending.map((a) => (
        <div className="reminder-row" key={a.id}>
          <div>
            <strong>{a.position}</strong>
            <span>
              {a.employer} · Due {displayDate(a.deadline)}
            </span>
          </div>
          <button
            disabled={busy}
            className="button small light"
            onClick={() =>
              run(async () => {
                await api('reminders', {
                  items: [{ id: a.id, deadline: a.deadline }],
                  acknowledge: true,
                });
                await reload();
              })
            }
          >
            <Check size={15} /> Acknowledge
          </button>
        </div>
      ))}
      <ErrorBox message={error} />
    </section>
  );
}
export function Overview({ ws, day, reload }) {
  const stats = counts(ws.applications),
    due = upcoming(ws.applications, day);
  const panels = [
    [BriefcaseBusiness, 'Applications', ws.applications.length, 'All tracked roles'],
    [
      Layers3,
      'In progress',
      stats.Applied + stats.Assessment + stats.Interview,
      'Applied through interview',
    ],
    [
      Clock3,
      'Due this week',
      due.filter((a) => daysLeft(a.deadline, day) <= 7).length,
      'Next 7 days',
    ],
    [Flag, 'Offers', stats.Offer, 'Offer stage'],
  ];
  return (
    <>
      <SectionHead
        eyebrow="YOUR WORKSPACE"
        title="Application overview"
        description={
          'Welcome back, ' +
          (ws.profile.full_name.split(' ')[0] || 'there') +
          '. Here’s where your search stands.'
        }
      >
        {addLink}
      </SectionHead>
      <div className="metrics">
        {panels.map(([Icon, title, value, note], i) => (
          <article className={'metric metric-' + i} key={title}>
            <div>
              <span>{title}</span>
              <Icon size={18} />
            </div>
            <strong>{value}</strong>
            <small>{note}</small>
          </article>
        ))}
      </div>
      <div className="overview-grid">
        <div className="stack">
          <section className="card">
            <CardHeading title="Recent applications" href="/applications" />
            <JobRows items={ws.applications.slice(0, 5)} />
          </section>
          <section className="card pipeline">
            <CardHeading title="Application stages" />
            <div className="stage-bar">
              {ws.stages
                .filter((s) => stats[s] > 0)
                .map((s) => (
                  <i
                    className={'bar-' + s.toLowerCase()}
                    key={s}
                    style={{ flex: stats[s] }}
                    title={s + ' ' + stats[s]}
                  />
                ))}
            </div>
            <div className="stage-legend">
              {ws.stages.map((s) => (
                <span key={s}>
                  <i className={'bar-' + s.toLowerCase()} />
                  {s} <b>{stats[s]}</b>
                </span>
              ))}
            </div>
          </section>
        </div>
        <div className="stack">
          <section className="card">
            <CardHeading title="Upcoming deadlines" href="/deadlines" />
            <DeadlineRows items={due.slice(0, 3)} day={day} />
          </section>
          <Link href="/feedback" className="coach-promo">
            <div>
              <Sparkles size={20} />
              <ArrowUpRight size={18} />
            </div>
            <h2>AI feedback studio</h2>
            <p>Find the skills and experience to bring forward in your next application.</p>
          </Link>
        </div>
      </div>
      <Reminders ws={ws} reload={reload} day={day} />
    </>
  );
}
export function DeadlinePage({ ws, day, reload }) {
  const due = upcoming(ws.applications, day);
  const overdue = ws.applications
    .filter(
      (a) =>
        a.deadline && a.deadline < day && !['Offer', 'Rejected', 'Withdrawn'].includes(a.status),
    )
    .sort((a, b) => b.deadline.localeCompare(a.deadline));
  return (
    <>
      <SectionHead
        eyebrow="TRACKER"
        title="Deadlines"
        description="Upcoming dates for your open applications. Dates follow Philippine time."
      >
        {addLink}
      </SectionHead>
      <Reminders ws={ws} reload={reload} day={day} />
      <section className="card">
        <CardHeading title="Upcoming deadlines" icon={CalendarDays} />
        <DeadlineRows items={due} day={day} />
      </section>
      {overdue.length > 0 && (
        <section className="card">
          <CardHeading title="Past deadlines" />
          <JobRows items={overdue} />
        </section>
      )}
    </>
  );
}
export function Applications({ ws }) {
  const [search, setSearch] = useState(''),
    [stage, setStage] = useState('All stages'),
    [sort, setSort] = useState('Recent updates');
  const items = ws.applications.filter(
    (a) =>
      (stage === 'All stages' || a.status === stage) &&
      (a.employer + ' ' + a.position + ' ' + a.location)
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  if (sort === 'Nearest deadline')
    items.sort((a, b) => (a.deadline || '9999').localeCompare(b.deadline || '9999'));
  return (
    <>
      <SectionHead
        eyebrow="TRACKER"
        title="Applications"
        description="Your saved opportunities and application records."
      >
        {addLink}
      </SectionHead>
      <section className="card">
        <div className="filters">
          <label className="search">
            <Search size={17} />
            <input
              aria-label="Search applications"
              placeholder="Search roles or employers"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
          <label className="icon-select">
            <SlidersHorizontal size={15} />
            <select
              aria-label="Filter stage"
              value={stage}
              onChange={(e) => setStage(e.target.value)}
            >
              {['All stages', ...ws.stages].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
          <select
            aria-label="Sort applications"
            value={sort}
            onChange={(e) => setSort(e.target.value)}
          >
            <option>Recent updates</option>
            <option>Nearest deadline</option>
          </select>
        </div>
        <div className="list-head">
          <span>
            {items.length} {items.length === 1 ? 'application' : 'applications'}
          </span>
          <span>Deadline</span>
        </div>
        {items.length || !ws.applications.length ? (
          <JobRows items={items} />
        ) : (
          <Empty title="No matching applications">Try a different search or stage.</Empty>
        )}
      </section>
    </>
  );
}
export function ApplicationEditor({ ws, id, reload, notify, go }) {
  const record = ws.applications.find((a) => a.id === id);
  const [editing, setEditing] = useState(id === 'new'),
    [removing, setRemoving] = useState(false);
  const { busy, error, run } = useAction();
  if (id !== 'new' && !record)
    return (
      <Empty title="Application not found">
        <Link href="/applications">Return to applications</Link>
      </Empty>
    );
  const a = record || blankApplication();
  const save = (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.currentTarget));
    run(async () => {
      const r = await api('applications/save', { ...data, ...(record ? { id } : {}) });
      await reload();
      setEditing(false);
      notify('Application saved.');
      go('/applications/' + r.id);
    });
  };
  return (
    <>
      <Link href="/applications" className="backlink">
        ‹ All applications
      </Link>
      <SectionHead
        eyebrow="APPLICATION RECORD"
        title={editing ? (record ? 'Edit application' : 'Add application') : a.position}
        description={editing ? 'Keep the role and your application details together.' : a.employer}
      >
        {!editing && (
          <button className="button dark" onClick={() => setEditing(true)}>
            Edit application
          </button>
        )}
      </SectionHead>
      {editing ? (
        <form className="card edit-form" onSubmit={save}>
          <h2>Opportunity details</h2>
          <div className="form-grid">
            {[
              ['Employer', 'employer', 160],
              ['Position title', 'position', 160],
              ['Location or work arrangement', 'location', 160],
              ['Source link', 'source_url', 2048],
            ].map(([label, name, max]) => (
              <Field key={name} label={label}>
                <input
                  name={name}
                  type={name === 'source_url' ? 'url' : 'text'}
                  defaultValue={a[name] || ''}
                  required={['employer', 'position'].includes(name)}
                  maxLength={max}
                />
              </Field>
            ))}
            <Field
              label="Job requirements"
              full
              hint="Provide requirements or a source link. For a skills comparison, include the written requirements."
            >
              <textarea
                rows={4}
                name="requirements"
                maxLength={8000}
                defaultValue={a.requirements}
              />
            </Field>
          </div>
          <h2>Application details</h2>
          <div className="form-grid">
            <Field label="Stage">
              <select name="status" defaultValue={a.status}>
                {ws.stages.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </Field>
            {[
              ['Date saved', 'date_saved'],
              ['Date applied', 'date_applied'],
              ['Deadline', 'deadline'],
            ].map(([label, name]) => (
              <Field key={name} label={label}>
                <input
                  type="date"
                  name={name}
                  defaultValue={a[name] || ''}
                  required={name === 'date_saved'}
                />
              </Field>
            ))}
            <Field label="Résumé version" full>
              <input name="resume_version" defaultValue={a.resume_version} maxLength={160} />
            </Field>
            <Field label="Notes" full>
              <textarea rows={3} name="notes" maxLength={4000} defaultValue={a.notes} />
            </Field>
          </div>
          <ErrorBox message={error} />
          <div className="actions">
            <button disabled={busy} className="button dark">
              {busy ? 'Saving…' : 'Save application'}
            </button>
            <button
              type="button"
              className="button light"
              onClick={() => (record ? setEditing(false) : go('/applications'))}
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <section className="card detail">
          <div className="detail-meta">
            <Pill status={a.status} />
            {a.location && (
              <span>
                <MapPin size={15} />
                {a.location}
              </span>
            )}
          </div>
          <div className="facts">
            {[
              ['Date saved', displayDate(a.date_saved)],
              ['Date applied', displayDate(a.date_applied)],
              ['Deadline', displayDate(a.deadline)],
              ['Résumé version', a.resume_version || '—'],
            ].map(([k, v]) => (
              <div key={k}>
                <small>{k}</small>
                <strong>{v}</strong>
              </div>
            ))}
          </div>
          <h2>Job requirements</h2>
          <p className="preserve">{a.requirements || 'No requirements entered.'}</p>
          {a.source_url && (
            <a className="text-link" href={a.source_url} target="_blank" rel="noreferrer">
              View job source <ArrowUpRight size={15} />
            </a>
          )}
          <h2>Notes</h2>
          <p className="preserve">{a.notes || 'No notes yet.'}</p>
          <div className="actions">
            <Link className="button light" href={'/feedback?application=' + id}>
              <Sparkles size={16} /> Compare my skills
            </Link>
            <button className="quiet-button danger" onClick={() => setRemoving(!removing)}>
              Delete application
            </button>
          </div>
          {removing && (
            <div className="confirm">
              <p>Delete this application and its linked reminders and feedback?</p>
              <button
                className="button danger-fill"
                disabled={busy}
                onClick={() =>
                  run(async () => {
                    await api('applications/delete', { id });
                    await reload();
                    notify('Application deleted.');
                    go('/applications');
                  })
                }
              >
                Confirm deletion
              </button>{' '}
              <button className="quiet-button" onClick={() => setRemoving(false)}>
                Cancel
              </button>
            </div>
          )}
          <ErrorBox message={error} />
        </section>
      )}
    </>
  );
}
