import React, { useState, useEffect, useRef } from 'react';
import { 
  X, 
  Check, 
  RotateCcw, 
  MessageSquarePlus, 
  Copy, 
  FileCode, 
  Save, 
  Sparkles, 
  GitCommit, 
  CheckCheck,
  Code2,
  Braces,
  FileCheck,
  Zap,
  CornerDownLeft
} from 'lucide-react';
import { WorkspaceFile, DiffBlock } from '../types/chat';

interface CodeEditorProps {
  files: WorkspaceFile[];
  activeFileId: string;
  onSelectFile: (fileId: string) => void;
  onUpdateFileContent: (fileId: string, content: string) => void;
  onSaveFile?: (fileId: string, content: string) => void;
  activeDiff: DiffBlock | null;
  onAcceptDiff: () => void;
  onRejectDiff: () => void;
  onAskCursorAboutFile: (file: WorkspaceFile) => void;
  baseProjectDir?: string;
}

interface CodeSnippet {
  prefix: string;
  label: string;
  description: string;
  insertText: string;
  cursorOffset?: number;
}

const PYTHON_SNIPPETS: CodeSnippet[] = [
  {
    prefix: 'def',
    label: 'def function():',
    description: 'Python function definition',
    insertText: 'def function_name(args):\n    """Docstring."""\n    pass\n',
    cursorOffset: 4,
  },
  {
    prefix: 'class',
    label: 'class MyClass:',
    description: 'Python class definition',
    insertText: 'class ClassName:\n    def __init__(self):\n        pass\n',
    cursorOffset: 6,
  },
  {
    prefix: 'main',
    label: 'if __name__ == "__main__":',
    description: 'Standard Python entry point',
    insertText: 'if __name__ == "__main__":\n    main()\n',
    cursorOffset: 31,
  },
  {
    prefix: 'for',
    label: 'for item in items:',
    description: 'For loop iteration',
    insertText: 'for item in items:\n    pass\n',
    cursorOffset: 4,
  },
  {
    prefix: 'if',
    label: 'if condition:',
    description: 'If condition branch',
    insertText: 'if condition:\n    pass\n',
    cursorOffset: 3,
  },
  {
    prefix: 'try',
    label: 'try / except:',
    description: 'Exception handling block',
    insertText: 'try:\n    pass\nexcept Exception as e:\n    print(f"Error: {e}")\n',
    cursorOffset: 9,
  },
  {
    prefix: 'print',
    label: 'print()',
    description: 'Print to standard output',
    insertText: 'print()',
    cursorOffset: 6,
  },
  {
    prefix: 'fastapi',
    label: 'FastAPI Endpoint',
    description: 'FastAPI route definition',
    insertText: '@app.get("/endpoint")\ndef handle_request():\n    return {"status": "ok"}\n',
    cursorOffset: 10,
  },
  {
    prefix: 'ollama',
    label: 'Ollama Client Call',
    description: 'Query local Ollama model in Python',
    insertText: 'import requests\nres = requests.post("http://localhost:11434/api/generate", json={\n    "model": "deepseek-r1:8b",\n    "prompt": "Hello",\n    "stream": False\n})\nprint(res.json().get("response"))\n',
  },
  {
    prefix: 'with',
    label: 'with open(...) as f:',
    description: 'Context manager file open',
    insertText: 'with open("filename.txt", "r", encoding="utf-8") as f:\n    content = f.read()\n',
    cursorOffset: 11,
  },
  {
    prefix: 'async',
    label: 'async def():',
    description: 'Asynchronous coroutine function',
    insertText: 'async def async_handler():\n    pass\n',
    cursorOffset: 10,
  },
];

