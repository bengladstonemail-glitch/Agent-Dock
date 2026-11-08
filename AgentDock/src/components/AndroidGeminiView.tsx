import React, { useState, useRef, useEffect } from 'react';
import { 
  Sparkles, 
  Bot, 
  Send, 
  Paperclip, 
  Image as ImageIcon, 
  X, 
  ChevronDown, 
  ChevronUp, 
  Check, 
  Copy, 
  Plus, 
  Cpu, 
  RotateCw, 
  FileCode, 
  Settings, 
  Download, 
  Smartphone, 
  ArrowLeft, 
  CheckCheck,
  FolderPlus,
  Play,
  Terminal,
  Mic,
  Monitor,
  Globe,
  Compass,
  ExternalLink
} from 'lucide-react';
import { ChatMessage, OllamaModel, OllamaSettings, AttachedMedia, ContextTag } from '../types/chat';

interface AndroidGeminiViewProps {
  messages: ChatMessage[];
  isStreaming: boolean;
  onSendMessage: (content: string, contextTags: ContextTag[], attachedMedia: AttachedMedia[], mode: 'agent' | 'chat' | 'bagent') => void;
  onStopStreaming: () => void;
  onNewChat: () => void;
  models: OllamaModel[];
  settings: OllamaSettings;
  onUpdateSettings: (newSettings: Partial<OllamaSettings>) => void;
  currentMode: 'agent' | 'chat' | 'bagent';
  onToggleMode: (mode: 'agent' | 'chat' | 'bagent') => void;
  onSwitchToDesktop: () => void;
  onOpenSettings: () => void;
  onOpenApkModal: () => void;
  baseProjectDir?: string;
  onSaveToDisk?: (fileName: string, content: string) => void;
}

