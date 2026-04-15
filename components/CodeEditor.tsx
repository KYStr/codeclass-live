import React, { useRef } from 'react';
import Editor, { BeforeMount, OnMount } from '@monaco-editor/react';
import type { editor } from 'monaco-editor';

interface CodeEditorProps {
  code: string;
  onChange: (newCode: string) => void;
  language: string;
  readOnly?: boolean;
  height?: string;
  editorTheme?: CodeEditorThemeKey;
}

export type CodeEditorThemeKey =
  | 'codeclass-vscode-dark'
  | 'codeclass-vscode-light'
  | 'codeclass-monokai'
  | 'codeclass-solarized-light'
  | 'codeclass-dracula';

type CompletionKindName =
  | 'Function'
  | 'Keyword'
  | 'Method'
  | 'Module'
  | 'Snippet'
  | 'Struct'
  | 'Variable';

interface CompletionTemplate {
  label: string;
  insertText: string;
  detail: string;
  documentation: string;
  kind?: CompletionKindName;
}

const languageMap: Record<string, string> = {
  python: 'python',
  javascript: 'javascript',
  js: 'javascript',
  java: 'java',
  cpp: 'cpp',
  'c++': 'cpp',
};

const registeredCompletionLanguages = new Set<string>();

const editorThemeDefinitions: Record<CodeEditorThemeKey, editor.IStandaloneThemeData> = {
  'codeclass-vscode-dark': {
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
    },
  },
  'codeclass-vscode-light': {
    base: 'vs',
    inherit: true,
    rules: [
      { token: 'comment', foreground: '008000', fontStyle: 'italic' },
      { token: 'keyword', foreground: '0000ff' },
      { token: 'string', foreground: 'a31515' },
      { token: 'number', foreground: '098658' },
      { token: 'function', foreground: '795e26' },
      { token: 'variable', foreground: '001080' },
      { token: 'type', foreground: '267f99' },
    ],
    colors: {
      'editor.background': '#ffffff',
      'editor.foreground': '#1f2328',
      'editor.lineHighlightBackground': '#f3f6fa',
      'editor.selectionBackground': '#add6ff',
      'editorCursor.foreground': '#24292f',
      'editorLineNumber.foreground': '#6e7781',
      'editorLineNumber.activeForeground': '#24292f',
    },
  },
  'codeclass-monokai': {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: 'comment', foreground: '75715e', fontStyle: 'italic' },
      { token: 'keyword', foreground: 'f92672' },
      { token: 'string', foreground: 'e6db74' },
      { token: 'number', foreground: 'ae81ff' },
      { token: 'function', foreground: 'a6e22e' },
      { token: 'variable', foreground: 'f8f8f2' },
      { token: 'type', foreground: '66d9ef' },
    ],
    colors: {
      'editor.background': '#272822',
      'editor.foreground': '#f8f8f2',
      'editor.lineHighlightBackground': '#3e3d32',
      'editor.selectionBackground': '#49483e',
      'editorCursor.foreground': '#f8f8f0',
      'editorLineNumber.foreground': '#90908a',
      'editorLineNumber.activeForeground': '#f8f8f2',
    },
  },
  'codeclass-solarized-light': {
    base: 'vs',
    inherit: true,
    rules: [
      { token: 'comment', foreground: '93a1a1', fontStyle: 'italic' },
      { token: 'keyword', foreground: '859900' },
      { token: 'string', foreground: '2aa198' },
      { token: 'number', foreground: 'd33682' },
      { token: 'function', foreground: '268bd2' },
      { token: 'variable', foreground: '657b83' },
      { token: 'type', foreground: 'b58900' },
    ],
    colors: {
      'editor.background': '#fdf6e3',
      'editor.foreground': '#657b83',
      'editor.lineHighlightBackground': '#eee8d5',
      'editor.selectionBackground': '#d3e8e5',
      'editorCursor.foreground': '#586e75',
      'editorLineNumber.foreground': '#93a1a1',
      'editorLineNumber.activeForeground': '#586e75',
    },
  },
  'codeclass-dracula': {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: 'comment', foreground: '6272a4', fontStyle: 'italic' },
      { token: 'keyword', foreground: 'ff79c6' },
      { token: 'string', foreground: 'f1fa8c' },
      { token: 'number', foreground: 'bd93f9' },
      { token: 'function', foreground: '50fa7b' },
      { token: 'variable', foreground: 'f8f8f2' },
      { token: 'type', foreground: '8be9fd' },
    ],
    colors: {
      'editor.background': '#282a36',
      'editor.foreground': '#f8f8f2',
      'editor.lineHighlightBackground': '#44475a',
      'editor.selectionBackground': '#44475a',
      'editorCursor.foreground': '#f8f8f2',
      'editorLineNumber.foreground': '#6272a4',
      'editorLineNumber.activeForeground': '#f8f8f2',
    },
  },
};

