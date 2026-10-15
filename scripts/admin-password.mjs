#!/usr/bin/env node
// Creates the analytics dashboard password and its PBKDF2-SHA256 hash.
//
//   npm run admin:password             generate a strong random password (recommended)
//   npm run admin:password -- --own    type your own (16+ characters, input hidden)
//
// Then store the hash on the Worker:
//   npx wrangler secret put ADMIN_PASSWORD_HASH      (paste the hash)
import { webcrypto as crypto } from 'node:crypto';
import { createInterface } from 'node:readline';

const ITERATIONS = 10_000; // keeps one check within the Workers Free plan CPU limit
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'; // no look-alikes
const b64url = (buf) => Buffer.from(buf).toString('base64url');

function randomPassword(length = 20) {
  const out = [];
  const max = 256 - (256 % ALPHABET.length); // rejection sampling: no modulo bias
  while (out.length < length) {
    for (const b of crypto.getRandomValues(new Uint8Array(length * 2))) {
      if (b < max && out.length < length) out.push(ALPHABET[b % ALPHABET.length]);
    }
  }
  return out.join('');
}

async function hash(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: ITERATIONS }, key, 256);
  return `pbkdf2_sha256$${ITERATIONS}$${b64url(salt)}$${b64url(bits)}`;
}

async function askHidden(questions) {
  const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: process.stdin.isTTY });
  let prompt = '';
  rl._writeToOutput = (s) => {
    if (s.includes(prompt) || s === '\r\n' || s === '\n') rl.output.write(s);
    else rl.output.write('*');
  };
  // Buffer lines so piped input works too.
  const lines = [];
  let waiting = null;
  rl.on('line', (l) => (waiting ? (waiting(l), (waiting = null)) : lines.push(l)));
  const answers = [];
  for (const q of questions) {
    prompt = q;
    process.stdout.write(q);
    answers.push(
      await new Promise((resolve) => {
        if (lines.length) {
          process.stdout.write('\n');
          resolve(lines.shift());
        } else waiting = resolve;
      }),
    );
  }
  rl.close();
  return answers;
}

let password;
if (process.argv.includes('--own')) {
  const [a, b] = await askHidden(['Dashboard password: ', 'Repeat password: ']);
  if (a.length < 16) {
    console.error('Use at least 16 characters (or run without --own to generate one).');
    process.exit(1);
  }
  if (a !== b) {
    console.error('Passwords do not match.');
    process.exit(1);
  }
  password = a;
} else {
  password = randomPassword();
  console.log(`\nYour dashboard password (save it in your password manager):\n\n    ${password}\n`);
}

console.log(`ADMIN_PASSWORD_HASH:\n\n${await hash(password)}\n`);
console.log('Next: npx wrangler secret put ADMIN_PASSWORD_HASH   and paste the hash above.');
