import {
  type Message,
  StreamData,
  convertToCoreMessages,
  streamObject,
  streamText,
} from 'ai';
import { z } from 'zod';
import { Pinecone } from '@pinecone-database/pinecone';
import { HfInference } from '@huggingface/inference';
import { NextResponse } from 'next/server';

import { auth } from '@/app/(auth)/auth';
import { customModel } from '@/lib/ai';
import { models } from '@/lib/ai/models';
import { systemPrompt } from '@/lib/ai/prompts';
import {
  deleteChatById,
  getChatById,
  getDocumentById,
  saveChat,
  saveDocument,
  saveMessages,
  saveSuggestions,
} from '@/lib/db/queries';
import type { Suggestion } from '@/lib/db/schema';
import {
  generateUUID,
  getMostRecentUserMessage,
  sanitizeResponseMessages,
} from '@/lib/utils';

import { generateTitleFromUserMessage } from '../../actions';

export const maxDuration = 60;

type AllowedTools =
  | 'createDocument'
  | 'updateDocument'
  | 'requestSuggestions'
  | 'getWeather';

const blocksTools: AllowedTools[] = [
  'createDocument',
  'updateDocument',
  'requestSuggestions',
];

const weatherTools: AllowedTools[] = ['getWeather'];

const allTools: AllowedTools[] = [...blocksTools, ...weatherTools];