const editorChromeThemes: Record<CodeEditorThemeKey, {
  border: string;
  chrome: string;
  chromeAlt: string;
  text: string;
  muted: string;
  kbd: string;
}> = {
  'codeclass-vscode-dark': {
    border: '#3e3e42',
    chrome: '#252526',
    chromeAlt: '#1e1e1e',
    text: '#d4d4d4',
    muted: '#9ca3af',
    kbd: '#3a3d41',
  },
  'codeclass-vscode-light': {
    border: '#d0d7de',
    chrome: '#f6f8fa',
    chromeAlt: '#ffffff',
    text: '#24292f',
    muted: '#57606a',
    kbd: '#eaeef2',
  },
  'codeclass-monokai': {
    border: '#49483e',
    chrome: '#1f201b',
    chromeAlt: '#272822',
    text: '#f8f8f2',
    muted: '#a6a69b',
    kbd: '#3e3d32',
  },
  'codeclass-solarized-light': {
    border: '#d6cfb7',
    chrome: '#eee8d5',
    chromeAlt: '#fdf6e3',
    text: '#586e75',
    muted: '#839496',
    kbd: '#e1dac4',
  },
  'codeclass-dracula': {
    border: '#44475a',
    chrome: '#21222c',
    chromeAlt: '#282a36',
    text: '#f8f8f2',
    muted: '#b9b9c8',
    kbd: '#44475a',
  },
};

