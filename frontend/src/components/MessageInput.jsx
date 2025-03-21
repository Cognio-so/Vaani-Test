import React, { useRef, useEffect, useState, useContext } from 'react'
import { FaLightbulb } from 'react-icons/fa'
import { CiGlobe } from 'react-icons/ci'
import { RiSparkling2Fill, RiVoiceprintFill } from 'react-icons/ri'
import { MdAttachFile } from 'react-icons/md'
import { SiGoogle, SiOpenai, SiMeta, SiClaude } from 'react-icons/si'
import { IoClose } from 'react-icons/io5'
import axios from 'axios'
import { ThemeContext } from '../App'

// Constants
const API_URL= import.meta.env.REACT_APP_API_URL || 'https://python-test-algohype.replit.app'

const MessageInput = ({ onSendMessage, isLoading, setIsLoading }) => {
    const textareaRef = useRef(null);
    const fileInputRef = useRef(null);
    const [isModelSelectorOpen, setIsModelSelectorOpen] = useState(false);
    const [selectedModel, setSelectedModel] = useState("gemini-1.5-flash");
    const [message, setMessage] = useState('');
    const [uploadedFile, setUploadedFile] = useState(null);
    const [uploadedFilePath, setUploadedFilePath] = useState(null);
    const [useAgent, setUseAgent] = useState(false);
    const [deepResearch, setDeepResearch] = useState(false);
    const { theme } = useContext(ThemeContext);
    
    const models = [
        { id: "gemini-1.5-flash", name: "Gemini 1.5 Flash", cost: "Free/Cheap", icon: SiGoogle },
        { id: "gpt-4o-mini", name: "GPT-4o-mini", cost: "Low", icon: SiOpenai },
        { id: "claude-3-haiku-20240307", name: "Claude 3 Haiku", cost: "Free/Cheap", icon: SiClaude },
        { id: "llama-3.3-70b-versatile", name: "Llama 3.3 70B", cost: "Free", icon: SiMeta },
    ];

    const adjustHeight = () => {
        const textarea = textareaRef.current;
        if (textarea) {
            textarea.style.height = 'auto';
            textarea.style.height = `${textarea.scrollHeight}px`;
        }
    };

    useEffect(() => {
        adjustHeight();
    }, [message]);

    const toggleModelSelector = () => {
        setIsModelSelectorOpen(!isModelSelectorOpen);
    };

    const handleModelSelect = (modelId) => {
        setSelectedModel(modelId);
        setIsModelSelectorOpen(false);
        console.log(`Model switched to: ${modelId}`);
    };

    const handleFileChange = async (event) => {
        const file = event.target.files[0];
        if (file) {
            setUploadedFile(file.name);
            
            // Upload file to server
            const formData = new FormData();
            formData.append('file', file);
            
            setIsLoading(true);
            try {
                const response = await axios.post(`${API_URL}/api/upload`, formData, {
                    headers: {
                        'Content-Type': 'multipart/form-data'
                    }
                });
                
                // Get the file URL from the response (not file_path)
                setUploadedFilePath(response.data.file_path);
                console.log("File uploaded successfully:", response.data.file_path);
            } catch (error) {
                console.error("Error uploading file:", error);
                alert("Failed to upload file. Please try again.");
                setUploadedFile(null);
            } finally {
                setIsLoading(false);
            }
        }
    };

    const handleSendMessage = async (e) => {
        e.preventDefault();
        if (!message.trim() && !uploadedFile) return;
        
        const userMessage = {
            role: "user",
            content: message,
            is_research: deepResearch // Add this flag
        };
        
        // Clear input
        setMessage('');
        adjustHeight();
        
        // Pass all necessary flags
        onSendMessage(userMessage, {
            model: selectedModel,
            file_url: uploadedFilePath,
            use_agent: useAgent,
            deep_research: deepResearch,
            is_research: deepResearch // Ensure this flag is passed
        });
        
        // Clear file upload if any
        if (uploadedFile) {
            setUploadedFile(null);
            setUploadedFilePath(null);
            if (fileInputRef.current) {
                fileInputRef.current.value = "";
            }
        }
    };

    const handleGlobeClick = () => {
        // Don't allow enabling both deep research and agent together
        if (!deepResearch && useAgent) {
            setUseAgent(false);
        }
        setDeepResearch(!deepResearch);
        console.log(`Deep research ${!deepResearch ? 'enabled' : 'disabled'}`);
    };

    const toggleDeepResearch = () => {
        handleGlobeClick();
    };

    const toggleAgentChat = () => {
        // Don't allow enabling both agent and deep research together
        if (!useAgent && deepResearch) {
            setDeepResearch(false);
        }
        setUseAgent(!useAgent);
        console.log(`Agent chat ${!useAgent ? 'enabled' : 'disabled'}`);
    };

    const currentModel = models.find(model => model.id === selectedModel);
    const ModelIcon = currentModel ? currentModel.icon : RiSparkling2Fill;

    return (
        <form onSubmit={handleSendMessage} className='w-full max-w-[95%] xs:max-w-[90%] sm:max-w-2xl md:max-w-4xl mx-auto'>
            <div className={`relative rounded-xl sm:rounded-2xl ${
                theme === 'dark' 
                  ? 'bg-white/[0.2] backdrop-blur-xl text-white shadow-[0_0_20px_rgba(204,43,94,0.3)] hover:shadow-[0_0_30px_rgba(204,43,94,0.5)]' 
                  : 'bg-gray-100 text-gray-800 shadow-md hover:shadow-lg'
            } px-2 sm:px-3 pt-2 sm:pt-3 pb-8 sm:pb-10`}>
                <textarea
                    ref={textareaRef}
                    placeholder='Ask me anything...'
                    className={`relative w-full pl-1 sm:pl-2 pr-2 sm:pr-6 py-1 sm:py-2 bg-transparent outline-none text-sm sm:text-base resize-none overflow-hidden scrollbar-hide min-h-[54px] ${
                        theme === 'dark' ? 'placeholder-gray-400' : 'placeholder-gray-500'
                    }`}
                    rows={1}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            if (message.trim() || uploadedFile) {
                                handleSendMessage(e);
                            }
                        }
                    }}
                />
                
                <div className="absolute left-1.5 sm:left-2 md:left-4 bottom-1.5 sm:bottom-2 md:bottom-3 flex items-center space-x-1.5 sm:space-x-2 md:space-x-4">
                    <button 
                        type="button"
                        className={`${
                            theme === 'dark' 
                              ? 'text-[#cc2b5e] hover:text-[#bd194d]' 
                              : 'text-[#cc2b5e] hover:text-[#bd194d]'
                        } transition-all text-base sm:text-lg md:text-xl p-0.5 sm:p-1 hover:bg-white/10 rounded-full relative`}
                        onClick={toggleModelSelector}
                    >
                        <ModelIcon />
                    </button>
                    <button 
                        type="button"
                        className={`${
                            theme === 'dark' 
                              ? 'text-[#cc2b5e] hover:text-[#bd194d]' 
                              : 'text-[#cc2b5e] hover:text-[#bd194d]'
                        } transition-all text-base sm:text-lg md:text-xl p-0.5 sm:p-1 hover:bg-white/10 rounded-full relative flex items-center ${deepResearch ? 'bg-white/20' : ''}`}
                        title={deepResearch ? "Web research mode enabled - I'll search for up-to-date information" : "Web research mode disabled"}
                        onClick={toggleDeepResearch}
                    >
                        <CiGlobe />
                        {deepResearch && <span className="ml-1 text-xs whitespace-nowrap text-[#cc2b5e] font-medium">Web Research</span>}
                    </button>
                    <button 
                        type="button"
                        className={`${
                            theme === 'dark' 
                              ? 'text-[#cc2b5e] hover:text-[#bd194d]' 
                              : 'text-[#cc2b5e] hover:text-[#bd194d]'
                        } transition-all text-base sm:text-lg md:text-xl p-0.5 sm:p-1 hover:bg-white/10 rounded-full flex items-center ${useAgent ? 'bg-white/10' : ''}`}
                        title={useAgent ? "AI agent enabled" : "AI agent disabled"}
                        onClick={toggleAgentChat}
                    >
                        <FaLightbulb />
                        {useAgent && <span className="ml-1 text-xs whitespace-nowrap text-[#cc2b5e] font-medium">AI Agent</span>}
                    </button>
                </div>

                <div className="absolute right-1.5 sm:right-2 md:right-4 bottom-1.5 sm:bottom-2 md:bottom-3 flex items-center space-x-1.5 sm:space-x-2 md:space-x-4">
                    <input 
                        type="file" 
                        id="file-upload" 
                        className="hidden" 
                        ref={fileInputRef}
                        onChange={handleFileChange}
                    />
                    <label 
                        htmlFor="file-upload" 
                        className={`${
                            theme === 'dark' 
                              ? 'text-[#cc2b5e] hover:text-[#bd194d]' 
                              : 'text-[#cc2b5e] hover:text-[#bd194d]'
                        } transition-all text-base sm:text-lg md:text-xl p-0.5 sm:p-1 hover:bg-white/10 rounded-full cursor-pointer ${uploadedFile ? 'bg-white/10' : ''}`}
                        title={uploadedFile ? `File attached: ${uploadedFile}` : "Attach file"}
                    >
                        <MdAttachFile />
                    </label>
                    <button 
                        type="button"
                        className={`${
                            theme === 'dark' 
                              ? 'text-[#cc2b5e] hover:text-[#bd194d]' 
                              : 'text-[#cc2b5e] hover:text-[#bd194d]'
                        } transition-all text-base sm:text-lg md:text-xl p-0.5 sm:p-1 hover:bg-white/10 rounded-full`}
                        title="Voice input (coming soon)"
                    >
                        <RiVoiceprintFill />
                    </button> 
                </div>
                
                {/* Model Selector Dropdown */}
                {isModelSelectorOpen && (
                    <>
                        <div 
                            className="fixed inset-0 bg-transparent z-10"
                            onClick={() => setIsModelSelectorOpen(false)}
                        />
                        <div className={`absolute left-0 bottom-full mb-2 w-[240px] ${
                            theme === 'dark'
                              ? 'bg-black/90 backdrop-blur-xl shadow-[0_0_15px_rgba(204,43,94,0.3)] border border-[#cc2b5e]/20'
                              : 'bg-white shadow-lg border border-gray-200'
                        } p-2 rounded-lg z-20`}>
                            <div className="flex justify-between items-center mb-1">
                                <h3 className="text-xs font-medium text-[#cc2b5e]">Select Model</h3>
                                <button 
                                    type="button"
                                    onClick={() => setIsModelSelectorOpen(false)}
                                    className={`${
                                        theme === 'dark'
                                          ? 'text-[#cc2b5e]/70 hover:text-[#cc2b5e]'
                                          : 'text-[#cc2b5e]/70 hover:text-[#cc2b5e]'
                                    } p-0.5 rounded-full hover:bg-white/10`}
                                >
                                    <IoClose size={14} />
                                </button>
                            </div>
                            <div className="grid grid-cols-2 gap-1.5">
                                {models.map((model) => {
                                    const Icon = model.icon;
                                    return (
                                        <button
                                            type="button"
                                            key={model.id}
                                            className={`flex flex-col items-center text-center p-1.5 rounded-lg transition-all ${
                                                selectedModel === model.id 
                                                    ? 'bg-[#cc2b5e]/20 shadow-[0_0_10px_rgba(204,43,94,0.2)]' 
                                                    : theme === 'dark' ? 'hover:bg-white/10' : 'hover:bg-gray-100'
                                            }`}
                                            onClick={() => handleModelSelect(model.id)}
                                        >
                                            <Icon className="text-[#cc2b5e] text-base mb-1" />
                                            <span className={`text-[10px] font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-800'}`}>{model.name.length > 12 ? model.name.substring(0, 10) + '...' : model.name}</span>
                                            <span className={`text-[8px] ${theme === 'dark' ? 'text-white/60' : 'text-gray-600'}`}>{model.cost}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </>
                )}

                {/* File upload indicator */}
                {uploadedFile && (
                    <div className="absolute left-0 top-[-30px] text-xs text-white bg-[#cc2b5e]/80 rounded-lg px-2 py-1 flex items-center">
                        <span className="truncate max-w-[150px]">{uploadedFile}</span>
                        <button 
                            type="button"
                            onClick={() => {
                                setUploadedFile(null);
                                setUploadedFilePath(null);
                                if (fileInputRef.current) {
                                    fileInputRef.current.value = "";
                                }
                            }} 
                            className="ml-2 text-white hover:text-white/80"
                        >
                            <IoClose size={14} />
                        </button>
                    </div>
                )}
            </div>
        </form>
    )
}

export default MessageInput
