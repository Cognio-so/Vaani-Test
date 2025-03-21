import { motion } from 'framer-motion'
import { HiSparkles } from 'react-icons/hi'
import { FaUser, FaDownload } from 'react-icons/fa'
import MessageInput from './MessageInput'
import Sidebar from './Sidebar'
import ChatHistory from './ChatHistory'
import Settings from './Settings'
import axios from 'axios'
import ReactMarkdown from 'react-markdown'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { atomDark } from 'react-syntax-highlighter/dist/esm/styles/prism'
import remarkGfm from 'remark-gfm'
import React, { useState, useEffect, useRef, useContext } from 'react'
import { useAuth } from '../context/AuthContext'
import { ThemeContext } from '../App'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'
const backend_url = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000'

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
  const [generatingMediaType, setGeneratingMediaType] = useState(null) // 'image' or 'audio'
  const [mediaType, setMediaType] = useState(null) // 'image' or 'music'
  const { user } = useAuth()
  const [chatTitle, setChatTitle] = useState("New Chat")
  const [conversations, setConversations] = useState([])
  const { theme } = useContext(ThemeContext)
  const [isLoadingChat, setIsLoadingChat] = useState(false) // New state to prevent saving when loading
  const [isEditingTitle, setIsEditingTitle] = useState(false)
  const [editedTitle, setEditedTitle] = useState("")
  
  // Add these missing useRef declarations
  const chatIdRef = useRef(`temp_${Date.now()}`)
  const saveInProgress = useRef(false)

  // Scroll to bottom of messages
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

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
          content: 'Researching...',
          isTemporary: true,
          id: tempMessageId
        }]);
        
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          
          const chunk = decoder.decode(value);
          const lines = chunk.split('\n').filter(line => line.trim());
          
          for (const line of lines) {
            try {
              const data = JSON.parse(line);
              
              if (data.type === 'status') {
                setAgentStatus(data.status);
                setMessages(prev => prev.map(msg => 
                  msg.id === tempMessageId
                    ? { ...msg, content: `**Researching**: ${data.status}` }
                    : msg
                ));
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
            }
          }
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
        console.log("Chat history loaded:", allChats.length, "conversations");
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
      console.log("Save already in progress, skipping...");
      return;
    }
    
    // Don't save if the last message is temporary
    if (currentMessages[currentMessages.length - 1]?.isTemporary) {
      console.log("Skipping save for temporary message");
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
      
      console.log("Saving chat with ID:", chatId, "Messages:", messagesToSave.length);
      
      // Choose the right endpoint - update for existing chats, save for new ones
      let response;
      
      if (chatId && !chatId.startsWith('temp_') && !chatId.startsWith('new_')) {
        // Use the update endpoint for existing chats
        response = await axios.put(`${backend_url}/api/chat/${chatId}/update`, {
          title,
          messages: JSON.parse(JSON.stringify(messagesToSave)),
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
          console.log("Updating thread ID from", threadId, "to", response.data.chat.id);
          setThreadId(response.data.chat.id);
          chatIdRef.current = response.data.chat.id;
        }
        fetchChatHistory();
        console.log("Chat saved successfully with", messagesToSave.length, "messages");
        
        // If we were using a temporary title, update with the one from server
        if (title === "New Chat" || title.endsWith("...")) {
          setChatTitle(response.data.chat.title);
        }
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
        console.log("Safety timeout: clearing media generation state");
        setIsGeneratingMedia(false);
        setGeneratingMediaType(null);
      }, 30000);
      
      return () => clearTimeout(timeoutId);
    }
  }, [isGeneratingMedia]);

  useEffect(() => {
    if (isGeneratingMedia && messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      if (lastMessage.role === 'assistant') {
        const content = lastMessage.content || '';
        const containsImageUrl = 
          content.includes('.jpg') || 
          content.includes('.jpeg') || 
          content.includes('.png') || 
          content.includes('.gif') || 
          content.includes('replicate.delivery') ||
          content.includes('image-url');
          
        const containsMusicUrl = 
          content.includes('.mp3') || 
          content.includes('.wav') || 
          content.includes('musicfy.lol') ||
          content.includes('audio-url');
        
        if (containsImageUrl || containsMusicUrl) {
          console.log("Media detected in last message, clearing generation state");
          setIsGeneratingMedia(false);
          setGeneratingMediaType(null);
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
      
      console.log("Media request detection in streaming function:", { 
        isMediaRequest, 
        isGeneratingMedia,
        messageContent: message.content
      });
      
      // Don't add temporary message for media requests to avoid conflicts
      if (!isMediaRequest && !isGeneratingMedia) {
        const tempMessageId = Date.now();
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: 'Thinking...',
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
          console.log("Received chunk:", chunk);
          
          const lines = chunk.split('\n').filter(line => line.trim());
          
          for (const line of lines) {
            try {
              const data = JSON.parse(line);
              console.log("Parsed stream data:", data);
              
              if (data.type === 'status') {
                if (!isGeneratingMedia) {
                  setAgentStatus(data.status);
                  if (!isMediaRequest) {
                    setMessages(prev => prev.map(msg => 
                      msg.isTemporary
                        ? { ...msg, content: `**${data.status}**` }
                        : msg
                    ));
                  }
                }
              } 
              else if (data.type === 'token') {
                fullResponse = data.token;
                if (!isMediaRequest && !isGeneratingMedia) {
                  setMessages(prev => prev.map(msg => 
                    msg.isTemporary
                      ? { ...msg, content: fullResponse }
                      : msg
                  ));
                }
              }
              else if (data.type === 'result') {
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
                
                console.log("Media detection in result:", {
                  containsImageUrl,
                  containsMusicUrl,
                  content: content.substring(0, 100) + "...",
                });
                
                // Clear all temporary states
                setIsLoading(false);
                setAgentStatus("");
                setIsGeneratingMedia(false);
                setGeneratingMediaType(null);
                
                // Process response correctly based on content
                // For media requests, make sure we filter out any temporary messages
                if (isMediaRequest) {
                  setMessages(prev => {
                    // Remove any processing or temporary messages first
                    const filteredMessages = prev.filter(msg => 
                      !(msg.isTemporary || 
                        (msg.role === 'assistant' && 
                         (msg.content.includes('Processing information') || 
                          msg.content.includes('Generating'))))
                    );
                    
                    // Add the actual response
                    const newMessages = [...filteredMessages, data.message];
                    saveChat(newMessages);
                    return newMessages;
                  });
                } else {
                  // For normal messages
                  setMessages(prev => {
                    const newMessages = prev.filter(msg => !msg.isTemporary).concat([data.message]);
                    saveChat(newMessages);
                    return newMessages;
                  });
                }
                
                if (data.thread_id) {
                  setThreadId(data.thread_id);
                  chatIdRef.current = data.thread_id;
                }
              }
            } catch (parseError) {
              console.error("Error parsing stream data:", parseError, "Line:", line);
            }
          }
        }
      } catch (error) {
        console.error("Error with streaming chat:", error);
        // Remove temporary message on error
        setMessages(prev => prev.filter(msg => !msg.isTemporary));
        setIsGeneratingMedia(false);
        setGeneratingMediaType(null);
        setIsLoading(false);
      }
    }
  };

  const handleSendMessage = (message, options = {}) => {
    const userMessage = { ...message };
    
    if (options.file_url) {
      const fileUrl = options.file_url;
      console.log("File URL to include:", fileUrl);
      
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
    
    // Reset media states at the beginning of a new message
    setIsGeneratingMedia(false);
    setGeneratingMediaType(null);
    
    // More precise detection of audio/music requests
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

    // Set the appropriate media state based on detection
    if (isAudioRequest) {
      console.log("Audio generation detected!");
      setIsGeneratingMedia(true);
      setGeneratingMediaType('audio');
      setMediaType('music'); // Make sure to set this too
    } else if (isImageRequest) {
      console.log("Image generation detected!");
      setIsGeneratingMedia(true);
      setGeneratingMediaType('image');
      setMediaType('image'); // Make sure to set this too
    }

    setIsLoading(true);
    
    if (options.deep_research) {
      handleReactAgentStreamingRequest(userMessage, options);
    } else {
      handleChatStreamingRequest(userMessage, options);
    }
  };

  const loadChat = async (chatId) => {
    try {
      setIsLoadingChat(true); // Set flag to prevent saving
      const response = await axios.get(`${backend_url}/api/chat/${chatId}`, {
        withCredentials: true
      });
      
      if (response.data.success) {
        setMessages(response.data.chat.messages);
        setChatTitle(response.data.chat.title);
        setThreadId(response.data.chat.chatId);
        chatIdRef.current = response.data.chat.chatId; // Update ref to permanent ID
        setIsHistoryOpen(false);
      }
    } catch (error) {
      console.error("Error loading chat:", error);
    } finally {
      setIsLoadingChat(false); // Reset flag after loading
    }
  };

  const clearConversation = () => {
    setMessages([]);
    setThreadId(null);
    chatIdRef.current = `temp_${Date.now()}`;
    setChatTitle("New Chat");
  };

  const hasActiveConversation = messages.length > 0

  const extractMediaUrls = (content) => {
    if (!content) return { text: '', imageUrls: [], musicUrls: [] };
    
    const imageRegex = /!\[(.*?)\]\((https?:\/\/\S+\.(?:jpg|jpeg|png|gif|webp))\)|(?<!\[)(https?:\/\/\S+\.(?:jpg|jpeg|png|gif|webp))(?!\])/gi;
    const musicRegex = /(https?:\/\/\S+\.(?:mp3|wav|ogg|m4a)(?:\S*))|(https?:\/\/(?:api\.musicfy\.lol|replicate\.delivery|replicate\.com|\w+\.(?:r2\.cloudflarestorage|cloudfront|amazonaws))\.com\/\S+)/gi;
    
    const imageUrls = [];
    const musicUrls = [];
    
    let imageMatch;
    while ((imageMatch = imageRegex.exec(content)) !== null) {
      imageUrls.push(imageMatch[2] || imageMatch[0]);
    }
    
    let musicMatch;
    while ((musicMatch = musicRegex.exec(content)) !== null) {
      musicUrls.push(musicMatch[0]);
    }
    
    let text = content;
    [...imageUrls, ...musicUrls].forEach(url => {
      text = text.replace(new RegExp(`^${url.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')}$`, 'gm'), '');
      text = text.replace(new RegExp(url.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'), 'g'), '');
      text = text.replace(new RegExp(`!\\[.*?\\]\\(${url.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')}\\)`, 'g'), '');
    });
    
    return { text, imageUrls, musicUrls };
  };

  const ModernAudioPlayer = ({ url }) => {
    const { theme } = useContext(ThemeContext);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const audioRef = useRef(null);

    const togglePlay = () => {
      if (audioRef.current) {
        if (isPlaying) {
          audioRef.current.pause();
        } else {
          audioRef.current.play();
        }
        setIsPlaying(!isPlaying);
      }
    };

    const handleDownload = () => {
      const a = document.createElement('a');
      a.href = url;
      a.download = 'audio-' + Date.now() + '.mp3';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    };

    const handleTimeUpdate = () => {
      if (audioRef.current) {
        setCurrentTime(audioRef.current.currentTime);
      }
    };

    const handleLoadedMetadata = () => {
      if (audioRef.current) {
        setDuration(audioRef.current.duration);
      }
    };

    const handleSliderChange = (e) => {
      const newTime = parseFloat(e.target.value);
      setCurrentTime(newTime);
      if (audioRef.current) {
        audioRef.current.currentTime = newTime;
      }
    };

    const formatTime = (time) => {
      const minutes = Math.floor(time / 60);
      const seconds = Math.floor(time % 60);
      return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
    };

    return (
      <div className="rounded-xl overflow-hidden shadow-lg">
        <div className={`${theme === 'dark' ? 'bg-gradient-to-r from-[#1a1a1a] to-[#2a2a2a] border border-white/10' : 'bg-gradient-to-r from-gray-100 to-gray-200 border border-gray-300'} p-4`}>
          <audio 
            ref={audioRef}
            src={url} 
            onTimeUpdate={handleTimeUpdate}
            onLoadedMetadata={handleLoadedMetadata}
            onEnded={() => setIsPlaying(false)}
            className="hidden"
          />
          
          <div className="flex items-center mb-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#cc2b5e] to-[#753a88] flex items-center justify-center text-white">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                <path d="M9 19V5l12-2v12h-5c0 1.66-1.34 3-3 3s-3-1.34-3-3h-4zm1-7h10V7L10 8.5v3.5zm2 7c.55 0 1-.45 1-1s-.45-1-1-1-1 .45-1 1 .45 1 1 1z"/>
              </svg>
            </div>
            <div className="ml-3 flex-1">
              <h3 className={`text-sm font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-800'}`}>Generated Audio</h3>
              <p className={`text-xs ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>Vaani.pro</p>
            </div>
            <button 
              onClick={handleDownload}
              className="bg-[#cc2b5e]/80 hover:bg-[#cc2b5e] text-white rounded-full w-8 h-8 flex items-center justify-center transition-all shadow-md"
              title="Download audio"
            >
              <FaDownload className="w-3 h-3" />
            </button>
          </div>
          
          <div className="h-16 mb-2 flex items-center justify-center">
            <div className="flex items-end space-x-[2px] w-full">
              {[...Array(40)].map((_, i) => {
                const baseHeight = Math.sin(i * 0.2) * 0.3 + 0.5;
                const activeHeight = isPlaying 
                  ? Math.sin((i * 0.2) + (Date.now() / 500)) * 0.4 + 0.6
                  : baseHeight;
                const height = (currentTime / duration > i / 40) ? activeHeight : baseHeight;
                
                return (
                  <div 
                    key={i}
                    className={`rounded-full transition-all duration-200 ${
                      currentTime / duration > i / 40 
                        ? 'bg-[#cc2b5e]' 
                        : theme === 'dark' ? 'bg-gray-600' : 'bg-gray-400'
                    }`}
                    style={{ 
                      height: `${Math.max(4, height * 40)}px`, 
                      width: '2px',
                    }}
                  />
                );
              })}
            </div>
          </div>
          
          <div className="flex items-center">
            <button 
              onClick={togglePlay}
              className="bg-[#cc2b5e] hover:bg-[#d84070] text-white rounded-full w-10 h-10 flex items-center justify-center transition-all mr-3"
            >
              {isPlaying ? (
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                  <path fillRule="evenodd" d="M6.75 5.25a.75.75 0 01.75-.75H9a.75.75 0 01.75.75v13.5a.75.75 0 01-.75.75H7.5a.75.75 0 01-.75-.75V5.25zm7 0a.75.75 0 01.75-.75h1.5a.75.75 0 01.75.75v13.5a.75.75 0 01-.75.75h-1.5a.75.75 0 01-.75-.75V5.25z" clipRule="evenodd" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                  <path fillRule="evenodd" d="M4.5 5.653c0-1.426 1.529-2.33 2.779-1.643l11.54 6.348c1.295.712 1.295 2.573 0 3.285L7.28 19.991c-1.25.687-2.779-.217-2.779-1.643V5.653z" clipRule="evenodd" />
                </svg>
              )}
            </button>
            
            <div className="flex-1">
              <div className={`w-full h-1 ${theme === 'dark' ? 'bg-gray-700' : 'bg-gray-300'} rounded-full relative`}>
                <input 
                  type="range" 
                  min="0" 
                  max={duration || 100}
                  value={currentTime}
                  onChange={handleSliderChange}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                />
                <div 
                  className="absolute top-0 left-0 h-1 bg-[#cc2b5e] rounded-full" 
                  style={{ width: `${(currentTime / duration) * 100}%` }}
                />
              </div>
              <div className="flex justify-between mt-1 text-xs text-gray-400">
                <span className={theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}>{formatTime(currentTime)}</span>
                <span className={theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}>{formatTime(duration)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const MessageContent = ({ content }) => {
    const { theme } = useContext(ThemeContext);
    const { text, imageUrls, musicUrls } = extractMediaUrls(content);
    
    const handleImageDownload = (url) => {
      // Create an xhr request to get the image as a blob
      const xhr = new XMLHttpRequest();
      xhr.open('GET', url, true);
      xhr.responseType = 'blob';
      xhr.onload = function() {
        if (this.status === 200) {
          // Create a blob from the image data
          const blob = new Blob([this.response], { type: 'image/jpeg' });
          
          // Create a URL for the blob
          const blobUrl = URL.createObjectURL(blob);
          
          // Create an anchor element and set download attribute
          const a = document.createElement('a');
          a.href = blobUrl;
          a.download = 'image-' + Date.now() + '.jpg';
          
          // Append, click, and remove the anchor
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          
          // Release the blob URL
          setTimeout(() => {
            URL.revokeObjectURL(blobUrl);
          }, 100);
        }
      };
      xhr.send();
    };
    
    return (
      <div className={`message-content break-words ${theme === 'dark' ? 'text-white' : 'text-gray-800'}`}>
        {text && (
          <div className={`prose ${theme === 'dark' ? 'prose-invert' : ''} prose-sm sm:prose-base max-w-none overflow-hidden`}>
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                code({ node, inline, className, children, ...props }) {
                  const match = /language-(\w+)/.exec(className || '');
                  return !inline && match ? (
                    <SyntaxHighlighter
                      style={atomDark}
                      language={match[1]}
                      PreTag="div"
                      customStyle={{
                        maxWidth: '100%', 
                        fontSize: '0.75em',
                        borderRadius: '0.375rem',
                        marginTop: '0.5rem',
                        marginBottom: '0.5rem',
                      }}
                      codeTagProps={{
                        style: {
                          fontSize: 'inherit',
                          lineHeight: 1.5
                        }
                      }}
                      wrapLines={true}
                      wrapLongLines={true}
                      {...props}
                    >
                      {String(children).replace(/\n$/, '')}
                    </SyntaxHighlighter>
                  ) : (
                    <code className={className} {...props}>
                      {children}
                    </code>
                  );
                },
                a: ({ node, ...props }) => {
                  const href = props.href || '';
                  const isMediaUrl = /\.(jpg|jpeg|png|gif|webp|mp3|wav|ogg)$/i.test(href) || 
                                    href.includes('musicfy.lol') || 
                                    href.includes('replicate');
                  
                  if (isMediaUrl) {
                    return null;
                  }
                  
                  return (
                    <a {...props} target="_blank" rel="noopener noreferrer" className="text-[#cc2b5e] underline" />
                  );
                },
                table: ({ node, ...props }) => (
                  <table {...props} className={`border-collapse ${theme === 'dark' ? 'border-gray-600' : 'border-gray-300'} my-4 w-full`} />
                ),
                th: ({ node, ...props }) => (
                  <th {...props} className={`border ${theme === 'dark' ? 'border-gray-600 bg-gray-800' : 'border-gray-300 bg-gray-100'} px-4 py-2`} />
                ),
                td: ({ node, ...props }) => (
                  <td {...props} className={`border ${theme === 'dark' ? 'border-gray-600' : 'border-gray-300'} px-4 py-2`} />
                ),
              }}
            >
              {text}
            </ReactMarkdown>
          </div>
        )}
        
        {imageUrls.length > 0 && (
          <div className="mt-2 space-y-2">
            {imageUrls.map((url, index) => (
              <div key={index} className="relative group">
                <img
                  src={url}
                  alt={`Image ${index + 1}`}
                  className="w-full max-w-full object-contain rounded-lg" 
                  onError={(e) => {
                    e.target.onerror = null;
                    e.target.src = 'https://via.placeholder.com/300x200?text=Image+Failed+to+Load';
                  }}
                />
                <button
                  onClick={() => handleImageDownload(url)}
                  className="absolute bottom-2 right-2 bg-[#cc2b5e]/80 hover:bg-[#cc2b5e] text-white rounded-full w-10 h-10 flex items-center justify-center transition-all shadow-md"
                  title="Download image"
                >
                  <FaDownload className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
        
        {musicUrls.length > 0 && (
          <div className="mt-3 space-y-4">
            {musicUrls.map((url, index) => (
              <ModernAudioPlayer key={index} url={url} />
            ))}
          </div>
        )}
      </div>
    );
  };

  const sanitizeContent = (content) => {
    if (!content) return '';
    
    return content.replace(
      /(https?:\/\/\S+\.(jpg|jpeg|png|gif|webp|mp3|wav|ogg|m4a)(\?\S*)?)/gi, 
      '[media]'
    ).replace(
      /(https?:\/\/(?:api\.musicfy\.lol|replicate\.delivery|replicate\.com|\w+\.(?:r2\.cloudflarestorage|cloudfront|amazonaws))\.com\/\S+)/gi,
      '[media]'
    );
  };

  const MediaGenerationIndicator = () => {
    return (
      <div className="max-w-[95%] mr-auto mb-4">
        <div className="bg-white/10 text-white rounded-xl p-3 relative">
          <div className="flex items-center">
            <div className="mr-3">
              {generatingMediaType === 'image' ? (
                <div className="w-8 h-8 rounded-full border-2 border-[#cc2b5e] border-t-transparent animate-spin"></div>
              ) : (
                <div className="flex space-x-1 h-8 items-center">
                  {[...Array(3)].map((_, i) => (
                    <div 
                      key={i}
                      className="w-1.5 bg-[#cc2b5e] rounded-full animate-sound-wave"
                      style={{
                        height: `${15 + Math.sin(i * 0.8) * 10}px`,
                        animationDelay: `${i * 0.15}s`,
                      }}
                    ></div>
                  ))}
                </div>
              )}
            </div>
            <div>
              <p className="text-sm font-medium">
                {generatingMediaType === 'image' 
                  ? 'Creating your image...' 
                  : 'Composing your music...'}
              </p>
              <p className="text-xs text-white/60">
                This may take a few moments
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const MediaLoadingAnimation = () => {
    return (
      <div className="max-w-[95%] mr-auto mb-4">
        <div className="bg-white/10 text-white rounded-xl p-3 sm:p-4">
          <div className="flex flex-col items-center">
            {mediaType === 'image' ? (
              <>
                <div className="w-full h-40 sm:h-48 bg-white/5 rounded-lg relative overflow-hidden flex items-center justify-center">
                  <div className="absolute inset-0">
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-shimmer" 
                         style={{ backgroundSize: '200% 100%', animation: 'shimmer 2s infinite' }}></div>
                  </div>
                  <div className="relative flex flex-col items-center z-10">
                    <svg className="animate-spin h-10 w-10 text-[#cc2b5e] mb-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <p className="text-sm text-white/90 font-medium">Creating your image...</p>
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="w-full h-24 sm:h-32 bg-white/5 rounded-lg relative overflow-hidden flex items-center justify-center">
                  <div className="absolute inset-0">
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-shimmer" 
                         style={{ backgroundSize: '200% 100%', animation: 'shimmer 2s infinite' }}></div>
                  </div>
                  <div className="relative z-10 flex flex-col items-center">
                    <div className="flex items-center justify-center space-x-1 mb-2">
                      {[...Array(5)].map((_, i) => (
                        <div 
                          key={i} 
                          className="w-1.5 bg-[#cc2b5e] rounded-full animate-sound-wave" 
                          style={{ 
                            height: `${15 + Math.sin(i * 0.8) * 10}px`,
                            animationDelay: `${i * 0.15}s`,
                          }}
                        ></div>
                      ))}
                    </div>
                    <p className="text-sm text-white/90 font-medium">Composing your music...</p>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    );
  };

  const handleMediaRequested = (mediaType) => {
    console.log(`Media requested from input: ${mediaType}`);
    setIsGeneratingMedia(true);
    setGeneratingMediaType(mediaType);
  };

  const updateChatTitle = async (newTitle) => {
    if (!user || !threadId || threadId.startsWith('temp_') || isLoadingChat) return;
    
    try {
      console.log("Updating chat title to:", newTitle);
      const response = await axios.put(`${backend_url}/api/chat/${threadId}/update`, {
        title: newTitle,
        messages: messages
      }, {
        withCredentials: true
      });
      
      if (response.data.success) {
        setChatTitle(newTitle);
        fetchChatHistory(); // Refresh the list
        console.log("Chat title updated successfully");
      }
    } catch (error) {
      console.error("Error updating chat title:", error);
    }
  };

  return (
    <div className={`relative h-screen ${theme === 'dark' ? 'bg-custom-gradient' : 'bg-white'} px-2 sm:px-4 md:px-6 py-2 sm:py-4 overflow-hidden`}>
      {isHistoryOpen && (
        <div className={`fixed inset-0 ${theme === 'dark' ? 'bg-[#1a1a1a]' : 'bg-gray-100'} z-50`}>
          <ChatHistory 
            isOpen={isHistoryOpen} 
            onClose={() => setIsHistoryOpen(false)} 
            conversations={conversations}
            onSelectConversation={loadChat}
          />
        </div>
      )}

      {isSettingsOpen && (
        <div className={`fixed inset-0 ${theme === 'dark' ? 'bg-[#1a1a1a]' : 'bg-gray-100'} z-50`}>
          <Settings 
            isOpen={isSettingsOpen} 
            onClose={() => setIsSettingsOpen(false)} 
            onClearConversation={clearConversation}
          />
        </div>
      )}

      <div className="flex h-full">
        <Sidebar 
          isVisible={isSidebarVisible} 
          onToggle={toggleSidebar}
          onOpenSettings={() => setIsSettingsOpen(true)}
          onOpenHistory={() => setIsHistoryOpen(true)}
          onNewChat={clearConversation}
        />

        <main className={`flex-1 transition-all duration-300 
          ${isSidebarVisible ? 'ml-14 sm:ml-16 lg:ml-64' : 'ml-0'}`}>
          
          {hasActiveConversation ? (
            <div className="h-full flex flex-col">
              <div className="flex-1 overflow-y-auto px-0 sm:px-2 md:px-4 py-4 sm:py-4"
                style={{ 
                  msOverflowStyle: "none", 
                  scrollbarWidth: "none",
                  WebkitOverflowScrolling: "touch"
                }}
              >
                <style>{`
                  .messages-container::-webkit-scrollbar {
                    display: none;
                  }
                  
                  .message-content img {
                    max-width: 100%;
                    height: auto;
                  }
                  
                  .message-content pre {
                    max-width: 100%;
                    overflow-x: auto;
                    font-size: 18px;
                  }
                  
                  .react-syntax-highlighter-line {
                    white-space: pre-wrap !important;
                    word-break: break-word !important;
                  }
                  
                  /* Table responsive styles */
                  .message-content table {
                    width: 100%;
                    display: block;
                    overflow-x: auto;
                    -webkit-overflow-scrolling: touch;
                  }
                  
                  @media (min-width: 768px) {
                    .message-content table {
                      display: table;
                    }
                  }
                  
                  .message-content th,
                  .message-content td {
                    min-width: 100px;
                    white-space: normal;
                    word-break: break-word;
                  }
                  
                  @media (max-width: 640px) {
                    .message-content pre {
                      max-width: 100%;
                      font-size: 18px;
                    }
                    
                    .message-content th,
                    .message-content td {
                      padding: 4px;
                      font-size: 0.85rem;
                    }
                  }
                  
                  @keyframes pulse {
                    0%, 100% { transform: scaleY(1); }
                    50% { transform: scaleY(1.5); }
                  }
                  
                  @keyframes shimmer {
                    0% {
                      background-position: -200% 0;
                    }
                    100% {
                      background-position: 200% 0;
                    }
                  }
                  
                  .animate-shimmer {
                    animation: shimmer 2s infinite;
                  }
                  
                  @keyframes sound-wave {
                    0%, 100% {
                      height: 5px;
                    }
                    50% {
                      height: 30px;
                    }
                  }
                  
                  .animate-sound-wave {
                    animation: sound-wave 1s ease-in-out infinite;
                  }
                  
                  @keyframes audio-pulse {
                    0%, 100% { height: 6px; }
                    50% { height: 20px; }
                  }
                  
                  .animate-audio-pulse {
                    animation: audio-pulse 1.2s ease-in-out infinite;
                  }
                  
                  @keyframes wave {
                    0%, 100% {
                      transform: scaleY(0.5);
                    }
                    50% {
                      transform: scaleY(1);
                    }
                  }
                  
                  .animate-wave {
                    animation: wave 1.2s ease-in-out infinite;
                  }
                  
                  input[type="range"]::-webkit-slider-thumb {
                    -webkit-appearance: none;
                    appearance: none;
                    width: 12px;
                    height: 12px;
                    background: #cc2b5e;
                    border-radius: 50%;
                    cursor: pointer;
                  }
                  
                  input[type="range"]::-moz-range-thumb {
                    width: 12px;
                    height: 12px;
                    background: #cc2b5e;
                    border-radius: 50%;
                    cursor: pointer;
                    border: none;
                  }
                `}</style>
                
                <div className="w-full max-w-[95%] xs:max-w-[90%] sm:max-w-2xl md:max-w-3xl lg:max-w-4xl mx-auto">
                  {messages.map((msg, index) => {
                    const displayContent = msg.role === 'assistant' 
                      ? msg.content 
                      : sanitizeContent(msg.content);
                    
                    return (
                      <div 
                        key={index} 
                        className={`${msg.role === 'user' ? 'ml-auto' : 'mr-auto'} mb-4 max-w-[95%] xs:max-w-[80%] sm:max-w-[85%]`}>
                        <div className={`flex items-start ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                          <div className={`flex-shrink-0 ${msg.role === 'user' ? 'ml-2' : 'mr-2'} mt-1`}>
                            {msg.role === 'assistant' ? (
                              <div className="w-6 h-6 rounded-full bg-[#cc2b5e] flex items-center justify-center">
                                <HiSparkles className="w-4 h-4 text-white" />
                              </div>
                            ) : (
                              <div className="w-6 h-6 rounded-full bg-[#cc2b5e] flex items-center justify-center">
                                <FaUser className="w-3 h-3 text-white" />
                              </div>
                            )}
                          </div>
                          
                          <div className={`rounded-xl p-2 sm:p-3 overflow-hidden ${
                            msg.role === 'user' 
                              ? theme === 'dark'
                                ? 'bg-white/10 backdrop-blur-sm border border-white/20 shadow-sm text-white' 
                                : 'bg-gray-200 border border-gray-300 shadow-sm text-gray-800'
                              : theme === 'dark'
                                ? 'bg-white/5 backdrop-blur-sm border border-white/10 shadow-sm text-white'
                                : 'bg-gray-100 border border-gray-200 shadow-sm text-gray-800'
                          }`}>
                            <MessageContent content={displayContent} />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                  
                  {isGeneratingMedia && <MediaGenerationIndicator />}
                  
                  {isLoading && !isGeneratingMedia && !messages.some(msg => msg.isTemporary) && (
                    <div className="max-w-[95%] mr-auto mb-4">
                      <div className={`${theme === 'dark' ? 'bg-white/10 text-white' : 'bg-gray-100 text-gray-800'} rounded-xl p-2 sm:p-3`}>
                        <div className="flex items-center">
                          <div className="flex space-x-2 items-center">
                          {agentStatus ? (
                            <span className="ml-2 text-sm font-medium">{agentStatus}</span>
                          ) : (
                            <span className={`ml-2 text-sm ${theme === 'dark' ? 'text-white/80' : 'text-gray-600'}`}>Thinking</span>
                          )}
                          <div className="w-2 h-2 bg-[#cc2b5e] rounded-full animate-bounce"></div>
                          <div className="w-2 h-2 bg-[#cc2b5e] rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                          <div className="w-2 h-2 bg-[#cc2b5e] rounded-full animate-bounce" style={{animationDelay: '0.4s'}}></div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              
              <div className="mt-auto pb-2 sm:pb-4 px-2 sm:px-4 w-full">
                <MessageInput 
                  onSendMessage={handleSendMessage} 
                  isLoading={isLoading}
                  setIsLoading={setIsLoading}
                  onMediaRequested={handleMediaRequested}
                />
              </div>
            </div>
          ) : (
            <div className={`h-full ${theme === 'dark' ? 'bg-black' : 'bg-white'} px-2 sm:px-4 md:px-6 py-2 sm:py-4 flex flex-col items-center justify-center gap-4 sm:gap-4`}>
              <div className="items-center text-center mb-4 sm:mb-6 w-full transition-all duration-300 
                max-w-sm sm:max-w-xl md:max-w-2xl lg:max-w-3xl">
                <h1 className="text-2xl sm:text-3xl font-bold text-[#cc2b5e]">Welcome to Vaani.pro</h1>
                <p className="text-[#cc2b5e] text-2xl sm:text-xl mt-2">How may I help you?</p>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto mt-6">
                  {predefinedPrompts.map((item) => (
                    <motion.div
                      key={item.id}
                      className={`group relative ${
                        theme === 'dark' 
                          ? 'bg-white/[0.05] backdrop-blur-xl border border-white/20 hover:bg-white/[0.08] shadow-[0_0_20px_rgba(204,43,94,0.3)] hover:shadow-[0_0_20px_rgba(204,43,94,0.5)]' 
                          : 'bg-gray-100 border border-gray-200 hover:bg-gray-200 shadow-md hover:shadow-lg'
                      } rounded-xl p-4 cursor-pointer transition-all duration-300`}
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
              </div>
              
              <div className={`w-full transition-all duration-300 
                ${isSidebarVisible ? 'px-1 sm:px-2 md:px-4' : 'px-2 sm:px-4 md:px-8 lg:px-16'}`}>
                <MessageInput 
                  onSendMessage={handleSendMessage}
                  isLoading={isLoading}
                  setIsLoading={setIsLoading}
                  onMediaRequested={handleMediaRequested}
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