import { OpenFolderDialog } from './components/OpenFolderDialog';
import { setWorkspaceDraftPaths } from './services/workspaceAgent';
import { useCompletionNotifications, primeNotificationSound } from './components/CompletionNotifications';
import { BAgentControls } from './components/BAgentControls';
import { ResourceBar } from './components/ResourceBar';
import React, { useState, useEffect, useRef } from 'react';
import { 
  OllamaModel, 
  OllamaSettings, 
  ChatMessage, 
  ChatSession, 
  WorkspaceFile, 
  DiffBlock, 
  ContextTag,
  AttachedMedia,
  EdgeTabContent
} from './types/chat';
import { POPULAR_OLLAMA_MODELS, INITIAL_WORKSPACE_FILES } from './data/mockWorkspace';
import { OllamaService } from './services/ollama';
import { createUnifiedDiff } from './utils/diffHelper';
import { TopNav } from './components/TopNav';
import { SidebarFiles } from './components/SidebarFiles';
import { CodeEditor } from './components/CodeEditor';
import { ChatPanel } from './components/ChatPanel';
import { PromptComposer } from './components/PromptComposer';
import { SettingsModal } from './components/SettingsModal';
import { ComposerView } from './components/ComposerView';
import { AgentDockModal } from './components/AgentDockModal';
import { TerminalPanel } from './components/TerminalPanel';
import { AndroidGeminiView } from './components/AndroidGeminiView';
import { AndroidApkModal } from './components/AndroidApkModal';
import { EdgeExtensionModal } from './components/EdgeExtensionModal';

const DEFAULT_SETTINGS: OllamaSettings = {
  baseUrl: 'http://localhost:11434',
  pythonBridgeUrl: 'http://localhost:8000',
  selectedModel: '',
  temperature: 0.7,
  topP: 0.9,
  contextWindow: 8192,
  systemPrompt: 'You are Agent Dock, an expert AI coding assistant. Work in the currently selected project folder. Provide clean production-ready Python code with actionable diffs.',
  baseProjectDir: '~/AgentDock',
  useProxy: false,
  isSimulatedFallback: true,
};

