import React, { useState, useRef, useEffect } from 'react';
import { 
  ArrowUp, 
  Square, 
  AtSign, 
  Sparkles, 
  FileCode, 
  X, 
  Cpu, 
  Paperclip,
  Image as ImageIcon,
  FileText,
  MessageSquare,
  Bot,
  ChevronDown,
  Check,
  FolderPlus,
  Wrench,
  Globe,
  Compass
} from 'lucide-react';
import { ContextTag, WorkspaceFile, OllamaModel, AttachedMedia } from '../types/chat';

interface PromptComposerProps {
  onSendMessage: (
    content: string, 
    contextTags: ContextTag[], 
    attachedMedia: AttachedMedia[],
    mode: 'agent' | 'chat' | 'bagent',
    options?: { enableWebSearch?: boolean; enableEdgeContext?: boolean }
  ) => void;
  isStreaming: boolean;
  onStopStreaming: () => void;
  workspaceFiles: WorkspaceFile[];
  models: OllamaModel[];
  selectedModel: string;
  onSelectModel: (modelName: string) => void;
  initialContextTags?: ContextTag[];
  onRemoveContextTag?: (tagId: string) => void;
  mode: 'agent' | 'chat' | 'bagent';
  onToggleMode: (mode: 'agent' | 'chat' | 'bagent') => void;
  baseProjectDir?: string;
  onOpenAgentDockModal?: () => void;
  onOpenSettings?: () => void;
  mcpEnabled?: boolean;
  onToggleMcp?: () => void;
  onOpenEdgeModal?: () => void;
  edgeEnabled?: boolean;
  onToggleEdge?: () => void;
}

