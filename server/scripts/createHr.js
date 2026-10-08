import readline from 'node:readline';
import { store } from '../services/store.js';

function ask(question, { hidden = false } = {}) {
  return new Promise(resolve => {
    if (!hidden) {
      const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
      rl.question(question, answer => {
        rl.close();
        resolve(answer.trim());
      });
      return;
    }

    const stdin = process.stdin;

    // Interactive server-admin use gets masked input. For piped/non-TTY use,
    // fall back to readline so the command does not hang.
    if (!stdin.isTTY) {
      const rl = readline.createInterface({ input: stdin, output: process.stdout });
      rl.question(question, answer => {
        rl.close();
        resolve(answer.trim());
      });
      return;
    }

    const rl = readline.createInterface({ input: stdin, output: process.stdout });
    const wasRaw = stdin.isRaw;

    const cleanup = () => {
      stdin.setRawMode(Boolean(wasRaw));
      rl.close();
      console.log();
    };

    process.stdout.write(question);
    stdin.setRawMode(true);

    let value = '';
    const onData = chunk => {
      const key = chunk.toString();

      if (key === '\u0003') {
        cleanup();
        process.exit(130);
      }

      if (key === '\r' || key === '\n') {
        stdin.off('data', onData);
        cleanup();
        resolve(value);
        return;
      }

      if (key === '\u007f' || key === '\b') {
        value = value.slice(0, -1);
        return;
      }

      if (key.length === 1 && key >= ' ') value += key;
    };

    stdin.on('data', onData);
  });
}

try {
  console.log('\nTidal ATS — Create HR Account');
  console.log('This command is intended for a trusted server administrator.\n');

  const firstName = await ask('First name: ');
  const lastName = await ask('Last name: ');
  const middleInitialRaw = await ask('Middle initial (optional): ');
  const suffix = await ask('Suffix (optional): ');
  const email = (await ask('Email: ')).toLowerCase();

  if (!firstName || !lastName || !email) {
    throw new Error('First name, last name, and email are required.');
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('Please enter a valid email address.');
  }

  if (store.getUserByEmail(email)) {
    throw new Error('An account with this email already exists.');
  }

  const password = await ask('Password (hidden): ', { hidden: true });
  const confirm = await ask('Confirm password (hidden): ', { hidden: true });

  if (password.length < 8) {
    throw new Error('Password must be at least 8 characters.');
  }

  if (password.length > 128) {
    throw new Error('Password must be 128 characters or fewer.');
  }

  if (password !== confirm) {
    throw new Error('Passwords do not match.');
  }

  const middleInitial = middleInitialRaw.replace(/\.$/, '').slice(0, 1);
  const name = [
    firstName,
    middleInitial ? `${middleInitial}.` : '',
    lastName,
    suffix
  ].filter(Boolean).join(' ');

  const user = store.createUser({
    name,
    firstName,
    lastName,
    middleInitial,
    suffix,
    email,
    password,
    role: 'hr',
    emailVerified: true,
    title: 'HR & Recruiter',
    company: undefined
  });

  console.log(`\nHR account created successfully: ${user.email}`);
  console.log('Role: hr');
  console.log('Email verification: already verified (administrator-created account).');
  console.log('The password was hashed before it was stored.\n');
} catch (err) {
  console.error(`\nCould not create HR account: ${err.message}\n`);
  process.exitCode = 1;
}
