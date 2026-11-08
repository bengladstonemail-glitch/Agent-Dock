import { NotificationSettings } from './CompletionNotifications';
import { RobloxControls } from './RobloxControls';
import React, { useState, useEffect } from 'react';
import { 
  X, 
  Check, 
  AlertCircle, 
  RotateCw, 
  Terminal, 
  Sliders, 
  Cpu, 
  Wrench, 
  Play, 
  Copy, 
  FolderPlus, 
  GitBranch, 
  Globe, 
  Sparkles, 
  FileCode, 
  CheckCheck,
  RefreshCw,
  Layers,
  Settings as SettingsIcon,
  Code2,
  Compass
} from 'lucide-react';
import { OllamaSettings, McpServerStatus, McpTool } from '../types/chat';
import { OllamaService } from '../services/ollama';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: OllamaSettings;
  onSaveSettings: (newSettings: OllamaSettings) => void;
  onRefreshModels: () => void;
  initialTab?: 'general' | 'mcp' | 'hyperparams' | 'edge';
}

const DEFAULT_MCP_JSON = JSON.stringify({
  mcpServers: {
    filesystem: {
      command: "npx",
      args: [
        "-y",
        "@modelcontextprotocol/server-filesystem",
        "~/AgentDock"
      ]
    },
    git: {
      command: "uvx",
      args: [
        "mcp-server-git",
        "--repository",
        "~/AgentDock"
      ]
    },
    fetch: {
      command: "uvx",
      args: [
        "mcp-server-fetch"
      ]
    }
  }
}, null, 2);

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onSaveSettings,
  onRefreshModels,
  initialTab = 'general',
}) => {
  const [activeTab, setActiveTab] = useState<'general' | 'mcp' | 'hyperparams' | 'edge'>(initialTab);
  const [formData, setFormData] = useState<OllamaSettings>(settings);
  const [testResult, setTestResult] = useState<{ testing: boolean; success?: boolean; message?: string } | null>(null);

  // MCP State
  const [mcpJson, setMcpJson] = useState<string>(settings.mcpConfigJson || DEFAULT_MCP_JSON);
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [mcpServers, setMcpServers] = useState<McpServerStatus[]>([]);
  const [mcpTotalTools, setMcpTotalTools] = useState<number>(0);
  const [loadingMcp, setLoadingMcp] = useState<boolean>(false);
  const [mcpSaveSuccess, setMcpSaveSuccess] = useState<boolean>(false);
  const [toolRunning, setToolRunning] = useState<string | null>(null);
  const [toolTestOutput, setToolTestOutput] = useState<{ tool: string; result: any } | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Edge Extension State
  const [edgeTabInfo, setEdgeTabInfo] = useState<any>(null);
  const [edgeTestUrl, setEdgeTestUrl] = useState('https://github.com');
  const [edgeTestMsg, setEdgeTestMsg] = useState<string | null>(null);

  const fetchEdgeTab = async () => {
    try {
      const res = await fetch('/api/edge-extension/active-tab').catch(() => null);
      if (res && res.ok) {
        const data = await res.json();
        setEdgeTabInfo(data);
      }
    } catch {
      // offline
    }
  };

  const handleOpenEdgeTabTest = async () => {
    if (!edgeTestUrl.trim()) return;
    setEdgeTestMsg('Requesting tab in Edge...');
    try {
      await fetch('/api/edge-extension/open-tab', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: edgeTestUrl }),
      });
      setEdgeTestMsg('Opened tab request sent to Edge!');
      setTimeout(() => setEdgeTestMsg(null), 3000);
    } catch {
      setEdgeTestMsg('Failed to open tab');
    }
  };

  // Load MCP status and config from backend on mount or tab change
  useEffect(() => {
    if (isOpen) {
      if (initialTab) {
        setActiveTab(initialTab);
      }
      setFormData(settings);
      loadMcpFromBackend();
      fetchEdgeTab();
    }
  }, [isOpen, initialTab, settings]);

  // Live validate JSON syntax
  useEffect(() => {
    try {
      const parsed = JSON.parse(mcpJson);
      if (!parsed.mcpServers || typeof parsed.mcpServers !== 'object') {
        setJsonError('Root object must contain "mcpServers"');
      } else {
        setJsonError(null);
      }
    } catch (err: any) {
      setJsonError(err.message);
    }
  }, [mcpJson]);

  const loadMcpFromBackend = async () => {
    setLoadingMcp(true);
    try {
      const [cfgRes, statusRes] = await Promise.all([
        fetch('/api/mcp/config').catch(() => null),
        fetch('/api/mcp/status').catch(() => null),
      ]);

      if (cfgRes && cfgRes.ok) {
        const cfgData = await cfgRes.json();
        if (cfgData.rawJson) {
          setMcpJson(cfgData.rawJson);
        }
      }

      if (statusRes && statusRes.ok) {
        const statusData = await statusRes.json();
        if (statusData.servers) {
          setMcpServers(statusData.servers);
          setMcpTotalTools(statusData.totalTools || 0);
        }
      }
    } catch {
      // offline fallback
    } finally {
      setLoadingMcp(false);
    }
  };

  if (!isOpen) return null;

  const handleTestConnection = async () => {
    setTestResult({ testing: true });
    const res = await OllamaService.checkConnection(formData.baseUrl, formData.pythonBridgeUrl);
    if (res.ok) {
      setTestResult({
        testing: false,
        success: true,
        message: `Connected successfully to ${res.version} via ${res.activeEndpoint || 'proxy'}!`,
      });
      onRefreshModels();
    } else {
      setTestResult({
        testing: false,
        success: false,
        message: `Could not connect: ${res.error}. Verify Ollama is running and CORS is enabled.`,
      });
    }
  };

  const handleFormatJson = () => {
    try {
      const parsed = JSON.parse(mcpJson);
      setMcpJson(JSON.stringify(parsed, null, 2));
      setJsonError(null);
    } catch (err: any) {
      setJsonError(err.message);
    }
  };

  const handleApplyPreset = (type: 'filesystem' | 'git' | 'fetch' | 'default') => {
    if (type === 'default') {
      setMcpJson(DEFAULT_MCP_JSON);
      setJsonError(null);
      return;
    }

    try {
      const parsed = JSON.parse(mcpJson || '{"mcpServers": {}}');
      if (!parsed.mcpServers) parsed.mcpServers = {};

      if (type === 'filesystem') {
        parsed.mcpServers.filesystem = {
          command: "npx",
          args: ["-y", "@modelcontextprotocol/server-filesystem", formData.baseProjectDir || "~/AgentDock"]
        };
      } else if (type === 'git') {
        parsed.mcpServers.git = {
          command: "uvx",
          args: ["mcp-server-git", "--repository", formData.baseProjectDir || "~/AgentDock"]
        };
      } else if (type === 'fetch') {
        parsed.mcpServers.fetch = {
          command: "uvx",
          args: ["mcp-server-fetch"]
        };
      }

      setMcpJson(JSON.stringify(parsed, null, 2));
      setJsonError(null);
    } catch {
      setMcpJson(DEFAULT_MCP_JSON);
    }
  };

  const handleSaveMcpConfig = async () => {
    if (jsonError) return;
    setLoadingMcp(true);
    setMcpSaveSuccess(false);

    try {
      const res = await fetch('/api/mcp/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ configJson: mcpJson }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.servers) {
          setMcpServers(data.servers);
          const total = data.servers.reduce((sum: number, s: any) => sum + (s.tools?.length || 0), 0);
          setMcpTotalTools(total);
        }
        setMcpSaveSuccess(true);
        setTimeout(() => setMcpSaveSuccess(false), 2500);

        setFormData((prev) => ({
          ...prev,
          mcpConfigJson: mcpJson,
          mcpEnabled: prev.mcpEnabled ?? true,
        }));
      }
    } catch {
      // Offline fallback
    } finally {
      setLoadingMcp(false);
    }
  };

  const handleTestTool = async (serverName: string, tool: McpTool) => {
    setToolRunning(tool.name);
    try {
      // Build sample args based on tool
      let sampleArgs: any = {};
      if (tool.name === 'read_file') sampleArgs = { path: 'main.py' };
      if (tool.name === 'write_file') sampleArgs = { path: 'test_mcp.py', content: '# Tested via MCP\nprint("MCP active")\n' };
      if (tool.name === 'list_directory') sampleArgs = { path: '' };
      if (tool.name === 'get_file_info') sampleArgs = { path: 'main.py' };
      if (tool.name === 'fetch_url') sampleArgs = { url: 'https://httpbin.org/get' };

      const res = await fetch('/api/mcp/call-tool', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serverName,
          toolName: tool.name,
          arguments: sampleArgs,
        }),
      });

      const data = await res.json();
      setToolTestOutput({
        tool: `${serverName}.${tool.name}`,
        result: data.result || data.error || data,
      });
    } catch (e: any) {
      setToolTestOutput({
        tool: `${serverName}.${tool.name}`,
        result: { error: e.message },
      });
    } finally {
      setToolRunning(null);
    }
  };

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleSave = () => {
    const updated = {
      ...formData,
      mcpConfigJson: mcpJson,
      mcpEnabled: formData.mcpEnabled ?? true,
    };
    onSaveSettings(updated);
    handleSaveMcpConfig();
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 z-50 select-none animate-in fade-in duration-150">
      <div className="bg-[#18191e] border border-[#2d3039] rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="h-13 border-b border-[#252730] px-5 flex items-center justify-between bg-[#15161a]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#212638] flex items-center justify-center text-[#58a6ff]">
              <SettingsIcon className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-[#e3e4e8]">Settings & Configurations</h3>
              <p className="text-[11px] text-[#8b909a]">Ollama models, local MCP tools & hyperparameters</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-[#22242c] rounded-lg text-[#8b909a] hover:text-[#e3e4e8] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center px-5 border-b border-[#252730] bg-[#141519] gap-1 pt-1">
          <button
            onClick={() => setActiveTab('general')}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold border-b-2 transition-colors ${
              activeTab === 'general'
                ? 'border-[#58a6ff] text-white bg-[#1e2028]/60'
                : 'border-transparent text-[#8b909a] hover:text-[#e3e4e8]'
            }`}
          >
            <Cpu className="w-3.5 h-3.5" />
            <span>Ollama & General</span>
          </button>

          <button
            onClick={() => setActiveTab('mcp')}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold border-b-2 transition-colors ${
              activeTab === 'mcp'
                ? 'border-[#3fb950] text-[#7ee787] bg-[#1a251e]/60'
                : 'border-transparent text-[#8b909a] hover:text-[#e3e4e8]'
            }`}
          >
            <Wrench className="w-3.5 h-3.5 text-[#3fb950]" />
            <span>MCP (Model Context Protocol)</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-[#1e2f22] text-[#3fb950] font-mono border border-[#2ea043]/30">
              {mcpTotalTools > 0 ? `${mcpTotalTools} tools` : 'JSON'}
            </span>
          </button>

          <button
            onClick={() => {
              setActiveTab('edge');
              fetchEdgeTab();
            }}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold border-b-2 transition-colors ${
              activeTab === 'edge'
                ? 'border-[#0078d4] text-[#79b8ff] bg-[#162030]/60'
                : 'border-transparent text-[#8b909a] hover:text-[#e3e4e8]'
            }`}
          >
            <Compass className="w-3.5 h-3.5 text-[#58a6ff]" />
            <span>Edge Extension</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono border ${
              formData.edgeExtensionEnabled
                ? 'bg-[#15273b] text-[#79b8ff] border-[#0078d4]/40'
                : 'bg-[#1e2026] text-[#8b90a0] border-[#2b2e36]'
            }`}>
              {formData.edgeExtensionEnabled ? 'ON' : 'OFF'}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('hyperparams')}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold border-b-2 transition-colors ${
              activeTab === 'hyperparams'
                ? 'border-[#9B72CB] text-[#d2a8ff] bg-[#221c2c]/60'
                : 'border-transparent text-[#8b909a] hover:text-[#e3e4e8]'
            }`}
          >
            <Sliders className="w-3.5 h-3.5 text-[#d2a8ff]" />
            <span>Parameters & System</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-5 text-xs text-[#dcdfe6] flex-1">
          {/* TAB 1: GENERAL & OLLAMA */}
          {activeTab === 'general' && (
            <div className="space-y-4">
              {/* Ollama Server URL */}
              <div className="space-y-2">
                <label className="font-semibold text-[#e3e4e8] block">Ollama Server URL</label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={formData.baseUrl}
                    onChange={(e) => setFormData({ ...formData, baseUrl: e.target.value })}
                    placeholder="http://localhost:11434"
                    className="flex-1 bg-[#121316] border border-[#2a2d36] focus:border-[#58a6ff] rounded-lg px-3 py-2 text-xs font-mono text-[#e3e4e8] outline-none"
                  />
                  <button
                    onClick={handleTestConnection}
                    disabled={testResult?.testing}
                    className="px-3.5 py-2 bg-[#21262d] hover:bg-[#2d333b] border border-[#30363d] rounded-lg text-[#58a6ff] font-medium flex items-center gap-1.5 shrink-0 transition-colors"
                  >
                    {testResult?.testing ? (
                      <RotateCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Check className="w-3.5 h-3.5" />
                    )}
                    <span>Test</span>
                  </button>
                </div>

                {testResult && (
                  <div
                    className={`p-2.5 rounded-lg border flex items-start gap-2 ${
                      testResult.success
                        ? 'bg-[#16291e] border-[#2ea043]/40 text-[#7ee787]'
                        : 'bg-[#2e171b] border-[#da3633]/40 text-[#ffa198]'
                    }`}
                  >
                    {testResult.success ? (
                      <Check className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                    ) : (
                      <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                    )}
                    <span className="text-[11px] leading-relaxed">{testResult.message}</span>
                  </div>
                )}
              </div>

              {/* Agent Dock Workspace Folder */}
              <div className="space-y-1.5">
                <label className="font-semibold text-[#e3e4e8] flex items-center gap-1.5">
                  <FolderPlus className="w-3.5 h-3.5 text-[#e3b341]" />
                  <span>PC Workspace Directory</span>
                </label>
                <input
                  type="text"
                  value={formData.baseProjectDir}
                  onChange={(e) => setFormData({ ...formData, baseProjectDir: e.target.value })}
                  placeholder="~/AgentDock"
                  className="w-full bg-[#121316] border border-[#2a2d36] focus:border-[#58a6ff] rounded-lg px-3 py-2 text-xs font-mono text-[#e3b341] outline-none"
                />
                <p className="text-[10px] text-[#8b909a]">
                  Default location where files and projects are created on your PC.
                </p>
              </div>

              {/* Simulated fallback toggle */}
              <div className="p-3 bg-[#131417] rounded-xl border border-[#24262d] flex items-center justify-between">
                <div>
                  <span className="font-semibold text-[#e3e4e8] block">High-Fidelity Simulated Mode</span>
                  <span className="text-[11px] text-[#8b909a] block mt-0.5">
                    Generate reasoning traces and code diffs when local Ollama is offline.
                  </span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer ml-3">
                  <input
                    type="checkbox"
                    checked={formData.isSimulatedFallback}
                    onChange={(e) => setFormData({ ...formData, isSimulatedFallback: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-[#262830] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#58a6ff]"></div>
                </label>
              </div>

              {/* CORS Guide */}
              <div className="p-3 bg-[#121316] rounded-xl border border-[#24262d] space-y-2">
                <div className="flex items-center gap-1.5 font-semibold text-[#e3e4e8]">
                  <Terminal className="w-3.5 h-3.5 text-[#e3b341]" />
                  <span>Ollama CORS Setup</span>
                </div>
                <p className="text-[11px] text-[#8b909a] leading-relaxed">
                  To connect your local Ollama directly from browsers, launch with CORS origins:
                </p>
                <div className="bg-[#181a1f] p-2 rounded border border-[#2b2e36] font-mono text-[11px] text-[#58a6ff] select-all">
                  OLLAMA_ORIGINS="*" ollama serve
                </div>
              </div>
            </div>
          )}

          <NotificationSettings />

          {/* TAB 2: MODEL CONTEXT PROTOCOL (MCP) */}
          {activeTab === 'mcp' && (
            <div className="space-y-4">
              <label className="flex items-center gap-2 text-sm text-[#c9d1d9]">
                <input type="checkbox" checked={formData.mcpEnabled !== false} onChange={e=>setFormData(prev=>({...prev,mcpEnabled:e.target.checked}))} />
                Enable MCP tool access for Agent
              </label>
              <p className="text-xs text-[#8b909a]">Turn MCP off to use Agent without external tool calls. Connections can remain configured while access is off.</p>
              <RobloxControls />

              {/* MCP Info Banner */}
              <div className="p-3.5 rounded-xl bg-[#142118] border border-[#2ea043]/30 flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Wrench className="w-4 h-4 text-[#3fb950]" />
                    <span className="font-bold text-white text-xs">Model Context Protocol (MCP)</span>
                    <span className="text-[10px] px-2 py-0.2 rounded-full bg-[#203625] text-[#7ee787] font-mono border border-[#2ea043]/40">
                      {mcpServers.length} servers active
                    </span>
                  </div>
                  <p className="text-[11px] text-[#a4a8b8] leading-relaxed">
                    Configure your MCP JSON below. Connects filesystem tools in <code className="text-[#e3b341] font-mono">{formData.baseProjectDir}</code>, Git commands, and web search to Ollama.
                  </p>
                </div>

                <button
                  onClick={loadMcpFromBackend}
                  disabled={loadingMcp}
                  className="p-1.5 bg-[#1e2f22] hover:bg-[#253d2c] border border-[#2ea043]/40 rounded-lg text-[#3fb950] transition-colors shrink-0"
                  title="Reload MCP Status"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingMcp ? 'animate-spin' : ''}`} />
                </button>
              </div>

              {/* Preset Buttons */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[11px] text-[#8b909a]">
                  <span className="font-semibold text-[#c9d1d9]">Quick Add MCP Templates:</span>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={handleFormatJson}
                      className="text-[#58a6ff] hover:underline flex items-center gap-1 font-mono text-[10px]"
                    >
                      <Code2 className="w-3 h-3" />
                      <span>Format JSON</span>
                    </button>
                    <span>·</span>
                    <button
                      onClick={() => handleApplyPreset('default')}
                      className="text-[#8b909a] hover:text-white text-[10px]"
                    >
                      Reset Default
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  <button
                    onClick={() => handleApplyPreset('filesystem')}
                    className="px-2.5 py-1 bg-[#1a1c24] hover:bg-[#242834] border border-[#2b2f3d] rounded-lg text-[11px] text-[#e3e4e8] flex items-center gap-1.5 transition-colors"
                  >
                    <FolderPlus className="w-3 h-3 text-[#e3b341]" />
                    <span>Filesystem (Agent Dock)</span>
                  </button>

                  <button
                    onClick={() => handleApplyPreset('git')}
                    className="px-2.5 py-1 bg-[#1a1c24] hover:bg-[#242834] border border-[#2b2f3d] rounded-lg text-[11px] text-[#e3e4e8] flex items-center gap-1.5 transition-colors"
                  >
                    <GitBranch className="w-3 h-3 text-[#3fb950]" />
                    <span>Git Repository</span>
                  </button>

                  <button
                    onClick={() => handleApplyPreset('fetch')}
                    className="px-2.5 py-1 bg-[#1a1c24] hover:bg-[#242834] border border-[#2b2f3d] rounded-lg text-[11px] text-[#e3e4e8] flex items-center gap-1.5 transition-colors"
                  >
                    <Globe className="w-3 h-3 text-[#58a6ff]" />
                    <span>Web Fetch</span>
                  </button>
                </div>
              </div>

              {/* MCP JSON Editor */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[11px]">
                  <label className="font-semibold text-[#e3e4e8] font-mono">mcpServers Configuration (JSON)</label>
                  {jsonError ? (
                    <span className="text-[#f85149] flex items-center gap-1 text-[10px]">
                      <AlertCircle className="w-3 h-3" />
                      <span>{jsonError}</span>
                    </span>
                  ) : (
                    <span className="text-[#3fb950] flex items-center gap-1 text-[10px]">
                      <Check className="w-3 h-3" />
                      <span>Valid JSON</span>
                    </span>
                  )}
                </div>

                <textarea
                  value={mcpJson}
                  onChange={(e) => setMcpJson(e.target.value)}
                  rows={10}
                  spellCheck={false}
                  placeholder='{\n  "mcpServers": {\n    "filesystem": {\n      "command": "npx",\n      "args": ["-y", "@modelcontextprotocol/server-filesystem", "~/AgentDock"]\n    }\n  }\n}'
                  className={`w-full bg-[#101115] border rounded-xl p-3 font-mono text-[11px] leading-relaxed text-[#c9d1d9] outline-none select-text ${
                    jsonError ? 'border-[#f85149]/60 focus:border-[#f85149]' : 'border-[#2d303d] focus:border-[#3fb950]'
                  }`}
                />

                <div className="flex items-center justify-between text-[10px] text-[#8b909a]">
                  <span>Supports stdio and HTTP/SSE MCP servers (npx, uvx, python, node, docker)</span>
                  <div className="flex items-center gap-2">
                    {mcpSaveSuccess && (
                      <span className="text-[#3fb950] flex items-center gap-1">
                        <CheckCheck className="w-3 h-3" />
                        <span>Saved to disk!</span>
                      </span>
                    )}
                    <button
                      onClick={handleSaveMcpConfig}
                      disabled={!!jsonError || loadingMcp}
                      className="px-3 py-1 bg-[#233526] hover:bg-[#2c4430] border border-[#2ea043]/40 text-[#7ee787] rounded-lg font-semibold transition-colors disabled:opacity-30"
                    >
                      {loadingMcp ? 'Saving...' : 'Save & Reload MCP'}
                    </button>
                  </div>
                </div>
              </div>

              {/* Active MCP Servers & Tools Explorer */}
              <div className="space-y-2 pt-2 border-t border-[#232530]">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold text-[#e3e4e8] text-xs flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-[#58a6ff]" />
                    <span>Discovered MCP Servers & Tools</span>
                  </h4>
                  <span className="text-[10px] font-mono text-[#8b909a]">
                    {mcpServers.length} Servers · {mcpTotalTools} Tools
                  </span>
                </div>

                {mcpServers.length === 0 ? (
                  <div className="p-4 rounded-xl bg-[#121316] border border-[#23252d] text-center text-[#8b909a] text-xs">
                    No MCP servers configured. Add one above or click a preset!
                  </div>
                ) : (
                  <div className="space-y-2">
                    {mcpServers.map((server) => (
                      <div
                        key={server.name}
                        className="rounded-xl bg-[#131419] border border-[#232530] p-3 space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 font-mono text-xs">
                            <span className="w-2 h-2 rounded-full bg-[#3fb950]" />
                            <span className="font-bold text-white">{server.name}</span>
                            <span className="text-[10px] text-[#8b909a]">
                              ({server.command} {server.args?.slice(0, 2).join(' ') || ''})
                            </span>
                          </div>
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#1b2920] text-[#7ee787] font-mono border border-[#2ea043]/30">
                            {server.tools.length} tools
                          </span>
                        </div>

                        {/* Tools Grid */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1">
                          {server.tools.map((tool) => (
                            <div
                              key={tool.name}
                              className="p-2 rounded-lg bg-[#181a20] border border-[#252834] flex items-start justify-between gap-2"
                            >
                              <div className="truncate pr-1">
                                <div className="font-mono text-[11px] font-semibold text-[#7ee787] truncate">
                                  {tool.name}
                                </div>
                                <div className="text-[10px] text-[#8b909a] truncate mt-0.5">
                                  {tool.description}
                                </div>
                              </div>

                              <button
                                onClick={() => handleTestTool(server.name, tool)}
                                disabled={toolRunning === tool.name}
                                className="px-2 py-0.8 bg-[#212530] hover:bg-[#2c3242] border border-[#303648] text-[#58a6ff] rounded text-[10px] font-mono flex items-center gap-1 shrink-0 transition-colors"
                                title="Run sample tool test"
                              >
                                {toolRunning === tool.name ? (
                                  <RotateCw className="w-2.5 h-2.5 animate-spin" />
                                ) : (
                                  <Play className="w-2.5 h-2.5 fill-current" />
                                )}
                                <span>Test</span>
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Tool Output Box */}
                {toolTestOutput && (
                  <div className="p-3 bg-[#111216] border border-[#2c2f3d] rounded-xl space-y-1.5 select-text animate-in fade-in">
                    <div className="flex items-center justify-between text-[11px] font-mono text-[#8b909a]">
                      <span className="text-[#3fb950] font-semibold flex items-center gap-1">
                        <Check className="w-3 h-3" />
                        <span>Output: {toolTestOutput.tool}</span>
                      </span>
                      <button
                        onClick={() => copyToClipboard(JSON.stringify(toolTestOutput.result, null, 2), 'output')}
                        className="flex items-center gap-1 text-[#58a6ff] hover:underline"
                      >
                        {copiedKey === 'output' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                        <span>{copiedKey === 'output' ? 'Copied' : 'Copy Output'}</span>
                      </button>
                    </div>
                    <pre className="p-2 bg-[#0c0d10] rounded-lg font-mono text-[10px] text-[#7ee787] overflow-x-auto max-h-36">
                      {JSON.stringify(toolTestOutput.result, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: EDGE EXTENSION COMPANION */}
          {activeTab === 'edge' && (
            <div className="space-y-4">
              {/* Master Toggle */}
              <div className="p-4 rounded-xl bg-[#14161e] border border-[#272b3a] space-y-3">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <Compass className="w-4 h-4 text-[#58a6ff]" />
                      <span className="font-semibold text-white text-sm">Microsoft Edge Companion Context</span>
                    </div>
                    <p className="text-[11px] text-[#8b90a0] mt-1 leading-relaxed">
                      Control whether your active Microsoft Edge browser tab is attached to chat prompts. 
                      <strong> When turned OFF (Default)</strong>, the AI concentrates 100% on creating and coding projects in <code className="text-[#58a6ff]">{formData.baseProjectDir}</code> without web or page interference.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, edgeExtensionEnabled: !formData.edgeExtensionEnabled })}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold shrink-0 transition-all border ${
                      formData.edgeExtensionEnabled
                        ? 'bg-[#15273b] text-[#79b8ff] border-[#0078d4]/60 shadow-xs'
                        : 'bg-[#1e2026] text-[#8b90a0] border-[#2b2e36]'
                    }`}
                  >
                    {formData.edgeExtensionEnabled ? 'ENABLED (ON)' : 'DISABLED (OFF)'}
                  </button>
                </div>
              </div>

              {/* Active Tab Live Monitor */}
              <div className="p-4 rounded-xl bg-[#14161d] border border-[#272b38] space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`w-2.5 h-2.5 rounded-full ${edgeTabInfo?.title ? 'bg-[#3fb950] animate-pulse' : 'bg-[#e3b341]'}`} />
                    <span className="font-semibold text-white text-xs">Active Microsoft Edge Tab Monitor</span>
                  </div>
                  <button
                    onClick={fetchEdgeTab}
                    className="text-[11px] text-[#58a6ff] hover:underline flex items-center gap-1"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>Refresh Tab</span>
                  </button>
                </div>

                {edgeTabInfo?.title ? (
                  <div className="space-y-1.5 bg-[#101115] p-3 rounded-lg border border-[#212430]">
                    <div className="font-semibold text-white text-xs truncate">
                      {edgeTabInfo.title}
                    </div>
                    <div className="text-[11px] text-[#58a6ff] font-mono truncate">
                      {edgeTabInfo.url}
                    </div>
                    {edgeTabInfo.content && (
                      <div className="text-[10.5px] text-[#8b90a0] line-clamp-2 bg-[#15171e] p-2 rounded border border-[#262835] font-mono mt-1">
                        {edgeTabInfo.content}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="p-3 rounded-lg bg-[#111216] border border-[#232530] text-[#8b90a0] text-xs flex items-center justify-between">
                    <span>Edge side panel companion is ready in {formData.baseProjectDir}/edge-extension</span>
                    <span className="font-mono text-[10px] text-[#e3b341]">edge-extension</span>
                  </div>
                )}
              </div>

              {/* Quick Install Guide (3 Steps) */}
              <div className="space-y-2">
                <h4 className="font-bold text-white text-xs uppercase tracking-wider text-[#8b90a0]">
                  How to Install or Reload in Microsoft Edge:
                </h4>

                <div className="grid grid-cols-1 gap-2">
                  <div className="p-3 rounded-xl bg-[#13141a] border border-[#242633] flex items-start gap-3">
                    <div className="w-5 h-5 rounded-full bg-[#0078d4]/20 text-[#58a6ff] font-bold text-[11px] flex items-center justify-center shrink-0 mt-0.5">
                      1
                    </div>
                    <div className="flex-1 space-y-1">
                      <span className="font-semibold text-white block">Open Edge Extensions</span>
                      <div className="flex items-center justify-between bg-[#1a1c24] px-2.5 py-1.5 rounded-lg border border-[#2c3040] font-mono text-[11px]">
                        <span className="text-[#58a6ff]">edge://extensions</span>
                        <button
                          onClick={() => copyToClipboard('edge://extensions', 'edge-url')}
                          className="text-[#8b90a0] hover:text-white flex items-center gap-1"
                        >
                          {copiedKey === 'edge-url' ? <Check className="w-3 h-3 text-[#3fb950]" /> : <Copy className="w-3 h-3" />}
                          <span>{copiedKey === 'edge-url' ? 'Copied' : 'Copy'}</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-[#13141a] border border-[#242633] flex items-start gap-3">
                    <div className="w-5 h-5 rounded-full bg-[#9b72cb]/20 text-[#d2a8ff] font-bold text-[11px] flex items-center justify-center shrink-0 mt-0.5">
                      2
                    </div>
                    <div className="flex-1 space-y-0.5">
                      <span className="font-semibold text-white block">Turn ON Developer Mode</span>
                      <p className="text-[11px] text-[#8b90a0]">
                        In Microsoft Edge, toggle the switch in the left sidebar that says <strong>Developer mode</strong>.
                      </p>
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-[#13141a] border border-[#242633] flex items-start gap-3">
                    <div className="w-5 h-5 rounded-full bg-[#3fb950]/20 text-[#7ee787] font-bold text-[11px] flex items-center justify-center shrink-0 mt-0.5">
                      3
                    </div>
                    <div className="flex-1 space-y-1">
                      <span className="font-semibold text-white block">Load Unpacked / Reload:</span>
                      <div className="flex items-center justify-between bg-[#1a1c24] px-2.5 py-1.5 rounded-lg border border-[#2c3040] font-mono text-[11px]">
                        <span className="text-[#e3b341] truncate">{formData.baseProjectDir}/edge-extension</span>
                        <button
                          onClick={() => copyToClipboard(`${formData.baseProjectDir}/edge-extension`, 'folder-path')}
                          className="text-[#8b90a0] hover:text-white flex items-center gap-1 shrink-0 ml-2"
                        >
                          {copiedKey === 'folder-path' ? <Check className="w-3 h-3 text-[#3fb950]" /> : <Copy className="w-3 h-3" />}
                          <span>{copiedKey === 'folder-path' ? 'Copied' : 'Copy Path'}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Test Opening Tab */}
              <div className="p-3.5 rounded-xl bg-[#14151a] border border-[#252835] space-y-2">
                <span className="font-semibold text-white block text-xs">Test Opening a Tab in Edge</span>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={edgeTestUrl}
                    onChange={(e) => setEdgeTestUrl(e.target.value)}
                    placeholder="https://..."
                    className="flex-1 bg-[#101115] border border-[#2c2f3d] rounded-lg px-3 py-1.5 text-xs font-mono text-[#e3e4e8] outline-none"
                  />
                  <button
                    onClick={handleOpenEdgeTabTest}
                    className="px-3.5 py-1.5 bg-[#0078d4] hover:bg-[#106ebe] text-white font-semibold rounded-lg text-xs transition-colors shrink-0"
                  >
                    Open Tab
                  </button>
                </div>
                {edgeTestMsg && (
                  <span className="text-[11px] text-[#7ee787] font-mono block">{edgeTestMsg}</span>
                )}
              </div>
            </div>
          )}

          {/* TAB 4: HYPERPARAMETERS & SYSTEM */}
          {activeTab === 'hyperparams' && (
            <div className="space-y-4">
              {/* Hyperparameters */}
              <div className="space-y-3">
                <h4 className="font-semibold text-[#e3e4e8] flex items-center gap-1.5">
                  <Sliders className="w-3.5 h-3.5 text-[#d2a8ff]" />
                  <span>Model Generation Parameters</span>
                </h4>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px]">
                      <span className="text-[#8b909a]">Temperature</span>
                      <span className="font-mono text-[#e3e4e8]">{formData.temperature}</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      value={formData.temperature}
                      onChange={(e) => setFormData({ ...formData, temperature: parseFloat(e.target.value) })}
                      className="w-full accent-[#d2a8ff]"
                    />
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px]">
                      <span className="text-[#8b909a]">Context Window (num_ctx)</span>
                      <span className="font-mono text-[#e3e4e8]">{formData.contextWindow.toLocaleString()}</span>
                    </div>
                    <input
                      type="range"
                      min="2048"
                      max="32768"
                      step="2048"
                      value={formData.contextWindow}
                      onChange={(e) => setFormData({ ...formData, contextWindow: parseInt(e.target.value) })}
                      className="w-full accent-[#d2a8ff]"
                    />
                  </div>
                </div>
              </div>

              {/* System Prompt */}
              <div className="space-y-1.5">
                <label className="font-semibold text-[#e3e4e8] block">Cursor / Gemini System Prompt</label>
                <textarea
                  value={formData.systemPrompt}
                  onChange={(e) => setFormData({ ...formData, systemPrompt: e.target.value })}
                  rows={4}
                  placeholder="You are an expert AI programmer operating as the Cursor IDE assistant..."
                  className="w-full bg-[#121316] border border-[#2a2d36] focus:border-[#d2a8ff] rounded-lg p-2.5 text-xs text-[#e3e4e8] outline-none leading-relaxed font-mono select-text"
                />
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="h-13 border-t border-[#252730] px-5 flex items-center justify-between bg-[#15161a]">
          <span className="text-[11px] text-[#8b909a] font-mono">
            {activeTab === 'mcp' ? `${mcpTotalTools} MCP Tools Configured` : `Workspace: ${formData.baseProjectDir}`}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-lg text-xs font-medium text-[#8b909a] hover:text-[#e3e4e8] hover:bg-[#202228] transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!!jsonError}
              className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-[#58a6ff] hover:bg-[#79b8ff] disabled:opacity-40 text-[#0d1117] transition-colors shadow-xs"
            >
              Save Settings
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
