#!/usr/bin/env node
// Creates the bcrypt hash for the analytics dashboard password.
// Usage: npm run admin:hash            (prompts, input hidden)
//        npm run admin:hash -- --cost 10
// Then store it: npx wrangler secret put ADMIN_PASSWORD_HASH   (paste the hash)
import bcrypt from 'bcryptjs';
import { createInterface } from 'node:readline';

const costArg = process.argv.indexOf('--cost');
const cost = costArg > -1 ? Number(process.argv[costArg + 1]) : 10;
if (!(cost >= 4 && cost <= 14)) {
  console.error('Cost must be between 4 and 14.');
  process.exit(1);
}

const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: process.stdin.isTTY });
let prompt = '';
rl._writeToOutput = (s) => {
  // Hide typed characters, keep the prompt and newlines.
  if (s.includes(prompt) || s === '\r\n' || s === '\n') rl.output.write(s);
  else rl.output.write('*');
};
// Buffer lines so piped input (both answers at once) works too.
const lines = [];
let waiting = null;
rl.on('line', (line) => (waiting ? (waiting(line), (waiting = null)) : lines.push(line)));
const ask = (question) =>
  new Promise((resolve) => {
    prompt = question;
    process.stdout.write(question);
    if (lines.length) {
      process.stdout.write('\n');
      resolve(lines.shift());
    } else waiting = resolve;
  });

const pw = await ask('Dashboard password: ');
if (pw.length < 10) {
  console.error('Use at least 10 characters.');
  process.exit(1);
}
const again = await ask('Repeat password: ');
rl.close();
if (pw !== again) {
  console.error('Passwords do not match.');
  process.exit(1);
}
const hash = bcrypt.hashSync(pw, cost);
console.log(`\nbcrypt hash (cost ${cost}):\n\n${hash}\n`);
console.log('Next: npx wrangler secret put ADMIN_PASSWORD_HASH   and paste the hash above.');
