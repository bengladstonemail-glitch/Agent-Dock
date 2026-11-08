import React, { useState, useEffect, useRef } from 'react';
import { 
  Bot, 
  User, 
  Copy, 
  Check, 
  ChevronDown, 
  ChevronRight, 
  Play, 
  Sparkles, 
  FileCode, 
  CheckCheck, 
  FileText,
  Image as ImageIcon,
  FolderPlus,
  Terminal,
  Cpu,
  Layers,
  Globe,
  Compass,
  ExternalLink
} from 'lucide-react';
import { ChatMessage, ContextTag, DiffBlock, WorkspaceFile, AttachedMedia } from '../types/chat';
import { extractCodeBlocks, extractThinkingTrace, createUnifiedDiff } from '../utils/diffHelper';

interface ChatPanelProps {
  messages: ChatMessage[];
  isStreaming: boolean;
  onApplyCode: (code: string, filename?: string) => void;
  workspaceFiles: WorkspaceFile[];
  onSelectSuggestion?: (prompt: string) => void;
  selectedModel: string;
  baseProjectDir?: string;
  onOpenAgentDock?: () => void;
}

export const ChatPanel: React.FC<ChatPanelProps> = ({
  messages,
  isStreaming,
  onApplyCode,
  workspaceFiles,
  onSelectSuggestion,
  selectedModel,
  baseProjectDir = '~/AgentDock',
  onOpenAgentDock,
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [expandedThinking, setExpandedThinking] = useState<Record<string, boolean>>({});
  const [copiedCodeId, setCopiedCodeId] = useState<string | null>(null);
  const [appliedCodeBlocks, setAppliedCodeBlocks] = useState<Record<string, boolean>>({});
  const [selectedPreviewImage, setSelectedPreviewImage] = useState<string | null>(null);

  // Auto-scroll to bottom during streaming
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isStreaming]);

  const toggleThinking = (msgId: string) => {
    setExpandedThinking((prev) => ({
      ...prev,
      [msgId]: !prev[msgId],
    }));
  };

  const handleCopyCode = (code: string, id: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCodeId(id);
    setTimeout(() => setCopiedCodeId(null), 2000);
  };

  const handleApply = (code: string, filename?: string, blockKey?: string) => {
    onApplyCode(code, filename);
    if (blockKey) {
      setAppliedCodeBlocks((prev) => ({ ...prev, [blockKey]: true }));
      setTimeout(() => {
        setAppliedCodeBlocks((prev) => ({ ...prev, [blockKey]: false }));
      }, 3000);
    }
  };

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center select-none bg-[#121316]">
        <div className="w-12 h-12 rounded-2xl bg-[#1c222f] border border-[#2e3b54] flex items-center justify-center mb-3 text-[#58a6ff] shadow-lg">
          <Sparkles className="w-6 h-6" />
        </div>
        <h2 className="text-base font-semibold text-[#e3e4e8] mb-1">
          Agent Dock Ollama Assistant
        </h2>
        <div className="flex items-center gap-1.5 font-mono text-[11px] text-[#e3b341] bg-[#221f15] px-2.5 py-1 rounded-md border border-[#483d21] mb-4">
          <FolderPlus className="w-3.5 h-3.5" />
          <span>Active Project Directory: {baseProjectDir}</span>
        </div>
        <p className="text-xs text-[#8b909a] max-w-md mb-6 leading-relaxed">
          Select any model installed on your PC, paste images and documents (<kbd className="px-1 py-0.5 bg-[#1b1d23] text-[#c9d1d9] rounded border border-[#2b2e36] text-[10px]">Ctrl+V</kbd>), stream answers in real-time, and run in <strong>Agent Mode</strong> to generate full Python projects.
        </p>

        {/* Suggested Quick Prompts */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-lg text-left">
          <button
            onClick={() =>
              onSelectSuggestion?.(
                `Create a complete FastAPI project in ${baseProjectDir} with healthcheck, CORS, and Ollama proxy streaming`
              )
            }
            className="p-2.5 rounded-lg bg-[#18191d] hover:bg-[#1f2128] border border-[#262830] hover:border-[#388bfd]/50 text-xs transition-colors group"
          >
            <div className="font-semibold text-[#e3e4e8] group-hover:text-[#58a6ff] flex items-center gap-1.5">
              <FolderPlus className="w-3.5 h-3.5 text-[#e3b341]" />
              <span>Create FastAPI Project</span>
            </div>
            <div className="text-[11px] text-[#8b909a] mt-1 line-clamp-1">
              Build service in {baseProjectDir}
            </div>
          </button>

          <button
            onClick={() =>
              onSelectSuggestion?.(
                'How does DeepSeek R1 reasoning work when analyzing Python code vs standard instruct models?'
              )
            }
            className="p-2.5 rounded-lg bg-[#18191d] hover:bg-[#1f2128] border border-[#262830] hover:border-[#d2a8ff]/50 text-xs transition-colors group"
          >
            <div className="font-semibold text-[#e3e4e8] group-hover:text-[#d2a8ff] flex items-center gap-1.5">
              <Cpu className="w-3.5 h-3.5 text-[#d2a8ff]" />
              <span>DeepSeek R1 Thinking</span>
            </div>
            <div className="text-[11px] text-[#8b909a] mt-1 line-clamp-1">
              Inspect step-by-step reasoning trace
            </div>
          </button>

          <button
            onClick={() =>
              onSelectSuggestion?.(
                `Write a Python data pipeline in ${baseProjectDir} using Pandas that parses JSON logs and outputs CSV metrics`
              )
            }
            className="p-2.5 rounded-lg bg-[#18191d] hover:bg-[#1f2128] border border-[#262830] hover:border-[#3fb950]/50 text-xs transition-colors group"
          >
            <div className="font-semibold text-[#e3e4e8] group-hover:text-[#3fb950] flex items-center gap-1.5">
              <FileCode className="w-3.5 h-3.5 text-[#3fb950]" />
              <span>Python Data Pipeline</span>
            </div>
            <div className="text-[11px] text-[#8b909a] mt-1 line-clamp-1">
              Generate Pandas script & requirements
            </div>
          </button>

          <button
            onClick={() =>
              onSelectSuggestion?.(
                'Explain how agentdock.py bridges local Ollama streaming on port 8000 to eliminate browser CORS'
              )
            }
            className="p-2.5 rounded-lg bg-[#18191d] hover:bg-[#1f2128] border border-[#262830] hover:border-[#e3b341]/50 text-xs transition-colors group"
          >
            <div className="font-semibold text-[#e3e4e8] group-hover:text-[#e3b341] flex items-center gap-1.5">
              <Terminal className="w-3.5 h-3.5 text-[#e3b341]" />
              <span>agentdock.py Companion</span>
            </div>
            <div className="text-[11px] text-[#8b909a] mt-1 line-clamp-1">
              Native Python bridge for your PC
            </div>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-6 select-text bg-[#121316]">
      {/* Lightbox Image Preview Modal */}
      {selectedPreviewImage && (
        <div
          onClick={() => setSelectedPreviewImage(null)}
          className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 cursor-pointer"
        >
          <img
            src={selectedPreviewImage}
            alt="Preview"
            className="max-h-[85vh] max-w-[85vw] rounded-xl object-contain shadow-2xl"
          />
        </div>
      )}

      {messages.map((msg, index) => {
        const isUser = msg.role === 'user';
        const isLast = index === messages.length - 1;

        if (isUser) {
          return (
            <div key={msg.id} className="flex flex-col items-end gap-1.5 group">
              {/* Context pills if any */}
              {msg.contextTags && msg.contextTags.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5">
                  {msg.contextTags.map((tag) => (
                    <span
                      key={tag.id}
                      className="px-2 py-0.5 rounded bg-[#1e222b] text-[#58a6ff] text-[10px] font-mono border border-[#2e3747] flex items-center gap-1"
                    >
                      <FileCode className="w-2.5 h-2.5" />
                      <span>{tag.label}</span>
                    </span>
                  ))}
                </div>
              )}

              {/* Attached Media Cards (Pasted Images & Files) */}
              {msg.attachedMedia && msg.attachedMedia.length > 0 && (
                <div className="flex flex-wrap gap-2 justify-end max-w-[85%]">
                  {msg.attachedMedia.map((media) => {
                    if (media.type === 'image' && media.previewUrl) {
                      return (
                        <div
                          key={media.id}
                          onClick={() => setSelectedPreviewImage(media.previewUrl || null)}
                          className="relative group/img cursor-pointer rounded-xl overflow-hidden border border-[#30363d] bg-[#161a22] shadow-md hover:border-[#58a6ff] transition-all"
                        >
                          <img
                            src={media.previewUrl}
                            alt={media.name}
                            className="max-h-40 max-w-xs object-cover rounded-xl"
                          />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/img:opacity-100 flex items-center justify-center text-[10px] text-white font-medium transition-opacity">
                            Click to expand
                          </div>
                        </div>
                      );
                    }
                    return (
                      <div
                        key={media.id}
                        className="flex items-center gap-1.5 bg-[#1b222d] border border-[#2a364a] text-[#79c0ff] px-2.5 py-1.5 rounded-lg text-xs font-mono"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        <span className="truncate max-w-[160px]">{media.name}</span>
                        <span className="text-[10px] text-[#6e7480]">
                          ({(media.size / 1024).toFixed(0)} KB)
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* User Bubble */}
              {msg.content && (
                <div className="bg-[#1e222a] text-[#e3e4e8] px-3.5 py-2.5 rounded-2xl rounded-tr-xs text-xs max-w-[85%] leading-relaxed border border-[#2d323e]">
                  <p className="whitespace-pre-wrap font-sans">{msg.content}</p>
                </div>
              )}
            </div>
          );
        }

        // Assistant Message
        const { thinking, content, isStillThinking } = extractThinkingTrace(msg.content);
        const codeBlocks = extractCodeBlocks(content);
        const isThinkingActive = isStreaming && isLast && isStillThinking;
        const isThoughtExpanded = expandedThinking[msg.id] ?? (isThinkingActive || false);

        return (
          <div key={msg.id} className="flex flex-col gap-2">
            {/* Header: Model Badge & Speed Metrics */}
            <div className="flex items-center justify-between text-[11px] font-mono text-[#6e7480] px-1 select-none">
              <div className="flex items-center gap-1.5">
                <Bot className="w-3.5 h-3.5 text-[#58a6ff]" />
                <span className="font-semibold text-[#a4a8b2]">{msg.model || selectedModel}</span>
                {msg.mode === 'agent' && (
                  <span className="text-[9px] px-1.5 py-0.2 bg-[#21262d] text-[#58a6ff] rounded border border-[#30363d] font-semibold">
                    Agent
                  </span>
                )}
                {msg.metrics?.tokensPerSecond && (
                  <>
                    <span>·</span>
                    <span className="text-[#3fb950]">{msg.metrics.tokensPerSecond} tok/s</span>
                  </>
                )}
              </div>
            </div>

            {/* DeepSeek R1 / Reasoning Accordion */}
            {thinking && (
              <div className="bg-[#17151e] border border-[#3b2b4d] rounded-xl overflow-hidden text-xs">
                <button
                  onClick={() => toggleThinking(msg.id)}
                  className="w-full px-3 py-2 flex items-center justify-between hover:bg-[#201c29] transition-colors select-none text-left"
                >
                  <div className="flex items-center gap-2">
                    {isThoughtExpanded ? (
                      <ChevronDown className="w-3.5 h-3.5 text-[#d2a8ff]" />
                    ) : (
                      <ChevronRight className="w-3.5 h-3.5 text-[#d2a8ff]" />
                    )}
                    <span className="font-medium text-[#d2a8ff]">
                      {isThinkingActive ? 'Thinking...' : 'Reasoning Process'}
                    </span>
                    {isThinkingActive && (
                      <span className="inline-flex gap-1 ml-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#d2a8ff] animate-ping" />
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] text-[#8b909a] font-mono">
                    {isThoughtExpanded ? 'Hide trace' : 'View thoughts'}
                  </span>
                </button>

                {isThoughtExpanded && (
                  <div className="px-3 pb-3 pt-1 border-t border-[#292036] font-mono text-[11px] text-[#b392d4] bg-[#131118] whitespace-pre-wrap leading-relaxed max-h-60 overflow-y-auto">
                    {thinking}
                  </div>
                )}
              </div>
            )}

            {/* Live Web Search Sources Card */}
            {msg.webSearchSources && msg.webSearchSources.length > 0 && (
              <div className="bg-[#121c16] border border-[#2ea043]/30 rounded-xl p-2.5 text-xs font-mono space-y-1.5">
                <div className="flex items-center justify-between text-[#7ee787]">
                  <div className="flex items-center gap-1.5 font-semibold text-[11px]">
                    <Globe className="w-3.5 h-3.5 text-[#3fb950]" />
                    <span>Web search ({msg.webSearchSources.length} sources)</span>
                  </div>
                  <span className="text-[10px] text-[#3fb950] font-bold">Search results</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1">
                  {msg.webSearchSources.map((src, idx) => (
                    <a
                      key={idx}
                      href={src.url}
                      target="_blank"
                      rel="noreferrer"
                      className="p-2 rounded-lg bg-[#18261e] hover:bg-[#203328] border border-[#2ea043]/30 block text-left transition-colors group"
                    >
                      <div className="font-semibold text-white text-[11px] truncate group-hover:text-[#7ee787]">
                        {src.title}
                      </div>
                      <div className="text-[10px] text-[#8b90a0] truncate mt-0.5 flex items-center gap-1">
                        <ExternalLink className="w-2.5 h-2.5 text-[#3fb950]" />
                        <span>{src.domain || 'source'}</span>
                      </div>
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* Edge Browser Tab Context Card */}
            {msg.edgeTabContext && (
              <div className="bg-[#141b25] border border-[#0078d4]/30 rounded-xl p-2.5 text-xs font-mono space-y-1">
                <div className="flex items-center justify-between text-[#79b8ff]">
                  <div className="flex items-center gap-1.5 font-semibold text-[11px]">
                    <Compass className="w-3.5 h-3.5 text-[#58a6ff]" />
                    <span>Microsoft Edge Tab: {msg.edgeTabContext.title}</span>
                  </div>
                  <span className="text-[10px] text-[#58a6ff]">Live Edge</span>
                </div>
                <div className="text-[10px] text-[#8b90a0] truncate">
                  {msg.edgeTabContext.url}
                </div>
              </div>
            )}

            {/* Message Body Content */}
            <div className="text-xs text-[#dcdfe6] leading-relaxed space-y-3 font-sans">
              {renderFormattedContent(
                content,
                codeBlocks,
                handleCopyCode,
                copiedCodeId,
                handleApply,
                appliedCodeBlocks,
                workspaceFiles,
                baseProjectDir
              )}
            </div>

            {/* Follow-up suggestions on the latest response */}
            {isLast && !isStreaming && onSelectSuggestion && (
              <div className="flex flex-wrap gap-1.5 pt-2 select-none">
                <button
                  onClick={() => onSelectSuggestion(`Add automated unit tests in ${baseProjectDir} using pytest`)}
                  className="px-2.5 py-1 rounded-md bg-[#181a1f] hover:bg-[#22252c] border border-[#2a2d36] text-[11px] text-[#8b909a] hover:text-[#e3e4e8] transition-colors"
                >
                  + Add pytest suite
                </button>
                <button
                  onClick={() => onSelectSuggestion(`Create a Dockerfile and docker-compose.yml in ${baseProjectDir}`)}
                  className="px-2.5 py-1 rounded-md bg-[#181a1f] hover:bg-[#22252c] border border-[#2a2d36] text-[11px] text-[#8b909a] hover:text-[#e3e4e8] transition-colors"
                >
                  + Add Dockerfile
                </button>
                <button
                  onClick={() => onSelectSuggestion('Refactor with async concurrency and streaming')}
                  className="px-2.5 py-1 rounded-md bg-[#181a1f] hover:bg-[#22252c] border border-[#2a2d36] text-[11px] text-[#8b909a] hover:text-[#e3e4e8] transition-colors"
                >
                  + Async refactoring
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

// Renders markdown content and integrates Cursor's Apply code blocks
function renderFormattedContent(
  text: string,
  codeBlocks: Array<{ language: string; filename?: string; code: string; raw: string }>,
  onCopy: (code: string, id: string) => void,
  copiedId: string | null,
  onApply: (code: string, filename?: string, blockKey?: string) => void,
  appliedMap: Record<string, boolean>,
  workspaceFiles: WorkspaceFile[],
  baseProjectDir: string
) {
  if (codeBlocks.length === 0) {
    return <div className="whitespace-pre-wrap">{text}</div>;
  }

  const segments: React.ReactNode[] = [];
  let remaining = text;

  codeBlocks.forEach((block, idx) => {
    const blockIndex = remaining.indexOf(block.raw);
    if (blockIndex > 0) {
      const prose = remaining.slice(0, blockIndex);
      segments.push(
        <div key={`prose-${idx}`} className="whitespace-pre-wrap">
          {prose}
        </div>
      );
    }

    const isToolOutput = !block.filename && ['text','plaintext','log','output'].includes(block.language.toLowerCase());
    const targetFilename = block.filename || (block.code.includes('FastAPI') || block.code.includes('import requests') ? 'main.py' : 'src/App.tsx');
    const blockKey = `code-${idx}`;
    const isApplied = appliedMap[blockKey];

    segments.push(
      <div
        key={blockKey}
        className="rounded-xl border border-[#292c35] bg-[#16171b] overflow-hidden my-3 shadow-md"
      >
        {/* Code Block Header (Iconic Cursor Code Bar) */}
        <div className="h-8 bg-[#1a1b20] border-b border-[#262830] px-3 flex items-center justify-between text-[11px] font-mono select-none">
          <div className="flex items-center gap-2">
            <FileCode className="w-3.5 h-3.5 text-[#58a6ff]" />
            <span className="text-[#e3e4e8] font-semibold">{isToolOutput ? 'Tool output' : targetFilename}</span>
            <span className="text-[#6e7480] text-[10px] uppercase font-mono">{block.language}</span>
          </div>

          <div className="flex items-center gap-1.5">
            {/* Copy Button */}
            <button
              onClick={() => onCopy(block.code, blockKey)}
              className="flex items-center gap-1 px-2 py-0.5 rounded text-[#8b909a] hover:text-[#e3e4e8] hover:bg-[#252831] transition-colors"
              title="Copy code"
            >
              {copiedId === blockKey ? (
                <>
                  <Check className="w-3 h-3 text-[#3fb950]" />
                  <span className="text-[#3fb950]">Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3 h-3" />
                  <span>Copy</span>
                </>
              )}
            </button>

            {/* Tool results are read-only, never source code patches. */}
            {!isToolOutput && <button
              onClick={() => onApply(block.code, targetFilename, blockKey)}
              className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded text-[11px] font-semibold transition-all shadow-xs ${
                isApplied
                  ? 'bg-[#23422d] text-[#3fb950] border border-[#2ea043]/40'
                  : 'bg-[#1f2d3d] hover:bg-[#283b52] text-[#58a6ff] hover:text-white border border-[#388bfd]/40 cursor-pointer'
              }`}
              title={`Apply into ${baseProjectDir}/${targetFilename}`}
            >
              {isApplied ? (
                <>
                  <Check className="w-3 h-3 text-[#3fb950]" />
                  <span>Applied</span>
                </>
              ) : (
                <>
                  <Play className="w-2.5 h-2.5 fill-current" />
                  <span>Apply</span>
                </>
              )}
            </button>}
          </div>
        </div>

        {/* Code Body */}
        <div className="p-3 overflow-x-auto font-mono text-[11px] leading-5 text-[#c9d1d9] bg-[#121316]">
          <pre className="whitespace-pre">{block.code}</pre>
        </div>
      </div>
    );

    remaining = remaining.slice(blockIndex + block.raw.length);
  });

  if (remaining.trim()) {
    segments.push(
      <div key="prose-final" className="whitespace-pre-wrap">
        {remaining}
      </div>
    );
  }

  return segments;
}
