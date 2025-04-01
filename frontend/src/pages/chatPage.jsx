import React, { useContext } from 'react'
import ChatContainer from '../components/ChatContainer'
import { ThemeContext } from '../App'

const ChatPage = () => {
  const { theme } = useContext(ThemeContext);
  
  return (
    <div className={`min-h-screen ${theme === 'dark' ? 'bg-black' : 'bg-white'}`}>
      <ChatContainer />
    </div>
  )
}   

export default ChatPage