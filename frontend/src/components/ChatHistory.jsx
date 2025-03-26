import React, { useState, useEffect, useContext } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RiSearchLine, RiCloseLine, RiAddLine } from 'react-icons/ri';
import axios from 'axios';
import { IoClose } from 'react-icons/io5';
import { ThemeContext } from '../App';

const backend_url = import.meta.env.VITE_BACKEND_URL;

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

    // Enhanced fetchChatHistory with strict deduplication
    const fetchChatHistory = async () => {
        setIsLoading(true);
        setError(null);

        try {
            const response = await axios.get(`${backend_url}/api/chat/history/all`, {
                withCredentials: true,
                timeout: 10000 // 10 second timeout
            });

            if (response.data.success) {
                const formattedData = {
                    actions: {
                        title: "Actions",
                        items: [
                            { id: 'new_chat', title: "Create New Chat", isAction: true }
                        ]
                    }
                };

                // Use a Map to strictly deduplicate chats by ID
                const allChatsById = new Map();

                const { categories } = response.data;

                if (categories) {
                    // Combine all chats from all categories into one pool first
                    const allChats = [
                        ...(categories.today || []),
                        ...(categories.yesterday || []),
                        ...(categories.lastWeek || []),
                        ...(categories.lastMonth || []),
                        ...(categories.older || [])
                    ].filter(chat => chat && chat.id && typeof chat.id === 'string'); // Filter invalid chats

                    // Deduplicate and keep the most complete/recent version
                    allChats.forEach(chat => {
                        const existingChat = allChatsById.get(chat.id);
                        const currentMsgCount = chat.messages ? chat.messages.length : 0;
                        const existingMsgCount = existingChat?.messages ? existingChat.messages.length : 0;
                        const currentUpdated = new Date(chat.lastUpdated || 0).getTime();
                        const existingUpdated = new Date(existingChat?.lastUpdated || 0).getTime();

                        // Keep the chat with more messages or, if equal, the most recent timestamp
                        if (!existingChat || 
                            currentMsgCount > existingMsgCount || 
                            (currentMsgCount === existingMsgCount && currentUpdated > existingUpdated)) {
                            allChatsById.set(chat.id, { ...chat, messageCount: currentMsgCount });
                        }
                    });

                    // Function to process and categorize chats
                    const processCategory = (categoryName, filterFn) => {
                        const categoryChats = Array.from(allChatsById.values())
                            .filter(chat => filterFn(new Date(chat.lastUpdated)))
                            .sort((a, b) => new Date(b.lastUpdated) - new Date(a.lastUpdated));

                        if (categoryChats.length === 0) return null;

                        return {
                            title: categoryName,
                            items: categoryChats.map(chat => ({
                                id: chat.id,
                                title: chat.title || 'Untitled Chat',
                                time: formatTime(chat.lastUpdated),
                                preview: chat.preview,
                                lastUpdated: chat.lastUpdated,
                                messageCount: chat.messageCount || 0
                            }))
                        };
                    };

                    // Define time filters
                    const now = new Date();
                    const todayStart = new Date(now.setHours(0, 0, 0, 0));
                    const yesterdayStart = new Date(todayStart);
                    yesterdayStart.setDate(yesterdayStart.getDate() - 1);
                    const lastWeekStart = new Date(todayStart);
                    lastWeekStart.setDate(lastWeekStart.getDate() - 7);
                    const lastMonthStart = new Date(todayStart);
                    lastMonthStart.setDate(lastMonthStart.getDate() - 30);

                    // Process each category with strict time boundaries
                    const today = processCategory("Today", date => date >= todayStart);
                    if (today) formattedData.today = today;

                    const yesterday = processCategory("Yesterday", date => date >= yesterdayStart && date < todayStart);
                    if (yesterday) formattedData.yesterday = yesterday;

                    const lastWeek = processCategory("Last 7 Days", date => date >= lastWeekStart && date < yesterdayStart);
                    if (lastWeek) formattedData.lastWeek = lastWeek;

                    const lastMonth = processCategory("Last 30 Days", date => date >= lastMonthStart && date < lastWeekStart);
                    if (lastMonth) formattedData.lastMonth = lastMonth;

                    const older = processCategory("Older", date => date < lastMonthStart);
                    if (older) formattedData.older = older;
                }

                setHistoryData(formattedData);
            } else {
                setError('Failed to fetch chat history');
                console.error("Error in history response:", response.data);
            }
        } catch (err) {
            console.error('Error fetching chat history:', err);
            if (err.response) {
                console.error("Error response data:", err.response.data);
            }
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

    // Improved chat selection handler
    const handleChatSelection = (chatId) => {
        if (chatId === 'new_chat') {
            onSelectConversation('new_' + Date.now());
        } else {

            if (chatId && typeof chatId === 'string') {
                if (chatId.startsWith('temp_')) {
                    console.warn("Attempted to load chat with temporary ID:", chatId);
                }
                onSelectConversation(chatId);
            } else {
                console.error("Invalid chat ID:", chatId);
                onSelectConversation('new_' + Date.now());
            }
        }

        setTimeout(() => onClose(), 100);
    };

    // Filter chats based on search query
    const filterChatsBySearch = () => {
        if (!searchQuery.trim()) return historyData;

        const filteredData = {};
        const query = searchQuery.toLowerCase();

        Object.entries(historyData).forEach(([key, section]) => {
            if (key === 'actions') {
                filteredData[key] = section;
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

    // Add delete chat functionality
    const deleteChat = async (chatId, event) => {
        if (!chatId || chatId === 'new_chat' || chatId.startsWith('temp_')) return;
        
        // Prevent event propagation to parent elements
        event.stopPropagation();
        
        try {
            const response = await axios.delete(`${backend_url}/api/chat/${chatId}`, {
                withCredentials: true
            });
            
            if (response.data.success) {
                fetchChatHistory(); // Refresh the list
            }
        } catch (error) {
            console.error("Error deleting chat:", error);
        }
    };

    // Removed redundant groupedConversations since we're using historyData
    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 0.5 }}
                        exit={{ opacity: 0 }}
                        className={`fixed inset-0 ${theme === 'dark' ? 'bg-black' : 'bg-gray-800/20'}`}
                        onClick={onClose}
                    />

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
                                                    className="px-4 py-2 cursor-pointer relative group"
                                                    onClick={() => handleChatSelection(item.id)}
                                                >
                                                    <div className="flex items-center justify-between">
                                                        <div className="flex items-center flex-1">
                                                            {item.isAction ? (
                                                                <RiAddLine className="mr-2 text-[#cc2b5e]" />
                                                            ) : null}
                                                            <div className={`${
                                                                theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                                                            } text-sm truncate`}>
                                                                {item.title || "Untitled Chat"}
                                                            </div>
                                                        </div>
                                                        
                                                        {!item.isAction && (
                                                            <button 
                                                                className={`opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-full ${
                                                                    theme === 'dark' ? 'hover:bg-gray-800' : 'hover:bg-gray-200'
                                                                }`}
                                                                onClick={(e) => deleteChat(item.id, e)}
                                                            >
                                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-red-500" viewBox="0 0 20 20" fill="currentColor">
                                                                    <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                                                                </svg>
                                                            </button>
                                                        )}
                                                    </div>
                                                    
                                                    {!item.isAction && (
                                                        <>
                                                            <div className={`${
                                                                theme === 'dark' ? 'text-gray-500' : 'text-gray-500'
                                                            } text-xs mt-1`}>
                                                                {item.time || " GuilUnknown time"}
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

// Helper to format preview text (unchanged)
const formatPreview = (text) => {
    if (!text) return 'No preview available';
    const stripped = text
        .replace(/!\[.*?\]\(.*?\)/g, '[Image]')
        .replace(/\[.*?\]\(.*?\)/g, (match) => match.match(/\[(.*?)\]/)[1])
        .replace(/\*\*(.*?)\*\*/g, '$1')
        .replace(/\*(.*?)\*/g, '$1')
        .replace(/`(.*?)`/g, '$1')
        .replace(/```[\s\S]*?```/g, '[Code Block]')
        .replace(/#{1,6}\s(.*?)$/gm, '$1')
        .trim();

    return stripped.length > 60 ? stripped.substring(0, 60) + '...' : stripped;
};

export default ChatHistory;