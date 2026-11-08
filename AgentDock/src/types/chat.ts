export interface OllamaModel {
  cloud?: boolean;
  name: string;
  size?: string;
  parameterSize?: string;
  family?: string;
  description: string;
  supportsThinking?: boolean;
  supportsVision?: boolean;
  isPopular?: boolean;
  modifiedAt?: string;
}

export interface AttachedMedia {
  id: string;
  type: 'image' | 'file';
  name: string;
  size: number;
  mimeType: string;
  base64?: string; // For images sent to Ollama vision models
  textContent?: string; // For documents/code files (.py, .txt, .json, .md)
  previewUrl?: string;
}

export interface ContextTag {
  id: string;
  type: 'file' | 'folder' | 'codebase' | 'web' | 'docs' | 'git' | 'project';
  label: string;
  path?: string;
  content?: string;
}

export interface DiffLine {
  type: 'add' | 'delete' | 'context';
  content: string;
  oldLineNumber?: number;
  newLineNumber?: number;
}

export interface DiffBlock {
  filename: string;
  lines: DiffLine[];
  originalContent: string;
  newContent: string;
  status: 'pending' | 'accepted' | 'rejected';
}

export interface AgentFileAction {
  type: 'create' | 'modify' | 'delete' | 'run';
  targetPath: string; // e.g. ~/AgentDock/my-project/main.py
  content?: string;
  command?: string;
  status: 'pending' | 'executed' | 'failed';
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  model?: string;
  contextTags?: ContextTag[];
  attachedMedia?: AttachedMedia[];
  mode?: 'agent' | 'chat' | 'bagent';
  thinkingProcess?: {
    isExpanded: boolean;
    durationSeconds?: number;
    thoughts: string;
    steps?: string[];
  };
  agentActions?: AgentFileAction[];
  appliedDiff?: DiffBlock;
  webSearchSources?: WebSearchResult[];
  edgeTabContext?: EdgeTabContent;
  metrics?: {
    tokensPerSecond?: number;
    totalTokens?: number;
    evalDuration?: number;
    timeToFirstToken?: number;
  };
}

export interface WebSearchResult {
  title: string;
  url: string;
  snippet: string;
  domain?: string;
}

export interface EdgeTabContent {
  id?: string;
  url: string;
  title: string;
  content: string;
  selectedText?: string;
  timestamp: number;
}

export interface ChatSession {
  id: string;
  title: string;
  model: string;
  mode: 'agent' | 'chat' | 'bagent';
  messages: ChatMessage[];
  projectName?: string; // e.g. ~/AgentDock/fastapi-service
  createdAt: number;
  updatedAt: number;
}

export interface OllamaSettings {
  baseUrl: string;
  pythonBridgeUrl: string; // default http://localhost:8000
  selectedModel: string;
  temperature: number;
  topP: number;
  contextWindow: number;
  systemPrompt: string;
  baseProjectDir: string; // default ~/AgentDock
  useProxy: boolean;
  isSimulatedFallback: boolean;
  mcpEnabled?: boolean;
  mcpConfigJson?: string;
  edgeExtensionEnabled?: boolean;
}

export interface McpServerConfig {
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  url?: string;
  disabled?: boolean;
}

export interface McpConfigFile {
  mcpServers: Record<string, McpServerConfig>;
}

export interface McpToolParameter {
  type: string;
  description?: string;
  properties?: Record<string, any>;
  required?: string[];
}

export interface McpTool {
  name: string;
  serverName: string;
  description: string;
  inputSchema?: McpToolParameter;
}

export interface McpServerStatus {
  name: string;
  status: 'connected' | 'connecting' | 'disconnected' | 'error';
  command?: string;
  args?: string[];
  url?: string;
  error?: string;
  tools: McpTool[];
  lastPing?: number;
}

export interface WorkspaceFile {
  id: string;
  name: string;
  path: string;
  language: string;
  content: string;
  isModified?: boolean;
  diffContent?: string;
}

export interface AgentDockProject {
  id: string;
  name: string;
  path: string; // e.g. ~/AgentDock/fastapi-app
  type: 'python-fastapi' | 'python-ai' | 'python-script' | 'python-data' | 'custom';
  files: WorkspaceFile[];
  createdAt: number;
}
