import React, { useRef, useEffect, useState, useContext } from 'react'
import { FaLightbulb } from 'react-icons/fa'
import { CiGlobe } from 'react-icons/ci'
import { RiSparkling2Fill } from 'react-icons/ri'
import { MdAttachFile } from 'react-icons/md'
import { SiGoogle, SiOpenai, SiMeta, SiClaude } from 'react-icons/si'
import { IoClose } from 'react-icons/io5'
import axios from 'axios'
import { ThemeContext } from '../App'

// Constants
const API_URL = import.meta.env.VITE_API_URL

const MessageInput = ({ onSendMessage, isLoading, setIsLoading, onMediaRequested, onModelChange, onOptionsChange, selectedModel: initialModel }) => {
    const textareaRef = useRef(null);
    const fileInputRef = useRef(null);
    const [isModelSelectorOpen, setIsModelSelectorOpen] = useState(false);
    const [internalModel, setInternalModel] = useState(initialModel || "gemini-1.5-flash");
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
        setInternalModel(modelId);
        setIsModelSelectorOpen(false);
        
        // Notify parent component of model change
        if (onModelChange) {
            onModelChange(modelId);
        }
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
                
                // Store the URL or file path returned from the backend
                const fileUrl = response.data.file_path;
                setUploadedFilePath(fileUrl);
                
            } catch (error) {
                // More detailed error message
                let errorMessage = "Failed to upload file. Please try again.";
                if (error.response) {
                    // Server responded with an error
                    errorMessage += ` Server error: ${error.response.status}`;
                    if (error.response.data && error.response.data.detail) {
                        errorMessage += ` - ${error.response.data.detail}`;
                    }
                } else if (error.request) {
                    // Request was made but no response
                    errorMessage += " No response from server. Check your network connection.";
                }
                
                alert(errorMessage);
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
            is_research: deepResearch
        };
        
        // Clear input immediately for better perceived performance
        setMessage('');
        adjustHeight();
        
        // Optimize response by setting highest priority for streaming
        onSendMessage(userMessage, {
            model: internalModel,
            file_url: uploadedFilePath,
            use_agent: useAgent,
            deep_research: deepResearch,
            is_research: deepResearch,
            stream: true  // Always use streaming for faster response display
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
    };

    const toggleDeepResearch = () => {
        handleGlobeClick();
        
        // Notify parent of option change
        if (typeof onOptionsChange === 'function') {
            onOptionsChange({ deep_research: !deepResearch });
        }
    };

    const toggleAgentChat = () => {
        // Don't allow enabling both agent and deep research together
        if (!useAgent && deepResearch) {
            setDeepResearch(false);
        }
        setUseAgent(!useAgent);
        
        // Notify parent of option change
        if (typeof onOptionsChange === 'function') {
            onOptionsChange({ use_agent: !useAgent });
        }
    };

    const currentModel = models.find(model => model.id === internalModel);
    const ModelIcon = currentModel ? currentModel.icon : RiSparkling2Fill;

    return (
        <form onSubmit={handleSendMessage} className="w-full max-w-full mx-auto">
            <div className={`relative rounded-lg sm:rounded-xl ${
                theme === 'dark' 
                  ? 'bg-white/[0.2] backdrop-blur-xl text-white shadow-[0_0_15px_rgba(204,43,94,0.3)]' 
                  : 'bg-gray-100 text-gray-800 shadow-md'
            } px-2 xs:px-3 sm:px-4 py-2`}>
                <textarea
                    ref={textareaRef}
                    placeholder='Ask me anything...'
                    className={`w-full py-1 xs:py-1.5 sm:py-2 mb-5 xs:mb-6 sm:mb-7 bg-transparent outline-none text-xs xs:text-sm sm:text-base resize-none overflow-y-auto scrollbar-hide min-h-[32px] xs:min-h-[36px] sm:min-h-[40px] max-h-20 xs:max-h-24 sm:max-h-32 ${
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
                
                <div className="absolute bottom-1 xs:bottom-1.5 sm:bottom-2 left-1 xs:left-2 sm:left-3 right-1 xs:right-2 sm:right-3 flex justify-between items-center">
                    <div className="flex items-center gap-0.5 xs:gap-1 sm:gap-2">
                        <button 
                            type="button"
                            className={`group relative ${
                                theme === 'dark' 
                                  ? 'text-[#cc2b5e] hover:text-[#bd194d]' 
                                  : 'text-[#cc2b5e] hover:text-[#bd194d]'
                            } transition-all text-base xs:text-lg sm:text-xl p-0.5 xs:p-1 hover:bg-white/10 rounded-full`}
                            onClick={toggleModelSelector}
                        >
                            <ModelIcon />
                            <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-1.5 py-0.5 bg-black/80 text-white text-[9px] rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                                Select Model
                            </span>
                        </button>
                        
                        <button 
                            type="button"
                            className={`group relative ${
                                theme === 'dark' 
                                  ? 'text-[#cc2b5e] hover:text-[#bd194d]' 
                                  : 'text-[#cc2b5e] hover:text-[#bd194d]'
                            } transition-all text-base xs:text-lg sm:text-xl p-0.5 xs:p-1 hover:bg-white/10 rounded-full flex items-center ${deepResearch ? 'bg-white/20' : ''}`}
                            onClick={toggleDeepResearch}
                        >
                            <CiGlobe />
                            {deepResearch && <span className="ml-1 text-[8px] xs:text-[10px] sm:text-xs whitespace-nowrap text-[#cc2b5e] font-medium">Web</span>}
                            <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-1.5 py-0.5 bg-black/80 text-white text-[9px] rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                                Web Research
                            </span>
                        </button>
                        <button 
                            type="button"
                            className={`group relative ${
                                theme === 'dark' 
                                  ? 'text-[#cc2b5e] hover:text-[#bd194d]' 
                                  : 'text-[#cc2b5e] hover:text-[#bd194d]'
                            } transition-all text-base xs:text-lg sm:text-xl p-0.5 xs:p-1 hover:bg-white/10 rounded-full flex items-center ${useAgent ? 'bg-white/10' : ''}`}
                            onClick={toggleAgentChat}
                        >
                            <FaLightbulb />
                            {useAgent && <span className="ml-1 text-[8px] xs:text-[10px] sm:text-xs whitespace-nowrap text-[#cc2b5e] font-medium">Agent</span>}
                            <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-1.5 py-0.5 bg-black/80 text-white text-[9px] rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                                AI Agent
                            </span>
                        </button>
                    </div>

                    <div className="flex items-center">
                        <input 
                            type="file" 
                            id="file-upload" 
                            className="hidden" 
                            ref={fileInputRef}
                            onChange={handleFileChange}
                        />
                        <label 
                            htmlFor="file-upload" 
                            className={`group relative ${
                                theme === 'dark' 
                                  ? 'text-[#cc2b5e] hover:text-[#bd194d]' 
                                  : 'text-[#cc2b5e] hover:text-[#bd194d]'
                            } transition-all text-base xs:text-lg sm:text-xl p-0.5 xs:p-1 hover:bg-white/10 rounded-full cursor-pointer ${uploadedFile ? 'bg-white/10' : ''}`}
                        >
                            <MdAttachFile />
                            <span className="absolute bottom-full right-0 mb-1 px-1.5 py-0.5 bg-black/80 text-white text-[9px] rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                                Attach File
                            </span>
                        </label>
                    </div>
                </div>
                
                {/* Model Selector Dropdown */}
                {isModelSelectorOpen && (
                    <>
                        <div 
                            className="fixed inset-0 bg-transparent z-10"
                            onClick={() => setIsModelSelectorOpen(false)}
                        />
                        <div className={`absolute left-0 bottom-full mb-2 w-[180px] xs:w-[200px] sm:w-[240px] max-w-[90vw] ${
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
                                                internalModel === model.id 
                                                    ? 'bg-[#cc2b5e]/20 shadow-[0_0_10px_rgba(204,43,94,0.2)]' 
                                                    : theme === 'dark' ? 'hover:bg-white/10' : 'hover:bg-gray-100'
                                            }`}
                                            onClick={() => handleModelSelect(model.id)}
                                        >
                                            <Icon className="text-[#cc2b5e] text-base mb-1" />
                                            <span className={`text-[9px] xs:text-[10px] font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-800'}`}>{model.name.length > 12 ? model.name.substring(0, 10) + '...' : model.name}</span>
                                            <span className={`text-[7px] xs:text-[8px] ${theme === 'dark' ? 'text-white/60' : 'text-gray-600'}`}>{model.cost}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </>
                )}

                {/* File upload indicator */}
                {uploadedFile && (
                    <div className="absolute left-1 xs:left-2 sm:left-4 top-[-24px] xs:top-[-28px] sm:top-[-30px] text-[10px] xs:text-xs text-white bg-[#cc2b5e]/80 rounded-lg px-1.5 xs:px-2 py-0.5 xs:py-1 flex items-center">
                        <span className="truncate max-w-[120px] xs:max-w-[150px] sm:max-w-[200px]">{uploadedFile}</span>
                        <button 
                            type="button"
                            onClick={() => {
                                setUploadedFile(null);
                                setUploadedFilePath(null);
                                if (fileInputRef.current) {
                                    fileInputRef.current.value = "";
                                }
                            }} 
                            className="ml-1.5 xs:ml-2 text-white hover:text-white/80"
                        >
                            <IoClose size={12} />
                        </button>
                    </div>
                )}
            </div>
        </form>
    )
}

export default MessageInput

