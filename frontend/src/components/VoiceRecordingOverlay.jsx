import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FiX } from "react-icons/fi";
import { createPortal } from 'react-dom';
import { Canvas, useFrame } from '@react-three/fiber';
import { MeshDistortMaterial, Sphere } from '@react-three/drei';
import * as THREE from 'three';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

// Update gradient texture with new colors
const gradientTexture = new THREE.CanvasTexture((() => {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const context = canvas.getContext('2d');
  const gradient = context.createLinearGradient(0, 0, 256, 256);
  gradient.addColorStop(0, '#1a1020');  // Dark color for sphere
  gradient.addColorStop(1, '#2a1835');  // Dark color for sphere
  context.fillStyle = gradient;
  context.fillRect(0, 0, 256, 256);
  return canvas;
})());

// Enhanced useAudioAnalyzer hook with more robust cleanup
function useAudioAnalyzer() {
  const [averageFrequency, setAverageFrequency] = useState(0);
  const analyzerRef = useRef(null);
  const dataArrayRef = useRef(null);
  const sourceRef = useRef(null);
  const animationFrameRef = useRef(null);
  const audioContextRef = useRef(null);
  const streamRef = useRef(null);
  
  // Enhanced cleanup function with additional checks and error handling
  const cleanupAudio = () => {
    
    // Cancel any pending animation frames
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    
    // Disconnect audio source if it exists
    if (sourceRef.current) {
      try {
        sourceRef.current.disconnect();
      } catch (err) {
        console.warn("Error disconnecting source:", err);
      }
      sourceRef.current = null;
    }
    
    // Stop all tracks in the media stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        track.enabled = false; // First disable the track
        track.stop();
      });
      streamRef.current = null;
    }
    
    // Close audio context
    if (audioContextRef.current) {
      try {
        if (audioContextRef.current.state !== 'closed') {
          audioContextRef.current.close()
            .catch(err => console.error("Error closing audio context:", err));
        }
      } catch (err) {
          console.warn("Error while closing AudioContext:", err);
      }
      audioContextRef.current = null;
    }
    
    // Reset analyzer
    analyzerRef.current = null;
    dataArrayRef.current = null;
    setAverageFrequency(0);
    
    // Final microphone cleanup
    if (navigator.mediaDevices) {
      navigator.mediaDevices.getUserMedia({ audio: true })
        .then(tempStream => {
          tempStream.getTracks().forEach(track => {
            track.enabled = false;
            track.stop();
          });
        })
        .catch(err => console.warn("Error in final cleanup:", err));
    }
  };
  
  useEffect(() => {
    async function setupAudio() {
      try {
        // Request microphone access
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        streamRef.current = stream;
        
        // Create audio context and analyzer
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        audioContextRef.current = audioContext;
        
        const analyzer = audioContext.createAnalyser();
        analyzer.fftSize = 256;
        analyzer.smoothingTimeConstant = 0.8;
        analyzerRef.current = analyzer;
        
        // Connect microphone to analyzer
        const source = audioContext.createMediaStreamSource(stream);
        source.connect(analyzer);
        sourceRef.current = source;
        
        // Create data array
        const bufferLength = analyzer.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        dataArrayRef.current = dataArray;
        
        // Start analyzing
        function analyze() {
          if (!analyzerRef.current) return;
          
          analyzerRef.current.getByteFrequencyData(dataArray);
          
          // Calculate average frequency
          let sum = 0;
          for (let i = 0; i < dataArray.length; i++) {
            sum += dataArray[i];
          }
          const avg = sum / dataArray.length;
          const normalized = Math.min(avg / 128, 1); // Normalize to 0-1
          
          setAverageFrequency(normalized);
          animationFrameRef.current = requestAnimationFrame(analyze);
        }
        
        analyze();
      } catch (error) {
        console.error("Error accessing microphone:", error);
      }
    }
    
    setupAudio();
    
    return cleanupAudio;
  }, []);
  
  return { averageFrequency, cleanupAudio };
}

