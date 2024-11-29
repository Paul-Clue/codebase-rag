'use client';

import type {
  Attachment,
  ChatRequestOptions,
  CreateMessage,
  Message,
} from 'ai';
import cx from 'classnames';
import { motion } from 'framer-motion';
import type React from 'react';
import {
  useRef,
  useEffect,
  useState,
  useCallback,
  type Dispatch,
  type SetStateAction,
  type ChangeEvent,
} from 'react';
import { toast } from 'sonner';
import { useLocalStorage, useWindowSize } from 'usehooks-ts';
// import { processGitHubRepo } from '@/lib/embeddings/ast-embedder';

import { sanitizeUIMessages } from '@/lib/utils';

import { ArrowUpIcon, PaperclipIcon, StopIcon } from './icons';
import { PreviewAttachment } from './preview-attachment';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';

const suggestedActions = [
  {
    title: 'What is the weather',
    label: 'in San Francisco?',
    action: 'What is the weather in San Francisco?',
  },
  {
    title: 'Help me draft an essay',
    label: 'about Silicon Valley',
    action: 'Help me draft a short essay about Silicon Valley',
  },
];

interface MultimodalInputProps {
  className?: string;
  chatId: string;
  input: string;
  setInput: (value: string) => void;
  handleSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  isLoading: boolean;
  stop: () => void;
  attachments: Array<Attachment>;
  setAttachments: (attachments: Array<Attachment>) => void;
  messages: Array<Message>;
  setMessages: (messages: Array<Message>) => void;
  append: (message: Message) => void;
  setOwner: (owner: string) => void;
  setRepoName: (repo: string) => void;
}

