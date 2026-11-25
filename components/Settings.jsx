import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowDown, ArrowUp, Download, LockKeyhole, Sparkles } from 'lucide-react';
import { api, ErrorBox, Field, SectionHead, useAction } from './common';
export function Resume({ ws, reload, notify }) {
  const { busy, error, run } = useAction();
  return (
    <>
      <SectionHead
        eyebrow="PROFILE"
        title="Résumé & skills"
        description="Keep the experience and skills you want to use in applications."
      />
      <form
        className="card edit-form"
        onSubmit={(e) => {
          e.preventDefault();
          const data = Object.fromEntries(new FormData(e.currentTarget));
          run(async () => {
            await api('resume', data);
            await reload();
            notify('Résumé and skills saved.');
          });
        }}
      >
        <h2>Résumé profile</h2>
        <Field
          label="Résumé summary"
          hint="Introduce your field, interests and the kind of work you’ve done."
        >
          <textarea rows={4} name="summary" maxLength={4000} defaultValue={ws.resume.summary} />
        </Field>
        <Field label="Skills and tools" hint="Separate skills with commas or line breaks.">
          <textarea rows={3} name="skills" maxLength={2000} defaultValue={ws.resume.skills} />
        </Field>
        <Field label="Coursework and experience">
          <textarea
            rows={5}
            name="experience"
            maxLength={4000}
            defaultValue={ws.resume.experience}
          />
        </Field>
        <ErrorBox message={error} />
        <div className="actions">
          <button className="button dark" disabled={busy}>
            {busy ? 'Saving…' : 'Save résumé profile'}
          </button>
          <Link className="text-link" href="/feedback">
            <Sparkles size={16} /> Open feedback studio
          </Link>
        </div>
      </form>
    </>
  );
}
export function Profile({ ws, user, reload, notify }) {
  const { busy, error, run } = useAction(),
    [deleting, setDeleting] = useState(false),
    [confirm, setConfirm] = useState('');
  function exportData() {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify({ ...ws, exported_at: new Date().toISOString() }, null, 2)], {
        type: 'application/json',
      }),
    );
    const a = document.createElement('a');
    a.href = url;
    a.download = 'careertrack-workspace.json';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <>
      <SectionHead
        eyebrow="ACCOUNT"
        title="Profile settings"
        description={
          user.demo ? 'You’re exploring a private demo with fictional records.' : user.email
        }
      />
      <form
        className="card edit-form"
        onSubmit={(e) => {
          e.preventDefault();
          const data = Object.fromEntries(new FormData(e.currentTarget));
          run(async () => {
            await api('profile', data);
            await reload();
            notify('Profile updated.');
          });
        }}
      >
        <h2>Personal details</h2>
        <div className="form-grid">
          {[
            ['Name', 'full_name', 100],
            ['Program or field', 'program', 120],
            ['Graduation year (optional)', 'graduation_year', 4],
            ['Contact details (optional)', 'contact', 200],
          ].map(([label, name, max]) => (
            <Field key={name} label={label}>
              <input
                name={name}
                required={name === 'full_name'}
                type={name === 'graduation_year' ? 'number' : 'text'}
                min={name === 'graduation_year' ? 1950 : undefined}
                max={name === 'graduation_year' ? 2150 : undefined}
                maxLength={max}
                defaultValue={ws.profile[name] || ''}
              />
            </Field>
          ))}
        </div>
        <button className="button dark" disabled={busy}>
          Save profile
        </button>
      </form>
      <section className="card edit-form">
        <h2>
          <LockKeyhole size={20} /> Your data
        </h2>
        <p className="muted">
          Download a copy of your profile, applications, reminders and saved feedback.
        </p>
        <div className="actions">
          <button className="button light" onClick={exportData}>
            <Download size={16} /> Export my records
          </button>
          <button className="quiet-button danger" onClick={() => setDeleting(!deleting)}>
            Delete my account
          </button>
        </div>
        {deleting && (
          <div className="confirm">
            <Field label="Type DELETE to permanently remove your account and records">
              <input value={confirm} onChange={(e) => setConfirm(e.target.value)} />
            </Field>
            <button
              className="button danger-fill"
              disabled={busy || confirm !== 'DELETE'}
              onClick={() =>
                run(async () => {
                  await api('account/delete', { confirm });
                  window.location.assign('/');
                })
              }
            >
              Permanently delete my account
            </button>
          </div>
        )}
      </section>
      <ErrorBox message={error} />
    </>
  );
}
export function Admin({ ws, reload, notify }) {
  const { busy, error, run } = useAction(),
    [data, setData] = useState(null),
    [order, setOrder] = useState(ws.stages);
  useEffect(() => {
    run(async () => setData(await api('admin', { action: 'overview' })));
  }, []);
  const move = (i, dir) => {
    const next = [...order];
    [next[i], next[i + dir]] = [next[i + dir], next[i]];
    setOrder(next);
  };
  return (
    <>
      <SectionHead
        eyebrow="ADMINISTRATION"
        title="System overview"
        description="Aggregate pilot activity and account maintenance."
      />
      <ErrorBox message={error} />
      {data && (
        <section className="card edit-form">
          <h2>Pilot activity</h2>
          <div className="admin-stats">
            {Object.entries({
              Accounts: data.users,
              Suspended: data.suspended,
              Applications: data.applications,
              'Complete records': data.complete,
              'Reminders shown': data.shown,
              'Acknowledged on time': data.acknowledged,
              'AI requests': data.requests,
              'AI failures': data.failures,
              'Admin events': data.audit_events,
            }).map(([k, v]) => (
              <div key={k}>
                <small>{k}</small>
                <strong>{v}</strong>
              </div>
            ))}
          </div>
          <h2>Feedback reports</h2>
          {Object.keys(data.reports).length ? (
            Object.entries(data.reports).map(([r, n]) => (
              <p key={r}>
                {r} · {n}
              </p>
            ))
          ) : (
            <p className="muted">No reported feedback.</p>
          )}
        </section>
      )}
      <form
        className="card edit-form"
        onSubmit={(e) => {
          e.preventDefault();
          const form = e.currentTarget;
          const values = Object.fromEntries(new FormData(form));
          run(async () => {
            setData(await api('admin', values));
            form.reset();
            notify('Account action recorded.');
          });
        }}
      >
        <h2>Account access</h2>
        <Field label="Account email">
          <input name="email" type="email" required />
        </Field>
        <Field label="Action">
          <select name="action">
            <option value="suspend">Suspend account</option>
            <option value="restore">Restore account</option>
          </select>
        </Field>
        <Field label="Documented reason">
          <input name="reason" minLength={3} maxLength={300} required />
        </Field>
        <button disabled={busy} className="button dark">
          Update account access
        </button>
      </form>
      <section className="card edit-form">
        <h2>Stage display order</h2>
        {order.map((s, i) => (
          <div key={s} className="order-row">
            <span>{s}</span>
            <button aria-label={'Move ' + s + ' up'} disabled={i === 0} onClick={() => move(i, -1)}>
              <ArrowUp size={16} />
            </button>
            <button
              aria-label={'Move ' + s + ' down'}
              disabled={i === order.length - 1}
              onClick={() => move(i, 1)}
            >
              <ArrowDown size={16} />
            </button>
          </div>
        ))}
        <button
          className="button dark"
          disabled={busy}
          onClick={() =>
            run(async () => {
              setData(await api('admin', { action: 'stages', stages: order }));
              await reload();
              notify('Stage order saved.');
            })
          }
        >
          Save order
        </button>
      </section>
    </>
  );
}