function AnimatedSphere({ isActive, voiceFrequency = 0 }) {
  const meshRef = useRef(null);
  
  // Smooth frequency changes
  const smoothedFrequency = useRef(voiceFrequency);
  
  useFrame((state) => {
    if (!meshRef.current) return;
    
    // Smooth the frequency changes for more natural animation
    smoothedFrequency.current += (voiceFrequency - smoothedFrequency.current) * 0.1;
    
    const time = state.clock.getElapsedTime();
    
    // Only animate when user is speaking
    if (isActive) {
      // Rotation that responds to voice
      meshRef.current.rotation.x = time * 0.2 * 1.5 + (smoothedFrequency.current * Math.PI * 0.2);
      meshRef.current.rotation.y = time * 0.3 * 1.5 - (smoothedFrequency.current * Math.PI * 0.1);
      
      // Pulsing that intensifies with voice
      const voicePulse = smoothedFrequency.current * 0.3;
      meshRef.current.position.y = voicePulse;
      
      // Voice-reactive scaling
      const baseScale = 0.4;
      const voiceEffect = smoothedFrequency.current * 0.5;
      
      // Apply scale with smoothing
      const finalScale = baseScale + voiceEffect;
      meshRef.current.scale.set(finalScale, finalScale, finalScale);
      
      // Dynamic distortion based on voice
      if (meshRef.current.material) {
        // Base distortion + voice influence
        const baseDistort = 0.2;
        const voiceDistort = smoothedFrequency.current * 0.5;
        
        meshRef.current.material.distort = baseDistort + voiceDistort;
        
        // Speed up distortion with voice
        meshRef.current.material.speed = 1 + (smoothedFrequency.current * 5);
      }
    } else {
      // Set static position and appearance when not speaking
      meshRef.current.rotation.x = 0;
      meshRef.current.rotation.y = 0;
      meshRef.current.position.y = 0;
      meshRef.current.scale.set(0.4, 0.4, 0.4);
      
      if (meshRef.current.material) {
        meshRef.current.material.distort = 0.2;
        meshRef.current.material.speed = 1;
      }
    }
  });

  return (
    <Sphere args={[1, 64, 64]} ref={meshRef}>
      <MeshDistortMaterial
        attach="material"
        distort={0.2}
        speed={2}
        roughness={0.4}
        metalness={0.6}
        radius={1}
      >
        <primitive attach="map" object={gradientTexture} />
      </MeshDistortMaterial>
    </Sphere>
  );
}

// Add a MessageContent component for markdown rendering
function MessageContent({ content }) {
  if (!content) return null;
  
  return (
    <div className="text-white/90 text-sm leading-relaxed break-words">
      <ReactMarkdown 
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ node, ...props }) => (
            <a {...props} target="_blank" rel="noopener noreferrer" className="text-blue-300 underline" />
          ),
          p: ({ node, ...props }) => (
            <p {...props} className="mb-2" />
          ),
          ul: ({ node, ...props }) => (
            <ul {...props} className="list-disc pl-5 mb-2" />
          ),
          ol: ({ node, ...props }) => (
            <ol {...props} className="list-decimal pl-5 mb-2" />
          ),
          li: ({ node, ...props }) => (
            <li {...props} className="mb-1" />
          ),
          code: ({ node, inline, className, children, ...props }) => {
            if (inline) {
              return (
                <code className="bg-[#1a1020]/50 px-1 py-0.5 rounded text-pink-200" {...props}>
                  {children}
                </code>
              );
            }
            return (
              <pre className="bg-[#1a1020]/50 p-2 rounded mb-2 overflow-x-auto">
                <code className="text-pink-200" {...props}>
                  {children}
                </code>
              </pre>
            );
          }
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

// Example voice frequency normalization
const normalizeFrequency = (rawFrequency) => {
  const minFreq = 0;
  const maxFreq = 255; // Adjust based on your audio analysis
  return Math.min(1, Math.max(0, (rawFrequency - minFreq) / (maxFreq - minFreq)));
};

