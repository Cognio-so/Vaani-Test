import React, { useState, useEffect } from 'react';
import { RiHome4Line, RiHistoryLine, RiSettings4Line, RiUserLine, RiLogoutBoxLine } from 'react-icons/ri';
import { BsCollection, BsPlusCircle} from 'react-icons/bs';
import { FaChevronLeft, FaChevronRight } from 'react-icons/fa';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext'; // Make sure this path is correct
import { useContext } from 'react';
import { ThemeContext } from '../App';

const Sidebar = ({ isVisible, onToggle, onOpenSettings, onOpenHistory, onNewChat }) => {
    const [showProfileInfo, setShowProfileInfo] = useState(false);
    const [profileData, setProfileData] = useState(null);
    const { user, logout } = useAuth(); // Use the auth context
    const navigate = useNavigate();
    const { theme } = useContext(ThemeContext);
    
    // Fetch user profile data
    const fetchProfileData = async () => {
        try {
            const response = await axios.get(`${import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000'}/auth/profile`, {
                withCredentials: true
            });
            
            if (response.data) {
                setProfileData(response.data);
            }
        } catch (error) {
            console.error("Error fetching profile data:", error);
        }
    };
    
    // Toggle profile info container
    const toggleProfileInfo = () => {
        if (!showProfileInfo && !profileData) {
            fetchProfileData();
        }
        setShowProfileInfo(!showProfileInfo);
    };
    
    // Handle logout
    const handleLogout = async () => {
        try {
            await axios.post(`${import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000'}/auth/logout`, {}, {
                withCredentials: true
            });
            
            // Use the logout function from auth context to clear local state
            logout();
            
            // Close profile info
            setShowProfileInfo(false);
            
            // Navigate to login page
            navigate('/login');
        } catch (error) {
            console.error("Error logging out:", error);
        }
    };
    
    // Update profile data when user changes
    useEffect(() => {
        if (user && showProfileInfo) {
            fetchProfileData();
        }
    }, [user, showProfileInfo]);

    return (
        <>
            {/* Toggle button outside sidebar for when sidebar is hidden */}
            {!isVisible && (
                <button 
                    onClick={onToggle}
                    className={`fixed left-0 top-4 z-50 p-2 ${
                        theme === 'dark' ? 'bg-black text-white' : 'bg-white text-gray-800'
                    } rounded-full hover:bg-white/10 transition-all duration-300`}
                >
                    <FaChevronRight className="text-[#cc2b5e] text-xl" />
                </button>
            )}
            
            <div className={`fixed left-0 top-0 h-screen w-14 sm:w-16 lg:w-64 ${
                theme === 'dark' ? 'bg-black text-white' : 'bg-white text-gray-800 border-r border-gray-200'
            } p-2 sm:p-4 flex flex-col transition-all duration-300 
                ${!isVisible ? '-translate-x-full' : 'translate-x-0'} z-40 overflow-y-auto scrollbar-hide`}>
                {/* Top Section with Menu Icon */}
                <div className="flex items-center space-x-0 justify-between mt-4">
                    
                    <div className="hidden md:flex items-center">
                        <img src="/vannipro.png" alt="Vaani.pro Logo" className="w-8 h-6" />
                        <h1 className="hidden lg:block text-lg sm:text-xl font-bold ml-2 text-[#cc2b5e]">Vaani.pro</h1>
                    </div>
                    <button 
                        onClick={onToggle}
                        className={`p-2 rounded-full ${
                            theme === 'dark' ? 'hover:bg-white/10' : 'hover:bg-gray-100'
                        } transition-all duration-300`}
                    >
                        <FaChevronLeft className="text-[#cc2b5e] text-xl" />
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

                {/* Bottom Section */}
                <div className="border-t border-gray-700 pt-6">
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
                        <li className="relative">
                            <button 
                                onClick={toggleProfileInfo}
                                className={`w-full flex items-center space-x-2 sm:space-x-3 p-1.5 sm:p-2 rounded-lg ${
                                    theme === 'dark' ? 'hover:bg-white/10' : 'hover:bg-gray-100'
                                } transition-all`}
                            >
                                <RiUserLine className="text-lg sm:text-xl" />
                                <span className="hidden lg:block text-sm sm:text-base">Profile</span>
                            </button>
                            
                            {/* Profile Info Container - Shown when profile is clicked */}
                            {showProfileInfo && (
                                <div className={`absolute bottom-full left-0 mb-2 w-56 ${
                                    theme === 'dark' ? 'bg-black/90 backdrop-blur-xl shadow-[0_0_15px_rgba(204,43,94,0.3)] border border-[#cc2b5e]/20' : 'bg-white shadow-lg border border-gray-200'
                                } rounded-lg p-4 z-50`}>
                                    <div className="flex items-start mb-4">
                                        <div className="w-10 h-10 rounded-full bg-[#cc2b5e] flex items-center justify-center text-white">
                                            <RiUserLine className="text-xl" />
                                        </div>
                                        <div className="ml-3 flex-1">
                                            <h3 className="text-sm font-medium text-white">
                                                {profileData?.name || user?.name || 'User'}
                                            </h3>
                                            <p className="text-xs text-gray-400 truncate max-w-[180px]">
                                                {profileData?.email || user?.email || 'Loading...'}
                                            </p>
                                        </div>
                                    </div>
                                    
                                    {/* Divider */}
                                    <div className="border-t border-gray-700 my-3"></div>
                                    
                                    {/* Logout Button */}
                                    <button 
                                        onClick={handleLogout}
                                        className={`w-full flex items-center space-x-2 p-2 rounded-lg ${
                                            theme === 'dark' ? 'bg-white/5 hover:bg-white/10' : 'bg-gray-100 hover:bg-gray-200'
                                        } transition-all text-[#cc2b5e]`}
                                    >
                                        <RiLogoutBoxLine className="text-lg" />
                                        <span className="text-sm">Logout</span>
                                    </button>
                                </div>
                            )}
                        </li>
                    </ul>
                </div>
            </div>
        </>
    );
};

export default Sidebar;