export const CodeEditor: React.FC<CodeEditorProps> = ({
  files,
  activeFileId,
  onSelectFile,
  onUpdateFileContent,
  onSaveFile,
  activeDiff,
  onAcceptDiff,
  onRejectDiff,
  onAskCursorAboutFile,
  baseProjectDir = '~/AgentDock',
}) => {
  const activeFile = files.find((f) => f.id === activeFileId) || files[0];
  const [copied, setCopied] = useState(false);
  const [savedFeedback, setSavedFeedback] = useState(false);
  const [currentLineIndex, setCurrentLineIndex] = useState(0);

  // IntelliSense suggestions state
  const [suggestions, setSuggestions] = useState<CodeSnippet[]>([]);
  const [selectedSnippetIdx, setSelectedSnippetIdx] = useState(0);
  const [suggestionPos, setSuggestionPos] = useState<{ x: number; y: number } | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Sync keyboard shortcut Ctrl+S or Cmd+S to save
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeFile, onSaveFile]);

  const handleCopy = () => {
    if (!activeFile) return;
    navigator.clipboard.writeText(activeFile.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSave = () => {
    if (!activeFile) return;
    if (onSaveFile) {
      onSaveFile(activeFile.id, activeFile.content);
    }
    setSavedFeedback(true);
    setTimeout(() => setSavedFeedback(false), 2500);
  };

  // Track cursor position to update active line number
  const updateCursorLine = () => {
    if (!textareaRef.current) return;
    const pos = textareaRef.current.selectionStart;
    const textBefore = textareaRef.current.value.substring(0, pos);
    const lineNum = textBefore.split('\n').length - 1;
    setCurrentLineIndex(lineNum);
  };

  // Helper to replace selection and position cursor
  const applyTextEdit = (
    newFullText: string,
    newCursorStart: number,
    newCursorEnd: number = newCursorStart
  ) => {
    if (!activeFile) return;
    onUpdateFileContent(activeFile.id, newFullText);
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.selectionStart = newCursorStart;
        textareaRef.current.selectionEnd = newCursorEnd;
        textareaRef.current.focus();
        updateCursorLine();
      }
    }, 0);
  };

  // Insert IntelliSense snippet
  const insertSnippet = (snippet: CodeSnippet) => {
    if (!textareaRef.current || !activeFile) return;
    const textarea = textareaRef.current;
    const start = textarea.selectionStart;
    const value = textarea.value;

    // Remove the typed prefix word before cursor
    const textBefore = value.substring(0, start);
    const match = textBefore.match(/([a-zA-Z0-9_]+)$/);
    const prefixLen = match ? match[1].length : 0;
    const replaceStart = start - prefixLen;

    const newContent = value.substring(0, replaceStart) + snippet.insertText + value.substring(start);
    const targetCursor = replaceStart + (snippet.cursorOffset ?? snippet.insertText.length);

    applyTextEdit(newContent, targetCursor);
    setSuggestions([]);
  };

  // Main Editor Key Handler: Auto-closing pairs, overtyping, indentation, tabs
  const handleEditorKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const textarea = e.currentTarget;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const value = textarea.value;
    const hasSelection = start !== end;
    const selectedText = value.substring(start, end);
    const charAfter = value.charAt(start);
    const charBefore = value.charAt(start - 1);

    // 1. Handle Active IntelliSense navigation
    if (suggestions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedSnippetIdx((prev) => (prev + 1) % suggestions.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedSnippetIdx((prev) => (prev - 1 + suggestions.length) % suggestions.length);
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        insertSnippet(suggestions[selectedSnippetIdx]);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setSuggestions([]);
        return;
      }
    }

    // 2. Auto-close Overtype / Skip: If user types closing char and it already matches next char
    const CLOSING_CHARS = [')', ']', '}', '"', "'", '`'];
    if (CLOSING_CHARS.includes(e.key) && !hasSelection) {
      if (charAfter === e.key) {
        e.preventDefault();
        // Skip over the closing character
        textarea.selectionStart = textarea.selectionEnd = start + 1;
        updateCursorLine();
        return;
      }
    }

    // 3. Selection Wrapping & Auto-Closing Pairs
    const PAIR_MAP: Record<string, string> = {
      '(': ')',
      '[': ']',
      '{': '}',
      '"': '"',
      "'": "'",
      '`': '`',
    };

    if (e.key in PAIR_MAP) {
      const openChar = e.key;
      const closeChar = PAIR_MAP[openChar];

      // If user selected text: wrap the selection with open and close
      if (hasSelection) {
        e.preventDefault();
        const wrapped = openChar + selectedText + closeChar;
        const newText = value.substring(0, start) + wrapped + value.substring(end);
        applyTextEdit(newText, start + 1, end + 1);
        return;
      }

      // Special handling for Python triple quotes (""")
      if (openChar === '"' && charBefore === '"' && value.charAt(start - 2) === '"') {
        e.preventDefault();
        // User typed 3rd quote: insert 3 closing quotes to make """|"""
        const newText = value.substring(0, start) + '"""' + value.substring(end);
        applyTextEdit(newText, start);
        return;
      }

      // Normal Auto-close: insert both open and close, place cursor in between
      e.preventDefault();
      const newText = value.substring(0, start) + openChar + closeChar + value.substring(end);
      applyTextEdit(newText, start + 1);
      return;
    }

    // 4. Smart Backspace: Delete matching pair if cursor is between them
    if (e.key === 'Backspace' && !hasSelection) {
      const isBetweenPair =
        (charBefore === '(' && charAfter === ')') ||
        (charBefore === '[' && charAfter === ']') ||
        (charBefore === '{' && charAfter === '}') ||
        (charBefore === '"' && charAfter === '"') ||
        (charBefore === "'" && charAfter === "'") ||
        (charBefore === '`' && charAfter === '`');

      if (isBetweenPair) {
        e.preventDefault();
        const newText = value.substring(0, start - 1) + value.substring(start + 1);
        applyTextEdit(newText, start - 1);
        return;
      }
    }

    // 5. Smart Enter & Auto-Indentation (Python & VS Code style)
    if (e.key === 'Enter') {
      e.preventDefault();

      // Find current line up to cursor
      const lineStart = value.lastIndexOf('\n', start - 1) + 1;
      const currentLineBeforeCursor = value.substring(lineStart, start);
      const currentIndentMatch = currentLineBeforeCursor.match(/^(\s*)/);
      const currentIndent = currentIndentMatch ? currentIndentMatch[1] : '';

      // Check if cursor is directly between braces: {|} or [|] or (|)
      const isBetweenBraces =
        (charBefore === '{' && charAfter === '}') ||
        (charBefore === '[' && charAfter === ']') ||
        (charBefore === '(' && charAfter === ')');

      if (isBetweenBraces) {
        // Split across 3 lines with indented middle line
        const extraIndent = currentIndent + '    ';
        const insertion = '\n' + extraIndent + '\n' + currentIndent;
        const newText = value.substring(0, start) + insertion + value.substring(end);
        applyTextEdit(newText, start + 1 + extraIndent.length);
        return;
      }

      // In Python: if line ends with a colon (:), indent next line by 4 spaces
      const trimmedBefore = currentLineBeforeCursor.trim();
      const needsIndent = trimmedBefore.endsWith(':');
      const newIndent = currentIndent + (needsIndent ? '    ' : '');

      const insertion = '\n' + newIndent;
      const newText = value.substring(0, start) + insertion + value.substring(end);
      applyTextEdit(newText, start + insertion.length);
      return;
    }

    // 6. Tab & Shift+Tab Indentation
    if (e.key === 'Tab') {
      e.preventDefault();

      if (e.shiftKey) {
        // Dedent: Remove up to 4 spaces from current line or all selected lines
        const lineStart = value.lastIndexOf('\n', start - 1) + 1;
        const lineEnd = value.indexOf('\n', end);
        const effectiveEnd = lineEnd === -1 ? value.length : lineEnd;
        const linesBlock = value.substring(lineStart, effectiveEnd);

        const dedented = linesBlock
          .split('\n')
          .map((ln) => ln.replace(/^ {1,4}/, ''))
          .join('\n');

        const newText = value.substring(0, lineStart) + dedented + value.substring(effectiveEnd);
        applyTextEdit(newText, Math.max(lineStart, start - 4), Math.max(lineStart, end - 4));
        return;
      }

      // Normal Tab:
      if (hasSelection) {
        // Indent all selected lines
        const lineStart = value.lastIndexOf('\n', start - 1) + 1;
        const lineEnd = value.indexOf('\n', end);
        const effectiveEnd = lineEnd === -1 ? value.length : lineEnd;
        const linesBlock = value.substring(lineStart, effectiveEnd);

        const indented = linesBlock
          .split('\n')
          .map((ln) => '    ' + ln)
          .join('\n');

        const newText = value.substring(0, lineStart) + indented + value.substring(effectiveEnd);
        applyTextEdit(newText, start + 4, end + 4);
        return;
      }

      // Single cursor: Insert 4 spaces
      const newText = value.substring(0, start) + '    ' + value.substring(end);
      applyTextEdit(newText, start + 4);
      return;
    }

    // 7. Toggle Comment (Cmd+/ or Ctrl+/)
    if ((e.metaKey || e.ctrlKey) && e.key === '/') {
      e.preventDefault();
      const lineStart = value.lastIndexOf('\n', start - 1) + 1;
      const lineEnd = value.indexOf('\n', end);
      const effectiveEnd = lineEnd === -1 ? value.length : lineEnd;
      const linesBlock = value.substring(lineStart, effectiveEnd);

      const isPython = activeFile.name.endsWith('.py');
      const commentChar = isPython ? '# ' : '// ';

      const allCommented = linesBlock.split('\n').every((ln) => ln.trim().startsWith(isPython ? '#' : '//'));
      const toggled = linesBlock
        .split('\n')
        .map((ln) => {
          if (allCommented) {
            return ln.replace(isPython ? /^(\s*)#\s?/ : /^(\s*)\/\/\s?/, '$1');
          } else {
            return commentChar + ln;
          }
        })
        .join('\n');

      const newText = value.substring(0, lineStart) + toggled + value.substring(effectiveEnd);
      applyTextEdit(newText, start, end + (toggled.length - linesBlock.length));
      return;
    }

    // 8. Duplicate Line (Shift + Alt + Down)
    if (e.shiftKey && e.altKey && e.key === 'ArrowDown') {
      e.preventDefault();
      const lineStart = value.lastIndexOf('\n', start - 1) + 1;
      const nextNewline = value.indexOf('\n', start);
      const lineEnd = nextNewline === -1 ? value.length : nextNewline;
      const currentLineText = value.substring(lineStart, lineEnd);

      const newText =
        value.substring(0, lineEnd) + '\n' + currentLineText + value.substring(lineEnd);
      applyTextEdit(newText, start + currentLineText.length + 1);
      return;
    }
  };

  // Input change handler + triggers IntelliSense suggestions
  const handleEditorChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    onUpdateFileContent(activeFile.id, val);
    updateCursorLine();

    // Check for autocomplete snippets in Python
    const pos = e.target.selectionStart;
    const textBefore = val.substring(0, pos);
    const match = textBefore.match(/([a-zA-Z_]{2,})$/);

    if (match && activeFile.name.endsWith('.py')) {
      const word = match[1].toLowerCase();
      const matched = PYTHON_SNIPPETS.filter((s) => s.prefix.startsWith(word));
      if (matched.length > 0) {
        setSuggestions(matched);
        setSelectedSnippetIdx(0);
        return;
      }
    }
    setSuggestions([]);
  };

  if (!activeFile) {
    return (
      <div className="flex-1 bg-[#121316] flex flex-col items-center justify-center p-6 text-center select-none">
        <div className="w-14 h-14 rounded-2xl bg-[#181a20] border border-[#2b2e38] flex items-center justify-center mb-4 text-[#58a6ff] shadow-xl">
          <Code2 className="w-7 h-7" />
        </div>
        <h2 className="text-sm font-semibold text-white tracking-wide mb-1">Agent Dock Code Editor</h2>
        <p className="text-xs text-[#8b909a] max-w-sm mb-4">
          Synced with real disk files at <span className="font-mono text-[#58a6ff]">{baseProjectDir}</span>.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-2 max-w-md">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#181a20] border border-[#232733] text-[11px] text-[#8b909a] font-mono">
            <span className="text-white font-semibold">Ctrl + S</span> Save file
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#181a20] border border-[#232733] text-[11px] text-[#8b909a] font-mono">
            <span className="text-white font-semibold">Ctrl + `</span> Terminal
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#181a20] border border-[#232733] text-[11px] text-[#8b909a] font-mono">
            <span className="text-white font-semibold">() [] {} ""</span> Smart pairs
          </div>
        </div>
        <p className="text-[11px] text-[#484f58] mt-5">
          Select a file from the explorer on the left or click <span className="text-[#3fb950] font-semibold">+</span> to create a file.
        </p>
      </div>
    );
  }

  const isDiffForThisFile = activeDiff && activeDiff.filename.endsWith(activeFile.name);
  const lines = activeFile.content.split('\n');

  return (
    <div className="flex-1 bg-[#121316] flex flex-col h-full overflow-hidden select-text relative">
      {/* Editor Tab Bar */}
      <div className="h-9 bg-[#141518] border-b border-[#23252a] flex items-center justify-between px-2 overflow-x-auto shrink-0 select-none">
        <div className="flex items-center gap-1">
          {files.map((file) => {
            const isActive = file.id === activeFile.id;
            return (
              <div
                key={file.id}
                onClick={() => onSelectFile(file.id)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-t text-xs font-mono cursor-pointer transition-colors border-t-2 ${
                  isActive
                    ? 'bg-[#121316] text-white border-[#58a6ff]'
                    : 'text-[#8b909a] hover:bg-[#1a1c22] border-transparent'
                }`}
              >
                <FileCode className={`w-3.5 h-3.5 ${file.name.endsWith('.py') ? 'text-[#3fb950]' : 'text-[#58a6ff]'}`} />
                <span className="truncate max-w-[140px]">{file.name}</span>
                {file.isModified && (
                  <div className="w-1.5 h-1.5 rounded-full bg-[#e3b341]" title="Unsaved changes" />
                )}
              </div>
            );
          })}
        </div>

        {/* Action buttons on tab bar */}
        <div className="flex items-center gap-1.5">
          {/* Coding helper badge */}
          <div className="hidden lg:flex items-center gap-1 px-2 py-0.5 rounded bg-[#1c222d] text-[#58a6ff] border border-[#388bfd]/30 text-[10px] font-mono">
            <Braces className="w-3 h-3 text-[#58a6ff]" />
            <span>Auto-Pairs () [] {} ""</span>
          </div>

          {/* Save Button */}
          <button
            onClick={handleSave}
            className={`flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-medium transition-colors border ${
              savedFeedback
                ? 'bg-[#16291e] border-[#2ea043]/40 text-[#7ee787]'
                : activeFile.isModified
                ? 'bg-[#1f2838] border-[#388bfd]/50 text-[#58a6ff] hover:bg-[#273347]'
                : 'bg-[#181a1f] border-[#262830] text-[#8b909a] hover:text-[#e3e4e8]'
            }`}
            title="Save file to PC (Ctrl+S)"
          >
            {savedFeedback ? (
              <>
                <Check className="w-3 h-3 text-[#3fb950]" />
                <span>Saved to Agent Dock</span>
              </>
            ) : (
              <>
                <Save className="w-3 h-3" />
                <span>Save</span>
              </>
            )}
          </button>

          {/* Ask Cursor Button */}
          <button
            onClick={() => onAskCursorAboutFile(activeFile)}
            className="flex items-center gap-1 px-2 py-1 rounded bg-[#1e222b] hover:bg-[#282d38] text-[#58a6ff] hover:text-[#79b8ff] text-[11px] font-medium transition-colors border border-[#30363d]"
            title="Ask Cursor about this file (Cmd+L)"
          >
            <Sparkles className="w-3 h-3" />
            <span>Ask Cursor</span>
          </button>

          {/* Copy Button */}
          <button
            onClick={handleCopy}
            className="p-1.5 hover:bg-[#202227] rounded text-[#8b909a] hover:text-[#e3e4e8] transition-colors"
            title="Copy File Content"
          >
            {copied ? <CheckCheck className="w-3.5 h-3.5 text-[#3fb950]" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Breadcrumb Bar (VS Code style) */}
      <div className="h-6 bg-[#16181d] border-b border-[#202228] px-3 flex items-center gap-1.5 text-[11px] font-mono text-[#8b909a] select-none">
        <span className="text-[#e3b341]">Agent Dock</span>
        <span>›</span>
        <span className="text-[#c9d1d9]">{activeFile.name}</span>
        <span className="text-[#484f58] ml-auto">
          {activeFile.name.endsWith('.py') ? 'Python 3 · Auto-Pair Enabled' : 'Text Document'}
        </span>
      </div>

      {/* Diff Floating Banner (When Cursor Apply is active) */}
      {isDiffForThisFile && activeDiff && (
        <div className="bg-[#18231c] border-b border-[#2ea043]/30 px-4 py-2 flex items-center justify-between text-xs animate-in fade-in slide-in-from-top-2 duration-150">
          <div className="flex items-center gap-2 font-mono">
            <GitCommit className="w-3.5 h-3.5 text-[#3fb950]" />
            <span className="text-[#3fb950] font-medium">Cursor Diff Review</span>
            <span className="text-[#8b909a]">·</span>
            <span className="text-[#c9d1d9] truncate max-w-[200px]">{activeDiff.filename}</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onRejectDiff}
              className="flex items-center gap-1 px-2.5 py-1 rounded bg-[#2b1f24] hover:bg-[#38232a] text-[#f85149] text-xs font-medium transition-colors border border-[#da3633]/40"
              title="Reject Diff"
            >
              <X className="w-3 h-3" />
              <span>Reject</span>
            </button>

            <button
              onClick={onAcceptDiff}
              className="flex items-center gap-1 px-3 py-1 rounded bg-[#23422d] hover:bg-[#2c5339] text-[#3fb950] text-xs font-semibold transition-colors border border-[#2ea043]/40 shadow-xs"
              title="Accept Changes (Cmd+Enter)"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Accept (Cmd+Enter)</span>
            </button>
          </div>
        </div>
      )}

      {/* Editor Content Area */}
      <div className="flex-1 relative overflow-hidden flex bg-[#121316]">
        {isDiffForThisFile && activeDiff ? (
          /* Render Unified Diff View */
          <div className="flex-1 overflow-auto p-4 font-mono text-xs leading-relaxed space-y-0.5 select-text">
            {activeDiff.lines.map((dl, idx) => {
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
                <div key={idx} className="flex items-start text-[#8b909a] hover:bg-[#181a1f] px-2 py-0.5">
                  <span className="w-10 shrink-0 text-[#484f58] select-none text-right pr-3">
                    {dl.oldLineNumber || idx + 1}
                  </span>
                  <span className="w-4 shrink-0 select-none text-transparent"> </span>
                  <pre className="whitespace-pre-wrap font-mono text-[#c9d1d9] flex-1 overflow-x-auto">{dl.content}</pre>
                </div>
              );
            })}
          </div>
        ) : (
          /* Live Interactive Code Editor with line gutter & active line highlight */
          <div className="flex-1 flex overflow-hidden relative">
            {/* Line numbers gutter */}
            <div className="w-12 shrink-0 select-none text-right pr-3 pt-3 text-[#484f58] font-mono text-xs leading-6 bg-[#121316] border-r border-[#202228] overflow-hidden">
              {lines.map((_, i) => (
                <div
                  key={i}
                  className={`transition-colors ${
                    i === currentLineIndex ? 'text-[#c9d1d9] font-semibold bg-[#1a1d24] -mr-3 pr-3 rounded-l' : ''
                  }`}
                >
                  {i + 1}
                </div>
              ))}
            </div>

            {/* Editable Code Textarea */}
            <div className="flex-1 relative h-full">
              <textarea
                ref={textareaRef}
                value={activeFile.content}
                onChange={handleEditorChange}
                onKeyDown={handleEditorKeyDown}
                onClick={updateCursorLine}
                onKeyUp={updateCursorLine}
                spellCheck={false}
                className="w-full h-full bg-transparent p-3 font-mono text-xs leading-6 text-[#c9d1d9] outline-none resize-none overflow-auto whitespace-pre selection:bg-[#283c5e] selection:text-white"
              />

              {/* Floating IntelliSense Snippets Menu */}
              {suggestions.length > 0 && (
                <div
                  className="absolute left-16 top-12 z-50 w-72 bg-[#181b22] border border-[#30363d] rounded-lg shadow-2xl py-1 text-xs font-mono overflow-hidden animate-in fade-in duration-100"
                >
                  <div className="px-2.5 py-1 text-[10px] uppercase text-[#6e7480] font-bold tracking-wider border-b border-[#242831] flex items-center justify-between">
                    <span className="flex items-center gap-1">
                      <Zap className="w-3 h-3 text-[#e3b341]" />
                      <span>Code Suggestions</span>
                    </span>
                    <span className="lowercase text-[#8b909a]">Tab / Enter</span>
                  </div>

                  <div className="max-h-48 overflow-y-auto">
                    {suggestions.map((snippet, idx) => (
                      <div
                        key={snippet.prefix}
                        onClick={() => insertSnippet(snippet)}
                        className={`px-3 py-1.5 flex items-center justify-between cursor-pointer transition-colors ${
                          idx === selectedSnippetIdx
                            ? 'bg-[#233147] text-white'
                            : 'text-[#a4a8b2] hover:bg-[#1f232c]'
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate">
                          <span className="px-1 py-0.5 rounded bg-[#2b2d35] text-[#58a6ff] text-[10px] font-bold">
                            {snippet.prefix}
                          </span>
                          <span className="truncate text-[#e3e4e8] font-medium">{snippet.label}</span>
                        </div>
                        <span className="text-[10px] text-[#6e7480] truncate max-w-[90px]">
                          {snippet.description}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Editor Status Bar */}
      <div className="h-6 bg-[#141518] border-t border-[#23252a] px-3 flex items-center justify-between text-[11px] font-mono text-[#6e7480] select-none">
        <div className="flex items-center gap-3">
          <span className="text-[#3fb950] font-semibold">{activeFile.language.toUpperCase()}</span>
          <span>·</span>
          <span>Ln {currentLineIndex + 1}, Col 1</span>
          <span>·</span>
          <span>{lines.length} lines</span>
          {activeFile.isModified && <span className="text-[#e3b341]">● Unsaved changes</span>}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[#8b909a]">Tab: 4 spaces</span>
          <span>·</span>
          <span className="text-[#58a6ff] truncate max-w-xs">{activeFile.path}</span>
        </div>
      </div>
    </div>
  );
};
