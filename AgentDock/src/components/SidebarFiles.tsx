import { ModelLibrary } from './ModelLibrary';
import React, { useState, useEffect } from 'react';
import { 
  FolderTree, 
  MessageSquare, 
  Cpu, 
  FileCode, 
  FileJson, 
  FileText, 
  Plus, 
  Trash2, 
  FolderPlus,
  Folder,
  AtSign,
  RotateCw,
  Edit2,
  Check,
  X
} from 'lucide-react';
import { WorkspaceFile, ChatSession, OllamaModel } from '../types/chat';

interface SidebarFilesProps {
  unreadCounts?: Record<string,number>;
  folders?: string[];
  onDeleteFolder?: (folderPath: string) => void;
  files: WorkspaceFile[];
  activeFileId: string;
  onSelectFile: (fileId: string) => void;
  onCreateNewFile: (filename: string) => void;
  onCreateFolder?: (folderName: string) => void;
  onRenameFile?: (fileId: string, newName: string) => void;
  onDeleteFile?: (fileId: string) => void;
  onRefreshFromDisk?: () => void;
  sessions: ChatSession[];
  activeSessionId: string;
  onSelectSession: (sessionId: string) => void;
  onNewSession: () => void;
  onDeleteSession: (sessionId: string) => void;
  models: OllamaModel[];
  selectedModel: string;
  onSelectModel: (modelName: string) => void;
  onMentionInChat?: (file: WorkspaceFile) => void;
  onOpenSettings: () => void;
  baseProjectDir?: string;
  bridgeOnline?: boolean;
}

