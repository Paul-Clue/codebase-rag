import Parser from 'web-tree-sitter';

let parserInitialized = false;
let parser: Parser;

export async function initParser() {
  if (!parserInitialized) {
    await Parser.init();
    parser = new Parser();
    const Lang = await Parser.Language.load('tree-sitter-python.wasm');
    parser.setLanguage(Lang);
    parserInitialized = true;
  }
  return parser;
} 