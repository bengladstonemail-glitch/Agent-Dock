import React from 'react';
import { 
  Bot, 
  Terminal, 
  Cpu, 
  Settings, 
  Plus, 
  PanelLeftClose, 
  PanelLeft, 
  Columns, 
  MessageSquare, 
  Code2, 
  Sparkles,
  ChevronDown,
  Check,
  FolderPlus,
  FileCode,
  Eye,
  Smartphone,
  Download,
  Compass
} from 'lucide-react';
import { OllamaModel, OllamaSettings } from '../types/chat';

interface TopNavProps {
  onOpenFolder?: (path?: string) => void;
  projectBusy?: boolean;
  models: OllamaModel[];
  settings: OllamaSettings;
  onUpdateSettings: (newSettings: Partial<OllamaSettings>) => void;
  connectionStatus: { ok: boolean; checking: boolean; version?: string; error?: string; bridgeOnline?: boolean };
  onOpenSettings: () => void;
  onOpenAgentDock: () => void;
  onNewChat: () => void;
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
  layoutMode: 'split' | 'chat' | 'composer';
  onChangeLayoutMode: (mode: 'split' | 'chat' | 'composer') => void;
  activeFilePath?: string;
  activeProjectName?: string;
  terminalOpen?: boolean;
  onToggleTerminal?: () => void;
  onSwitchToAndroid?: () => void;
  onOpenApkModal?: () => void;
  onOpenEdgeModal?: () => void;
  edgeEnabled?: boolean;
  onToggleEdge?: () => void;
  onOpenEdgeSettings?: () => void;
}

