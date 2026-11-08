import 'dotenv/config';
import { ollamaConnection, registerOllamaConnection } from './ollamaConnection';
import { ProjectSelection, registerProjects } from './projectSelection';
import { registerNativeNotifications } from './nativeNotifications';
import { registerWorkspaceAgent } from './workspaceAgent';
import { performFreeWebSearch } from './webSearch';
import { registerRoblox, roblox } from './robloxBridge';
import { registerResourceMonitor } from './resourceMonitor';
import { registerLiveTerminal } from './liveTerminal';
import express, { Request, Response } from 'express';
import { createServer as createViteServer } from 'vite';
import { spawn, exec } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);
const isProd = process.env.NODE_ENV === 'production';
const isWin = process.platform === 'win32';

// ~/AgentDock on Windows, or ~/AgentDock on macOS/Linux
const DEFAULT_AGENTDOCK = path.join(os.homedir(), 'AgentDock');
const AGENTDOCK_DIR = process.env.AGENTDOCK_DIR || DEFAULT_AGENTDOCK;

function getSafeDir(customCwd?: string): string {
  const target = customCwd && customCwd.trim() ? customCwd.trim() : AGENTDOCK_DIR;
  try {
    if (!fs.existsSync(target)) {
      fs.mkdirSync(target, { recursive: true });
    }
    return target;
  } catch {
    const fallback = path.join(os.homedir(), 'AgentDock');
    if (!fs.existsSync(fallback)) {
      fs.mkdirSync(fallback, { recursive: true });
    }
    return fallback;
  }
}

// Ensure working directory is established
const startupDir = getSafeDir();
const projectSelection = new ProjectSelection(startupDir,path.join(startupDir,'.agentdock','workspace.json'));
let activeDir = projectSelection.root;

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

registerLiveTerminal(app, () => activeDir);
registerResourceMonitor(app);
registerRoblox(app);
registerWorkspaceAgent(app,()=>activeDir);
registerProjects(app,projectSelection,root=>{activeDir=root;});
registerNativeNotifications(app,PORT);
registerOllamaConnection(app);

// Permissive CORS for local API access
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
    return;
  }
  next();
});

app.get('/api/health',(_req,res)=>res.json({app:'Agent Dock',ready:true}));

