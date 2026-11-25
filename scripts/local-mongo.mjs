import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const localDir = path.join(rootDir, '.local');
const dbPath = path.join(localDir, 'mongodb-data');
const logPath = path.join(localDir, 'mongod.log');
const pidPath = path.join(localDir, 'mongod.pid');

const PORT = 27017;
const HOST = '127.0.0.1';

function isPortOpen(host, port) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(1000);
    socket.once('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.once('timeout', () => {
      socket.destroy();
      resolve(false);
    });
    socket.once('error', () => {
      socket.destroy();
      resolve(false);
    });
    socket.connect(port, host);
  });
}

function findMongodBinary() {
  if (process.env.MONGOD_BIN && fs.existsSync(process.env.MONGOD_BIN)) {
    return process.env.MONGOD_BIN;
  }

  const which = spawnSync(process.platform === 'win32' ? 'where.exe' : 'which', ['mongod'], {
    encoding: 'utf8',
  });
  if (which.status === 0 && which.stdout.trim()) {
    return which.stdout.trim().split(/\r?\n/)[0];
  }

  const candidates = [];
  if (process.platform === 'win32') {
    const pf = process.env.ProgramFiles || 'C:\\Program Files';
    const mongoRoot = path.join(pf, 'MongoDB', 'Server');
    if (fs.existsSync(mongoRoot)) {
      for (const ver of fs.readdirSync(mongoRoot).sort().reverse()) {
        candidates.push(path.join(mongoRoot, ver, 'bin', 'mongod.exe'));
      }
    }
  }

  const cacheDir = path.join(os.homedir(), '.cache', 'mongodb-binaries');
  if (fs.existsSync(cacheDir)) {
    for (const entry of fs.readdirSync(cacheDir).sort().reverse()) {
      if (entry.startsWith('mongod') && !entry.endsWith('.md5')) {
        candidates.push(path.join(cacheDir, entry));
      }
    }
  }

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  return null;
}

async function initReplicaSetIfNeeded() {
  const { MongoClient } = await import('mongodb');
  const client = new MongoClient(`mongodb://${HOST}:${PORT}/?directConnection=true`, {
    serverSelectionTimeoutMS: 5000,
  });
  try {
    await client.connect();
    const admin = client.db('admin');
    try {
      const status = await admin.command({ replSetGetStatus: 1 });
      if (status.ok === 1) {
        return 'already-initialized';
      }
    } catch {
      await admin.command({
        replSetInitiate: {
          _id: 'rs0',
          members: [{ _id: 0, host: `${HOST}:${PORT}` }],
        },
      });
      // Wait for primary election
      for (let i = 0; i < 30; i += 1) {
        try {
          const hello = await admin.command({ hello: 1 });
          if (hello.isWritablePrimary) {
            return 'initiated-primary';
          }
        } catch {
          // retry
        }
        await new Promise((r) => setTimeout(r, 500));
      }
      return 'initiated';
    }
  } finally {
    await client.close();
  }
  return 'ready';
}

async function start() {
  if (await isPortOpen(HOST, PORT)) {
    const rsState = await initReplicaSetIfNeeded().catch(() => 'standalone');
    console.log(`MongoDB already listening on ${HOST}:${PORT} [${rsState}]`);
    return;
  }

  const bin = findMongodBinary();
  if (!bin) {
    console.error(
      'No local mongod binary found. Install MongoDB Community Server, start Docker compose.yaml, or set MONGODB_URI in .env.'
    );
    process.exit(1);
  }

  fs.mkdirSync(dbPath, { recursive: true });
  const out = fs.openSync(logPath, 'a');
  const child = spawn(
    bin,
    [
      '--dbpath',
      dbPath,
      '--port',
      String(PORT),
      '--bind_ip',
      HOST,
      '--replSet',
      'rs0',
    ],
    {
      detached: true,
      stdio: ['ignore', out, out],
    }
  );
  child.unref();
  fs.writeFileSync(pidPath, String(child.pid), 'utf8');

  let ready = false;
  for (let i = 0; i < 30; i += 1) {
    if (await isPortOpen(HOST, PORT)) {
      ready = true;
      break;
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  if (!ready) {
    console.error(`mongod failed to listen on ${HOST}:${PORT}. Check ${logPath}`);
    process.exit(1);
  }

  const rsState = await initReplicaSetIfNeeded();
  console.log(`Started local mongod (PID ${child.pid}) at ${dbPath} [rs0: ${rsState}]`);
}

async function status() {
  const open = await isPortOpen(HOST, PORT);
  const pid = fs.existsSync(pidPath) ? fs.readFileSync(pidPath, 'utf8').trim() : null;
  console.log(JSON.stringify({ listening: open, host: HOST, port: PORT, pid, dbPath }));
}

function stop() {
  if (!fs.existsSync(pidPath)) {
    console.log('No managed mongod PID file found.');
    return;
  }
  const pid = Number(fs.readFileSync(pidPath, 'utf8').trim());
  if (!Number.isNaN(pid) && pid > 0) {
    try {
      process.kill(pid);
      console.log(`Stopped managed mongod PID ${pid}`);
    } catch (err) {
      console.log(`Could not stop PID ${pid}: ${err.message}`);
    }
  }
  fs.rmSync(pidPath, { force: true });
}

const cmd = process.argv[2] || 'start';
if (cmd === 'start') await start();
else if (cmd === 'status') await status();
else if (cmd === 'stop') stop();
else {
  console.error(`Unknown command: ${cmd}`);
  process.exit(1);
}
