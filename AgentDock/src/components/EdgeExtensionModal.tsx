import React, { useState, useEffect } from 'react';
import { 
  X, 
  Globe, 
  ExternalLink, 
  Check, 
  Copy, 
  Folder, 
  Sparkles, 
  Compass, 
  FileCode, 
  CheckCheck, 
  RefreshCw,
  Layers,
  ArrowRight,
  Monitor
} from 'lucide-react';
import { EdgeTabContent } from '../types/chat';

interface EdgeExtensionModalProps {
  isOpen: boolean;
  onClose: () => void;
  baseProjectDir?: string;
  onInjectTabContent?: (tab: EdgeTabContent) => void;
}

export const EdgeExtensionModal: React.FC<EdgeExtensionModalProps> = ({
  isOpen,
  onClose,
  baseProjectDir = '~/AgentDock',
  onInjectTabContent,
}) => {
  const [activeTab, setActiveTab] = useState<EdgeTabContent | null>(null);
  const [loading, setLoading] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [testUrl, setTestUrl] = useState('https://fastapi.tiangolo.com');
  const [openTabMsg, setOpenTabMsg] = useState<string | null>(null);

  const extensionFolder = `${baseProjectDir}/edge-extension`;

  useEffect(() => {
    if (isOpen) {
      fetchActiveTab();
      const interval = setInterval(fetchActiveTab, 3000);
      return () => clearInterval(interval);
    }
  }, [isOpen]);

  const fetchActiveTab = async () => {
    try {
      const res = await fetch('/api/edge-extension/active-tab').catch(() => null);
      if (res && res.ok) {
        const data = await res.json();
        if (data.url) {
          setActiveTab(data);
        }
      }
    } catch {
      // offline
    }
  };

  if (!isOpen) return null;

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleOpenTabTest = async () => {
    if (!testUrl.trim()) return;
    setOpenTabMsg('Opening tab...');
    try {
      await fetch('/api/edge-extension/open-tab', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: testUrl }),
      });
      setOpenTabMsg('Tab requested! If Edge is connected, it will open.');
      setTimeout(() => setOpenTabMsg(null), 3000);
    } catch {
      setOpenTabMsg('Failed to open tab');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 z-50 select-none animate-in fade-in duration-150">
      <div className="bg-[#181920] border border-[#2c2f3d] rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="h-14 border-b border-[#252733] px-5 flex items-center justify-between bg-[#14151a]">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#0078d4] via-[#9B72CB] to-[#20b2aa] flex items-center justify-center shadow-md">
              <Compass className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-white">Agent Dock Copilot - Edge Side Panel</h3>
                <span className="text-[10px] px-2 py-0.2 rounded-full bg-[#1e2f24] text-[#7ee787] font-mono border border-[#2ea043]/30">
                  Permanent Side Panel
                </span>
                <span className="text-[10px] px-2 py-0.2 rounded-full bg-[#1c2333] text-[#58a6ff] font-mono border border-[#58a6ff]/30">
                  Manifest V3
                </span>
              </div>
              <p className="text-[11px] text-[#8b90a0]">
                Docked permanently on the right of Microsoft Edge — never closes on outside clicks, connected to localhost:3000
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-[#252834] rounded-lg text-[#8b90a0] hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-4 text-xs select-text">
          {/* Active Tab Live Monitor Card */}
          <div className="p-4 rounded-xl bg-[#14161d] border border-[#272b38] space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className={`w-2.5 h-2.5 rounded-full ${activeTab?.title ? 'bg-[#3fb950] animate-pulse' : 'bg-[#e3b341]'}`} />
                <span className="font-semibold text-white text-xs">Active Microsoft Edge Tab</span>
              </div>
              <button
                onClick={fetchActiveTab}
                className="text-[11px] text-[#58a6ff] hover:underline flex items-center gap-1"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Refresh Tab</span>
              </button>
            </div>

            {activeTab?.title ? (
              <div className="space-y-2 bg-[#101115] p-3 rounded-lg border border-[#212430]">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-semibold text-white text-[12.5px] line-clamp-1">
                      {activeTab.title}
                    </div>
                    <div className="text-[11px] text-[#58a6ff] font-mono truncate max-w-lg mt-0.5">
                      {activeTab.url}
                    </div>
                  </div>
                  {onInjectTabContent && (
                    <button
                      onClick={() => {
                        onInjectTabContent(activeTab);
                        onClose();
                      }}
                      className="px-3 py-1 bg-[#233526] hover:bg-[#2e4432] border border-[#2ea043]/40 text-[#7ee787] rounded-lg text-xs font-semibold shrink-0 transition-colors flex items-center gap-1"
                    >
                      <Sparkles className="w-3 h-3" />
                      <span>Ask AI About This</span>
                    </button>
                  )}
                </div>

                {activeTab.content && (
                  <div className="text-[11px] text-[#8b90a0] line-clamp-2 bg-[#15171e] p-2 rounded border border-[#262835] font-mono">
                    {activeTab.content}
                  </div>
                )}
              </div>
            ) : (
              <div className="p-3 rounded-lg bg-[#111216] border border-[#232530] text-[#8b90a0] text-xs flex items-center justify-between">
                <span>Waiting for Edge connection. Install the extension below to connect live tabs!</span>
                <span className="font-mono text-[10px] text-[#e3b341]">edge-extension</span>
              </div>
            )}
          </div>

          {/* Quick Install Guide (3 Steps) */}
          <div className="space-y-2">
            <h4 className="font-bold text-white text-xs uppercase tracking-wider text-[#8b90a0]">
              How to Install in Microsoft Edge (3 Steps):
            </h4>

            <div className="grid grid-cols-1 gap-2.5">
              {/* Step 1 */}
              <div className="p-3 rounded-xl bg-[#13141a] border border-[#242633] flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-[#0078d4]/20 text-[#58a6ff] font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                  1
                </div>
                <div className="flex-1 space-y-1">
                  <span className="font-semibold text-white block">Open Edge Extensions Page</span>
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

              {/* Step 2 */}
              <div className="p-3 rounded-xl bg-[#13141a] border border-[#242633] flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-[#9b72cb]/20 text-[#d2a8ff] font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                  2
                </div>
                <div className="flex-1 space-y-0.5">
                  <span className="font-semibold text-white block">Turn ON Developer Mode</span>
                  <p className="text-[11px] text-[#8b90a0]">
                    In Microsoft Edge, toggle the switch in the left sidebar that says <strong>Developer mode</strong>.
                  </p>
                </div>
              </div>

              {/* Step 3 */}
              <div className="p-3 rounded-xl bg-[#13141a] border border-[#242633] flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-[#3fb950]/20 text-[#7ee787] font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                  3
                </div>
                <div className="flex-1 space-y-1">
                  <span className="font-semibold text-white block">Click "Load unpacked" & Select Folder:</span>
                  <div className="flex items-center justify-between bg-[#1a1c24] px-2.5 py-1.5 rounded-lg border border-[#2c3040] font-mono text-[11px]">
                    <span className="text-[#e3b341] truncate">{extensionFolder}</span>
                    <button
                      onClick={() => copyToClipboard(extensionFolder, 'folder-path')}
                      className="text-[#8b90a0] hover:text-white flex items-center gap-1 shrink-0 ml-2"
                    >
                      {copiedKey === 'folder-path' ? <Check className="w-3 h-3 text-[#3fb950]" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedKey === 'folder-path' ? 'Copied' : 'Copy Path'}</span>
                    </button>
                  </div>
                  <p className="text-[10.5px] text-[#7d8590] mt-1">
                    *(If you already loaded it previously, just click the 🔄 <strong>Reload</strong> icon next to the extension on <code className="text-[#58a6ff]">edge://extensions</code>)*
                  </p>
                </div>
              </div>

              {/* Side Panel Behavior Highlight */}
              <div className="p-3 rounded-xl bg-gradient-to-r from-[#1c2438] to-[#1c1d29] border border-[#3b4c73]/40 flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-[#0078d4]/30 text-[#58a6ff] font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                  ✦
                </div>
                <div className="flex-1 space-y-0.5">
                  <span className="font-semibold text-[#79b8ff] block">Permanent Docked Side Panel (Like Copilot / ChatGPT)</span>
                  <p className="text-[11px] text-[#c9d1d9] leading-relaxed">
                    Click the extension icon in Edge to open the side panel on the right. It <strong>stays permanently open</strong> while you browse different tabs, read documentation, and type — it will never dismiss on outside clicks. All chat queries and code generation connect directly to your local Agent Dock app on <span className="font-mono text-[#7ee787]">localhost:3000</span>!
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Open Tab in Edge Tool */}
          <div className="p-3.5 rounded-xl bg-[#14151a] border border-[#252835] space-y-2">
            <span className="font-semibold text-white block text-xs">Test Opening a Tab in Edge</span>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={testUrl}
                onChange={(e) => setTestUrl(e.target.value)}
                placeholder="https://..."
                className="flex-1 bg-[#101115] border border-[#2c2f3d] rounded-lg px-3 py-1.5 text-xs font-mono text-[#e3e4e8] outline-none"
              />
              <button
                onClick={handleOpenTabTest}
                className="px-3.5 py-1.5 bg-[#0078d4] hover:bg-[#106ebe] text-white font-semibold rounded-lg text-xs transition-colors shrink-0"
              >
                Open Tab
              </button>
            </div>
            {openTabMsg && (
              <span className="text-[11px] text-[#7ee787] font-mono block">{openTabMsg}</span>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3 border-t border-[#252733] bg-[#14151a] flex items-center justify-between text-xs">
          <span className="text-[#8b90a0] font-mono">
            Location: {extensionFolder}
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-[#252834] hover:bg-[#303444] text-white rounded-lg font-medium transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
