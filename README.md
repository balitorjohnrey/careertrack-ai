# CareerTrack AI

A student job application assistant built with Next.js, React and PostgreSQL. Students manage their own opportunities, application stages, deadlines, résumé information and reviewed AI feedback. Both local and hosted accounts support server-side AI requests to Groq or OpenAI.

## Try it on your computer

Install Node.js 22 or newer. From this folder, run the following in PowerShell. Dependencies are already installed in the original workspace.

```powershell
npm.cmd ci
npm.cmd run dev
```

Open the local address printed in the terminal, usually **http://127.0.0.1:3000**. Choose **Explore the demo** for a private workspace with five fictional applications. Choose **Create account** for a persistent, initially empty workspace. Start only one local server against the same data directory at a time.

Local mode stores data in the ignored `.local/postgres` folder on this computer. It uses embedded PostgreSQL (PGlite), the same application migration as the hosted version, password hashing and expiring HTTP-only session cookies. Demo accounts have no sign-in password. Personal accounts can sign out and sign back in. Local data and accounts stay on this machine when you connect Supabase. For a local administration walkthrough, set `CAREERTRACK_LOCAL_ADMIN_EMAIL` in `.env.local` to your own local account email, restart the app and sign in again. This setting applies only to local accounts.

For live AI during local development, set `GROQ_API_KEY` in `.env.local` and restart the server. Open **Résumé builder** to write a résumé, or **AI feedback studio** to compare skills, review a résumé summary, or summarize application progress. Each tool shows which fields it sends. Choose **Explore the demo** to try these tools with fictional data. [Groq API keys](https://console.groq.com/keys)

## Student workflows

| Module | What to try |
| --- | --- |
| Account and profile | Register, sign in, edit your name, program, optional contact details and graduation year. Export your own workspace as JSON or delete your account in Profile settings. |
| Applications | Add an employer, role and requirements or source link. Record location, saved/applied dates, deadline, notes and the résumé version. Search, filter, sort, edit or delete a record. |
| Stages and deadlines | Move an application through Saved, Applied, Assessment, Interview, Offer, Rejected or Withdrawn. Review stage counts and acknowledge in-system reminders within seven days and again within one day. Dates use Philippine time. |
| Résumé and skills | Maintain your own text summary, skills, tools, coursework and experience. |
| AI résumé builder | Enter career details and generate a draft. Choose the Editorial or Classic design and A4 or Short / US Letter. You can change the design after generation. Review or edit the draft, then download Word or use Print / Save PDF. Both designs use Arial 12 pt, justified body paragraphs and 0.75-inch margins. Header contact fields stay in the browser. Download the draft before leaving the page. |
| AI skills comparison | Select a saved role with written requirements and compare it with your stated skills. |
| AI résumé and progress feedback | Request a résumé review, optionally targeted to a role, or a summary of computed counts and upcoming deadlines. Edit, save, discard, regenerate once or report feedback. |

The optional **Administration** screen provides aggregate counts, completeness, reminder acknowledgements, reported-feedback categories, account suspension/restoration with a reason, and ordering of the seven stages. Admin actions are logged. Admins use their own workspace for personal records.

## Connect the hosted services

1. **Supabase.** Create a project your team controls. In its SQL Editor, run `supabase/migrations/001_careertrack.sql` once on a fresh application database. It creates the five application tables, owner-only read policies, scoped database functions and private operational tables for quotas, reminders and audit events. Enable the Data API with the public schema available. Enable email/password authentication. Set the Auth Site URL to your final HTTPS sign-in page and configure permitted redirects for your deployment. Configure confirmation email delivery for your pilot participants. [Supabase password authentication](https://supabase.com/docs/guides/auth/passwords) · [Email delivery](https://supabase.com/docs/guides/auth/auth-smtp)
2. **Environment.** Copy `.env.example` to `.env.local` for local integration testing. Enter the project URL and publishable key from Supabase. The server uses the signed-in user's token for each database call. No service-role key is required. [Supabase API keys](https://supabase.com/docs/guides/getting-started/api-keys)
3. **Live AI.** Set `GROQ_API_KEY` in the server environment to use Groq. Installations using only `OPENAI_API_KEY` continue to use OpenAI. A configured Groq key takes precedence, and a failed request stays with the selected provider. Restart the local server or redeploy after changing variables.
4. **GitHub and Vercel.** Give the team access to its GitHub repository and connect it to a Vercel project. Choose the Next.js preset, the repository root, and `main` as the production branch. Supply the same environment variable names in Vercel for Preview and Production. Use a separate Supabase project and test key for previews containing test data. Redeploy after setting variables. Review feature changes on a preview before merging into `dev`, then review `dev` for release to `main`. [Next.js on Vercel](https://vercel.com/docs/frameworks/full-stack/nextjs)
5. **Administrator.** Have your designated maintainer register and confirm their email. Copy their user UUID from Supabase Authentication. Run the following in the project's SQL Editor with that actual UUID. Their next page load will show Administration.

```sql
update public.profiles
set is_admin = true
where id = 'YOUR-CONFIRMED-USER-UUID'::uuid;
```

| Server variable | Value |
| --- | --- |
| `SUPABASE_URL` | Your Supabase project's HTTPS URL |
| `SUPABASE_PUBLISHABLE_KEY` | Project publishable key |
| `GROQ_API_KEY` | Team's server-side Groq key for live drafts |
| `GROQ_MODEL` | Optional Groq model override, default `openai/gpt-oss-20b` hosted by Groq |
| `OPENAI_API_KEY` | Alternative server-side OpenAI key |
| `OPENAI_MODEL` | Optional OpenAI model override, default `gpt-4o-mini` |

Keep secrets in the local ignored environment file or Vercel's server environment. In each Git checkout, use `git config core.hooksPath .githooks` to enable the included pre-push credential check.

## AI data and limits

The studio shows which fields the requested action sends. Skills and résumé requests use limited excerpts of the entered text. Progress requests send counts and up to eight upcoming titles and deadlines. The server removes known profile contact details and common email/phone patterns. Users should review free text for identifying details before requesting feedback.

Drafts initially exist only in the response. Saving or reporting a draft is an explicit user action. A saved review can be reused for the same inputs. The database reserves requests atomically and enforces a 15-second interval, 10 requests per user per rolling week and 2,000 requests per UTC calendar month across the project. A provider rate-limit response also delays retries on that server instance. Provider errors and missing credentials leave the tracker available.

## Verification and pilot handoff

```powershell
npm.cmd test
npm.cmd run build
```

The automated suite runs the actual migration in embedded PostgreSQL. It covers ownership, row policies, atomic application edits, reminders, account deletion, administrator permissions, rate limits and AI input minimization. Provider adapter tests use simulated Supabase Auth, Groq and OpenAI responses. After connecting the team's accounts, check email confirmation, the three feedback actions, and résumé generation and export.

For pilot measurements, use a dedicated pilot database or compare aggregate snapshots from the start and end of the pilot. The admin screen gives counts for completeness and timely acknowledgements. The team must collect timed-task results and satisfaction responses from consenting participants. Real instructor approval, evidence gathering, teammate review, the signed scope declaration and LMS submission belong to the team.
