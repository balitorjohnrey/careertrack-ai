import Link from 'next/link';
import { useState } from 'react';
import {
  ArrowUpRight,
  BriefcaseBusiness,
  CalendarClock,
  Compass,
  LockKeyhole,
  Sparkles,
} from 'lucide-react';
import { api, Brand, ErrorBox, Field, useAction } from './common';

export default function Public({ page, mode }) {
  const { busy, error, run } = useAction();
  const [confirmation, setConfirmation] = useState(false);
  const signup = page === 'register';
  const demo = () =>
    run(async () => {
      await api('auth/demo');
      window.location.assign('/dashboard');
    });
  const submit = (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.currentTarget));
    run(async () => {
      const r = await api(signup ? 'auth/register' : 'auth/login', data);
      if (r.confirmEmail) setConfirmation(true);
      else window.location.assign('/dashboard');
    });
  };
  return (
    <div className="public-shell">
      <header className="public-header">
        <Brand />
        <nav>
          <Link className="quiet-button" href="/login">
            Sign in
          </Link>
          <Link className="button dark" href="/register">
            Create account
          </Link>
        </nav>
      </header>
      {page === 'home' ? (
        <main className="landing">
          <section className="hero">
            <div className="hero-copy">
              <div className="kicker">
                <b /> STUDENT CAREER WORKSPACE
              </div>
              <h1>
                Your job search,
                <br />
                <em>in one place.</em>
              </h1>
              <p>
                Track applications, stay ahead of deadlines, and tailor your résumé with AI feedback
                you review.
              </p>
              <div className="actions">
                <Link href="/register" className="button dark">
                  Create your workspace <ArrowUpRight size={17} />
                </Link>
                {mode === 'local' && (
                  <button className="button light" disabled={busy} onClick={demo}>
                    {busy ? 'Opening demo…' : 'Explore the demo'}
                  </button>
                )}
              </div>
              <ErrorBox message={error} />
            </div>
            <div className="hero-visual">
              <img
                src="/field-guide.webp"
                alt="A winding path through green mountain ridges at sunrise"
              />
              <div className="sample-card">
                <div className="sample-label">
                  <Compass size={15} /> SAMPLE APPLICATION
                </div>
                <div className="sample-title">
                  <div>
                    <strong>Product Design Intern</strong>
                    <small>Sora Studio</small>
                  </div>
                  <span className="pill stage-interview">
                    <i />
                    Interview
                  </span>
                </div>
              </div>
            </div>
          </section>
          <section className="feature-strip" aria-label="Workspace features">
            {[
              [
                BriefcaseBusiness,
                'Application tracker',
                'Keep job requirements, stages and notes together.',
              ],
              [CalendarClock, 'Deadline reminders', 'See what’s due and acknowledge reminders.'],
              [Sparkles, 'AI feedback', 'Compare skills, review your résumé and plan next steps.'],
            ].map(([Icon, title, desc]) => (
              <div key={title}>
                <Icon size={23} />
                <h2>{title}</h2>
                <p>{desc}</p>
              </div>
            ))}
          </section>
        </main>
      ) : (
        <main className="auth-wrap">
          <div className="auth-art">
            <img alt="" src="/field-guide.webp" />
          </div>
          <section className="auth-card">
            <div className="kicker">
              <b /> CAREERTRACK AI
            </div>
            <h1>
              {confirmation
                ? 'Check your email'
                : signup
                  ? 'Create your workspace'
                  : 'Welcome back'}
            </h1>
            {confirmation ? (
              <>
                <p>Open your confirmation email, then sign in to your workspace.</p>
                <Link className="button dark" href="/login">
                  Go to sign in
                </Link>
              </>
            ) : (
              <>
                <p>
                  {signup
                    ? 'Start a private record of your job and internship applications.'
                    : 'Sign in to your application tracker.'}
                </p>
                <form onSubmit={submit}>
                  {signup && (
                    <Field label="Name">
                      <input name="full_name" required maxLength={100} autoComplete="name" />
                    </Field>
                  )}
                  <Field label="Email">
                    <input
                      type="email"
                      name="email"
                      required
                      maxLength={254}
                      autoComplete="email"
                    />
                  </Field>
                  <Field label="Password" hint={signup ? 'Use at least 8 characters.' : null}>
                    <input
                      type="password"
                      name="password"
                      required
                      minLength={signup ? 8 : 1}
                      maxLength={128}
                      autoComplete={signup ? 'new-password' : 'current-password'}
                    />
                  </Field>
                  {signup && (
                    <p className="privacy-note">
                      <LockKeyhole size={15} /> Your profile and applications are private. You
                      choose when to send selected text to the AI service.
                    </p>
                  )}
                  <ErrorBox message={error} />
                  <button className="button dark" disabled={busy}>
                    {busy ? 'Please wait…' : signup ? 'Create account' : 'Sign in'}
                  </button>
                </form>
                <p className="auth-switch">
                  {signup ? 'Already registered?' : 'New to CareerTrack AI?'}{' '}
                  <Link href={signup ? '/login' : '/register'}>
                    {signup ? 'Sign in' : 'Create an account'}
                  </Link>
                </p>
              </>
            )}
          </section>
        </main>
      )}
      <footer className="public-footer">
        <span>CareerTrack AI</span>
        <span>Student Job Application Assistant</span>
      </footer>
    </div>
  );
}
