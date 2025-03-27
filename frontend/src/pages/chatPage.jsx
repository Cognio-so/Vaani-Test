import React, { useContext } from 'react'
import ChatContainer from '../components/ChatContainer'
import { ThemeContext } from '../App'

const ChatPage = () => {
  const { theme } = useContext(ThemeContext);
  
  return (
    <div className={`fixed inset-0 overflow-hidden ${theme === 'dark' ? 'bg-custom-gradient' : 'bg-white'}`}>
      <ChatContainer />
    </div>
  )
}   

export default ChatPage