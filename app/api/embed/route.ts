import { Message } from '@/lib/db/schema';
import { processGitHubRepo } from '@/lib/embeddings/ast-embedder';
import { NextResponse } from 'next/server';

async function isValidGitHubRepo(
  owner: string,
  repoName: string
): Promise<boolean> {
  try {
    const response = await fetch(
      `https://api.github.com/repos/${owner}/${repoName}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.GIT_HUB_TOKEN}`,
          Accept: 'application/vnd.github.v3+json',
        },
      }
    );
    return response.status === 200;
  } catch (error) {
    console.error('Error checking repo:', error);
    return false;
  }
}

export async function POST(request: Request) {
  const {
    owner,
    repoName,
    repo,
  }: {
    owner: string;
    repoName: string;
    repo: string;
  } = await request.json();
  // console.log('REPO', repo);

  const isValid = await isValidGitHubRepo(owner, repoName);
  // if (!isValid) {
  //   return new Response('Invalid GitHub repository', { status: 400 });
  // }

  try {
    if (isValid) {
      await processGitHubRepo(owner, repoName);
      return NextResponse.json({ success: true });
    }
    return NextResponse.json(
      { error: 'Invalid repository' },
      { status: 400 }
    );
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to embed repository' },
      { status: 500 }
    );
  }

  // const { owner, repo } = await request.json();
}
