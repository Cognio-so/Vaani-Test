import React, { useState, useContext } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RiArrowLeftLine } from 'react-icons/ri';
import { ThemeContext } from '../App';
import { useAuth } from '../context/AuthContext';

const Settings = ({ isOpen, onClose }) => {
    const [activeTab, setActiveTab] = useState('general');
    const { theme, setTheme } = useContext(ThemeContext);
    const { user } = useAuth();

    const tabs = [
        { id: 'general', label: 'General' },
        { id: 'model', label: 'Model Info' },
        { id: 'upgrade', label: 'Upgrade Plan' },
        { id: 'account', label: 'Account' },
        { id: 'theme', label: 'Theme' }
    ];

    const renderContent = () => {
        switch (activeTab) {
            case 'general':
                return (
                    <div className="space-y-6">
                        <h3 className={`text-xl font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-800'}`}>General Settings</h3>
                        <div className="space-y-4">
                            <div className={`flex justify-between items-center ${theme === 'dark' ? 'text-white' : 'text-gray-800'}`}>
                                <span>Language</span>
                                <select className={`${theme === 'dark' ? 'bg-black/40 border-white/10 text-white' : 'bg-gray-100 border-gray-300 text-gray-800'} rounded-md px-3 py-1 border`}>
                                    <option>English</option>
                                    <option>Spanish</option>
                                    <option>French</option>
                                </select>
                            </div>
                            <div className={`flex justify-between items-center ${theme === 'dark' ? 'text-white' : 'text-gray-800'}`}>
                                <span>Notifications</span>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input type="checkbox" className="sr-only peer" />
                                    <div className={`w-11 h-6 ${theme === 'dark' ? 'bg-gray-700' : 'bg-gray-300'} peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#cc2b5e]`}></div>
                                </label>
                            </div>
                        </div>
                    </div>
                );
            case 'model':
                return (
                    <div className="space-y-6">
                        <h3 className={`text-xl font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-800'}`}>Model Information</h3>
                        <div className="space-y-4">
                            <div className={`${theme === 'dark' ? 'bg-black/40 border-white/10' : 'bg-gray-100 border-gray-300'} p-4 rounded-lg border`}>
                                <h4 className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-800'}`}>Current Model: GPT-4</h4>
                                <p className={`${theme === 'dark' ? 'text-white/60' : 'text-gray-600'} mt-2`}>Version: 4.0</p>
                                <p className={`${theme === 'dark' ? 'text-white/60' : 'text-gray-600'}`}>Last Updated: June 2024</p>
                            </div>
                        </div>
                    </div>
                );
            case 'upgrade':
                return (
                    <div className="space-y-6">
                        <h3 className={`text-xl font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-800'}`}>Upgrade Your Plan</h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {['Basic', 'Pro', 'Enterprise'].map((plan) => (
                                <div key={plan} className={`${theme === 'dark' ? 'bg-black/40 border-white/10' : 'bg-gray-100 border-gray-300'} p-6 rounded-lg text-center border`}>
                                    <h4 className={`text-lg font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-800'}`}>{plan}</h4>
                                    <p className={`mt-4 ${theme === 'dark' ? 'text-white/60' : 'text-gray-600'}`}>Starting from</p>
                                    <p className={`text-2xl font-bold mt-2 ${theme === 'dark' ? 'text-white' : 'text-gray-800'}`}>$9.99/mo</p>
                                    <button className={`mt-4 ${theme === 'dark' ? 'bg-white/10 hover:bg-white/20 text-white' : 'bg-gray-200 hover:bg-gray-300 text-gray-800'} px-4 py-2 rounded-md`}>
                                        Select Plan
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                );
            case 'account':
                return (
                    <div className="space-y-6">
                        <h3 className={`text-xl font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-800'}`}>Account Settings</h3>
                        <div className="space-y-4">
                            <div className="flex items-center space-x-4">
                                <div className={`w-16 h-16 ${theme === 'dark' ? 'bg-black/40 border-white/10' : 'bg-gray-100 border-gray-300'} rounded-full border flex items-center justify-center`}>
                                    {user && user.name ? (
                                        <span className={`text-xl font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-800'}`}>
                                            {user.name.charAt(0).toUpperCase()}
                                        </span>
                                    ) : (
                                        <span className={`text-xl font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-800'}`}>U</span>
                                    )}
                                </div>
                                <button className={`${theme === 'dark' ? 'bg-black/40 text-white hover:bg-black/60' : 'bg-gray-200 text-gray-800 hover:bg-gray-300'} px-4 py-2 rounded-md`}>Change Avatar</button>
                            </div>
                            
                            {/* User Info Display */}
                            <div className={`${theme === 'dark' ? 'bg-black/20' : 'bg-gray-50'} p-4 rounded-lg mb-4`}>
                                <h4 className={`text-sm font-medium mb-2 ${theme === 'dark' ? 'text-white/80' : 'text-gray-600'}`}>Current User Information</h4>
                                <p className={`${theme === 'dark' ? 'text-white' : 'text-gray-800'} mb-1`}>
                                    <span className={`${theme === 'dark' ? 'text-white/60' : 'text-gray-500'} mr-2`}>Name:</span> 
                                    {user?.name || 'Not set'}
                                </p>
                                <p className={`${theme === 'dark' ? 'text-white' : 'text-gray-800'}`}>
                                    <span className={`${theme === 'dark' ? 'text-white/60' : 'text-gray-500'} mr-2`}>Email:</span> 
                                    {user?.email || 'Not set'}
                                </p>
                            </div>
                            
                            <input 
                                type="text" 
                                placeholder="Name" 
                                className={`w-full ${theme === 'dark' ? 'bg-black/40 text-white border-white/10 placeholder-white/40' : 'bg-gray-100 text-gray-800 border-gray-300 placeholder-gray-500/40'} rounded-md px-4 py-2 border`}
                                defaultValue={user?.name || ''}
                            />
                            <input 
                                type="email" 
                                placeholder="Email" 
                                className={`w-full ${theme === 'dark' ? 'bg-black/40 text-white border-white/10 placeholder-white/40' : 'bg-gray-100 text-gray-800 border-gray-300 placeholder-gray-500/40'} rounded-md px-4 py-2 border`}
                                defaultValue={user?.email || ''}
                                readOnly
                            />
                            <button className="w-full mt-2 py-2 px-4 rounded-md bg-[#cc2b5e] hover:bg-[#bb194d] text-white transition-colors">
                                Update Profile
                            </button>
                        </div>
                    </div>
                );
            case 'theme':
                return (
                    <div className="space-y-6">
                        <h3 className={`text-xl font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-800'}`}>Theme Settings</h3>
                        <div className="space-y-4">
                            <div className={`flex justify-between items-center ${theme === 'dark' ? 'text-white' : 'text-gray-800'}`}>
                                <span>Dark Mode</span>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input 
                                        type="checkbox" 
                                        className="sr-only peer" 
                                        checked={theme === 'dark'}
                                        onChange={(e) => setTheme(e.target.checked ? 'dark' : 'light')}
                                    />
                                    <div className={`w-11 h-6 ${theme === 'dark' ? 'bg-gray-700' : 'bg-gray-300'} peer-focus:outline-none rounded-full peer ${theme === 'dark' ? 'peer-checked:bg-[#cc2b5e]' : 'peer-checked:bg-[#cc2b5e]'} after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all ${theme === 'dark' ? 'after:translate-x-5' : 'peer-checked:after:translate-x-5'}`}></div>
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
                    {/* Overlay Background */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 0.5 }}
                        exit={{ opacity: 0 }}
                        className={`fixed inset-0 ${theme === 'dark' ? 'bg-black' : 'bg-gray-700'}`}
                        onClick={onClose}
                    />

                    {/* Settings Container */}
                    <motion.div
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.8, opacity: 0 }}
                        transition={{ type: "spring", damping: 20, stiffness: 300 }}
                        className="fixed inset-0 flex items-center justify-center"
                    >
                        <div className={`${theme === 'dark' ? 'bg-black/80 border-white/10' : 'bg-white border-gray-200'} backdrop-blur-xl w-[95%] max-w-4xl rounded-lg shadow-lg overflow-hidden border`}>
                            {/* Header */}
                            <div className={`p-3 sm:p-4 ${theme === 'dark' ? 'border-white/10' : 'border-gray-200'} border-b flex justify-between items-center`}>
                                <h2 className="text-lg sm:text-xl font-semibold text-[#cc2b5e]">Settings</h2>
                                <button
                                    onClick={onClose}
                                    className={`p-1.5 sm:p-2 ${theme === 'dark' ? 'hover:bg-white/10' : 'hover:bg-gray-100'} rounded-full transition-colors`}
                                >
                                    <RiArrowLeftLine className="text-[#cc2b5e] text-xl sm:text-2xl" />
                                </button>
                            </div>

                            {/* Tabs and Content */}
                            <div className="flex flex-col md:flex-row gap-8 p-6">
                                {/* Sidebar */}
                                <div className="md:w-64">
                                    <div className="flex flex-col space-y-2">
                                        {tabs.map((tab) => (
                                            <button
                                                key={tab.id}
                                                onClick={() => setActiveTab(tab.id)}
                                                className={`text-left px-4 py-2 rounded-lg transition-all ${
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
                                <div className={`flex-1 ${theme === 'dark' ? 'bg-black/40 border-white/10' : 'bg-gray-50 border-gray-200'} backdrop-blur-sm rounded-lg p-6 border`}>
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