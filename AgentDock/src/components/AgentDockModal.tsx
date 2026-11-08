import React, { useState } from 'react';
import { 
  X, 
  Folder, 
  FolderPlus, 
  Download, 
  Copy, 
  Check, 
  Terminal, 
  FileCode, 
  CheckCheck, 
  ExternalLink,
  Sparkles,
  Server
} from 'lucide-react';
import { generateAgentDockPythonScript } from '../services/pythonScriptGenerator';
import { OllamaService } from '../services/ollama';

interface AgentDockModalProps {
  isOpen: boolean;
  onClose: () => void;
  baseProjectDir: string;
  pythonBridgeUrl: string;
  bridgeOnline: boolean;
  onProjectCreated: (projectName: string, projectType: string) => void;
}

export const AgentDockModal: React.FC<AgentDockModalProps> = ({
  isOpen,
  onClose,
  baseProjectDir,
  pythonBridgeUrl,
  bridgeOnline,
  onProjectCreated,
}) => {
  const [activeTab, setActiveTab] = useState<'create' | 'pythonScript' | 'bridge'>('create');
  const [projectName, setProjectName] = useState('user-fastapi-app');
  const [projectType, setProjectType] = useState<'python-fastapi' | 'python-ai' | 'python-data' | 'custom'>('python-fastapi');
  const [copiedScript, setCopiedScript] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [creationResult, setCreationResult] = useState<{ success: boolean; message: string } | null>(null);

  if (!isOpen) return null;

  const pythonScript = generateAgentDockPythonScript();

  const handleDownloadScript = () => {
    const blob = new Blob([pythonScript], { type: 'text/x-python' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'agentdock.py';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleCopyScript = () => {
    navigator.clipboard.writeText(pythonScript);
    setCopiedScript(true);
    setTimeout(() => setCopiedScript(false), 2000);
  };

  const handleCreateProject = async () => {
    if (!projectName.trim()) return;
    setIsCreating(true);
    setCreationResult(null);

    // Call bridge or simulated creator
    const res = await OllamaService.createProjectOnDisk(projectName.trim(), projectType, pythonBridgeUrl);
    setIsCreating(false);

    if (res.status === 'success') {
      setCreationResult({
        success: true,
        message: `Project created in ${res.path}! Created files: ${res.files.join(', ')}`,
      });
      onProjectCreated(projectName.trim(), projectType);
    } else {
      setCreationResult({
        success: true, // We still initialize in the workspace
        message: `Initialized project in workspace at ${baseProjectDir}/${projectName.trim()}! Run 'python agentdock.py' to sync directly to disk.`,
      });
      onProjectCreated(projectName.trim(), projectType);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 z-50 select-none animate-in fade-in duration-150">
      <div className="bg-[#18191e] border border-[#2d3039] rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="h-12 border-b border-[#252730] px-5 flex items-center justify-between bg-[#15161a]">
          <div className="flex items-center gap-2">
            <FolderPlus className="w-4 h-4 text-[#e3b341]" />
            <h3 className="text-sm font-semibold text-[#e3e4e8]">Agent Dock Project Hub</h3>
            <span className="text-[10px] text-[#6e7480] font-mono">({baseProjectDir})</span>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 hover:bg-[#22242c] rounded-lg text-[#8b909a] hover:text-[#e3e4e8] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 px-5 pt-3 pb-2 border-b border-[#23252a] bg-[#141518] text-xs">
          <button
            onClick={() => setActiveTab('create')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
              activeTab === 'create'
                ? 'bg-[#2b2e38] text-white shadow-xs'
                : 'text-[#8b909a] hover:text-[#e3e4e8]'
            }`}
          >
            Create Project in Agent Dock
          </button>

          <button
            onClick={() => setActiveTab('pythonScript')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-colors flex items-center gap-1.5 ${
              activeTab === 'pythonScript'
                ? 'bg-[#2b2e38] text-[#58a6ff] shadow-xs'
                : 'text-[#8b909a] hover:text-[#e3e4e8]'
            }`}
          >
            <FileCode className="w-3.5 h-3.5" />
            <span>Python Script (agentdock.py)</span>
          </button>

          <button
            onClick={() => setActiveTab('bridge')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-colors flex items-center gap-1.5 ${
              activeTab === 'bridge'
                ? 'bg-[#2b2e38] text-[#3fb950] shadow-xs'
                : 'text-[#8b909a] hover:text-[#e3e4e8]'
            }`}
          >
            <Server className="w-3.5 h-3.5" />
            <span>Bridge Status</span>
            <span
              className={`w-2 h-2 rounded-full ${
                bridgeOnline ? 'bg-[#3fb950]' : 'bg-[#e3b341]'
              }`}
            />
          </button>
        </div>

        {/* Tab Contents */}
        <div className="p-5 overflow-y-auto space-y-4 text-xs text-[#dcdfe6]">
          {activeTab === 'create' && (
            <div className="space-y-4">
              <div className="p-3 bg-[#131417] rounded-xl border border-[#24262d] flex items-center gap-3">
                <Folder className="w-6 h-6 text-[#e3b341] shrink-0" />
                <div>
                  <span className="font-semibold text-[#e3e4e8] block">Destination Directory</span>
                  <code className="text-[11px] font-mono text-[#58a6ff]">{baseProjectDir}</code>
                </div>
              </div>

              {/* Project Name */}
              <div className="space-y-1.5">
                <label className="font-semibold text-[#e3e4e8] block">Project Name</label>
                <input
                  type="text"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  placeholder="my-fastapi-app"
                  className="w-full bg-[#121316] border border-[#2a2d36] focus:border-[#58a6ff] rounded-lg px-3 py-2 text-xs font-mono text-[#e3e4e8] outline-none"
                />
                <span className="text-[10px] text-[#6e7480] block">
                  Will be created at: <span className="font-mono text-[#a4a8b2]">{baseProjectDir}/{projectName}</span>
                </span>
              </div>

              {/* Template Choice */}
              <div className="space-y-1.5">
                <label className="font-semibold text-[#e3e4e8] block">Project Template</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setProjectType('python-fastapi')}
                    className={`p-3 rounded-xl border text-left transition-colors ${
                      projectType === 'python-fastapi'
                        ? 'bg-[#1b222d] border-[#388bfd] text-white'
                        : 'bg-[#141518] border-[#252830] text-[#8b909a] hover:border-[#388bfd]/50'
                    }`}
                  >
                    <div className="font-semibold text-xs text-[#e3e4e8]">FastAPI REST Backend</div>
                    <div className="text-[10px] text-[#6e7480] mt-1">
                      Includes main.py, requirements.txt, and live uvicorn server
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setProjectType('python-ai')}
                    className={`p-3 rounded-xl border text-left transition-colors ${
                      projectType === 'python-ai'
                        ? 'bg-[#1b222d] border-[#388bfd] text-white'
                        : 'bg-[#141518] border-[#252830] text-[#8b909a] hover:border-[#388bfd]/50'
                    }`}
                  >
                    <div className="font-semibold text-xs text-[#e3e4e8]">Local Ollama AI Agent</div>
                    <div className="text-[10px] text-[#6e7480] mt-1">
                      Python streaming script connecting directly to Ollama
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setProjectType('python-data')}
                    className={`p-3 rounded-xl border text-left transition-colors ${
                      projectType === 'python-data'
                        ? 'bg-[#1b222d] border-[#388bfd] text-white'
                        : 'bg-[#141518] border-[#252830] text-[#8b909a] hover:border-[#388bfd]/50'
                    }`}
                  >
                    <div className="font-semibold text-xs text-[#e3e4e8]">Data & Pandas Pipeline</div>
                    <div className="text-[10px] text-[#6e7480] mt-1">
                      Data analysis script with CSV / JSON processing
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setProjectType('custom')}
                    className={`p-3 rounded-xl border text-left transition-colors ${
                      projectType === 'custom'
                        ? 'bg-[#1b222d] border-[#388bfd] text-white'
                        : 'bg-[#141518] border-[#252830] text-[#8b909a] hover:border-[#388bfd]/50'
                    }`}
                  >
                    <div className="font-semibold text-xs text-[#e3e4e8]">Blank Python Project</div>
                    <div className="text-[10px] text-[#6e7480] mt-1">
                      Clean entrypoint main.py ready for custom logic
                    </div>
                  </button>
                </div>
              </div>

              {creationResult && (
                <div className="p-3 bg-[#16291e] border border-[#2ea043]/40 rounded-xl text-[#7ee787] flex items-start gap-2">
                  <Check className="w-4 h-4 shrink-0 mt-0.5" />
                  <span className="text-[11px] leading-relaxed">{creationResult.message}</span>
                </div>
              )}

              <button
                onClick={handleCreateProject}
                disabled={isCreating}
                className="w-full py-2.5 px-4 bg-[#58a6ff] hover:bg-[#79b8ff] text-[#0d1117] font-semibold text-xs rounded-xl transition-colors shadow-xs flex items-center justify-center gap-2"
              >
                <FolderPlus className="w-4 h-4" />
                <span>{isCreating ? 'Creating...' : `Create Project in ${baseProjectDir}`}</span>
              </button>
            </div>
          )}

          {activeTab === 'pythonScript' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-semibold text-[#e3e4e8]">Standalone Python Companion (agentdock.py)</h4>
                  <p className="text-[11px] text-[#8b909a]">
                    Run this on your PC to automatically create <code className="text-[#58a6ff]">{baseProjectDir}</code> and bridge Ollama streaming.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCopyScript}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#21262d] hover:bg-[#2d333b] border border-[#30363d] text-[#e3e4e8] transition-colors"
                  >
                    {copiedScript ? <CheckCheck className="w-3.5 h-3.5 text-[#3fb950]" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedScript ? 'Copied' : 'Copy'}</span>
                  </button>

                  <button
                    onClick={handleDownloadScript}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#23422d] hover:bg-[#2c5339] border border-[#2ea043]/40 text-[#3fb950] font-semibold transition-colors shadow-xs"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download agentdock.py</span>
                  </button>
                </div>
              </div>

              {/* How to run banner */}
              <div className="bg-[#121316] p-2.5 rounded-xl border border-[#24262d] font-mono text-[11px] text-[#58a6ff] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-[#e3b341]" />
                  <span>python agentdock.py</span>
                </div>
                <span className="text-[10px] text-[#6e7480]">Windows CMD / PowerShell / Terminal</span>
              </div>

              {/* Python Code Viewer */}
              <div className="bg-[#121316] border border-[#23252a] rounded-xl p-3 max-h-72 overflow-y-auto font-mono text-[10.5px] text-[#c9d1d9] leading-relaxed select-text">
                <pre className="whitespace-pre">{pythonScript}</pre>
              </div>
            </div>
          )}

          {activeTab === 'bridge' && (
            <div className="space-y-3">
              <div className="p-3 bg-[#131417] rounded-xl border border-[#24262d] space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-[#e3e4e8]">Local Python Bridge Connection</span>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                      bridgeOnline
                        ? 'bg-[#1c3327] text-[#3fb950] border border-[#2ea043]/40'
                        : 'bg-[#3b2b1d] text-[#e3b341] border border-[#d29922]/40'
                    }`}
                  >
                    {bridgeOnline ? 'Connected (Online)' : 'Ready for agentdock.py'}
                  </span>
                </div>

                <p className="text-[11px] text-[#8b909a] leading-relaxed">
                  When you run <code className="text-[#58a6ff]">python agentdock.py</code> on your PC, it creates a local bridge on port 8000 that directly writes files and projects to <code className="text-[#e3e4e8]">{baseProjectDir}</code> with zero CORS limitations.
                </p>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-[#e3e4e8] block">Bridge URL</label>
                <input
                  type="text"
                  readOnly
                  value={pythonBridgeUrl}
                  className="w-full bg-[#121316] border border-[#2a2d36] rounded-lg px-3 py-2 text-xs font-mono text-[#a4a8b2]"
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="h-12 border-t border-[#252730] px-5 flex items-center justify-end bg-[#15161a]">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg text-xs font-medium text-[#8b909a] hover:text-[#e3e4e8] hover:bg-[#202228] transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