export const SidebarFiles: React.FC<SidebarFilesProps> = ({
  unreadCounts = {},
  folders = [],
  onDeleteFolder,
  files,
  activeFileId,
  onSelectFile,
  onCreateNewFile,
  onCreateFolder,
  onRenameFile,
  onDeleteFile,
  onRefreshFromDisk,
  sessions,
  activeSessionId,
  onSelectSession,
  onNewSession,
  onDeleteSession,
  models,
  selectedModel,
  onSelectModel,
  onMentionInChat,
  onOpenSettings,
  baseProjectDir = '~/AgentDock',
  bridgeOnline = false,
}) => {
  const [currentFolder, setCurrentFolder] = useState('');
  useEffect(()=>{setCurrentFolder('');},[baseProjectDir]);
  const normalizePath = (value: string) => value.replace(/\\/g, '/').replace(/\/$/, '');
  const relativeFilePath = (file: WorkspaceFile) => {
    const base = normalizePath(baseProjectDir || '');
    const full = normalizePath(file.path);
    return base && full.toLowerCase().startsWith(base.toLowerCase() + '/') ? full.slice(base.length + 1) : file.id;
  };
  const parentPath = (value: string) => value.includes('/') ? value.slice(0, value.lastIndexOf('/')) : '';
  const visibleFiles = files.filter(file => parentPath(relativeFilePath(file)) === currentFolder);
  const visibleFolders = folders.filter(folder => parentPath(folder) === currentFolder);
  const insideFolder = (name: string) => currentFolder ? `${currentFolder}/${name}` : name;
  const [activeTab, setActiveTab] = useState<'files' | 'history' | 'models'>('files');
  const [showNewFileInput, setShowNewFileInput] = useState(false);
  const [showNewFolderInput, setShowNewFolderInput] = useState(false);
  const [newFileName, setNewFileName] = useState('');
  const [newFolderName, setNewFolderName] = useState('');
  const [editingFileId, setEditingFileId] = useState<string | null>(null);
  const [renamedName, setRenamedName] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleCreateFileSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFileName.trim()) return;
    onCreateNewFile(insideFolder(newFileName.trim()));
    setNewFileName('');
    setShowNewFileInput(false);
  };

  const handleCreateFolderSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;
    if (onCreateFolder) {
      onCreateFolder(insideFolder(newFolderName.trim()));
    }
    setNewFolderName('');
    setShowNewFolderInput(false);
  };

  const handleStartRename = (file: WorkspaceFile, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingFileId(file.id);
    setRenamedName(file.name);
  };

  const handleRenameSubmit = (fileId: string, e: React.FormEvent) => {
    e.preventDefault();
    if (renamedName.trim() && onRenameFile) {
      onRenameFile(fileId, renamedName.trim());
    }
    setEditingFileId(null);
  };

  const handleRefreshClick = () => {
    if (!onRefreshFromDisk) return;
    setIsRefreshing(true);
    onRefreshFromDisk();
    setTimeout(() => setIsRefreshing(false), 800);
  };

  const getFileIcon = (filename: string) => {
    if (filename.endsWith('.py')) {
      return <FileCode className="w-3.5 h-3.5 text-[#3fb950] shrink-0" />;
    }
    if (filename.endsWith('.ts') || filename.endsWith('.tsx') || filename.endsWith('.js')) {
      return <FileCode className="w-3.5 h-3.5 text-[#58a6ff] shrink-0" />;
    }
    if (filename.endsWith('.json')) {
      return <FileJson className="w-3.5 h-3.5 text-[#e3b341] shrink-0" />;
    }
    return <FileText className="w-3.5 h-3.5 text-[#8b909a] shrink-0" />;
  };

  return (
    <div className="w-64 bg-[#141518] border-r border-[#23252a] flex flex-col h-full min-h-0 shrink-0 select-none">
      {/* Tab Switcher */}
      <div className="h-9 border-b border-[#23252a] px-2 flex items-center gap-1 bg-[#121316]">
        <button
          onClick={() => setActiveTab('files')}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${
            activeTab === 'files'
              ? 'bg-[#1f2127] text-[#e3e4e8]'
              : 'text-[#8b909a] hover:text-[#e3e4e8]'
          }`}
        >
          <FolderTree className="w-3.5 h-3.5" />
          <span>Explorer</span>
        </button>

        <button
          onClick={() => setActiveTab('history')}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${
            activeTab === 'history'
              ? 'bg-[#1f2127] text-[#e3e4e8]'
              : 'text-[#8b909a] hover:text-[#e3e4e8]'
          }`}
        >
          <MessageSquare className="w-3.5 h-3.5" />
          <span>Chats</span>{Object.values(unreadCounts).reduce((a,b)=>a+b,0)>0 && <span className="rounded-full bg-blue-600 text-white px-1 text-[10px]">{Object.values(unreadCounts).reduce((a,b)=>a+b,0)}</span>}
          <span className="text-[10px] text-[#6e7480] font-mono">({sessions.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('models')}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${
            activeTab === 'models'
              ? 'bg-[#1f2127] text-[#e3e4e8]'
              : 'text-[#8b909a] hover:text-[#e3e4e8]'
          }`}
        >
          <Cpu className="w-3.5 h-3.5" />
          <span>Models</span>
        </button>
      </div>

      {/* Tab Content */}
      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-2">
        {activeTab === 'files' && (
          <div className="space-y-1">
            {/* Header: Root Directory Bar */}
            <div className="px-2 py-1.5 bg-[#17191e] rounded-lg border border-[#23262f] flex items-center justify-between">
              <div className="truncate flex-1 pr-1">
                <span className="text-[10px] uppercase font-bold text-[#e3b341] tracking-wider block">
                  Agent Dock Workspace
                </span>
                <span className="text-[10.5px] font-mono text-[#a4a8b2] truncate block" title={baseProjectDir}>
                  {baseProjectDir}
                </span>
              </div>

              <div className="flex items-center gap-1">
                {/* Refresh files from disk */}
                {onRefreshFromDisk && (
                  <button
                    onClick={handleRefreshClick}
                    className="p-1 hover:bg-[#252833] rounded text-[#8b909a] hover:text-[#58a6ff] transition-colors"
                    title="Sync/Refresh files from PC disk"
                  >
                    <RotateCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-[#58a6ff]' : ''}`} />
                  </button>
                )}

                {/* New Folder button */}
                <button
                  onClick={() => {
                    setShowNewFolderInput(!showNewFolderInput);
                    setShowNewFileInput(false);
                  }}
                  className="p-1 hover:bg-[#252833] rounded text-[#8b909a] hover:text-[#e3b341] transition-colors"
                  title="New Folder"
                >
                  <FolderPlus className="w-3.5 h-3.5" />
                </button>

                {/* New File button */}
                <button
                  onClick={() => {
                    setShowNewFileInput(!showNewFileInput);
                    setShowNewFolderInput(false);
                  }}
                  className="p-1 hover:bg-[#252833] rounded text-[#8b909a] hover:text-[#3fb950] transition-colors"
                  title="New File"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Inline New File Input */}
            {showNewFileInput && (
              <form onSubmit={handleCreateFileSubmit} className="p-1.5 bg-[#181a20] rounded border border-[#388bfd] my-1">
                <input
                  type="text"
                  autoFocus
                  value={newFileName}
                  onChange={(e) => setNewFileName(e.target.value)}
                  placeholder="e.g. script.py or utils.py"
                  className="w-full bg-[#121316] border border-[#2b2d35] rounded px-2 py-1 text-xs font-mono text-white outline-none"
                />
                <div className="flex items-center justify-end gap-1 mt-1">
                  <button
                    type="button"
                    onClick={() => setShowNewFileInput(false)}
                    className="px-2 py-0.5 text-[10px] text-[#8b909a] hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-2 py-0.5 text-[10px] font-semibold bg-[#23422d] hover:bg-[#2c5339] text-[#3fb950] rounded"
                  >
                    Create File
                  </button>
                </div>
              </form>
            )}

            {/* Inline New Folder Input */}
            {showNewFolderInput && (
              <form onSubmit={handleCreateFolderSubmit} className="p-1.5 bg-[#181a20] rounded border border-[#e3b341] my-1">
                <input
                  type="text"
                  autoFocus
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  placeholder="e.g. api or models"
                  className="w-full bg-[#121316] border border-[#2b2d35] rounded px-2 py-1 text-xs font-mono text-white outline-none"
                />
                <div className="flex items-center justify-end gap-1 mt-1">
                  <button
                    type="button"
                    onClick={() => setShowNewFolderInput(false)}
                    className="px-2 py-0.5 text-[10px] text-[#8b909a] hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-2 py-0.5 text-[10px] font-semibold bg-[#3d321d] hover:bg-[#4d3f24] text-[#e3b341] rounded"
                  >
                    Create Folder
                  </button>
                </div>
              </form>
            )}

            {/* Include empty directories returned by the workspace scanner. */}
            <div className="flex items-center gap-2 px-2 py-2 text-xs text-[#8b909a]">
              <button className="text-blue-400" onClick={() => setCurrentFolder('')}>Workspace</button>
              {currentFolder && <button className="text-blue-400" onClick={() => setCurrentFolder(parentPath(currentFolder))}>↑ Up</button>}
            </div>
            <div className="px-2 text-xs text-[#e3b341] break-all">{currentFolder || 'Workspace root'}</div>
            {visibleFolders.map(folder => (
              <div key={folder} title={`Open ${folder}`} role="button" tabIndex={0} onClick={() => setCurrentFolder(folder)} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setCurrentFolder(folder); } }} className="flex items-center gap-2 px-2 py-1.5 text-xs font-mono text-[#e3b341]">
                <Folder className="w-3.5 h-3.5 shrink-0" />
                <span className="break-all">▸ {folder.split('/').pop()}</span>
                {onDeleteFolder && <button type="button" className="ml-auto p-1 text-[#8b909a] hover:text-[#f85149]" title={`Delete folder ${folder}`} aria-label={`Delete folder ${folder}`} onClick={e => {e.stopPropagation(); onDeleteFolder(folder);}} onKeyDown={e => e.stopPropagation()}><Trash2 className="w-3.5 h-3.5" /></button>}
              </div>
            ))}
            {/* File List */}
            <div className="space-y-0.5 mt-2 font-mono text-xs">
              {visibleFiles.length === 0 && visibleFolders.length === 0 ? (
                <div className="py-6 px-3 text-center border border-dashed border-[#262933] rounded-lg mt-3 bg-[#111317]">
                  <Folder className="w-6 h-6 text-[#484f58] mx-auto mb-2 opacity-60" />
                  <p className="text-xs text-[#8b909a] font-medium">This folder is empty</p>
                  <p className="text-[10px] text-[#484f58] mt-1 break-all font-mono">{baseProjectDir}</p>
                  <button
                    onClick={() => setShowNewFileInput(true)}
                    className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 text-[11px] font-semibold bg-[#23422d] hover:bg-[#2c5339] text-[#3fb950] rounded border border-[#3fb950]/30 transition-colors"
                  >
                    <Plus className="w-3 h-3" />
                    Create File
                  </button>
                </div>
              ) : (
                visibleFiles.map((file) => {
                const isActive = file.id === activeFileId;
                const isEditing = editingFileId === file.id;

                if (isEditing) {
                  return (
                    <form
                      key={file.id}
                      onSubmit={(e) => handleRenameSubmit(file.id, e)}
                      className="flex items-center gap-1 px-1 py-1 bg-[#1a1d24] rounded border border-[#58a6ff]"
                    >
                      <input
                        type="text"
                        autoFocus
                        value={renamedName}
                        onChange={(e) => setRenamedName(e.target.value)}
                        className="flex-1 bg-transparent border-0 outline-none text-xs font-mono text-white px-1"
                      />
                      <button type="submit" className="p-1 text-[#3fb950] hover:text-white">
                        <Check className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingFileId(null)}
                        className="p-1 text-[#8b909a] hover:text-white"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </form>
                  );
                }

                return (
                  <div
                    key={file.id}
                    className={`group flex items-center justify-between px-2 py-1.5 rounded cursor-pointer transition-colors ${
                      isActive
                        ? 'bg-[#1e222b] text-white border-l-2 border-[#58a6ff]'
                        : 'text-[#a4a8b2] hover:bg-[#1a1c22] hover:text-[#e3e4e8]'
                    }`}
                    onClick={() => onSelectFile(file.id)}
                  >
                    <div className="flex items-center gap-2 truncate flex-1">
                      {getFileIcon(file.name)}
                      <span className="truncate text-[11px]">{file.name}</span>
                      {file.isModified && (
                        <span className="text-[9px] text-[#e3b341] font-bold" title="Unsaved changes">
                          ●
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      {/* Rename File */}
                      {onRenameFile && (
                        <button
                          onClick={(e) => handleStartRename(file, e)}
                          className="p-1 hover:bg-[#2b2e38] rounded text-[#8b909a] hover:text-[#e3e4e8]"
                          title={`Rename ${file.name}`}
                        >
                          <Edit2 className="w-3 h-3" />
                        </button>
                      )}

                      {/* Quick @ mention button */}
                      {onMentionInChat && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onMentionInChat(file);
                          }}
                          className="p-1 hover:bg-[#2b2e38] rounded text-[#8b909a] hover:text-[#58a6ff]"
                          title={`Mention @${file.name} in prompt`}
                        >
                          <AtSign className="w-3 h-3" />
                        </button>
                      )}

                      {/* Delete File button */}
                      {onDeleteFile && files.length > 1 && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteFile(file.id);
                          }}
                          className="p-1 hover:bg-[#2b2e38] rounded text-[#8b909a] hover:text-[#f85149]"
                          title={`Delete ${file.name}`}
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              }))}
            </div>

            <div className="mt-4 pt-3 border-t border-[#23252a] px-2 text-[10px] text-[#6e7480]">
              <p className="leading-relaxed">
                Click any file to edit with auto-closing pairs <code className="text-[#a4a8b2]">()</code> <code className="text-[#a4a8b2]">[]</code> <code className="text-[#a4a8b2]">""</code>. Press <kbd className="px-1 py-0.5 bg-[#1e2026] text-[#a4a8b2] rounded">Ctrl+S</kbd> to save.
              </p>
            </div>
          </div>
        )}

        {activeTab === 'history' && (
          <div className="space-y-1">
            <div className="flex items-center justify-between px-2 py-1 mb-1">
              <span className="text-[10px] uppercase font-semibold text-[#6e7480] tracking-wider">
                Recent Chats
              </span>
              <button
                onClick={onNewSession}
                className="p-1 hover:bg-[#23252b] rounded text-[#58a6ff] transition-colors"
                title="New Chat"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="space-y-1">
              {sessions.map((sess) => {
                const isActive = sess.id === activeSessionId;
                return (
                  <div
                    key={sess.id}
                    onClick={() => onSelectSession(sess.id)}
                    className={`group flex items-start justify-between p-2 rounded cursor-pointer transition-colors ${
                      isActive
                        ? 'bg-[#1f222b] text-white border-l-2 border-[#58a6ff]'
                        : 'text-[#a4a8b2] hover:bg-[#1a1c22] hover:text-[#e3e4e8]'
                    }`}
                  >
                    <div className="truncate flex-1 pr-2">
                      <div className="text-[12px] font-medium truncate text-[#e3e4e8]">
                        {sess.title || 'Untitled Session'}{unreadCounts[sess.id]>0 && <span className="ml-2 rounded-full bg-blue-600 text-white px-1.5">{unreadCounts[sess.id]}</span>}
                      </div>
                      <div className="text-[10px] text-[#6e7480] font-mono mt-0.5 flex items-center gap-1.5">
                        <span className="text-[#58a6ff]">{sess.model}</span>
                        <span>·</span>
                        <span>{sess.messages.length} msgs</span>
                      </div>
                    </div>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteSession(sess.id);
                      }}
                      className="opacity-0 group-hover:opacity-100 p-1 hover:bg-[#2b2e38] rounded text-[#8b909a] hover:text-[#f85149] transition-all"
                      title="Delete chat"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {activeTab === 'models' && (
          <ModelLibrary models={models} selected={selectedModel} onSelect={onSelectModel} />
        )}
      </div>
    </div>
  );
};
