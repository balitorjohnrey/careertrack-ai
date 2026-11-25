export const stages = [
  'Saved',
  'Applied',
  'Assessment',
  'Interview',
  'Offer',
  'Rejected',
  'Withdrawn',
];
export const kinds = {
  skills: 'Skills comparison',
  resume: 'Résumé feedback',
  progress: 'Progress summary',
};
export const reportReasons = [
  'Inaccurate information',
  'Biased wording',
  'Irrelevant advice',
  'Other concern',
];
export function today(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}
export function offsetDate(offset, from = today()) {
  return new Date(Date.parse(from) + offset * 86400000).toISOString().slice(0, 10);
}
export function daysLeft(date, day = today()) {
  return Math.round((Date.parse(date) - Date.parse(day)) / 86400000);
}
export function upcoming(records, day = today()) {
  return records
    .filter(
      (a) =>
        a.deadline && !['Offer', 'Rejected', 'Withdrawn'].includes(a.status) && a.deadline >= day,
    )
    .sort((a, b) => a.deadline.localeCompare(b.deadline) || a.position.localeCompare(b.position));
}
export function counts(records) {
  return Object.fromEntries(stages.map((s) => [s, records.filter((a) => a.status === s).length]));
}
export function blankApplication() {
  return {
    employer: '',
    position: '',
    location: '',
    requirements: '',
    source_url: '',
    deadline: '',
    status: 'Saved',
    date_saved: today(),
    date_applied: '',
    resume_version: '',
    notes: '',
  };
}
export function displayDate(value, options = { month: 'short', day: 'numeric' }) {
  return value
    ? new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Manila', ...options }).format(
        new Date(value),
      )
    : '—';
}
export class AppError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
export function requireValue(condition, message, status = 400) {
  if (!condition) throw new AppError(status, message);
}
