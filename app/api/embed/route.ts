import { processGitHubRepo } from '@/lib/embeddings/ast-embedder';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    // Parse request body
    const body = await request.json();
    const { owner, repoName } = body;

    if (!owner || !repoName) {
      return NextResponse.json({
        success: false,
        error: 'Missing owner or repository name'
      });
    }
    console.log(1);
    // Process the repo
    await processGitHubRepo(owner, repoName);

    console.log(2);
    
    return NextResponse.json({
      success: true,
      message: 'Repository processed successfully'
    });

  } catch (error) {
    console.error('Error processing repository:', error);
    return NextResponse.json({
      success: false,
      error: error
    });
  }
}
