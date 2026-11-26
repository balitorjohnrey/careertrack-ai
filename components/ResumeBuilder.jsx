import { useState } from 'react';
import { Download, PencilLine, Printer, Sparkles } from 'lucide-react';
import { api, ErrorBox, Field, SectionHead, useAction } from './common';
import { papers, resumeInput, resumeParagraphs, resumeSections } from '../lib/resume.mjs';

const headerFields = [
  ['name', 'Full name', 100],
  ['role', 'Target role', 150],
  ['email', 'Contact email', 254],
  ['phone', 'Phone', 50],
  ['city', 'City or region', 100],
  ['portfolio', 'Portfolio or LinkedIn', 300],
];
const hints = {
  summary: 'A few facts about your background and the work you want to do.',
  education: 'Degree or program, school, and graduation date or current year.',
  experience:
    'Include internships, work, or volunteering. Give your role, organization, dates, and what you did.',
  projects: 'Project name, your contribution, tools used, and results you can verify.',
  skills: 'List tools, languages, and other skills you can demonstrate.',
  certifications: 'Include the credential or award, issuer, and year if known.',
};

function HeaderFields({ value, onChange }) {
  return (
    <div className="form-grid">
      {headerFields.map(([key, label, max]) => (
        <Field key={key} label={label}>
          <input
            value={value[key]}
            maxLength={max}
            type={key === 'email' ? 'email' : 'text'}
            required={key === 'name'}
            onChange={(e) => onChange({ ...value, [key]: e.target.value })}
          />
        </Field>
      ))}
    </div>
  );
}

function PaperSelect({ value, onChange }) {
  return (
    <Field label="Paper size">
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {Object.entries(papers).map(([key, { label }]) => (
          <option key={key} value={key}>
            {label}
          </option>
        ))}
      </select>
    </Field>
  );
}

export default function ResumeBuilder({ ws, user, providerName }) {
  const [header, setHeader] = useState(() => ({
    name: ws.profile.full_name || '',
    role: '',
    email: user.email || '',
    phone: '',
    city: '',
    portfolio: '',
  }));
  const [details, setDetails] = useState(() => ({
    summary: ws.resume.summary,
    education: ws.profile.program || '',
    experience: ws.resume.experience,
    projects: '',
    skills: ws.resume.skills,
    certifications: '',
  }));
  const [paper, setPaper] = useState('a4');
  const [draft, setDraft] = useState(null);
  const [view, setView] = useState('details');
  const { busy, error, setError, run } = useAction();

  function show(next) {
    setError('');
    setView(next);
  }
  function generate(event) {
    event.preventDefault();
    run(async () => {
      if (!header.name.trim()) throw new Error('Enter your name for the résumé header.');
      const input = resumeInput({ ...details, role: header.role });
      const { sections } = await api('ai/create-resume', {
        details: input,
        provider: providerName,
      });
      setDraft({ header: { ...header }, sections });
      show('preview');
    });
  }
  async function downloadWord() {
    const { resumeWordBlob } = await import('../lib/resume-word.mjs');
    const blob = await resumeWordBlob(draft.header, draft.sections, paper);
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download =
      (draft.header.name.trim().replace(/[<>:"/\\|?*]/g, '-') || 'CareerTrack') + ' - Resume.docx';
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }
  return (
    <div className={'resume-builder builder-' + view}>
      <div className="builder-controls">
        <SectionHead
          eyebrow="WRITING TOOLS"
          title="Résumé builder"
          description={
            view === 'details'
              ? 'Turn your education, projects, and experience into a résumé.'
              : 'Review the facts and wording, then download a copy before leaving this page.'
          }
        />
        {view === 'details' ? (
          <form className="card edit-form" onSubmit={generate}>
            <h2>Résumé header</h2>
            <p className="card-note">
              Enter your name and the contact details you want on the document.
            </p>
            <HeaderFields value={header} onChange={setHeader} />
            <h2>Your background</h2>
            <p className="card-note">
              Fill in the sections that apply to you. Class projects and volunteer work count.
            </p>
            {resumeSections.map(({ key, title, limit }) => (
              <Field
                key={key}
                label={key === 'summary' ? 'Background notes' : title}
                hint={hints[key]}
              >
                <textarea
                  rows={key === 'experience' ? 4 : 2}
                  maxLength={limit}
                  value={details[key]}
                  onChange={(e) => setDetails({ ...details, [key]: e.target.value })}
                />
              </Field>
            ))}
            <PaperSelect value={paper} onChange={setPaper} />
            <div className="ai-notice">
              <Sparkles size={19} />
              <div>
                <strong>What goes to {providerName}</strong>
                <p>
                  Your target role and the background sections above. Your name and contact fields
                  are added on this device. Keep personal contact details out of the background
                  notes.
                </p>
              </div>
            </div>
            <ErrorBox message={error} />
            <div className="actions">
              <button className="button dark" disabled={busy}>
                <Sparkles size={16} />
                {busy ? 'Writing résumé…' : draft ? 'Generate a new résumé' : 'Generate résumé'}
              </button>
              {draft && (
                <button
                  className="button light"
                  type="button"
                  disabled={busy}
                  onClick={() => show('preview')}
                >
                  Return to current draft
                </button>
              )}
            </div>
          </form>
        ) : view === 'edit' ? (
          <form
            className="card edit-form"
            onSubmit={(e) => {
              e.preventDefault();
              if (
                !draft.header.name.trim() ||
                !Object.values(draft.sections).some((s) => s.trim())
              ) {
                setError('Keep a name and at least one résumé section.');
                return;
              }
              show('preview');
            }}
          >
            <h2>Edit résumé</h2>
            <HeaderFields
              value={draft.header}
              onChange={(value) => setDraft({ ...draft, header: value })}
            />
            {resumeSections.map(({ key, title }) => (
              <Field key={key} label={title}>
                <textarea
                  rows={3}
                  maxLength={6000}
                  value={draft.sections[key] || ''}
                  onChange={(e) =>
                    setDraft({ ...draft, sections: { ...draft.sections, [key]: e.target.value } })
                  }
                />
              </Field>
            ))}
            <ErrorBox message={error} />
            <button className="button dark">Preview changes</button>
          </form>
        ) : (
          <div className="card builder-toolbar">
            <PaperSelect value={paper} onChange={setPaper} />
            <div className="actions">
              <button className="button dark" disabled={busy} onClick={() => run(downloadWord)}>
                <Download size={16} /> Download Word
              </button>
              <button className="button light" onClick={() => window.print()}>
                <Printer size={16} /> Print / Save PDF
              </button>
              <button className="button light" onClick={() => show('edit')}>
                <PencilLine size={16} /> Edit résumé
              </button>
              <button className="quiet-button" onClick={() => show('details')}>
                Back to source details
              </button>
            </div>
            <p className="card-note">
              Arial 12 pt · Justified · Choose “Save as PDF” in the print dialog. Turn off browser
              headers and footers for a clean copy.
            </p>
            <ErrorBox message={error} />
          </div>
        )}
      </div>
      {view === 'preview' && draft && (
        <>
          <style media="print">
            {'@page { size: ' + papers[paper].css + '; margin: 0.75in; }'}
          </style>
          <article className={'resume-paper paper-' + paper} aria-label="Résumé preview">
            {resumeParagraphs(draft.header, draft.sections).map(({ style, text }, i) => {
              const Tag = style === 'name' ? 'h2' : style === 'heading' ? 'h3' : 'p';
              return (
                <Tag key={i} className={'resume-' + style}>
                  {text}
                </Tag>
              );
            })}
          </article>
        </>
      )}
    </div>
  );
}
