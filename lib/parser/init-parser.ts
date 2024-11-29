import Parser from 'web-tree-sitter';
import path from 'path';

let parserInitialized = false;
let parser: Parser;

export async function initParser() {
  if (!parserInitialized) {
    try {
      await Parser.init();
      parser = new Parser();
      
      // In production, WASM file should be in the same directory as the compiled code
      const wasmPath = process.env.NODE_ENV === 'production' 
        ? path.join(process.cwd(), 'public', 'wasm', 'tree-sitter-python.wasm')
        : '/wasm/tree-sitter-python.wasm';
        
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