export const PromptComposer: React.FC<PromptComposerProps> = ({
  onSendMessage,
  isStreaming,
  onStopStreaming,
  workspaceFiles,
  models,
  selectedModel,
  onSelectModel,
  initialContextTags = [],
  onRemoveContextTag,
  mode,
  onToggleMode,
  baseProjectDir = '~/AgentDock',
  onOpenAgentDockModal,
  onOpenSettings,
  mcpEnabled = true,
  onToggleMcp,
  onOpenEdgeModal,
  edgeEnabled,
  onToggleEdge,
}) => {
  const [input, setInput] = useState('');
  const [contextTags, setContextTags] = useState<ContextTag[]>(initialContextTags);
  const [attachedMedia, setAttachedMedia] = useState<AttachedMedia[]>([]);
  const [webSearchEnabled, setWebSearchEnabled] = useState(false);
  const [internalEdgeEnabled, setInternalEdgeEnabled] = useState(false);

  const isEdgeOn = edgeEnabled !== undefined ? edgeEnabled : internalEdgeEnabled;
  const toggleEdge = onToggleEdge || (() => setInternalEdgeEnabled((prev) => !prev));
  const [showAtMenu, setShowAtMenu] = useState(false);
  const [modelMenuOpen, setModelMenuOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const atMenuRef = useRef<HTMLDivElement>(null);
  const modelMenuRef = useRef<HTMLDivElement>(null);

  // Sync initial context tags
  useEffect(() => {
    if (initialContextTags.length > 0) {
      setContextTags(initialContextTags);
    }
  }, [initialContextTags]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 180)}px`;
    }
  }, [input]);

  // Click outside to close menus
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (atMenuRef.current && !atMenuRef.current.contains(e.target as Node)) {
        setShowAtMenu(false);
      }
      if (modelMenuRef.current && !modelMenuRef.current.contains(e.target as Node)) {
        setModelMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Handle Clipboard Paste (Images & Files)
  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData.items;
    let foundMedia = false;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];

      // 1. Image paste (screenshot from clipboard)
      if (item.type.indexOf('image') !== -1) {
        foundMedia = true;
        const file = item.getAsFile();
        if (file) {
          processImageFile(file);
        }
      }
      // 2. File / Document paste
      else if (item.kind === 'file') {
        foundMedia = true;
        const file = item.getAsFile();
        if (file) {
          processTextDocument(file);
        }
      }
    }

    if (foundMedia) {
      // Allow default text paste only if not a pure image
      setTimeout(() => {
        if (textareaRef.current) textareaRef.current.focus();
      }, 50);
    }
  };

  const processImageFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      const newMedia: AttachedMedia = {
        id: `img-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        type: 'image',
        name: file.name || `Pasted Image ${new Date().toLocaleTimeString()}`,
        size: file.size,
        mimeType: file.type || 'image/png',
        base64,
        previewUrl: base64,
      };
      setAttachedMedia((prev) => [...prev, newMedia]);
    };
    reader.readAsDataURL(file);
  };

  const processTextDocument = (file: File) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const newMedia: AttachedMedia = {
        id: `file-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        type: 'file',
        name: file.name,
        size: file.size,
        mimeType: file.type || 'text/plain',
        textContent: text,
      };
      setAttachedMedia((prev) => [...prev, newMedia]);
    };
    reader.readAsText(file);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file.type.startsWith('image/')) {
        processImageFile(file);
      } else {
        processTextDocument(file);
      }
    }
    // Reset file input
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Drag and drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (!files || files.length === 0) return;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file.type.startsWith('image/')) {
        processImageFile(file);
      } else {
        processTextDocument(file);
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === '@') {
      setShowAtMenu(true);
    } else if (e.key === 'Escape') {
      setShowAtMenu(false);
      setModelMenuOpen(false);
    } else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleSubmit = () => {
    if ((!input.trim() && attachedMedia.length === 0) || isStreaming) return;
    const finalContent = webSearchEnabled && !input.toLowerCase().includes('@web')
      ? `@web ${input.trim()}`
      : input.trim();
    onSendMessage(finalContent, contextTags, attachedMedia, mode, {
      enableWebSearch: webSearchEnabled,
      enableEdgeContext: isEdgeOn,
    });
    setInput('');
    setContextTags([]);
    setAttachedMedia([]);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const addFileContext = (file: WorkspaceFile) => {
    if (!contextTags.some((t) => t.id === file.id)) {
      setContextTags((prev) => [
        ...prev,
        {
          id: file.id,
          type: 'file',
          label: file.name,
          path: file.path,
          content: file.content,
        },
      ]);
    }
    setShowAtMenu(false);
    textareaRef.current?.focus();
  };

  const addPresetContext = (type: ContextTag['type'], label: string, content?: string) => {
    const id = `ctx-${type}-${Date.now()}`;
    if (!contextTags.some((t) => t.label === label)) {
      setContextTags((prev) => [
        ...prev,
        { id, type, label, content: content || `Context for ${label}` },
      ]);
    }
    setShowAtMenu(false);
    textareaRef.current?.focus();
  };

  const removeTag = (id: string) => {
    setContextTags((prev) => prev.filter((t) => t.id !== id));
    if (onRemoveContextTag) onRemoveContextTag(id);
  };

  const removeMedia = (id: string) => {
    setAttachedMedia((prev) => prev.filter((m) => m.id !== id));
  };

  const selectedModelObj = models.find((m) => m.name === selectedModel);

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`relative p-3 bg-[#141518] border-t border-[#23252a] select-none transition-all ${
        isDragging ? 'bg-[#1b222f] border-[#388bfd]' : ''
      }`}
    >
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/*,.py,.js,.ts,.tsx,.json,.md,.txt,.csv,.yaml,.yml,.sql,.html,.css"
        onChange={handleFileInputChange}
        className="hidden"
      />

      {/* Dragging Overlay */}
      {isDragging && (
        <div className="absolute inset-0 bg-[#162030]/90 backdrop-blur-xs flex items-center justify-center z-40 text-xs font-semibold text-[#58a6ff] border-2 border-dashed border-[#58a6ff] rounded-lg m-2">
          Drop images or files to attach to Agent Dock prompt
        </div>
      )}

      {/* Autocomplete @ Context Menu */}
      {showAtMenu && (
        <div
          ref={atMenuRef}
          className="absolute bottom-full left-4 mb-2 w-80 bg-[#181a1f] border border-[#2d3038] rounded-xl shadow-2xl p-1.5 z-50 text-xs overflow-hidden animate-in fade-in zoom-in-95 duration-100"
        >
          <div className="px-2.5 py-1 text-[10px] uppercase font-semibold text-[#6e7480] tracking-wider border-b border-[#23252a] flex items-center justify-between">
            <span>Add Context (@)</span>
            <span className="text-[#8b909a] font-mono">Esc to close</span>
          </div>

          <div className="max-h-56 overflow-y-auto py-1 space-y-0.5 font-mono">
            <button
              onClick={() => addPresetContext('project', `@Agent Dock (${baseProjectDir})`, `Active Agent Dock directory: ${baseProjectDir}`)}
              className="w-full px-2.5 py-1.5 text-left rounded flex items-center gap-2 hover:bg-[#22252c] text-[#e3e4e8] transition-colors"
            >
              <FolderPlus className="w-3.5 h-3.5 text-[#e3b341]" />
              <div className="flex-1 truncate">
                <span className="font-semibold">@Agent Dock</span>
                <span className="text-[10px] text-[#6e7480] block truncate">{baseProjectDir}</span>
              </div>
            </button>

            <button
              onClick={() => addPresetContext('codebase', '@Codebase', 'Full workspace index')}
              className="w-full px-2.5 py-1.5 text-left rounded flex items-center gap-2 hover:bg-[#22252c] text-[#e3e4e8] transition-colors"
            >
              <Sparkles className="w-3.5 h-3.5 text-[#58a6ff]" />
              <div className="flex-1 truncate">
                <span className="font-semibold">@Codebase</span>
                <span className="text-[10px] text-[#6e7480] block">Index all workspace files</span>
              </div>
            </button>

            <div className="my-1 border-t border-[#23252a] px-2.5 pt-1 text-[10px] uppercase font-semibold text-[#6e7480]">
              Workspace Files
            </div>

            {workspaceFiles.map((file) => (
              <button
                key={file.id}
                onClick={() => addFileContext(file)}
                className="w-full px-2.5 py-1.5 text-left rounded flex items-center gap-2 hover:bg-[#22252c] text-[#e3e4e8] transition-colors"
              >
                <FileCode className="w-3.5 h-3.5 text-[#58a6ff]" />
                <div className="flex-1 truncate">
                  <span className="font-semibold">@{file.name}</span>
                  <span className="text-[10px] text-[#6e7480] block truncate">{file.path}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Cursor Input Card */}
      <div className="bg-[#18191d] border border-[#2a2c34] focus-within:border-[#388bfd] rounded-xl shadow-lg transition-colors p-2.5 flex flex-col gap-2">
        {/* Attached Media Strip (Pasted images & documents) */}
        {attachedMedia.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 pb-1.5 border-b border-[#23252a]">
            {attachedMedia.map((media) => (
              <div
                key={media.id}
                className="relative group flex items-center gap-1.5 bg-[#202228] border border-[#2e313b] rounded-lg p-1 pr-2 text-xs"
              >
                {media.type === 'image' && media.previewUrl ? (
                  <img
                    src={media.previewUrl}
                    alt={media.name}
                    className="w-8 h-8 rounded object-cover border border-[#3b3f4c]"
                  />
                ) : (
                  <div className="w-8 h-8 rounded bg-[#161a22] flex items-center justify-center text-[#58a6ff]">
                    <FileText className="w-4 h-4" />
                  </div>
                )}
                <div className="flex flex-col truncate max-w-[120px]">
                  <span className="text-[11px] font-medium text-[#e3e4e8] truncate">{media.name}</span>
                  <span className="text-[9px] text-[#6e7480] font-mono">
                    {(media.size / 1024).toFixed(0)} KB
                  </span>
                </div>
                <button
                  onClick={() => removeMedia(media.id)}
                  className="p-1 hover:bg-[#2d3039] rounded text-[#8b909a] hover:text-[#f85149] transition-colors ml-1"
                  title="Remove attachment"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Context Pills Row */}
        {contextTags.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 pb-1 border-b border-[#23252a]">
            {contextTags.map((tag) => (
              <div
                key={tag.id}
                className="flex items-center gap-1 px-2 py-0.5 rounded bg-[#21242d] border border-[#30363d] text-[#58a6ff] text-[11px] font-mono"
              >
                <FileCode className="w-3 h-3 text-[#58a6ff]" />
                <span className="truncate max-w-[140px]">{tag.label}</span>
                <button
                  onClick={() => removeTag(tag.id)}
                  className="hover:text-white p-0.5 rounded"
                  title="Remove context"
                >
                  <X className="w-2.5 h-2.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Auto-expanding Textarea with Paste handler */}
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          placeholder={
            mode === 'agent'
              ? `Describe what to build in ${baseProjectDir}, paste images/files, or use @...`
              : 'Ask Ollama questions, debug code, paste images (Ctrl+V)...'
          }
          rows={1}
          className="w-full bg-transparent border-0 outline-none resize-none text-xs text-[#e3e4e8] placeholder-[#6e7480] leading-relaxed font-sans max-h-48 overflow-y-auto"
        />

        {/* Bottom Toolbar inside card */}
        <div className="flex items-center justify-between pt-1 text-xs">
          <div className="flex items-center gap-1.5">
            {/* bAgent, MCP Agent, normal Chat */}
            <div className="flex items-center bg-[#131417] p-0.5 rounded-lg border border-[#24262d]">
              <button type="button" disabled={isStreaming} onClick={() => onToggleMode('bagent')} title="Three-model planning, coding and review" className={`px-2 py-1 rounded text-[10px] font-semibold ${mode === 'bagent' ? 'bg-purple-900 text-purple-200' : 'text-[#8b909a]'}`}>bAgent</button>
              <button
                onClick={() => onToggleMode('agent')}
                className={`px-2.5 py-0.5 rounded text-[10px] font-semibold transition-colors flex items-center gap-1 ${
                  mode === 'agent'
                    ? 'bg-[#2b2e38] text-[#58a6ff]'
                    : 'text-[#8b909a] hover:text-[#e3e4e8]'
                }`}
                title="Agent Mode: Plans and writes files to ~/AgentDock"
              >
                <Sparkles className="w-2.5 h-2.5" />
                <span>Agent</span>
              </button>
              <button
                onClick={() => onToggleMode('chat')}
                className={`px-2.5 py-0.5 rounded text-[10px] font-semibold transition-colors flex items-center gap-1 ${
                  mode === 'chat'
                    ? 'bg-[#2b2e38] text-[#e3e4e8]'
                    : 'text-[#8b909a] hover:text-[#e3e4e8]'
                }`}
                title="Chat Mode: Conversational Q&A & debugging"
              >
                <MessageSquare className="w-2.5 h-2.5" />
                <span>Chat</span>
              </button>
            </div>

            {/* Attach Image / Document Button */}
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1 px-2 py-1 rounded bg-[#1e2026] hover:bg-[#272a33] text-[#a4a8b2] hover:text-[#e3e4e8] text-[11px] transition-colors border border-[#2b2e36]"
              title="Attach Images or Files (or paste Ctrl+V)"
            >
              <Paperclip className="w-3 h-3 text-[#58a6ff]" />
              <span className="hidden sm:inline">Attach</span>
            </button>

            {/* Quick @ Context Button */}
            <button
              onClick={() => setShowAtMenu(!showAtMenu)}
              className="flex items-center gap-1 px-2 py-1 rounded bg-[#1e2026] hover:bg-[#272a33] text-[#a4a8b2] hover:text-[#e3e4e8] text-[11px] font-mono transition-colors border border-[#2b2e36]"
              title="Add Context (@)"
            >
              <AtSign className="w-3 h-3 text-[#d2a8ff]" />
              <span className="hidden sm:inline">Context</span>
            </button>

            {/* MCP access toggle; connection configuration lives in Settings. */}
            {onToggleMcp && (
              <button type="button" disabled={isStreaming} onClick={onToggleMcp} aria-pressed={mcpEnabled}
                title={mcpEnabled ? 'MCP ON — click to disable tool access' : 'MCP OFF — click to enable tool access. Configure connections in Settings → MCP.'}
                className={`flex items-center gap-1 px-2 py-1 rounded text-[11px] font-mono border disabled:opacity-50 ${mcpEnabled ? 'bg-[#16231a] text-[#7ee787] border-[#2ea043]/30' : 'bg-[#1e2026] text-[#8b90a0] border-[#2b2e36]'}`}>
                <Wrench className="w-3 h-3" /><span>MCP {mcpEnabled ? 'ON' : 'OFF'}</span>
              </button>
            )}

            {/* Free Web Search Toggle Button */}
            <button
              onClick={() => setWebSearchEnabled(!webSearchEnabled)}
              className={`flex items-center gap-1 px-2 py-1 rounded text-[11px] font-mono transition-colors border ${
                webSearchEnabled
                  ? 'bg-[#1b2f21] text-[#7ee787] border-[#2ea043]/60 shadow-xs'
                  : 'bg-[#1e2026] hover:bg-[#272a33] text-[#a4a8b2] hover:text-[#e3e4e8] border-[#2b2e36]'
              }`}
              title="Toggle Free Live Web Search (Zero API keys, DuckDuckGo Lite)"
            >
              <Globe className={`w-3 h-3 ${webSearchEnabled ? 'text-[#3fb950]' : 'text-[#8b90a0]'}`} />
              <span className="hidden sm:inline">Web</span>
              {webSearchEnabled && <span className="w-1.5 h-1.5 rounded-full bg-[#3fb950] animate-pulse" />}
            </button>

            {/* Microsoft Edge Companion Context Toggle Button (OFF by default) */}
            <button
              type="button"
              onClick={toggleEdge}
              className={`flex items-center gap-1.5 px-2 py-1 rounded text-[11px] font-mono transition-colors border ${
                isEdgeOn
                  ? 'bg-[#15273b] text-[#79b8ff] border-[#0078d4]/60 shadow-xs'
                  : 'bg-[#1e2026] hover:bg-[#272a33] text-[#8b90a0] hover:text-[#e3e4e8] border-[#2b2e36]'
              }`}
              title={
                isEdgeOn
                  ? 'Edge Context: ON (Active tab attached to prompts - click to turn OFF)'
                  : 'Edge Context: OFF (Click to turn ON, or configure in Settings)'
              }
            >
              <Compass className={`w-3 h-3 ${isEdgeOn ? 'text-[#58a6ff]' : 'text-[#8b90a0]'}`} />
              <span className="hidden sm:inline">Edge</span>
              <span className={`text-[9px] px-1 py-0.2 rounded font-mono ${isEdgeOn ? 'bg-[#0078d4]/30 text-[#79b8ff]' : 'bg-[#252834] text-[#6e7480]'}`}>
                {isEdgeOn ? 'ON' : 'OFF'}
              </span>
              {isEdgeOn && <span className="w-1.5 h-1.5 rounded-full bg-[#58a6ff] animate-pulse" />}
            </button>
          </div>

          <div className="flex items-center gap-2">
            {/* Inline Model Selector Dropdown */}
            <div className="relative" ref={modelMenuRef}>
              <button
                onClick={() => setModelMenuOpen(!modelMenuOpen)}
                className="flex items-center gap-1 px-2 py-1 rounded bg-[#181a1f] hover:bg-[#22252c] border border-[#2b2e36] text-[10px] font-mono text-[#a2a6b0] hover:text-white transition-colors"
              >
                <Cpu className="w-3 h-3 text-[#58a6ff]" />
                <span className="truncate max-w-[100px]">{selectedModel || 'Select model'}</span>
                {selectedModelObj?.supportsVision && (
                  <span className="text-[9px] text-[#3fb950] font-bold" title="Supports Vision">
                    Vision
                  </span>
                )}
                <ChevronDown className="w-2.5 h-2.5" />
              </button>

              {modelMenuOpen && (
                <div className="absolute right-0 bottom-full mb-1 w-56 bg-[#181a1f] border border-[#2d3038] rounded-xl shadow-2xl p-1 z-50 text-xs overflow-hidden">
                  <div className="px-2 py-1 text-[10px] uppercase font-semibold text-[#6e7480] tracking-wider border-b border-[#23252a]">
                    Select Installed Model
                  </div>
                  <div className="max-h-48 overflow-y-auto py-1">
                    {models.map((m) => (
                      <button
                        key={m.name}
                        onClick={() => {
                          onSelectModel(m.name);
                          setModelMenuOpen(false);
                        }}
                        className={`w-full px-2.5 py-1.5 text-left rounded flex items-center justify-between text-xs font-mono transition-colors ${
                          selectedModel === m.name ? 'bg-[#222733] text-white' : 'text-[#a4a8b2] hover:bg-[#20232a]'
                        }`}
                      >
                        <div className="truncate">
                          <span className="font-semibold block truncate">{m.name}</span>
                          <span className="text-[9px] text-[#6e7480]">
                            {m.supportsVision ? 'Vision' : m.supportsThinking ? 'Reasoning' : 'Text'}
                          </span>
                        </div>
                        {selectedModel === m.name && <Check className="w-3.5 h-3.5 text-[#58a6ff]" />}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Send / Stop button */}
            {isStreaming ? (
              <button
                onClick={onStopStreaming}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#3b1d22] hover:bg-[#4d232a] text-[#f85149] font-medium text-xs transition-colors border border-[#da3633]/40"
              >
                <Square className="w-3 h-3 fill-current animate-pulse" />
                <span>Stop</span>
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={!input.trim() && attachedMedia.length === 0}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shadow-xs ${
                  input.trim() || attachedMedia.length > 0
                    ? 'bg-[#58a6ff] hover:bg-[#79b8ff] text-[#0d1117] cursor-pointer'
                    : 'bg-[#21262d] text-[#6e7480] cursor-not-allowed opacity-60'
                }`}
                title="Send (Cmd+Enter)"
              >
                <ArrowUp className="w-3.5 h-3.5" />
                <span className="hidden sm:inline text-[10px] font-mono opacity-80">⌘↵</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
