const fs = require('fs');
const path = require('path');

// Create wasm directory if it doesn't exist
const wasmDir = path.join(process.cwd(), 'public', 'wasm');
if (!fs.existsSync(wasmDir)) {
  fs.mkdirSync(wasmDir, { recursive: true });
}

// Copy tree-sitter WASM files
const sourceWasm = path.join(process.cwd(), 'node_modules', 'web-tree-sitter', 'tree-sitter.wasm');
const targetWasm = path.join(wasmDir, 'tree-sitter-python.wasm');

fs.copyFileSync(sourceWasm, targetWasm);
console.log('Copied WASM files to public/wasm/');