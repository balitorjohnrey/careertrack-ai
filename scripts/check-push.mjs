import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const zero = /^0+$/;
const hashes = new Set();
for (const line of readFileSync(0, 'utf8').trim().split(/\r?\n/)) {
  if (!line) continue;
  const [, local, , remote] = line.split(/\s+/);
  if (zero.test(local)) continue;
  const args = zero.test(remote) ? [local] : [remote + '..' + local];
  for (const hash of execFileSync('git', ['rev-list', ...args], { encoding: 'utf8' })
    .trim()
    .split(/\s+/))
    if (hash) hashes.add(hash);
}
const secret =
  /sk-(?:proj-)?[A-Za-z0-9_-]{25,}|sb_secret_[A-Za-z0-9_-]{10,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/;
for (const hash of hashes) {
  const patch = execFileSync('git', ['show', '--format=', '--no-ext-diff', '--unified=0', hash], {
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
  });
  if (
    patch
      .split('\n')
      .some((line) => line.startsWith('+') && !line.startsWith('+++') && secret.test(line))
  ) {
    console.error(
      'A credential pattern was found in outgoing changes. Remove it from the affected commits and rotate any exposed key.',
    );
    process.exit(1);
  }
}
