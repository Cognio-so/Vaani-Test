import { motion } from 'framer-motion'
import MessageInput from './MessageInput'
import Sidebar from './Sidebar'
import ChatHistory from './ChatHistory'
import Settings from './Settings'
import axios from 'axios'
import React, { useState, useEffect, useRef, useContext, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'
import { ThemeContext } from '../App'
import MessageContent, { sanitizeContent } from './MessageContentDisplay'
import ModernAudioPlayer from './ModernAudioPlayer' // Assuming you might use this later
import { MediaGenerationIndicator, MediaLoadingAnimation } from './MediaComponents'

const API_URL = import.meta.env.VITE_API_URL
const backend_url = import.meta.env.VITE_BACKEND_URL

const ChatContainer = () => {
  const [isHistoryOpen, setIsHistoryOpen] = useState(false)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [isSidebarVisible, setIsSidebarVisible] = useState(true)
  const [messages, setMessages] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [threadId, setThreadId] = useState(null)
  const messagesEndRef = useRef(null)
  const [agentStatus, setAgentStatus] = useState("")
  const [isGeneratingMedia, setIsGeneratingMedia] = useState(false)
  const [generatingMediaType, setGeneratingMediaType] = useState(null)
  const [mediaType, setMediaType] = useState(null)
  const { user } = useAuth()
  const [chatTitle, setChatTitle] = useState("New Chat")
  const [conversations, setConversations] = useState([])
  const { theme } = useContext(ThemeContext)
  const [isLoadingChat, setIsLoadingChat] = useState(false)

  const chatIdRef = useRef(`temp_${Date.now()}`)
  const saveInProgress = useRef(false)
  const [model, setModel] = useState("gemini-1.5-flash") // Default model
  const [useAgent, setUseAgent] = useState(false);
  const [deepResearch, setDeepResearch] = useState(false);
  const chatLastUpdatedRef = useRef(null);

  const scrollToBottom = useCallback(() => {
    if (scrollToBottom.isScrolling) return;
    scrollToBottom.isScrolling = true;
    setTimeout(() => {
      requestAnimationFrame(() => {
        messagesEndRef.current?.scrollIntoView({
          behavior: 'smooth',
          block: 'end',
        });
        setTimeout(() => {
          if (messagesEndRef.current) {
            const container = messagesEndRef.current.parentElement;
            if (container) {
              container.scrollTop = container.scrollHeight;
            }
            scrollToBottom.isScrolling = false;
          }
        }, 100);
      });
    }, 10);
  }, []);

  useEffect(() => {
    const lastMessage = messages[messages.length - 1];
    if (lastMessage) {
      const delay = lastMessage.role === 'user' ? 10 : 50;
      const scrollTimer = setTimeout(scrollToBottom, delay);
      return () => clearTimeout(scrollTimer);
    }
  }, [messages, scrollToBottom]);

  useEffect(() => {
    let scrollTimer;
    if (isLoading && messages.some(msg => msg.isTemporary)) {
      scrollTimer = setTimeout(scrollToBottom, 300);
    }
    return () => clearTimeout(scrollTimer);
  }, [isLoading, messages, scrollToBottom]);

  const toggleSidebar = () => {
    setIsSidebarVisible(!isSidebarVisible)
  }

  const predefinedPrompts = [
    {
      id: 1,
      title: "General Assistant",
      prompt: "Hi! I'd love to learn more about what you can help me with. What are your capabilities?"
    },
    {
      id: 2,
      title: "Writing Help",
      prompt: "Can you help me improve my writing skills? I'd like some tips and guidance."
    },
    {
      id: 3,
      title: "Code Assistant",
      prompt: "I need help with programming. Can you explain how you can assist with coding?"
    }
  ];

  const handlePromptClick = (promptItem) => {
    const userMessage = {
      role: 'user',
      content: promptItem.prompt
    }
    // Directly send the message, which will update state and trigger effects
    handleSendMessage(userMessage, { model: model, use_agent: useAgent, deep_research: deepResearch });
  }

  const handleReactAgentStreamingRequest = async (message, options = {}) => {
    if (message.role === 'user') {
      setIsLoading(true);
      setAgentStatus("Initializing research agent...");

      const controller = new AbortController();
      const signal = controller.signal;

      try {
        const response = await fetch(`${API_URL}/api/react-search-streaming`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            // Include authorization if needed
            // 'Authorization': `Bearer ${user?.token}`
          },
          body: JSON.stringify({
            messages: [...messages, message], // Send current history + new message
            model: options.model,
            thread_id: threadId,
            file_url: options.file_url,
            max_search_results: options.deep_research ? 5 : 3
          }),
          signal
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`API error (${response.status}): ${errorText}`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        const tempMessageId = `temp_${Date.now()}`;
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: '',
          isTemporary: true,
          isLoading: true, // Add loading flag to temp message
          id: tempMessageId
        }]);

        let buffer = '';
        let finalMessageContent = ''; // Store the complete message

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          buffer += chunk;

          let lastNewlineIndex = 0;
          let newlineIndex;

          while ((newlineIndex = buffer.indexOf('\n', lastNewlineIndex)) !== -1) {
            const line = buffer.substring(lastNewlineIndex, newlineIndex).trim();
            lastNewlineIndex = newlineIndex + 1;

            if (!line) continue;

            try {
              const data = JSON.parse(line);

              if (data.type === 'status') {
                setAgentStatus(data.status);
                 setMessages(prev => prev.map(msg =>
                    msg.id === tempMessageId ? { ...msg, agentStatus: data.status } : msg
                 ));
              }
              else if (data.type === 'result') {
                // This block receives the final result in react-search-streaming
                finalMessageContent = data.message?.content || '';
                const finalThreadId = data.thread_id;

                // Update the temporary message with the final content
                setMessages(prev => {
                  const updatedMessages = prev.map(msg =>
                    msg.id === tempMessageId ? { ...data.message, isTemporary: false, isLoading: false } : msg
                  );
                  // Ensure saveChat gets the final messages array
                   saveChat(updatedMessages, finalThreadId);
                  return updatedMessages;
                });

                 if (!threadId && finalThreadId) {
                   setThreadId(finalThreadId);
                   chatIdRef.current = finalThreadId;
                 }

                 // No need to add again, already updated the temp message
              }
            } catch (parseError) {
              console.error("Error parsing stream data (react-agent):", parseError, "Line:", line);
              // Handle partial JSON or malformed data if necessary
            }
          }
          buffer = buffer.substring(lastNewlineIndex);
        }

         // If loop finishes without a 'result' type (e.g., error or stream cut short)
         if (finalMessageContent === '') {
             setMessages(prev => prev.map(msg =>
                 msg.id === tempMessageId ? { ...msg, content: 'Agent finished without final result.', isTemporary: false, isLoading: false } : msg
             ));
         }


      } catch (error) {
        console.error("Error with streaming react-agent:", error);
         // Remove temporary message and add error message
        setMessages(prev => prev.filter(msg => !msg.isTemporary));
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: `Sorry, I encountered an error: ${error.message}. Please try again.`
        }]);
      } finally {
        setIsLoading(false);
        setAgentStatus("");
      }
    }
  };


  const handleChatStreamingRequest = async (message, options = {}) => {
      if (message.role === 'user') {
          setIsLoading(true);
          setAgentStatus(""); // Clear previous agent status

          const messageText = message.content.toLowerCase();
          let localIsGeneratingMedia = false;
          let localGeneratingMediaType = null;
          let localMediaType = null;

          // Determine if it's a media request locally within this function scope
          const songTerms = ['song', 'music', 'audio', 'tune', 'melody', 'compose'];
          const audioVerbs = ['generate', 'create', 'make', 'compose', 'play'];
          const isAudioRequest =
              songTerms.some(term => messageText.includes(term)) &&
              (audioVerbs.some(verb => messageText.includes(verb)) || messageText.startsWith('play') || messageText.startsWith('sing'));

          const isImageRequest = !isAudioRequest && (
              (messageText.includes('image') || messageText.includes('picture') || messageText.includes('photo') || messageText.includes('drawing')) &&
              (messageText.includes('generate') || messageText.includes('create') || messageText.includes('draw') || messageText.includes('make'))
          );

          if (isAudioRequest || isImageRequest) {
              localIsGeneratingMedia = true;
              localGeneratingMediaType = isAudioRequest ? 'audio' : 'image';
              localMediaType = isAudioRequest ? 'music' : 'image';
              // Update global state immediately for UI feedback
              setIsGeneratingMedia(true);
              setGeneratingMediaType(localGeneratingMediaType);
              setMediaType(localMediaType);
          }


          const tempMessageId = `temp_${Date.now()}`;
          // Add temporary message immediately *unless* it's a media request where the loading animation will show
          if (!localIsGeneratingMedia) {
              setMessages(prev => [...prev, {
                  role: 'assistant',
                  content: '',
                  isTemporary: true,
                  isLoading: true,
                  id: tempMessageId
              }]);
          }

          try {
              console.log("Making streaming request with options:", {
                  model: options.model,
                  thread_id: threadId,
                  use_agent: options.use_agent || false, // Ensure use_agent is passed correctly
                  deep_research: options.deep_research || false,
                  stream: true,
                  isMediaRequest: localIsGeneratingMedia,
                  generatingMediaType: localGeneratingMediaType
              });

              const response = await fetch(`${API_URL}/api/chat`, {
                  method: 'POST',
                  headers: {
                      'Content-Type': 'application/json',
                      // Include authorization if needed
                      // 'Authorization': `Bearer ${user?.token}`
                  },
                  body: JSON.stringify({
                      messages: [...messages, message],
                      model: options.model,
                      thread_id: threadId,
                      file_url: options.file_url,
                      use_agent: options.use_agent || false, // Pass use_agent
                      deep_research: options.deep_research || false, // Pass deep_research
                      stream: true
                  })
              });

              if (!response.ok) {
                  const errorText = await response.text();
                  console.error(`API error (${response.status}):`, errorText);
                  throw new Error(`API returned ${response.status}: ${errorText}`);
              }

              const reader = response.body.getReader();
              const decoder = new TextDecoder();

              let fullResponse = "";
              let finalThreadId = threadId; // Keep track of thread_id from response

              while (true) {
                  const { done, value } = await reader.read();
                  if (done) break;

                  const chunk = decoder.decode(value);
                  const lines = chunk.split('\n').filter(line => line.trim());

                  for (const line of lines) {
                      if (!line.trim()) continue;

                      try {
                          const data = JSON.parse(line);

                          if (data.type === "status") {
                              setAgentStatus(data.status);
                              // Optionally update temp message with status
                              if (!localIsGeneratingMedia) {
                                  setMessages(prev => prev.map(msg =>
                                      msg.id === tempMessageId ? { ...msg, agentStatus: data.status } : msg
                                  ));
                              }
                          }
                          else if (data.type === "chunk") {
                             fullResponse += data.chunk;
                             if (!localIsGeneratingMedia) {
                                 // Update temporary message content
                                 setMessages(prev => prev.map(msg =>
                                     msg.id === tempMessageId ? { ...msg, content: fullResponse } : msg
                                 ));
                             } else {
                                 // For media, we might still get text updates (e.g., "Generating image...")
                                 // Decide if you want to show this text or just the animation
                                 // Option 1: Show text alongside animation (add a new message or update a placeholder)
                                 // Option 2: Ignore text chunks during media generation
                                 console.log("Media generation text chunk:", data.chunk); // Log for now
                             }

                          }
                          else if (data.type === "done" || data.type === "result") { // Handle both legacy "done" and potential "result" for final message
                             finalThreadId = data.thread_id || finalThreadId; // Update thread_id if present
                             const finalContent = data.message?.content || fullResponse; // Use message content if available, otherwise accumulated chunks


                              // Check if the final content contains media URLs
                             const containsImageUrl = /\.jpe?g|\.png|\.gif|\.webp|replicate\.delivery|image-url|!\[.*?\]\(https?:\/\/\S+\)/i.test(finalContent);
                             const containsMusicUrl = /\.mp3|\.wav|\.ogg|musicfy\.lol|audio-url/i.test(finalContent);
                             const isMediaResponse = containsImageUrl || containsMusicUrl;


                             if (localIsGeneratingMedia && isMediaResponse) {
                                // If it was a media request AND the response confirms media, add the final message
                                const finalMessage = {
                                     ...(data.message || { role: 'assistant', content: finalContent }), // Use structured message or create one
                                     isTemporary: false,
                                     isLoading: false
                                 };
                                setMessages(prev => [...prev, finalMessage]); // Add the media message
                                saveChat([...messages, message, finalMessage], finalThreadId); // Save including the new message

                             } else if (!localIsGeneratingMedia) {
                                 // If it wasn't a media request, update the temporary message to be permanent
                                 setMessages(prev => {
                                     const updatedMessages = prev.map(msg =>
                                         msg.id === tempMessageId ? {
                                             ...msg,
                                             content: finalContent, // Use final content
                                             isTemporary: false,
                                             isLoading: false,
                                             agentStatus: undefined // Clear agent status display
                                         } : msg
                                     );
                                     saveChat(updatedMessages, finalThreadId); // Save the updated state
                                     return updatedMessages;
                                 });
                             } else {
                                // It was a media request, but the response wasn't media (e.g., "I can't create images yet")
                                // Add the text response as a new message
                                 const textResponseMessage = {
                                     role: 'assistant',
                                     content: finalContent,
                                     isTemporary: false,
                                     isLoading: false
                                 };
                                 setMessages(prev => [...prev, textResponseMessage]);
                                 saveChat([...messages, message, textResponseMessage], finalThreadId);
                             }


                             // Reset loading/media states ONLY after processing the final message
                             setIsLoading(false);
                             setAgentStatus("");
                              if (!isMediaResponse) { // Only reset media state if the final response *wasn't* media
                                setIsGeneratingMedia(false);
                                setGeneratingMediaType(null);
                                setMediaType(null);
                              }


                             if (!threadId && finalThreadId) {
                                 setThreadId(finalThreadId);
                                 chatIdRef.current = finalThreadId;
                             }
                          }
                      } catch (jsonError) {
                          console.error("Error parsing stream data (chat):", jsonError, "Line:", line);
                          // Attempt to append raw line if parsing fails? Maybe not safe.
                          // If it's the last chunk and fails, handle as error or partial response.
                           if (done) {
                                // Handle potentially incomplete final chunk
                                console.warn("Stream ended with potentially incomplete JSON data:", line);
                                fullResponse += `\n[Stream parsing error on last chunk]`;
                                if (!localIsGeneratingMedia) {
                                    setMessages(prev => prev.map(msg =>
                                        msg.id === tempMessageId ? { ...msg, content: fullResponse, isTemporary: false, isLoading: false } : msg
                                    ));
                                }
                           }
                      }
                  }
              }

              // Final state updates if stream ends without 'done'/'result' message
              if (isLoading) { // Check if still loading (means 'done'/'result' wasn't received)
                 console.warn("Stream ended unexpectedly.");
                  if (!localIsGeneratingMedia) {
                      setMessages(prev => prev.map(msg =>
                          msg.id === tempMessageId ? { ...msg, content: fullResponse || "[Stream ended unexpectedly]", isTemporary: false, isLoading: false } : msg
                      ));
                  }
                  setIsLoading(false);
                  setAgentStatus("");
                  setIsGeneratingMedia(false); // Reset media state on unexpected end too
                  setGeneratingMediaType(null);
                  setMediaType(null);
              }

          } catch (error) {
              console.error("Error with streaming chat:", error);
               // Clear temporary message and add error
               setMessages(prev => prev.filter(msg => msg.id !== tempMessageId));
               setMessages(prev => [...prev, {
                  role: 'assistant',
                  content: `Sorry, an error occurred: ${error.message}`
               }]);
              setIsLoading(false);
              setAgentStatus("");
              setIsGeneratingMedia(false);
              setGeneratingMediaType(null);
              setMediaType(null);
          }
      }
  };


  const fetchChatHistory = async () => {
    if (!user) return;
    try {
      const response = await axios.get(`${backend_url}/api/chat/history/all`, {
        withCredentials: true
      });
      if (response.data.success) {
        const allChats = [
          ...response.data.categories.today,
          ...response.data.categories.yesterday,
          ...response.data.categories.lastWeek,
          ...response.data.categories.lastMonth,
          ...response.data.categories.older,
        ];
        setConversations(allChats);
      }
    } catch (error) {
      console.error("Error fetching chat history:", error);
    }
  };

  useEffect(() => {
    if (user) {
      fetchChatHistory();
    }
  }, [user]);

 const saveChat = async (messagesToSave, currentThreadId) => {
   // Use messagesToSave passed as argument, default to component state if not provided (less ideal)
   const currentMessages = messagesToSave && messagesToSave.length > 0 ? messagesToSave : messages;
   const finalThreadId = currentThreadId || threadId || chatIdRef.current; // Prioritize passed ID


   // Basic checks
   if (!user || currentMessages.length === 0 || !currentMessages.some(m => m.role === 'user') || isLoadingChat) {
     // console.log("Save conditions not met:", { user, messagesLength: currentMessages.length, hasUserMessage: currentMessages.some(m => m.role === 'user'), isLoadingChat });
     return;
   }


   // Prevent saving if the *very last* message is still temporary/loading (important for streaming)
   const lastMessage = currentMessages[currentMessages.length - 1];
   if (lastMessage?.isTemporary || lastMessage?.isLoading) {
     // console.log("Skipping save: Last message is temporary or loading.");
     return;
   }


   if (saveInProgress.current) {
     // console.log("Skipping save: Save already in progress.");
     return;
   }


   saveInProgress.current = true;
   // console.log("Attempting to save chat:", finalThreadId);


   try {
     let title = chatTitle;
     if ((title === "New Chat" || !finalThreadId || finalThreadId.startsWith('temp_')) && currentMessages.length > 0) {
       const firstUserMsg = currentMessages.find(m => m.role === 'user');
       if (firstUserMsg) {
         title = firstUserMsg.content.substring(0, 30);
         if (firstUserMsg.content.length > 30) title += "...";
         // Update local title state immediately if it's a new chat being titled
         if (chatTitle === "New Chat") setChatTitle(title);
       }
     }


     // Filter out any potentially lingering temporary messages (should be handled by streaming logic, but belt-and-suspenders)
     // Also filter messages that are only loading indicators without content
     const cleanMessages = currentMessages.filter(msg => !msg.isTemporary && !(msg.isLoading && !msg.content));


     // Check if this is just loading an existing chat vs. adding new messages
     // Preserve timestamp only matters for PUT requests
     const isExistingChat = finalThreadId && !finalThreadId.startsWith('temp_');
     const preserveTimestamp = isExistingChat && chatLastUpdatedRef.current;


     let response;
     const payload = {
       title,
       messages: JSON.parse(JSON.stringify(cleanMessages)), // Deep copy and ensure clean JSON
     };


     if (isExistingChat) {
       // console.log("Saving (Update):", finalThreadId, payload);
       response = await axios.put(`${backend_url}/api/chat/${finalThreadId}/update`, {
         ...payload,
         preserveTimestamp: !!preserveTimestamp // Ensure boolean
       }, {
         withCredentials: true
       });
     } else {
       // console.log("Saving (New):", finalThreadId, payload);
       // Include chatId even for new chats if it was generated client-side (temp_...)
       // The backend should handle replacing temp_ IDs
       response = await axios.post(`${backend_url}/api/chat/save`, {
         chatId: finalThreadId, // Send the temp ID
         ...payload
       }, {
         withCredentials: true
       });
     }


     if (response.data.success) {
        // console.log("Save successful:", response.data.chat.id);
       const savedChat = response.data.chat;
       // Update state ONLY if the ID changed (e.g., from temp_ to real ID)
       if (savedChat.id && finalThreadId !== savedChat.id) {
         setThreadId(savedChat.id);
         chatIdRef.current = savedChat.id;
          // Update messages in state to reflect the new chatId if needed (though not usually necessary)
       }
       // Update title from server response if it differs from the temp one we generated
       if (savedChat.title && savedChat.title !== chatTitle) {
          setChatTitle(savedChat.title);
       }


       chatLastUpdatedRef.current = savedChat.lastUpdated; // Store the confirmed lastUpdated time
       fetchChatHistory(); // Refresh history list
     } else {
       console.error("Error saving chat (API returned success=false):", response.data);
       // Handle specific errors from backend if provided
     }
   } catch (error) {
     console.error("Error saving chat (Network/Server Error):", error.response ? error.response.data : error.message);
     // Consider user feedback here (e.g., toast notification)
   } finally {
     saveInProgress.current = false;
   }
 };


  // Debounced save effect - triggers after messages change and conditions are met
  useEffect(() => {
      // Don't run if messages are empty or only contain non-user messages, or if loading a chat
      if (!user || messages.length === 0 || !messages.some(m => m.role === 'user') || isLoadingChat) {
          return;
      }

      // Don't save if the last message is still being streamed/processed
      const lastMessage = messages[messages.length - 1];
      if (lastMessage?.isTemporary || lastMessage?.isLoading) {
          return;
      }

      // Debounce the save operation
      const saveTimer = setTimeout(() => {
          // Pass the current messages state directly to saveChat
          saveChat(messages, threadId || chatIdRef.current);
      }, 1500); // Debounce time (e.g., 1.5 seconds)

      // Cleanup function to clear the timeout if messages change again quickly
      return () => clearTimeout(saveTimer);

      // Dependencies: messages array, user object, and potentially threadId
  }, [messages, user, threadId, isLoadingChat]); // Add isLoadingChat


  // Timeout for media generation indicator
  useEffect(() => {
    let timeoutId;
    if (isGeneratingMedia) {
      timeoutId = setTimeout(() => {
        console.log("Media generation timed out. Clearing indicator.");
        setIsGeneratingMedia(false);
        setGeneratingMediaType(null);
        setMediaType(null);
        // Maybe add a message indicating timeout?
      }, 60000); // Increased timeout (e.g., 60 seconds)
    }
    return () => clearTimeout(timeoutId);
  }, [isGeneratingMedia]);

  // This effect is primarily for clearing the media indicator *after* media has loaded.
  // The actual clearing now happens in the onMediaLoaded callback within MessageContent.
  useEffect(() => {
      if (!isGeneratingMedia && (generatingMediaType || mediaType)) {
         // If isGeneratingMedia becomes false, but types are still set,
         // clear the types after a short delay to allow UI transition.
         const clearTimer = setTimeout(() => {
             // console.log("Clearing media types post-generation.");
             setGeneratingMediaType(null);
             setMediaType(null);
         }, 500); // Delay before clearing types
         return () => clearTimeout(clearTimer);
      }
  }, [isGeneratingMedia]); // Only trigger when isGeneratingMedia changes


  const handleSendMessage = (message, options = {}) => {
    // Reset chatLastUpdatedRef before sending a new message
    // to ensure the next save doesn't preserve the old timestamp incorrectly.
    chatLastUpdatedRef.current = null;

    const userMessage = { ...message, role: 'user' }; // Ensure role is user

    // Append file URL info to message content if present
    if (options.file_url) {
      const fileUrl = options.file_url;
      const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(fileUrl);
      userMessage.content = isImage
        ? `${userMessage.content}\n\n![Uploaded Image](${fileUrl})`
        : `${userMessage.content}\n\n[Uploaded File](${fileUrl})`;
    }

    // Add user message to state immediately
    setMessages(prev => [...prev, userMessage]);

    // Determine request type and call appropriate handler
    const mergedOptions = {
       model: options.model || model, // Use passed model or default state
       use_agent: options.use_agent !== undefined ? options.use_agent : useAgent, // Use passed or default state
       deep_research: options.deep_research !== undefined ? options.deep_research : deepResearch, // Use passed or default state
       file_url: options.file_url
     };


    // Use the options provided by MessageInput (deep_research, use_agent)
    if (mergedOptions.deep_research) {
      handleReactAgentStreamingRequest(userMessage, mergedOptions);
    } else {
      // Handles both normal chat and use_agent=true (non-deep) via /api/chat
       handleChatStreamingRequest(userMessage, mergedOptions);
    }
  };


  const loadChat = async (chatIdToLoad) => {
    // console.log("Loading chat:", chatIdToLoad);
    try {
      setIsLoadingChat(true); // Set loading state for chat loading
      const response = await axios.get(`${backend_url}/api/chat/${chatIdToLoad}`, {
        withCredentials: true
      });
      if (response.data.success) {
        const chatData = response.data.chat;
        setMessages(chatData.messages || []); // Ensure messages is an array
        setChatTitle(chatData.title || "Chat");
        setThreadId(chatData.chatId); // Use chatId from response
        chatIdRef.current = chatData.chatId; // Update ref as well
        chatLastUpdatedRef.current = chatData.lastUpdated; // Store loaded timestamp

        setIsHistoryOpen(false); // Close history panel
        // Reset other states relevant to a new chat context
        setIsLoading(false);
        setAgentStatus("");
        setIsGeneratingMedia(false);
        setGeneratingMediaType(null);
        setMediaType(null);

         // Scroll to bottom after loading messages
         setTimeout(scrollToBottom, 100); // Add slight delay

      } else {
          console.error("Failed to load chat (API success=false):", response.data);
           // Handle error - maybe show a message to the user
      }
    } catch (error) {
      console.error("Error loading chat:", error.response ? error.response.data : error.message);
      // Handle network/server error
    } finally {
      setIsLoadingChat(false); // Clear loading state for chat loading
    }
  };

  const clearConversation = () => {
    setMessages([]);
    setThreadId(null);
    chatIdRef.current = `temp_${Date.now()}`; // Generate new temp ID
    setChatTitle("New Chat");
    chatLastUpdatedRef.current = null; // Clear last updated ref
    // Reset other relevant states
    setIsLoading(false);
    setAgentStatus("");
    setIsGeneratingMedia(false);
    setGeneratingMediaType(null);
    setMediaType(null);
  };

  const hasActiveConversation = messages.length > 0;

  // Callback for MessageInput to signal media request start
  const handleMediaRequested = (type) => {
    setIsGeneratingMedia(true);
    setGeneratingMediaType(type);
    setMediaType(type === 'image' ? 'image' : 'music'); // Set mediaType for animation
  };

  const updateChatTitle = async (newTitle) => {
    if (!user || !threadId || threadId.startsWith('temp_') || isLoadingChat || newTitle === chatTitle) return;

    const oldTitle = chatTitle;
    setChatTitle(newTitle); // Optimistic update

    try {
      const response = await axios.put(`${backend_url}/api/chat/${threadId}/update`, {
        title: newTitle,
        messages: messages // Send current messages to ensure consistency if needed by backend
      }, {
        withCredentials: true
      });

      if (response.data.success) {
        fetchChatHistory(); // Refresh history
        chatLastUpdatedRef.current = response.data.chat.lastUpdated; // Update timestamp
      } else {
         setChatTitle(oldTitle); // Revert on failure
         console.error("Error updating chat title (API success=false):", response.data);
      }
    } catch (error) {
      setChatTitle(oldTitle); // Revert on failure
      console.error("Error updating chat title:", error.response ? error.response.data : error.message);
    }
  };

  const handleModelChange = (newModel) => {
    setModel(newModel);
  };

  // Update useAgent and deepResearch state based on options from MessageInput
  const handleInputOptionsChange = (options) => {
    if (options.use_agent !== undefined) setUseAgent(options.use_agent);
    if (options.deep_research !== undefined) setDeepResearch(options.deep_research);
  };

   // Callback for MessageContentDisplay when media actually finishes loading
   const handleMediaLoaded = () => {
       console.log("Media loaded callback received in ChatContainer.");
       setIsGeneratingMedia(false);
       // Keep generatingMediaType/mediaType set briefly for potential transitions
       // The useEffect hook monitoring isGeneratingMedia will clear them shortly after.
   };

  return (
    <div className="flex flex-col h-screen w-full overflow-hidden">
      {/* History Panel */}
      {isHistoryOpen && (
        <div className={`fixed inset-0 z-[150] ${theme === 'dark' ? 'bg-[#1a1a1a]' : 'bg-gray-100'}`}>
          <ChatHistory
            isOpen={isHistoryOpen}
            onClose={() => setIsHistoryOpen(false)}
            conversations={conversations}
            onSelectConversation={loadChat}
            isLoading={isLoadingChat} // Pass loading state
          />
        </div>
      )}

      {/* Settings Panel */}
      {isSettingsOpen && (
        <div className={`fixed inset-0 z-[200] ${theme === 'dark' ? 'bg-[#1a1a1a]' : 'bg-gray-100'}`}>
          <Settings
            isOpen={isSettingsOpen}
            onClose={() => setIsSettingsOpen(false)}
            onClearConversation={clearConversation}
          />
        </div>
      )}

      {/* Main Layout */}
      <div className="flex h-full flex-1 overflow-hidden">
        <Sidebar
          isVisible={isSidebarVisible}
          onToggle={toggleSidebar}
          onOpenSettings={() => setIsSettingsOpen(true)}
          onOpenHistory={() => setIsHistoryOpen(true)}
          onNewChat={clearConversation}
          activeChatId={threadId} // Pass active chat ID for highlighting
        />

        {/* --- Main Chat Area --- */}
        <main className={`flex-1 flex flex-col h-full overflow-hidden transition-all duration-300 relative
          ${isSidebarVisible ? 'lg:ml-64 sm:ml-16 ml-14' : 'ml-0'}`}>

           {/* Invisible spacing container for mobile header */}
          <div className="md:hidden h-14 sm:h-16 flex-shrink-0"></div>

           {/* Centered Mobile Header - Positioned absolutely */}
          <div className="absolute top-0 left-0 right-0 h-14 sm:h-16 flex items-center justify-center md:hidden z-20 pointer-events-none">
             <div className="flex items-center pointer-events-auto">
                 <img src="/vannipro.png" alt="Vaani.pro Logo" className="h-6 sm:h-8" />
                 <h1 className="text-sm sm:text-lg font-bold ml-2 text-[#cc2b5e]">Vaani.pro</h1>
             </div>
          </div>

           {/* Floating user profile - Positioned absolutely */}
          <div className="absolute top-4 right-4 sm:right-6 z-30 flex items-center"> {/* Adjusted right padding */}
             <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full overflow-hidden border-2 border-pink-500/50"> {/* Added border */}
                 <img
                     src={user?.profilePicture || "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23cc2b5e'%3E%3Cpath d='M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z'/%3E%3C/svg%3E"}
                     alt={user?.name || "Profile"}
                     className="w-full h-full object-cover"
                     onError={(e) => {
                         e.target.onerror = null;
                         e.target.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23cc2b5e'%3E%3Cpath d='M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z'/%3E%3C/svg%3E";
                     }}
                 />
             </div>
          </div>


          {/* --- Conditional Rendering: Active Chat vs Empty State --- */}
          {hasActiveConversation ? (
              // --- Active Conversation View ---
              <div className="flex-1 flex flex-col overflow-hidden h-full pt-4 md:pt-0"> {/* Added padding-top for mobile header space */}
                  {/* Message List */}
                  <div className="flex-1 overflow-y-auto px-0 scroll-smooth min-h-0 scrollbar-hide pb-20 sm:pb-24"> {/* Adjusted padding bottom */}
                      <div className="w-full max-w-[95%] xs:max-w-[90%] sm:max-w-3xl md:max-w-3xl mx-auto pt-4"> {/* Added padding-top inside */}
                          {messages.map((msg, index) => {
                              // Sanitize user content, keep assistant content raw for markdown/html
                              const displayContent = msg.role === 'user' ? sanitizeContent(msg.content) : msg.content;
                              const isLastMessage = index === messages.length - 1;

                              return (
                                  <div
                                      key={msg.id || index} // Use message ID if available
                                      className={`mb-4 w-full flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                                  >
                                      {msg.role === 'user' ? (
                                          <div className={`${
                                              theme === 'dark'
                                                  ? 'bg-white/20 text-white backdrop-blur-sm' // Slightly less transparent
                                                  : 'bg-black/10 text-gray-900' // Adjusted light mode user bubble
                                          } rounded-2xl p-3 px-4 overflow-hidden inline-block max-w-[85%] break-words shadow-sm`} >
                                              <MessageContent content={displayContent} />
                                          </div>
                                      ) : (
                                          <div className={`${
                                              theme === 'dark' ? 'text-white' : 'text-gray-800'
                                          } rounded-xl p-0 overflow-hidden inline-block w-full max-w-full pl-1 xs:pl-2 sm:pl-0`}> {/* Reduced left padding */}
                                              <MessageContent
                                                  content={displayContent}
                                                  forceImageDisplay={true}
                                                  forceAudioDisplay={true}
                                                  // Pass callback to know when media is loaded
                                                  onMediaLoaded={isLastMessage && isGeneratingMedia ? handleMediaLoaded : undefined}
                                                  isStreaming={isLastMessage && msg.isTemporary && isLoading} // Indicate if it's the last, temporary message loading
                                              />
                                          </div>
                                      )}
                                  </div>
                              );
                          })}
                          <div ref={messagesEndRef} className="h-1" /> {/* Scroll anchor */}

                           {/* Loading Indicators Container */}
                          <div className="w-full max-w-full pl-1 xs:pl-2 sm:pl-0"> {/* Align with assistant messages */}
                             {/* --- PRIORITY 1: Media Generation Animation --- */}
                             {isGeneratingMedia && (
                                 <MediaLoadingAnimation mediaType={mediaType || generatingMediaType} />
                             )}

                             {/* --- PRIORITY 2: Agent Status (Only show if NOT generating media) --- */}
                             {!isGeneratingMedia && isLoading && agentStatus && (useAgent || deepResearch) && (
                                <div className="mb-4 flex justify-start">
                                      <div className={`rounded-lg p-2 px-3 ${theme === 'dark' ? 'bg-white/[0.08]' : 'bg-gray-100'} shadow-sm inline-block`}>
                                         <div className="flex items-center space-x-2">
                                             {/* Optional: Add a small spinner or icon */}
                                             <span className="text-xs opacity-80">{agentStatus}</span>
                                         </div>
                                      </div>
                                </div>
                             )}

                             {/* --- PRIORITY 3: Simple Loading Dots (Only show if not generating media AND no agent status) --- */}
                             {!isGeneratingMedia && isLoading && !agentStatus && !messages[messages.length - 1]?.isTemporary && (
                                  <div className="mb-4 flex justify-start">
                                      <div className='rounded-full p-2 shadow-sm inline-block'>
                                          <div className="flex items-center space-x-1">
                                             <span className={`text-xs opacity-80 ${theme === 'dark' ? 'text-white' : 'text-black'} animate-pulse`}>●</span>
                                             <span className={`text-xs opacity-80 ${theme === 'dark' ? 'text-white' : 'text-black'} animate-pulse delay-150`}>●</span>
                                             <span className={`text-xs opacity-80 ${theme === 'dark' ? 'text-white' : 'text-black'} animate-pulse delay-300`}>●</span>
                                          </div>
                                      </div>
                                  </div>
                             )}
                          </div>
                      </div>
                  </div>

                  {/* Fixed position input container for active chat */}
                   <div className={`w-full flex-shrink-0 px-3 xs:px-4 sm:px-8 py-2 pb-4 z-10 sticky bottom-0
                       ${theme === 'dark' ? 'bg-[#0A0A0A]' : 'bg-white'} border-t ${theme === 'dark' ? 'border-white/10' : 'border-gray-200'}` }
                   >
                      <MessageInput
                          onSendMessage={handleSendMessage}
                          isLoading={isLoading || isLoadingChat} // Disable input if general loading or chat loading
                          setIsLoading={setIsLoading} // Pass setter if needed inside input
                          onMediaRequested={handleMediaRequested}
                          onModelChange={handleModelChange}
                          onOptionsChange={handleInputOptionsChange}
                          selectedModel={model}
                      />
                  </div>
              </div>
          ) : (
              // --- Empty Chat State View (FIXED LAYOUT) ---
              <div className="flex-1 flex flex-col h-full relative"> {/* Use relative for potential absolute children */}
                 {/* Scrollable content area */}
                 <div className="flex-1 overflow-y-auto px-4 pt-6 pb-24 md:pb-6 flex flex-col items-center justify-center messages-container"> {/* Added pb-24 */}
                     <div className="items-center text-center w-full max-w-sm sm:max-w-xl md:max-w-2xl lg:max-w-3xl">
                         <h1 className="text-xl sm:text-3xl font-bold text-[#cc2b5e]">Welcome to Vaani.pro</h1>
                         <p className={`${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'} text-sm sm:text-xl mt-1 sm:mt-2`}> {/* Adjusted text color */}
                            How may I help you?
                         </p>

                         {/* Predefined prompts */}
                         <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 max-w-5xl mx-auto mt-6 sm:mt-8 px-2"> {/* Adjusted gap and margin */}
                             {predefinedPrompts.map((item) => (
                                 <motion.div
                                     key={item.id}
                                     className={`group relative ${
                                         theme === 'dark'
                                             ? 'bg-white/[0.05] backdrop-blur-xl border border-white/20 hover:bg-white/[0.08] shadow-[0_0_15px_rgba(204,43,94,0.2)] hover:shadow-[0_0_20px_rgba(204,43,94,0.4)]' // Adjusted shadow
                                             : 'bg-gray-100 border border-gray-200 hover:bg-gray-200 shadow-md hover:shadow-lg'
                                     } rounded-xl p-4 cursor-pointer transition-all duration-150`} // Faster transition
                                     whileHover={{
                                         scale: 1.03,
                                         transition: { duration: 0.15 }
                                     }}
                                     whileTap={{ scale: 0.98 }}
                                     onClick={() => handlePromptClick(item)}
                                 >
                                     <div className="relative z-10">
                                         <h3 className={`${theme === 'dark' ? 'text-white/90' : 'text-gray-800'} font-medium text-sm mb-1`}> {/* Reduced margin */}
                                             {item.title}
                                         </h3>
                                         <p className={`${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'} text-xs line-clamp-2`}>
                                             {item.prompt}
                                         </p>
                                     </div>
                                 </motion.div>
                             ))}
                         </div>

                         {/* Desktop message input (only shown on desktop in empty state) */}
                         <div className="hidden md:block w-full max-w-3xl mx-auto mt-8"> {/* Added margin top */}
                             <MessageInput
                                 onSendMessage={handleSendMessage}
                                 isLoading={isLoading || isLoadingChat}
                                 setIsLoading={setIsLoading}
                                 onMediaRequested={handleMediaRequested}
                                 onModelChange={handleModelChange}
                                 onOptionsChange={handleInputOptionsChange}
                                 selectedModel={model}
                             />
                         </div>
                     </div>
                 </div> {/* End scrollable content area */}

                 {/* Mobile input (FIXED position for empty state) */}
                 <div className={`md:hidden w-full px-3 xs:px-4 sm:px-8 py-2 pb-4 z-10 fixed bottom-0 right-0 border-t
                   ${theme === 'dark' ? 'bg-[#0A0A0A] border-white/10' : 'bg-white border-gray-200'}
                   ${isSidebarVisible ? 'left-14 sm:left-16' : 'left-0'} // ADJUST THESE VALUES (14, 16) TO MATCH YOUR SIDEBAR WIDTHS
                 `}>
                     <MessageInput
                         onSendMessage={handleSendMessage}
                         isLoading={isLoading || isLoadingChat}
                         setIsLoading={setIsLoading}
                         onMediaRequested={handleMediaRequested}
                         onModelChange={handleModelChange}
                         onOptionsChange={handleInputOptionsChange}
                         selectedModel={model}
                     />
                 </div>
              </div>
           )} {/* End Conditional Rendering */}
        </main>
      </div> {/* End Main Layout Flex container */}
    </div> // End Root Container
  )
}

export default ChatContainer