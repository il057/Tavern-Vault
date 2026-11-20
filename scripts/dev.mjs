import { spawn } from 'node:child_process';

const isWin = process.platform === 'win32';
const npmCmd = isWin ? 'npm.cmd' : 'npm';

const procs = [
  spawn(npmCmd, ['--prefix', 'server', 'run', 'dev'], { stdio: 'inherit', shell: isWin }),
  spawn(npmCmd, ['--prefix', 'client', 'run', 'dev'], { stdio: 'inherit', shell: isWin }),
];

const shutdown = () => {
  for (const p of procs) {
    if (!p.killed) p.kill();
  }
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
