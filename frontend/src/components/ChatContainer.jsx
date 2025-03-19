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

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api'
const backend_url = import.meta.env.VITE_BACKEND_URL || 'https://vanni-test-backend.vercel.app' || 'https://vanni-test-backend.vercel.app'

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

  // Modify the handleReactAgentRequest function to use streaming
  const handleReactAgentStreamingRequest = async (message, options = {}) => {
    if (message.role === 'user') {
        setIsLoading(true);
      setAgentStatus("Initializing research agent...");
      
      // Reference to the AbortController
      const controller = new AbortController();
      const signal = controller.signal;
      
      try {
        // Make a streaming request
        const response = await fetch(`${API_URL}/react-search-streaming`, {
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
        
        // Create a reader for the stream
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        
        // Add a temporary "researching" message that will be updated with status
        const tempMessageId = Date.now();
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: 'Researching...',
          isTemporary: true,
          id: tempMessageId
        }]);
        
        // Read the stream
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          
          // Decode the chunk
          const chunk = decoder.decode(value);
          const lines = chunk.split('\n').filter(line => line.trim());
          
          for (const line of lines) {
            try {
              const data = JSON.parse(line);
              
              if (data.type === 'status') {
                // Update status message only
                setAgentStatus(data.status);
                
                // Update the temporary message with the current status
                setMessages(prev => prev.map(msg => 
                  msg.id === tempMessageId
                    ? { ...msg, content: `**Researching**: ${data.status}` }
                    : msg
                ));
              } 
              else if (data.type === 'result') {
                // We have the final result, remove the temporary message and add the real one
                // Small delay to show the "complete" message
                await new Promise(resolve => setTimeout(resolve, 500));
                
                // Then replace with the real message
                setMessages(prev => prev.filter(msg => msg.id !== tempMessageId).concat([data.message]));
            
            // Save thread ID for future messages
                if (!threadId && data.thread_id) {
                  setThreadId(data.thread_id);
                }
                // Add this line to save the chat after streaming completes
                setTimeout(() => saveChat(), 500);
              }
            } catch (parseError) {
              console.error("Error parsing stream data:", parseError);
            }
          }
            }
        } catch (error) {
        console.error("Error with streaming react-agent:", error);
        
        // Remove temporary message
        setMessages(prev => prev.filter(msg => !msg.isTemporary));
            
            // Add error message
            setMessages(prev => [...prev, {
                role: 'assistant',
                content: 'Sorry, I encountered an error with the research agent. Please try again.'
            }]);
        } finally {
            setIsLoading(false);
        setAgentStatus("");
        // Add this line to ensure chats are saved even after errors
        setTimeout(() => saveChat(), 500);
        }
    }
  };

  // Add this function to fetch chat history
  const fetchChatHistory = async () => {
    if (!user) return;
    
    try {
      const response = await axios.get(`${backend_url}/api/chat/history/all`, {
        withCredentials: true
      });
      
      if (response.data.success) {
        // Combine all categories into one array for the sidebar
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
  
  // Fetch chat history when component mounts or user changes
  useEffect(() => {
    if (user) {
      fetchChatHistory();
    }
  }, [user]);
  
  // Add this function to save the current chat
  const saveChat = async () => {
    if (!user || messages.length < 2 || !messages.some(m => m.role === 'user') || !messages.some(m => m.role === 'assistant')) return; // Save only if there's at least one user and one assistant message
    
    try {
      const chatId = threadId || `temp_${Date.now()}`;
      let title = chatTitle;
      if (title === "New Chat" && messages.length > 0) {
        const firstUserMsg = messages.find(m => m.role === 'user');
        if (firstUserMsg) {
          title = firstUserMsg.content.substring(0, 30);
          if (firstUserMsg.content.length > 30) title += "...";
        }
      }
      
      console.log("Saving chat with ID:", chatId);
      
      const response = await axios.post(`${backend_url}/api/chat/save`, {
        chatId,
        title,
        messages
      }, {
        withCredentials: true
      });
      
      if (response.data.success) {
        if (response.data.chat.id && (!threadId || threadId.startsWith('temp_'))) {
          console.log("Updating thread ID from", threadId, "to", response.data.chat.id);
          setThreadId(response.data.chat.id);
        }
        fetchChatHistory();
        console.log("Chat saved successfully");
      }
    } catch (error) {
      console.error("Error saving chat:", error);
    }
  };

  // Add a useEffect to watch for message changes and save
  useEffect(() => {
    if (messages.length >= 2 && messages.some(m => m.role === 'user') && messages.some(m => m.role === 'assistant') && user) {
      const saveTimer = setTimeout(() => saveChat(), 500);
      return () => clearTimeout(saveTimer);
    }
  }, [messages]);

  // Update handleSendMessage to use the streaming function for deep research
  const handleSendMessage = (message, options = {}) => {
    // First add the user message to the messages state
    const userMessage = { ...message };
    
    // If there's a file URL, include it in the message content
    if (options.file_url) {
        const fileUrl = options.file_url;
        console.log("File URL to include:", fileUrl);
        
        // Check if it's an image by extension
        const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(fileUrl);
        
        // Add the file link to the message content
        if (isImage) {
            // Append image markdown to the existing content
            userMessage.content = `${userMessage.content}\n\n![Uploaded Image](${fileUrl})`;
        } else {
            // For non-images, add as a regular link
            userMessage.content = `${userMessage.content}\n\n[Uploaded File](${fileUrl})`;
        }
    }
    
    // Update messages array with the modified user message
    setMessages(prev => [...prev, userMessage]);

    if (userMessage.role !== 'user') return;

    // More robust detection with proper prioritization
    const messageText = userMessage.content.toLowerCase();
    
    // Audio/music detection - check these FIRST
    const songTerms = ['song', 'music', 'audio', 'tune', 'melody', 'compose'];
    const audioVerbs = ['generate', 'create', 'make', 'compose', 'play'];
    
    // Check for audio/music terms as the primary action
    const isAudioRequest = 
      songTerms.some(term => messageText.includes(term)) &&
      (audioVerbs.some(verb => messageText.includes(verb)) || 
       messageText.startsWith('play') || 
       messageText.startsWith('sing'));
    
    // Image detection - only if not already detected as audio
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

    console.log("Media detection:", { 
      text: messageText,
      isAudio: isAudioRequest, 
      isImage: isImageRequest 
    });

    // Set correct media type based on detection
    if (isAudioRequest) {
      console.log("Audio generation detected!");
      setIsGeneratingMedia(true);
      setGeneratingMediaType('audio');
    } else if (isImageRequest) {
      console.log("Image generation detected!");
      setIsGeneratingMedia(true);
      setGeneratingMediaType('image');
    }

    // Proceed with the API request
    setIsLoading(true);
    
    // Rest of your code for API requests...
    if (options.deep_research) {
      handleReactAgentStreamingRequest(userMessage, options);
    } else {
      axios.post(`${API_URL}/chat`, {
        messages: [...messages, userMessage],
        model: options.model,
        thread_id: threadId,
        file_url: options.file_url,
        use_agent: options.use_agent || false,
        deep_research: false
      })
      .then(response => {
        // Add the response to messages
        setMessages(prev => [...prev, response.data.message]);
        
        // Reset media generation states
        setIsGeneratingMedia(false);
        setGeneratingMediaType(null);
        
        // Update thread ID BEFORE saving the chat
        if (response.data.thread_id) {
          // Only update if we have a valid thread ID from the server
          console.log("Received thread ID from server:", response.data.thread_id);
          setThreadId(response.data.thread_id);
          
          // Small delay to ensure state is updated before saving
          setTimeout(() => saveChat(), 100);
        } else {
          // If no thread ID in response, just save as normal
          setTimeout(() => saveChat(), 500);
        }
      })
      .catch(error => {
        console.error("Error sending message:", error);
        
        // Add error message
        setMessages(prev => [...prev, {
            role: 'assistant',
            content: 'Sorry, I encountered an error. Please try again.'
        }]);
    
    // Reset media states on error
    setIsGeneratingMedia(false);
    setGeneratingMediaType(null);
      })
      .finally(() => {
          setIsLoading(false);
      });
    }
  };

  // Add loadChat function to load a specific chat
  const loadChat = async (chatId) => {
    try {
      const response = await axios.get(`${backend_url}/api/chat/${chatId}`, {
        withCredentials: true
      });
      
      if (response.data.success) {
        setMessages(response.data.chat.messages);
        setChatTitle(response.data.chat.title);
        setThreadId(response.data.chat.chatId);
        setIsHistoryOpen(false); // Close history panel after selection
      }
    } catch (error) {
      console.error("Error loading chat:", error);
    }
  };

  // Modify clearConversation to create a new chat
  const clearConversation = () => {
    setMessages([]);
    setThreadId(null);
    setChatTitle("New Chat");
  };

  // Check if we're in an active conversation (has messages)
  const hasActiveConversation = messages.length > 0

  // New helper function to extract image and music URLs from message content
  const extractMediaUrls = (content) => {
    if (!content) return { text: '', imageUrls: [], musicUrls: [] };
    
    const imageRegex = /!\[(.*?)\]\((https?:\/\/\S+\.(?:jpg|jpeg|png|gif|webp))\)|(?<!\[)(https?:\/\/\S+\.(?:jpg|jpeg|png|gif|webp))(?!\])/gi;
    // Updated regex to better catch complex music URLs with query parameters
    const musicRegex = /(https?:\/\/\S+\.(?:mp3|wav|ogg|m4a)(?:\S*))|(https?:\/\/(?:api\.musicfy\.lol|replicate\.delivery|replicate\.com|\w+\.(?:r2\.cloudflarestorage|cloudfront|amazonaws))\.com\/\S+)/gi;
    
    const imageUrls = [];
    const musicUrls = [];
    
    // Extract image URLs
    let imageMatch;
    while ((imageMatch = imageRegex.exec(content)) !== null) {
      imageUrls.push(imageMatch[2] || imageMatch[0]);
    }
    
    // Extract music URLs
    let musicMatch;
    while ((musicMatch = musicRegex.exec(content)) !== null) {
      musicUrls.push(musicMatch[0]);
    }
    
    // Remove the media URLs from the content if they appear on their own line
    let text = content;
    [...imageUrls, ...musicUrls].forEach(url => {
      // More aggressive URL removal for both standalone URLs and inline URLs
      // Remove URL if it's on its own line
      text = text.replace(new RegExp(`^${url.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')}$`, 'gm'), '');
      // Remove URL if it's in a paragraph
      text = text.replace(new RegExp(url.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'), 'g'), '');
      // Also remove markdown image syntax
      text = text.replace(new RegExp(`!\\[.*?\\]\\(${url.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')}\\)`, 'g'), '');
    });
    
    return { text, imageUrls, musicUrls };
  };

  // Add this new component for the modern audio player
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

    // Add download function
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

    // Format time as mm:ss
    const formatTime = (time) => {
      const minutes = Math.floor(time / 60);
      const seconds = Math.floor(time % 60);
      return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
    };

    return (
      <div className="rounded-xl overflow-hidden shadow-lg">
        <div className={`${theme === 'dark' ? 'bg-gradient-to-r from-[#1a1a1a] to-[#2a2a2a] border border-white/10' : 'bg-gradient-to-r from-gray-100 to-gray-200 border border-gray-300'} p-4`}>
          {/* Hidden audio element for functionality */}
          <audio 
            ref={audioRef}
            src={url} 
            onTimeUpdate={handleTimeUpdate}
            onLoadedMetadata={handleLoadedMetadata}
            onEnded={() => setIsPlaying(false)}
            className="hidden"
          />
          
          {/* Music Info */}
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
            {/* Download button */}
            <button 
              onClick={handleDownload}
              className="bg-[#cc2b5e]/80 hover:bg-[#cc2b5e] text-white rounded-full w-8 h-8 flex items-center justify-center transition-all shadow-md"
              title="Download audio"
            >
              <FaDownload className="w-3 h-3" />
            </button>
          </div>
          
          {/* Waveform Visualization with theme-conditional colors */}
          <div className="h-16 mb-2 flex items-center justify-center">
            <div className="flex items-end space-x-[2px] w-full">
              {[...Array(40)].map((_, i) => {
                // Create a dynamic wave pattern based on position and playback
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
          
          {/* Controls */}
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

  // Then update the MessageContent component to use the ModernAudioPlayer
  const MessageContent = ({ content }) => {
    const { theme } = useContext(ThemeContext);
    const { text, imageUrls, musicUrls } = extractMediaUrls(content);
    
    // Add download image function
    const handleImageDownload = (url) => {
      const a = document.createElement('a');
      a.href = url;
      a.download = 'image-' + Date.now() + '.jpg';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    };
    
    return (
      <div className={`message-content break-words ${theme === 'dark' ? 'text-white' : 'text-gray-800'}`}>
        {/* Render the text content with markdown */}
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
                // Make links open in new tab but exclude image/music URLs
                a: ({ node, ...props }) => {
                  // Skip rendering download links for media files
                  const href = props.href || '';
                  const isMediaUrl = /\.(jpg|jpeg|png|gif|webp|mp3|wav|ogg)$/i.test(href) || 
                                    href.includes('musicfy.lol') || 
                                    href.includes('replicate');
                  
                  if (isMediaUrl) {
                    return null; // Don't render media links
                  }
                  
                  return (
                    <a {...props} target="_blank" rel="noopener noreferrer" className="text-[#cc2b5e] underline" />
                  );
                },
                // Style tables
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
        
        {/* Render images with fully responsive sizing and download button */}
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
                {/* Make download button always visible and more prominent */}
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
        
        {/* Replace the standard audio player with our modern one */}
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

  // Also update the sanitizeContent function
  const sanitizeContent = (content) => {
    if (!content) return '';
    
    // Replace plain URLs with a non-clickable placeholder - more comprehensive pattern
    return content.replace(
      /(https?:\/\/\S+\.(jpg|jpeg|png|gif|webp|mp3|wav|ogg|m4a)(\?\S*)?)/gi, 
      '[media]'
    ).replace(
      /(https?:\/\/(?:api\.musicfy\.lol|replicate\.delivery|replicate\.com|\w+\.(?:r2\.cloudflarestorage|cloudfront|amazonaws))\.com\/\S+)/gi,
      '[media]'
    );
  };

  // Add this simple component
  const MediaGenerationIndicator = () => {
    return (
      <div className="max-w-[95%] mr-auto mb-4">
        <div className="bg-white/10 text-white rounded-xl p-3">
          <div className="flex items-center">
            <div className="mr-3">
              {generatingMediaType === 'image' ? (
                <div className="w-8 h-8 rounded-full border-2 border-[#cc2b5e] border-t-transparent animate-spin"></div>
              ) : (
                <div className="flex space-x-1 h-8 items-center">
                  {[...Array(3)].map((_, i) => (
                    <div 
                      key={i}
                      className="w-1.5 bg-[#cc2b5e] rounded-full"
                      style={{
                        height: `${10 + i * 3}px`,
                        animation: 'pulse 1s ease-in-out infinite',
                        animationDelay: `${i * 0.15}s`
                      }}
                    ></div>
                  ))}
                </div>
              )}
            </div>
            <div>
              <p className="text-sm font-medium">
                {generatingMediaType === 'image' 
                  ? 'Creating image...' 
                  : 'Generating audio...'}
              </p>
              <p className="text-xs text-white/60">
                This may take a moment
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Add this new component
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

  // Add a handler for media requests directly from the input
  const handleMediaRequested = (mediaType) => {
    console.log(`Media requested from input: ${mediaType}`);
    setIsGeneratingMedia(true);
    setGeneratingMediaType(mediaType);
  };

  return (
    <div className={`relative h-screen ${theme === 'dark' ? 'bg-custom-gradient' : 'bg-white'} px-2 sm:px-4 md:px-6 py-2 sm:py-4 overflow-hidden`}>
      {/* Logo in top center for responsive mode */}
      <div className={`md:hidden fixed top-0 left-0 right-0 flex items-center justify-center py-4 z-30 ${theme === 'dark' ? 'bg-black' : 'bg-white border-b border-gray-200'}`}>
        <div className="flex items-center">
          <img src="/vannipro.png" alt="Vaani.pro Logo" className="w-8 h-6" />
          <h1 className="text-lg font-bold ml-2 text-[#cc2b5e]">Vaani.pro</h1>
        </div>
      </div>

      {/* Chat History Dropdown */}
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

      {/* Settings Dropdown */}
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
            // Chat messages view
            <div className="h-full flex flex-col">
              <div 
                className="flex-1 overflow-y-auto px-0 sm:px-2 md:px-4 py-4 sm:py-4"
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
                  
                  @media (max-width: 640px) {
                    .message-content pre {
                      max-width: 100%;
                      font-size: 18px;
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
                  
                  /* Custom styles for range input */
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
                  {/* Increased top padding for mobile screens */}
                  <div className="md:pt-0 pt-20"></div>
                  {messages.map((msg, index) => {
                    const displayContent = msg.role === 'assistant' 
                      ? msg.content 
                      : sanitizeContent(msg.content);
                    
                    return (
                      <div 
                        key={index} 
                        className={`${msg.role === 'user' ? 'ml-auto' : 'mr-auto'} mb-4 max-w-[95%] xs:max-w-[80%] sm:max-w-[85%]`}>
                        <div className={`flex items-start ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                          {/* Avatar icon */}
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
                          
                          {/* Message content */}
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
                  
                  {/* Add the media generation indicator */}
                  {isGeneratingMedia && <MediaGenerationIndicator />}
                  
                  {/* Keep the existing loading indicator with a condition to not show both at once */}
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
            // Welcome view
            <div className={`h-full ${theme === 'dark' ? 'bg-black' : 'bg-white'} px-2 sm:px-4 md:px-6 py-2 sm:py-4 flex flex-col items-center justify-center gap-4 sm:gap-4`}>
              <div className="items-center text-center mb-4 sm:mb-6 w-full transition-all duration-300 
                max-w-sm sm:max-w-xl md:max-w-2xl lg:max-w-3xl">
                <h1 className="text-2xl sm:text-3xl font-bold text-[#cc2b5e]">Welcome to Vaani.pro</h1>
                <p className="text-[#cc2b5e] text-2xl sm:text-xl mt-2">How may I help you?</p>
                
                {/* Predefined Prompts Grid */}
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