// Enhanced VoiceRecordingOverlay component
function VoiceRecordingOverlay({ 
  onClose, 
  isRecording, 
  isUserSpeaking, 
  isAISpeaking,
  messages = [],
  isProcessing
}) {
  const [intensity, setIntensity] = useState(1);
  const messagesEndRef = useRef(null);
  
  // Use our custom hook to get real-time frequency data
  const { averageFrequency, cleanupAudio } = useAudioAnalyzer();
  
  // Visual debug of frequency (optional)
  const [debug, setDebug] = useState(false);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isProcessing]);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'auto';
    };
  }, []);

  useEffect(() => {
    const handleVoiceResponse = (event) => {
      if (event.detail && event.detail.message) {
        document.dispatchEvent(new CustomEvent('voiceOverlayMessageUpdate', { 
          detail: { message: event.detail.message }
        }));
      }
    };
    
    // Add event listener
    document.addEventListener('voiceResponseReceived', handleVoiceResponse);
    
    // Clean up event listener
    return () => {
      document.removeEventListener('voiceResponseReceived', handleVoiceResponse);
    };
  }, []);

  // Force rerender of Canvas to ensure it initializes correctly
  const [canvasKey, setCanvasKey] = useState(0);
  
  useEffect(() => {
    // Force canvas to reinitialize once component is mounted
    setCanvasKey(prev => prev + 1);
  }, []);

  // Enhanced handle close with more thorough cleanup
  const handleClose = () => {
    
    // First, clean up the audio resources completely
    cleanupAudio();
    
    // Force any lingering media tracks to stop
    navigator.mediaDevices.enumerateDevices()
      .then(() => {
        // This can trigger browser to release microphone permissions
      })
      .catch(err => console.warn("Error during device enumeration:", err));
    
    // Request mic one last time just to clean up any lingering streams
    navigator.mediaDevices.getUserMedia({ audio: true })
      .then(stream => {
        stream.getTracks().forEach(track => {
          track.enabled = false;
          track.stop();
        });
      })
      .catch(err => console.warn("Error in final media cleanup:", err));
    
    // Dispatch event to notify other components
    document.dispatchEvent(new CustomEvent('stopVoiceOverlay', {
      detail: { 
        stopProcessing: true, 
        forceCleanup: true,
        source: 'VoiceRecordingOverlay'
      }
    }));
    
    // Small delay before notifying parent to ensure cleanup completes
    setTimeout(() => {
      // Notify parent that overlay is closing
      if (onClose) {
        onClose();
      }
    }, 100);
  };
  
  // Enhanced cleanup effect
  useEffect(() => {

    // Return cleanup function
    return () => {
      cleanupAudio();
      
      // Force stop any lingering microphone connections
      setTimeout(() => {
        if (navigator.mediaDevices) {
          navigator.mediaDevices.getUserMedia({ audio: true })
            .then(stream => {
              stream.getTracks().forEach(track => {
                track.enabled = false;
                track.stop();
              });
            })
            .catch(err => console.warn("Error in unmount cleanup:", err));
        }
      }, 100);
      
      // Notify other components
      document.dispatchEvent(new CustomEvent('stopVoiceOverlay', {
        detail: { 
          stopProcessing: true, 
          forceCleanup: true,
          source: 'VoiceRecordingOverlay'
        }
      }));
    };
  }, []);

  return createPortal(
    <AnimatePresence>
      <motion.div 
        className="fixed inset-0 w-screen h-screen z-[99999]"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        role="dialog"
        aria-label="Voice Chat"
      >
        <div className="absolute inset-0 bg-gradient-to-b from-[#dae2f8] to-[#d6a4a4]" />
        
        {/* Debug frequency meter (optional) */}
        {debug && (
          <div className="absolute top-16 right-4 bg-black/50 p-2 rounded z-10">
            <div className="w-32 h-4 bg-gray-800 rounded overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-blue-500 to-purple-500"
                style={{ width: `${averageFrequency * 100}%` }}
              />
            </div>
            <div className="text-xs text-white mt-1">
              Frequency: {(averageFrequency * 100).toFixed(1)}%
            </div>
          </div>
        )}
        
        {/* Rest of the UI */}
        <div className="relative h-full flex flex-col">
          {/* Close button */}
          <div className="absolute top-4 left-4">
            <motion.button
              onClick={handleClose}
              className="p-2 rounded-full hover:bg-white/10 transition-colors duration-200"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <FiX className="w-6 h-6 text-white/90" />
            </motion.button>
          </div>
          {/* Messages */}
          <div className="flex-1 px-4 overflow-y-auto scrollbar-none pt-16 pb-48">
            <div className="max-w-2xl mx-auto space-y-4">
              {messages.map((msg, index) => (
                <motion.div
                  key={index}
                  className={`flex ${msg.type === 'user' ? 'justify-end' : 'justify-start'}`}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <div 
                    className={`max-w-[80%] rounded-2xl p-4 ${
                      msg.type === 'user' 
                        ? 'bg-gradient-to-r from-[#2a1835] to-[#1a1020] shadow-lg'
                        : 'bg-[#1a1020] shadow-lg'
                    }`}
                  >
                    <MessageContent content={msg.content} />
                  </div>
                </motion.div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          </div>

          {/* 3D Sphere visualization */}
          <div className="absolute bottom-0 left-0 right-0 h-64"> {/* Increased height for better visibility */}
            <Canvas 
              key={canvasKey}
              camera={{ position: [0, 0, 3], fov: 50 }}
              style={{ WebkitBackfaceVisibility: 'hidden' }}
              gl={{ antialias: true, alpha: true }}
            >
              {/* Enhanced lighting for better visual effect */}
              <ambientLight intensity={0.8} />
              <pointLight position={[5, 5, 5]} intensity={1} />
              <pointLight position={[-5, -5, -5]} intensity={0.5} />
              
              {/* Pass the real-time frequency data to the sphere */}
              <AnimatedSphere 
                isActive={isUserSpeaking || averageFrequency > 0.05} 
                voiceFrequency={averageFrequency}
              />
            </Canvas>
            
            <motion.span 
              className="absolute bottom-6 left-1/2 transform -translate-x-1/2 text-white/90 text-sm"
              animate={{ opacity: [0.7, 1, 0.7] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              {isUserSpeaking || averageFrequency > 0.05 ? "Listening..." : 
               isAISpeaking ? "Speaking..." : "Try saying something..."}
            </motion.span>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>,
    document.body
  );
}

export default VoiceRecordingOverlay; 