export const TopNav: React.FC<TopNavProps> = ({
  onOpenFolder,
  projectBusy = false,
  models,
  settings,
  onUpdateSettings,
  connectionStatus,
  onOpenSettings,
  onOpenAgentDock,
  onNewChat,
  sidebarOpen,
  onToggleSidebar,
  layoutMode,
  onChangeLayoutMode,
  activeFilePath,
  activeProjectName,
  terminalOpen = false,
  onToggleTerminal,
  onSwitchToAndroid,
  onOpenApkModal,
  onOpenEdgeModal,
  edgeEnabled = false,
  onToggleEdge,
  onOpenEdgeSettings,
}) => {
  const [modelDropdownOpen, setModelDropdownOpen] = React.useState(false);
  const dropdownRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setModelDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedModelObj = models.find((m) => m.name === settings.selectedModel);

  return (
    <header className="h-11 bg-[#141518] border-b border-[#23252a] px-3 flex items-center justify-between text-xs select-none z-30">
      {onOpenFolder && <div className="flex items-center gap-1 shrink-0"><button disabled={projectBusy} onClick={()=>onOpenFolder()} className="px-2 py-1 rounded border border-[#303744] text-[#79b8ff] disabled:opacity-50" title="Choose any project folder">Open Folder</button><button disabled={projectBusy} onClick={()=>{const value=window.prompt('Enter the full project folder path');if(value?.trim())onOpenFolder(value.trim());}} title="Enter folder path" className="px-1 text-[#8b909a]">…</button></div>}
      {/* Zone 1: Window controls & Workspace Path (~/AgentDock) */}
      <div className="flex items-center gap-3 shrink-0">
        {/* macOS traffic dots */}
        <div className="flex items-center gap-1.5 pr-2">
          <div className="w-2.5 h-2.5 rounded-full bg-[#ff5f56] opacity-80 hover:opacity-100 transition-opacity" />
          <div className="w-2.5 h-2.5 rounded-full bg-[#ffbd2e] opacity-80 hover:opacity-100 transition-opacity" />
          <div className="w-2.5 h-2.5 rounded-full bg-[#27c93f] opacity-80 hover:opacity-100 transition-opacity" />
        </div>

        <button
          onClick={onToggleSidebar}
          title={sidebarOpen ? 'Collapse Sidebar' : 'Expand Sidebar'}
          className="p-1 hover:bg-[#202227] rounded text-[#8b909a] hover:text-[#e3e4e8] transition-colors"
        >
          {sidebarOpen ? <PanelLeftClose className="w-3.5 h-3.5" /> : <PanelLeft className="w-3.5 h-3.5" />}
        </button>

        {/* Workspace & Agent Dock Breadcrumb */}
        <button
          onClick={onOpenAgentDock}
          className="flex items-center gap-1.5 px-2 py-0.5 rounded hover:bg-[#1f2127] text-[#8b909a] hover:text-[#e3e4e8] font-mono text-[11px] truncate max-w-[320px] transition-colors group"
          title="Click to manage Agent Dock projects in ~/AgentDock"
        >
          <FolderPlus className="w-3 h-3 text-[#e3b341] shrink-0" />
          <span className="text-[#e3b341] font-semibold">Agent Dock</span>
          <span>/</span>
          <span className="text-[#a4a8b2] truncate">{activeProjectName || 'C:..user\\Agent Dock'}</span>
          <span>/</span>
          <span className="truncate text-[#e3e4e8]">{activeFilePath?.split('/').pop() || 'main.py'}</span>
        </button>
      </div>

      {/* Zone 2: View Layout Switcher & Model Pill */}
      <div className="flex items-center gap-2">
        {/* Layout Modes */}
        <div className="flex items-center bg-[#1c1d22] p-0.5 rounded-md border border-[#2b2d35]">
          <button
            onClick={() => onChangeLayoutMode('split')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${
              layoutMode === 'split'
                ? 'bg-[#2b2e38] text-white shadow-xs'
                : 'text-[#8b909a] hover:text-[#e3e4e8]'
            }`}
            title="Split Editor & Chat (Cmd+L)"
          >
            <Columns className="w-3 h-3" />
            <span className="hidden sm:inline">Split</span>
          </button>
          <button
            onClick={() => onChangeLayoutMode('chat')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${
              layoutMode === 'chat'
                ? 'bg-[#2b2e38] text-white shadow-xs'
                : 'text-[#8b909a] hover:text-[#e3e4e8]'
            }`}
            title="Full Chat View"
          >
            <MessageSquare className="w-3 h-3" />
            <span className="hidden sm:inline">Chat</span>
          </button>
          <button
            onClick={() => onChangeLayoutMode('composer')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${
              layoutMode === 'composer'
                ? 'bg-[#2b2e38] text-white shadow-xs'
                : 'text-[#8b909a] hover:text-[#e3e4e8]'
            }`}
            title="Composer Agent (Cmd+I)"
          >
            <Sparkles className="w-3 h-3 text-[#58a6ff]" />
            <span className="hidden sm:inline">Composer</span>
          </button>
        </div>

        {/* Model Selector Dropdown with Vision/Reasoning tags */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setModelDropdownOpen(!modelDropdownOpen)}
            className="flex items-center gap-1.5 bg-[#1b1c20] hover:bg-[#23252b] border border-[#2d3038] px-2.5 py-1 rounded-md text-[#dcdfe6] text-[11px] font-mono transition-colors"
          >
            <Cpu className="w-3 h-3 text-[#58a6ff]" />
            <span className="font-semibold truncate max-w-[120px]">{settings.selectedModel || 'Select model'}</span>
            {selectedModelObj?.supportsVision && (
              <span className="text-[9px] px-1 py-0.2 bg-[#1c3327] text-[#3fb950] rounded border border-[#2ea043]/30">
                Vision
              </span>
            )}
            {selectedModelObj?.supportsThinking && (
              <span className="text-[9px] px-1 py-0.2 bg-[#2d2238] text-[#d2a8ff] rounded border border-[#4c3562]">
                Reason
              </span>
            )}
            <ChevronDown className="w-3 h-3 text-[#8b909a]" />
          </button>

          {modelDropdownOpen && (
            <div className="absolute right-0 mt-1 w-72 bg-[#18191d] border border-[#2a2c34] rounded-lg shadow-2xl py-1 z-50 overflow-hidden">
              <div className="px-3 py-1.5 text-[10px] uppercase font-semibold text-[#6e7480] tracking-wider border-b border-[#23252a] flex items-center justify-between">
                <span>Installed PC Models</span>
                <span className="text-[#8b909a] lowercase">{models.length} installed</span>
              </div>
              <div className="max-h-64 overflow-y-auto py-1">
                {models.map((m) => (
                  <button
                    key={m.name}
                    onClick={() => {
                      onUpdateSettings({ selectedModel: m.name });
                      setModelDropdownOpen(false);
                    }}
                    className={`w-full px-3 py-2 text-left flex items-start justify-between hover:bg-[#23262e] transition-colors ${
                      settings.selectedModel === m.name ? 'bg-[#1f222a]' : ''
                    }`}
                  >
                    <div className="pr-2 truncate">
                      <div className="flex items-center gap-1.5 font-mono text-[11px] text-[#e3e4e8]">
                        <span className="font-semibold truncate">{m.name}</span>
                        {m.supportsVision && (
                          <span className="text-[9px] px-1 bg-[#1c3327] text-[#3fb950] rounded shrink-0">
                            Vision
                          </span>
                        )}
                        {m.supportsThinking && (
                          <span className="text-[9px] px-1 bg-[#342446] text-[#d2a8ff] rounded shrink-0">
                            Think
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-[#8b909a] line-clamp-1 mt-0.5">
                        {m.description}
                      </div>
                    </div>
                    {settings.selectedModel === m.name && (
                      <Check className="w-3.5 h-3.5 text-[#58a6ff] shrink-0 mt-0.5" />
                    )}
                  </button>
                ))}
              </div>
              <div className="p-2 border-t border-[#23252a] bg-[#141518] flex items-center justify-between text-[11px]">
                <button
                  onClick={() => {
                    setModelDropdownOpen(false);
                    onOpenAgentDock();
                  }}
                  className="text-[#e3b341] hover:underline flex items-center gap-1"
                >
                  <FolderPlus className="w-3 h-3" />
                  <span>Agent Dock Hub</span>
                </button>
                <button
                  onClick={() => {
                    setModelDropdownOpen(false);
                    onOpenSettings();
                  }}
                  className="text-[#58a6ff] hover:underline"
                >
                  Configure Host...
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Zone 3: Agent Dock Hub Button & Connection Status */}
      <div className="flex items-center gap-2">
        {/* Switch to Android Gemini View */}
        {onSwitchToAndroid && (
          <button
            onClick={onSwitchToAndroid}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gradient-to-r from-[#9B72CB]/25 to-[#4285F4]/25 hover:from-[#9B72CB]/40 hover:to-[#4285F4]/40 border border-[#9B72CB]/40 text-[#d2a8ff] text-[11px] font-semibold transition-all shadow-xs"
            title="Switch to Android Gemini Mode (Simple chat + Agent, no terminals)"
          >
            <Smartphone className="w-3.5 h-3.5 text-[#d2a8ff]" />
            <span className="hidden sm:inline">Android View</span>
          </button>
        )}

        {/* Get APK modal button */}
        {onOpenApkModal && (
          <button
            onClick={onOpenApkModal}
            className="hidden md:flex items-center gap-1 px-2 py-1 rounded bg-[#181a1f] hover:bg-[#22252c] border border-[#2a2d36] text-[11px] font-mono text-[#7ee787] hover:text-[#3fb950] transition-colors"
            title="Download Android APK / Install on Phone"
          >
            <Download className="w-3 h-3 text-[#3fb950]" />
            <span>APK</span>
          </button>
        )}

        {/* Edge Context Toggle Button (OFF by default) */}
        <button
          onClick={onToggleEdge || onOpenEdgeSettings}
          className={`hidden sm:flex items-center gap-1.5 px-2 py-1 rounded text-[11px] font-medium transition-colors border ${
            edgeEnabled
              ? 'bg-[#15273b] text-[#79b8ff] border-[#0078d4]/60'
              : 'bg-[#181a1f] hover:bg-[#22252c] border-[#2a2d36] text-[#8b90a0] hover:text-[#e3e4e8]'
          }`}
          title={
            edgeEnabled
              ? 'Edge Browser Context: ON (Click to turn OFF)'
              : 'Edge Browser Context: OFF (Click to turn ON, or open Settings for Edge)'
          }
        >
          <Compass className={`w-3.5 h-3.5 ${edgeEnabled ? 'text-[#58a6ff]' : 'text-[#8b90a0]'}`} />
          <span className="hidden lg:inline">Edge</span>
          <span className={`text-[9px] px-1 py-0.2 rounded font-mono ${edgeEnabled ? 'bg-[#0078d4]/30 text-[#79b8ff]' : 'bg-[#252834] text-[#6e7480]'}`}>
            {edgeEnabled ? 'ON' : 'OFF'}
          </span>
        </button>

        {/* Terminal Toggle Button (VS Code style) */}
        <button
          onClick={onToggleTerminal}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-medium transition-colors border ${
            terminalOpen
              ? 'bg-[#1e2638] text-[#58a6ff] border-[#388bfd]/50'
              : 'bg-[#181a1f] hover:bg-[#22252c] border-[#2a2d36] text-[#a4a8b2] hover:text-[#e3e4e8]'
          }`}
          title="Toggle Integrated Terminal (Ctrl + `)"
        >
          <Terminal className="w-3 h-3 text-[#58a6ff]" />
          <span className="hidden sm:inline">Terminal</span>
        </button>

        {/* Python Companion Launcher Button */}
        <button
          onClick={onOpenAgentDock}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#20271c] hover:bg-[#293522] border border-[#3fb950]/30 text-[#7ee787] text-[11px] font-medium transition-colors"
          title="Open Agent Dock Project Hub & Python script (~/AgentDock)"
        >
          <FileCode className="w-3 h-3 text-[#3fb950]" />
          <span className="hidden lg:inline">agentdock.py</span>
        </button>

        {/* Ollama Connection Indicator */}
        <button
          onClick={onOpenSettings}
          className="flex items-center gap-1.5 px-2 py-1 rounded bg-[#181a1f] hover:bg-[#22252c] border border-[#2a2d36] text-[11px] font-mono text-[#a2a6b0] transition-colors"
          title={`Ollama: ${settings.baseUrl} (${connectionStatus.ok ? 'Connected' : 'Click to configure'})`}
        >
          {connectionStatus.checking ? (
            <div className="w-2 h-2 rounded-full bg-[#e3b341] animate-pulse" />
          ) : connectionStatus.ok ? (
            <div className="w-2 h-2 rounded-full bg-[#3fb950]" />
          ) : (
            <div className="w-2 h-2 rounded-full bg-[#f85149]" />
          )}
          <span className="hidden md:inline">
            {connectionStatus.checking
              ? 'Probing PC...'
              : connectionStatus.ok
              ? 'PC Ollama'
              : 'Simulated'}
          </span>
        </button>

        {/* New Chat */}
        <button
          onClick={onNewChat}
          className="flex items-center gap-1 px-2.5 py-1 rounded bg-[#21262d] hover:bg-[#30363d] text-[#e3e4e8] font-medium text-[11px] transition-colors border border-[#30363d]"
          title="New Chat (Cmd+N)"
        >
          <Plus className="w-3 h-3 text-[#58a6ff]" />
          <span className="hidden sm:inline">New Chat</span>
        </button>

        {/* Settings button */}
        <button
          onClick={onOpenSettings}
          className="p-1.5 hover:bg-[#22252c] rounded text-[#8b909a] hover:text-[#e3e4e8] transition-colors"
          title="Settings"
        >
          <Settings className="w-3.5 h-3.5" />
        </button>
      </div>
    </header>
  );
};
