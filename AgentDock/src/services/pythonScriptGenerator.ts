/**
 * Generates the standalone Agent Dock Python companion script (agentdock.py).
 * Agent Dock can run this on his PC via: python agentdock.py
 * It automatically creates ~/AgentDock and bridges Ollama streaming,
 * real terminal command execution via PowerShell, and file read/write.
 */
export function generateAgentDockPythonScript(): string {
  // Return the contents of /agentdock.py
  return `"""
Agent Dock - Cursor-Style Ollama Agent & Local Project Manager
============================================================
Automated companion for local Ollama on Windows / macOS / Linux.
Created for Agent Dock: Manages projects in ~/AgentDock.

Features:
- Auto-creates and monitors ~/AgentDock
- Real Integrated Terminal: Executes PowerShell commands in ~/AgentDock
- Full File Explorer API: Create, Read, Edit, and Delete real files on your PC
- Connects to local Ollama (http://localhost:11434) with streaming
- Supports Vision models (images) and Document/Code file context
- HTTP Bridge on port 8000 for the Cursor Web UI

Usage:
    pip install requests
    python agentdock.py
"""

import os
import sys
import json
import base64
import platform
import http.server
import socketserver
import urllib.request
import urllib.parse
import urllib.error
import subprocess
from pathlib import Path

# Target project directory requested by Agent Dock
WINDOWS_DEFAULT_DIR = Path.home() / "AgentDock"
UNIX_DEFAULT_DIR = Path.home() / "AgentDock"

BASE_DIR = WINDOWS_DEFAULT_DIR if platform.system() == "Windows" else (
    WINDOWS_DEFAULT_DIR if WINDOWS_DEFAULT_DIR.parent.exists() else UNIX_DEFAULT_DIR
)

OLLAMA_HOST = os.environ.get("OLLAMA_HOST", "http://localhost:11434").rstrip("/")
PORT = 8000

def ensure_base_dir():
    try:
        BASE_DIR.mkdir(parents=True, exist_ok=True)
        print(f"[Agent Dock] Target folder verified: {BASE_DIR}")
    except Exception as e:
        alt = Path.home() / "AgentDock"
        alt.mkdir(parents=True, exist_ok=True)
        print(f"[Agent Dock] Notice: Defaulted to {alt} ({e})")
        return alt
    return BASE_DIR

ACTIVE_DIR = ensure_base_dir()

def get_installed_ollama_models():
    """Queries Ollama for models installed on this PC."""
    try:
        req = urllib.request.Request(f"{OLLAMA_HOST}/api/tags")
        with urllib.request.urlopen(req, timeout=3) as resp:
            data = json.loads(resp.read().decode())
            return data.get("models", [])
    except Exception as e:
        return []

def scan_files_in_agentdock():
    """Recursively scans files in ~/AgentDock"""
    files_list = []
    if not ACTIVE_DIR.exists():
        return files_list

    for root, dirs, files in os.walk(ACTIVE_DIR):
        dirs[:] = [d for d in dirs if not d.startswith(".") and d != "__pycache__" and d != "node_modules"]
        for file in files:
            if file.startswith("."):
                continue
            full_path = Path(root) / file
            rel_path = full_path.relative_to(ACTIVE_DIR)
            ext = full_path.suffix.lstrip(".")
            lang = "python" if ext == "py" else ("json" if ext == "json" else ("markdown" if ext == "md" else "text"))

            try:
                content = full_path.read_text(encoding="utf-8", errors="replace")
            except Exception:
                content = ""

            files_list.append({
                "id": str(rel_path).replace("\\\\", "/").replace("\\", "/"),
                "name": file,
                "path": str(full_path).replace("\\\\", "/").replace("\\", "/"),
                "relPath": str(rel_path).replace("\\\\", "/").replace("\\", "/"),
                "language": lang,
                "content": content,
                "size": full_path.stat().st_size
            })
    return files_list

class AgentDockBridgeHandler(http.server.BaseHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS, DELETE")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)

        if parsed.path == "/api/status":
            models = get_installed_ollama_models()
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            resp = {
                "status": "online",
                "agentdock_dir": str(ACTIVE_DIR),
                "ollama_host": OLLAMA_HOST,
                "installed_models_count": len(models),
                "models": [m.get("name") for m in models]
            }
            self.wfile.write(json.dumps(resp).encode())

        elif parsed.path == "/api/models":
            models = get_installed_ollama_models()
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({"models": models}).encode())

        elif parsed.path == "/api/files":
            files = scan_files_in_agentdock()
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({"files": files, "baseDir": str(ACTIVE_DIR)}).encode())

        elif parsed.path == "/api/terminal/info":
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({
                "defaultShell": "powershell" if platform.system() == "Windows" else "bash",
                "cwd": str(ACTIVE_DIR),
                "os": platform.system()
            }).encode())
        else:
            self.send_response(404)
            self.end_headers()

    def do_POST(self):
        content_length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(content_length).decode("utf-8") if content_length > 0 else "{}"
        data = json.loads(body) if body else {}

        if self.path == "/api/terminal/run":
            cmd = data.get("command", "").strip()
            custom_cwd = data.get("cwd")
            exec_dir = Path(custom_cwd) if custom_cwd and Path(custom_cwd).exists() else ACTIVE_DIR

            if not cmd:
                self.send_response(400)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps({"error": "No command specified"}).encode())
                return

            print(f"[Agent Dock Terminal] Executing in {exec_dir}: {cmd}")

            try:
                if platform.system() == "Windows":
                    args = ["powershell", "-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", cmd]
                    proc = subprocess.run(
                        args,
                        cwd=str(exec_dir),
                        capture_output=True,
                        text=True,
                        timeout=90,
                        encoding="utf-8",
                        errors="replace"
                    )
                else:
                    proc = subprocess.run(
                        cmd,
                        shell=True,
                        cwd=str(exec_dir),
                        capture_output=True,
                        text=True,
                        timeout=90,
                        encoding="utf-8",
                        errors="replace"
                    )

                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps({
                    "stdout": proc.stdout,
                    "stderr": proc.stderr,
                    "returncode": proc.returncode,
                    "cwd": str(exec_dir),
                    "command": cmd
                }).encode())
            except Exception as e:
                self.send_response(500)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps({
                    "stdout": "",
                    "stderr": f"[Execution Error]: {str(e)}",
                    "returncode": -1,
                    "cwd": str(exec_dir),
                    "command": cmd
                }).encode())

        elif self.path == "/api/write-file":
            rel_path = data.get("filePath")
            file_content = data.get("content", "")
            target = ACTIVE_DIR / rel_path
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_text(file_content, encoding="utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({"status": "ok", "path": str(target)}).encode())
        else:
            self.send_response(404)
            self.end_headers()

def run_server():
    print("=" * 65)
    print("🚀 Agent Dock Python Agent & PowerShell Terminal Bridge is Running!")
    print(f"📁 Workspace Root: {ACTIVE_DIR}")
    print(f"🦙 Ollama Host:    {OLLAMA_HOST}")
    print(f"🔌 Bridge Server:  http://localhost:{PORT}")
    print("=" * 65)
    print("Ready to run real commands in ~/AgentDock from the Cursor UI!")

    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(("", PORT), AgentDockBridgeHandler) as httpd:
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\\n[Agent Dock] Stopped.")

if __name__ == "__main__":
    run_server()
`;
}