const completionTemplates: Record<string, CompletionTemplate[]> = {
  python: [
    { label: 'print', insertText: 'print(${1:value})', detail: 'Python built-in', documentation: 'Output a value.', kind: 'Function' },
    { label: 'input', insertText: 'input(${1:prompt})', detail: 'Python built-in', documentation: 'Read one line from standard input.', kind: 'Function' },
    { label: 'range', insertText: 'range(${1:start}, ${2:end})', detail: 'Python built-in', documentation: 'Create an integer sequence.', kind: 'Function' },
    { label: 'len', insertText: 'len(${1:value})', detail: 'Python built-in', documentation: 'Get the length of a sequence.', kind: 'Function' },
    { label: 'int', insertText: 'int(${1:value})', detail: 'Python built-in', documentation: 'Convert a value to an integer.', kind: 'Function' },
    { label: 'str', insertText: 'str(${1:value})', detail: 'Python built-in', documentation: 'Convert a value to a string.', kind: 'Function' },
    { label: 'float', insertText: 'float(${1:value})', detail: 'Python built-in', documentation: 'Convert a value to a float.', kind: 'Function' },
    { label: 'list', insertText: 'list(${1:items})', detail: 'Python built-in', documentation: 'Create a list.', kind: 'Function' },
    { label: 'dict', insertText: 'dict(${1:items})', detail: 'Python built-in', documentation: 'Create a dictionary.', kind: 'Function' },
    { label: 'set', insertText: 'set(${1:items})', detail: 'Python built-in', documentation: 'Create a set.', kind: 'Function' },
    { label: 'sum', insertText: 'sum(${1:items})', detail: 'Python built-in', documentation: 'Add all values in an iterable.', kind: 'Function' },
    { label: 'max', insertText: 'max(${1:items})', detail: 'Python built-in', documentation: 'Find the largest value.', kind: 'Function' },
    { label: 'min', insertText: 'min(${1:items})', detail: 'Python built-in', documentation: 'Find the smallest value.', kind: 'Function' },
    { label: 'sorted', insertText: 'sorted(${1:items})', detail: 'Python built-in', documentation: 'Return a sorted list.', kind: 'Function' },
    { label: 'enumerate', insertText: 'enumerate(${1:items})', detail: 'Python built-in', documentation: 'Loop with index and value.', kind: 'Function' },
    { label: 'map', insertText: 'map(${1:function}, ${2:items})', detail: 'Python built-in', documentation: 'Apply a function to each item.', kind: 'Function' },
    { label: 'split', insertText: 'split(${1:separator})', detail: 'Python string method', documentation: 'Split a string into a list.', kind: 'Method' },
    { label: 'append', insertText: 'append(${1:value})', detail: 'Python list method', documentation: 'Add an item to the end of a list.', kind: 'Method' },
    { label: 'math import', insertText: 'import math', detail: 'Python module', documentation: 'Use math.sqrt, math.floor, math.ceil, and more.', kind: 'Module' },
    { label: 'math.sqrt', insertText: 'math.sqrt(${1:x})', detail: 'Python math', documentation: 'Square root.', kind: 'Function' },
    { label: 'math.floor', insertText: 'math.floor(${1:x})', detail: 'Python math', documentation: 'Round down.', kind: 'Function' },
    { label: 'math.ceil', insertText: 'math.ceil(${1:x})', detail: 'Python math', documentation: 'Round up.', kind: 'Function' },
    { label: 'collections import', insertText: 'from collections import deque, Counter, defaultdict', detail: 'Python module', documentation: 'Common data structures for queues and counting.', kind: 'Module' },
    { label: 'deque', insertText: 'deque(${1:items})', detail: 'Python collections', documentation: 'Double-ended queue.', kind: 'Struct' },
    { label: 'Counter', insertText: 'Counter(${1:items})', detail: 'Python collections', documentation: 'Count occurrences.', kind: 'Struct' },
    { label: 'defaultdict', insertText: 'defaultdict(${1:int})', detail: 'Python collections', documentation: 'Dictionary with default values.', kind: 'Struct' },
    { label: 'heapq import', insertText: 'import heapq', detail: 'Python module', documentation: 'Priority queue helpers.', kind: 'Module' },
    { label: 'heapq.heappush', insertText: 'heapq.heappush(${1:heap}, ${2:value})', detail: 'Python heapq', documentation: 'Push a value into a heap.', kind: 'Function' },
    { label: 'heapq.heappop', insertText: 'heapq.heappop(${1:heap})', detail: 'Python heapq', documentation: 'Pop the smallest heap value.', kind: 'Function' },
    { label: 'readline', insertText: 'import sys\ninput = sys.stdin.readline', detail: 'Python fast input', documentation: 'Use faster line input.', kind: 'Snippet' },
    { label: 'for loop', insertText: 'for ${1:i} in range(${2:n}):\n    ${3:pass}', detail: 'Python snippet', documentation: 'Loop over a range.', kind: 'Snippet' },
    { label: 'if statement', insertText: 'if ${1:condition}:\n    ${2:pass}', detail: 'Python snippet', documentation: 'Conditional branch.', kind: 'Snippet' },
    { label: 'function', insertText: 'def ${1:name}(${2:args}):\n    ${3:pass}', detail: 'Python snippet', documentation: 'Define a function.', kind: 'Snippet' },
  ],
  javascript: [
    { label: 'console.log', insertText: 'console.log(${1:value});', detail: 'JavaScript console', documentation: 'Output a value.', kind: 'Function' },
    { label: 'Number', insertText: 'Number(${1:value})', detail: 'JavaScript global', documentation: 'Convert a value to a number.', kind: 'Function' },
    { label: 'parseInt', insertText: 'parseInt(${1:value}, ${2:10})', detail: 'JavaScript global', documentation: 'Parse an integer.', kind: 'Function' },
    { label: 'Math.max', insertText: 'Math.max(${1:a}, ${2:b})', detail: 'JavaScript Math', documentation: 'Find the larger value.', kind: 'Function' },
    { label: 'Math.min', insertText: 'Math.min(${1:a}, ${2:b})', detail: 'JavaScript Math', documentation: 'Find the smaller value.', kind: 'Function' },
    { label: 'Math.floor', insertText: 'Math.floor(${1:value})', detail: 'JavaScript Math', documentation: 'Round down.', kind: 'Function' },
    { label: 'Math.ceil', insertText: 'Math.ceil(${1:value})', detail: 'JavaScript Math', documentation: 'Round up.', kind: 'Function' },
    { label: 'Math.sqrt', insertText: 'Math.sqrt(${1:value})', detail: 'JavaScript Math', documentation: 'Square root.', kind: 'Function' },
    { label: 'Math.pow', insertText: 'Math.pow(${1:base}, ${2:exp})', detail: 'JavaScript Math', documentation: 'Power.', kind: 'Function' },
    { label: 'Array.from', insertText: 'Array.from(${1:items})', detail: 'JavaScript Array', documentation: 'Create an array from iterable data.', kind: 'Function' },
    { label: 'push', insertText: 'push(${1:value})', detail: 'JavaScript array method', documentation: 'Add an item to an array.', kind: 'Method' },
    { label: 'map', insertText: 'map((${1:item}) => ${2:item})', detail: 'JavaScript array method', documentation: 'Transform each item.', kind: 'Method' },
    { label: 'filter', insertText: 'filter((${1:item}) => ${2:condition})', detail: 'JavaScript array method', documentation: 'Keep items that match a condition.', kind: 'Method' },
    { label: 'reduce', insertText: 'reduce((${1:acc}, ${2:item}) => ${3:acc + item}, ${4:0})', detail: 'JavaScript array method', documentation: 'Combine items into one value.', kind: 'Method' },
    { label: 'sort', insertText: 'sort((${1:a}, ${2:b}) => ${1:a} - ${2:b})', detail: 'JavaScript array method', documentation: 'Sort numbers ascending.', kind: 'Method' },
    { label: 'includes', insertText: 'includes(${1:value})', detail: 'JavaScript method', documentation: 'Check whether a value exists.', kind: 'Method' },
    { label: 'split', insertText: 'split(${1:separator})', detail: 'JavaScript string method', documentation: 'Split a string into an array.', kind: 'Method' },
    { label: 'trim', insertText: 'trim()', detail: 'JavaScript string method', documentation: 'Remove whitespace at both ends.', kind: 'Method' },
    { label: 'Set', insertText: 'new Set(${1:items})', detail: 'JavaScript Set', documentation: 'Store unique values.', kind: 'Struct' },
    { label: 'Map', insertText: 'new Map(${1:entries})', detail: 'JavaScript Map', documentation: 'Store key-value pairs.', kind: 'Struct' },
    { label: 'for loop', insertText: 'for (let ${1:i} = 0; ${1:i} < ${2:n}; ${1:i}++) {\n  ${3:// code}\n}', detail: 'JavaScript snippet', documentation: 'Counted loop.', kind: 'Snippet' },
    { label: 'for of', insertText: 'for (const ${1:item} of ${2:items}) {\n  ${3:// code}\n}', detail: 'JavaScript snippet', documentation: 'Loop over iterable data.', kind: 'Snippet' },
    { label: 'if statement', insertText: 'if (${1:condition}) {\n  ${2:// code}\n}', detail: 'JavaScript snippet', documentation: 'Conditional branch.', kind: 'Snippet' },
    { label: 'function', insertText: 'function ${1:name}(${2:args}) {\n  ${3:// code}\n}', detail: 'JavaScript snippet', documentation: 'Define a function.', kind: 'Snippet' },
    { label: 'arrow function', insertText: 'const ${1:name} = (${2:args}) => {\n  ${3:// code}\n};', detail: 'JavaScript snippet', documentation: 'Define an arrow function.', kind: 'Snippet' },
  ],
  java: [
    { label: 'public class Main', insertText: 'public class Main {\n    public static void main(String[] args) {\n        ${1:// code}\n    }\n}', detail: 'Java template', documentation: 'Main class template.', kind: 'Snippet' },
    { label: 'java.util import', insertText: 'import java.util.*;', detail: 'Java library', documentation: 'Import Scanner, ArrayList, HashMap, Arrays, and more.', kind: 'Module' },
    { label: 'Scanner', insertText: 'Scanner ${1:sc} = new Scanner(System.in);', detail: 'Java input', documentation: 'Read input from standard input.', kind: 'Struct' },
    { label: 'BufferedReader', insertText: 'BufferedReader ${1:br} = new BufferedReader(new InputStreamReader(System.in));', detail: 'Java fast input', documentation: 'Read input faster. Requires java.io.*.', kind: 'Struct' },
    { label: 'StringTokenizer', insertText: 'StringTokenizer ${1:st} = new StringTokenizer(${2:line});', detail: 'Java input helper', documentation: 'Split an input line into tokens.', kind: 'Struct' },
    { label: 'System.out.println', insertText: 'System.out.println(${1:value});', detail: 'Java output', documentation: 'Output a line.', kind: 'Function' },
    { label: 'Integer.parseInt', insertText: 'Integer.parseInt(${1:value})', detail: 'Java parse', documentation: 'Convert a string to int.', kind: 'Function' },
    { label: 'Long.parseLong', insertText: 'Long.parseLong(${1:value})', detail: 'Java parse', documentation: 'Convert a string to long.', kind: 'Function' },
    { label: 'Math.max', insertText: 'Math.max(${1:a}, ${2:b})', detail: 'Java Math', documentation: 'Find the larger value.', kind: 'Function' },
    { label: 'Math.min', insertText: 'Math.min(${1:a}, ${2:b})', detail: 'Java Math', documentation: 'Find the smaller value.', kind: 'Function' },
    { label: 'Math.sqrt', insertText: 'Math.sqrt(${1:value})', detail: 'Java Math', documentation: 'Square root.', kind: 'Function' },
    { label: 'Math.pow', insertText: 'Math.pow(${1:base}, ${2:exp})', detail: 'Java Math', documentation: 'Power.', kind: 'Function' },
    { label: 'ArrayList', insertText: 'ArrayList<${1:Integer}> ${2:list} = new ArrayList<>();', detail: 'Java collection', documentation: 'Dynamic list.', kind: 'Struct' },
    { label: 'HashMap', insertText: 'HashMap<${1:String}, ${2:Integer}> ${3:map} = new HashMap<>();', detail: 'Java collection', documentation: 'Key-value map.', kind: 'Struct' },
    { label: 'HashSet', insertText: 'HashSet<${1:Integer}> ${2:set} = new HashSet<>();', detail: 'Java collection', documentation: 'Unique values.', kind: 'Struct' },
    { label: 'PriorityQueue', insertText: 'PriorityQueue<${1:Integer}> ${2:pq} = new PriorityQueue<>();', detail: 'Java collection', documentation: 'Min priority queue.', kind: 'Struct' },
    { label: 'Arrays.sort', insertText: 'Arrays.sort(${1:array});', detail: 'Java Arrays', documentation: 'Sort an array.', kind: 'Function' },
    { label: 'Collections.sort', insertText: 'Collections.sort(${1:list});', detail: 'Java Collections', documentation: 'Sort a list.', kind: 'Function' },
    { label: 'for loop', insertText: 'for (int ${1:i} = 0; ${1:i} < ${2:n}; ${1:i}++) {\n    ${3:// code}\n}', detail: 'Java snippet', documentation: 'Counted loop.', kind: 'Snippet' },
    { label: 'for each', insertText: 'for (${1:int} ${2:item} : ${3:items}) {\n    ${4:// code}\n}', detail: 'Java snippet', documentation: 'Loop over an array or collection.', kind: 'Snippet' },
    { label: 'if statement', insertText: 'if (${1:condition}) {\n    ${2:// code}\n}', detail: 'Java snippet', documentation: 'Conditional branch.', kind: 'Snippet' },
  ],
  cpp: [
    { label: '#include bits', insertText: '#include <bits/stdc++.h>\nusing namespace std;\n\nint main() {\n    ${1:// code}\n    return 0;\n}', detail: 'C++ template', documentation: 'Common competitive programming template.', kind: 'Snippet' },
    { label: '#include iostream', insertText: '#include <iostream>', detail: 'C++ library', documentation: 'Use cin and cout.', kind: 'Module' },
    { label: '#include vector', insertText: '#include <vector>', detail: 'C++ library', documentation: 'Use vector.', kind: 'Module' },
    { label: '#include algorithm', insertText: '#include <algorithm>', detail: 'C++ library', documentation: 'Use sort, reverse, max, min.', kind: 'Module' },
    { label: '#include queue', insertText: '#include <queue>', detail: 'C++ library', documentation: 'Use queue and priority_queue.', kind: 'Module' },
    { label: '#include map', insertText: '#include <map>', detail: 'C++ library', documentation: 'Use map.', kind: 'Module' },
    { label: '#include unordered_map', insertText: '#include <unordered_map>', detail: 'C++ library', documentation: 'Use hash map.', kind: 'Module' },
    { label: 'using namespace std', insertText: 'using namespace std;', detail: 'C++ namespace', documentation: 'Avoid prefixing std:: repeatedly.', kind: 'Keyword' },
    { label: 'cout', insertText: 'cout << ${1:value} << endl;', detail: 'C++ output', documentation: 'Output a value and newline.', kind: 'Function' },
    { label: 'cin', insertText: 'cin >> ${1:value};', detail: 'C++ input', documentation: 'Read a value from standard input.', kind: 'Function' },
    { label: 'vector', insertText: 'vector<${1:int}> ${2:items};', detail: 'C++ container', documentation: 'Dynamic array.', kind: 'Struct' },
    { label: 'string', insertText: 'string ${1:s};', detail: 'C++ type', documentation: 'String value.', kind: 'Struct' },
    { label: 'pair', insertText: 'pair<${1:int}, ${2:int}> ${3:p};', detail: 'C++ utility', documentation: 'Store two values together.', kind: 'Struct' },
    { label: 'queue', insertText: 'queue<${1:int}> ${2:q};', detail: 'C++ container', documentation: 'First-in, first-out queue.', kind: 'Struct' },
    { label: 'stack', insertText: 'stack<${1:int}> ${2:st};', detail: 'C++ container', documentation: 'Last-in, first-out stack.', kind: 'Struct' },
    { label: 'priority_queue', insertText: 'priority_queue<${1:int}> ${2:pq};', detail: 'C++ container', documentation: 'Max priority queue.', kind: 'Struct' },
    { label: 'map', insertText: 'map<${1:string}, ${2:int}> ${3:mp};', detail: 'C++ container', documentation: 'Ordered key-value map.', kind: 'Struct' },
    { label: 'unordered_map', insertText: 'unordered_map<${1:string}, ${2:int}> ${3:mp};', detail: 'C++ container', documentation: 'Hash key-value map.', kind: 'Struct' },
    { label: 'set', insertText: 'set<${1:int}> ${2:items};', detail: 'C++ container', documentation: 'Ordered unique values.', kind: 'Struct' },
    { label: 'sort', insertText: 'sort(${1:items}.begin(), ${1:items}.end());', detail: 'C++ algorithm', documentation: 'Sort a container.', kind: 'Function' },
    { label: 'reverse', insertText: 'reverse(${1:items}.begin(), ${1:items}.end());', detail: 'C++ algorithm', documentation: 'Reverse a container.', kind: 'Function' },
    { label: 'max', insertText: 'max(${1:a}, ${2:b})', detail: 'C++ algorithm', documentation: 'Find the larger value.', kind: 'Function' },
    { label: 'min', insertText: 'min(${1:a}, ${2:b})', detail: 'C++ algorithm', documentation: 'Find the smaller value.', kind: 'Function' },
    { label: 'for loop', insertText: 'for (int ${1:i} = 0; ${1:i} < ${2:n}; ${1:i}++) {\n    ${3:// code}\n}', detail: 'C++ snippet', documentation: 'Counted loop.', kind: 'Snippet' },
    { label: 'for each', insertText: 'for (auto ${1:item} : ${2:items}) {\n    ${3:// code}\n}', detail: 'C++ snippet', documentation: 'Loop over a container.', kind: 'Snippet' },
    { label: 'if statement', insertText: 'if (${1:condition}) {\n    ${2:// code}\n}', detail: 'C++ snippet', documentation: 'Conditional branch.', kind: 'Snippet' },
  ],
};