export default function App() {
  // State
  const [settings, setSettings] = useState<OllamaSettings>(() => {
    const saved = localStorage.getItem('cursor_ollama_settings');
    return saved ? { ...DEFAULT_SETTINGS, ...JSON.parse(saved) } : DEFAULT_SETTINGS;
  });

  const [models, setModels] = useState<OllamaModel[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<{
    ok: boolean;
    checking: boolean;
    version?: string;
    error?: string;
    bridgeOnline?: boolean;
    agentdockDir?: string;
  }>({ ok: false, checking: true });

  const [workspaceFolders, setWorkspaceFolders] = useState<string[]>([]);
  const [workspaceFiles, setWorkspaceFiles] = useState<WorkspaceFile[]>([]);
  useEffect(()=>{setWorkspaceDraftPaths(workspaceFiles.filter(file=>file.isModified).map(file=>file.path));},[workspaceFiles]);
  const [activeFileId, setActiveFileId] = useState<string>('');
  const [activeProjectName, setActiveProjectName] = useState<string>('~/AgentDock');

  const [chatWidth,setChatWidth] = useState(()=>{try{return Math.max(280,Math.min(800,Number(localStorage.getItem('agentdock_chat_width'))||480));}catch{return 480;}});
  const splitRef = useRef<HTMLDivElement>(null);
  useEffect(()=>{localStorage.setItem('agentdock_chat_width',String(chatWidth));},[chatWidth]);
  const workspaceRootRef=useRef<string|null>(null);
  const [openingFolder,setOpeningFolder]=useState(false);
  const [folderDialogOpen,setFolderDialogOpen]=useState(false);
  useEffect(()=>{let active=true;void fetch('/api/project').then(r=>r.json()).then(data=>{if(active&&data.root){workspaceRootRef.current=data.root;setActiveProjectName(data.root);setSettings(previous=>({...previous,baseProjectDir:data.root}));}}).catch(()=>{});return()=>{active=false;};},[]);
  const handleOpenFolder=async(input?:string)=>{
    if(isStreaming||openingFolder)return;
    if(workspaceFiles.some(file=>file.isModified)){window.alert('Save your unsaved edits before opening another folder.');return;}
    if(!input){setFolderDialogOpen(true);return;}
    setOpeningFolder(true);
    try{
      const selected=input;
      const response=await fetch('/api/project/open',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({path:selected})});const result=await response.json();if(!response.ok)throw Error(result.error);
      const nextSession:ChatSession={id:'sess-'+Date.now(),title:result.root.replace(/\\/g,'/').split('/').pop()||'Project',model:settings.selectedModel,mode:currentMode,projectName:result.root,messages:[],createdAt:Date.now(),updatedAt:Date.now()};
      setSessions(previous=>[nextSession,...previous]);setActiveSessionId(nextSession.id);
      workspaceRootRef.current=result.root;setWorkspaceFiles([]);setWorkspaceFolders([]);setActiveFileId('');setActiveDiff(null);setActiveContextTags([]);setActiveProjectName(result.root);setSettings(previous=>({...previous,baseProjectDir:result.root}));
      await loadFilesFromDisk();
      setFolderDialogOpen(false);
    }catch(error){window.alert(String(error));}finally{setOpeningFolder(false);}
  };

  // Mode: Agent vs Chat
  const [currentMode, setCurrentMode] = useState<'agent' | 'chat' | 'bagent'>('agent');

  // Layout & Modals
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [layoutMode, setLayoutMode] = useState<'split' | 'chat' | 'composer'>('split');
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<'general' | 'mcp' | 'hyperparams' | 'edge'>('general');
  const [agentdockModalOpen, setAgentdockModalOpen] = useState(false);
  const [terminalOpen, setTerminalOpen] = useState(false);
  const [apkModalOpen, setApkModalOpen] = useState(false);
  const [edgeModalOpen, setEdgeModalOpen] = useState(false);
  const [edgeEnabled, setEdgeEnabled] = useState(false);

  // Android View Mode: clean Gemini chat + Agent mode without terminals
  const [isAndroidView, setIsAndroidView] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('agentdock_view_mode');
      if (saved) return saved === 'android';
      return /android|iphone|ipad|ipod/i.test(navigator.userAgent) || window.innerWidth < 768;
    }
    return false;
  });

  // Active Diffs
  const [activeDiff, setActiveDiff] = useState<DiffBlock | null>(null);
  const [composerDiffs, setComposerDiffs] = useState<DiffBlock[]>([]);

  // Streaming & Chat
  const [isStreaming, setIsStreaming] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Clean default session template
  const createDefaultSession = (): ChatSession => ({
    id: `sess-${Date.now()}`,
    title: 'Agent Dock Project Assistant',
    model: 'deepseek-r1:8b',
    mode: 'agent',
    projectName: '~/AgentDock',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    messages: [
      {
        id: 'welcome-msg',
        role: 'assistant',
        model: 'deepseek-r1:8b',
        mode: 'agent',
        timestamp: Date.now(),
        content: `### Welcome to Agent Dock!
Connected to \`~/AgentDock\`.

- 📁 **Real Files Active**: File explorer shows only real files on your disk.
- 💾 **Persistent Chat Save**: All chat history and sessions are automatically saved to disk at \`~/AgentDock/.agentdock/chats.json\`.
- ⚡ **Agent & Code Execution**: Autonomous file editing, FastAPI creation, and VS Code-style terminal.

What would you like to build or run in \`~/AgentDock\` today?`,
      },
    ],
  });

  // Chat Sessions: initialize from localStorage first, then sync with server /api/chats
  const [sessions, setSessions] = useState<ChatSession[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('agentdock_chat_sessions');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            return parsed;
          }
        }
      } catch {
        // storage parsing error
      }
    }
    return [createDefaultSession()];
  });

  const [activeSessionId, setActiveSessionId] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const savedId = localStorage.getItem('agentdock_active_session_id');
      if (savedId) return savedId;
    }
    return sessions[0]?.id || 'sess-1';
  });

  const notificationChatRef = useRef(new URLSearchParams(window.location.search).get('chat'));
  const {unread,complete:notifyComplete} = useCompletionNotifications(activeSessionId,id=>{setActiveSessionId(id);setLayoutMode('chat');});
  useEffect(()=>{
    const query=new URLSearchParams(window.location.search);const chat=query.get('chat');
    if(chat&&sessions.some(session=>session.id===chat)){setActiveSessionId(chat);setLayoutMode('chat');query.delete('chat');window.history.replaceState({},'',window.location.pathname+(query.size?'?'+query.toString():''));}
  },[sessions]);
  const [activeContextTags, setActiveContextTags] = useState<ContextTag[]>([]);

  // Persist settings
  useEffect(() => {
    localStorage.setItem('cursor_ollama_settings', JSON.stringify(settings));
  }, [settings]);

  // 1. Fetch saved chats from disk (.agentdock/chats.json) on startup
  useEffect(() => {
    const loadSavedChats = async () => {
      try {
        const res = await fetch('/api/chats').catch(() => null);
        if (res && res.ok) {
          const data = await res.json();
          if (Array.isArray(data.sessions) && data.sessions.length > 0) {
            setSessions(data.sessions);
            if (notificationChatRef.current && data.sessions.some((s: ChatSession) => s.id === notificationChatRef.current)) {
              setActiveSessionId(notificationChatRef.current);
              setLayoutMode('chat');
            } else if (data.activeSessionId && data.sessions.some((s: ChatSession) => s.id === data.activeSessionId)) {
              setActiveSessionId(data.activeSessionId);
            } else if (data.sessions[0]) {
              setActiveSessionId(data.sessions[0].id);
            }
          }
        }
      } catch (err) {
        console.error('[Agent Dock] Failed to load saved chats from disk:', err);
      }
    };
    loadSavedChats();
  }, []);

  // 2. Persist chats to both localStorage and disk (.agentdock/chats.json)
  const saveChatTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('agentdock_chat_sessions', JSON.stringify(sessions));
        if (activeSessionId) {
          localStorage.setItem('agentdock_active_session_id', activeSessionId);
        }
      } catch {
        // quota limit ignore
      }
    }

    if (saveChatTimeoutRef.current) {
      clearTimeout(saveChatTimeoutRef.current);
    }

    // Debounced disk write to ~/AgentDock/.agentdock/chats.json
    saveChatTimeoutRef.current = setTimeout(async () => {
      try {
        await fetch('/api/chats', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessions, activeSessionId }),
        }).catch(() => null);
      } catch {
        // offline ignore
      }
    }, 400);

    return () => {
      if (saveChatTimeoutRef.current) clearTimeout(saveChatTimeoutRef.current);
    };
  }, [sessions, activeSessionId]);

  // 3. Load REAL files from ~/AgentDock on mount & window focus & polling
  const loadFilesFromDisk = async () => {
    try {
      let res = await fetch('/api/files').catch(() => null);
      if (!res || !res.ok) {
        if (settings.pythonBridgeUrl && settings.pythonBridgeUrl !== 'http://localhost:3000') {
          res = await fetch(`${settings.pythonBridgeUrl}/api/files`).catch(() => null);
        }
      }
      if (res && res.ok) {
        const data = await res.json();
        if (Array.isArray(data.files)) {
          const normalize=(value:string)=>value.replace(/\\/g,'/').toLowerCase();
          if(data.baseDir&&workspaceRootRef.current&&normalize(data.baseDir)!==normalize(workspaceRootRef.current))return;
          setWorkspaceFolders(Array.isArray(data.folders) ? data.folders : []);
          setWorkspaceFiles((current) => {
            const drafts = current.filter(f => f.isModified);
            return [...data.files.map((disk: WorkspaceFile) =>
              drafts.find(f => f.path === disk.path) || disk),
              ...drafts.filter(f => !data.files.some((disk: WorkspaceFile) => disk.path === f.path))];
          });
          setActiveFileId((prev) => {
            if (data.files.length === 0) return '';
            const exists = data.files.some((f: WorkspaceFile) => f.id === prev);
            return exists ? prev : data.files[0].id;
          });
          if (data.baseDir) {
            setActiveProjectName(data.baseDir);
          }
        }
      }
    } catch {
      // Offline fallback
    }
  };

  useEffect(() => {
    loadFilesFromDisk();
    const handleFocus = () => loadFilesFromDisk();
    window.addEventListener('focus', handleFocus);
    const diskInterval = setInterval(loadFilesFromDisk, 5000);
    return () => {
      window.removeEventListener('focus', handleFocus);
      clearInterval(diskInterval);
    };
  }, [settings.pythonBridgeUrl,settings.baseProjectDir]);

  useEffect(()=>{
    const refresh=(event:Event)=>{
      const change=(event as CustomEvent).detail;
      if(change?.action==='deleted'){
        const deleted=(activeProjectName+'/'+change.path).replace(/\\/g,'/').toLowerCase();
        setWorkspaceFiles(current=>current.filter(file=>{const candidate=file.path.replace(/\\/g,'/').toLowerCase();return candidate!==deleted&&!candidate.startsWith(deleted+'/');}));
      }
      void loadFilesFromDisk();
    };
    window.addEventListener('agentdock-workspace-changed',refresh);
    return ()=>window.removeEventListener('agentdock-workspace-changed',refresh);
  },[settings.pythonBridgeUrl,activeProjectName]);

  // Check Ollama & Server connectivity on mount, on window focus, and periodic interval
  useEffect(() => {
    checkConnections();
    const handleFocus = () => checkConnections();
    window.addEventListener('focus', handleFocus);

    const interval = setInterval(() => {
      checkConnections();
    }, 12000);

    return () => {
      window.removeEventListener('focus', handleFocus);
      clearInterval(interval);
    };
  }, [settings.baseUrl, settings.pythonBridgeUrl]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'l') {
        e.preventDefault();
        setLayoutMode('split');
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'i') {
        e.preventDefault();
        setLayoutMode('composer');
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        setSidebarOpen((prev) => !prev);
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        handleNewChat();
      }
      if ((e.metaKey || e.ctrlKey) && (e.key === '`' || e.key === '~')) {
        e.preventDefault();
        setTerminalOpen((prev) => !prev);
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && activeDiff) {
        e.preventDefault();
        handleAcceptDiff();
      }
      if (e.key === 'Escape') {
        if (activeDiff) handleRejectDiff();
        if (settingsModalOpen) setSettingsModalOpen(false);
        if (agentdockModalOpen) setAgentdockModalOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeDiff, settingsModalOpen, agentdockModalOpen]);

  const connectionRequestRef=useRef(0);
  const checkConnections = async () => {
    const requestId=++connectionRequestRef.current;
    const res = await OllamaService.checkConnection(settings.baseUrl, settings.pythonBridgeUrl);
    if(requestId!==connectionRequestRef.current)return;
    setConnectionStatus({
      ok: res.ok,
      checking: false,
      version: res.version,
      error: res.error,
      bridgeOnline: res.bridgeOnline,
      agentdockDir: res.agentdockDir,
    });

    if (res.ok) {
      try {
        const fetchedModels=await OllamaService.getInstalledModels(settings.baseUrl,settings.pythonBridgeUrl);
        if(requestId!==connectionRequestRef.current)return;
        setModels(fetchedModels);
        setSettings(previous=>({...previous,selectedModel:fetchedModels.some(model=>model.name===previous.selectedModel)?previous.selectedModel:fetchedModels[0]?.name||'',isSimulatedFallback:false}));
      }catch(error){setConnectionStatus(previous=>({...previous,ok:false,error:String(error)}));}
    }

  };

  useEffect(()=>{const refresh=()=>{void checkConnections();};window.addEventListener('agentdock-models-changed',refresh);return()=>window.removeEventListener('agentdock-models-changed',refresh);},[settings.baseUrl,settings.pythonBridgeUrl]);

  const fallbackSession: ChatSession = {
    id: 'sess-default',
    title: 'Agent Dock Session',
    model: settings.selectedModel || 'deepseek-r1:8b',
    mode: currentMode,
    projectName: activeProjectName,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    messages: [],
  };
  const currentSession = sessions.find((s) => s.id === activeSessionId) || sessions[0] || fallbackSession;
  const activeFile = workspaceFiles.find((f) => f.id === activeFileId) || workspaceFiles[0] || null;

  const handleUpdateSettings = (partial: Partial<OllamaSettings>) => {
    setSettings((prev) => ({ ...prev, ...partial }));
  };

  const handleNewChat = () => {
    const newSession: ChatSession = {
      id: `sess-${Date.now()}`,
      title: 'New Agent Dock Session',
      model: settings.selectedModel,
      mode: currentMode,
      projectName: activeProjectName,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      messages: [],
    };
    setSessions((prev) => [newSession, ...prev]);
    setActiveSessionId(newSession.id);
  };

  const handleDeleteSession = (id: string) => {
    const remaining = sessions.filter((s) => s.id !== id);
    if (remaining.length === 0) {
      handleNewChat();
    } else {
      setSessions(remaining);
      if (activeSessionId === id) {
        setActiveSessionId(remaining[0].id);
      }
    }
    // Delete from disk storage
    fetch(`/api/chats/${id}`, { method: 'DELETE' }).catch(() => null);
  };

  const handleSendMessage = async (
    content: string,
    contextTags: ContextTag[],
    attachedMedia: AttachedMedia[] = [],
    mode: 'agent' | 'chat' | 'bagent' = currentMode,
    options?: { enableWebSearch?: boolean; enableEdgeContext?: boolean }
  ) => {
    if ((!content.trim() && attachedMedia.length === 0) || isStreaming) return;
    primeNotificationSound();
    const requestSessionId = activeSessionId;
    let requestFailed = false;
    let requestStopped = false;

    const userMessage: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content,
      timestamp: Date.now(),
      contextTags,
      attachedMedia,
      mode,
    };

    const assistantMsgId = `asst-${Date.now() + 1}`;
    const initialAssistantMessage: ChatMessage = {
      id: assistantMsgId,
      role: 'assistant',
      model: settings.selectedModel,
      mode,
      content: '',
      timestamp: Date.now() + 1,
    };

    const isFirst = currentSession.messages.length === 0;
    const sessionTitle = isFirst 
      ? (content ? content.slice(0, 32) + (content.length > 32 ? '...' : '') : 'Visual Analysis') 
      : currentSession.title;

    setSessions((prev) =>
      prev.map((s) => {
        if (s.id === activeSessionId) {
          return {
            ...s,
            title: sessionTitle,
            mode,
            messages: [...s.messages, userMessage, initialAssistantMessage],
            updatedAt: Date.now(),
          };
        }
        return s;
      })
    );

    setIsStreaming(true);
    abortControllerRef.current = new AbortController();

    const startTime = performance.now();
    let accumulatedContent = '';
    let tokenCount = 0;

    try {
      const chatHistory = [
        ...currentSession.messages.map((m) => ({ role: m.role, content: m.content })),
        { role: 'user', content },
      ];

      const shouldSearchWeb = options?.enableWebSearch ?? content.toLowerCase().includes('@web');
      const shouldIncludeEdge = options?.enableEdgeContext ?? edgeEnabled;

      const stream = OllamaService.streamChat(
        settings,
        chatHistory,
        contextTags,
        attachedMedia,
        mode,
        abortControllerRef.current.signal,
        shouldSearchWeb,
        undefined,
        shouldIncludeEdge
      );

      let capturedSources: any[] = [];
      let capturedEdgeTab: any = null;

      for await (const chunk of stream) {
        if (chunk.webSearchSources && chunk.webSearchSources.length > 0) {
          capturedSources = chunk.webSearchSources;
        }
        if (chunk.edgeTabContext) {
          capturedEdgeTab = chunk.edgeTabContext;
        }

        if (chunk.content || chunk.webSearchSources || chunk.edgeTabContext) {
          if (chunk.content) {
            accumulatedContent += chunk.content;
            tokenCount++;
          }

          const elapsedSec = (performance.now() - startTime) / 1000;
          const tps = elapsedSec > 0 ? parseFloat((tokenCount / elapsedSec).toFixed(1)) : 0;

          setSessions((prev) =>
            prev.map((s) => {
              if (s.id === activeSessionId) {
                const updatedMsgs = [...s.messages];
                const lastIdx = updatedMsgs.length - 1;
                if (lastIdx >= 0) {
                  updatedMsgs[lastIdx] = {
                    ...updatedMsgs[lastIdx],
                    content: accumulatedContent,
                    webSearchSources: capturedSources.length > 0 ? capturedSources : updatedMsgs[lastIdx].webSearchSources,
                    edgeTabContext: capturedEdgeTab || updatedMsgs[lastIdx].edgeTabContext,
                    metrics: {
                      tokensPerSecond: tps,
                      totalTokens: tokenCount,
                    },
                  };
                }
                return { ...s, messages: updatedMsgs };
              }
              return s;
            })
          );
        }
      }
    } catch (err: unknown) {
      requestStopped = err instanceof Error && err.name === 'AbortError';
      requestFailed = !requestStopped;
      if (!(err instanceof Error && err.name === 'AbortError')) {
        const errorText = `\n\n*Error: ${err instanceof Error ? err.message : 'Could not reach Ollama'}*`;
        accumulatedContent += errorText;
        setSessions((prev) =>
          prev.map((s) => {
            if (s.id === activeSessionId) {
              const updatedMsgs = [...s.messages];
              const lastIdx = updatedMsgs.length - 1;
              if (lastIdx >= 0) {
                updatedMsgs[lastIdx] = {
                  ...updatedMsgs[lastIdx],
                  content: accumulatedContent,
                };
              }
              return { ...s, messages: updatedMsgs };
            }
            return s;
          })
        );
      }
    } finally {
      if(!requestStopped && !abortControllerRef.current?.signal.aborted) notifyComplete(requestSessionId,sessionTitle,requestFailed);
      window.dispatchEvent(new CustomEvent('agentdock-generation-end'));
      setIsStreaming(false);
      abortControllerRef.current = null;
    }
  };

  const handleStopStreaming = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  };

  // When user clicks "Apply" on a code block in chat
  const handleApplyCode = (code: string, filename?: string) => {
    let targetFile = workspaceFiles.find((f) => filename && f.path.endsWith(filename));
    if (!targetFile) {
      targetFile = workspaceFiles.find((f) => f.id === activeFileId) || workspaceFiles[0];
    }

    if (!targetFile) {
      const newName = filename || 'main.py';
      handleCreateNewFile(newName);
      return;
    }

    const diff = createUnifiedDiff(targetFile.path, targetFile.content, code);
    setActiveDiff(diff);
    setActiveFileId(targetFile.id);

    if (layoutMode === 'chat') {
      setLayoutMode('split');
    }
  };

  const handleAcceptDiff = () => {
    if (!activeDiff) return;
    const targetFile = workspaceFiles.find((f) => f.path === activeDiff.filename);
    if (targetFile) {
      setWorkspaceFiles((prev) =>
        prev.map((f) => {
          if (f.id === targetFile.id) {
            return {
              ...f,
              content: activeDiff.newContent,
              isModified: true,
            };
          }
          return f;
        })
      );
    }
    setActiveDiff(null);
  };

  const handleRejectDiff = () => {
    setActiveDiff(null);
  };

  const handleAskCursorAboutFile = (file: WorkspaceFile) => {
    if (!activeContextTags.some((t) => t.id === file.id)) {
      setActiveContextTags((prev) => [
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
  };

  const handleRunComposerPrompt = (
    prompt: string,
    contextTags: ContextTag[],
    attachedMedia: AttachedMedia[] = []
  ) => {
    const targetFile = workspaceFiles.find((f) => f.id === activeFileId) || workspaceFiles[0];
    if (targetFile) {
      const newContent = `${targetFile.content}\n# Updated by Agent Dock Agent in ${settings.baseProjectDir}\n`;
      const diff1 = createUnifiedDiff(targetFile.path, targetFile.content, newContent);
      setComposerDiffs([diff1]);
    }
    handleSendMessage(prompt, contextTags, attachedMedia, 'agent');
  };

  // Callback when a new project is created in ~/AgentDock via AgentDockModal
  const handleProjectCreated = (projectName: string, projectType: string) => {
    const fullDirPath = `${settings.baseProjectDir}/${projectName}`;
    setActiveProjectName(projectName);

    const newFiles: WorkspaceFile[] = [
      {
        id: `p-${Date.now()}-main`,
        name: 'main.py',
        path: `${fullDirPath}/main.py`,
        language: 'python',
        content: `"""
Project: ${projectName}
Location: ${fullDirPath}
Created by Agent Dock Agent
"""
from fastapi import FastAPI
import uvicorn

app = FastAPI(title="${projectName}")

@app.get("/")
def read_root():
    return {"message": "Hello Agent Dock from ${projectName}!", "path": "${fullDirPath}"}

if __name__ == "__main__":
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
`,
      },
      {
        id: `p-${Date.now()}-req`,
        name: 'requirements.txt',
        path: `${fullDirPath}/requirements.txt`,
        language: 'text',
        content: `fastapi>=0.110.0\nuvicorn>=0.28.0\nrequests>=2.31.0\n`,
      },
      {
        id: `p-${Date.now()}-readme`,
        name: 'README.md',
        path: `${fullDirPath}/README.md`,
        language: 'markdown',
        content: `# ${projectName}\n\nProject created in \`${fullDirPath}\`.\n\n## Run\n\`\`\`bash\npip install -r requirements.txt\npython main.py\n\`\`\`\n`,
      },
    ];

    setWorkspaceFiles((prev) => [...newFiles, ...prev]);
    setActiveFileId(newFiles[0].id);

    // Create a new session for this project
    const projSession: ChatSession = {
      id: `sess-${Date.now()}`,
      title: `${projectName} Agent`,
      model: settings.selectedModel,
      mode: 'agent',
      projectName: fullDirPath,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      messages: [
        {
          id: `m-init-${Date.now()}`,
          role: 'assistant',
          model: settings.selectedModel,
          mode: 'agent',
          content: `### Project Initialized in \`${fullDirPath}\`
I have created the Python project structure for **${projectName}**.
- \`main.py\`: FastAPI application
- \`requirements.txt\`: Dependencies
- \`README.md\`: Setup instructions

Ready to write features, paste visual mocks, or query local Ollama models!`,
          timestamp: Date.now(),
        },
      ],
    };

    setSessions((prev) => [projSession, ...prev]);
    setActiveSessionId(projSession.id);
  };

  // Save file content (and sync to PC disk if agentdock.py bridge is running)
  const handleSaveFile = async (fileId: string, content: string) => {
    const file = workspaceFiles.find((f) => f.id === fileId);
    if (!file) return;

    try {
      const relPath = file.path;
      let res = await fetch('/api/write-file', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filePath: relPath, content }),
      }).catch(() => null);

      if (!res || !res.ok) {
        res = await fetch(`${settings.pythonBridgeUrl}/api/write-file`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filePath: relPath, content }),
        });
      }
      if (!res.ok) throw new Error('Save failed');
      setWorkspaceFiles(prev => prev.map(f => f.id === fileId && f.content === content
        ? { ...f, isModified: false } : f));
    } catch {
      window.alert('Could not save this file. Your edits are still in the editor. Please try Save again.');
    }
  };

  // Create new file directly in ~/AgentDock
  const handleCreateNewFile = async (fileName: string) => {
    const ext = fileName.split('.').pop() || 'py';
    const lang = ext === 'py' ? 'python' : ext === 'json' ? 'json' : ext === 'md' ? 'markdown' : 'text';
    const defaultContent = ext === 'py' 
      ? `"""\n${fileName}\nLocation: ${settings.baseProjectDir}/${fileName}\n"""\n\ndef main():\n    print("Running ${fileName} in ${settings.baseProjectDir}")\n\nif __name__ == "__main__":\n    main()\n` 
      : '';

    const newFile: WorkspaceFile = {
      id: fileName,
      name: fileName.split('/').pop() || fileName,
      path: `${settings.baseProjectDir}/${fileName}`,
      language: lang,
      content: defaultContent,
    };

    setWorkspaceFiles((prev) => [newFile, ...prev]);
    setActiveFileId(newFile.id);

    try {
      let res = await fetch('/api/create-file', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filePath: fileName, content: defaultContent }),
      }).catch(() => null);

      if (!res || !res.ok) {
        if (settings.pythonBridgeUrl && settings.pythonBridgeUrl !== 'http://localhost:3000') {
          await fetch(`${settings.pythonBridgeUrl}/api/create-file`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filePath: fileName, content: defaultContent }),
          }).catch(() => null);
        }
      }
    } catch {
      // Offline fallback
    }
  };

  // Delete file
  const handleDeleteFile = async (fileId: string) => {
    const file = workspaceFiles.find((f) => f.id === fileId);
    if (!file) return;

    setWorkspaceFiles((prev) => prev.filter((f) => f.id !== fileId));
    if (activeFileId === fileId) {
      const remaining = workspaceFiles.filter((f) => f.id !== fileId);
      if (remaining.length > 0) setActiveFileId(remaining[0].id);
    }

    try {
      let res = await fetch('/api/delete-file', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filePath: file.path }),
      }).catch(() => null);

      if (!res || !res.ok) {
        if (settings.pythonBridgeUrl && settings.pythonBridgeUrl !== 'http://localhost:3000') {
          await fetch(`${settings.pythonBridgeUrl}/api/delete-file`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filePath: file.path }),
          }).catch(() => null);
        }
      }
    } catch {
      // Offline
    }
  };

  // Create folder in Agent Dock
  const handleCreateFolder = async (folderName: string) => {
    try {
      const response = await fetch('/api/create-folder', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folderPath: folderName.trim() }),
      });
      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || 'Could not create folder');
      }
      await loadFilesFromDisk();
    } catch (error) {
      window.alert(`Could not create folder: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const handleDeleteFolder = async (folderPath: string) => {
    if (!window.confirm(`Delete folder "${folderPath}" and everything inside it? This cannot be undone.`)) return;
    try {
      const response = await fetch('/api/delete-folder', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folderPath }),
      });
      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || 'Could not delete folder');
      }
      const prefix = `${activeProjectName.replace(/\\/g, '/').replace(/\/$/, '')}/${folderPath}/`.toLowerCase();
      setWorkspaceFiles(current => current.filter(file => !file.path.replace(/\\/g, '/').toLowerCase().startsWith(prefix)));
      await loadFilesFromDisk();
    } catch (error) {
      window.alert(`Could not delete folder: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  // Rename file in Agent Dock
  const handleRenameFile = async (fileId: string, newName: string) => {
    const file = workspaceFiles.find((f) => f.id === fileId);
    if (!file) return;
    const oldName = file.path;
    const dir = file.path.substring(0, file.path.lastIndexOf('/'));
    const newPath = `${dir}/${newName}`;

    setWorkspaceFiles((prev) =>
      prev.map((f) => (f.id === fileId ? { ...f, name: newName, path: newPath } : f))
    );

    try {
      await fetch('/api/rename-file', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ oldPath: oldName, newPath }),
      }).catch(() => null);
    } catch {
      // Offline
    }
  };

  // Refresh files from PC disk
  const handleRefreshFromDisk = async () => {
    await loadFilesFromDisk();
  };

  // Callback when user injects active Edge tab content into context
  const handleInjectEdgeTab = (tab: EdgeTabContent) => {
    if (!activeContextTags.some((t) => t.id === `edge-${tab.url}`)) {
      setActiveContextTags((prev) => [
        ...prev,
        {
          id: `edge-${tab.url}`,
          type: 'web',
          label: tab.title ? tab.title.slice(0, 24) : 'Edge Tab',
          content: `URL: ${tab.url}\n${tab.content.slice(0, 6000)}`,
        },
      ]);
    }
  };

  // If Android View is active, render the clean Gemini Android Chat & Agent UI without terminals
  if (isAndroidView) {
    return (
      <div className="flex flex-col h-screen w-screen overflow-hidden bg-[#131318]">
        <AndroidGeminiView
          messages={currentSession.messages}
          isStreaming={isStreaming}
          onSendMessage={(content, contextTags, attachedMedia, mode) =>
            handleSendMessage(content, contextTags, attachedMedia, mode)
          }
          onStopStreaming={handleStopStreaming}
          onNewChat={handleNewChat}
          models={models}
          settings={settings}
          onUpdateSettings={handleUpdateSettings}
          currentMode={currentMode}
          onToggleMode={setCurrentMode}
          onSwitchToDesktop={() => {
            setIsAndroidView(false);
            localStorage.setItem('agentdock_view_mode', 'desktop');
          }}
          onOpenSettings={() => setSettingsModalOpen(true)}
          onOpenApkModal={() => setApkModalOpen(true)}
          baseProjectDir={settings.baseProjectDir}
          onSaveToDisk={(fileName, content) => {
            handleCreateNewFile(fileName).then(() => {
              const found = workspaceFiles.find((f) => f.name === fileName);
              if (found) handleSaveFile(found.id, content);
            });
          }}
        />

        <ResourceBar />

      {folderDialogOpen && <OpenFolderDialog initialPath={workspaceRootRef.current||activeProjectName} onClose={()=>setFolderDialogOpen(false)} onOpen={handleOpenFolder}/>}

      {/* Settings Modal */}
        <SettingsModal
          isOpen={settingsModalOpen}
          onClose={() => setSettingsModalOpen(false)}
          settings={settings}
          onSaveSettings={(newSettings) => {
            setSettings(newSettings);
            if (newSettings.edgeExtensionEnabled !== undefined) {
              setEdgeEnabled(newSettings.edgeExtensionEnabled);
            }
          }}
          onRefreshModels={checkConnections}
          initialTab={settingsTab}
        />

        {/* Android APK Modal */}
        <AndroidApkModal
          isOpen={apkModalOpen}
          onClose={() => setApkModalOpen(false)}
          baseProjectDir={settings.baseProjectDir}
        />

        {/* Edge Extension Modal */}
        <EdgeExtensionModal
          isOpen={edgeModalOpen}
          onClose={() => setEdgeModalOpen(false)}
          baseProjectDir={settings.baseProjectDir}
          onInjectTabContent={handleInjectEdgeTab}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-[#121316] text-[#e3e4e8] select-none">
      {/* Top IDE Header Bar */}
      <TopNav
        onOpenFolder={handleOpenFolder}
        projectBusy={isStreaming || openingFolder}
        models={models}
        settings={settings}
        onUpdateSettings={handleUpdateSettings}
        connectionStatus={connectionStatus}
        onOpenSettings={() => {
          setSettingsTab('general');
          setSettingsModalOpen(true);
        }}
        onOpenAgentDock={() => setAgentdockModalOpen(true)}
        onNewChat={handleNewChat}
        sidebarOpen={sidebarOpen}
        onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
        layoutMode={layoutMode}
        onChangeLayoutMode={setLayoutMode}
        activeFilePath={activeFile?.path}
        activeProjectName={activeProjectName}
        terminalOpen={terminalOpen}
        onToggleTerminal={() => setTerminalOpen((prev) => !prev)}
        onSwitchToAndroid={() => {
          setIsAndroidView(true);
          localStorage.setItem('agentdock_view_mode', 'android');
        }}
        onOpenApkModal={() => setApkModalOpen(true)}
        onOpenEdgeModal={() => {
          setSettingsTab('edge');
          setSettingsModalOpen(true);
        }}
        edgeEnabled={edgeEnabled}
        onToggleEdge={() => setEdgeEnabled((prev) => !prev)}
        onOpenEdgeSettings={() => {
          setSettingsTab('edge');
          setSettingsModalOpen(true);
        }}
      />

      {/* Main Workspace Frame */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar (Explorer / Chats / Models) */}
        {sidebarOpen && (
          <SidebarFiles
            unreadCounts={unread}
            folders={workspaceFolders}
            onDeleteFolder={handleDeleteFolder}
            files={workspaceFiles}
            activeFileId={activeFileId}
            onSelectFile={(id) => {
              setActiveFileId(id);
              if (activeDiff && activeDiff.filename !== workspaceFiles.find((f) => f.id === id)?.path) {
                setActiveDiff(null);
              }
            }}
            onCreateNewFile={handleCreateNewFile}
            onCreateFolder={handleCreateFolder}
            onRenameFile={handleRenameFile}
            onDeleteFile={handleDeleteFile}
            onRefreshFromDisk={handleRefreshFromDisk}
            sessions={sessions}
            activeSessionId={activeSessionId}
            onSelectSession={setActiveSessionId}
            onNewSession={handleNewChat}
            onDeleteSession={handleDeleteSession}
            models={models}
            selectedModel={settings.selectedModel}
            onSelectModel={(name) => handleUpdateSettings({ selectedModel: name })}
            onMentionInChat={handleAskCursorAboutFile}
            onOpenSettings={() => setSettingsModalOpen(true)}
            baseProjectDir={settings.baseProjectDir}
            bridgeOnline={!!connectionStatus.bridgeOnline}
          />
        )}

        {/* Viewport Router: Split View, Chat View, or Composer View */}
        {layoutMode === 'split' && (
          <div ref={splitRef} className="flex-1 flex overflow-hidden">
            {/* Left Column: Code Editor with Unified Diff Review */}
            <div className="flex-1 min-w-0 flex flex-col border-r border-[#23252a] overflow-hidden">
              <CodeEditor
                files={workspaceFiles}
                activeFileId={activeFileId}
                onSelectFile={setActiveFileId}
                onUpdateFileContent={(id, content) => {
                  setWorkspaceFiles((prev) =>
                    prev.map((f) => (f.id === id ? { ...f, content, isModified: true } : f))
                  );
                }}
                onSaveFile={handleSaveFile}
                activeDiff={activeDiff}
                onAcceptDiff={handleAcceptDiff}
                onRejectDiff={handleRejectDiff}
                onAskCursorAboutFile={handleAskCursorAboutFile}
                baseProjectDir={settings.baseProjectDir}
              />
            </div>

            {/* Right Column: Cursor Chat Panel */}
            <div role="separator" aria-label="Resize chat and code editor" aria-orientation="vertical" aria-valuemin={280} aria-valuemax={800} aria-valuenow={chatWidth} tabIndex={0}
              className="w-2 shrink-0 cursor-col-resize bg-[#20242e] hover:bg-blue-500 focus:bg-blue-500 touch-none"
              onKeyDown={e=>{if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();setChatWidth(w=>Math.max(280,Math.min(800,w+(e.key==='ArrowLeft'?20:-20))));}}}
              onPointerDown={e=>{e.currentTarget.setPointerCapture(e.pointerId);}}
              onPointerMove={e=>{if(!e.currentTarget.hasPointerCapture(e.pointerId))return;const bounds=splitRef.current?.getBoundingClientRect();if(bounds)setChatWidth(Math.max(280,Math.min(800,bounds.width-180,bounds.right-e.clientX)));}}
              onPointerUp={e=>{if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);}} />
            <div style={{width:chatWidth,maxWidth:'calc(100% - 100px)'}} className="min-w-0 flex flex-col bg-[#141518] shrink-0 overflow-hidden">
              
              {currentMode === 'bagent' && <BAgentControls models={models} disabled={isStreaming} />}
              <ChatPanel
                messages={currentSession.messages}
                isStreaming={isStreaming}
                onApplyCode={handleApplyCode}
                workspaceFiles={workspaceFiles}
                onSelectSuggestion={(prompt) => handleSendMessage(prompt, activeContextTags, [], currentMode)}
                selectedModel={settings.selectedModel}
                baseProjectDir={settings.baseProjectDir}
                onOpenAgentDock={() => setAgentdockModalOpen(true)}
              />
              <PromptComposer
                mcpEnabled={settings.mcpEnabled !== false}
                onToggleMcp={() => handleUpdateSettings({ mcpEnabled: settings.mcpEnabled === false })}
                onSendMessage={handleSendMessage}
                isStreaming={isStreaming}
                onStopStreaming={handleStopStreaming}
                workspaceFiles={workspaceFiles}
                models={models}
                selectedModel={settings.selectedModel}
                onSelectModel={(name) => handleUpdateSettings({ selectedModel: name })}
                initialContextTags={activeContextTags}
                onRemoveContextTag={(id) => setActiveContextTags((prev) => prev.filter((t) => t.id !== id))}
                mode={currentMode}
                onToggleMode={setCurrentMode}
                baseProjectDir={settings.baseProjectDir}
                onOpenAgentDockModal={() => setAgentdockModalOpen(true)}
                onOpenSettings={() => {
                  setSettingsTab('general');
                  setSettingsModalOpen(true);
                }}
                onOpenEdgeModal={() => {
                  setSettingsTab('edge');
                  setSettingsModalOpen(true);
                }}
                edgeEnabled={edgeEnabled}
                onToggleEdge={() => setEdgeEnabled((prev) => !prev)}
              />
            </div>
          </div>
        )}

        {layoutMode === 'chat' && (
          <div className="flex-1 flex flex-col bg-[#141518] overflow-hidden max-w-4xl mx-auto w-full border-x border-[#23252a]">
            
              {currentMode === 'bagent' && <BAgentControls models={models} disabled={isStreaming} />}
            <ChatPanel
              messages={currentSession.messages}
              isStreaming={isStreaming}
              onApplyCode={handleApplyCode}
              workspaceFiles={workspaceFiles}
              onSelectSuggestion={(prompt) => handleSendMessage(prompt, activeContextTags, [], currentMode)}
              selectedModel={settings.selectedModel}
              baseProjectDir={settings.baseProjectDir}
              onOpenAgentDock={() => setAgentdockModalOpen(true)}
            />
            <PromptComposer
                mcpEnabled={settings.mcpEnabled !== false}
                onToggleMcp={() => handleUpdateSettings({ mcpEnabled: settings.mcpEnabled === false })}
              onSendMessage={handleSendMessage}
              isStreaming={isStreaming}
              onStopStreaming={handleStopStreaming}
              workspaceFiles={workspaceFiles}
              models={models}
              selectedModel={settings.selectedModel}
              onSelectModel={(name) => handleUpdateSettings({ selectedModel: name })}
              initialContextTags={activeContextTags}
              onRemoveContextTag={(id) => setActiveContextTags((prev) => prev.filter((t) => t.id !== id))}
              mode={currentMode}
              onToggleMode={setCurrentMode}
              baseProjectDir={settings.baseProjectDir}
              onOpenAgentDockModal={() => setAgentdockModalOpen(true)}
              onOpenSettings={() => {
                setSettingsTab('general');
                setSettingsModalOpen(true);
              }}
              onOpenEdgeModal={() => {
                setSettingsTab('edge');
                setSettingsModalOpen(true);
              }}
              edgeEnabled={edgeEnabled}
              onToggleEdge={() => setEdgeEnabled((prev) => !prev)}
            />
          </div>
        )}

        {layoutMode === 'composer' && (
          <ComposerView
            files={workspaceFiles}
            onApplyDiffToFile={(filename, newContent) => {
              setWorkspaceFiles((prev) =>
                prev.map((f) => (f.path === filename ? { ...f, content: newContent, isModified: true } : f))
              );
            }}
            activeDiffs={composerDiffs}
            onAcceptAllDiffs={() => {
              composerDiffs.forEach((diff) => {
                const target = workspaceFiles.find((f) => f.path === diff.filename);
                if (target) {
                  setWorkspaceFiles((prev) =>
                    prev.map((f) => (f.id === target.id ? { ...f, content: diff.newContent, isModified: true } : f))
                  );
                }
              });
              setComposerDiffs([]);
            }}
            onRejectAllDiffs={() => setComposerDiffs([])}
            models={models}
            selectedModel={settings.selectedModel}
            onSelectModel={(name) => handleUpdateSettings({ selectedModel: name })}
            onRunComposerPrompt={handleRunComposerPrompt}
            isStreaming={isStreaming}
            onStopStreaming={handleStopStreaming}
            baseProjectDir={settings.baseProjectDir}
          />
        )}
      </div>

      {/* Integrated Terminal Panel (VS Code style PowerShell terminal in Agent Dock) */}
      <TerminalPanel
        isOpen={terminalOpen}
        onClose={() => setTerminalOpen(false)}
        baseProjectDir={settings.baseProjectDir}
        pythonBridgeUrl={settings.pythonBridgeUrl}
        bridgeOnline={!!connectionStatus.bridgeOnline}
      />

      {/* Settings Modal */}
      <SettingsModal
        isOpen={settingsModalOpen}
        onClose={() => setSettingsModalOpen(false)}
        settings={settings}
        onSaveSettings={(newSettings) => {
          setSettings(newSettings);
          if (newSettings.edgeExtensionEnabled !== undefined) {
            setEdgeEnabled(newSettings.edgeExtensionEnabled);
          }
        }}
        onRefreshModels={checkConnections}
        initialTab={settingsTab}
      />

      {/* Agent Dock Hub Modal */}
      <AgentDockModal
        isOpen={agentdockModalOpen}
        onClose={() => setAgentdockModalOpen(false)}
        baseProjectDir={settings.baseProjectDir}
        pythonBridgeUrl={settings.pythonBridgeUrl}
        bridgeOnline={!!connectionStatus.bridgeOnline}
        onProjectCreated={handleProjectCreated}
      />

      {/* Android APK Modal */}
      <AndroidApkModal
        isOpen={apkModalOpen}
        onClose={() => setApkModalOpen(false)}
        baseProjectDir={settings.baseProjectDir}
      />

      {/* Edge Extension Modal */}
      <EdgeExtensionModal
        isOpen={edgeModalOpen}
        onClose={() => setEdgeModalOpen(false)}
        baseProjectDir={settings.baseProjectDir}
        onInjectTabContent={handleInjectEdgeTab}
      />
    </div>
  );
}
