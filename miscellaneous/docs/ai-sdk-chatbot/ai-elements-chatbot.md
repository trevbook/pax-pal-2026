[Vercel](https://vercel.com/) Slash [AI Elements](https://elements.ai-sdk.dev/en)

- [Docs](https://elements.ai-sdk.dev/en/docs)
- [Components](https://elements.ai-sdk.dev/en/components)
- [Examples](https://elements.ai-sdk.dev/en/examples)

Search... `⌘K`Ask AI

Ask AI

[Chatbot](https://elements.ai-sdk.dev/examples/chatbot) [IDE](https://elements.ai-sdk.dev/examples/ide) [v0 clone](https://elements.ai-sdk.dev/examples/v0) [Workflow](https://elements.ai-sdk.dev/examples/workflow)

ChatbotTutorial

# Chatbot

An example of how to use the AI Elements to build a chatbot.

Preview

Code

Can you explain how to use React hooks effectively?

Used 2 sources

# React Hooks Best Practices

React hooks are a powerful feature that let you use state and other React features without writing classes. Here are some tips for using them effectively:

## Rules of Hooks

1. Only call hooks at the top level of your component or custom hooks
2. Don't call hooks inside loops, conditions, or nested functions

## Common Hooks

- useState: For local component state
- useEffect: For side effects like data fetching
- useContext: For consuming context
- useReducer: For complex state logic
- useCallback: For memoizing functions
- useMemo: For memoizing values

## Example of useState and useEffect

jsx

```jsx
function ProfilePage({ userId }) {  const [user, setUser] = useState(null);
  useEffect(() => {    // This runs after render and when userId changes    fetchUser(userId).then(userData => {      setUser(userData);    });  }, [userId]);
  return user ? <Profile user={user} /> : <Loading />;}
```

Would you like me to explain any specific hook in more detail?

Yes, could you explain useCallback and useMemo in more detail? When should I use one over the other?

I'm particularly interested in understanding the performance implications of useCallback and useMemo. Could you break down when each is most appropriate?

Thanks for the overview! Could you dive deeper into the specific use cases where useCallback and useMemo make the biggest difference in React applications?

1 of 3

Thought for 10 seconds

## useCallback vs useMemo

Both hooks help with performance optimization, but they serve different purposes:

### useCallback

`useCallback` memoizes functions to prevent unnecessary re-renders of child components that receive functions as props.

jsx

```jsx
// Without useCallback - a new function is created on every renderconst handleClick = () => {  console.log(count);};
// With useCallback - the function is only recreated when dependencies changeconst handleClick = useCallback(() => {  console.log(count);}, [count]);
```

### useMemo

`useMemo` memoizes values to avoid expensive recalculations on every render.

jsx

```jsx
// Without useMemo - expensive calculation runs on every renderconst sortedList = expensiveSort(items);
// With useMemo - calculation only runs when items changeconst sortedList = useMemo(() => expensiveSort(items), [items]);
```

### When to use which?

- Use useCallback when:
  - Passing callbacks to optimized child components that rely on reference equality
  - Working with event handlers that you pass to child components
- Use useMemo when:
  - You have computationally expensive calculations
  - You want to avoid recreating objects that are used as dependencies for other hooks

### Performance Note

Don't overuse these hooks! They come with their own overhead. Only use them when you have identified a genuine performance issue.

What are the latest trends in AI?How does machine learning work?Explain quantum computingBest practices for React developmentTell me about TypeScript benefitsHow to optimize database queries?What is the difference between SQL and NoSQL?Explain cloud computing basics

Search![openai logo](https://models.dev/logos/openai.svg)GPT-4o

## [Tutorial](https://elements.ai-sdk.dev/examples/chatbot\#tutorial)

Let's walk through how to build a chatbot using AI Elements and AI SDK. Our example will include reasoning, web search with citations, and a model picker.

### [Setup](https://elements.ai-sdk.dev/examples/chatbot\#setup)

First, set up a new Next.js repo and cd into it by running the following command (make sure you choose to use Tailwind the project setup):

npm

pnpm

yarn

bun

```
npx create-next-app@latest ai-chatbot && cd ai-chatbot
```

Run the following command to install AI Elements. This will also set up shadcn/ui if you haven't already configured it:

npm

pnpm

yarn

bun

```
npx ai-elements@latest
```

Now, install the AI SDK dependencies:

npm

pnpm

yarn

bun

```
npm i ai @ai-sdk/react zod
```

In order to use the providers, let's configure an AI Gateway API key. Create a `.env.local` in your root directory and navigate [here](https://vercel.com/d?to=%2F%5Bteam%5D%2F%7E%2Fai%2Fapi-keys&title=Get%20your%20AI%20Gateway%20key) to create a token, then paste it in your `.env.local`.

We're now ready to start building our app!

### [Client](https://elements.ai-sdk.dev/examples/chatbot\#client)

In your `app/page.tsx`, replace the code with the file below.

Here, we use the `PromptInput` component with its compound components to build a rich input experience with file attachments, model picker, and action menu. The input component uses the new `PromptInputMessage` type for handling both text and file attachments.

The whole chat lives in a `Conversation`. We switch on `message.parts` and render the respective part within `Message`, `Reasoning`, and `Sources`. We also use `status` from `useChat` to stream reasoning tokens, as well as render `Loader`.

chatbot.tsx

```
"use client";

import {
  Attachment,
  AttachmentPreview,
  AttachmentRemove,
  Attachments,
} from "@/components/ai-elements/attachments";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import {
  Message,
  MessageBranch,
  MessageBranchContent,
  MessageBranchNext,
  MessageBranchPage,
  MessageBranchPrevious,
  MessageBranchSelector,
  MessageContent,
  MessageResponse,
} from "@/components/ai-elements/message";
import {
  ModelSelector,
  ModelSelectorContent,
  ModelSelectorEmpty,
  ModelSelectorGroup,
  ModelSelectorInput,
  ModelSelectorItem,
  ModelSelectorList,
  ModelSelectorLogo,
  ModelSelectorLogoGroup,
  ModelSelectorName,
  ModelSelectorTrigger,
} from "@/components/ai-elements/model-selector";
import type { PromptInputMessage } from "@/components/ai-elements/prompt-input";
import {
  PromptInput,
  PromptInputActionAddAttachments,
  PromptInputActionMenu,
  PromptInputActionMenuContent,
  PromptInputActionMenuTrigger,
  PromptInputBody,
  PromptInputButton,
  PromptInputFooter,
  PromptInputHeader,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
  usePromptInputAttachments,
} from "@/components/ai-elements/prompt-input";
import {
  Reasoning,
  ReasoningContent,
  ReasoningTrigger,
} from "@/components/ai-elements/reasoning";
import {
  Source,
  Sources,
  SourcesContent,
  SourcesTrigger,
} from "@/components/ai-elements/sources";
import { SpeechInput } from "@/components/ai-elements/speech-input";
import { Suggestion, Suggestions } from "@/components/ai-elements/suggestion";
import type { ToolUIPart } from "ai";
import { CheckIcon, GlobeIcon } from "lucide-react";
import { nanoid } from "nanoid";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";

interface MessageType {
  key: string;
  from: "user" | "assistant";
  sources?: { href: string; title: string }[];
  versions: {
    id: string;
    content: string;
  }[];
  reasoning?: {
    content: string;
    duration: number;
  };
  tools?: {
    name: string;
    description: string;
    status: ToolUIPart["state"];
    parameters: Record<string, unknown>;
    result: string | undefined;
    error: string | undefined;
  }[];
}

const initialMessages: MessageType[] = [\
  {\
    from: "user",\
    key: nanoid(),\
    versions: [\
      {\
        content: "Can you explain how to use React hooks effectively?",\
        id: nanoid(),\
      },\
    ],\
  },\
  {\
    from: "assistant",\
    key: nanoid(),\
    sources: [\
      {\
        href: "https://react.dev/reference/react",\
        title: "React Documentation",\
      },\
      {\
        href: "https://react.dev/reference/react-dom",\
        title: "React DOM Documentation",\
      },\
    ],\
    tools: [\
      {\
        description: "Searching React documentation",\
        error: undefined,\
        name: "mcp",\
        parameters: {\
          query: "React hooks best practices",\
          source: "react.dev",\
        },\
        result: `{\
  "query": "React hooks best practices",\
  "results": [\
    {\
      "title": "Rules of Hooks",\
      "url": "https://react.dev/warnings/invalid-hook-call-warning",\
      "snippet": "Hooks must be called at the top level of your React function components or custom hooks. Don't call hooks inside loops, conditions, or nested functions."\
    },\
    {\
      "title": "useState Hook",\
      "url": "https://react.dev/reference/react/useState",\
      "snippet": "useState is a React Hook that lets you add state to your function components. It returns an array with two values: the current state and a function to update it."\
    },\
    {\
      "title": "useEffect Hook",\
      "url": "https://react.dev/reference/react/useEffect",\
      "snippet": "useEffect lets you synchronize a component with external systems. It runs after render and can be used to perform side effects like data fetching."\
    }\
  ]\
}`,\
        status: "input-available",\
      },\
    ],\
    versions: [\
      {\
        content: `# React Hooks Best Practices\
\
React hooks are a powerful feature that let you use state and other React features without writing classes. Here are some tips for using them effectively:\
\
## Rules of Hooks\
\
1. **Only call hooks at the top level** of your component or custom hooks\
2. **Don't call hooks inside loops, conditions, or nested functions**\
\
## Common Hooks\
\
- **useState**: For local component state\
- **useEffect**: For side effects like data fetching\
- **useContext**: For consuming context\
- **useReducer**: For complex state logic\
- **useCallback**: For memoizing functions\
- **useMemo**: For memoizing values\
\
## Example of useState and useEffect\
\
\`\`\`jsx\
function ProfilePage({ userId }) {\
  const [user, setUser] = useState(null);\
\
  useEffect(() => {\
    // This runs after render and when userId changes\
    fetchUser(userId).then(userData => {\
      setUser(userData);\
    });\
  }, [userId]);\
\
  return user ? <Profile user={user} /> : <Loading />;\
}\
\`\`\`\
\
Would you like me to explain any specific hook in more detail?`,\
        id: nanoid(),\
      },\
    ],\
  },\
  {\
    from: "user",\
    key: nanoid(),\
    versions: [\
      {\
        content:\
          "Yes, could you explain useCallback and useMemo in more detail? When should I use one over the other?",\
        id: nanoid(),\
      },\
      {\
        content:\
          "I'm particularly interested in understanding the performance implications of useCallback and useMemo. Could you break down when each is most appropriate?",\
        id: nanoid(),\
      },\
      {\
        content:\
          "Thanks for the overview! Could you dive deeper into the specific use cases where useCallback and useMemo make the biggest difference in React applications?",\
        id: nanoid(),\
      },\
    ],\
  },\
  {\
    from: "assistant",\
    key: nanoid(),\
    reasoning: {\
      content: `The user is asking for a detailed explanation of useCallback and useMemo. I should provide a clear and concise explanation of each hook's purpose and how they differ.\
\
The useCallback hook is used to memoize functions to prevent unnecessary re-renders of child components that receive functions as props.\
\
The useMemo hook is used to memoize values to avoid expensive recalculations on every render.\
\
Both hooks help with performance optimization, but they serve different purposes.`,\
      duration: 10,\
    },\
    versions: [\
      {\
        content: `## useCallback vs useMemo\
\
Both hooks help with performance optimization, but they serve different purposes:\
\
### useCallback\
\
\`useCallback\` memoizes **functions** to prevent unnecessary re-renders of child components that receive functions as props.\
\
\`\`\`jsx\
// Without useCallback - a new function is created on every render\
const handleClick = () => {\
  console.log(count);\
};\
\
// With useCallback - the function is only recreated when dependencies change\
const handleClick = useCallback(() => {\
  console.log(count);\
}, [count]);\
\`\`\`\
\
### useMemo\
\
\`useMemo\` memoizes **values** to avoid expensive recalculations on every render.\
\
\`\`\`jsx\
// Without useMemo - expensive calculation runs on every render\
const sortedList = expensiveSort(items);\
\
// With useMemo - calculation only runs when items change\
const sortedList = useMemo(() => expensiveSort(items), [items]);\
\`\`\`\
\
### When to use which?\
\
- Use **useCallback** when:\
  - Passing callbacks to optimized child components that rely on reference equality\
  - Working with event handlers that you pass to child components\
\
- Use **useMemo** when:\
  - You have computationally expensive calculations\
  - You want to avoid recreating objects that are used as dependencies for other hooks\
\
### Performance Note\
\
Don't overuse these hooks! They come with their own overhead. Only use them when you have identified a genuine performance issue.`,\
        id: nanoid(),\
      },\
    ],\
  },\
];

const models = [\
  {\
    chef: "OpenAI",\
    chefSlug: "openai",\
    id: "gpt-4o",\
    name: "GPT-4o",\
    providers: ["openai", "azure"],\
  },\
  {\
    chef: "OpenAI",\
    chefSlug: "openai",\
    id: "gpt-4o-mini",\
    name: "GPT-4o Mini",\
    providers: ["openai", "azure"],\
  },\
  {\
    chef: "Anthropic",\
    chefSlug: "anthropic",\
    id: "claude-opus-4-20250514",\
    name: "Claude 4 Opus",\
    providers: ["anthropic", "azure", "google", "amazon-bedrock"],\
  },\
  {\
    chef: "Anthropic",\
    chefSlug: "anthropic",\
    id: "claude-sonnet-4-20250514",\
    name: "Claude 4 Sonnet",\
    providers: ["anthropic", "azure", "google", "amazon-bedrock"],\
  },\
  {\
    chef: "Google",\
    chefSlug: "google",\
    id: "gemini-2.0-flash-exp",\
    name: "Gemini 2.0 Flash",\
    providers: ["google"],\
  },\
];

const suggestions = [\
  "What are the latest trends in AI?",\
  "How does machine learning work?",\
  "Explain quantum computing",\
  "Best practices for React development",\
  "Tell me about TypeScript benefits",\
  "How to optimize database queries?",\
  "What is the difference between SQL and NoSQL?",\
  "Explain cloud computing basics",\
];

const mockResponses = [\
  "That's a great question! Let me help you understand this concept better. The key thing to remember is that proper implementation requires careful consideration of the underlying principles and best practices in the field.",\
  "I'd be happy to explain this topic in detail. From my understanding, there are several important factors to consider when approaching this problem. Let me break it down step by step for you.",\
  "This is an interesting topic that comes up frequently. The solution typically involves understanding the core concepts and applying them in the right context. Here's what I recommend...",\
  "Great choice of topic! This is something that many developers encounter. The approach I'd suggest is to start with the fundamentals and then build up to more complex scenarios.",\
  "That's definitely worth exploring. From what I can see, the best way to handle this is to consider both the theoretical aspects and practical implementation details.",\
];

const delay = (ms: number): Promise<void> =>
  // eslint-disable-next-line promise/avoid-new -- setTimeout requires a new Promise
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

const chefs = ["OpenAI", "Anthropic", "Google"];

const AttachmentItem = ({
  attachment,
  onRemove,
}: {
  attachment: { id: string; name: string; type: string; url: string };
  onRemove: (id: string) => void;
}) => {
  const handleRemove = useCallback(() => {
    onRemove(attachment.id);
  }, [onRemove, attachment.id]);

  return (
    <Attachment data={attachment} onRemove={handleRemove}>
      <AttachmentPreview />
      <AttachmentRemove />
    </Attachment>
  );
};

const PromptInputAttachmentsDisplay = () => {
  const attachments = usePromptInputAttachments();

  const handleRemove = useCallback(
    (id: string) => {
      attachments.remove(id);
    },
    [attachments]
  );

  if (attachments.files.length === 0) {
    return null;
  }

  return (
    <Attachments variant="inline">
      {attachments.files.map((attachment) => (
        <AttachmentItem
          attachment={attachment}
          key={attachment.id}
          onRemove={handleRemove}
        />
      ))}
    </Attachments>
  );
};

const SuggestionItem = ({
  suggestion,
  onClick,
}: {
  suggestion: string;
  onClick: (suggestion: string) => void;
}) => {
  const handleClick = useCallback(() => {
    onClick(suggestion);
  }, [onClick, suggestion]);

  return <Suggestion onClick={handleClick} suggestion={suggestion} />;
};

const ModelItem = ({
  m,
  isSelected,
  onSelect,
}: {
  m: (typeof models)[0];
  isSelected: boolean;
  onSelect: (id: string) => void;
}) => {
  const handleSelect = useCallback(() => {
    onSelect(m.id);
  }, [onSelect, m.id]);

  return (
    <ModelSelectorItem onSelect={handleSelect} value={m.id}>
      <ModelSelectorLogo provider={m.chefSlug} />
      <ModelSelectorName>{m.name}</ModelSelectorName>
      <ModelSelectorLogoGroup>
        {m.providers.map((provider) => (
          <ModelSelectorLogo key={provider} provider={provider} />
        ))}
      </ModelSelectorLogoGroup>
      {isSelected ? (
        <CheckIcon className="ml-auto size-4" />
      ) : (
        <div className="ml-auto size-4" />
      )}
    </ModelSelectorItem>
  );
};

const Example = () => {
  const [model, setModel] = useState<string>(models[0].id);
  const [modelSelectorOpen, setModelSelectorOpen] = useState(false);
  const [text, setText] = useState<string>("");
  const [useWebSearch, setUseWebSearch] = useState<boolean>(false);
  const [status, setStatus] = useState<
    "submitted" | "streaming" | "ready" | "error"
  >("ready");
  const [messages, setMessages] = useState<MessageType[]>(initialMessages);
  const [, setStreamingMessageId] = useState<string | null>(null);

  const selectedModelData = useMemo(
    () => models.find((m) => m.id === model),
    [model]
  );

  const updateMessageContent = useCallback(
    (messageId: string, newContent: string) => {
      setMessages((prev) =>
        prev.map((msg) => {
          if (msg.versions.some((v) => v.id === messageId)) {
            return {
              ...msg,
              versions: msg.versions.map((v) =>
                v.id === messageId ? { ...v, content: newContent } : v
              ),
            };
          }
          return msg;
        })
      );
    },
    []
  );

  const streamResponse = useCallback(
    async (messageId: string, content: string) => {
      setStatus("streaming");
      setStreamingMessageId(messageId);

      const words = content.split(" ");
      let currentContent = "";

      for (const [i, word] of words.entries()) {
        currentContent += (i > 0 ? " " : "") + word;
        updateMessageContent(messageId, currentContent);
        await delay(Math.random() * 100 + 50);
      }

      setStatus("ready");
      setStreamingMessageId(null);
    },
    [updateMessageContent]
  );

  const addUserMessage = useCallback(
    (content: string) => {
      const userMessage: MessageType = {
        from: "user",
        key: `user-${Date.now()}`,
        versions: [\
          {\
            content,\
            id: `user-${Date.now()}`,\
          },\
        ],
      };

      setMessages((prev) => [...prev, userMessage]);

      setTimeout(() => {
        const assistantMessageId = `assistant-${Date.now()}`;
        const randomResponse =
          mockResponses[Math.floor(Math.random() * mockResponses.length)];

        const assistantMessage: MessageType = {
          from: "assistant",
          key: `assistant-${Date.now()}`,
          versions: [\
            {\
              content: "",\
              id: assistantMessageId,\
            },\
          ],
        };

        setMessages((prev) => [...prev, assistantMessage]);
        streamResponse(assistantMessageId, randomResponse);
      }, 500);
    },
    [streamResponse]
  );

  const handleSubmit = useCallback(
    (message: PromptInputMessage) => {
      const hasText = Boolean(message.text);
      const hasAttachments = Boolean(message.files?.length);

      if (!(hasText || hasAttachments)) {
        return;
      }

      setStatus("submitted");

      if (message.files?.length) {
        toast.success("Files attached", {
          description: `${message.files.length} file(s) attached to message`,
        });
      }

      addUserMessage(message.text || "Sent with attachments");
      setText("");
    },
    [addUserMessage]
  );

  const handleSuggestionClick = useCallback(
    (suggestion: string) => {
      setStatus("submitted");
      addUserMessage(suggestion);
    },
    [addUserMessage]
  );

  const handleTranscriptionChange = useCallback((transcript: string) => {
    setText((prev) => (prev ? `${prev} ${transcript}` : transcript));
  }, []);

  const handleTextChange = useCallback(
    (event: React.ChangeEvent<HTMLTextAreaElement>) => {
      setText(event.target.value);
    },
    []
  );

  const toggleWebSearch = useCallback(() => {
    setUseWebSearch((prev) => !prev);
  }, []);

  const handleModelSelect = useCallback((modelId: string) => {
    setModel(modelId);
    setModelSelectorOpen(false);
  }, []);

  const isSubmitDisabled = useMemo(
    () => !(text.trim() || status) || status === "streaming",
    [text, status]
  );

  return (
    <div className="relative flex size-full flex-col divide-y overflow-hidden">
      <Conversation>
        <ConversationContent>
          {messages.map(({ versions, ...message }) => (
            <MessageBranch defaultBranch={0} key={message.key}>
              <MessageBranchContent>
                {versions.map((version) => (
                  <Message
                    from={message.from}
                    key={`${message.key}-${version.id}`}
                  >
                    <div>
                      {message.sources?.length && (
                        <Sources>
                          <SourcesTrigger count={message.sources.length} />
                          <SourcesContent>
                            {message.sources.map((source) => (
                              <Source
                                href={source.href}
                                key={source.href}
                                title={source.title}
                              />
                            ))}
                          </SourcesContent>
                        </Sources>
                      )}
                      {message.reasoning && (
                        <Reasoning duration={message.reasoning.duration}>
                          <ReasoningTrigger />
                          <ReasoningContent>
                            {message.reasoning.content}
                          </ReasoningContent>
                        </Reasoning>
                      )}
                      <MessageContent>
                        <MessageResponse>{version.content}</MessageResponse>
                      </MessageContent>
                    </div>
                  </Message>
                ))}
              </MessageBranchContent>
              {versions.length > 1 && (
                <MessageBranchSelector>
                  <MessageBranchPrevious />
                  <MessageBranchPage />
                  <MessageBranchNext />
                </MessageBranchSelector>
              )}
            </MessageBranch>
          ))}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>
      <div className="grid shrink-0 gap-4 pt-4">
        <Suggestions className="px-4">
          {suggestions.map((suggestion) => (
            <SuggestionItem
              key={suggestion}
              onClick={handleSuggestionClick}
              suggestion={suggestion}
            />
          ))}
        </Suggestions>
        <div className="w-full px-4 pb-4">
          <PromptInput globalDrop multiple onSubmit={handleSubmit}>
            <PromptInputHeader>
              <PromptInputAttachmentsDisplay />
            </PromptInputHeader>
            <PromptInputBody>
              <PromptInputTextarea onChange={handleTextChange} value={text} />
            </PromptInputBody>
            <PromptInputFooter>
              <PromptInputTools>
                <PromptInputActionMenu>
                  <PromptInputActionMenuTrigger />
                  <PromptInputActionMenuContent>
                    <PromptInputActionAddAttachments />
                  </PromptInputActionMenuContent>
                </PromptInputActionMenu>
                <SpeechInput
                  className="shrink-0"
                  onTranscriptionChange={handleTranscriptionChange}
                  size="icon-sm"
                  variant="ghost"
                />
                <PromptInputButton
                  onClick={toggleWebSearch}
                  variant={useWebSearch ? "default" : "ghost"}
                >
                  <GlobeIcon size={16} />
                  <span>Search</span>
                </PromptInputButton>
                <ModelSelector
                  onOpenChange={setModelSelectorOpen}
                  open={modelSelectorOpen}
                >
                  <ModelSelectorTrigger asChild>
                    <PromptInputButton>
                      {selectedModelData?.chefSlug && (
                        <ModelSelectorLogo
                          provider={selectedModelData.chefSlug}
                        />
                      )}
                      {selectedModelData?.name && (
                        <ModelSelectorName>
                          {selectedModelData.name}
                        </ModelSelectorName>
                      )}
                    </PromptInputButton>
                  </ModelSelectorTrigger>
                  <ModelSelectorContent>
                    <ModelSelectorInput placeholder="Search models..." />
                    <ModelSelectorList>
                      <ModelSelectorEmpty>No models found.</ModelSelectorEmpty>
                      {chefs.map((chef) => (
                        <ModelSelectorGroup heading={chef} key={chef}>
                          {models
                            .filter((m) => m.chef === chef)
                            .map((m) => (
                              <ModelItem
                                isSelected={model === m.id}
                                key={m.id}
                                m={m}
                                onSelect={handleModelSelect}
                              />
                            ))}
                        </ModelSelectorGroup>
                      ))}
                    </ModelSelectorList>
                  </ModelSelectorContent>
                </ModelSelector>
              </PromptInputTools>
              <PromptInputSubmit disabled={isSubmitDisabled} status={status} />
            </PromptInputFooter>
          </PromptInput>
        </div>
      </div>
    </div>
  );
};

export default Example;
```

Install Sonner for the toast notification used in `app/page.tsx`:

npm

pnpm

yarn

bun

```
npm i sonner
```

Add `<Toaster />` from `sonner` to your `app/layout.tsx` so toast notifications are visible.

### [Server](https://elements.ai-sdk.dev/examples/chatbot\#server)

Create a new route handler `app/api/chat/route.ts` and paste in the following code. We're using `perplexity/sonar` for web search because by default the model returns search results. We also pass `sendSources` and `sendReasoning` to `toUIMessageStreamResponse` in order to receive as parts on the frontend. The handler now also accepts file attachments from the client.

app/api/chat/route.ts

```
import { streamText, UIMessage, convertToModelMessages } from "ai";

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

export async function POST(req: Request) {
  const {
    messages,
    model,
    webSearch,
  }: {
    messages: UIMessage[];
    model: string;
    webSearch: boolean;
  } = await req.json();

  const result = streamText({
    model: webSearch ? "perplexity/sonar" : model,
    messages: await convertToModelMessages(messages),
    system:
      "You are a helpful assistant that can answer questions and help with tasks",
  });

  // send sources and reasoning back to the client
  return result.toUIMessageStreamResponse({
    sendSources: true,
    sendReasoning: true,
  });
}
```

You now have a working chatbot app with file attachment support! The chatbot can handle both text and file inputs through the action menu. Feel free to explore other components like [`Tool`](https://elements.ai-sdk.dev/components/tool) or [`Task`](https://elements.ai-sdk.dev/components/task) to extend your app, or view the other examples.

[IDE\\
\\
An example of how to use the AI Elements to build an AI-powered IDE with file navigation, code display, terminal output, and an integrated chat assistant.](https://elements.ai-sdk.dev/examples/ide)

Vercel

Copyright Vercel 2026. All rights reserved.

Select language [GitHub](https://github.com/vercel/ai-elements)

## Chat

What is AI Elements?What can I build with AI Elements?How do I install AI Elements?How do I use AI Elements?

Tip: You can open and close chat with `⌘I`

0 / 1000