function normalizeLanguage(language: string) {
  return languageMap[language.toLowerCase()] || language.toLowerCase();
}

function registerCompletionProvider(monaco: Parameters<BeforeMount>[0], monacoLanguage: string) {
  if (registeredCompletionLanguages.has(monacoLanguage)) return;

  const templates = completionTemplates[monacoLanguage];
  if (!templates) return;

  registeredCompletionLanguages.add(monacoLanguage);
  monaco.languages.registerCompletionItemProvider(monacoLanguage, {
    triggerCharacters: ['.', '#', '<'],
    provideCompletionItems: (model, position) => {
      const word = model.getWordUntilPosition(position);
      const range = {
        startLineNumber: position.lineNumber,
        endLineNumber: position.lineNumber,
        startColumn: word.startColumn,
        endColumn: word.endColumn,
      };

      const suggestions = templates.map((item) => ({
        label: item.label,
        kind: monaco.languages.CompletionItemKind[item.kind || 'Function'],
        insertText: item.insertText,
        insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
        detail: item.detail,
        documentation: item.documentation,
        range,
      }));

      return { suggestions };
    },
  });
}

const CodeEditor: React.FC<CodeEditorProps> = ({
  code,
  onChange,
  language,
  readOnly = false,
  height = '100%',
  editorTheme = 'codeclass-vscode-dark',
}) => {
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const monacoLanguage = normalizeLanguage(language);
  const chromeTheme = editorChromeThemes[editorTheme] || editorChromeThemes['codeclass-vscode-dark'];

  const handleEditorWillMount: BeforeMount = (monaco) => {
    Object.entries(editorThemeDefinitions).forEach(([themeName, themeData]) => {
      monaco.editor.defineTheme(themeName, themeData);
    });

    Object.keys(completionTemplates).forEach((registeredLanguage) => {
      registerCompletionProvider(monaco, registeredLanguage);
    });
  };

  const handleEditorDidMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;

    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Slash, () => {
      editor.trigger('keyboard', 'editor.action.commentLine', null);
    });

    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyD, () => {
      editor.trigger('keyboard', 'editor.action.copyLinesDownAction', null);
    });

    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyK, () => {
      editor.trigger('keyboard', 'editor.action.deleteLines', null);
    });

    editor.addCommand(monaco.KeyMod.Alt | monaco.KeyCode.UpArrow, () => {
      editor.trigger('keyboard', 'editor.action.moveLinesUpAction', null);
    });

    editor.addCommand(monaco.KeyMod.Alt | monaco.KeyCode.DownArrow, () => {
      editor.trigger('keyboard', 'editor.action.moveLinesDownAction', null);
    });

    editor.focus();
  };

  const handleChange = (value: string | undefined) => {
    if (value !== undefined && !readOnly) {
      onChange(value);
    }
  };

  return (
    <div
      className="min-w-0 max-w-full w-full h-full flex flex-col rounded-lg overflow-hidden border"
      style={{ backgroundColor: chromeTheme.chromeAlt, borderColor: chromeTheme.border, color: chromeTheme.text }}
    >
      <div
        className="min-w-0 flex items-center justify-between gap-2 px-3 sm:px-4 py-2 border-b select-none shrink-0 overflow-hidden"
        style={{ backgroundColor: chromeTheme.chrome, borderColor: chromeTheme.border }}
      >
        <div className="min-w-0 flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-red-500" />
            <div className="w-3 h-3 rounded-full bg-yellow-500" />
            <div className="w-3 h-3 rounded-full bg-green-500" />
          </div>
          <span className="text-xs text-gray-400 uppercase tracking-wider font-mono">
            {language}
          </span>
        </div>
        <div className="min-w-0 flex items-center justify-end gap-2 sm:gap-4 text-xs overflow-hidden" style={{ color: chromeTheme.muted }}>
          {readOnly && (
            <span className="px-2 py-0.5 rounded" style={{ backgroundColor: chromeTheme.kbd, color: chromeTheme.muted }}>唯讀</span>
          )}
          <span className="whitespace-nowrap">行 {code.split('\n').length}</span>
          <span className="whitespace-nowrap">字元 {code.length}</span>
        </div>
      </div>

      <div className="min-w-0 flex-1 overflow-hidden">
        <Editor
          height={height === '100%' ? '100%' : height}
          language={monacoLanguage}
          value={code}
          onChange={handleChange}
          beforeMount={handleEditorWillMount}
          onMount={handleEditorDidMount}
          theme={editorTheme}
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
            quickSuggestions: {
              other: true,
              comments: false,
              strings: true,
            },
            suggestOnTriggerCharacters: true,
            acceptSuggestionOnEnter: 'on',
            tabCompletion: 'on',
            wordBasedSuggestions: 'matchingDocuments',
            bracketPairColorization: { enabled: true },
            matchBrackets: 'always',
            autoClosingBrackets: 'always',
            autoClosingQuotes: 'always',
            autoIndent: 'full',
            formatOnPaste: true,
            formatOnType: true,
            folding: true,
            foldingStrategy: 'indentation',
            showFoldingControls: 'mouseover',
            renderWhitespace: 'selection',
            renderLineHighlight: 'all',
            occurrencesHighlight: 'singleFile',
            selectionHighlight: true,
            links: true,
            contextmenu: true,
          }}
          loading={
            <div className="flex items-center justify-center h-full" style={{ backgroundColor: chromeTheme.chromeAlt }}>
              <div className="flex items-center gap-2" style={{ color: chromeTheme.muted }}>
                <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                正在載入編輯器...
              </div>
            </div>
          }
        />
      </div>

      <div
        className="min-w-0 max-w-full overflow-hidden px-3 py-1.5 border-t text-[10px] flex flex-wrap items-center gap-x-3 gap-y-1"
        style={{ backgroundColor: chromeTheme.chrome, borderColor: chromeTheme.border, color: chromeTheme.muted }}
      >
        <span><kbd className="px-1 rounded" style={{ backgroundColor: chromeTheme.kbd }}>Ctrl</kbd>+<kbd className="px-1 rounded" style={{ backgroundColor: chromeTheme.kbd }}>/</kbd> 註解</span>
        <span><kbd className="px-1 rounded" style={{ backgroundColor: chromeTheme.kbd }}>Ctrl</kbd>+<kbd className="px-1 rounded" style={{ backgroundColor: chromeTheme.kbd }}>D</kbd> 複製行</span>
        <span><kbd className="px-1 rounded" style={{ backgroundColor: chromeTheme.kbd }}>Alt</kbd>+<kbd className="px-1 rounded" style={{ backgroundColor: chromeTheme.kbd }}>↑/↓</kbd> 移動行</span>
        <span><kbd className="px-1 rounded" style={{ backgroundColor: chromeTheme.kbd }}>Ctrl</kbd>+<kbd className="px-1 rounded" style={{ backgroundColor: chromeTheme.kbd }}>Space</kbd> 自動補全</span>
      </div>
    </div>
  );
};

export default CodeEditor;
