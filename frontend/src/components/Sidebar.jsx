import React from 'react';
import { RiHome4Line, RiHistoryLine, RiSettings4Line, RiLogoutBoxLine } from 'react-icons/ri';
import { BsCollection, BsPlusCircle} from 'react-icons/bs';
import { FaAlignLeft , FaAlignRight } from 'react-icons/fa';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { useContext } from 'react';
import { ThemeContext } from '../App';

const backend_url = import.meta.env.VITE_BACKEND_URL

const Sidebar = ({ isVisible, onToggle, onOpenSettings, onOpenHistory, onNewChat }) => {
    const { logout } = useAuth();
    const navigate = useNavigate();
    const { theme } = useContext(ThemeContext);
    
    // Handle logout
    const handleLogout = async () => {
        try {
            await axios.post(`${backend_url}/auth/logout`, {}, {
                withCredentials: true
            });
            
            // Use the logout function from auth context to clear local state
            logout();
            
            // Navigate to login page
            navigate('/login');
        } catch (error) {
            console.error("Error logging out:", error);
        }
    };

    return (
        <>
            {/* Toggle button outside sidebar for when sidebar is hidden */}
            {!isVisible && (
                <button 
                    onClick={onToggle}
                    className={`fixed left-4 top-4 z-[110] p-2 ${
                        theme === 'dark' ? 'bg-black/70 text-white' : 'bg-white text-gray-800'
                    } rounded-full hover:bg-white/10 transition-all duration-300 shadow-md`}
                >
                    <FaAlignRight className="text-[#cc2b5e] text-xl" />
                </button>
            )}
            
            <div className={`fixed left-0 top-0 h-full w-14 sm:w-16 lg:w-64 ${
                theme === 'dark' ? 'bg-black text-white z-[100]' : 'bg-white text-gray-800 border-r border-gray-200 z-[100]'
            } p-2 sm:p-4 flex flex-col transition-transform duration-300 ease-in-out
                ${!isVisible ? '-translate-x-full' : 'translate-x-0'} overflow-y-auto scrollbar-hide pb-safe`}>
                {/* Top Section with Menu Icon and Logo - Always visible */}
                <div className="flex items-center space-x-0 justify-between mt-2">
                    <div className="hidden lg:flex items-center">
                        <img src="/vannipro.png" alt="Vaani.pro Logo" className="w-10 h-8" />    
                        <h1 className="hidden lg:block text-lg sm:text-xl font-bold ml-2 text-[#cc2b5e]">Vaani.pro</h1>
                    </div>
                    <button 
                        onClick={onToggle}
                        className={`p-2 rounded-full ${
                            theme === 'dark' ? 'hover:bg-white/10' : 'hover:bg-gray-100'
                        } transition-all duration-300`}
                    >
                        <FaAlignLeft className="text-[#cc2b5e] text-xl" />
                    </button>
                </div>

                {/* Main Navigation */}
                <nav className="flex-1 mt-8">
                    <ul className="space-y-4 sm:space-y-6">
                        <li>
                            <Link to="/" className={`flex items-center space-x-2 sm:space-x-3 p-1.5 sm:p-2 rounded-lg ${
                                theme === 'dark' ? 'hover:bg-white/10' : 'hover:bg-gray-100'
                            } transition-all`}>
                                <RiHome4Line className="text-lg sm:text-xl" />
                                <span className="hidden lg:block text-sm sm:text-base">Home</span>
                            </Link>
                        </li>
                        <li>
                            <button 
                                onClick={onNewChat}
                                className={`w-full flex items-center space-x-2 sm:space-x-3 p-1.5 sm:p-2 rounded-lg ${
                                    theme === 'dark' ? 'hover:bg-white/10' : 'hover:bg-gray-100'
                                } transition-all`}
                            >
                                <BsPlusCircle className="text-lg sm:text-xl" />
                                <span className="hidden lg:block text-sm sm:text-base">New Chat</span>
                            </button>
                        </li>
                        <li>
                            <button 
                                onClick={(e) => {
                                    e.preventDefault(); 
                                    onOpenHistory();
                                }}
                                className={`w-full flex items-center space-x-2 sm:space-x-3 p-1.5 sm:p-2 rounded-lg ${
                                    theme === 'dark' ? 'hover:bg-white/10' : 'hover:bg-gray-100'
                                } transition-all`}
                            >
                                <RiHistoryLine className="text-lg sm:text-xl" />
                                <span className="hidden lg:block text-sm sm:text-base">History</span>
                            </button>
                        </li>
                        <li>
                            <Link className={`flex items-center space-x-2 sm:space-x-3 p-1.5 sm:p-2 rounded-lg ${
                                theme === 'dark' ? 'hover:bg-white/10' : 'hover:bg-gray-100'
                            } transition-all`}>
                                <BsCollection className="text-lg sm:text-xl" />
                                <span className="hidden lg:block text-sm sm:text-base">Collections</span>
                            </Link>
                        </li>
                    </ul>
                </nav>

                {/* Bottom Section - Added flex-shrink-0 to prevent shrinking */}
                <div className="border-t border-gray-700 pt-4 pb-4 flex-shrink-0 mt-auto">
                    <ul className="space-y-4">
                        <li>
                            <button 
                                onClick={onOpenSettings}
                                className={`flex items-center space-x-2 sm:space-x-3 p-1.5 sm:p-2 rounded-lg ${
                                    theme === 'dark' ? 'hover:bg-white/10' : 'hover:bg-gray-100'
                                } transition-all`}
                            >
                                <RiSettings4Line className="text-lg sm:text-xl" />
                                <span className="hidden lg:block text-sm sm:text-base">Settings</span>
                            </button>
                        </li>
                        <li>
                            <button 
                                onClick={handleLogout}
                                className={`w-full flex items-center space-x-2 sm:space-x-3 p-1.5 sm:p-2 rounded-lg ${
                                    theme === 'dark' ? 'hover:bg-white/10' : 'hover:bg-gray-100'
                                } transition-all`}
                            >
                                <RiLogoutBoxLine className="text-lg sm:text-xl" />
                                <span className="hidden lg:block text-sm sm:text-base">Logout</span>
                            </button>
                        </li>
                    </ul>
                </div>
            </div>
        </>
    );
};

export default Sidebar;

