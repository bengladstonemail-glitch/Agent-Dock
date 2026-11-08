import React, { useState } from 'react';
import { 
  Sparkles, 
  Play, 
  Check, 
  X, 
  GitCommit, 
  FileCode, 
  Layers, 
  FolderPlus
} from 'lucide-react';
import { WorkspaceFile, DiffBlock, OllamaModel, ContextTag, AttachedMedia } from '../types/chat';
import { PromptComposer } from './PromptComposer';

interface ComposerViewProps {
  files: WorkspaceFile[];
  onApplyDiffToFile: (filename: string, newContent: string) => void;
  activeDiffs: DiffBlock[];
  onAcceptAllDiffs: () => void;
  onRejectAllDiffs: () => void;
  models: OllamaModel[];
  selectedModel: string;
  onSelectModel: (name: string) => void;
  onRunComposerPrompt: (prompt: string, contextTags: ContextTag[], attachedMedia: AttachedMedia[]) => void;
  isStreaming: boolean;
  onStopStreaming: () => void;
  baseProjectDir?: string;
}

export const ComposerView: React.FC<ComposerViewProps> = ({
  files,
  onApplyDiffToFile,
  activeDiffs,
  onAcceptAllDiffs,
  onRejectAllDiffs,
  models,
  selectedModel,
  onSelectModel,
  onRunComposerPrompt,
  isStreaming,
  onStopStreaming,
  baseProjectDir = '~/AgentDock',
}) => {
  const [selectedDiffIndex, setSelectedDiffIndex] = useState(0);
  const [composerMode, setComposerMode] = useState<'agent' | 'chat' | 'bagent'>('agent');

  const currentDiff = activeDiffs[selectedDiffIndex] || activeDiffs[0];

  return (
    <div className="flex-1 flex flex-col h-full bg-[#121316] overflow-hidden select-text">
      {/* Composer Header */}
      <div className="h-10 border-b border-[#23252a] px-4 flex items-center justify-between bg-[#141518] shrink-0 select-none">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-[#58a6ff]" />
          <span className="font-semibold text-xs text-[#e3e4e8]">Cursor Composer Agent</span>
          <span className="text-[10px] text-[#e3b341] font-mono">· Target: {baseProjectDir}</span>
        </div>

        {activeDiffs.length > 0 && (
          <div className="flex items-center gap-2">
            <button
              onClick={onRejectAllDiffs}
              className="flex items-center gap-1 px-2.5 py-1 rounded bg-[#2b1f24] hover:bg-[#38232a] text-[#f85149] text-xs font-medium transition-colors border border-[#da3633]/40"
            >
              <X className="w-3 h-3" />
              <span>Reject All</span>
            </button>
            <button
              onClick={onAcceptAllDiffs}
              className="flex items-center gap-1.5 px-3 py-1 rounded bg-[#23422d] hover:bg-[#2c5339] text-[#3fb950] text-xs font-semibold transition-colors border border-[#2ea043]/40 shadow-xs"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Accept All (Cmd+Enter)</span>
            </button>
          </div>
        )}
      </div>

      {/* Main Area: Diff Review & Files */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Diff File List */}
        {activeDiffs.length > 0 && (
          <div className="w-60 border-r border-[#23252a] bg-[#141518] p-2 space-y-1 overflow-y-auto select-none">
            <div className="px-2 py-1 text-[10px] uppercase font-semibold text-[#6e7480] tracking-wider">
              Modified Files ({activeDiffs.length})
            </div>
            {activeDiffs.map((diff, idx) => (
              <button
                key={diff.filename}
                onClick={() => setSelectedDiffIndex(idx)}
                className={`w-full px-2.5 py-1.5 rounded text-left flex items-center justify-between text-xs font-mono transition-colors ${
                  idx === selectedDiffIndex
                    ? 'bg-[#1e222b] text-white border-l-2 border-[#58a6ff]'
                    : 'text-[#a4a8b2] hover:bg-[#1a1c22]'
                }`}
              >
                <div className="flex items-center gap-2 truncate">
                  <FileCode className="w-3.5 h-3.5 text-[#58a6ff]" />
                  <span className="truncate">{diff.filename.split('/').pop()}</span>
                </div>
                <span className="text-[10px] text-[#3fb950] font-bold">
                  +{diff.lines.filter((l) => l.type === 'add').length}
                </span>
              </button>
            ))}
          </div>
        )}

        {/* Center: Unified Diff Inspection */}
        <div className="flex-1 flex flex-col overflow-hidden bg-[#121316]">
          {currentDiff ? (
            <div className="flex-1 overflow-auto p-4 font-mono text-xs leading-relaxed">
              <div className="mb-3 pb-2 border-b border-[#23252a] flex items-center justify-between text-xs select-none">
                <span className="text-[#e3e4e8] font-semibold">{currentDiff.filename}</span>
                <span className="text-[11px] text-[#8b909a]">Reviewing changes for {baseProjectDir}</span>
              </div>

              <div className="space-y-0.5">
                {currentDiff.lines.map((dl, idx) => {
                  if (dl.type === 'add') {
                    return (
                      <div
                        key={idx}
                        className="flex items-start bg-[#162e20] text-[#7ee787] px-2 py-0.5 rounded-xs border-l-2 border-[#3fb950]"
                      >
                        <span className="w-10 shrink-0 text-[#3fb950]/60 select-none text-right pr-3">
                          +{dl.newLineNumber || idx + 1}
                        </span>
                        <span className="select-none text-[#3fb950] font-bold w-4 shrink-0">+</span>
                        <pre className="whitespace-pre-wrap font-mono flex-1 overflow-x-auto">{dl.content}</pre>
                      </div>
                    );
                  }
                  if (dl.type === 'delete') {
                    return (
                      <div
                        key={idx}
                        className="flex items-start bg-[#34161a] text-[#ffa198] px-2 py-0.5 rounded-xs border-l-2 border-[#f85149]"
                      >
                        <span className="w-10 shrink-0 text-[#f85149]/60 select-none text-right pr-3">
                          -{dl.oldLineNumber || idx + 1}
                        </span>
                        <span className="select-none text-[#f85149] font-bold w-4 shrink-0">-</span>
                        <pre className="whitespace-pre-wrap font-mono flex-1 line-through opacity-80 overflow-x-auto">{dl.content}</pre>
                      </div>
                    );
                  }
                  return (
                    <div key={idx} className="flex items-start text-[#8b909a] px-2 py-0.5">
                      <span className="w-10 shrink-0 text-[#484f58] select-none text-right pr-3">
                        {dl.oldLineNumber || idx + 1}
                      </span>
                      <span className="w-4 shrink-0 select-none text-transparent"> </span>
                      <pre className="whitespace-pre-wrap font-mono text-[#c9d1d9] flex-1 overflow-x-auto">{dl.content}</pre>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center select-none">
              <Layers className="w-10 h-10 text-[#58a6ff]/50 mb-3" />
              <h3 className="text-sm font-semibold text-[#e3e4e8] mb-1">Agent Dock Composer Ready</h3>
              <p className="text-xs text-[#8b909a] max-w-sm mb-4">
                Autonomously plan and write Python files to <span className="font-mono text-[#58a6ff]">{baseProjectDir}</span>. Paste screenshots or code files below.
              </p>
              <div className="flex flex-wrap gap-2 justify-center max-w-md">
                <button
                  onClick={() =>
                    onRunComposerPrompt(
                      `Generate a complete FastAPI project structure in ${baseProjectDir} with main.py, requirements.txt, and Dockerfile`,
                      [],
                      []
                    )
                  }
                  className="px-3 py-1.5 rounded-lg bg-[#181a1f] hover:bg-[#20232b] border border-[#262830] text-xs text-[#58a6ff] transition-colors"
                >
                  ⚡ Scaffold FastAPI App
                </button>
                <button
                  onClick={() =>
                    onRunComposerPrompt(
                      `Create a local Ollama streaming client in Python with error handling in ${baseProjectDir}`,
                      [],
                      []
                    )
                  }
                  className="px-3 py-1.5 rounded-lg bg-[#181a1f] hover:bg-[#20232b] border border-[#262830] text-xs text-[#d2a8ff] transition-colors"
                >
                  ⚡ Scaffold Ollama Agent
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Floating Prompt Composer at bottom */}
      <div className="p-3 bg-[#141518] border-t border-[#23252a]">
        <PromptComposer
          onSendMessage={(content, contextTags, attachedMedia, mode) =>
            onRunComposerPrompt(content, contextTags, attachedMedia)
          }
          isStreaming={isStreaming}
          onStopStreaming={onStopStreaming}
          workspaceFiles={files}
          models={models}
          selectedModel={selectedModel}
          onSelectModel={onSelectModel}
          mode={composerMode}
          onToggleMode={setComposerMode}
          baseProjectDir={baseProjectDir}
        />
      </div>
    </div>
  );
};