export function MultimodalInput({
  className = '',
  chatId,
  input,
  setInput,
  handleSubmit,
  isLoading,
  stop,
  attachments,
  setAttachments,
  messages,
  setMessages,
  append,
  setOwner,
  setRepoName,
}: MultimodalInputProps) {
  // section:
  const [validRepo, setValidRepo] = useState(false);
  const [loading, setLoading] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { width } = useWindowSize();

  useEffect(() => {
    if (textareaRef.current) {
      adjustHeight();
    }
  }, []);

  const adjustHeight = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${
        textareaRef.current.scrollHeight + 2
      }px`;
    }
  };

  const [localStorageInput, setLocalStorageInput] = useLocalStorage(
    'input',
    ''
  );

  useEffect(() => {
    if (textareaRef.current) {
      const domValue = textareaRef.current.value;
      // Prefer DOM value over localStorage to handle hydration
      const finalValue = domValue || localStorageInput || '';
      setInput(finalValue);
      adjustHeight();
    }
    // Only run once after hydration
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setLocalStorageInput(input);
  }, [input, setLocalStorageInput]);

  const handleInput = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(event.target.value);
    adjustHeight();
  };

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadQueue, setUploadQueue] = useState<Array<string>>([]);

  const submitForm = useCallback(() => {
    window.history.replaceState({}, '', `/chat/${chatId}`);

    handleSubmit({
      experimental_attachments: attachments,
    } as any);

    setAttachments([]);
    setLocalStorageInput('');

    if (width && width > 768) {
      textareaRef.current?.focus();
    }
  }, [
    attachments,
    handleSubmit,
    setAttachments,
    setLocalStorageInput,
    width,
    chatId,
  ]);

  const uploadFile = async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('/api/files/upload', {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        const data = await response.json();
        const { url, pathname, contentType } = data;

        return {
          url,
          name: pathname,
          contentType: contentType,
        };
      }
      const { error } = await response.json();
      toast.error(error);
    } catch (error) {
      toast.error('Failed to upload file, please try again!');
    }
  };

  const handleFileChange = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(event.target.files || []);

      setUploadQueue(files.map((file) => file.name));

      try {
        const uploadPromises = files.map((file) => uploadFile(file));
        const uploadedAttachments = await Promise.all(uploadPromises);
        const successfullyUploadedAttachments = uploadedAttachments.filter(
          (attachment) => attachment !== undefined
        );

        setAttachments([
          ...attachments,
          ...(successfullyUploadedAttachments as Array<Attachment>),
        ]);
      } catch (error) {
        console.error('Error uploading files!', error);
      } finally {
        setUploadQueue([]);
      }
    },
    [setAttachments]
  );
  // section:

  // async function isValidGitHubRepo(owner: string, repo: string): Promise<boolean> {
  //   try {
  //     const response = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
  //       headers: {
  //         'Authorization': `Bearer ${process.env.GIT_HUB_TOKEN}`,
  //         'Accept': 'application/vnd.github.v3+json'
  //       }
  //     });
  //     return response.status === 200;
  //   } catch (error) {
  //     console.error('Error checking repo:', error);
  //     return false;
  //   }
  // }

  const embedRepo = async (repo: string) => {
    const githubUrlRegex = /^https:\/\/github\.com\/[\w-]+\/[\w-]+$/;
    const isValidUrl = githubUrlRegex.test(repo);

    const urlObj = new URL(repo);
    if (isValidUrl) {
      // toast.success(extracted);
      const [owner, repoName] = urlObj.pathname.split('/').filter(Boolean);
      try {
        const response = await fetch('/api/embed', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            repoUrl: repo,
            owner: owner,
            repoName: repoName,
          }),
        });

        console.log('RESPONSE', response);

        if (response.ok) {
          toast.success('Repository embedded successfully');
          setInput('');
          setValidRepo(true);
        } else {
          toast.error('Failed to embed repository');
        }
      } catch (error) {
        console.error('Error:', error);
        toast.error('Failed to embed repository');
      }
    } else {
      toast.error('Invalid GitHub repository URL');
    }

    // if (!repo.startsWith("https://github.com/")) {
    //   toast.error("Invalid GitHub repository URL");
    //   return;
    // }

    // if (isValidUrl) {
    //   toast.success("Valid URL");
    //   setInput('');
    //   setValidRepo(true);
    //   return;
    // }else{
    //   toast.error("Invalid GitHub repository URL");
    // }
  };
  // async function embedRepo(owner: string, repo: string): Promise<boolean> {
  //   try {
  //     console.log(`Checking repo: ${owner}/${repo}`);  // Debug
  //     console.log(`Token: ${process.env.GITHUB_TOKEN}`); // Debug (remove in production)

  //     const response = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
  //       headers: {
  //         'Authorization': `token ${process.env.GITHUB_TOKEN}`,  // Changed from Bearer to token
  //         'Accept': 'application/vnd.github.v3+json'
  //       }
  //     });

  //     console.log('Response status:', response.status);  // Debug
  //     if (!response.ok) {
  //       const error = await response.json();
  //       console.log('Error details:', error);  // Debug
  //     }

  //     return response.status === 200;
  //   } catch (error) {
  //     console.error('Error checking repo:', error);
  //     return false;
  //   }
  // }
  // section:
  const handleGitHubUrl = (url: string) => {
    const extracted = url.substring(0, url.indexOf('/', 8));
    try {
      const urlObj = new URL(url);
      if (
        urlObj.hostname === 'github.com' &&
        extracted === 'https://github.com'
      ) {
        // toast.success(extracted);
        const [owner, repo] = urlObj.pathname.split('/').filter(Boolean);
        setOwner(owner);
        setRepoName(repo);
      }
    } catch (e) {
      toast.error('Invalid GitHub repository URL');
    }
  };

  return (
    <div className='relative w-full flex flex-col gap-4'>
      {messages.length === 0 &&
        attachments.length === 0 &&
        uploadQueue.length === 0 && (
          <div className='grid sm:grid-cols-2 gap-2 w-full'>
            {/* {suggestedActions.map((suggestedAction, index) => (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                transition={{ delay: 0.05 * index }}
                key={`suggested-action-${suggestedAction.title}-${index}`}
                className={index > 1 ? 'hidden sm:block' : 'block'}
              >
                <Button
                  variant="ghost"
                  onClick={async () => {
                    window.history.replaceState({}, '', `/chat/${chatId}`);

                    append({
                      role: 'user',
                      content: suggestedAction.action,
                    });
                  }}
                  className="text-left border rounded-xl px-4 py-3.5 text-sm flex-1 gap-1 sm:flex-col w-full h-auto justify-start items-start"
                >
                  <span className="font-medium">{suggestedAction.title}</span>
                  <span className="text-muted-foreground">
                    {suggestedAction.label}
                  </span>
                </Button>
              </motion.div>
            ))} */}
          </div>
        )}

      <input
        type='file'
        className='fixed -top-4 -left-4 size-0.5 opacity-0 pointer-events-none'
        ref={fileInputRef}
        multiple
        onChange={handleFileChange}
        tabIndex={-1}
      />

      {(attachments.length > 0 || uploadQueue.length > 0) && (
        <div className='flex flex-row gap-2 overflow-x-scroll items-end'>
          {attachments.map((attachment) => (
            <PreviewAttachment key={attachment.url} attachment={attachment} />
          ))}

          {uploadQueue.map((filename) => (
            <PreviewAttachment
              key={filename}
              attachment={{
                url: '',
                name: filename,
                contentType: '',
              }}
              isUploading={true}
            />
          ))}
        </div>
      )}

      {/* section: */}
      {!validRepo ? (
        <Textarea
          ref={textareaRef}
          placeholder='Paste github repo address...'
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            handleGitHubUrl(e.target.value);
          }}
          className={cx(
            'min-h-[24px] max-h-[calc(75dvh)] overflow-hidden resize-none rounded-xl text-base bg-muted',
            className
          )}
          rows={3}
          autoFocus
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();

              if (isLoading) {
                toast.error(
                  'Please wait for the model to finish its response!'
                );
              } else {
                submitForm();
              }
            }
          }}
        />
      ) : (
        <Textarea
          ref={textareaRef}
          placeholder='Send a message...'
          value={input}
          onChange={handleInput}
          className={cx(
            'min-h-[24px] max-h-[calc(75dvh)] overflow-hidden resize-none rounded-xl text-base bg-muted',
            className
          )}
          rows={3}
          autoFocus
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();

              if (isLoading) {
                toast.error(
                  'Please wait for the model to finish its response!'
                );
              } else {
                submitForm();
              }
            }
          }}
        />
      )}

      {/* section: */}
      {!validRepo ? (
        <Button
          className='rounded-full p-1.5 h-fit absolute bottom-2 right-2 m-0.5 border dark:border-zinc-600'
          onClick={(event) => {
            event.preventDefault();
            // stop();
            embedRepo(input);
          }}
        >
          <ArrowUpIcon size={14} />
        </Button>
      ) : isLoading ? (
        <Button
          className='rounded-full p-1.5 h-fit absolute bottom-2 right-2 m-0.5 border dark:border-zinc-600'
          onClick={(event) => {
            event.preventDefault();
            stop();
            setMessages(sanitizeUIMessages(messages));
          }}
        >
          <StopIcon size={14} />
        </Button>
      ) : (
        <>
          <Button
            className='rounded-full p-1.5 h-fit absolute bottom-2 right-2 m-0.5 border dark:border-zinc-600'
            onClick={(event) => {
              event.preventDefault();
              submitForm();
            }}
            disabled={input.length === 0 || uploadQueue.length > 0}
          >
            <ArrowUpIcon size={14} />
          </Button>

          <Button
            className='rounded-full p-1.5 h-fit absolute bottom-2 right-11 m-0.5 dark:border-zinc-700'
            onClick={(event) => {
              event.preventDefault();
              fileInputRef.current?.click();
            }}
            variant='outline'
            disabled={isLoading}
          >
            <PaperclipIcon size={14} />
          </Button>
        </>
      )}
    </div>
  );
}
