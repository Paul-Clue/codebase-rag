import Parser from 'web-tree-sitter';

let parserInitialized = false;
let parser: Parser;

export async function initParser() {
  if (!parserInitialized) {
    try {
      await Parser.init();
      parser = new Parser();
      
      // Load WASM from public directory
      const wasmPath = process.env.NODE_ENV === 'production'
        ? '/var/task/public/wasm/tree-sitter.wasm'
        : '/wasm/tree-sitter.wasm';

      console.log('Loading WASM from:', wasmPath);
      const Lang = await Parser.Language.load(wasmPath);
      parser.setLanguage(Lang);
      parserInitialized = true;
    } catch (error) {
      console.error('Failed to initialize parser:', error);
      throw error;
    }
  }
  return parser;
} 