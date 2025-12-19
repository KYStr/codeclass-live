import React, { useRef } from 'react';
import Editor, { OnMount, BeforeMount } from '@monaco-editor/react';
import type { editor } from 'monaco-editor';

interface CodeEditorProps {
  code: string;
  onChange: (newCode: string) => void;
  language: string;
  readOnly?: boolean;
  height?: string;
}

// 語言映射（統一命名）
const languageMap: Record<string, string> = {
  python: 'python',
  javascript: 'javascript',
  java: 'java',
  cpp: 'cpp',
  'c++': 'cpp',
};

const CodeEditor: React.FC<CodeEditorProps> = ({ 
  code, 
  onChange, 
  language, 
  readOnly = false,
  height = '100%'
}) => {
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);

  // 編輯器載入前配置
  const handleEditorWillMount: BeforeMount = (monaco) => {
    // 設置主題
    monaco.editor.defineTheme('codeclass-dark', {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: 'comment', foreground: '6A9955', fontStyle: 'italic' },
        { token: 'keyword', foreground: 'C586C0' },
        { token: 'string', foreground: 'CE9178' },
        { token: 'number', foreground: 'B5CEA8' },
        { token: 'function', foreground: 'DCDCAA' },
        { token: 'variable', foreground: '9CDCFE' },
        { token: 'type', foreground: '4EC9B0' },
      ],
      colors: {
        'editor.background': '#1e1e1e',
        'editor.foreground': '#d4d4d4',
        'editor.lineHighlightBackground': '#2d2d2d',
        'editor.selectionBackground': '#264f78',
        'editorCursor.foreground': '#aeafad',
        'editorLineNumber.foreground': '#858585',
        'editorLineNumber.activeForeground': '#c6c6c6',
      }
    });
  };

  // 編輯器載入後配置
  const handleEditorDidMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;

    // 添加快捷鍵
    // Ctrl+/ 註釋
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Slash, () => {
      editor.trigger('keyboard', 'editor.action.commentLine', null);
    });

    // Ctrl+D 複製行
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyD, () => {
      editor.trigger('keyboard', 'editor.action.copyLinesDownAction', null);
    });

    // Ctrl+Shift+K 刪除行
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyK, () => {
      editor.trigger('keyboard', 'editor.action.deleteLines', null);
    });

    // Alt+Up 上移行
    editor.addCommand(monaco.KeyMod.Alt | monaco.KeyCode.UpArrow, () => {
      editor.trigger('keyboard', 'editor.action.moveLinesUpAction', null);
    });

    // Alt+Down 下移行
    editor.addCommand(monaco.KeyMod.Alt | monaco.KeyCode.DownArrow, () => {
      editor.trigger('keyboard', 'editor.action.moveLinesDownAction', null);
    });

    // 聚焦編輯器
    editor.focus();
  };

  // 處理值變化
  const handleChange = (value: string | undefined) => {
    if (value !== undefined && !readOnly) {
      onChange(value);
    }
  };

  return (
    <div className="w-full h-full flex flex-col bg-[#1e1e1e] rounded-lg overflow-hidden border border-gray-700">
      {/* 頂部狀態欄 */}
      <div className="flex items-center justify-between px-4 py-2 bg-[#252526] border-b border-gray-700 select-none shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-red-500"></div>
            <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
            <div className="w-3 h-3 rounded-full bg-green-500"></div>
          </div>
          <span className="text-xs text-gray-400 uppercase tracking-wider font-mono">
            {language}
          </span>
        </div>
        <div className="flex items-center gap-4 text-xs text-gray-500">
          {readOnly && (
            <span className="bg-gray-700 px-2 py-0.5 rounded text-gray-400">只讀</span>
          )}
          <span>行: {code.split('\n').length}</span>
          <span>字符: {code.length}</span>
        </div>
      </div>

      {/* Monaco 編輯器 */}
      <div className="flex-1 overflow-hidden">
        <Editor
          height={height === '100%' ? '100%' : height}
          language={languageMap[language] || language}
          value={code}
          onChange={handleChange}
          beforeMount={handleEditorWillMount}
          onMount={handleEditorDidMount}
          theme="codeclass-dark"
          options={{
            readOnly,
            minimap: { enabled: false },
            fontSize: 14,
            fontFamily: "'JetBrains Mono', 'Fira Code', 'Consolas', 'Courier New', monospace",
            fontLigatures: true,
            lineNumbers: 'on',
            lineHeight: 22,
            tabSize: 4,
            insertSpaces: true,
            wordWrap: 'on',
            automaticLayout: true,
            scrollBeyondLastLine: false,
            padding: { top: 12, bottom: 12 },
            cursorBlinking: 'smooth',
            cursorSmoothCaretAnimation: 'on',
            smoothScrolling: true,
            // 自動補全設置
            quickSuggestions: {
              other: true,
              comments: false,
              strings: true
            },
            suggestOnTriggerCharacters: true,
            acceptSuggestionOnEnter: 'on',
            tabCompletion: 'on',
            wordBasedSuggestions: 'currentDocument',
            // 括號匹配
            bracketPairColorization: { enabled: true },
            matchBrackets: 'always',
            autoClosingBrackets: 'always',
            autoClosingQuotes: 'always',
            autoIndent: 'full',
            formatOnPaste: true,
            formatOnType: true,
            // 代碼摺疊
            folding: true,
            foldingStrategy: 'indentation',
            showFoldingControls: 'mouseover',
            // 其他
            renderWhitespace: 'selection',
            renderLineHighlight: 'all',
            occurrencesHighlight: 'singleFile',
            selectionHighlight: true,
            links: true,
            contextmenu: true,
          }}
          loading={
            <div className="flex items-center justify-center h-full bg-[#1e1e1e]">
              <div className="text-gray-500 flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                載入編輯器...
              </div>
            </div>
          }
        />
      </div>

      {/* 底部快捷鍵提示 */}
      <div className="px-3 py-1.5 bg-[#252526] border-t border-gray-700 text-[10px] text-gray-500 flex items-center gap-4">
        <span><kbd className="bg-gray-700 px-1 rounded">Ctrl</kbd>+<kbd className="bg-gray-700 px-1 rounded">/</kbd> 註釋</span>
        <span><kbd className="bg-gray-700 px-1 rounded">Ctrl</kbd>+<kbd className="bg-gray-700 px-1 rounded">D</kbd> 複製行</span>
        <span><kbd className="bg-gray-700 px-1 rounded">Alt</kbd>+<kbd className="bg-gray-700 px-1 rounded">↑↓</kbd> 移動行</span>
        <span><kbd className="bg-gray-700 px-1 rounded">Ctrl</kbd>+<kbd className="bg-gray-700 px-1 rounded">Space</kbd> 自動補全</span>
      </div>
    </div>
  );
};

export default CodeEditor;
