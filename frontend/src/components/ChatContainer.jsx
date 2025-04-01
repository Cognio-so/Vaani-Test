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
import { MediaLoadingAnimation } from './MediaComponents'

const API_URL = import.meta.env.VITE_API_URL;
const backend_url = import.meta.env.VITE_BACKEND_URL;

const ChatContainer = () => {
    // --- State ---
    const [isHistoryOpen, setIsHistoryOpen] = useState(false);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [isSidebarVisible, setIsSidebarVisible] = useState(true);
    const [messages, setMessages] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [threadId, setThreadId] = useState(null);
    const [agentStatus, setAgentStatus] = useState("");
    const [isGeneratingMedia, setIsGeneratingMedia] = useState(false);
    const [generatingMediaType, setGeneratingMediaType] = useState(null);
    const [mediaType, setMediaType] = useState(null);
    const { user } = useAuth();
    const [chatTitle, setChatTitle] = useState("New Chat");
    const [conversations, setConversations] = useState([]);
    const { theme } = useContext(ThemeContext);
    const [isLoadingChat, setIsLoadingChat] = useState(false);
    const [model, setModel] = useState("gemini-1.5-flash");
    const [useAgent, setUseAgent] = useState(false);
    const [deepResearch, setDeepResearch] = useState(false);

    // --- Refs ---
    const messagesEndRef = useRef(null);
    const chatIdRef = useRef(`temp_${Date.now()}`);
    const saveInProgress = useRef(false);
    const chatLastUpdatedRef = useRef(null);

    // --- Callbacks & Effects ---

    // ScrollToBottom (Ensure reliable scroll target)
    const scrollToBottom = useCallback(() => {
        if (scrollToBottom.isScrolling) return;
        scrollToBottom.isScrolling = true;

        requestAnimationFrame(() => {
            if (messagesEndRef.current) {
                const scrollContainer = messagesEndRef.current.closest('.overflow-y-auto');
                if (scrollContainer) {
                    scrollContainer.scrollTop = scrollContainer.scrollHeight;
                }
                messagesEndRef.current.scrollIntoView({
                    behavior: 'auto',
                    block: 'end',
                });
            }

            setTimeout(() => {
                if (messagesEndRef.current) {
                    const scrollContainer = messagesEndRef.current.closest('.overflow-y-auto');
                    if (scrollContainer) {
                        if (scrollContainer.scrollHeight > scrollContainer.clientHeight) {
                            scrollContainer.scrollTop = scrollContainer.scrollHeight;
                        }
                    }
                }
                scrollToBottom.isScrolling = false;
            }, 150);
        });
    }, []);

    // Scroll Effect
    useEffect(() => {
        if (!isLoadingChat && messages.length > 0) {
            const lastMessage = messages[messages.length - 1];
            const shouldScroll = !(lastMessage?.isTemporary && isLoading);

            if (shouldScroll) {
                const delay = lastMessage?.role === 'user' ? 50 : 150;
                const scrollTimer = setTimeout(scrollToBottom, delay);
                return () => clearTimeout(scrollTimer);
            }
        }
    }, [messages, scrollToBottom, isLoadingChat, isLoading]);


    // Fetch History Effect
    const fetchChatHistory = useCallback(async () => {
        if (!user) return;
        try {
            const response = await axios.get(`${backend_url}/api/chat/history/all`, { withCredentials: true });
            if (response.data.success) {
                const allChats = [
                    ...response.data.categories.today, ...response.data.categories.yesterday,
                    ...response.data.categories.lastWeek, ...response.data.categories.lastMonth,
                    ...response.data.categories.older,
                ];
                setConversations(allChats);
            }
        } catch (error) { console.error("Error fetching chat history:", error); }
    }, [user, backend_url]);

    useEffect(() => {
        fetchChatHistory();
    }, [fetchChatHistory]);

    // Save Chat Function (Robust version)
    const saveChat = useCallback(async (messagesToSave, currentThreadId) => {
        const currentMessages = messagesToSave && messagesToSave.length > 0 ? messagesToSave : messages;
        const finalThreadId = currentThreadId || threadId || chatIdRef.current;

        if (!user || currentMessages.length === 0 || !currentMessages.some(m => m.role === 'user') || isLoadingChat) return;
        const lastMessage = currentMessages[currentMessages.length - 1];
        if (lastMessage?.isTemporary || (lastMessage?.isLoading && !lastMessage?.content)) return;
        if (saveInProgress.current) return;

        saveInProgress.current = true;
        try {
            let title = chatTitle;
            if ((title === "New Chat" || !finalThreadId || finalThreadId.startsWith('temp_')) && currentMessages.length > 0) {
                const firstUserMsg = currentMessages.find(m => m.role === 'user');
                if (firstUserMsg) {
                    title = firstUserMsg.content.substring(0, 30) + (firstUserMsg.content.length > 30 ? "..." : "");
                    if (chatTitle === "New Chat") setChatTitle(title);
                }
            }
            const cleanMessages = currentMessages
                .filter(msg => !msg.isTemporary && !(msg.isLoading && !msg.content))
                .map(msg => ({
                    role: msg.role,
                    content: msg.content,
                }));

            if (cleanMessages.length === 0) {
                saveInProgress.current = false;
                return;
            }

            const isExistingChat = finalThreadId && !finalThreadId.startsWith('temp_');
            const preserveTimestamp = isExistingChat && chatLastUpdatedRef.current;
            const payload = { title, messages: cleanMessages };
            let response;
            if (isExistingChat) {
                response = await axios.put(`${backend_url}/api/chat/${finalThreadId}/update`, { ...payload, preserveTimestamp: !!preserveTimestamp }, { withCredentials: true });
            } else {
                response = await axios.post(`${backend_url}/api/chat/save`, { chatId: finalThreadId, ...payload }, { withCredentials: true });
            }
            if (response.data.success) {
                const savedChat = response.data.chat;
                if (savedChat.id && finalThreadId !== savedChat.id) { setThreadId(savedChat.id); chatIdRef.current = savedChat.id; }
                if (savedChat.title && savedChat.title !== chatTitle) { setChatTitle(savedChat.title); }
                chatLastUpdatedRef.current = savedChat.lastUpdated;
                fetchChatHistory();
            } else { console.error("Error saving chat (API):", response.data); }
        } catch (error) { console.error("Error saving chat (Network):", error.response?.data || error.message); }
        finally { saveInProgress.current = false; }
    }, [user, messages, chatTitle, threadId, isLoadingChat, backend_url, fetchChatHistory]);

    // Debounced Save Effect
    useEffect(() => {
        if (!user || messages.length === 0 || !messages.some(m => m.role === 'user') || isLoadingChat) return;
        const lastMessage = messages[messages.length - 1];
        if (lastMessage?.isTemporary || (lastMessage?.isLoading && !lastMessage?.content)) return;

        const saveTimer = setTimeout(() => {
            saveChat(messages, threadId || chatIdRef.current);
        }, 1500);

        return () => clearTimeout(saveTimer);
    }, [messages, user, threadId, isLoadingChat, saveChat]);


    // Media Generation Timeout & Cleanup Effects
    useEffect(() => {
        let timeoutId;
        if (isGeneratingMedia) {
            // Set a timeout to clear the generating state after 60 seconds
            timeoutId = setTimeout(() => {
                setIsGeneratingMedia(false);
                setGeneratingMediaType(null);
                setMediaType(null);
                console.warn("Media generation timed out or failed to clear state.");
            }, 60000);
        }
        return () => {
            if (timeoutId) clearTimeout(timeoutId);
        };
    }, [isGeneratingMedia]);

    useEffect(() => {
        if (!isGeneratingMedia && (generatingMediaType || mediaType)) {
            const clearTimer = setTimeout(() => {
                setGeneratingMediaType(null);
                setMediaType(null);
            }, 100);
            return () => clearTimeout(clearTimer);
        }
    }, [isGeneratingMedia, generatingMediaType, mediaType]);

    // --- API Call Handlers (Streaming) ---
    const handleReactAgentStreamingRequest = useCallback(async (userMessage, options) => {
        setIsLoading(true);
        setAgentStatus("Initializing research agent...");
        const tempMessageId = `temp_assistant_${Date.now()}`;
        let finalThreadId = threadId || chatIdRef.current;
        let accumulatedContent = "";

        setMessages(prev => [...prev, {
            role: 'assistant',
            content: '',
            isTemporary: true,
            isLoading: true,
            id: tempMessageId,
            agentStatus: "Initializing..."
        }]);

        try {
            const response = await fetch(`${API_URL}/api/react-search-streaming`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    messages: [...messages.map(msg => ({ role: msg.role, content: msg.content })),
                    { role: userMessage.role, content: userMessage.content }],
                    model: options.model,
                    thread_id: finalThreadId.startsWith('temp_') ? null : finalThreadId,
                    file_url: options.file_url,
                    max_search_results: options.deep_research ? 5 : 3
                })
            });

            if (!response.ok) {
                throw new Error(`API error (${response.status})`);
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                    if (!line.trim()) continue;
                    try {
                        const data = JSON.parse(line);

                        if (data.type === 'status') {
                            setAgentStatus(data.status);
                            setMessages(prev => prev.map(msg =>
                                msg.id === tempMessageId ?
                                    { ...msg, agentStatus: data.status } : msg
                            ));
                        } else if (data.type === 'chunk') {
                            accumulatedContent += data.chunk;
                            setMessages(prev => prev.map(msg =>
                                msg.id === tempMessageId ?
                                    { ...msg, content: accumulatedContent, isLoading: true } : msg
                            ));
                        } else if (data.type === 'result') {
                            finalThreadId = data.thread_id || finalThreadId;
                            const finalContent = data.message?.content || accumulatedContent;

                            setMessages(prev => {
                                const updated = prev.map(msg =>
                                    msg.id === tempMessageId ?
                                        {
                                            role: 'assistant',
                                            content: finalContent,
                                            id: finalThreadId,
                                            isTemporary: false,
                                            isLoading: false,
                                            agentStatus: undefined
                                        } : msg
                                );
                                if (!threadId && finalThreadId && !finalThreadId.startsWith('temp_')) {
                                    setThreadId(finalThreadId);
                                    chatIdRef.current = finalThreadId;
                                }
                                saveChat(updated, finalThreadId);
                                return updated;
                            });
                        }
                    } catch (e) {
                        console.error("Parse Error:", e, "Line:", line);
                    }
                }
            }
        } catch (error) {
            console.error("React Agent Request Error:", error);
            setMessages(prev => {
                const filtered = prev.filter(msg => msg.id !== tempMessageId);
                return [...filtered, {
                    role: 'assistant',
                    content: `Research error: ${error.message}. Please try again.`
                }];
            });
        } finally {
            setIsLoading(false);
            setAgentStatus("");
        }
    }, [messages, threadId, API_URL, saveChat]);

    const handleChatStreamingRequest = useCallback(async (userMessage, options) => {
        setIsLoading(true);
        setAgentStatus("");
        const msgText = userMessage.content.toLowerCase();
        const isMedia = /generate|create|make/.test(msgText) && /image|picture|music|audio|song/.test(msgText);
        let isMediaReq = false, genMediaType = null, medType = null;

        if (isMedia) {
            isMediaReq = true;
            genMediaType = /image|picture/.test(msgText) ? 'image' : 'audio';
            medType = genMediaType === 'image' ? 'image' : 'music';
            setIsGeneratingMedia(true);
            setGeneratingMediaType(genMediaType);
            setMediaType(medType);
        }

        const tempMessageId = `temp_assistant_${Date.now()}`;
        let finalThreadId = threadId || chatIdRef.current;

        if (!isMediaReq) {
            setMessages(prev => [...prev, { role: 'assistant', content: '', isTemporary: true, isLoading: true, id: tempMessageId }]);
        }


        try {
            const messagesToSend = messages.map(msg => ({ role: msg.role, content: msg.content }));
            messagesToSend.push({ role: userMessage.role, content: userMessage.content });

            const response = await fetch(`${API_URL}/api/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    messages: messagesToSend,
                    model: options.model,
                    thread_id: finalThreadId.startsWith('temp_') ? null : finalThreadId,
                    file_url: options.file_url,
                    use_agent: !!options.use_agent,
                    deep_research: !!options.deep_research,
                    stream: true
                })
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`API Error (${response.status}): ${errorText}`);
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';
            let fullResponse = "";
            let receivedFinal = false;
            let finalMessageData = null;

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                    if (!line.trim()) continue;
                    try {
                        const data = JSON.parse(line);

                        if (data.type === "status") {
                            setAgentStatus(data.status);
                            if (!isMediaReq) {
                                setMessages(prev => prev.map(msg => msg.id === tempMessageId ? { ...msg, agentStatus: data.status } : msg));
                            }
                        } else if (data.type === "chunk") {
                            fullResponse += data.chunk;
                            if (!isMediaReq) {
                                setMessages(prev => prev.map(msg => msg.id === tempMessageId ? { ...msg, content: fullResponse, isLoading: true, isTemporary: true } : msg));
                            }
                        } else if (data.type === "done" || data.type === "result") {
                            receivedFinal = true;
                            finalThreadId = data.thread_id || finalThreadId;
                            const finalContent = data.message?.content || fullResponse;
                            finalMessageData = {
                                ...(data.message || { role: 'assistant', content: finalContent }),
                                id: finalThreadId,
                                isTemporary: false,
                                isLoading: false,
                                agentStatus: undefined
                            };

                            const isMediaResp = /jpe?g|png|gif|webp|replicate|image-url|!\[.*?\)|mp3|wav|ogg|musicfy|audio-url/i.test(finalMessageData.content);

                            setMessages(prev => {
                                let updatedMessages;
                                if (isMediaReq) {
                                    updatedMessages = [...prev.filter(m => m.id !== tempMessageId), finalMessageData];
                                    if (!isMediaResp) {
                                        setIsGeneratingMedia(false);
                                    }
                                } else {
                                    updatedMessages = prev.map(msg => msg.id === tempMessageId ? finalMessageData : msg);
                                }
                                if (!threadId && finalThreadId && !finalThreadId.startsWith('temp_')) {
                                    setThreadId(finalThreadId);
                                    chatIdRef.current = finalThreadId;
                                }
                                saveChat(updatedMessages, finalThreadId);
                                return updatedMessages;
                            });

                            setIsLoading(false);
                            setAgentStatus("");
                            if (!isMediaResp) {
                                setIsGeneratingMedia(false);
                                setGeneratingMediaType(null);
                                setMediaType(null);
                            }
                            break;
                        }
                    } catch (e) {
                        console.error("Parse Error (Chat):", e, "Line:", line);
                        if (done && !receivedFinal) {
                            fullResponse += "\n[Stream Parse Error]";
                        }
                    }
                }
                if (receivedFinal) break;
            }
            if (!receivedFinal) {
                console.warn("Chat stream ended unexpectedly.");
                setIsLoading(false);
                setAgentStatus("");
                setIsGeneratingMedia(false);

                setMessages(prev => {
                    const finalContent = fullResponse || "[Incomplete Response]";
                    let updatedMessages;
                    if (isMediaReq) {
                        updatedMessages = [...prev, { role: 'assistant', content: finalContent, isTemporary: false, isLoading: false }];
                    } else {
                        updatedMessages = prev.map(msg => msg.id === tempMessageId ? { ...msg, content: finalContent, isTemporary: false, isLoading: false, agentStatus: undefined } : msg);
                    }
                    saveChat(updatedMessages, finalThreadId);
                    return updatedMessages;
                });
            }

        } catch (error) {
            console.error("Chat Request Error:", error);
            setIsLoading(false);
            setAgentStatus("");
            setIsGeneratingMedia(false);
            setMessages(prev => {
                const filtered = prev.filter(msg => msg.id !== tempMessageId);
                return [...filtered, { role: 'assistant', content: `Error: ${error.message}. Please try again.` }];
            });
        }
    }, [messages, threadId, API_URL, saveChat]);


    // --- UI Event Handlers ---
    const toggleSidebar = () => setIsSidebarVisible(!isSidebarVisible);

    const handleSendMessage = useCallback((messageData, options = {}) => {
        chatLastUpdatedRef.current = null;
        const userMessage = {
            role: 'user',
            content: messageData.content
        };

        if (options.file_url) {
            const fileUrl = options.file_url;
            const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(fileUrl);
            userMessage.content += `\n\n${isImage ? `![Uploaded Image](${fileUrl})` : `[Uploaded File](${fileUrl})`}`;
        }

        setMessages(prev => [...prev, userMessage]);

        const mergedOptions = {
            model: options.model || model,
            use_agent: options.use_agent !== undefined ? options.use_agent : useAgent,
            deep_research: options.deep_research !== undefined ? options.deep_research : deepResearch,
            file_url: options.file_url
        };

        if (mergedOptions.deep_research) {
            handleReactAgentStreamingRequest(userMessage, mergedOptions);
        } else {
            handleChatStreamingRequest(userMessage, mergedOptions);
        }

    }, [model, useAgent, deepResearch, handleReactAgentStreamingRequest, handleChatStreamingRequest]);


    const loadChat = useCallback(async (chatIdToLoad) => {
        if (!chatIdToLoad || isLoadingChat) return;
        setIsLoadingChat(true);
        setIsLoading(false);
        setAgentStatus("");
        setIsGeneratingMedia(false);

        try {
            const response = await axios.get(`${backend_url}/api/chat/${chatIdToLoad}`, { withCredentials: true });
            if (response.data.success) {
                const chatData = response.data.chat;
                const loadedMessages = (chatData.messages || []).map(msg => ({
                    role: msg.role,
                    content: msg.content,
                }));

                setMessages(loadedMessages);
                setChatTitle(chatData.title || "Chat");
                setThreadId(chatData.chatId);
                chatIdRef.current = chatData.chatId;
                chatLastUpdatedRef.current = chatData.lastUpdated;

                setIsHistoryOpen(false);

                requestAnimationFrame(() => {
                    setTimeout(scrollToBottom, 100);
                });

            } else {
                console.error("Failed to load chat:", response.data);
            }
        } catch (error) {
            console.error("Error loading chat:", error.response?.data || error.message);
        } finally {
            setIsLoadingChat(false);
        }
    }, [backend_url, scrollToBottom, isLoadingChat]);


    const clearConversation = useCallback(() => {
        setMessages([]);
        setThreadId(null);
        chatIdRef.current = `temp_${Date.now()}`;
        setChatTitle("New Chat");
        chatLastUpdatedRef.current = null;
        setIsLoading(false);
        setAgentStatus("");
        setIsGeneratingMedia(false);
        setGeneratingMediaType(null);
        setMediaType(null);
    }, []);


    const updateChatTitle = useCallback(async (newTitle) => {
        if (!user || !threadId || threadId.startsWith('temp_') || isLoadingChat || newTitle === chatTitle || !newTitle.trim()) return;

        const oldTitle = chatTitle;
        setChatTitle(newTitle.trim());

        try {
            const currentMessagesToSave = messages.map(msg => ({ role: msg.role, content: msg.content }));

            const response = await axios.put(
                `${backend_url}/api/chat/${threadId}/update`,
                { title: newTitle.trim(), messages: currentMessagesToSave },
                { withCredentials: true }
            );

            if (response.data.success) {
                fetchChatHistory();
                chatLastUpdatedRef.current = response.data.chat.lastUpdated;
            } else {
                setChatTitle(oldTitle);
                console.error("Update Title Error (API):", response.data);
            }
        } catch (error) {
            setChatTitle(oldTitle);
            console.error("Update Title Error (Network):", error.response?.data || error.message);
        }
    }, [user, threadId, isLoadingChat, chatTitle, messages, backend_url, fetchChatHistory]);


    const handleModelChange = useCallback((newModel) => { setModel(newModel); }, []);

    const handleInputOptionsChange = useCallback((options) => {
        if (options.use_agent !== undefined) setUseAgent(options.use_agent);
        if (options.deep_research !== undefined) setDeepResearch(options.deep_research);
    }, []);

    const handleMediaRequested = useCallback((type) => {
        setIsGeneratingMedia(true);
        setGeneratingMediaType(type);
        setMediaType(type === 'image' ? 'image' : 'music');
    }, []);

    const handleMediaLoaded = useCallback(() => {
        setIsGeneratingMedia(false);
        setGeneratingMediaType(null);
        setMediaType(null);
    }, []);


    const predefinedPrompts = [
        { id: 1, title: "General Assistant", prompt: "Hi! What can you help me with?" },
        { id: 2, title: "Writing Help", prompt: "Help me improve my writing." },
        { id: 3, title: "Code Assistant", prompt: "Explain how you can assist with coding." }
    ];
    const handlePromptClick = (item) => {
        handleSendMessage({ content: item.prompt }, { model, use_agent: useAgent, deep_research: deepResearch });
    }

    const hasActiveConversation = messages.length > 0;

    // --- JSX Structure ---
    return (
        <div className={`flex flex-col h-screen w-full overflow-hidden ${theme === 'dark' ? 'bg-black' : 'bg-white'}`}>
            {isHistoryOpen && (<div className={`fixed inset-0 z-[150] ${theme === 'dark' ? 'bg-black' : 'bg-white '}`}><ChatHistory isOpen={isHistoryOpen} onClose={() => setIsHistoryOpen(false)} conversations={conversations} onSelectConversation={loadChat} isLoading={isLoadingChat} /></div>)}
            {isSettingsOpen && (<div className={`fixed inset-0 z-[200] ${theme === 'dark' ? 'bg-black' : 'bg-white '}`}><Settings isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} onClearConversation={clearConversation} /></div>)}

            <div className="flex h-full flex-1 overflow-hidden">
                <Sidebar isVisible={isSidebarVisible} onToggle={toggleSidebar} onOpenSettings={() => setIsSettingsOpen(true)} onOpenHistory={() => setIsHistoryOpen(true)} onNewChat={clearConversation} activeChatId={threadId} />

                <main className={`flex-1 flex flex-col h-full overflow-hidden transition-all duration-300 relative ${isSidebarVisible ? 'lg:ml-64 sm:ml-16 ml-14' : 'ml-0'}`}>

                    <div className={`md:hidden h-14 sm:h-16 flex-shrink-0 ${theme === 'dark' ? 'bg-[#0A0A0A]/80' : 'bg-white/80'} backdrop-blur-sm z-10`}></div>
                    <div className="absolute top-0 left-0 right-0 h-14 sm:h-16 flex items-center justify-center md:hidden z-20 pointer-events-none">
                        <div className="flex items-center pointer-events-auto">
                            <img src="/vannipro.png" alt="Vaani.pro Logo" className="h-6 sm:h-8" />
                            <h1 className={`text-sm sm:text-lg font-bold ml-2 text-[#cc2b5e]`}>Vaani.pro</h1>
                        </div>
                    </div>
                    <div className="absolute top-4 right-4 sm:right-6 z-30 flex items-center">
                        <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full overflow-hidden border-2 border-pink-500/50">
                            <img src={user?.profilePicture || "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23cc2b5e'%3E%3Cpath d='M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z'/%3E%3C/svg%3E"} alt={user?.name || "Profile"} className="w-full h-full object-cover" onError={(e) => { e.target.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23cc2b5e'%3E%3Cpath d='M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z'/%3E%3C/svg%3E"; }} />
                        </div>
                    </div>

                    {/* Content Area (Scrollable) */}
                    {/* Increased bottom padding */}
                    <div className={`flex-1 overflow-y-auto scroll-smooth min-h-0 scrollbar-hide px-0 ${
                        hasActiveConversation
                            ? 'pb-28 md:pb-28' // Increased Padding when chat is active (mobile and desktop)
                            : 'flex items-center justify-center' // Centering when no chat
                    }`}>
                        {/* This inner container ONLY needs width/margin/padding. Centering is handled by parent. */}
                        <div className={`w-full max-w-[95%] xs:max-w-[90%] sm:max-w-3xl md:max-w-3xl mx-auto pt-4 md:pt-6 ${
                            !hasActiveConversation ? 'text-center' : '' // Add text-center for welcome screen alignment
                        }`}>
                            {hasActiveConversation ? (
                                <>
                                    {messages.map((msg, index) => {
                                        const displayContent = msg.role === 'user' ? sanitizeContent(msg.content) : msg.content;
                                        const isLastMessage = index === messages.length - 1;
                                        const isStreaming = isLastMessage && (msg.isTemporary || msg.isLoading) && isLoading && !isGeneratingMedia;

                                        return (
                                            <div key={msg.id || `msg-${index}`} className={`mb-4 w-full flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                                {msg.role === 'user' ? (
                                                    <div className={`${theme === 'dark' ? 'bg-gray-500 text-white' : 'bg-gray-300 text-black'}  rounded-2xl p-3 px-4 max-w-[85%] break-words shadow-sm backdrop-blur-sm`}>
                                                        <MessageContent content={displayContent} />
                                                    </div>
                                                ) : (
                                                    <div className={`${theme === 'dark' ? 'text-white' : 'text-gray-800'} rounded-xl p-0 w-full max-w-full pl-1 xs:pl-2 sm:pl-0`}>
                                                        <MessageContent
                                                            content={msg.content}
                                                            forceImageDisplay={true}
                                                            forceAudioDisplay={true}
                                                            onMediaLoaded={isLastMessage && isGeneratingMedia ? handleMediaLoaded : undefined}
                                                            isStreaming={isStreaming}
                                                            agentStatus={isLastMessage ? msg.agentStatus : undefined}
                                                        />
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}

                                    {/* --- Loading / Status Indicators Area --- */}
                                    <div className="w-full max-w-full pl-1 xs:pl-2 sm:pl-0 min-h-[4rem]">
                                        {isGeneratingMedia && (
                                            <div className="mb-4 flex justify-start">
                                                <MediaLoadingAnimation mediaType={mediaType || generatingMediaType} />
                                            </div>
                                        )}
                                        {!isGeneratingMedia && isLoading && agentStatus && (useAgent || deepResearch) && (
                                            <div className="mb-4 flex justify-start">
                                                <div className={`rounded-lg p-2 px-3 ${theme === 'dark' ? 'bg-white/[0.08]' : 'bg-gray-100'} shadow-sm inline-block`}>
                                                    <div className="flex items-center space-x-2">
                                                        <span className="text-xs opacity-80">{agentStatus}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                        {!isGeneratingMedia && isLoading && !agentStatus && !(messages[messages.length - 1]?.isTemporary || messages[messages.length - 1]?.isLoading) && (
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
                                </>
                            ) : (
                                // Welcome screen content
                                <div className="flex flex-col items-center w-full">
                                    <h1 className="text-xl sm:text-3xl font-bold text-[#cc2b5e]">Welcome to Vaani.pro</h1>
                                    <p className={`${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'} text-sm sm:text-xl mt-1 sm:mt-2`}>How may I help you?</p>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 max-w-5xl mx-auto mt-6 sm:mt-8 px-2 w-full mb-10">
                                        {predefinedPrompts.map((item) => (
                                            <motion.div
                                                key={item.id}
                                                // Added text-left to reset alignment inside the card
                                                className={`group relative ${theme === 'dark' ? 'bg-white/[0.05] backdrop-blur-xl border border-white/20 hover:bg-white/[0.08] shadow-[0_0_15px_rgba(204,43,94,0.2)] hover:shadow-[0_0_20px_rgba(204,43,94,0.4)]' : 'bg-gray-100 border border-gray-200 hover:bg-gray-200 shadow-md hover:shadow-lg'} rounded-xl p-4 cursor-pointer transition-all duration-150 text-left`}
                                                whileHover={{ scale: 1.03, transition: { duration: 0.15 } }}
                                                whileTap={{ scale: 0.98 }}
                                                onClick={() => handlePromptClick(item)}
                                            >
                                                <div className="relative z-10">
                                                    <h3 className={`${theme === 'dark' ? 'text-white/90' : 'text-gray-800'} font-medium text-sm mb-1`}>{item.title}</h3>
                                                    <p className={`${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'} text-xs line-clamp-2`}>{item.prompt}</p>
                                                </div>
                                            </motion.div>
                                        ))}
                                    </div>

                                    {/* --- MessageInput for DESKTOP Welcome Screen ONLY --- */}
                                    <div className="hidden md:block w-full max-w-[95%] xs:max-w-[90%] sm:max-w-3xl md:max-w-3xl mx-auto mt-8">
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
                                    {/* --- End of Desktop Welcome MessageInput --- */}
                                </div>
                            )}
                            <div ref={messagesEndRef} className="h-1" />
                        </div>
                    </div>


                    {/* Input Container (Fixed Position) */}
                    {/* Apply background, border, and padding directly to the sticky container */}
                    <div className={`w-full bottom-0 sticky z-10 ${!hasActiveConversation ? 'md:hidden' : 'block'}
                           py-2 ${theme === 'dark' ? 'bg-black ' : 'bg-white'}`}>
                        <div className={`w-full mx-auto flex-shrink-0`}>
                             {/* Removed padding and background/border from here */}
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

                </main>
            </div>
        </div>
    );
}

export default ChatContainer;