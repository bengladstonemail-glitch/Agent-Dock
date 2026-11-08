import { DiffLine, DiffBlock } from '../types/chat';

/**
 * Creates unified diff lines between original and modified text
 */
export function createUnifiedDiff(filename: string, original: string, updated: string): DiffBlock {
  const origLines = original.split('\n');
  const newLines = updated.split('\n');
  const lines: DiffLine[] = [];

  // Simple Myers-like line-by-line diff approximation for clear visual presentation
  let i = 0;
  let j = 0;
  let oldLineNum = 1;
  let newLineNum = 1;

  while (i < origLines.length || j < newLines.length) {
    if (i < origLines.length && j < newLines.length && origLines[i] === newLines[j]) {
      lines.push({
        type: 'context',
        content: origLines[i],
        oldLineNumber: oldLineNum++,
        newLineNumber: newLineNum++,
      });
      i++;
      j++;
    } else {
      // Check if line was deleted or replaced
      const nextMatchInNew = newLines.indexOf(origLines[i], j);
      const nextMatchInOrig = origLines.indexOf(newLines[j], i);

      if (i < origLines.length && (nextMatchInNew === -1 || nextMatchInOrig !== -1)) {
        lines.push({
          type: 'delete',
          content: origLines[i],
          oldLineNumber: oldLineNum++,
        });
        i++;
      } else if (j < newLines.length) {
        lines.push({
          type: 'add',
          content: newLines[j],
          newLineNumber: newLineNum++,
        });
        j++;
      }
    }
  }

  return {
    filename,
    lines,
    originalContent: original,
    newContent: updated,
    status: 'pending',
  };
}

/**
 * Extracts code blocks from markdown text with their language and optional filename
 */
export function extractCodeBlocks(markdown: string): Array<{
  language: string;
  filename?: string;
  code: string;
  raw: string;
}> {
  const codeBlockRegex = /```([a-zA-Z0-9_\-\.]+)(?::([^\n]+))?\n([\s\S]*?)```/g;
  const blocks: Array<{ language: string; filename?: string; code: string; raw: string }> = [];

  let match;
  while ((match = codeBlockRegex.exec(markdown)) !== null) {
    const raw = match[0];
    const language = match[1] || 'text';
    const filename = match[2]?.trim() || undefined;
    const code = match[3];

    blocks.push({ language, filename, code, raw });
  }

  return blocks;
}

/**
 * Parses <think>...</think> blocks from markdown
 */
export function extractThinkingTrace(text: string): {
  thinking: string;
  content: string;
  isStillThinking: boolean;
} {
  const thinkStart = text.indexOf('<think>');
  if (thinkStart === -1) {
    return { thinking: '', content: text, isStillThinking: false };
  }

  const thinkEnd = text.indexOf('</think>');
  if (thinkEnd === -1) {
    return {
      thinking: text.slice(thinkStart + 7).trim(),
      content: '',
      isStillThinking: true,
    };
  }

  return {
    thinking: text.slice(thinkStart + 7, thinkEnd).trim(),
    content: (text.slice(0, thinkStart) + text.slice(thinkEnd + 8)).trim(),
    isStillThinking: false,
  };
}
