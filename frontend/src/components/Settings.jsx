import React, { useState, useContext } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RiArrowLeftLine, RiLogoutBoxLine } from 'react-icons/ri';
import { ThemeContext } from '../App';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';


const backend_url = import.meta.env.VITE_BACKEND_URL 

const Settings = ({ isOpen, onClose }) => {
    const [activeTab, setActiveTab] = useState('general');
    const { theme, setTheme } = useContext(ThemeContext);
    const { user, logout } = useAuth();
    const navigate = useNavigate();

    const tabs = [
        { id: 'general', label: 'General' },
        { id: 'model', label: 'Model Info' },
        { id: 'upgrade', label: 'Upgrade Plan' },
        { id: 'account', label: 'Account' },
        { id: 'theme', label: 'Theme' }
    ];

    const handleLogout = async () => {
        try {
            await axios.post(`${backend_url}/auth/logout`, {}, {
                withCredentials: true
            });
            logout();
            onClose();
            navigate('/login');
        } catch (error) {
            console.error("Error logging out:", error);
        }
    };

    const renderContent = () => {
        switch (activeTab) {
            case 'general':
                return (
                    <div className="space-y-4 sm:space-y-6">
                        <h3 className={`text-lg sm:text-xl md:text-2xl font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-800'}`}>General Settings</h3>
                        <div className="space-y-3 sm:space-y-4">
                            <div className={`flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 ${theme === 'dark' ? 'text-white' : 'text-gray-800'}`}>
                                <span className="text-sm sm:text-base">Language</span>
                                <select className={`${theme === 'dark' ? 'bg-black/40 border-white/10 text-white' : 'bg-gray-100 border-gray-300 text-gray-800'} rounded-md px-2 py-1 sm:px-3 sm:py-2 border w-full sm:w-40 text-sm sm:text-base`}>
                                    <option>English</option>
                                    <option>Spanish</option>
                                    <option>French</option>
                                </select>
                            </div>
                            <div className={`flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 ${theme === 'dark' ? 'text-white' : 'text-gray-800'}`}>
                                <span className="text-sm sm:text-base">Notifications</span>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input type="checkbox" className="sr-only peer" />
                                    <div className={`w-9 h-5 sm:w-11 sm:h-6 ${theme === 'dark' ? 'bg-gray-700' : 'bg-gray-300'} peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 sm:after:h-5 sm:after:w-5 after:transition-all peer-checked:bg-[#cc2b5e]`}></div>
                                </label>
                            </div>
                        </div>
                    </div>
                );
            case 'model':
                return (
                    <div className="space-y-4 sm:space-y-6">
                        <h3 className={`text-lg sm:text-xl md:text-2xl font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-800'}`}>Model Information</h3>
                        <div className="space-y-3 sm:space-y-4">
                            <div className={`${theme === 'dark' ? 'bg-black/40 border-white/10' : 'bg-gray-100 border-gray-300'} p-3 sm:p-4 md:p-6 rounded-lg border`}>
                                <h4 className={`font-medium text-sm sm:text-base md:text-lg ${theme === 'dark' ? 'text-white' : 'text-gray-800'}`}>Current Model: GPT-4</h4>
                                <p className={`${theme === 'dark' ? 'text-white/60' : 'text-gray-600'} mt-2 text-xs sm:text-sm`}>Version: 4.0</p>
                                <p className={`${theme === 'dark' ? 'text-white/60' : 'text-gray-600'} text-xs sm:text-sm`}>Last Updated: June 2024</p>
                            </div>
                        </div>
                    </div>
                );
            case 'upgrade':
                return (
                    <div className="space-y-4 sm:space-y-6">
                        <h3 className={`text-lg sm:text-xl md:text-2xl font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-800'}`}>Upgrade Your Plan</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
                            {['Basic', 'Pro', 'Enterprise'].map((plan) => (
                                <div key={plan} className={`${theme === 'dark' ? 'bg-black/40 border-white/10' : 'bg-gray-100 border-gray-300'} p-4 sm:p-6 rounded-lg text-center border`}>
                                    <h4 className={`text-base sm:text-lg font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-800'}`}>{plan}</h4>
                                    <p className={`mt-2 sm:mt-4 text-xs sm:text-sm ${theme === 'dark' ? 'text-white/60' : 'text-gray-600'}`}>Starting from</p>
                                    <p className={`text-xl sm:text-2xl font-bold mt-1 sm:mt-2 ${theme === 'dark' ? 'text-white' : 'text-gray-800'}`}>$9.99/mo</p>
                                    <button className={`mt-3 sm:mt-4 ${theme === 'dark' ? 'bg-white/10 hover:bg-white/20 text-white' : 'bg-gray-200 hover:bg-gray-300 text-gray-800'} px-3 py-1 sm:px-4 sm:py-2 rounded-md text-sm sm:text-base`}>
                                        Select Plan
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                );
            case 'account':
                return (
                    <div className="space-y-4 sm:space-y-6">
                        <h3 className={`text-lg sm:text-xl md:text-2xl font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-800'}`}>Account Settings</h3>
                        <div className="space-y-3 sm:space-y-4">
                            <div className="flex items-center space-x-3 sm:space-x-4">
                                <div className={`w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 ${theme === 'dark' ? 'bg-black/40 border-white/10' : 'bg-gray-100 border-gray-300'} rounded-full border flex items-center justify-center relative z-[100]`}>
                                    {user && user.name ? (
                                        <span className={`text-lg sm:text-xl md:text-2xl font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-800'}`}>
                                            {user.name.charAt(0).toUpperCase()}
                                        </span>
                                    ) : (
                                        <span className={`text-lg sm:text-xl md:text-2xl font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-800'}`}>U</span>
                                    )}
                                </div>
                            </div>
                            
                            <div className={`${theme === 'dark' ? 'bg-black/20' : 'bg-gray-50'} p-3 sm:p-4 rounded-lg`}>
                                <h4 className={`text-xs sm:text-sm font-medium mb-2 ${theme === 'dark' ? 'text-white/80' : 'text-gray-600'}`}>Current User Information</h4>
                                <p className={`${theme === 'dark' ? 'text-white' : 'text-gray-800'} mb-1 text-xs sm:text-sm`}>
                                    <span className={`${theme === 'dark' ? 'text-white/60' : 'text-gray-500'} mr-2`}>Name:</span> 
                                    {user?.name || 'Not set'}
                                </p>
                                <p className={`${theme === 'dark' ? 'text-white' : 'text-gray-800'} text-xs sm:text-sm`}>
                                    <span className={`${theme === 'dark' ? 'text-white/60' : 'text-gray-500'} mr-2`}>Email:</span> 
                                    {user?.email || 'Not set'}
                                </p>
                            </div>
                            
                            <input 
                                type="text" 
                                placeholder="Name" 
                                className={`w-full ${theme === 'dark' ? 'bg-black/40 text-white border-white/10 placeholder-white/40' : 'bg-gray-100 text-gray-800 border-gray-300 placeholder-gray-500/40'} rounded-md px-3 py-1.5 sm:px-4 sm:py-2 border text-sm sm:text-base`}
                                defaultValue={user?.name || ''}
                            />
                            <input 
                                type="email" 
                                placeholder="Email" 
                                className={`w-full ${theme === 'dark' ? 'bg-black/40 text-white border-white/10 placeholder-white/40' : 'bg-gray-100 text-gray-800 border-gray-300 placeholder-gray-500/40'} rounded-md px-3 py-1.5 sm:px-4 sm:py-2 border text-sm sm:text-base`}
                                defaultValue={user?.email || ''}
                                readOnly
                            />
                            <button 
                                onClick={handleLogout} 
                                className="w-full mt-2 py-1.5 sm:py-2 px-4 rounded-md bg-gray-600 hover:bg-gray-700 text-white transition-colors text-sm sm:text-base flex items-center justify-center gap-2"
                            >
                                <RiLogoutBoxLine className="text-base sm:text-lg" />
                                <span>Logout</span>
                            </button>
                        </div>
                    </div>
                );
            case 'theme':
                return (
                    <div className="space-y-4 sm:space-y-6">
                        <h3 className={`text-lg sm:text-xl md:text-2xl font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-800'}`}>Theme Settings</h3>
                        <div className="space-y-3 sm:space-y-4">
                            <div className={`flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 ${theme === 'dark' ? 'text-white' : 'text-gray-800'}`}>
                                <span className="text-sm sm:text-base">Dark Mode</span>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input 
                                        type="checkbox" 
                                        className="sr-only peer" 
                                        checked={theme === 'dark'}
                                        onChange={(e) => setTheme(e.target.checked ? 'dark' : 'light')}
                                    />
                                    <div className={`w-9 h-5 sm:w-11 sm:h-6 ${theme === 'dark' ? 'bg-gray-700' : 'bg-gray-300'} peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 sm:after:h-5 sm:after:w-5 after:transition-all peer-checked:bg-[#cc2b5e]`}></div>
                                </label>
                            </div>
                        </div>
                    </div>
                );
            default:
                return null;
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 0.5 }}
                        exit={{ opacity: 0 }}
                        className={`fixed inset-0 ${theme === 'dark' ? 'bg-black' : 'bg-gray-700'}`}
                        onClick={onClose}
                    />

                    <motion.div
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.8, opacity: 0 }}
                        transition={{ type: "spring", damping: 20, stiffness: 300 }}
                        className="fixed inset-0 flex items-center justify-center p-2 sm:p-4"
                    >
                        <div className={`${theme === 'dark' ? 'bg-black/80 border-white/10' : 'bg-white border-gray-200'} backdrop-blur-xl w-full max-w-md sm:max-w-lg md:max-w-2xl lg:max-w-4xl rounded-lg shadow-lg overflow-hidden border h-[90vh] sm:h-auto flex flex-col`}>
                            {/* Header */}
                            <div className={`p-3 sm:p-4 ${theme === 'dark' ? 'border-white/10' : 'border-gray-200'} border-b flex justify-between items-center`}>
                                <h2 className="text-base sm:text-lg md:text-xl font-semibold text-[#cc2b5e]">Settings</h2>
                                <button
                                    onClick={onClose}
                                    className={`p-1 sm:p-1.5 md:p-2 ${theme === 'dark' ? 'hover:bg-white/10' : 'hover:bg-gray-100'} rounded-full transition-colors`}
                                >
                                    <RiArrowLeftLine className="text-[#cc2b5e] text-lg sm:text-xl md:text-2xl" />
                                </button>
                            </div>

                            {/* Tabs and Content */}
                            <div className="flex flex-col md:flex-row gap-4 sm:gap-6 md:gap-8 p-4 sm:p-6 flex-1 overflow-y-auto">
                                {/* Sidebar */}
                                <div className="md:w-48 lg:w-64 flex-shrink-0">
                                    <div className="flex flex-row md:flex-col gap-2 sm:gap-3 overflow-x-auto md:overflow-x-visible pb-2 md:pb-0">
                                        {tabs.map((tab) => (
                                            <button
                                                key={tab.id}
                                                onClick={() => setActiveTab(tab.id)}
                                                className={`flex-shrink-0 px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg transition-all text-sm sm:text-base ${
                                                    activeTab === tab.id 
                                                        ? theme === 'dark'
                                                            ? 'bg-white/20 backdrop-blur-sm text-white shadow-[0_0_10px_rgba(255,255,255,0.3)]' 
                                                            : 'bg-gray-200 text-gray-800 shadow-[0_0_10px_rgba(0,0,0,0.1)]'
                                                        : theme === 'dark'
                                                            ? 'text-white/60 hover:bg-white/10'
                                                            : 'text-gray-600 hover:bg-gray-100'
                                                }`}
                                            >
                                                {tab.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Content */}
                                <div className={`flex-1 ${theme === 'dark' ? 'bg-black/40 border-white/10' : 'bg-gray-50 border-gray-200'} backdrop-blur-sm rounded-lg p-4 sm:p-6 border overflow-y-auto`}>
                                    {renderContent()}
                                </div>
                            </div>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
};

export default Settings;