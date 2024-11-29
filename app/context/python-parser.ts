import { PythonAbstractParser, PythonEnclosingContext } from '../constants';
import { initParser } from '@/lib/parser/init-parser';
import Parser from 'web-tree-sitter';

interface Node {
  type: 'ClassDeclaration' | 'FunctionDeclaration' | 'Module';
  name: string;
  start: number;
  end: number;
  loc: {
    start: { line: number; column: number };
    end: { line: number; column: number };
  };
  leadingComments: any;
  trailingComments: any;
  innerComments: any;
}
export class PythonParser implements PythonAbstractParser {
  private parser: any;
  private initialized = false;

  private async initialize() {
    if (!this.initialized) {
      await Parser.init();
      this.parser = new Parser();
      const Lang = await Parser.Language.load('src/tree-sitter-python.wasm');
      this.parser.setLanguage(Lang);
      this.initialized = true;
    }
  }

  private nodeToEnclosingContext(node: Parser.SyntaxNode): Node {
    return {
      type:
        node.type === 'class_definition'
          ? 'ClassDeclaration'
          : 'FunctionDeclaration',
      name: node.childForFieldName('name')?.text ?? '',
      start: node.startIndex,
      end: node.endIndex,
      loc: {
        start: {
          line: node.startPosition.row + 1,
          column: node.startPosition.column,
        },
        end: {
          line: node.endPosition.row + 1,
          column: node.endPosition.column,
        },
      },
      leadingComments: null,
      trailingComments: null,
      innerComments: null,
    };
  }

  async findEnclosingContext(
    file: string,
    lineStart: number,
    lineEnd: number
  ): Promise<PythonEnclosingContext | null> {
    await this.initialize();

    const tree = this.parser.parse(file);

    const startPoint = { row: lineStart - 1, column: 0 };
    const endPoint = { row: lineEnd - 1, column: 0 };

    let currentNode = tree.rootNode.descendantForPosition(startPoint);

    while (currentNode) {
      if (
        (currentNode.type === 'class_definition' ||
          currentNode.type === 'function_definition') &&
        currentNode.startPosition.row <= startPoint.row &&
        currentNode.endPosition.row >= endPoint.row
      ) {
        return this.nodeToEnclosingContext(currentNode);
      }
      currentNode = currentNode.parent;
    }

    return {
      type: 'Module',
      name: 'module',
      start: 0,
      end: file.split('\n').length,
      loc: {
        start: { line: 1, column: 0 },
        end: { line: file.split('\n').length, column: 0 },
      },
      leadingComments: null,
      trailingComments: null,
      innerComments: null,
    };
  }

  async dryRun(file: string): Promise<{ valid: boolean; error: string; ast: any }> {
    try {
      // Only initialize parser on server-side
      if (typeof window === 'undefined') {
        const parser = await initParser();
        const tree = parser.parse(file);
        return {
          valid: !tree.rootNode.hasError,
          error: '',
          ast: tree,
        };
      }
      return { valid: true, error: '', ast: null };
    } catch (error) {
      return { valid: false, error: (error as Error).message, ast: null };
    }
  }
}
