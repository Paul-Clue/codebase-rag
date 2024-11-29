import { AbstractParser, EnclosingContext } from '../constants';
import * as parser from '@babel/parser';
import traverse, { NodePath, Node } from '@babel/traverse';

const processNode = (
  path: NodePath<Node>,
  lineStart: number,
  lineEnd: number,
  largestSize: number,
  largestEnclosingContext: Node | null
) => {
  const loc = path.node.loc;
  if (loc && loc.start.line <= lineStart && lineEnd <= loc.end.line) {
    const size = loc.end.line - loc.start.line;
    if (size > largestSize) {
      largestSize = size;
      largestEnclosingContext = path.node;
    }
  }
  return { largestSize, largestEnclosingContext };
};

export class JavascriptParser implements AbstractParser {
  findEnclosingContext(
    file: string,
    lineStart: number,
    lineEnd: number
  ): EnclosingContext {
    const ast = parser.parse(file, {
      sourceType: 'module',
      plugins: ['jsx', 'typescript'], // To allow JSX and TypeScript
    });
    let largestEnclosingContext: Node | null = null;
    let largestSize = 0;
    traverse(ast, {
      Function(path) {
        ({ largestSize, largestEnclosingContext } = processNode(
          path,
          lineStart,
          lineEnd,
          largestSize,
          largestEnclosingContext
        ));
      },
      TSInterfaceDeclaration(path) {
        ({ largestSize, largestEnclosingContext } = processNode(
          path,
          lineStart,
          lineEnd,
          largestSize,
          largestEnclosingContext
        ));
      },
    });
    return {
      enclosingContext: largestEnclosingContext,
    } as EnclosingContext;
  }

  dryRun(file: string): { valid: boolean; error: string; ast: any } {
    // dryRun(file: string): { valid: boolean; error: string; ast: any } {
    // dryRun(file: string): { valid: boolean; error: string } {
    try {
      const ast = parser.parse(file, {
        sourceType: 'module',
        // plugins: ["jsx", "typescript"],
        plugins: [
          'jsx',
          'typescript',
          'decorators',
          'classProperties',
          'classPrivateProperties',
          'classPrivateMethods',
          'exportDefaultFrom',
          'exportNamespaceFrom',
          'asyncGenerators',
          'functionBind',
          'functionSent',
          'dynamicImport',
          'numericSeparator',
          'optionalChaining',
          'importMeta',
          'bigInt',
          'optionalCatchBinding',
          'throwExpressions',
          'nullishCoalescingOperator',
        ],
        tokens: true, // Include tokens in output
        ranges: true, // Include ranges in output
        attachComment: true,
      });

      // console.log('AST', ast);

      return {
        valid: true,
        error: '',
        ast,
      };
    } catch (exc) {
      return {
        valid: false,
        error: String(exc),
        ast: null,
      };
    }
  }
}
