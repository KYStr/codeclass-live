import { spawn } from 'child_process';
import { writeFileSync, unlinkSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { v4 as uuidv4 } from 'uuid';

// 臨時文件目錄
const TEMP_DIR = join(process.cwd(), 'temp');

// 確保臨時目錄存在
if (!existsSync(TEMP_DIR)) {
  mkdirSync(TEMP_DIR, { recursive: true });
}

// 執行超時（毫秒）
const EXECUTION_TIMEOUT = 10000;

// 最大輸出長度
const MAX_OUTPUT_LENGTH = 10000;

/**
 * 執行代碼並返回結果
 * @param {string} code - 要執行的代碼
 * @param {string} language - 程式語言
 * @param {string} stdin - 標準輸入（用於 input() 等）
 */
export async function executeCode(code, language, stdin = '') {
  const startTime = Date.now();
  
  try {
    switch (language.toLowerCase()) {
      case 'python':
        return await executePython(code, startTime, stdin);
      case 'javascript':
        return await executeJavaScript(code, startTime, stdin);
      default:
        return {
          output: '',
          error: `不支持的語言: ${language}。目前支持 Python 和 JavaScript。`,
          executionTime: Date.now() - startTime
        };
    }
  } catch (error) {
    return {
      output: '',
      error: error.message || '執行過程中發生錯誤',
      executionTime: Date.now() - startTime
    };
  }
}

/**
 * 執行 Python 代碼
 */
async function executePython(code, startTime, stdin = '') {
  const filename = `${uuidv4()}.py`;
  const filepath = join(TEMP_DIR, filename);
  
  try {
    // 寫入臨時文件
    writeFileSync(filepath, code, 'utf8');
    
    return await new Promise((resolve) => {
      let output = '';
      let error = '';
      let killed = false;
      
      // 嘗試使用 python3 或 python
      const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';
      
      const proc = spawn(pythonCmd, ['-u', filepath], {
        cwd: TEMP_DIR,
        env: { ...process.env, PYTHONIOENCODING: 'utf-8' }
      });
      
      // 設置超時
      const timeout = setTimeout(() => {
        killed = true;
        proc.kill('SIGKILL');
      }, EXECUTION_TIMEOUT);
      
      // 發送標準輸入
      if (stdin) {
        proc.stdin.write(stdin);
        proc.stdin.end();
      } else {
        // 如果沒有提供輸入，立即關閉 stdin
        proc.stdin.end();
      }
      
      proc.stdout.on('data', (data) => {
        output += data.toString();
        if (output.length > MAX_OUTPUT_LENGTH) {
          output = output.substring(0, MAX_OUTPUT_LENGTH) + '\n... (輸出已截斷)';
          killed = true;
          proc.kill('SIGKILL');
        }
      });
      
      proc.stderr.on('data', (data) => {
        error += data.toString();
      });
      
      proc.on('close', (exitCode, signal) => {
        clearTimeout(timeout);
        
        // 清理臨時文件
        try { unlinkSync(filepath); } catch {}
        
        if (killed && signal === 'SIGKILL') {
          // 檢查是否是因為等待輸入而超時
          if (code.includes('input(') && !stdin) {
            resolve({
              output: output.trim(),
              error: '程式需要輸入。請在下方「程式輸入」欄位中提供輸入值後再執行。',
              executionTime: Date.now() - startTime,
              needsInput: true
            });
          } else {
            resolve({
              output: output.trim(),
              error: '執行超時或輸出過長',
              executionTime: Date.now() - startTime
            });
          }
        } else {
          // 檢查是否是 EOFError（用戶使用了 input() 但沒有提供輸入）
          const errorStr = error.trim();
          if (errorStr.includes('EOFError') && code.includes('input(')) {
            resolve({
              output: output.trim(),
              error: '⚠️ 您的程式使用了 input()，但沒有提供輸入值。\n\n請點擊「程式輸入」按鈕，在輸入框中填寫輸入值（每行一個），然後重新執行。',
              executionTime: Date.now() - startTime,
              needsInput: true
            });
          } else {
            resolve({
              output: output.trim(),
              error: errorStr || (exitCode !== 0 ? `退出代碼: ${exitCode}` : ''),
              executionTime: Date.now() - startTime
            });
          }
        }
      });
      
      proc.on('error', (err) => {
        clearTimeout(timeout);
        try { unlinkSync(filepath); } catch {}
        
        resolve({
          output: '',
          error: `無法執行 Python: ${err.message}。請確保已安裝 Python。`,
          executionTime: Date.now() - startTime
        });
      });
    });
  } catch (err) {
    try { unlinkSync(filepath); } catch {}
    throw err;
  }
}

/**
 * 執行 JavaScript 代碼
 */
async function executeJavaScript(code, startTime, stdin = '') {
  const filename = `${uuidv4()}.js`;
  const filepath = join(TEMP_DIR, filename);
  
  try {
    // 包裝代碼以支持標準輸入
    let wrappedCode;
    
    if (stdin) {
      // 如果有輸入，模擬 readline
      const inputLines = stdin.split('\n');
      wrappedCode = `
        const __inputLines = ${JSON.stringify(inputLines)};
        let __inputIndex = 0;
        
        const readline = () => {
          if (__inputIndex < __inputLines.length) {
            return __inputLines[__inputIndex++];
          }
          return '';
        };
        
        // 模擬 prompt
        const prompt = (msg) => {
          if (msg) console.log(msg);
          return readline();
        };
        
        ${code}
      `;
    } else {
      wrappedCode = code;
    }
    
    writeFileSync(filepath, wrappedCode, 'utf8');
    
    return await new Promise((resolve) => {
      let output = '';
      let error = '';
      let killed = false;
      
      const proc = spawn('node', [filepath], {
        cwd: TEMP_DIR
      });
      
      const timeout = setTimeout(() => {
        killed = true;
        proc.kill('SIGKILL');
      }, EXECUTION_TIMEOUT);
      
      if (stdin) {
        proc.stdin.write(stdin);
        proc.stdin.end();
      } else {
        proc.stdin.end();
      }
      
      proc.stdout.on('data', (data) => {
        output += data.toString();
        if (output.length > MAX_OUTPUT_LENGTH) {
          output = output.substring(0, MAX_OUTPUT_LENGTH) + '\n... (輸出已截斷)';
          killed = true;
          proc.kill('SIGKILL');
        }
      });
      
      proc.stderr.on('data', (data) => {
        error += data.toString();
      });
      
      proc.on('close', (exitCode) => {
        clearTimeout(timeout);
        try { unlinkSync(filepath); } catch {}
        
        if (killed) {
          resolve({
            output: output.trim(),
            error: '執行超時或輸出過長',
            executionTime: Date.now() - startTime
          });
        } else {
          resolve({
            output: output.trim(),
            error: error.trim() || (exitCode !== 0 ? `退出代碼: ${exitCode}` : ''),
            executionTime: Date.now() - startTime
          });
        }
      });
      
      proc.on('error', (err) => {
        clearTimeout(timeout);
        try { unlinkSync(filepath); } catch {}
        
        resolve({
          output: '',
          error: `無法執行 Node.js: ${err.message}`,
          executionTime: Date.now() - startTime
        });
      });
    });
  } catch (err) {
    try { unlinkSync(filepath); } catch {}
    throw err;
  }
}
