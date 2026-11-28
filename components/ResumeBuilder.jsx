import { useRef, useState } from 'react';
import { Download, PencilLine, Printer, Sparkles } from 'lucide-react';
import { api, ErrorBox, Field, SectionHead, useAction } from './common';
import PortraitResume from './PortraitResume';
import { squarePhoto } from '../lib/square-photo.mjs';
import {
  editorialColors,
  papers,
  resumeBodyParagraphs,
  resumeHeaderParagraphs,
  resumeInitials,
  resumeInput,
  resumeSections,
} from '../lib/resume.mjs';

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

function DesignPicker({ value, onChange }) {
  return (
    <fieldset className="resume-design-picker">
      <legend>Résumé design</legend>
      <div className="design-choices">
        {['Portrait', 'Editorial', 'Classic'].map((label) => {
          const id = label.toLowerCase();
          return (
            <label className="design-choice" key={id}>
              <input
                type="radio"
                name="resume-design"
                value={id}
                checked={value === id}
                onChange={() => onChange(id)}
              />
              <span aria-hidden="true" className={'design-sample sample-' + id} />
              <span>{label}</span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

function PortraitDetails({ value, onChange }) {
  return <div className="form-grid portrait-details">
    <Field label="Languages" hint="Optional. Enter one language and proficiency per line.">
      <textarea rows={3} maxLength={1200} value={value.languages}
        onChange={(e) => onChange({ ...value, languages: e.target.value })} />
    </Field>
    <Field label="References" hint="Optional. Include only the details you want on this résumé.">
      <textarea rows={3} maxLength={1600} value={value.references}
        onChange={(e) => onChange({ ...value, references: e.target.value })} />
    </Field>
  </div>;
}

function ResumePhotoPicker({ photo, profilePhoto, onChange, busy, run }) {
  const input = useRef(null);
  return <fieldset className="resume-photo-picker">
    <legend>Résumé photo</legend>
    <div className="resume-photo-options">
      {photo && <img src={'data:image/jpeg;base64,' + photo} alt="Selected résumé photo" />}
      <div>
        <p className="card-note">2 × 2 inches · JPG, PNG or WebP up to 10 MB</p>
        <div className="actions">
          <button type="button" className="button light" disabled={busy}
            onClick={() => input.current.click()}>{photo ? 'Change photo' : 'Attach photo'}</button>
          {profilePhoto && profilePhoto !== photo && <button type="button" className="quiet-button"
            disabled={busy} onClick={() => onChange(profilePhoto)}>Use profile photo</button>}
          {photo && <button type="button" className="quiet-button" disabled={busy}
            onClick={() => onChange(null)}>Remove from résumé</button>}
        </div>
        <input type="file" accept="image/jpeg,image/png,image/webp" hidden ref={input}
          aria-label="Choose résumé photo" onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (file) run(async () => onChange(await squarePhoto(file, { pixels: 600 })));
          }} />
      </div>
    </div>
  </fieldset>;
}

function ResumePaper({ draft, design, paper }) {
  const colors = Object.fromEntries(
    Object.entries(editorialColors).map(([name, hex]) => ['--resume-' + name, '#' + hex]),
  );
  return (
    <article
      className={'resume-paper paper-' + paper + ' design-' + design}
      style={colors}
      aria-label="Résumé preview"
    >
      <header className="resume-masthead">
        {design === 'editorial' && (
          <span className="resume-initials" aria-hidden="true">
            {resumeInitials(draft.header.name)}
          </span>
        )}
        <div className="resume-identity">
          {resumeHeaderParagraphs(draft.header).map(({ style, text }) => {
            const Tag = style === 'name' ? 'h2' : 'p';
            return (
              <Tag key={style} className={'resume-' + style}>
                {text}
              </Tag>
            );
          })}
        </div>
      </header>
      {resumeBodyParagraphs(draft.sections, draft.header).map(({ style, text }, i) => {
        const Tag = style === 'heading' ? 'h3' : 'p';
        return (
          <Tag key={i} className={'resume-' + style}>
            {text}
          </Tag>
        );
      })}
    </article>
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
    languages: '',
    references: '',
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
  const [design, setDesign] = useState('portrait');
  const [photo, setPhoto] = useState(ws.profile.photo_jpeg || null);
  const [draft, setDraft] = useState(null);
  const [view, setView] = useState('details');
  const { busy, error, setError, run } = useAction();
  const photoPicker = design === 'portrait' && (
    <ResumePhotoPicker photo={photo} profilePhoto={ws.profile.photo_jpeg}
      onChange={setPhoto} busy={busy} run={run} />
  );

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
    const blob = await resumeWordBlob(draft.header, draft.sections, paper, design, photo);
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
            <div className="builder-setup">
              <div className="builder-identity">
                <h2>Résumé header</h2>
                <p className="card-note">
                  Enter your name and the contact details you want on the document.
                </p>
                <HeaderFields value={header} onChange={setHeader} />
              </div>
              <div className="builder-design-panel">
                <DesignPicker value={design} onChange={setDesign} />
                <PaperSelect value={paper} onChange={setPaper} />
                {photoPicker}
              </div>
            </div>
            <PortraitDetails value={header} onChange={setHeader} />
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
                  rows={7}
                  maxLength={limit}
                  value={details[key]}
                  onChange={(e) => setDetails({ ...details, [key]: e.target.value })}
                />
              </Field>
            ))}
            <div className="ai-notice">
              <Sparkles size={19} />
              <div>
                <strong>What goes to {providerName}</strong>
                <p>
                  Your target role and the background sections above. Your photo, contact details,
                  languages and references are added on this device. Keep personal details out of the background
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
            <PortraitDetails value={draft.header}
              onChange={(value) => setDraft({ ...draft, header: value })} />
            {resumeSections.map(({ key, title }) => (
              <Field key={key} label={title}>
                <textarea
                  rows={7}
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
            <DesignPicker value={design} onChange={setDesign} />
            <PaperSelect value={paper} onChange={setPaper} />
            {photoPicker}
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
            {'@page { size: ' + papers[paper].css + '; margin: ' + (design === 'portrait' ? '0.3in' : '0.75in') + '; }'}
          </style>
          {design === 'portrait'
            ? <PortraitResume {...draft} paper={paper} photo={photo} />
            : <ResumePaper draft={draft} design={design} paper={paper} />}
        </>
      )}
    </div>
  );
}
