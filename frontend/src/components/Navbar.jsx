import React, { useContext } from 'react'
import { Link } from 'react-router-dom'
import { ThemeContext } from '../App'

const Navbar = () => {
  const { theme } = useContext(ThemeContext);
  
  return (
    <header className={`container mx-auto px-4 py-6 flex justify-between items-center relative z-10 ${theme === 'light' ? 'bg-white shadow-sm' : ''}`}>
      <div className="flex items-center">
        <Link to="/" className="flex items-center font-bold text-xl">
          <img src="/vannipro.png" alt="Vaanipro" className="w-16 h-12 mr-2" />
          <span className={theme === 'dark' ? 'text-white' : 'text-gray-800'}>Vaani.pro</span>
        </Link>
      </div>
      <nav className="hidden md:block">
        <ul className="flex space-x-8">
          <li className={`${theme === 'dark' ? 'text-white hover:text-purple-200' : 'text-gray-700 hover:text-purple-700'} cursor-pointer`}>About</li>
          <li className={`${theme === 'dark' ? 'text-white hover:text-purple-200' : 'text-gray-700 hover:text-purple-700'} cursor-pointer`}>Features</li>
          <li className={`${theme === 'dark' ? 'text-white hover:text-purple-200' : 'text-gray-700 hover:text-purple-700'} cursor-pointer`}>Solution</li>
          <li className={`${theme === 'dark' ? 'text-white hover:text-purple-200' : 'text-gray-700 hover:text-purple-700'} cursor-pointer`}>Blog</li>
        </ul>
      </nav>
      <Link
        to="/login"
        className={`${theme === 'dark' 
          ? 'bg-transparent border border-purple-500 text-white hover:bg-purple-500' 
          : 'bg-transparent border border-purple-500 text-purple-600 hover:bg-purple-500 hover:text-white'} 
          font-medium py-2 px-6 rounded-full transition-all`}
      >
        Login
      </Link>
    </header>
  )
}

export default Navbar