export const AndroidGeminiView: React.FC<AndroidGeminiViewProps> = ({
  messages,
  isStreaming,
  onSendMessage,
  onStopStreaming,
  onNewChat,
  models,
  settings,
  onUpdateSettings,
  currentMode,
  onToggleMode,
  onSwitchToDesktop,
  onOpenSettings,
  onOpenApkModal,
  baseProjectDir = '~/AgentDock',
  onSaveToDisk,
}) => {
  const [inputPrompt, setInputPrompt] = useState('');
  const [attachedMedia, setAttachedMedia] = useState<AttachedMedia[]>([]);
  const [modelDropdownOpen, setModelDropdownOpen] = useState(false);
  const [copiedCodeIdx, setCopiedCodeIdx] = useState<number | null>(null);
  const [expandedThinkingIds, setExpandedThinkingIds] = useState<Record<string, boolean>>({});
  const [createdFilesNotice, setCreatedFilesNotice] = useState<string[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [webSearchEnabled, setWebSearchEnabled] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll on new tokens
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isStreaming]);

  // Check if assistant generated code files in Agent mode to auto-save to PC
  useEffect(() => {
    if (currentMode === 'agent' && messages.length > 0) {
      const lastMsg = messages[messages.length - 1];
      if (lastMsg.role === 'assistant' && !isStreaming && lastMsg.content) {
        // Detect code blocks with filename e.g. ```python:main.py or ```python\n# filename: ...
        const codeBlockMatch = lastMsg.content.match(/```(?:python|py)?(?::([a-zA-Z0-9_.-]+))?\n([\s\S]*?)```/);
        if (codeBlockMatch && codeBlockMatch[2]) {
          const detectedFilename = codeBlockMatch[1] || 'agent_output.py';
          const fileContent = codeBlockMatch[2];
          
          if (!createdFilesNotice.includes(detectedFilename)) {
            // Trigger save to disk in Agent Dock
            if (onSaveToDisk) {
              onSaveToDisk(detectedFilename, fileContent);
            } else {
              fetch('/api/write-file', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ filePath: detectedFilename, content: fileContent }),
              }).catch(() => null);
            }
            setCreatedFilesNotice((prev) => [...prev, detectedFilename]);
          }
        }
      }
    }
  }, [messages, isStreaming, currentMode]);

  const handleSend = () => {
    if ((!inputPrompt.trim() && attachedMedia.length === 0) || isStreaming) return;
    const finalContent = webSearchEnabled && !inputPrompt.toLowerCase().includes('@web')
      ? `@web ${inputPrompt.trim()}`
      : inputPrompt;
    onSendMessage(finalContent, [], attachedMedia, currentMode);
    setInputPrompt('');
    setAttachedMedia([]);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Paste image handler (Ctrl+V)
  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith('image/')) {
        const file = items[i].getAsFile();
        if (file) {
          const reader = new FileReader();
          reader.onload = (event) => {
            const base64 = event.target?.result as string;
            setAttachedMedia((prev) => [
              ...prev,
              {
                id: `img-${Date.now()}`,
                name: file.name || 'Pasted screenshot',
                type: 'image',
                size: file.size,
                base64,
                mimeType: file.type,
              },
            ]);
          };
          reader.readAsDataURL(file);
        }
      }
    }
  };

  // File attach from input
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const isImg = file.type.startsWith('image/');

      const reader = new FileReader();
      if (isImg) {
        reader.onload = (event) => {
          setAttachedMedia((prev) => [
            ...prev,
            {
              id: `f-${Date.now()}-${i}`,
              name: file.name,
              type: 'image',
              size: file.size,
              base64: event.target?.result as string,
              mimeType: file.type,
            },
          ]);
        };
        reader.readAsDataURL(file);
      } else {
        reader.onload = (event) => {
          setAttachedMedia((prev) => [
            ...prev,
            {
              id: `f-${Date.now()}-${i}`,
              name: file.name,
              type: 'file',
              size: file.size,
              textContent: event.target?.result as string,
              mimeType: file.type || 'text/plain',
            },
          ]);
        };
        reader.readAsText(file);
      }
    }
    e.target.value = '';
  };

  // Toggle voice speech-to-text
  const handleVoiceToggle = () => {
    // @ts-ignore
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Speech recognition is not supported on this browser.');
      return;
    }

    if (isRecording) {
      setIsRecording(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'en-US';

      recognition.onstart = () => setIsRecording(true);
      recognition.onend = () => setIsRecording(false);
      recognition.onerror = () => setIsRecording(false);
      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setInputPrompt((prev) => (prev ? prev + ' ' + transcript : transcript));
      };

      recognition.start();
    } catch {
      setIsRecording(false);
    }
  };

  // DeepSeek R1 reasoning trace parser
  const parseThinking = (content: string) => {
    const thinkRegex = /<think>([\s\S]*?)<\/think>/i;
    const match = content.match(thinkRegex);
    if (match) {
      const thinking = match[1].trim();
      const answer = content.replace(thinkRegex, '').trim();
      return { thinking, answer, hasThinking: true };
    }
    return { thinking: '', answer: content, hasThinking: false };
  };

  const selectedModelObj = models.find((m) => m.name === settings.selectedModel);

  return (
    <div className="flex flex-col h-screen w-screen bg-[#131318] text-[#e3e4e8] select-none font-sans overflow-hidden">
      {/* Gemini Android Top Header */}
      <header className="h-14 bg-[#181920]/90 backdrop-blur-md border-b border-[#232530] px-3 sm:px-4 flex items-center justify-between z-30 shrink-0">
        {/* Gemini Branding */}
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#4285F4] via-[#9B72CB] to-[#D96570] flex items-center justify-center p-0.5 shadow-md shadow-[#9B72CB]/20">
            <Sparkles className="w-4 h-4 text-white animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-1.5 leading-none">
              <span className="font-semibold text-sm tracking-tight text-white">Gemini</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#242633] text-[#a4a8b8] font-mono">
                Android
              </span>
            </div>
            <span className="text-[10px] text-[#8b90a0] font-mono">Agent Dock PC Bridge</span>
          </div>
        </div>

        {/* Center: Mode Switcher (Agent vs Chat) */}
        <div className="flex items-center bg-[#1e202a] p-0.5 rounded-full border border-[#2c2f3d]">
          <button
            onClick={() => onToggleMode('agent')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition-all ${
              currentMode === 'agent'
                ? 'bg-gradient-to-r from-[#9B72CB] to-[#4285F4] text-white shadow-xs'
                : 'text-[#8b90a0] hover:text-white'
            }`}
            title="Agent Mode: Can create files and manage code in ~/AgentDock"
          >
            <Sparkles className="w-3 h-3" />
            <span>Agent</span>
          </button>
          <button
            onClick={() => onToggleMode('chat')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition-all ${
              currentMode === 'chat'
                ? 'bg-[#2b2e3e] text-white shadow-xs'
                : 'text-[#8b90a0] hover:text-white'
            }`}
            title="Chat Mode: Standard conversational intelligence"
          >
            <span>Chat</span>
          </button>
        </div>

        {/* Right Tools */}
        <div className="flex items-center gap-1.5">
          {/* APK Modal trigger */}
          <button
            onClick={onOpenApkModal}
            className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#1b2721] hover:bg-[#23352b] border border-[#2ea043]/40 text-[#3fb950] text-[11px] font-medium transition-colors"
            title="Download Android APK or Install PWA"
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Get APK</span>
          </button>

          {/* Settings / MCP modal trigger */}
          <button
            onClick={onOpenSettings}
            className="p-2 hover:bg-[#222430] rounded-full text-[#8b90a0] hover:text-[#7ee787] transition-colors"
            title="Settings & MCP (Model Context Protocol)"
          >
            <Settings className="w-4 h-4" />
          </button>

          {/* New Chat */}
          <button
            onClick={onNewChat}
            className="p-2 hover:bg-[#222430] rounded-full text-[#8b90a0] hover:text-white transition-colors"
            title="New Chat"
          >
            <Plus className="w-4 h-4" />
          </button>

          {/* Switch to Desktop IDE */}
          <button
            onClick={onSwitchToDesktop}
            className="p-2 hover:bg-[#222430] rounded-full text-[#8b90a0] hover:text-[#58a6ff] transition-colors"
            title="Switch to Desktop Cursor IDE"
          >
            <Monitor className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Model Selector Bar */}
      <div className="h-8 bg-[#15161c] border-b border-[#20222a] px-3 sm:px-4 flex items-center justify-between text-xs text-[#8b90a0] font-mono shrink-0">
        <div className="flex items-center gap-2">
          <Cpu className="w-3.5 h-3.5 text-[#58a6ff]" />
          <span className="text-[11px] text-[#e3e4e8] font-semibold">{settings.selectedModel || 'Select model'}</span>
          {selectedModelObj?.supportsVision && (
            <span className="text-[9px] px-1.5 py-0.2 bg-[#1b2b22] text-[#3fb950] rounded border border-[#2ea043]/30">
              Vision
            </span>
          )}
          {selectedModelObj?.supportsThinking && (
            <span className="text-[9px] px-1.5 py-0.2 bg-[#2d1e38] text-[#d2a8ff] rounded border border-[#a371f7]/30">
              Reason
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[10px] text-[#7ee787] flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-[#3fb950] animate-pulse" />
            <span>PC Connected</span>
          </span>
        </div>
      </div>

      {/* Main Gemini Chat Area */}
      <div className="flex-1 overflow-y-auto px-3 sm:px-6 py-4 space-y-4 max-w-3xl mx-auto w-full select-text">
        {messages.length === 0 ? (
          /* Gemini Welcome Screen */
          <div className="flex flex-col items-center justify-center min-h-[50vh] text-center px-4">
            <div className="w-16 h-16 rounded-3xl bg-gradient-to-tr from-[#4285F4] via-[#9B72CB] to-[#D96570] flex items-center justify-center mb-5 shadow-xl shadow-[#9B72CB]/25">
              <Sparkles className="w-8 h-8 text-white" />
            </div>

            <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight mb-2">
              Hello, Agent Dock
            </h1>
            <p className="text-sm text-[#8b90a0] max-w-md mb-6 leading-relaxed">
              How can I help you create and run Python projects in{' '}
              <code className="text-[#e3b341] bg-[#1d1f27] px-1.5 py-0.5 rounded font-mono text-xs">
                {baseProjectDir}
              </code>{' '}
              today?
            </p>

            {/* Quick starter chips */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-lg text-left font-sans">
              <button
                onClick={() =>
                  onSendMessage(
                    `Create a Python FastAPI project in ${baseProjectDir} with health endpoints and start instructions`,
                    [],
                    [],
                    'agent'
                  )
                }
                className="p-3 rounded-2xl bg-[#1b1c23] hover:bg-[#22242e] border border-[#262835] transition-colors text-xs text-[#c9d1d9] flex items-start gap-2.5"
              >
                <Sparkles className="w-4 h-4 text-[#58a6ff] shrink-0 mt-0.5" />
                <span>Create a FastAPI service in Agent Dock</span>
              </button>

              <button
                onClick={() =>
                  onSendMessage(
                    `Write a Python script in ${baseProjectDir}/scraper.py to extract web titles using requests and BeautifulSoup`,
                    [],
                    [],
                    'agent'
                  )
                }
                className="p-3 rounded-2xl bg-[#1b1c23] hover:bg-[#22242e] border border-[#262835] transition-colors text-xs text-[#c9d1d9] flex items-start gap-2.5"
              >
                <FileCode className="w-4 h-4 text-[#3fb950] shrink-0 mt-0.5" />
                <span>Generate a Python scraper script</span>
              </button>

              <button
                onClick={() =>
                  onSendMessage(
                    'Explain the difference between DeepSeek R1 reasoning and standard LLM generation',
                    [],
                    [],
                    'chat'
                  )
                }
                className="p-3 rounded-2xl bg-[#1b1c23] hover:bg-[#22242e] border border-[#262835] transition-colors text-xs text-[#c9d1d9] flex items-start gap-2.5"
              >
                <Bot className="w-4 h-4 text-[#d2a8ff] shrink-0 mt-0.5" />
                <span>Explain DeepSeek R1 reasoning</span>
              </button>

              <button
                onClick={() =>
                  onSendMessage(
                    `Create a README.md in ${baseProjectDir} documenting all files and how to run them`,
                    [],
                    [],
                    'agent'
                  )
                }
                className="p-3 rounded-2xl bg-[#1b1c23] hover:bg-[#22242e] border border-[#262835] transition-colors text-xs text-[#c9d1d9] flex items-start gap-2.5"
              >
                <FolderPlus className="w-4 h-4 text-[#e3b341] shrink-0 mt-0.5" />
                <span>Create README project summary</span>
              </button>
            </div>
          </div>
        ) : (
          /* Message Flow */
          messages.map((msg, idx) => {
            const isUser = msg.role === 'user';
            const { thinking, answer, hasThinking } = !isUser ? parseThinking(msg.content) : { thinking: '', answer: msg.content, hasThinking: false };
            const isThinkingExpanded = !!expandedThinkingIds[msg.id];

            return (
              <div
                key={msg.id || idx}
                className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} space-y-1.5`}
              >
                {/* Media attachments */}
                {msg.attachedMedia && msg.attachedMedia.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-1">
                    {msg.attachedMedia.map((m) => (
                      <div key={m.id} className="relative rounded-xl overflow-hidden border border-[#2c2f3d] max-w-[200px]">
                        {m.type === 'image' && m.base64 ? (
                          <img src={m.base64} alt={m.name} className="w-full h-auto object-cover max-h-36" />
                        ) : (
                          <div className="p-2.5 bg-[#1b1c24] flex items-center gap-1.5 text-xs font-mono">
                            <FileCode className="w-4 h-4 text-[#58a6ff]" />
                            <span className="truncate">{m.name}</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Message Bubble */}
                <div
                  className={`max-w-[88%] sm:max-w-[80%] rounded-2xl px-4 py-3 leading-relaxed text-[13.5px] ${
                    isUser
                      ? 'bg-[#292c3a] text-white rounded-br-sm'
                      : 'bg-[#181920] border border-[#232530] text-[#e3e4e8] rounded-bl-sm shadow-sm'
                  }`}
                >
                  {/* Assistant Icon header */}
                  {!isUser && (
                    <div className="flex items-center gap-1.5 mb-2 pb-1.5 border-b border-[#232530] text-xs font-mono text-[#8b90a0]">
                      <Sparkles className="w-3.5 h-3.5 text-[#9B72CB]" />
                      <span className="font-semibold text-[#c9d1d9]">{msg.model || 'Gemini'}</span>
                      {msg.mode === 'agent' && (
                        <span className="text-[10px] px-1.5 py-0.2 bg-[#2d1e38] text-[#d2a8ff] rounded-full">
                          Agent
                        </span>
                      )}
                    </div>
                  )}

                  {/* DeepSeek R1 Thinking Accordion */}
                  {hasThinking && (
                    <div className="mb-3 rounded-xl bg-[#13141a] border border-[#2a2d3c] overflow-hidden text-xs font-mono">
                      <button
                        onClick={() =>
                          setExpandedThinkingIds((prev) => ({
                            ...prev,
                            [msg.id]: !prev[msg.id],
                          }))
                        }
                        className="w-full px-3 py-2 flex items-center justify-between text-[#d2a8ff] hover:bg-[#1a1b24] transition-colors"
                      >
                        <span className="flex items-center gap-1.5 font-semibold text-[11px]">
                          <Sparkles className="w-3 h-3 text-[#d2a8ff]" />
                          <span>Reasoning Process ({thinking.length} chars)</span>
                        </span>
                        {isThinkingExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                      </button>

                      {isThinkingExpanded && (
                        <div className="p-3 pt-0 text-[#a4a8b8] leading-relaxed border-t border-[#232530] whitespace-pre-wrap max-h-60 overflow-y-auto">
                          {thinking}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Live Web Search Citations */}
                  {msg.webSearchSources && msg.webSearchSources.length > 0 && (
                    <div className="mb-3 p-2.5 rounded-xl bg-[#131d16] border border-[#2ea043]/30 space-y-1.5 font-mono text-xs">
                      <div className="flex items-center justify-between text-[#7ee787]">
                        <span className="flex items-center gap-1.5 font-semibold text-[11px]">
                          <Globe className="w-3.5 h-3.5 text-[#3fb950]" />
                          <span>Live Web Search ({msg.webSearchSources.length} sources)</span>
                        </span>
                        <span className="text-[10px] text-[#3fb950] font-bold">Grounded</span>
                      </div>
                      <div className="space-y-1 pt-0.5">
                        {msg.webSearchSources.slice(0, 3).map((src, i) => (
                          <a
                            key={i}
                            href={src.url}
                            target="_blank"
                            rel="noreferrer"
                            className="block p-1.5 rounded-lg bg-[#18261e] hover:bg-[#22362a] text-[#c9d1d9] transition-colors"
                          >
                            <div className="font-semibold text-white truncate text-[11px]">{src.title}</div>
                            <div className="text-[10px] text-[#8b90a0] truncate flex items-center gap-1">
                              <ExternalLink className="w-2.5 h-2.5 text-[#3fb950]" />
                              <span>{src.domain || src.url}</span>
                            </div>
                          </a>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Main Answer text */}
                  <div className="whitespace-pre-wrap font-sans leading-relaxed">
                    {answer}
                  </div>

                  {/* Agent File Creation Card if agent mode generated code */}
                  {!isUser && msg.mode === 'agent' && answer.includes('```') && (
                    <div className="mt-3 p-2.5 rounded-xl bg-[#17231c] border border-[#2ea043]/30 flex items-center justify-between text-xs font-mono text-[#7ee787]">
                      <div className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-[#3fb950]" />
                        <span>Created on PC in {baseProjectDir}</span>
                      </div>
                      <span className="text-[10px] text-[#3fb950] font-semibold bg-[#233528] px-2 py-0.5 rounded">
                        Active
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}

        {/* Streaming indicator */}
        {isStreaming && (
          <div className="flex items-center gap-2 text-[#9B72CB] text-xs font-mono pl-2 animate-pulse">
            <Sparkles className="w-3.5 h-3.5 animate-spin" />
            <span>Gemini is generating response...</span>
            <button
              onClick={onStopStreaming}
              className="ml-2 px-2 py-0.5 bg-[#2d1b22] text-[#f85149] rounded border border-[#da3633]/30 text-[10px] font-sans"
            >
              Stop
            </button>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Floating Gemini Bottom Composer */}
      <div className="p-3 sm:p-4 bg-gradient-to-t from-[#131318] via-[#131318] to-transparent shrink-0">
        <div className="max-w-3xl mx-auto">
          {/* Active Attached Media Chips */}
          {attachedMedia.length > 0 && (
            <div className="flex items-center gap-2 mb-2 overflow-x-auto pb-1">
              {attachedMedia.map((media) => (
                <div
                  key={media.id}
                  className="flex items-center gap-1.5 px-2.5 py-1 bg-[#1e202c] border border-[#2d3042] rounded-full text-xs text-[#e3e4e8] shrink-0"
                >
                  {media.type === 'image' ? (
                    <ImageIcon className="w-3.5 h-3.5 text-[#58a6ff]" />
                  ) : (
                    <FileCode className="w-3.5 h-3.5 text-[#3fb950]" />
                  )}
                  <span className="truncate max-w-[120px]">{media.name}</span>
                  <button
                    onClick={() =>
                      setAttachedMedia((prev) => prev.filter((m) => m.id !== media.id))
                    }
                    className="p-0.5 hover:bg-[#2b2e40] rounded-full text-[#8b90a0] hover:text-white"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Gemini Floating Pill Input Container */}
          <div className="bg-[#1e1f28] border border-[#2e3040] rounded-3xl p-2 shadow-2xl flex items-end gap-1.5 transition-all focus-within:border-[#4285F4]/60 focus-within:ring-1 focus-within:ring-[#4285F4]/40">
            {/* Attachment Button */}
            <button
              onClick={() => fileInputRef.current?.click()}
              className="p-2.5 hover:bg-[#2a2c3a] text-[#8b90a0] hover:text-white rounded-full transition-colors shrink-0"
              title="Attach photo or document"
            >
              <Paperclip className="w-5 h-5" />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*,.py,.json,.txt,.md"
              className="hidden"
              onChange={handleFileChange}
            />

            {/* Prompt Textarea */}
            <textarea
              ref={textareaRef}
              rows={1}
              value={inputPrompt}
              onChange={(e) => {
                setInputPrompt(e.target.value);
                e.target.style.height = 'auto';
                e.target.style.height = `${Math.min(e.target.scrollHeight, 140)}px`;
              }}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              placeholder={
                currentMode === 'agent'
                  ? 'Ask Gemini Agent to build, create files, or code in Agent Dock...'
                  : 'Ask Gemini anything...'
              }
              className="flex-1 bg-transparent border-0 outline-none text-[#e3e4e8] placeholder-[#717586] text-sm py-2 px-1 max-h-36 resize-none leading-relaxed"
            />

            {/* Free Web Search Toggle */}
            <button
              onClick={() => setWebSearchEnabled(!webSearchEnabled)}
              className={`p-2.5 rounded-full transition-colors shrink-0 ${
                webSearchEnabled
                  ? 'bg-[#1b2f21] text-[#3fb950] border border-[#2ea043]/40'
                  : 'hover:bg-[#2a2c3a] text-[#8b90a0] hover:text-white'
              }`}
              title="Toggle Free Live Web Search"
            >
              <Globe className="w-5 h-5" />
            </button>

            {/* Voice Input Button */}
            <button
              onClick={handleVoiceToggle}
              className={`p-2.5 rounded-full transition-colors shrink-0 ${
                isRecording
                  ? 'bg-[#ea4335] text-white animate-pulse'
                  : 'hover:bg-[#2a2c3a] text-[#8b90a0] hover:text-white'
              }`}
              title="Voice typing"
            >
              <Mic className="w-5 h-5" />
            </button>

            {/* Send Button */}
            <button
              onClick={handleSend}
              disabled={(!inputPrompt.trim() && attachedMedia.length === 0) || isStreaming}
              className="p-2.5 bg-gradient-to-tr from-[#4285F4] to-[#9B72CB] hover:opacity-90 disabled:opacity-30 disabled:hover:opacity-30 text-white rounded-full transition-all shrink-0 shadow-md"
              title="Send Prompt (Enter)"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center justify-between px-3 mt-1.5 text-[10px] text-[#6e7284] font-mono">
            <span>
              Target: <strong className="text-[#a4a8b8]">{baseProjectDir}</strong>
            </span>
            <span>
              Mode: <strong className="text-[#9B72CB]">{currentMode.toUpperCase()}</strong>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
