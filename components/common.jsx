import Link from 'next/link';
import {
  Compass,
  BriefcaseBusiness,
  CalendarDays,
  ScanLine,
  FileText,
  Layers3,
  Lightbulb,
  Flag,
  Shapes,
  PanelsTopLeft,
  Command,
  Sprout,
} from 'lucide-react';
import { cloneElement, useId, useState } from 'react';
export const stageIcons = {
  Saved: Layers3,
  Applied: BriefcaseBusiness,
  Assessment: ScanLine,
  Interview: CalendarDays,
  Offer: Flag,
  Rejected: FileText,
  Withdrawn: FileText,
};
export function Brand({ href = '/' }) {
  return (
    <Link className="brand" href={href}>
      <span className="brandmark">
        <Compass size={25} strokeWidth={1.8} />
      </span>
      <span>
        CareerTrack <b>AI</b>
      </span>
    </Link>
  );
}
export function Mark({ name = '' }) {
  const n = Array.from(name).reduce((sum, c) => sum + c.charCodeAt(0), 0) % 5;
  const Icon = [Shapes, PanelsTopLeft, Command, Sprout, Lightbulb][n];
  return (
    <span className={'employer-mark mark-' + n}>
      <Icon size={21} strokeWidth={1.7} />
    </span>
  );
}
export function Pill({ status }) {
  return (
    <span className={'pill stage-' + status.toLowerCase()}>
      <i />
      {status}
    </span>
  );
}
export function Empty({ title, children }) {
  return (
    <div className="empty">
      <Compass size={24} />
      <h3>{title}</h3>
      {children && <p>{children}</p>}
    </div>
  );
}
export function Field({ label, children, hint, full = false }) {
  const id = useId();
  return (
    <div className={'field' + (full ? ' full' : '')}>
      <label htmlFor={id}>{label}</label>
      {cloneElement(children, { id, 'aria-describedby': hint ? id + '-hint' : undefined })}
      {hint && <small id={id + '-hint'}>{hint}</small>}
    </div>
  );
}
export async function api(route, body = {}) {
  const res = await fetch('/api/' + route, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res
    .json()
    .catch(() => ({ error: 'Connection interrupted. Please try again.' }));
  if (!res.ok) throw new Error(data.error || 'This action could not be completed.');
  return data;
}
export function useAction() {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  async function run(fn) {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      return await fn();
    } catch (e) {
      setError(e.message || 'Please try again.');
    } finally {
      setBusy(false);
    }
  }
  return { busy, error, run, setError };
}
export function ErrorBox({ message }) {
  return message ? (
    <p className="errorbox" role="alert">
      {message}
    </p>
  ) : null;
}
export function SectionHead({ eyebrow, title, description, children }) {
  return (
    <div className="section-head">
      <div>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1>{title}</h1>
        {description && <p className="muted">{description}</p>}
      </div>
      {children}
    </div>
  );
}
