import { processGitHubRepo } from '@/lib/embeddings/ast-embedder';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { owner, repoName } = body;

    if (!owner || !repoName) {
      return NextResponse.json(
        { error: 'Missing owner or repository name' },
        { status: 400 }
      );
    }

    // Validate GitHub repo
    const isValid = await fetch(
      `https://api.github.com/repos/${owner}/${repoName}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.GIT_HUB_TOKEN}`,
          Accept: 'application/vnd.github.v3+json',
        },
      }
    ).then(res => res.status === 200);

    if (!isValid) {
      return NextResponse.json(
        { error: 'Invalid GitHub repository' },
        { status: 400 }
      );
    }

    // Process the repo
    await processGitHubRepo(owner, repoName);
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error processing repository:', error);
    return NextResponse.json(
      { error: 'Failed to process repository' },
      { status: 500 }
    );
  }
}
