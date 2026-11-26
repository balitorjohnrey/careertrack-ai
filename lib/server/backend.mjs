import { AppError } from '../domain.mjs';

export function backendMode() {
  if (process.env.SUPABASE_URL && process.env.SUPABASE_PUBLISHABLE_KEY) return 'supabase';
  if (
    !process.env.VERCEL &&
    !process.env.SUPABASE_URL &&
    !process.env.SUPABASE_PUBLISHABLE_KEY &&
    (process.env.NODE_ENV !== 'production' || process.env.CAREERTRACK_LOCAL === '1')
  )
    return 'local';
  return 'unconfigured';
}
async function remote(path, options = {}, token) {
  const response = await fetch(process.env.SUPABASE_URL.replace(/\/$/, '') + path, {
    ...options,
    cache: 'no-store',
    signal: AbortSignal.timeout(12000),
    headers: {
      apikey: process.env.SUPABASE_PUBLISHABLE_KEY,
      'Content-Type': 'application/json',
      ...(path.startsWith('/auth/') ? { 'X-Supabase-Api-Version': '2024-01-01' } : {}),
      ...(token ? { Authorization: 'Bearer ' + token } : {}),
    },
  });
  const text = await response.text();
  const body = text ? JSON.parse(text) : null;
  if (!response.ok) {
    const error = new Error('Supabase request failed');
    error.code = body?.error_code || response.headers.get('x-sb-error-code') || body?.code;
    error.http = response.status;
    throw error;
  }
  return body;
}
function cookie(name, value, age) {
  const secure =
    (process.env.NODE_ENV === 'production' && backendMode() !== 'local') || process.env.VERCEL;
  return `${name}=${encodeURIComponent(value)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${age}${secure ? '; Secure' : ''}`;
}
function writeCloudSession(res, session) {
  res.setHeader('Set-Cookie', [
    cookie('ct_access', session.access_token, session.expires_in),
    cookie('ct_refresh', session.refresh_token, 30 * 86400),
  ]);
}
export function clearSession(res) {
  res.setHeader(
    'Set-Cookie',
    ['ct_local', 'ct_access', 'ct_refresh'].map((n) => cookie(n, '', 0)),
  );
}
export async function authenticate(action, data, req, res) {
  const mode = backendMode();
  if (mode === 'unconfigured')
    throw new AppError(503, 'Configure the Supabase connection to open this workspace.');
  if (mode === 'local') {
    if (action === 'resend')
      throw new AppError(400, 'Email confirmation is only used on the hosted site.');
    const { localAuth } = await import('./local.mjs');
    const token = await localAuth(action, data);
    res.setHeader('Set-Cookie', cookie('ct_local', token, 7 * 86400));
    return { signedIn: true };
  }
  if (action === 'demo')
    throw new AppError(404, 'The sample workspace is available in local mode.');
  try {
    if (action === 'resend') {
      await remote('/auth/v1/resend', {
        method: 'POST',
        body: JSON.stringify({ email: data.email, type: 'signup' }),
      });
      return { ok: true };
    }
    const signup = action === 'register';
    const session = await remote(
      signup ? '/auth/v1/signup' : '/auth/v1/token?grant_type=password',
      {
        method: 'POST',
        body: JSON.stringify({
          email: data.email,
          password: data.password,
          ...(signup ? { data: { full_name: data.full_name } } : {}),
        }),
      },
    );
    if (!session?.access_token) {
      if (signup) return { confirmEmail: true };
      throw new Error('Sign-in response missing session');
    }
    writeCloudSession(res, session);
    return { signedIn: true };
  } catch (e) {
    if (e.http === 429) throw new AppError(429, 'Too many attempts. Please try again later.');
    if (action === 'login' && e.code === 'email_not_confirmed') return { confirmEmail: true };
    if (e.code === 'invalid_credentials')
      throw new AppError(
        401,
        'The email and password did not match. Use the account you registered on this website.',
      );
    if (e.code === 'email_address_not_authorized')
      throw new AppError(
        503,
        'This site cannot send confirmation emails to this address yet. Ask the project owner to configure email delivery in Supabase.',
      );
    if (['email_provider_disabled', 'signup_disabled'].includes(e.code))
      throw new AppError(
        503,
        'Email registration or sign-in is disabled for this site. Contact the project owner.',
      );
    if (
      action === 'resend' &&
      ['user_not_found', 'email_exists'].includes(e.code)
    )
      return { ok: true };
    if (e.http === 401)
      throw new AppError(
        503,
        'The sign-in service could not connect. Ask the project owner to check the Supabase URL and publishable key in Vercel.',
      );
    if (e.http >= 400 && e.http < 500)
      throw new AppError(
        400,
        action === 'register'
          ? 'Registration could not be completed. Check your email and password or try signing in.'
          : action === 'resend'
            ? 'The confirmation email request could not be completed. Please try again later.'
            : 'Sign-in could not be completed. Contact the project owner if this continues.',
      );
    throw e;
  }
}
export async function getSession(req, res) {
  const mode = backendMode();
  if (mode === 'local') {
    if (!req.cookies.ct_local) return null;
    return (await import('./local.mjs')).localSession(req.cookies.ct_local);
  }
  if (mode !== 'supabase') return null;
  let token = req.cookies.ct_access;
  if (token) {
    try {
      const user = await remote('/auth/v1/user', {}, token);
      return { id: user.id, email: user.email, token };
    } catch (e) {
      if (![401, 403].includes(e.http)) throw e;
    }
  }
  if (!req.cookies.ct_refresh) return null;
  try {
    const session = await remote('/auth/v1/token?grant_type=refresh_token', {
      method: 'POST',
      body: JSON.stringify({ refresh_token: req.cookies.ct_refresh }),
    });
    writeCloudSession(res, session);
    return { id: session.user.id, email: session.user.email, token: session.access_token };
  } catch (e) {
    if ([400, 401, 403].includes(e.http)) {
      clearSession(res);
      return null;
    }
    throw e;
  }
}
export async function signOut(req, res) {
  if (backendMode() === 'local')
    await (await import('./local.mjs')).localLogout(req.cookies.ct_local);
  if (backendMode() === 'supabase') {
    const user = await getSession(req, res);
    if (user) await remote('/auth/v1/logout?scope=local', { method: 'POST' }, user.token);
  }
  clearSession(res);
}
export async function rpc(user, name, args = {}) {
  try {
    if (backendMode() === 'local') {
      const { localDB, localRPC } = await import('./local.mjs');
      return await localRPC(await localDB(), user.id, name, args);
    }
    return await remote(
      '/rest/v1/rpc/' + name,
      { method: 'POST', body: JSON.stringify(args) },
      user.token,
    );
  } catch (e) {
    if (e.code === '42501')
      throw new AppError(403, 'This account does not have access to this workspace or action.');
    if (e.code === 'P0002') throw new AppError(404, 'The requested record could not be found.');
    if (e.code === 'P0415')
      throw new AppError(
        429,
        'AI request limit reached. Allow 15 seconds between requests. Each person has 10 requests per rolling week, subject to the project’s monthly limit.',
      );
    if (e.code === 'P0001' || /^(22|23)/.test(e.code || ''))
      throw new AppError(400, 'Please check the fields and try again.');
    throw e;
  }
}
