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
import ModernAudioPlayer from './ModernAudioPlayer'
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
  
  // Add these missing useRef declarations
  const chatIdRef = useRef(`temp_${Date.now()}`)
  const saveInProgress = useRef(false)

  // Add this state for the selected model
  const [model, setModel] = useState("gemini-1.5-flash")

  // Add these state variables
  const [useAgent, setUseAgent] = useState(false);
  const [deepResearch, setDeepResearch] = useState(false);

  // Add a ref to store the original lastUpdated timestamp
  const chatLastUpdatedRef = useRef(null);

  // Replace the existing scrollToBottom function with this improved version
  const scrollToBottom = useCallback(() => {
    if (scrollToBottom.isScrolling) return;
    
    scrollToBottom.isScrolling = true;
    
    // Small delay to ensure DOM content is rendered before scrolling
    setTimeout(() => {
      requestAnimationFrame(() => {
        messagesEndRef.current?.scrollIntoView({
          behavior: 'smooth',
          block: 'end',
        });
        
        // Add a backup scroll in case the first one doesn't complete
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

  // Replace the scrolling useEffect with this improved version
  useEffect(() => {
    // Scroll on any new message from assistant, or if user sends message
    const lastMessage = messages[messages.length - 1];
    
    // Always scroll when a new message is added
    if (lastMessage) {
      // Use a very small delay for user messages (feels responsive)
      // Use a slightly longer delay for assistant messages (ensures content is rendered)
      const delay = lastMessage.role === 'user' ? 10 : 50;
      
      const scrollTimer = setTimeout(scrollToBottom, delay);
      return () => clearTimeout(scrollTimer);
    }
  }, [messages, scrollToBottom]);

  // Add this additional effect to ensure scroll happens during streaming
  useEffect(() => {
    // If message is being updated during streaming, debounce the scroll
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
    // Add prompt as user message
    const userMessage = {
      role: 'user',
      content: promptItem.prompt
    }
    handleSendMessage(userMessage)
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
          },
          body: JSON.stringify({
            messages: [...messages, message],
            model: options.model,
            thread_id: threadId,
            file_url: options.file_url,
            max_search_results: options.deep_research ? 5 : 3
          }),
          signal
        });
        
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        
        const tempMessageId = Date.now();
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: '',
          isTemporary: true,
          id: tempMessageId
        }]);
        
        // Add buffer for accumulating partial JSON chunks
        let buffer = '';
        
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          
          const chunk = decoder.decode(value);
          buffer += chunk;
          
          // Try to extract complete JSON objects from buffer
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
              } 
              else if (data.type === 'result') {
                await new Promise(resolve => setTimeout(resolve, 500));
                setMessages(prev => {
                  const newMessages = prev.filter(msg => msg.id !== tempMessageId).concat([data.message]);
                  saveChat(newMessages);
                  return newMessages;
                });
            
                if (!threadId && data.thread_id) {
                  setThreadId(data.thread_id);
                  chatIdRef.current = data.thread_id;
                }
              }
            } catch (parseError) {
              console.error("Error parsing stream data:", parseError);
              // Just log the error and continue, don't break the stream
            }
          }
          
          // Keep any remaining incomplete data in the buffer
          buffer = buffer.substring(lastNewlineIndex);
        }
      } catch (error) {
        console.error("Error with streaming react-agent:", error);
        setMessages(prev => prev.filter(msg => !msg.isTemporary));
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: 'Sorry, I encountered an error with the research agent. Please try again.'
        }]);
      } finally {
        setIsLoading(false);
        setAgentStatus("");
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
  
  const saveChat = async (currentMessages = messages) => {
    if (!user || currentMessages.length === 0 || !currentMessages.some(m => m.role === 'user') || isLoadingChat) return;
    
    if (saveInProgress.current) {
      return;
    }
    
    // Don't save if the last message is temporary
    if (currentMessages[currentMessages.length - 1]?.isTemporary) {
      return;
    }
    
    saveInProgress.current = true;
    
    try {
      const chatId = threadId || chatIdRef.current;
      let title = chatTitle;
      if (title === "New Chat" && currentMessages.length > 0) {
        const firstUserMsg = currentMessages.find(m => m.role === 'user');
        if (firstUserMsg) {
          title = firstUserMsg.content.substring(0, 30);
          if (firstUserMsg.content.length > 30) title += "...";
        }
      }
      
      // Filter out temporary messages before saving
      const messagesToSave = currentMessages.filter(msg => !msg.isTemporary);
      
      
      // Check if this is just a chat load or an actual update with new messages
      const isJustLoading = chatLastUpdatedRef.current && 
                           !chatId.startsWith('temp_') && 
                           !chatId.startsWith('new_');
      
      // Choose the right endpoint - update for existing chats, save for new ones
      let response;
      
      if (chatId && !chatId.startsWith('temp_') && !chatId.startsWith('new_')) {
        // Use the update endpoint for existing chats
        response = await axios.put(`${backend_url}/api/chat/${chatId}/update`, {
          title,
          messages: JSON.parse(JSON.stringify(messagesToSave)),
          preserveTimestamp: isJustLoading // Preserve timestamp when just loading
        }, {
          withCredentials: true
        });
      } else {
        // Use save endpoint for new chats
        response = await axios.post(`${backend_url}/api/chat/save`, {
          chatId,
          title,
          messages: JSON.parse(JSON.stringify(messagesToSave)),
        }, {
          withCredentials: true
        });
      }
      
      if (response.data.success) {
        if (response.data.chat.id && (!threadId || threadId.startsWith('temp_'))) {
          setThreadId(response.data.chat.id);
          chatIdRef.current = response.data.chat.id;
        }
        fetchChatHistory();
        
        // If we were using a temporary title, update with the one from server
        if (title === "New Chat" || title.endsWith("...")) {
          setChatTitle(response.data.chat.title);
        }
        
        // Store the last updated timestamp from response
        chatLastUpdatedRef.current = response.data.chat.lastUpdated;
      }
    } catch (error) {
      console.error("Error saving chat:", error);
      // Could add user feedback here with a toast notification
    } finally {
      saveInProgress.current = false;
    }
  };
  
  useEffect(() => {
    if (!user || messages.length === 0 || !messages.some(m => m.role === 'user') || isLoadingChat) return;
    
    // Don't save if the last message is temporary
    if (messages[messages.length - 1]?.isTemporary) return;
    
    const saveTimer = setTimeout(() => {
      saveChat(messages);
    }, 2000); // Increased from 1000 to 2000ms
    
    return () => clearTimeout(saveTimer);
  }, [messages, user]);

  useEffect(() => {
    if (isGeneratingMedia) {
      const timeoutId = setTimeout(() => {
        setIsGeneratingMedia(false);
        setGeneratingMediaType(null);
      }, 30000);
      
      return () => clearTimeout(timeoutId);
    }
  }, [isGeneratingMedia]);

  useEffect(() => {
    if (isGeneratingMedia && messages.length > 0) {
      // Find non-temporary media message
      const mediaMessages = messages.filter(msg => 
        msg.role === 'assistant' && 
        !msg.isTemporary
      );
      
      if (mediaMessages.length > 0) {
        const lastMessage = mediaMessages[mediaMessages.length - 1];
        const content = lastMessage.content || '';
        
        // More comprehensive image URL detection
        const containsImageUrl = 
          content.includes('.jpg') || 
          content.includes('.jpeg') || 
          content.includes('.png') || 
          content.includes('.gif') || 
          content.includes('.webp') ||
          content.includes('replicate.delivery') ||
          content.includes('image-url') ||
          /!\[.*?\]\(https?:\/\/\S+\)/i.test(content);
          
        // More comprehensive audio URL detection
        const containsMusicUrl = 
          content.includes('.mp3') || 
          content.includes('.wav') || 
          content.includes('.ogg') ||
          content.includes('musicfy.lol') ||
          content.includes('audio-url');
        
        // Only clear loading state if we actually found media content
        if (containsImageUrl || containsMusicUrl) {
          console.log("Media URL detected, clearing loading states");
          // DO NOT clear states here - we'll let onMediaLoaded handle this
        }
      }
    }
  }, [messages, isGeneratingMedia]);

  const handleChatStreamingRequest = async (message, options = {}) => {
    if (message.role === 'user') {
      setIsLoading(true);
      
      const messageText = message.content.toLowerCase();
      const isMediaRequest = 
        (messageText.includes('generate') || 
         messageText.includes('create') || 
         messageText.includes('make')) &&
        (messageText.includes('image') || 
         messageText.includes('picture') ||
         messageText.includes('music') ||
         messageText.includes('audio') ||
         messageText.includes('song'));
      
      // Don't add temporary message for media requests to avoid conflicts
      if (!isMediaRequest && !isGeneratingMedia) {
        const tempMessageId = Date.now();
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: '',
          isTemporary: true,
          id: tempMessageId
        }]);
      }
      
      try {
        console.log("Making streaming request with options:", {
          model: options.model,
          thread_id: threadId,
          use_agent: options.use_agent || false,
          stream: true,
          isMediaRequest,
          isGeneratingMedia
        });
        
        const response = await fetch(`${API_URL}/api/chat`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messages: [...messages, message],
            model: options.model,
            thread_id: threadId,
            file_url: options.file_url,
            use_agent: options.use_agent || false,
            deep_research: false,
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
              }
              else if (data.type === "chunk") {
                // Fix: Accumulate chunks properly for streaming text
                if (!isMediaRequest && !isGeneratingMedia) {
                  setMessages(prev => {
                    const newMessages = [...prev];
                    const tempIndex = newMessages.findIndex(msg => msg.isTemporary);
                    
                    if (tempIndex >= 0) {
                      newMessages[tempIndex] = {
                        ...newMessages[tempIndex],
                        content: newMessages[tempIndex].content + data.chunk
                      };
                    } else {
                      newMessages.push({
                        role: 'assistant',
                        content: data.chunk,
                        isTemporary: true,
                        id: Date.now()
                      });
                    }
                    
                    return newMessages;
                  });
                } else {
                  fullResponse += data.chunk;
                }
              }
              else if (data.type === "done") {
                // Mark the message as permanent when done
                setMessages(prev => {
                  const newMessages = prev.map(msg => 
                    msg.isTemporary ? { ...msg, isTemporary: false } : msg
                  );
                  saveChat(newMessages);
                  return newMessages;
                });
                
                if (!threadId && data.thread_id) {
                  setThreadId(data.thread_id);
                  chatIdRef.current = data.thread_id;
                }
                
                setIsLoading(false);
                setAgentStatus("");
              }
              else if (data.type === "result") {
                const content = data.message?.content || '';
                
                const containsImageUrl = 
                  content.includes('.jpg') || 
                  content.includes('.jpeg') || 
                  content.includes('.png') || 
                  content.includes('.gif') || 
                  content.includes('replicate.delivery') ||
                  content.includes('image-url') ||
                  /!\[.*?\]\(https?:\/\/\S+\)/i.test(content);
                  
                const containsMusicUrl = 
                  content.includes('.mp3') || 
                  content.includes('.wav') || 
                  content.includes('musicfy.lol') ||
                  content.includes('audio-url');
                
                const isMediaResponse = containsImageUrl || containsMusicUrl;
                
                setIsLoading(false);
                setAgentStatus("");
                
                // Only adjust music transitions, keep image behavior as is
                if (!isMediaResponse) {
                  setIsGeneratingMedia(false);
                  setGeneratingMediaType(null);
                  setMediaType(null);
                }
                
                if (!threadId && data.thread_id) {
                  setThreadId(data.thread_id);
                  chatIdRef.current = data.thread_id;
                }
                
                // Add complete message to the list
                if (isMediaRequest || isGeneratingMedia) {
                  // For media responses, ensure message gets added
                  setMessages(prev => {
                    const existingMediaMessage = prev.findIndex(msg => 
                      msg.id && String(msg.id).includes('-media')
                    );
                    
                    if (existingMediaMessage >= 0) {
                      // Update existing temp message
                      const newMessages = [...prev];
                      newMessages[existingMediaMessage] = data.message;
                    return newMessages;
                } else {
                      // Add new message
                      return [...prev, data.message];
                    }
                  });
                }
              }
            } catch (jsonError) {
              console.error("Error parsing stream data:", jsonError, "Line:", line);
            }
          }
        }
      } catch (error) {
        console.error("Error with streaming chat:", error);
        setMessages(prev => prev.filter(msg => !msg.isTemporary));
        setIsGeneratingMedia(false);
        setGeneratingMediaType(null);
        setIsLoading(false);
      }
    }
  };

  const handleSendMessage = (message, options = {}) => {
    chatLastUpdatedRef.current = null;
    
    const userMessage = { ...message };
    
    if (options.file_url) {
      const fileUrl = options.file_url;
      
      const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(fileUrl);
      
      if (isImage) {
        userMessage.content = `${userMessage.content}\n\n![Uploaded Image](${fileUrl})`;
      } else {
        userMessage.content = `${userMessage.content}\n\n[Uploaded File](${fileUrl})`;
      }
    }
    
    setMessages(prev => [...prev, userMessage]);

    if (userMessage.role !== 'user') return;

    const messageText = userMessage.content.toLowerCase();
    
    setIsGeneratingMedia(false);
    setGeneratingMediaType(null);
    
    const songTerms = ['song', 'music', 'audio', 'tune', 'melody', 'compose'];
    const audioVerbs = ['generate', 'create', 'make', 'compose', 'play'];
    
    const isAudioRequest = 
      songTerms.some(term => messageText.includes(term)) &&
      (audioVerbs.some(verb => messageText.includes(verb)) || 
       messageText.startsWith('play') || 
       messageText.startsWith('sing'));
    
    const isImageRequest = !isAudioRequest && (
      (messageText.includes('image') || 
       messageText.includes('picture') || 
       messageText.includes('photo') || 
       messageText.includes('drawing')) &&
      (messageText.includes('generate') || 
       messageText.includes('create') || 
       messageText.includes('draw') || 
       messageText.includes('make'))
    );

    if (isAudioRequest) {
      console.log("Audio generation request detected");
      setIsGeneratingMedia(true);
      setGeneratingMediaType('audio');
      setMediaType('music');
      
      // Don't add temporary message here - we'll let the MediaLoadingAnimation handle visuals
    } else if (isImageRequest) {
      console.log("Image generation request detected");
      setIsGeneratingMedia(true);
      setGeneratingMediaType('image');
      setMediaType('image');
      
      // Don't add temporary message here - we'll let the MediaLoadingAnimation handle visuals
    }

    setIsLoading(true);
    
    if (options.deep_research) {
      handleReactAgentStreamingRequest(userMessage, options);
    } else if (options.use_agent) {
      handleChatStreamingRequest(userMessage, options);
    } else {
      handleChatStreamingRequest(userMessage, options);
    }
  };

  const loadChat = async (chatId) => {
    try {
      setIsLoadingChat(true);
      const response = await axios.get(`${backend_url}/api/chat/${chatId}`, {
        withCredentials: true
      });
      
      if (response.data.success) {
        const chatData = response.data.chat;
        setMessages(chatData.messages);
        setChatTitle(chatData.title);
        setThreadId(chatData.chatId);
        chatIdRef.current = chatData.chatId;
        
        if (chatData.lastUpdated) {
          chatLastUpdatedRef.current = chatData.lastUpdated;
        }
        
        setIsHistoryOpen(false);
      }
    } catch (error) {
      console.error("Error loading chat:", error);
    } finally {
      setIsLoadingChat(false);
    }
  };

  const clearConversation = () => {
    setMessages([]);
    setThreadId(null);
    chatIdRef.current = `temp_${Date.now()}`;
    setChatTitle("New Chat");
  };

  const hasActiveConversation = messages.length > 0;

  const handleMediaRequested = (mediaType) => {
    setIsGeneratingMedia(true);
    setGeneratingMediaType(mediaType);
  };

  const updateChatTitle = async (newTitle) => {
    if (!user || !threadId || threadId.startsWith('temp_') || isLoadingChat) return;
    
    try {
      const response = await axios.put(`${backend_url}/api/chat/${threadId}/update`, {
        title: newTitle,
        messages: messages
      }, {
        withCredentials: true
      });
      
      if (response.data.success) {
        setChatTitle(newTitle);
        fetchChatHistory();
      }
    } catch (error) {
      console.error("Error updating chat title:", error);
    }
  };

  const handleModelChange = (newModel) => {
    setModel(newModel);
  };

  const handleInputOptionsChange = (options) => {
    if (options.use_agent !== undefined) setUseAgent(options.use_agent);
    if (options.deep_research !== undefined) setDeepResearch(options.deep_research);
  };

  return (
    <div className="flex flex-col h-screen w-full overflow-hidden">
      {isHistoryOpen && (
        <div className={`fixed inset-0 ${theme === 'dark' ? 'bg-[#1a1a1a]' : 'bg-gray-100'} z-[150]`}>
          <ChatHistory 
            isOpen={isHistoryOpen} 
            onClose={() => setIsHistoryOpen(false)} 
            conversations={conversations}
            onSelectConversation={loadChat}
          />
        </div>
      )}

      {isSettingsOpen && (
        <div className={`fixed inset-0 ${theme === 'dark' ? 'bg-[#1a1a1a]' : 'bg-gray-100'} z-[200]`}>
          <Settings 
            isOpen={isSettingsOpen} 
            onClose={() => setIsSettingsOpen(false)} 
            onClearConversation={clearConversation}
          />
        </div>
      )}

      <div className="flex h-full flex-1 overflow-hidden">
        <Sidebar 
          isVisible={isSidebarVisible} 
          onToggle={toggleSidebar}
          onOpenSettings={() => setIsSettingsOpen(true)}
          onOpenHistory={() => setIsHistoryOpen(true)}
          onNewChat={clearConversation}
        />

        <main className={`flex-1 flex flex-col h-full overflow-hidden transition-all duration-300 
          ${isSidebarVisible ? 'lg:ml-64 sm:ml-16 ml-14' : 'ml-0'}`}>
          
          {/* Invisible spacing container - Pushes content down on mobile */}
          <div className="md:hidden h-16 sm:h-20 flex-shrink-0"></div>
          
          {/* Centered Mobile Header */}
          <div className="absolute top-0 left-0 right-0 h-16 sm:h-20 flex items-center justify-center md:hidden z-20 pointer-events-none">
            <div className="flex items-center pointer-events-auto"> {/* Allow clicking logo if needed */}
                <img src="/vannipro.png" alt="Vaani.pro Logo" className="h-6 sm:h-8" />
                <h1 className="text-sm sm:text-lg font-bold ml-2 text-[#cc2b5e]">Vaani.pro</h1>
            </div>
          </div>
            
          {/* Floating user profile - Ensure higher z-index */}
          <div className="absolute top-4 right-6 z-30 flex items-center"> 
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full overflow-hidden">
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
          
          {hasActiveConversation ? (
            <div className="flex-1 flex flex-col overflow-hidden h-full">
              <div className="flex-1 overflow-y-auto px-0 pt-16 pb-4 scroll-smooth min-h-0"
                style={{ 
                  msOverflowStyle: "none", 
                  scrollbarWidth: "none",
                  WebkitOverflowScrolling: "touch",
                  willChange: 'transform'
                }}
              >
                <div className="w-full max-w-[95%] xs:max-w-[90%] sm:max-w-3xl md:max-w-3xl mx-auto">
                  {messages.map((msg, index) => {
                    const displayContent = msg.role === 'assistant' 
                      ? msg.content 
                      : sanitizeContent(msg.content);
                    
                    return (
                      <div 
                        key={index} 
                        className={`mb-6 w-full flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        {msg.role === 'user' ? (
                          <div className={`${
                            theme === 'dark'
                              ? 'bg-white/30 text-white' 
                              : 'bg-black/20 text-white'
                          } rounded-3xl p-3 px-4 overflow-hidden inline-block`} style={{maxWidth: '85%'}}>
                            <MessageContent content={displayContent} />
                          </div>
                        ) : (
                          <div className={`${
                            theme === 'dark'
                              ? 'text-white' 
                              : 'text-gray-800'
                          } rounded-xl p-0 overflow-hidden inline-block w-full max-w-full pl-2 xs:pl-3 sm:pl-0`}>
                            <MessageContent 
                              content={displayContent} 
                              forceImageDisplay={true} 
                              forceAudioDisplay={true}
                              onMediaLoaded={() => {
                                console.log("Media loaded, clearing states");
                                // Only clear if we're actually displaying media
                                if (isGeneratingMedia) {
                                  setIsLoading(false);
                                  setIsGeneratingMedia(false);
                                  setGeneratingMediaType(null);
                                  setMediaType(null);
                                }
                              }}
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                  
                  {/* Loading indicators - only one will show at a time */}
                  {isLoading && (
                    <>
                      {isGeneratingMedia ? (
                        // --- PRIORITY 1: Media Generation ---
                        // Always show MediaLoadingAnimation if isGeneratingMedia is true
                        <MediaLoadingAnimation mediaType={mediaType || generatingMediaType} />
                      ) : agentStatus && (useAgent || deepResearch) ? (
                        // --- PRIORITY 2: Agent Status (only if not generating media) ---
                        <div className="mb-4 flex justify-start">
                          <div className={`rounded-2xl p-3 ${theme === 'dark' ? 'bg-white/[0.05] backdrop-blur-xl border border-white/20' : 'bg-gray-100'} shadow-md inline-block`}>
                            <div className="flex items-center space-x-3">
                              <span className="text-xs opacity-80">{agentStatus}</span>
                            </div>
                          </div>
                        </div>
                      ) : (
                        // --- PRIORITY 3: Normal Conversation Loading (if not generating media and no agent status) ---
                        <div className="mb-4 flex justify-start">
                          <div className='rounded-2xl p-3 shadow-md inline-block'>
                            <div className="flex items-center space-x-3">
                              <span className="text-xs opacity-80 animate-blink">⚪</span>
                            </div>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
              
              {/* Fixed position for input when conversation is active */}
              <div className="w-full flex-shrink-0 px-4 xs:px-6 sm:px-8 pb-3 sm:pb-4 z-20 mt-auto mb-3 sm:mb-4">
                <MessageInput 
                  onSendMessage={handleSendMessage} 
                  isLoading={isLoading}
                  setIsLoading={setIsLoading}
                  onMediaRequested={handleMediaRequested}
                  onModelChange={handleModelChange}
                  onOptionsChange={handleInputOptionsChange}
                  selectedModel={model}
                />
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col overflow-hidden h-full">
              {/* Welcome content with centered input for empty state */}
              <div className="flex-1 overflow-y-auto px-4 pt-16 pb-4 flex flex-col items-center justify-center -mt-6 sm:-mt-12">
                <div className="items-center text-center w-full transition-all duration-300 
                  max-w-sm sm:max-w-xl md:max-w-2xl lg:max-w-3xl">
                  <h1 className="text-2xl sm:text-3xl font-bold text-[#cc2b5e]">Welcome to Vaani.pro</h1>
                  <p className="text-[#cc2b5e] text-base sm:text-xl mt-2">How may I help you?</p>
                  
                  {/* Preserved predefined prompts */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 max-w-5xl mx-auto mt-6 sm:mt-8 px-2">
                    {predefinedPrompts.map((item) => (
                      <motion.div
                        key={item.id}
                        className={`group relative ${
                          theme === 'dark' 
                            ? 'bg-white/[0.05] backdrop-blur-xl border border-white/20 hover:bg-white/[0.08] shadow-[0_0_20px_rgba(204,43,94,0.3)] hover:shadow-[0_0_20px_rgba(204,43,94,0.5)]' 
                            : 'bg-gray-100 border border-gray-200 hover:bg-gray-200 shadow-md hover:shadow-lg'
                        } rounded-xl p-4 cursor-pointer transition-all duration-100`}
                        whileHover={{ 
                          scale: 1.03,
                          transition: { duration: 0.2 }
                        }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => handlePromptClick(item)}
                      >
                        <div className="relative z-10">
                          <h3 className={`${theme === 'dark' ? 'text-white/90' : 'text-gray-800'} font-medium text-sm mb-2`}>
                            {item.title}
                          </h3>
                          <p className={`${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'} text-xs line-clamp-2`}>
                            {item.prompt}
                          </p>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                  
                  {/* Add message input in the center for desktop only, hidden on mobile */}
                  <div className="hidden md:block w-full max-w-3xl mx-auto mt-8">
                    <MessageInput 
                      onSendMessage={handleSendMessage}
                      isLoading={isLoading}
                      setIsLoading={setIsLoading}
                      onMediaRequested={handleMediaRequested}
                      onModelChange={handleModelChange}
                      onOptionsChange={handleInputOptionsChange}
                      selectedModel={model}
                    />
                  </div>
                </div>
              </div>
              
              {/* Keep the bottom input for mobile view only */}
              <div className="md:hidden w-full flex-shrink-0 px-4 xs:px-6 sm:px-8 pb-3 sm:pb-4 z-20 mt-auto mb-3 sm:mb-4">
                <MessageInput 
                  onSendMessage={handleSendMessage}
                  isLoading={isLoading}
                  setIsLoading={setIsLoading}
                  onMediaRequested={handleMediaRequested}
                  onModelChange={handleModelChange}
                  onOptionsChange={handleInputOptionsChange}
                  selectedModel={model}
                />
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}

export default ChatContainer