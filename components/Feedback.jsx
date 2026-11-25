import { useState } from 'react';
import Link from 'next/link';
import { BookOpenCheck, ChartNoAxesCombined, FilePenLine, ScanLine, Sparkles } from 'lucide-react';
import { api, Empty, ErrorBox, Field, SectionHead, useAction } from './common';
import { displayDate, kinds, reportReasons } from '../lib/domain.mjs';

const tools = [
  ['skills', ScanLine, 'Compare your skills with a saved role.', 'ai/skills-compare'],
  ['resume', FilePenLine, 'Find clearer ways to describe your work.', 'ai/resume-feedback'],
  ['progress', ChartNoAxesCombined, 'Review your pipeline and next steps.', 'ai/progress-summary'],
];
function Report({ onReport, busy }) {
  const [reason, setReason] = useState('');
  return (
    <div className="report">
      <select aria-label="Report reason" value={reason} onChange={(e) => setReason(e.target.value)}>
        <option value="">Select a report reason</option>
        {reportReasons.map((r) => (
          <option key={r}>{r}</option>
        ))}
      </select>
      <button
        disabled={busy || !reason}
        className="button light small"
        onClick={() => onReport(reason)}
      >
        Submit report
      </button>
    </div>
  );
}
function SavedItem({ item, onChange, ws }) {
  const [open, setOpen] = useState(false),
    [text, setText] = useState(item.output_text),
    [report, setReport] = useState(false),
    [deleting, setDeleting] = useState(false);
  const { busy, error, run } = useAction();
  const act = (action, value = '') =>
    run(async () => {
      await api('feedback/manage', { id: item.id, action, value });
      await onChange();
      setOpen(false);
      setReport(false);
      setDeleting(false);
    });
  return (
    <article className="saved-item">
      <button
        className="saved-toggle"
        aria-expanded={open}
        onClick={() => {
          setText(item.output_text);
          setOpen(!open);
        }}
      >
        <BookOpenCheck size={19} />
        <span>
          <strong>{kinds[item.kind]}</strong>
          <small>
            {ws.applications.find((a) => a.id === item.application_id)?.position || 'Workspace'} ·{' '}
            {displayDate(item.created_at)}
            {item.report_reason ? ' · Reported' : ''}
          </small>
        </span>
        <b>{open ? '−' : '+'}</b>
      </button>
      {open && (
        <div className="saved-body">
          <Field label="Reviewed feedback">
            <textarea
              rows={7}
              value={text}
              maxLength={6000}
              onChange={(e) => setText(e.target.value)}
            />
          </Field>
          <div className="actions">
            <button
              className="button dark small"
              disabled={busy || !text.trim() || text === item.output_text}
              onClick={() => act('edit', text)}
            >
              Save edits
            </button>
            {!item.report_reason && (
              <button className="quiet-button" onClick={() => setReport(!report)}>
                Report feedback
              </button>
            )}
            <button className="quiet-button danger" onClick={() => setDeleting(true)}>
              Delete
            </button>
          </div>
          {report && <Report busy={busy} onReport={(r) => act('report', r)} />}
          {deleting && (
            <div className="confirm">
              Delete this saved feedback?{' '}
              <button
                className="button small danger-fill"
                disabled={busy}
                onClick={() => act('delete')}
              >
                Confirm deletion
              </button>{' '}
              <button className="quiet-button" onClick={() => setDeleting(false)}>
                Cancel
              </button>
            </div>
          )}
          <ErrorBox message={error} />
        </div>
      )}
    </article>
  );
}
export default function Feedback({ ws, applicationId, providerName, reload, notify }) {
  const [kind, setKind] = useState('skills'),
    [target, setTarget] = useState(applicationId || ''),
    [draft, setDraft] = useState(null),
    [text, setText] = useState(''),
    [retry, setRetry] = useState(false),
    [report, setReport] = useState(false);
  const { busy, error, run, setError } = useAction();
  const begin = (regen = false) =>
    run(async () => {
      const route = tools.find((row) => row[0] === kind)[3];
      const result = await api(route, {
        application_id: kind === 'progress' ? null : target || null,
        provider: providerName,
        regenerate: regen,
      });
      setDraft(result);
      setText(result.output_text);
      setRetry(regen);
      setReport(false);
    });
  const discard = () => {
    setDraft(null);
    setText('');
    setRetry(false);
    setReport(false);
    setError('');
  };
  const save = (reason = null) =>
    run(async () => {
      await api('feedback/save', {
        ...draft,
        output_text: text,
        edited: text !== draft.output_text,
        report_reason: reason,
      });
      await reload();
      discard();
      notify(reason ? 'Feedback saved and reported.' : 'Reviewed feedback saved.');
    });
  return (
    <>
      <SectionHead
        eyebrow="WRITING TOOLS"
        title="AI feedback studio"
        description="Work from your own experience and review every suggestion."
      />
      <div className="tool-tabs">
        {tools.map(([k, Icon, description]) => (
          <button
            key={k}
            disabled={busy || !!draft}
            className={'tool-tab ' + (kind === k ? 'selected' : '')}
            aria-pressed={kind === k}
            onClick={() => {
              setKind(k);
              setError('');
            }}
          >
            <Icon size={21} />
            <strong>{kinds[k]}</strong>
            <span>{description}</span>
          </button>
        ))}
      </div>
      <section className="card edit-form">
        <h2>{draft ? 'Review your draft' : kinds[kind]}</h2>
        {!draft ? (
          <>
            {kind !== 'progress' && (
              <Field
                label={kind === 'skills' ? 'Target application' : 'Target application (optional)'}
              >
                <select value={target} onChange={(e) => setTarget(e.target.value)}>
                  <option value="">
                    {kind === 'skills' ? 'Choose a saved application' : 'General résumé review'}
                  </option>
                  {ws.applications.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.position} · {a.employer}
                    </option>
                  ))}
                </select>
              </Field>
            )}
            <div className="ai-notice">
              <Sparkles size={19} />
              <div>
                <strong>What goes to {providerName}</strong>
                <p>
                  {kind === 'progress'
                    ? 'Application counts by stage and up to eight upcoming role titles and deadlines.'
                    : 'Your skills, résumé summary, experience notes and the selected role’s written requirements.'}{' '}
                  Remove personal details from free text before generating. Suggestions can be
                  inaccurate or biased.
                </p>
              </div>
            </div>
            <div className="actions">
              <button
                disabled={busy || (kind === 'skills' && !target)}
                className="button dark"
                onClick={() => begin()}
              >
                <Sparkles size={16} />
                {busy ? 'Generating…' : 'Generate draft'}
              </button>
              <Link className="text-link" href={kind === 'progress' ? '/applications' : '/resume'}>
                {kind === 'progress' ? 'Review applications' : 'Review résumé & skills'}
              </Link>
            </div>
          </>
        ) : (
          <>
            <p className="card-note">
              {draft.cached
                ? 'Reused your saved feedback for these inputs.'
                : 'AI-generated draft. Review the facts and wording before saving.'}{' '}
              Changes here apply only to this feedback.
            </p>
            <Field label="Edit draft">
              <textarea
                rows={9}
                value={text}
                onChange={(e) => setText(e.target.value)}
                maxLength={6000}
              />
            </Field>
            <div className="actions">
              <button
                className="button dark"
                disabled={busy || !text.trim()}
                onClick={() => save()}
              >
                Save reviewed draft
              </button>
              <button className="button light" disabled={busy} onClick={discard}>
                Discard
              </button>
              <button className="quiet-button" disabled={busy || retry} onClick={() => begin(true)}>
                Regenerate once
              </button>
              <button className="quiet-button" disabled={busy} onClick={() => setReport(!report)}>
                Report feedback
              </button>
            </div>
            {report && <Report busy={busy || !text.trim()} onReport={save} />}
          </>
        )}
        <ErrorBox message={error} />
      </section>
      <section className="card">
        <div className="card-heading">
          <h2>Saved feedback</h2>
          <span className="count-chip">{ws.feedback.length}</span>
        </div>
        {ws.feedback.length ? (
          ws.feedback.map((f) => <SavedItem key={f.id} item={f} ws={ws} onChange={reload} />)
        ) : (
          <Empty title="No saved feedback yet">Your reviewed drafts will appear here.</Empty>
        )}
      </section>
    </>
  );
}
