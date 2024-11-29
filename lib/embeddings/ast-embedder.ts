import { JavascriptParser } from '../../app/context/javascript-parser';
import { PythonParser } from '../../app/context/python-parser';
import { Pinecone } from '@pinecone-database/pinecone';
import { Octokit } from '@octokit/rest';
import { HfInference } from '@huggingface/inference';

const SUPPORTED_EXTENSIONS = {
  '.js': 'javascript',
  '.jsx': 'javascript',
  '.ts': 'javascript',
  '.tsx': 'javascript',
  '.py': 'python',
} as const;

type SupportedLanguage =
  (typeof SUPPORTED_EXTENSIONS)[keyof typeof SUPPORTED_EXTENSIONS];

export async function processGitHubRepo(owner: string, repo: string) {
  const octokit = new Octokit({
    auth: process.env.GIT_HUB_TOKEN,
  });
  // 1. Get repo contents
  const { data: files } = await octokit.repos.getContent({
    owner,
    repo,
    path: '',
  });
  console.log(3);
  // 2. Process each file recursively
  await processDirectory(octokit, owner, repo, '', files as any[]);
}

async function processDirectory(
  octokit: Octokit,
  owner: string,
  repo: string,
  path: string,
  contents: any[]
) {
  for (const item of contents) {
    if (item.type === 'dir') {
      const { data: dirContents } = await octokit.repos.getContent({
        owner,
        repo,
        path: item.path,
      });
      await processDirectory(
        octokit,
        owner,
        repo,
        item.path,
        dirContents as any[]
      );
    } else if (item.type === 'file') {
      const extension = getFileExtension(item.name);
      if (extension in SUPPORTED_EXTENSIONS) {
        await processFile(octokit, owner, repo, item);
      }
    }
  }
}

async function processFile(
  octokit: Octokit,
  owner: string,
  repo: string,
  file: any
) {
  // Get file contents
  const { data } = await octokit.repos.getContent({
    owner,
    repo,
    path: file.path,
  });

  const content = Buffer.from(
    (data as { content: string }).content,
    'base64'
  ).toString();
  const language =
    SUPPORTED_EXTENSIONS[
      getFileExtension(file.name) as keyof typeof SUPPORTED_EXTENSIONS
    ];

  await convertToASTAndEmbed(
    content,
    language,
    file.path,
    `${owner}/${repo}`,
    repo
  );
}
import traverse from '@babel/traverse';

async function convertToASTAndEmbed(
  code: string,
  language: SupportedLanguage,
  filepath: string,
  repoId: string,
  repo: string
) {
  // 1. Parse code to AST
  const parser =
    language === 'javascript' ? new JavascriptParser() : new PythonParser();

  const result = await parser.dryRun(code);
  const { valid, error } = result;
  const ast = 'ast' in result ? result.ast : null;
  // 2. Get embeddings using HuggingFace
  const hf = new HfInference(process.env.HUGGINGFACE_API_KEY);
  const embedding = await hf.featureExtraction({
    model: 'sentence-transformers/all-mpnet-base-v2',
    inputs: JSON.stringify({
      ast: ast,
      fileContent: code,
      filePath: filepath,
      metadata: {
        language,
        valid,
        error,
      },
    }),
  });

  // 3. Store in Pinecone
  const pc = new Pinecone({
    apiKey: process.env.PINECONE_API_KEY!,
  });

  const index = pc.index('codebase-rag').namespace(repo);

  await index.upsert([
    {
      id: `${repoId}/${filepath}`,
      values: embedding as number[],
      metadata: {
        repo: repoId,
        filepath,
        language,
        ast: JSON.stringify({ valid, error }),
      },
    },
  ]);
}

function getFileExtension(filename: string): string {
  return filename.slice(filename.lastIndexOf('.'));
}
