import React, { useState, useEffect, useContext } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RiSearchLine, RiCloseLine, RiAddLine } from 'react-icons/ri';
import axios from 'axios';
import { IoClose } from 'react-icons/io5';
import { ThemeContext } from '../App';

const backend_url = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';

const ChatHistory = ({ isOpen, onClose, conversations, onSelectConversation }) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [historyData, setHistoryData] = useState({});
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const { theme } = useContext(ThemeContext);

    // Fetch chat history when modal opens
    useEffect(() => {
        if (isOpen) {
            fetchChatHistory();
        }
    }, [isOpen]);

    const fetchChatHistory = async () => {
        setIsLoading(true);
        setError(null);
        
        try {
            // Use the correct API URL - assuming it's passed as a prop or defined in a constants file
            const response = await axios.get(`${backend_url}/api/chat/history/all`, {
                withCredentials: true
            });
            
            if (response.data.success) {
                // Format data for the component
                const formattedData = {
                    actions: {
                        title: "Actions",
                        items: [
                            { id: 'new_chat', title: "Create New Chat", isAction: true }
                        ]
                    }
                };
                
                // Add categories from API response only if they exist
                const { categories } = response.data;
                
                // Make sure categories exists before trying to access properties
                if (categories) {
                    if (categories.today && categories.today.length > 0) {
                        formattedData.today = {
                            title: "Today",
                            items: categories.today.map(chat => ({
                                id: chat.id,
                                title: chat.title || 'Untitled Chat',
                                time: formatTime(chat.lastUpdated),
                                preview: chat.preview,
                                lastUpdated: chat.lastUpdated // Store the original timestamp
                            }))
                        };
                    }
                    
                    if (categories.yesterday && categories.yesterday.length > 0) {
                        formattedData.yesterday = {
                            title: "Yesterday",
                            items: categories.yesterday.map(chat => ({
                                id: chat.id,
                                title: chat.title || 'Untitled Chat',
                                time: formatTime(chat.lastUpdated),
                                preview: chat.preview,
                                lastUpdated: chat.lastUpdated // Store the original timestamp
                            }))
                        };
                    }
                    
                    if (categories.lastWeek && categories.lastWeek.length > 0) {
                        formattedData.lastWeek = {
                            title: "Last 7 Days",
                            items: categories.lastWeek.map(chat => ({
                                id: chat.id,
                                title: chat.title || 'Untitled Chat',
                                time: formatTime(chat.lastUpdated),
                                preview: chat.preview,
                                lastUpdated: chat.lastUpdated // Store the original timestamp
                            }))
                        };
                    }
                    
                    if (categories.lastMonth && categories.lastMonth.length > 0) {
                        formattedData.lastMonth = {
                            title: "Last 30 Days",
                            items: categories.lastMonth.map(chat => ({
                                id: chat.id,
                                title: chat.title || 'Untitled Chat',
                                time: formatTime(chat.lastUpdated),
                                preview: chat.preview,
                                lastUpdated: chat.lastUpdated // Store the original timestamp
                            }))
                        };
                    }
                    
                    if (categories.older && categories.older.length > 0) {
                        formattedData.older = {
                            title: "Older",
                            items: categories.older.map(chat => ({
                                id: chat.id,
                                title: chat.title || 'Untitled Chat',
                                time: formatTime(chat.lastUpdated),
                                preview: chat.preview,
                                lastUpdated: chat.lastUpdated // Store the original timestamp
                            }))
                        };
                    }
                }
                
                setHistoryData(formattedData);
            } else {
                setError('Failed to fetch chat history');
            }
        } catch (err) {
            console.error('Error fetching chat history:', err);
            setError('Error fetching chat history. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    const formatTime = (dateString) => {
        const date = new Date(dateString);
        const now = new Date();
        const diffHours = Math.floor((now - date) / (1000 * 60 * 60));
        
        if (diffHours < 24) {
            return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
        } else {
            const day = date.getDate();
            const month = date.toLocaleString('default', { month: 'short' });
            return `${month} ${day}`;
        }
    };

    const handleChatSelection = (chatId, lastUpdated) => {
        if (chatId === 'new_chat') {
            // Handle creating a new chat
            onSelectConversation('new_' + Date.now());
        } else {
            console.log("Selected chat ID:", chatId);
            // Handle selecting an existing chat, ensuring we're using the permanent ID
            if (chatId && !chatId.startsWith('temp_')) {
                onSelectConversation(chatId, lastUpdated);
            } else {
                console.warn("Attempted to load chat with temporary ID:", chatId);
                // Handle the error case or use a fallback
                onSelectConversation(chatId, lastUpdated);
            }
        }
        onClose();
    };

    // Filter chats based on search query
    const filterChatsBySearch = () => {
        if (!searchQuery.trim()) return historyData;
        
        const filteredData = {};
        const query = searchQuery.toLowerCase();
        
        Object.entries(historyData).forEach(([key, section]) => {
            if (key === 'actions') {
                filteredData[key] = section; // Always keep actions
                return;
            }
            
            const filteredItems = section.items.filter(item => 
                item.title.toLowerCase().includes(query) || 
                (item.preview && item.preview.toLowerCase().includes(query))
            );
            
            if (filteredItems.length > 0) {
                filteredData[key] = {
                    title: section.title,
                    items: filteredItems
                };
            }
        });
        
        return filteredData;
    };

    const displayData = filterChatsBySearch();

    // Group conversations by date categories
    const groupedConversations = {
        today: conversations.filter(chat => {
            const chatDate = new Date(chat.lastUpdated);
            const now = new Date();
            const today = new Date(now.setHours(0, 0, 0, 0));
            return chatDate >= today;
        }),
        yesterday: conversations.filter(chat => {
            const chatDate = new Date(chat.lastUpdated);
            const now = new Date();
            const today = new Date(now.setHours(0, 0, 0, 0));
            const yesterday = new Date(today);
            yesterday.setDate(yesterday.getDate() - 1);
            return chatDate >= yesterday && chatDate < today;
        }),
        lastWeek: conversations.filter(chat => {
            const chatDate = new Date(chat.lastUpdated);
            const now = new Date();
            const today = new Date(now.setHours(0, 0, 0, 0));
            const yesterday = new Date(today);
            yesterday.setDate(yesterday.getDate() - 1);
            const lastWeek = new Date(today);
            lastWeek.setDate(lastWeek.getDate() - 7);
            return chatDate >= lastWeek && chatDate < yesterday;
        }),
        older: conversations.filter(chat => {
            const chatDate = new Date(chat.lastUpdated);
            const now = new Date();
            const today = new Date(now.setHours(0, 0, 0, 0));
            const lastWeek = new Date(today);
            lastWeek.setDate(lastWeek.getDate() - 7);
            return chatDate < lastWeek;
        })
    };

    // Helper to format preview text (truncate and strip markdown)
    const formatPreview = (text) => {
        if (!text) return 'No preview available';
        // Strip markdown and truncate
        const stripped = text
            .replace(/!\[.*?\]\(.*?\)/g, '[Image]') // Replace image markdown
            .replace(/\[.*?\]\(.*?\)/g, (match) => match.match(/\[(.*?)\]/)[1]) // Replace links with just the text
            .replace(/\*\*(.*?)\*\*/g, '$1') // Remove bold
            .replace(/\*(.*?)\*/g, '$1') // Remove italic
            .replace(/`(.*?)`/g, '$1') // Remove inline code
            .replace(/```[\s\S]*?```/g, '[Code Block]') // Replace code blocks
            .replace(/#{1,6}\s(.*?)$/gm, '$1') // Remove headings
            .trim();

        return stripped.length > 60 ? stripped.substring(0, 60) + '...' : stripped;
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Overlay Background */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 0.5 }}
                        exit={{ opacity: 0 }}
                        className={`fixed inset-0 ${theme === 'dark' ? 'bg-black' : 'bg-gray-800/20'}`}
                        onClick={onClose}
                    />

                    {/* Chat History Container */}
                    <motion.div
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.8, opacity: 0 }}
                        transition={{ type: "spring", damping: 20, stiffness: 300 }}
                        className="fixed inset-0 flex items-center justify-center"
                    >
                        <div className={`${
                            theme === 'dark' ? 'bg-[#1a1a1a]' : 'bg-white'
                        } w-[95%] max-w-4xl rounded-lg shadow-lg overflow-hidden`}>
                            {/* Header */}
                            <div className={`p-3 sm:p-4 border-b ${
                                theme === 'dark' ? 'border-gray-800' : 'border-gray-200'
                            } flex justify-between items-center`}>
                                <h2 className="text-lg sm:text-xl font-semibold text-[#cc2b5e]">Chat History</h2>
                                <button
                                    onClick={onClose}
                                    className={`p-1.5 sm:p-2 ${
                                        theme === 'dark' ? 'hover:bg-gray-800' : 'hover:bg-gray-100'
                                    } rounded-full transition-colors`}
                                >
                                    <IoClose size={24} className="text-[#cc2b5e]" />
                                </button>
                            </div>

                            {/* Search Bar */}
                            <div className="p-3 sm:p-4">
                                <div className="relative">
                                    <RiSearchLine className="absolute left-3 top-1/2 -translate-y-1/2 text-[#cc2b5e] text-lg sm:text-xl" />
                                    <input
                                        type="text"
                                        placeholder="Search..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className={`w-full ${
                                            theme === 'dark' 
                                              ? 'bg-white/[0.2] text-white' 
                                              : 'bg-gray-100 text-gray-800'
                                        } text-sm sm:text-base pl-10 pr-4 py-2 rounded-lg outline-none`}
                                    />
                                </div>
                            </div>

                            {/* Chat List */}
                            <div className="overflow-y-auto scrollbar-hide max-h-[60vh]">
                                {isLoading ? (
                                    <div className={`text-center py-8 ${
                                        theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                                    }`}>
                                        Loading chat history...
                                    </div>
                                ) : error ? (
                                    <div className="text-center py-8 text-red-400">
                                        {error}
                                    </div>
                                ) : Object.keys(displayData).length === 0 ? (
                                    <div className={`text-center py-8 ${
                                        theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                                    }`}>
                                        No chats found.
                                    </div>
                                ) : (
                                    Object.entries(displayData).map(([key, section]) => (
                                        <div key={key} className="mb-4">
                                            <div className="px-4 py-2 text-[#cc2b5e] text-sm">
                                                {section.title}
                                            </div>
                                            {section.items.map((item) => (
                                                <motion.div
                                                    key={item.id}
                                                    whileHover={{ 
                                                        backgroundColor: theme === 'dark' 
                                                            ? 'rgba(255, 255, 255, 0.1)' 
                                                            : 'rgba(0, 0, 0, 0.05)' 
                                                    }}
                                                    className="px-4 py-2 cursor-pointer"
                                                    onClick={() => handleChatSelection(item.id, item.lastUpdated)}
                                                >
                                                    <div className="flex items-center">
                                                        {item.isAction ? (
                                                            <RiAddLine className="mr-2 text-[#cc2b5e]" />
                                                        ) : null}
                                                        <div className={`${
                                                            theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                                                        } text-sm`}>
                                                            {item.title || "Untitled Chat"}
                                                        </div>
                                                    </div>
                                                    {!item.isAction && (
                                                        <>
                                                            <div className={`${
                                                                theme === 'dark' ? 'text-gray-500' : 'text-gray-500'
                                                            } text-xs mt-1`}>
                                                                {item.time || "Unknown time"}
                                                            </div>
                                                            {item.preview !== undefined && (
                                                                <div className={`${
                                                                    theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                                                                } text-xs mt-1 line-clamp-1`}>
                                                                    {formatPreview(item.preview)}
                                                                </div>
                                                            )}
                                                        </>
                                                    )}
                                                </motion.div>
                                            ))}
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
};

export default ChatHistory; 