import { loadEnvFile } from 'node:process';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
if(existsSync('.env.local')) loadEnvFile('.env.local');
// Pass a key file explicitly when running the approved synthetic integration. Never copy it to worktrees.
if(process.env.OPENAI_KEY_ENV_FILE) loadEnvFile(process.env.OPENAI_KEY_ENV_FILE);
const mode=process.argv.includes('--production')?'start':'dev';
const child=spawn(process.execPath,['node_modules/next/dist/bin/next',mode,...(mode==='dev'?['--webpack']:[]),'--hostname','127.0.0.1','--port',process.env.PORT||'3100'],{stdio:'inherit',env:process.env});
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>child.kill(signal));
child.on('exit',code=>process.exit(code??1));