export async function POST(request: Request) {
  try {
    const {
      id,
      messages,
      modelId,
      owner,
      repoName,
    } = await request.json();
    console.log(1);
    if (!process.env.PINECONE_API_KEY) {
      console.log('PINECONE_API_KEY is not defined');
      console.error('PINECONE_API_KEY is not defined');
      return NextResponse.json({ 
        error: 'PINECONE_API_KEY is not defined' 
      }, { status: 500 });
    }
    console.log(2);
    if (!process.env.HUGGINGFACE_API_KEY) {
      console.log('HUGGINGFACE_API_KEY is not defined');
      console.error('HUGGINGFACE_API_KEY is not defined');
      return NextResponse.json({ 
        error: 'HUGGINGFACE_API_KEY is not defined' 
      }, { status: 500 });
    }
    console.log(3);
    try {
      const pc = new Pinecone({
        apiKey: process.env.PINECONE_API_KEY
      });

      const index = pc.index('codebase-rag').namespace(repoName);
      const hf = new HfInference(process.env.HUGGINGFACE_API_KEY);
      console.log(4);
      async function getEmbeddings(text: string): Promise<number[]> {
        try {
          const response = await hf.featureExtraction({
            model: 'sentence-transformers/all-mpnet-base-v2',
            inputs: text,
          });
          return response as number[];
        } catch (error) {
          console.error('Error generating embeddings:', error);
          throw error;
        }
      }
      console.log(5);
      let text = messages[messages.length - 1].content;

      const embeddings = await getEmbeddings(text);
      console.log(6);
      const results = await index.query({
        topK: 20,
        includeMetadata: true,
        vector: embeddings,
      });
      console.log(7);
      let resultString =
        '\n\nReturned results from vector db (done automatically): ';

      results.matches.forEach((match) => {
        resultString += `\n
        Id: ${match.id}
        Source: ${match.metadata?.source}
        Text: ${match.metadata?.text}
        \n\n
        `;
      });
      console.log(8);
      const lastMessage = messages[messages.length - 1];
      const lastMessageContent = lastMessage.content + resultString;
      messages[messages.length - 1].content = lastMessageContent;
      const lastDataWithoutLastMessage = messages.slice(0, messages.length - 1);
      console.log(9);
      const session = await auth();

      if (!session || !session.user || !session.user.id) {
        return new Response('Unauthorized', { status: 401 });
      }
      console.log(10);
      const model = models.find((model) => model.id === modelId);

      if (!model) {
        return new Response('Model not found', { status: 404 });
      }
      console.log(11);
      const coreMessages = convertToCoreMessages(messages);
      const userMessage = getMostRecentUserMessage(coreMessages);

      if (!userMessage) {
        return new Response('No user message found', { status: 400 });
      }
      console.log(12);
      const chat = await getChatById({ id });

      if (!chat) {
        const title = await generateTitleFromUserMessage({ message: userMessage });
        await saveChat({ id, userId: session.user.id, title });
      }
      console.log(13);
      await saveMessages({
        messages: [
          { ...userMessage, id: generateUUID(), createdAt: new Date(), chatId: id },
        ],
      });
      console.log(14);
      const streamingData = new StreamData();

      const result = await streamText({
        model: customModel(model.apiIdentifier),
        system: systemPrompt,
        messages: coreMessages,
        maxSteps: 5,
        experimental_activeTools: allTools,
        tools: {
          getWeather: {
            description: 'Get the current weather at a location',
            parameters: z.object({
              latitude: z.number(),
              longitude: z.number(),
            }),
            execute: async ({ latitude, longitude }) => {
              const response = await fetch(
                `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m&hourly=temperature_2m&daily=sunrise,sunset&timezone=auto`
              );

              const weatherData = await response.json();
              return weatherData;
            },
          },
          createDocument: {
            description: 'Create a document for a writing activity',
            parameters: z.object({
              title: z.string(),
            }),
            execute: async ({ title }) => {
              const id = generateUUID();
              let draftText = '';

              streamingData.append({
                type: 'id',
                content: id,
              });

              streamingData.append({
                type: 'title',
                content: title,
              });

              streamingData.append({
                type: 'clear',
                content: '',
              });

              const { fullStream } = await streamText({
                model: customModel(model.apiIdentifier),
                system:
                  'Write about the given topic. Markdown is supported. Use headings wherever appropriate.',
                prompt: title,
              });

              for await (const delta of fullStream) {
                const { type } = delta;

                if (type === 'text-delta') {
                  const { textDelta } = delta;

                  draftText += textDelta;
                  streamingData.append({
                    type: 'text-delta',
                    content: textDelta,
                  });
                }
              }

              streamingData.append({ type: 'finish', content: '' });

              if (session.user?.id) {
                await saveDocument({
                  id,
                  title,
                  content: draftText,
                  userId: session.user.id,
                });
              }

              return {
                id,
                title,
                content: 'A document was created and is now visible to the user.',
              };
            },
          },
          updateDocument: {
            description: 'Update a document with the given description',
            parameters: z.object({
              id: z.string().describe('The ID of the document to update'),
              description: z
                .string()
                .describe('The description of changes that need to be made'),
            }),
            execute: async ({ id, description }) => {
              const document = await getDocumentById({ id });

              if (!document) {
                return {
                  error: 'Document not found',
                };
              }

              const { content: currentContent } = document;
              let draftText = '';

              streamingData.append({
                type: 'clear',
                content: document.title,
              });

              const { fullStream } = await streamText({
                model: customModel(model.apiIdentifier),
                system:
                  'You are a helpful writing assistant. Based on the description, please update the piece of writing.',
                experimental_providerMetadata: {
                  openai: {
                    prediction: {
                      type: 'content',
                      content: currentContent,
                    },
                  },
                },
                messages: [
                  {
                    role: 'user',
                    content: description,
                  },
                  { role: 'user', content: currentContent },
                ],
              });

              for await (const delta of fullStream) {
                const { type } = delta;

                if (type === 'text-delta') {
                  const { textDelta } = delta;

                  draftText += textDelta;
                  streamingData.append({
                    type: 'text-delta',
                    content: textDelta,
                  });
                }
              }

              streamingData.append({ type: 'finish', content: '' });

              if (session.user?.id) {
                await saveDocument({
                  id,
                  title: document.title,
                  content: draftText,
                  userId: session.user.id,
                });
              }

              return {
                id,
                title: document.title,
                content: 'The document has been updated successfully.',
              };
            },
          },
          requestSuggestions: {
            description: 'Request suggestions for a document',
            parameters: z.object({
              documentId: z
                .string()
                .describe('The ID of the document to request edits'),
            }),
            execute: async ({ documentId }) => {
              const document = await getDocumentById({ id: documentId });

              if (!document || !document.content) {
                return {
                  error: 'Document not found',
                };
              }

              const suggestions: Array<
                Omit<Suggestion, 'userId' | 'createdAt' | 'documentCreatedAt'>
              > = [];

              const { elementStream } = await streamObject({
                model: customModel(model.apiIdentifier),
                system:
                  'You are a help writing assistant. Given a piece of writing, please offer suggestions to improve the piece of writing and describe the change. It is very important for the edits to contain full sentences instead of just words. Max 5 suggestions.',
                prompt: document.content,
                output: 'array',
                schema: z.object({
                  originalSentence: z.string().describe('The original sentence'),
                  suggestedSentence: z.string().describe('The suggested sentence'),
                  description: z
                    .string()
                    .describe('The description of the suggestion'),
                }),
              });

              for await (const element of elementStream) {
                const suggestion = {
                  originalText: element.originalSentence,
                  suggestedText: element.suggestedSentence,
                  description: element.description,
                  id: generateUUID(),
                  documentId: documentId,
                  isResolved: false,
                };

                streamingData.append({
                  type: 'suggestion',
                  content: suggestion,
                });

                suggestions.push(suggestion);
              }

              if (session.user?.id) {
                const userId = session.user.id;

                await saveSuggestions({
                  suggestions: suggestions.map((suggestion) => ({
                    ...suggestion,
                    userId,
                    createdAt: new Date(),
                    documentCreatedAt: document.createdAt,
                  })),
                });
              }

              return {
                id: documentId,
                title: document.title,
                message: 'Suggestions have been added to the document',
              };
            },
          },
        },
        onFinish: async ({ responseMessages }) => {
          if (session.user?.id) {
            try {
              const responseMessagesWithoutIncompleteToolCalls =
                sanitizeResponseMessages(responseMessages);

              await saveMessages({
                messages: responseMessagesWithoutIncompleteToolCalls.map(
                  (message) => {
                    const messageId = generateUUID();

                    if (message.role === 'assistant') {
                      streamingData.appendMessageAnnotation({
                        messageIdFromServer: messageId,
                      });
                    }

                    return {
                      id: messageId,
                      chatId: id,
                      role: message.role,
                      content: message.content,
                      createdAt: new Date(),
                    };
                  }
                ),
              });
            } catch (error) {
              console.error('Failed to save chat');
            }
          }

          streamingData.close();
        },
        experimental_telemetry: {
          isEnabled: true,
          functionId: 'stream-text',
        },
      });

      return result.toDataStreamResponse({
        data: streamingData,
      });
    } catch (error) {
      console.error('Error in chat processing:', error);
      return NextResponse.json({ 
        error: error instanceof Error ? error.message : 'Error processing chat request' 
      }, { status: 500 });
    }

  } catch (error) {
    console.error('Error parsing request:', error);
    return NextResponse.json({ 
      error: 'Invalid request format' 
    }, { status: 400 });
  }
}

async function getEmbeddings(text: string): Promise<number[]> {
  try {
    const hf = new HfInference(process.env.HUGGINGFACE_API_KEY);
    const response = await hf.featureExtraction({
      model: 'sentence-transformers/all-mpnet-base-v2',
      inputs: text,
    });
    return response as number[];
  } catch (error) {
    console.error('Error generating embeddings:', error);
    throw new Error('Failed to generate embeddings');
  }
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return new Response('Not Found', { status: 404 });
  }

  const session = await auth();

  if (!session || !session.user) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    const chat = await getChatById({ id });

    if (chat.userId !== session.user.id) {
      return new Response('Unauthorized', { status: 401 });
    }

    await deleteChatById({ id });

    return new Response('Chat deleted', { status: 200 });
  } catch (error) {
    return new Response('An error occurred while processing your request', {
      status: 500,
    });
  }
}
