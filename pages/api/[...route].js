import { AppError, requireValue, reportReasons, kinds, stages } from '../../lib/domain.mjs';
import { authenticate, clearSession, getSession, rpc, signOut } from '../../lib/server/backend.mjs';
import { generateDraft } from '../../lib/server/ai.mjs';

export const config = { api: { bodyParser: { sizeLimit: '48kb' } } };
function validateApplication(data) {
  requireValue(
    typeof data.employer === 'string' &&
      data.employer.trim() &&
      typeof data.position === 'string' &&
      data.position.trim(),
    'Enter an employer and position.',
  );
  requireValue(
    data.requirements?.trim() || data.source_url?.trim(),
    'Enter the job requirements or a source link.',
  );
  if (data.source_url) {
    let valid = false;
    try {
      valid = ['http:', 'https:'].includes(new URL(data.source_url).protocol);
    } catch {}
    requireValue(valid, 'Use a full http or https link.');
  }
  requireValue(stages.includes(data.status), 'Choose an application stage.');
  for (const field of ['date_saved', 'date_applied', 'deadline']) {
    const value = data[field];
    if (field !== 'date_saved' && !value) continue;
    const parsed = Date.parse(value);
    requireValue(
      /^\d{4}-\d{2}-\d{2}$/.test(value) &&
        Number.isFinite(parsed) &&
        new Date(parsed).toISOString().slice(0, 10) === value,
      'Enter valid calendar dates.',
    );
  }
}
const aiRoutes = {
  'ai/skills-compare': 'skills',
  'ai/resume-feedback': 'resume',
  'ai/progress-summary': 'progress',
};
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'private, no-store');
  try {
    const path = req.query.route.join('/');
    requireValue(req.method === 'POST', 'Use POST for this action.', 405);
    requireValue(req.headers['content-type']?.startsWith('application/json'), 'Send JSON.', 415);
    if (req.headers.origin)
      requireValue(
        new URL(req.headers.origin).host === req.headers.host,
        'This request could not be verified.',
        403,
      );
    const data = req.body || {};
    if (['auth/login', 'auth/register', 'auth/demo'].includes(path)) {
      const action = path.split('/')[1];
      if (action !== 'demo') {
        requireValue(
          typeof data.email === 'string' &&
            data.email.length <= 254 &&
            /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email),
          'Enter a valid email.',
        );
        data.email = data.email.trim().toLowerCase();
        requireValue(
          typeof data.password === 'string' &&
            data.password.length >= (action === 'login' ? 1 : 8) &&
            data.password.length <= 128,
          'Use a password with 8–128 characters.',
        );
        if (action === 'register')
          requireValue(
            typeof data.full_name === 'string' &&
              data.full_name.trim() &&
              data.full_name.length <= 100,
            'Enter your name.',
          );
      }
      return res.json(await authenticate(action, data, req, res));
    }
    if (path === 'auth/logout') {
      await signOut(req, res);
      return res.json({ ok: true });
    }
    const user = await getSession(req, res);
    requireValue(user, 'Please sign in to continue.', 401);
    let result = { ok: true };
    switch (path) {
      case 'workspace':
        result = await rpc(user, 'ct_workspace');
        break;
      case 'applications/save':
        validateApplication(data);
        result = { id: await rpc(user, 'ct_application', { data }) };
        break;
      case 'applications/delete':
        await rpc(user, 'ct_remove_application', { target: data.id });
        break;
      case 'profile':
        await rpc(user, 'ct_profile', { data });
        break;
      case 'resume':
        await rpc(user, 'ct_resume', { data });
        break;
      case 'reminders':
        requireValue(
          Array.isArray(data.items) && data.items.length <= 100,
          'Invalid reminder selection.',
        );
        for (const item of data.items)
          await rpc(user, 'ct_reminder', {
            target: item.id,
            due: item.deadline,
            acknowledge: data.acknowledge === true,
          });
        break;
      case 'feedback/save':
        requireValue(
          Object.hasOwn(kinds, data.kind) &&
            typeof data.output_text === 'string' &&
            data.output_text.trim(),
          'Review a draft before saving it.',
        );
        if (data.report_reason)
          requireValue(reportReasons.includes(data.report_reason), 'Choose a report reason.');
        result = { id: await rpc(user, 'ct_feedback', { data }) };
        break;
      case 'feedback/manage':
        await rpc(user, 'ct_manage_feedback', {
          target: data.id,
          action: data.action,
          value: data.value || '',
        });
        break;
      case 'admin':
        result = await rpc(user, 'ct_admin', { action: data.action, data });
        break;
      case 'account/delete':
        requireValue(data.confirm === 'DELETE', 'Type DELETE to confirm.');
        await rpc(user, 'ct_delete_account');
        clearSession(res);
        break;
      default:
        requireValue(Object.hasOwn(aiRoutes, path), 'Page not found.', 404);
        result = await generateDraft(
          user,
          { ...data, kind: aiRoutes[path] },
          await rpc(user, 'ct_workspace'),
        );
    }
    return res.json(result);
  } catch (error) {
    const known = error instanceof AppError;
    if (!known) console.error('CareerTrack request failed', { code: error.code || error.name });
    return res
      .status(known ? error.status : 503)
      .json({
        error: known
          ? error.message
          : 'The workspace is temporarily unavailable. Please try again.',
      });
  }
}