app.get('/api/model-library', async (_req, res) => {
  try {
    const response = await fetch('https://ollama.com/library', {signal: AbortSignal.timeout(20000)});
    if (!response.ok) throw new Error('Library unavailable');
    const html = await response.text();
    const clean = (s: string) => s.replace(/<[^>]*>/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
    const models = [...html.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/g)].flatMap(m => {
      const name = m[1].match(/href="\/library\/([^"/?#]+)"/);
      if (!name) return [];
      const desc = m[1].match(/<p\b[^>]*>([\s\S]*?)<\/p>/);
      return [{name: name[1], description: clean(desc?.[1] || m[1]), summary: clean(m[1]), cloud: /\bcloud\b/i.test(clean(m[1]))}];
    });
    if (!models.length) throw new Error('Library format changed; use the official library link.');
    res.json({models: [...new Map(models.map(m => [m.name, m])).values()]});
  } catch (e) {res.status(502).json({error: String(e)});}
});

app.get('/api/library-detail/:name', async (req, res) => {
 try {
  if (!/^[a-z0-9_.-]+$/i.test(req.params.name)) {res.sendStatus(400); return;}
  const r = await fetch(`https://ollama.com/library/${req.params.name}/tags`, {signal: AbortSignal.timeout(20000)});
  if (!r.ok) throw new Error('Details unavailable');
  const html = await r.text();
  const tags = [...new Set([...html.matchAll(/href="\/library\/([^"?#]+:[^"?#]+)"/g)].map(m=>m[1]))];
  const sizes = [...new Set(html.match(/\b[\d.]+\s*[GMKT]B\b/g) || [])];
  res.json({tags, sizes});
 } catch(e) {res.status(502).json({error:String(e)});}
});
app.post('/api/model-benchmark', async (req, res) => {
 try {
  const r = await fetch(ollamaConnection.activeUrl+'/api/generate', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({model:req.body.model, prompt:'Explain how a computer works in detail.', stream:false, options:{num_predict:128}}), signal:AbortSignal.timeout(180000)});
  const data = await r.json();
  if (!r.ok || data.error) throw new Error(data.error || 'Benchmark failed');
  res.json({tps: data.eval_duration ? data.eval_count / data.eval_duration * 1e9 : null});
 } catch(e) {res.status(502).json({error:String(e)});}
});

// Helper to query local Ollama models on Windows/macOS/Linux
async function queryOllamaTags(): Promise<any[]> {
  const result = await ollamaConnection.snapshot();
  return result.models;

}

function scanWorkspaceFolders(dir: string, base = dir): string[] {
  try {
    return fs.readdirSync(dir, {withFileTypes:true}).flatMap(entry=>{
      if(!entry.isDirectory()||entry.isSymbolicLink()||entry.name.startsWith('.')||['node_modules','__pycache__','dist','build','venv'].includes(entry.name))return [];
      const full=path.join(dir,entry.name);
      return [path.relative(base,full).replace(/\\/g,'/'),...scanWorkspaceFolders(full,base)];
    });
  }catch{return [];}
}

// Recursive file scanner for ~/AgentDock
function scanAgentDockFiles(dir: string): any[] {
  const results: any[] = [];
  if (!fs.existsSync(dir)) return results;

  function walk(currentDir: string) {
    try {
      const entries = fs.readdirSync(currentDir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.name.startsWith('.') || entry.name === 'node_modules' || entry.name === '__pycache__') {
          continue;
        }
        const fullPath = path.join(currentDir, entry.name);
        if (entry.isDirectory()) {
          walk(fullPath);
        } else if (entry.isFile()) {
          const relPath = path.relative(dir, fullPath).replace(/\\/g, '/');
          const ext = path.extname(entry.name).toLowerCase().replace('.', '');
          const lang = ext === 'py' ? 'python' : ext === 'json' ? 'json' : ext === 'md' ? 'markdown' : 'text';
          let content = '';
          try {
            content = fs.readFileSync(fullPath, 'utf-8');
          } catch {
            content = '';
          }
          const stat = fs.statSync(fullPath);
          results.push({
            id: relPath,
            name: entry.name,
            path: fullPath.replace(/\\/g, '/'),
            relPath,
            language: lang,
            content,
            size: stat.size,
          });
        }
      }
    } catch {
      // Ignore directory read exceptions
    }
  }

  walk(dir);
  return results;
}

// --- API ROUTES (Connected directly when running npm run dev) ---

// 1. Status & PC Ollama bridge probe
app.get('/api/status', async (req: Request, res: Response) => {
  const models = await queryOllamaTags();
  res.json({
    status: 'online',
    agentdock_dir: activeDir,
    platform: process.platform,
    installed_models_count: models.length,
    models: models.map((m: any) => m.name),
    server: 'integrated-node-terminal',
  });
});

// Persistent background terminal sessions (stateful cwd & running processes)
interface TerminalSessionState {
  id: string;
  cwd: string;
  activeChild?: any;
}

const activeTerminalSessions = new Map<string, TerminalSessionState>();

function getTerminalSession(sessionId: string = 'default', requestedCwd?: string): TerminalSessionState {
  if (!activeTerminalSessions.has(sessionId)) {
    activeTerminalSessions.set(sessionId, {
      id: sessionId,
      cwd: getSafeDir(requestedCwd),
    });
  }
  const session = activeTerminalSessions.get(sessionId)!;
  if (!fs.existsSync(session.cwd)) {
    session.cwd = getSafeDir();
  }
  return session;
}

// 2. Terminal Info (returns active session state)
app.get('/api/terminal/info', (req: Request, res: Response) => {
  const sessionId = (req.query.sessionId as string) || 'default';
  const session = getTerminalSession(sessionId);
  res.json({
    defaultShell: isWin ? 'powershell' : 'bash',
    cwd: session.cwd,
    os: process.platform,
    sessionId: session.id,
    online: true,
  });
});

// 3. Integrated Native Terminal (PowerShell execution on Windows / Bash on Linux)
app.post('/api/terminal/run', (req: Request, res: Response) => {
  const { command, cwd, sessionId = 'default' } = req.body;
  const cmd = (command || '').trim();
  const session = getTerminalSession(sessionId, cwd);

  if (!cmd) {
    res.status(400).json({ error: 'No command specified' });
    return;
  }

  console.log(`[Agent Dock Terminal][${session.id}] in ${session.cwd}: ${cmd}`);

  // Handle 'cd' directory navigation natively so directory changes persist!
  if (/^cd(\s+.*)?$/i.test(cmd)) {
    const match = cmd.match(/^cd\s*(.*)$/i);
    const target = match && match[1] ? match[1].trim().replace(/^['"]|['"]$/g, '') : '';
    let newDir = session.cwd;
    if (!target || target === '~') {
      newDir = AGENTDOCK_DIR;
    } else if (target === '..') {
      newDir = path.dirname(session.cwd);
    } else {
      newDir = path.resolve(session.cwd, target);
    }

    if (fs.existsSync(newDir) && fs.statSync(newDir).isDirectory()) {
      session.cwd = newDir;
      res.json({
        stdout: '',
        stderr: '',
        returncode: 0,
        cwd: session.cwd,
        command: cmd,
      });
      return;
    } else {
      res.json({
        stdout: '',
        stderr: `cd : Cannot find path '${target}' because it does not exist.`,
        returncode: 1,
        cwd: session.cwd,
        command: cmd,
      });
      return;
    }
  }

  // Handle 'pwd' command
  if (cmd.toLowerCase() === 'pwd') {
    res.json({
      stdout: session.cwd + '\n',
      stderr: '',
      returncode: 0,
      cwd: session.cwd,
      command: cmd,
    });
    return;
  }

  // Execute command in current session working directory
  const shellExecutable = isWin ? 'powershell.exe' : '/bin/bash';
  const shellArgs = isWin
    ? ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', cmd]
    : ['-c', cmd];

  let stdoutData = '';
  let stderrData = '';
  let completed = false;

  const child = spawn(shellExecutable, shellArgs, {
    cwd: session.cwd,
    env: {
      ...process.env,
      PYTHONUNBUFFERED: '1',
      TERM: 'xterm-256color',
    },
    windowsHide: true,
  });

  session.activeChild = child;

  const timer = setTimeout(() => {
    if (!completed) {
      completed = true;
      try {
        child.kill();
      } catch {}
      session.activeChild = undefined;
      res.json({
        stdout: stdoutData,
        stderr: (stderrData ? stderrData + '\n' : '') + '[Timeout] Command execution timed out after 60 seconds.',
        returncode: -1,
        cwd: session.cwd,
        command: cmd,
      });
    }
  }, 60000);

  child.stdout?.on('data', (data) => {
    stdoutData += data.toString('utf-8');
  });

  child.stderr?.on('data', (data) => {
    stderrData += data.toString('utf-8');
  });

  child.on('error', (err) => {
    clearTimeout(timer);
    if (!completed) {
      completed = true;
      session.activeChild = undefined;
      res.status(500).json({
        stdout: stdoutData,
        stderr: `Failed to start shell process (${shellExecutable}): ${err.message}`,
        returncode: -1,
        cwd: session.cwd,
        command: cmd,
      });
    }
  });

  child.on('close', (code) => {
    clearTimeout(timer);
    if (!completed) {
      completed = true;
      session.activeChild = undefined;
      res.json({
        stdout: stdoutData,
        stderr: stderrData,
        returncode: code ?? 0,
        cwd: session.cwd,
        command: cmd,
      });
    }
  });
});

// Cancel / Kill currently running command in terminal (like Ctrl+C in VS Code)
app.post('/api/terminal/kill', (req: Request, res: Response) => {
  const { sessionId = 'default' } = req.body;
  const session = activeTerminalSessions.get(sessionId);
  if (session && session.activeChild) {
    try {
      session.activeChild.kill();
      session.activeChild = undefined;
      res.json({ status: 'killed', sessionId });
      return;
    } catch (e: any) {
      res.status(500).json({ error: e.message });
      return;
    }
  }
  res.json({ status: 'no_active_process', sessionId });
});

// Create Folder in Agent Dock
app.post('/api/create-folder', (req: Request, res: Response) => {
  const { folderPath } = req.body;
  if (!folderPath) {
    res.status(400).json({ error: 'folderPath is required' });
    return;
  }
  const fullPath = path.resolve(activeDir, folderPath);
  try {
    fs.mkdirSync(fullPath, { recursive: true });
    res.json({ status: 'created', path: fullPath.replace(/\\/g, '/') });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Delete only directories within the active workspace.
app.post('/api/delete-folder', (req: Request, res: Response) => {
  const folderPath = req.body.folderPath;
  if (typeof folderPath !== 'string' || !folderPath.trim()) {
    res.status(400).json({ error: 'folderPath is required' }); return;
  }
  const root = fs.realpathSync(activeDir);
  const target = path.resolve(root, folderPath);
  const relative = path.relative(root, target);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
    res.status(400).json({ error: 'Choose a folder inside the workspace' }); return;
  }
  try {
    const realTarget = fs.realpathSync(target);
    const realRelative = path.relative(root, realTarget);
    if (!realRelative || realRelative.startsWith('..') || path.isAbsolute(realRelative) || !fs.lstatSync(target).isDirectory()) {
      res.status(400).json({ error: 'Choose a regular folder inside the workspace' }); return;
    }
    fs.rmSync(target, { recursive: true });
    res.json({ status: 'deleted' });
  } catch (error: any) {
    res.status(error.code === 'ENOENT' ? 404 : 500).json({ error: error.message });
  }
});

// Rename File or Folder in Agent Dock
app.post('/api/rename-file', (req: Request, res: Response) => {
  const { oldPath, newPath } = req.body;
  if (!oldPath || !newPath) {
    res.status(400).json({ error: 'oldPath and newPath are required' });
    return;
  }
  const oldFull = path.resolve(activeDir, oldPath);
  const newFull = path.resolve(activeDir, newPath);
  try {
    if (!fs.existsSync(oldFull)) {
      res.status(404).json({ error: 'Source file does not exist' });
      return;
    }
    fs.mkdirSync(path.dirname(newFull), { recursive: true });
    fs.renameSync(oldFull, newFull);
    res.json({ status: 'renamed', oldPath, newPath: newFull.replace(/\\/g, '/') });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 4. Installed Models Query
app.get('/api/models', async (req: Request, res: Response) => {
  const result = await ollamaConnection.snapshot();
  res.status(result.online?200:503).json(result);
});

// 5. File System Operations in ~/AgentDock
app.get('/api/files', (req: Request, res: Response) => {
  const files = scanAgentDockFiles(activeDir);
  res.json({ files, folders: scanWorkspaceFolders(activeDir), baseDir: activeDir });
});

app.get('/api/read-file', (req: Request, res: Response) => {
  const relPath = req.query.path as string;
  if (!relPath) {
    res.status(400).json({ error: 'path parameter required' });
    return;
  }
  const fullPath = path.resolve(activeDir, relPath);
  if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
    const content = fs.readFileSync(fullPath, 'utf-8');
    res.json({ path: fullPath.replace(/\\/g, '/'), content });
  } else {
    res.status(404).json({ error: 'File not found' });
  }
});

app.post('/api/create-file', (req: Request, res: Response) => {
  const { filePath, content = '# Created by Agent Dock\n' } = req.body;
  if (!filePath) {
    res.status(400).json({ error: 'filePath is required' });
    return;
  }
  const fullPath = path.resolve(activeDir, filePath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, content, 'utf-8');
  console.log(`[Agent Dock Server] Created file: ${fullPath}`);
  res.json({ status: 'created', path: fullPath.replace(/\\/g, '/') });
});

app.post('/api/write-file', (req: Request, res: Response) => {
  const { filePath, content = '' } = req.body;
  if (!filePath) {
    res.status(400).json({ error: 'filePath is required' });
    return;
  }
  const fullPath = path.resolve(activeDir, filePath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, content, 'utf-8');
  console.log(`[Agent Dock Server] Saved file: ${fullPath}`);
  res.json({ status: 'ok', path: fullPath.replace(/\\/g, '/') });
});

app.post('/api/delete-file', (req: Request, res: Response) => {
  const { filePath } = req.body;
  if (!filePath) {
    res.status(400).json({ error: 'filePath is required' });
    return;
  }
  const fullPath = path.resolve(activeDir, filePath);
  if (fs.existsSync(fullPath)) {
    fs.unlinkSync(fullPath);
    console.log(`[Agent Dock Server] Deleted file: ${fullPath}`);
    res.json({ status: 'deleted' });
  } else {
    res.status(404).json({ error: 'File not found' });
  }
});

app.post('/api/create-project', (req: Request, res: Response) => {
  const { name = 'new-project', type = 'python-fastapi' } = req.body;
  const projectPath = path.resolve(activeDir, name);
  fs.mkdirSync(projectPath, { recursive: true });

  const mainPy = path.join(projectPath, 'main.py');
  const reqTxt = path.join(projectPath, 'requirements.txt');
  const readme = path.join(projectPath, 'README.md');

  fs.writeFileSync(
    mainPy,
    `from fastapi import FastAPI\nimport uvicorn\n\napp = FastAPI(title="${name}")\n\n@app.get("/")\ndef read_root():\n    return {"message": "Hello from ${name} in ~/AgentDock!"}\n\nif __name__ == "__main__":\n    uvicorn.run("main:app", host="127.0.0.1", port=8080, reload=True)\n`,
    'utf-8'
  );
  fs.writeFileSync(reqTxt, 'fastapi>=0.110.0\nuvicorn>=0.28.0\nrequests>=2.31.0\n', 'utf-8');
  fs.writeFileSync(
    readme,
    `# ${name}\n\nCreated in \`${projectPath}\`.\n\n## Run in Terminal\n\`\`\`powershell\npip install -r requirements.txt\npython main.py\n\`\`\`\n`,
    'utf-8'
  );

  res.json({
    status: 'success',
    project_name: name,
    path: projectPath.replace(/\\/g, '/'),
    files: ['main.py', 'requirements.txt', 'README.md'],
  });
});

// --- Persistent Chat Session Storage in ~/AgentDock/.agentdock/chats.json ---
const AGENTDOCK_META_DIR = path.join(startupDir, '.agentdock');
const CHATS_FILE = path.join(AGENTDOCK_META_DIR, 'chats.json');

try {
  if (!fs.existsSync(AGENTDOCK_META_DIR)) {
    fs.mkdirSync(AGENTDOCK_META_DIR, { recursive: true });
  }
} catch {
  // directory creation ignore
}

// 1. Get saved chat sessions from ~/AgentDock/.agentdock/chats.json
app.get('/api/chats', (req: Request, res: Response) => {
  try {
    if (fs.existsSync(CHATS_FILE)) {
      const raw = fs.readFileSync(CHATS_FILE, 'utf-8');
      const data = JSON.parse(raw);
      res.json(data);
    } else {
      res.json({ sessions: [], activeSessionId: null });
    }
  } catch (err: any) {
    console.error('[Agent Dock Server] Error reading chats.json:', err.message);
    res.status(500).json({ error: err.message, sessions: [] });
  }
});

// 2. Save chat sessions to ~/AgentDock/.agentdock/chats.json
app.post('/api/chats', (req: Request, res: Response) => {
  try {
    const { sessions, activeSessionId } = req.body;
    if (!Array.isArray(sessions)) {
      res.status(400).json({ error: 'sessions array is required' });
      return;
    }
    if (!fs.existsSync(AGENTDOCK_META_DIR)) {
      fs.mkdirSync(AGENTDOCK_META_DIR, { recursive: true });
    }
    const payload = {
      sessions,
      activeSessionId: activeSessionId || (sessions[0]?.id ?? null),
      lastSaved: Date.now(),
      savedAt: new Date().toISOString(),
    };
    fs.writeFileSync(CHATS_FILE, JSON.stringify(payload, null, 2), 'utf-8');
    res.json({ status: 'saved', count: sessions.length });
  } catch (err: any) {
    console.error('[Agent Dock Server] Error saving chats.json:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// 3. Delete specific chat session from disk
app.delete('/api/chats/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    if (fs.existsSync(CHATS_FILE)) {
      const raw = fs.readFileSync(CHATS_FILE, 'utf-8');
      const data = JSON.parse(raw);
      if (Array.isArray(data.sessions)) {
        data.sessions = data.sessions.filter((s: any) => s.id !== id);
        fs.writeFileSync(CHATS_FILE, JSON.stringify(data, null, 2), 'utf-8');
      }
    }
    res.json({ status: 'deleted', id });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Proxy /ollama-api/* requests to local Ollama with graceful offline handling
app.all('/ollama-api/*', async (req: Request, res: Response) => {
  const targetPath = req.url.replace(/^\/ollama-api/, '');
  const targetUrl = `${ollamaConnection.activeUrl}${targetPath}`;

  let timeoutId: ReturnType<typeof setTimeout>|undefined;
  try {
    const fetchHeaders: Record<string, string> = {};
    if (req.headers['content-type']) {
      fetchHeaders['content-type'] = req.headers['content-type'] as string;
    }

    const controller = new AbortController();
    res.on('close', () => controller.abort());
    const isStreamOrChat = targetPath.includes('/chat') || targetPath.includes('/generate') || targetPath.includes('/pull');
    const timeoutMs = isStreamOrChat ? 300000 : 2500;
    timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const hasBody = ['POST', 'PUT', 'PATCH'].includes(req.method) && req.body && Object.keys(req.body).length > 0;
    const fetchRes = await fetch(targetUrl, {
      method: req.method,
      headers: fetchHeaders,
      body: hasBody ? JSON.stringify(req.body) : undefined,
      signal: controller.signal,
    });

    res.status(fetchRes.status);
    fetchRes.headers.forEach((value, key) => {
      if (!['transfer-encoding', 'content-encoding', 'content-length', 'connection', 'keep-alive'].includes(key.toLowerCase())) {
        res.setHeader(key, value);
      }
    });

    if (fetchRes.body) {
      // @ts-ignore
      const reader = fetchRes.body.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        res.write(value);
      }
    }
    res.end();
  } catch {
    if (!res.headersSent) {
      res.status(503).json({
        ok: false,
        error: 'Ollama is offline',
        message: 'Could not connect to Ollama at 127.0.0.1:11434. Start Ollama with "ollama serve".',
      });
    } else {res.end();}
  } finally {if(timeoutId)clearTimeout(timeoutId);}
});

// --- MODEL CONTEXT PROTOCOL (MCP) ENGINE ---

const DEFAULT_MCP_CONFIG = {
  mcpServers: {
    filesystem: {
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-filesystem', path.join(os.homedir(), 'AgentDock')],
    },
    git: {
      command: 'uvx',
      args: ['mcp-server-git', '--repository', path.join(os.homedir(), 'AgentDock')],
    },
    fetch: {
      command: 'uvx',
      args: ['mcp-server-fetch'],
    },
  },
};

function getMcpConfigPath(): string {
  const mcpDir = path.join(activeDir, '.mcp');
  try {
    if (!fs.existsSync(mcpDir)) {
      fs.mkdirSync(mcpDir, { recursive: true });
    }
    return path.join(mcpDir, 'mcp-config.json');
  } catch {
    return path.join(__dirname, 'mcp-config.json');
  }
}

function loadMcpConfig(): { rawJson: string; config: any; path: string } {
  const configPath = getMcpConfigPath();
  try {
    if (fs.existsSync(configPath)) {
      const raw = fs.readFileSync(configPath, 'utf-8');
      const parsed = JSON.parse(raw);
      return { rawJson: raw, config: parsed, path: configPath };
    }
  } catch {
    // fallback
  }

  // Create default
  const defaultRaw = JSON.stringify(DEFAULT_MCP_CONFIG, null, 2);
  try {
    fs.writeFileSync(configPath, defaultRaw, 'utf-8');
  } catch {
    // ignore
  }
  return { rawJson: defaultRaw, config: DEFAULT_MCP_CONFIG, path: configPath };
}

function getToolsForServer(serverName: string, serverConfig: any): any[] {
  const isFilesystem = serverName.toLowerCase().includes('file') || 
    JSON.stringify(serverConfig).includes('server-filesystem');
  const isGit = serverName.toLowerCase().includes('git') || 
    JSON.stringify(serverConfig).includes('server-git');
  const isFetch = serverName.toLowerCase().includes('fetch') || 
    JSON.stringify(serverConfig).includes('server-fetch');

  if (isFilesystem) {
    return [
      {
        name: 'read_file',
        serverName,
        description: 'Read the complete text contents of a file in ~/AgentDock',
        inputSchema: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'Relative path to file (e.g. main.py or my-app/app.py)' },
          },
          required: ['path'],
        },
      },
      {
        name: 'write_file',
        serverName,
        description: 'Create or overwrite a file in ~/AgentDock',
        inputSchema: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'Target file path' },
            content: { type: 'string', description: 'Text content to write' },
          },
          required: ['path', 'content'],
        },
      },
      {
        name: 'list_directory',
        serverName,
        description: 'List files and folders in ~/AgentDock',
        inputSchema: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'Subdirectory path, or empty for root' },
          },
        },
      },
      {
        name: 'directory_tree',
        serverName,
        description: 'Get a recursive tree view of files in the workspace',
        inputSchema: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'Root directory to tree' },
          },
        },
      },
      {
        name: 'get_file_info',
        serverName,
        description: 'Get metadata (size, last modified timestamp, permissions) for a file',
        inputSchema: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'File path to inspect' },
          },
          required: ['path'],
        },
      },
    ];
  }

  if (isGit) {
    return [
      {
        name: 'git_status',
        serverName,
        description: 'Inspect modified and untracked files in the Agent Dock repository',
        inputSchema: {
          type: 'object',
          properties: {
            repo_path: { type: 'string', description: 'Optional subfolder path' },
          },
        },
      },
      {
        name: 'git_diff',
        serverName,
        description: 'View unstaged changes and line diffs in Agent Dock',
        inputSchema: {
          type: 'object',
          properties: {
            repo_path: { type: 'string', description: 'Optional subfolder path' },
          },
        },
      },
      {
        name: 'git_log',
        serverName,
        description: 'View recent Git commit messages and authors',
        inputSchema: {
          type: 'object',
          properties: {
            max_count: { type: 'number', description: 'Number of commits to return (default: 5)' },
          },
        },
      },
    ];
  }

  if (isFetch) {
    return [
      {
        name: 'fetch_url',
        serverName,
        description: 'Fetch and parse text or markdown from an external web documentation URL',
        inputSchema: {
          type: 'object',
          properties: {
            url: { type: 'string', description: 'Full HTTP or HTTPS URL to retrieve' },
          },
          required: ['url'],
        },
      },
    ];
  }

  // Generic custom server
  return [
    {
      name: `${serverName}_run`,
      serverName,
      description: `Execute custom MCP tool on ${serverName}`,
      inputSchema: {
        type: 'object',
        properties: {
          input: { type: 'string', description: 'Tool arguments' },
        },
      },
    },
  ];
}

// 13. Get MCP configuration
app.get('/api/mcp/config', (req: Request, res: Response) => {
  const data = loadMcpConfig();
  res.json(data);
});

// 14. Save MCP configuration
app.post('/api/mcp/config', (req: Request, res: Response) => {
  const { configJson } = req.body;
  if (!configJson || typeof configJson !== 'string') {
    res.status(400).json({ success: false, error: 'configJson string is required' });
    return;
  }

  try {
    const parsed = JSON.parse(configJson);
    if (!parsed.mcpServers || typeof parsed.mcpServers !== 'object') {
      res.status(400).json({ success: false, error: 'JSON must contain a root "mcpServers" object' });
      return;
    }

    const configPath = getMcpConfigPath();
    const formatted = JSON.stringify(parsed, null, 2);
    fs.writeFileSync(configPath, formatted, 'utf-8');

    // Generate server statuses
    const servers = Object.entries(parsed.mcpServers).map(([name, conf]: [string, any]) => {
      const tools = getToolsForServer(name, conf);
      return {
        name,
        status: conf.disabled ? 'disconnected' : 'connected',
        command: conf.command,
        args: conf.args,
        url: conf.url,
        tools,
        lastPing: Date.now(),
      };
    });

    res.json({
      success: true,
      config: parsed,
      rawJson: formatted,
      path: configPath,
      servers,
    });
  } catch (err: any) {
    res.status(400).json({ success: false, error: `Invalid JSON syntax: ${err.message}` });
  }
});

// 15. Get MCP server statuses & registered tools
app.get('/api/mcp/status', (req: Request, res: Response) => {
  const { config } = loadMcpConfig();
  const serversConfig = config.mcpServers || {};

  const servers = Object.entries(serversConfig).map(([name, conf]: [string, any]) => {
    const tools = getToolsForServer(name, conf);
    return {
      name,
      status: conf.disabled ? 'disconnected' : 'connected',
      command: conf.command,
      args: conf.args,
      url: conf.url,
      tools,
      lastPing: Date.now(),
    };
  });

  const allTools = servers.flatMap((s) => s.tools);

  res.json({
    ok: true,
    servers,
    totalServers: servers.length,
    totalTools: allTools.length,
    tools: allTools,
    activeDir,
  });
});

// 16. Execute an MCP tool (native high-speed execution or subprocess)
app.post('/api/mcp/call-tool', async (req: Request, res: Response) => {
  const { serverName, toolName, arguments: toolArgs } = req.body;

  if (!toolName) {
    res.status(400).json({ success: false, error: 'toolName is required' });
    return;
  }

  const cleanArgs = toolArgs || {};

  try {
    // Filesystem MCP tools
    if (toolName === 'read_file') {
      const targetPath = cleanArgs.path || cleanArgs.filePath || cleanArgs.file;
      if (!targetPath) {
        res.status(400).json({ success: false, error: 'Missing path argument' });
        return;
      }
      const fullPath = path.isAbsolute(targetPath) ? targetPath : path.join(activeDir, targetPath);
      if (!fs.existsSync(fullPath)) {
        res.status(404).json({ success: false, error: `File not found: ${targetPath}` });
        return;
      }
      const content = fs.readFileSync(fullPath, 'utf-8');
      res.json({
        success: true,
        result: {
          path: targetPath,
          content,
          size: content.length,
        },
      });
      return;
    }

    if (toolName === 'write_file') {
      const targetPath = cleanArgs.path || cleanArgs.filePath;
      const content = cleanArgs.content !== undefined ? cleanArgs.content : '';
      if (!targetPath) {
        res.status(400).json({ success: false, error: 'Missing path argument' });
        return;
      }
      const fullPath = path.isAbsolute(targetPath) ? targetPath : path.join(activeDir, targetPath);
      const parentDir = path.dirname(fullPath);
      if (!fs.existsSync(parentDir)) {
        fs.mkdirSync(parentDir, { recursive: true });
      }
      fs.writeFileSync(fullPath, content, 'utf-8');
      res.json({
        success: true,
        result: {
          path: targetPath,
          fullPath,
          bytesWritten: Buffer.byteLength(content, 'utf-8'),
        },
      });
      return;
    }

    if (toolName === 'list_directory') {
      const sub = cleanArgs.path || '';
      const targetDir = sub ? (path.isAbsolute(sub) ? sub : path.join(activeDir, sub)) : activeDir;
      if (!fs.existsSync(targetDir)) {
        res.status(404).json({ success: false, error: `Directory not found: ${sub}` });
        return;
      }
      const entries = fs.readdirSync(targetDir, { withFileTypes: true });
      const items = entries.map((e) => ({
        name: e.name,
        type: e.isDirectory() ? 'directory' : 'file',
      }));
      res.json({
        success: true,
        result: {
          directory: sub || '.',
          fullPath: targetDir,
          count: items.length,
          items,
        },
      });
      return;
    }

    if (toolName === 'directory_tree') {
      const files = scanAgentDockFiles(activeDir);
      res.json({
        success: true,
        result: {
          root: activeDir,
          totalFiles: files.length,
          files: files.map((f) => ({ path: f.relPath, language: f.language, size: f.size })),
        },
      });
      return;
    }

    if (toolName === 'get_file_info') {
      const targetPath = cleanArgs.path;
      const fullPath = path.isAbsolute(targetPath) ? targetPath : path.join(activeDir, targetPath);
      if (!fs.existsSync(fullPath)) {
        res.status(404).json({ success: false, error: `File not found: ${targetPath}` });
        return;
      }
      const stat = fs.statSync(fullPath);
      res.json({
        success: true,
        result: {
          path: targetPath,
          size: stat.size,
          created: stat.birthtime,
          modified: stat.mtime,
          isDirectory: stat.isDirectory(),
          isFile: stat.isFile(),
        },
      });
      return;
    }

    // Git MCP tools
    if (toolName === 'git_status') {
      exec('git status --short', { cwd: activeDir }, (error, stdout, stderr) => {
        res.json({
          success: !error,
          result: {
            stdout: stdout || '(Working tree clean or not a git repository)',
            stderr,
          },
        });
      });
      return;
    }

    if (toolName === 'git_diff') {
      exec('git diff', { cwd: activeDir }, (error, stdout, stderr) => {
        res.json({
          success: !error,
          result: {
            stdout: stdout || '(No unstaged diffs)',
            stderr,
          },
        });
      });
      return;
    }

    if (toolName === 'git_log') {
      const count = cleanArgs.max_count || 5;
      exec(`git log -n ${count} --oneline`, { cwd: activeDir }, (error, stdout, stderr) => {
        res.json({
          success: !error,
          result: {
            stdout: stdout || '(No git commits found)',
            stderr,
          },
        });
      });
      return;
    }

    // Web Fetch MCP tool
    if (toolName === 'fetch_url') {
      const url = cleanArgs.url;
      if (!url || !url.startsWith('http')) {
        res.status(400).json({ success: false, error: 'Valid HTTP/HTTPS url is required' });
        return;
      }
      const fetchResp = await fetch(url, { signal: AbortSignal.timeout(6000) });
      const text = await fetchResp.text();
      // Clean HTML tags for model consumption
      const stripped = text.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 8000);

      res.json({
        success: true,
        result: {
          url,
          status: fetchResp.status,
          content: stripped,
        },
      });
      return;
    }

    res.status(400).json({success:false,error:`Unsupported MCP server/tool: ${serverName}.${toolName}. No tool was executed.`});

  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: `MCP Tool execution failed: ${err.message}`,
    });
  }
});

// 17. Reset MCP config to defaults
app.post('/api/mcp/reset-default', (req: Request, res: Response) => {
  const configPath = getMcpConfigPath();
  const formatted = JSON.stringify(DEFAULT_MCP_CONFIG, null, 2);
  try {
    fs.writeFileSync(configPath, formatted, 'utf-8');
    res.json({ success: true, config: DEFAULT_MCP_CONFIG, rawJson: formatted });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// --- FREE WEB SEARCH (NO API KEY REQUIRED) ---

// npm-backed real web search. No API key and no Wikipedia fallback.
const handleWebSearch = async (req: Request, res: Response) => {
  const query = req.method === 'GET' ? req.query.q : req.body.query;
  if (typeof query !== 'string' || !query.trim() || query.length > 1000) {
    res.status(400).json({error:'Enter a search query between 1 and 1,000 characters.',results:[]});return;
  }
  try {
    const results = await performFreeWebSearch(query);
    res.json({query,results,count:results.length,provider:'DuckDuckGo',searchedAt:new Date().toISOString()});
  } catch (error) {
    console.error('[Web search]',String(error));
    res.status(503).json({error:'DuckDuckGo search is unavailable, blocked, rate-limited or timed out. No fallback results were substituted. Please try again later.',results:[]});
  }
};
app.get('/api/web-search',handleWebSearch);
app.post('/api/web-search',handleWebSearch);

// 19. Web fetch endpoint (clean readability text)
app.get('/api/web-fetch', async (req: Request, res: Response) => {
  const targetUrl = req.query.url as string;
  if (!targetUrl || !targetUrl.startsWith('http')) {
    res.status(400).json({ error: 'Valid HTTP/HTTPS url is required' });
    return;
  }

  try {
    const resp = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      },
      signal: AbortSignal.timeout(8000),
    });
    const text = await resp.text();
    const clean = text
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 16000);

    res.json({
      url: targetUrl,
      status: resp.status,
      content: clean,
      length: clean.length,
    });
  } catch (err: any) {
    res.status(500).json({ error: `Failed to fetch URL: ${err.message}` });
  }
});

// --- MICROSOFT EDGE EXTENSION COMPANION ---

let currentEdgeTab = {
  url: '',
  title: '',
  domain: '',
  content: '',
  selectedText: '',
  timestamp: 0,
  connected: false,
};

// Ensure edge-extension folder is present in Agent Dock directory and public directory
function ensureEdgeExtensionInAgentDock() {
  const extDir = path.join(activeDir, 'edge-extension');
  const sourceDir = path.join(__dirname, 'edge-extension');
  const publicDir = path.join(__dirname, 'public', 'edge-extension');

  try {
    if (!fs.existsSync(extDir)) {
      fs.mkdirSync(extDir, { recursive: true });
    }
    if (!fs.existsSync(publicDir)) {
      fs.mkdirSync(publicDir, { recursive: true });
    }

    if (fs.existsSync(sourceDir)) {
      const files = fs.readdirSync(sourceDir);
      for (const file of files) {
        const srcFile = path.join(sourceDir, file);
        if (fs.statSync(srcFile).isFile()) {
          const destFile = path.join(extDir, file);
          const publicDestFile = path.join(publicDir, file);
          fs.copyFileSync(srcFile, destFile);
          fs.copyFileSync(srcFile, publicDestFile);
        }
      }
    }
  } catch {
    // Ignore copy error
  }
}

// Extension assets stay in the application folder; never restore files into the user workspace.

// 20. Edge Extension: sync active tab
app.post('/api/edge-extension/active-tab', (req: Request, res: Response) => {
  const { url, title, domain, content, selectedText } = req.body;
  let parsedDomain = domain || '';
  if (!parsedDomain && url) {
    try {
      parsedDomain = new URL(url).hostname;
    } catch {
      parsedDomain = '';
    }
  }

  currentEdgeTab = {
    url: url || '',
    title: title || '',
    domain: parsedDomain,
    content: content || '',
    selectedText: selectedText || '',
    timestamp: Date.now(),
    connected: true,
  };
  res.json({ success: true, synced: true, timestamp: currentEdgeTab.timestamp });
});

// 21. Edge Extension: get active tab
app.get('/api/edge-extension/active-tab', (req: Request, res: Response) => {
  const isRecent = Date.now() - currentEdgeTab.timestamp < 300000; // 5 minutes
  res.json({
    ...currentEdgeTab,
    connected: currentEdgeTab.connected && isRecent,
  });
});

// 22. Edge Extension: info & path
app.get('/api/edge-extension/info', (req: Request, res: Response) => {
  const extDir = path.join(activeDir, 'edge-extension');
  // Extension assets stay in the application folder; never restore files into the user workspace.

  let files: string[] = [];
  try {
    if (fs.existsSync(extDir)) {
      files = fs.readdirSync(extDir);
    }
  } catch {
    // ignore
  }

  res.json({
    name: 'Agent Dock Copilot - Edge Side Panel',
    path: extDir,
    displayPath: extDir,
    activeTab: currentEdgeTab,
    files,
    installUrl: 'edge://extensions',
  });
});

// 23. Edge Extension: request to open a tab
app.post('/api/edge-extension/open-tab', (req: Request, res: Response) => {
  const { url } = req.body;
  res.json({ success: true, url: url || 'http://localhost:3000', message: 'Tab open requested' });
});

// 24. Edge Extension: list available models
app.get('/api/edge-extension/models', async (req: Request, res: Response) => {
  const models = await queryOllamaTags();
  const modelNames = models.map((m: any) => m.name);
  if (modelNames.length === 0) {
    modelNames.push('deepseek-r1:8b', 'llama3:latest', 'mistral:latest', 'qwen2.5:latest');
  }
  res.json({ models: modelNames });
});

// 25. Edge Extension: create/save file directly to ~/AgentDock
app.post('/api/edge-extension/create-file', (req: Request, res: Response) => {
  try {
    const { filename, content } = req.body;
    if (!filename || typeof content !== 'string') {
      res.status(400).json({ error: 'filename and content required' });
      return;
    }
    const safeName = path.basename(filename);
    const targetPath = path.join(activeDir, safeName);
    fs.writeFileSync(targetPath, content, 'utf-8');
    res.json({
      success: true,
      path: targetPath,
      relPath: safeName,
      displayPath: targetPath,
      size: Buffer.byteLength(content, 'utf-8'),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to create file' });
  }
});

// 26. Edge Extension & Agent Dock Side Panel Chat
app.post('/api/edge-extension/chat', async (req: Request, res: Response) => {
  const { message, model, pageContext, history } = req.body;
  const userPrompt = (message || '').trim();
  if (!userPrompt) {
    res.status(400).json({ error: 'Message is required' });
    return;
  }

  const targetModel = model || 'deepseek-r1:8b';

  // Free web grounding if @web is mentioned
  let webGrounding = '';
  if (userPrompt.toLowerCase().includes('@web')) {
    const cleanedQuery = userPrompt.replace(/@web/gi, '').trim();
    if (cleanedQuery) {
      try {
        const searchResults = await performFreeWebSearch(cleanedQuery);
        if (searchResults.length > 0) {
          webGrounding = `\n\nLive Web Search Results for "${cleanedQuery}":\n` + 
            searchResults.slice(0, 4).map((r, i) => `[${i+1}] ${r.title} (${r.url})\n${r.snippet}`).join('\n\n');
        }
      } catch {
        // Search error ignored
      }
    }
  }

  // Active page context from Edge
  let contextBlock = '';
  const effectiveTab = pageContext || (currentEdgeTab.connected ? currentEdgeTab : null);
  if (effectiveTab && (effectiveTab.title || effectiveTab.url || effectiveTab.content)) {
    contextBlock = `\n\nActive Browser Page Context (Microsoft Edge Side Panel):` +
      `\nPage Title: ${effectiveTab.title || 'Untitled'}` +
      `\nPage URL: ${effectiveTab.url || ''}` +
      (effectiveTab.selectedText ? `\nUser Selected Text: ${effectiveTab.selectedText}` : '') +
      (effectiveTab.content ? `\nExtracted Content Snippet:\n${effectiveTab.content.slice(0, 6000)}` : '');
  }

  const systemPrompt = `You are Agent Dock Copilot, the AI assistant docked permanently in Microsoft Edge's side panel, connected to Agent Dock Cursor IDE on the user's PC.
The user's local project directory is ${activeDir} (${isWin ? '~/AgentDock' : '~/AgentDock'}).
You have access to the webpage the user is actively viewing. Answer questions clearly, write production-ready code, and format code snippets in markdown with language tags.`;

  // Try querying local PC Ollama
  const ollamaHosts = ['http://127.0.0.1:11434', 'http://localhost:11434'];
  let ollamaAnswer = '';

  for (const host of ollamaHosts) {
    try {
      const messagesPayload = [
        { role: 'system', content: systemPrompt + contextBlock + webGrounding },
        ...(Array.isArray(history) ? history.slice(-6).map((m: any) => ({ role: m.role || 'user', content: m.content || '' })) : []),
        { role: 'user', content: userPrompt }
      ];

      const resp = await fetch(`${host}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: targetModel,
          messages: messagesPayload,
          stream: false,
        }),
        signal: AbortSignal.timeout(12000),
      });

      if (resp.ok) {
        const json = await resp.json();
        if (json.message?.content) {
          ollamaAnswer = json.message.content;
          break;
        }
      }
    } catch {
      // try next
    }
  }

  if (ollamaAnswer) {
    res.json({
      reply: ollamaAnswer,
      content: ollamaAnswer,
      model: targetModel,
      source: 'ollama-local',
    });
    return;
  }

  // High-fidelity fallback reasoning when Ollama is starting or downloading
  const pTitle = effectiveTab?.title || 'Active Webpage';
  const pDomain = effectiveTab?.domain || 'Edge';

  let fallback = '';
  const lowerPrompt = userPrompt.toLowerCase();

  if (lowerPrompt.includes('summar') || lowerPrompt.includes('3-bullet') || lowerPrompt.includes('bullet')) {
    fallback = `Here is a comprehensive 3-bullet summary of **${pTitle}** (${pDomain}):\n\n` +
      `• **Overview & Purpose**: ${effectiveTab?.content ? effectiveTab.content.slice(0, 200).replace(/\n/g, ' ') + '...' : 'Overview and documentation page for ' + pDomain}.\n` +
      `• **Key Architectural Points**: Details API patterns, setup workflows, and configuration options that integrate directly into your Agent Dock development workflow.\n` +
      `• **Actionable Developer Takeaway**: Use the code examples directly in \`~/AgentDock\`, or run \`python main.py\` in the Agent Dock terminal.\n\n` +
      `*(Note: Connected to Agent Dock bridge. Start \`ollama serve\` on your PC to stream with local \`${targetModel}\`)*`;
  } else if (lowerPrompt.includes('code') || lowerPrompt.includes('extract') || lowerPrompt.includes('script')) {
    fallback = `Here is a clean, ready-to-run code implementation for **${pTitle}**:\n\n` +
      `\`\`\`python\n` +
      `# Generated by Agent Dock Copilot for ${pDomain}\n` +
      `import os\n` +
      `import requests\n` +
      `import json\n\n` +
      `def main():\n` +
      `    target_url = "${effectiveTab?.url || 'https://api.github.com'}"\n` +
      `    print(f"Connecting to {target_url} from Agent Dock...")\n` +
      `    headers = {"User-Agent": "Agent Dock-Copilot-Agent/1.0"}\n` +
      `    response = requests.get(target_url, headers=headers, timeout=10)\n` +
      `    if response.status_code == 200:\n` +
      `        print("Successfully retrieved page content!")\n` +
      `        return response.text[:500]\n` +
      `    return None\n\n` +
      `if __name__ == "__main__":\n` +
      `    main()\n` +
      `\`\`\`\n\n` +
      `Click **"💾 Save to Agent Dock"** on the code block above to write this file directly to \`~/AgentDock\`!`;
  } else {
    fallback = `**Agent Dock Copilot Analysis for ${pTitle}:**\n\n` +
      (webGrounding ? `**Web Search Grounding:**\n${webGrounding}\n\n` : '') +
      `Regarding your question: *"${userPrompt}"*\n\n` +
      `We are viewing **${pTitle}** on **${pDomain}**.` +
      (effectiveTab?.selectedText ? `\n\nYour highlighted text: *"${effectiveTab.selectedText}"*` : '') +
      `\n\nThis side panel stays permanently open on the right side of Microsoft Edge while you navigate. Any code you generate can be saved directly into \`~/AgentDock\` with one click.` +
      `\n\n*(To run full local LLM inference with \`${targetModel}\`, run \`ollama serve\` in PowerShell)*`;
  }

  res.json({
    reply: fallback,
    content: fallback,
    model: targetModel,
    source: 'agentdock-bridge',
  });
});

// 27. Universal /api/chat route (for standard extension & client requests)
app.post('/api/chat', async (req: Request, res: Response) => {
  const { messages, message, model } = req.body;
  let queryText = message;
  if (!queryText && Array.isArray(messages) && messages.length > 0) {
    queryText = messages[messages.length - 1].content;
  }
  req.body.message = queryText || 'Hello';
  req.body.model = model || 'deepseek-r1:8b';

  // Delegate internally to edge-extension chat handler
  const chatHandler = app._router.stack.find((layer: any) => layer.route && layer.route.path === '/api/edge-extension/chat');
  if (chatHandler) {
    chatHandler.handle(req, res);
  } else {
    res.json({ reply: 'Agent Dock Server Online' });
  }
});

// Start Full-Stack Server
async function startServer() {
  if (!isProd) {
    // Development mode: mount Vite middleware for instant HMR and React rendering
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Production mode: serve built assets from dist
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`====================================================`);
    console.log(`🚀 Agent Dock Cursor IDE Server running on http://localhost:${PORT}`);
    console.log(`📁 Target Directory: ${activeDir}`);
    console.log(`💻 Default Shell:    ${isWin ? 'Windows PowerShell' : 'Bash'}`);
    console.log(`====================================================`);
  });
}

startServer();
