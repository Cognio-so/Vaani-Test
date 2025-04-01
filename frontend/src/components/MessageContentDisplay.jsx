import React, { useState, useContext } from 'react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { atomDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import remarkGfm from 'remark-gfm';
import { FaDownload, FaRegCopy } from 'react-icons/fa';
import { TbCopyCheckFilled } from 'react-icons/tb';
import { ThemeContext } from '../App';
import ModernAudioPlayer from './ModernAudioPlayer';

// Helper functions
const extractMediaUrls = (content) => {
  if (!content) return { text: '', imageUrls: [], musicUrls: [] };
  
  const imageRegex = /!\[(.*?)\]\((https?:\/\/\S+\.(?:jpg|jpeg|png|gif|webp))\)|(?<!\[)(https?:\/\/\S+\.(?:jpg|jpeg|png|gif|webp))(?!\])/gi;
  const musicRegex = /(https?:\/\/\S+\.(?:mp3|wav|ogg|m4a)(?:\S*))|(https?:\/\/(?:api\.musicfy\.lol|replicate\.delivery|replicate\.com|\w+\.(?:r2\.cloudflarestorage|cloudfront|amazonaws))\.com\/\S+)/gi;
  
  const imageUrls = [];
  const musicUrls = [];
  
  let imageMatch;
  while ((imageMatch = imageRegex.exec(content)) !== null) {
    imageUrls.push(imageMatch[2] || imageMatch[0]);
  }
  
  let musicMatch;
  while ((musicMatch = musicRegex.exec(content)) !== null) {
    musicUrls.push(musicMatch[0]);
  }
  
  let text = content;
  [...imageUrls, ...musicUrls].forEach(url => {
    text = text.replace(new RegExp(`^${url.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')}$`, 'gm'), '');
    text = text.replace(new RegExp(url.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'), 'g'), '');
    text = text.replace(new RegExp(`!\\[.*?\\]\\(${url.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')}\\)`, 'g'), '');
  });
  
  return { text, imageUrls, musicUrls };
};

const extractSources = (content) => {
  if (!content) return [];
  
  // Look for URLs in the content
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const sources = [];
  let match;
  
  // Find all URLs in the content
  while ((match = urlRegex.exec(content)) !== null) {
    try {
      const url = match[0].replace(/\.$/, ''); // Remove trailing period if present
      
      // Skip media URLs
      const isMediaUrl = 
        /\.(jpg|jpeg|png|gif|webp|mp3|wav|ogg|m4a)$/i.test(url) || 
        url.includes('musicfy.lol') || 
        url.includes('replicate.delivery') || 
        url.includes('replicate.com') ||
        url.includes('r2.cloudflarestorage') ||
        url.includes('cloudfront') ||
        url.includes('amazonaws');
      
      // Only add unique non-media URLs
      if (!isMediaUrl && !sources.some(s => s.url === url)) {
        sources.push({
          url: url,
          // Try to extract domain for title
          title: new URL(url).hostname.replace('www.', '')
        });
      }
    } catch (e) {
      console.error("Error parsing URL:", match[0]);
    }
  }
  
  return sources;
};

const SourcesDropdown = ({ sources }) => {
  const { theme } = useContext(ThemeContext);
  const [isOpen, setIsOpen] = useState(false);
  
  if (!sources || sources.length === 0) return null;
  
  // Function to determine if a URL is a storage or media URL
  const isStorageUrl = (url) => {
    try {
      const domain = new URL(url).hostname;
      return domain.includes('cloudflarestorage') || 
              domain.includes('amazonaws') ||
              domain.includes('cloudfront') ||
              domain.includes('replicate');
    } catch (e) {
      return false;
    }
  };
  
  // Get icon for the source based on domain type
  const getSourceIcon = (source) => {
    try {
      const url = source.url;
      const domain = new URL(url).hostname;
      
      // For storage URLs, use a custom generic icon
      if (isStorageUrl(url)) {
        return (
          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 6C2.89543 6 2 6.89543 2 8V16C2 17.1046 2.89543 18 4 18H20C21.1046 18 22 17.1046 22 16V8C22 6.89543 21.1046 6 20 6H4Z" />
            <path d="M12 18V6" />
          </svg>
        );
      }
      
      // For normal websites, use a favicon with fallback
      return (
        <img 
          src={`https://www.google.com/s2/favicons?domain=${domain}&sz=32`} 
          alt=""
          className="w-4 h-4"
          onError={(e) => {
            e.target.onerror = null;
            e.target.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' width='24' height='24'%3E%3Cpath fill='none' d='M0 0h24v24H0z'/%3E%3Cpath d='M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z' fill='%23999'/%3E%3C/svg%3E";
          }}
        />
      );
    } catch (e) {
      // Fallback for invalid URLs
      return (
        <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" y1="8" x2="12" y2="12"></line>
          <line x1="12" y1="16" x2="12.01" y2="16"></line>
        </svg>
      );
    }
  };
  
  return (
    <div className="mt-2">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center space-x-2 rounded-lg px-2 py-1.5 text-xs ${
          theme === 'dark' 
            ? 'bg-white/10 hover:bg-white/15 text-white' 
            : 'bg-gray-100 hover:bg-gray-200 text-gray-800'
        } transition-colors`}
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="7 10 12 15 17 10"></polyline>
        </svg>
        <span>{sources.length} {sources.length === 1 ? 'Source' : 'Sources'}</span>
      </button>
      
      {isOpen && (
        <div className={`mt-2 p-2 rounded-lg ${
          theme === 'dark' 
            ? 'bg-black/40 border border-white/10' 
            : 'bg-white border border-gray-200 shadow-md'
        }`}>
          <div className="flex flex-wrap gap-2">
            {sources.map((source, index) => {
              try {
                const domain = new URL(source.url).hostname;
                const title = source.title || domain.replace('www.', '');
                
                return (
                  <a 
                    key={index}
                    href={source.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`flex items-center rounded-md p-2 ${
                      theme === 'dark' 
                        ? 'bg-white/5 hover:bg-white/10' 
                        : 'bg-gray-50 hover:bg-gray-100'
                    } transition-colors`}
                    title={source.url}
                  >
                    <div className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center mr-2 ${
                      theme === 'dark' ? 'bg-white/10' : 'bg-gray-100'
                    }`}>
                      {getSourceIcon(source)}
                    </div>
                    <span className={`text-xs font-medium ${
                      theme === 'dark' ? 'text-white' : 'text-gray-800'
                    }`}>
                      {title}
                    </span>
                  </a>
                );
              } catch (e) {
                return null;
              }
            })}
          </div>
        </div>
      )}
    </div>
  );
};

const MessageContent = ({ content, forceImageDisplay, forceAudioDisplay, onMediaLoaded, isStreaming, agentStatus }) => {
  const { theme } = useContext(ThemeContext);
  
  // Extract sources BEFORE any cleaning
  const sources = extractSources(content);
  
  // Extract media
  const { text, imageUrls: extractedImageUrls, musicUrls: extractedMusicUrls } = extractMediaUrls(content);
  
  // --- Enhanced Text Cleaning Logic ---
  let cleanedText = text;
  
  // 1. Remove "Sources:" headers (case-insensitive, targeting start of line)
  cleanedText = cleanedText.replace(/^\s*(\*\*Sources:\*\*|Sources:)\s*/gmi, '');
  
  // 2. Remove lines that are list items containing extracted source URLs
  if (sources.length > 0) {
      const sourceUrlsEscaped = sources.map(s => s.url.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'));
      const sourceUrlPattern = `(?:${sourceUrlsEscaped.join('|')})`; // Combine all source URLs

      // Regex to match lines starting with list markers (*, -, digits.) containing *any* extracted source URL
      // Now also matches if the list marker is directly followed by the URL without much text
      const listLineWithSourceRegex = new RegExp(`^\\s*([-*]|\\d+\\.)\\s+.*?${sourceUrlPattern}.*?$`, 'gm');
      cleanedText = cleanedText.replace(listLineWithSourceRegex, '');

      // 3. Remove lines that *only* contain a source URL (and maybe surrounding whitespace/brackets)
      const standaloneSourceLineRegex = new RegExp(`^\\s*\\[?${sourceUrlPattern}\\]?\\s*$`, 'gm');
      cleanedText = cleanedText.replace(standaloneSourceLineRegex, '');

       // 3b. Remove source URLs if they appear alone at the end of other lines
       sources.forEach(source => {
           const urlEscaped = source.url.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
           // Ensure we don't break markdown image/links by checking what precedes the URL
           // Remove URL if preceded by space and followed by optional space/punctuation then end of line.
           cleanedText = cleanedText.replace(new RegExp(`(?<!\\]\\()\\s+${urlEscaped}[\\s.,;!?]*$`, 'gm'), '');
       });
  }

  // 4. Clean up excessive newlines and resulting empty lines
  cleanedText = cleanedText.replace(/\n{3,}/g, '\n\n');
  cleanedText = cleanedText.split('\n').filter(line => line.trim().length > 0).join('\n');
  cleanedText = cleanedText.trim();
  // --- End of Enhanced Cleaning ---

  // Combine extracted media with potentially passed-in props for explicit display
  const imageUrls = forceImageDisplay ? extractedImageUrls : [];
  const musicUrls = forceAudioDisplay ? extractedMusicUrls : [];

  const handleImageDownload = (url) => {
    const xhr = new XMLHttpRequest();
    xhr.open('GET', url, true);
    xhr.responseType = 'blob';
    xhr.onload = function() {
      if (this.status === 200) {
        const blob = new Blob([this.response], { type: 'image/jpeg' });
        
        const blobUrl = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = 'image-' + Date.now() + '.jpg';
        
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        
        setTimeout(() => {
          URL.revokeObjectURL(blobUrl);
        }, 100);
      }
    };
    xhr.send();
  };
  
  return (
    <div className={`message-content break-words ${theme === 'dark' ? 'text-white' : 'text-gray-800'}`}>
      {/* Agent Status Display */}
      {agentStatus && (
          <div className={`mb-2 rounded-lg p-1.5 px-2.5 inline-block ${theme === 'dark' ? 'bg-white/[0.08]' : 'bg-gray-100'} shadow-sm`}>
              <div className="flex items-center space-x-1.5">
                  {/* Optional: Add a small spinner or icon here */}
                  <span className={`text-xs ${theme === 'dark' ? 'text-gray-300' : 'text-gray-600'} opacity-90`}>{agentStatus}</span>
              </div>
          </div>
      )}

      {/* Main Message Content */}
      {/* Render placeholder dots if streaming and cleanedText is empty initially */}
      {(cleanedText || (isStreaming && !cleanedText && !agentStatus)) && (
          <div className={`prose ${theme === 'dark' ? 'prose-invert' : ''} prose-sm sm:prose-base max-w-none overflow-hidden`}>
              <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                      code({ node, inline, className, children, ...props }) {
                        const match = /language-(\w+)/.exec(className || '');
                        const codeString = String(children).replace(/\n$/, '');
                        const [copied, setCopied] = useState(false);

                        const copyToClipboard = (text) => {
                          navigator.clipboard.writeText(text)
                            .then(() => {
                              setCopied(true);
                              setTimeout(() => setCopied(false), 2000);
                            })
                            .catch(err => {
                              console.error('Failed to copy code: ', err);
                            });
                        };

                        return !inline && match ? (
                          <div className="code-block not-prose my-4 rounded-md overflow-hidden bg-[#1e1e1e] border border-gray-700">
                            <div className={`flex justify-between items-center px-3 py-1.5 ${theme === 'dark' ? 'bg-gray-800/50' : 'bg-gray-200/80'} border-b border-gray-700`}>
                              <span className="text-xs font-medium text-gray-400 select-none">{match[1]}</span>
                              <button
                                onClick={() => copyToClipboard(codeString)}
                                className={`flex items-center space-x-1 px-2 py-0.5 rounded text-xs transition-colors ${copied ? 'text-green-400' : theme === 'dark' ? 'text-gray-400 hover:text-white hover:bg-gray-700' : 'text-gray-600 hover:text-black hover:bg-gray-300'}`}
                                title={copied ? "Copied!" : "Copy code"}
                              >
                                {copied ? <TbCopyCheckFilled className="h-3.5 w-3.5" /> : <FaRegCopy className="h-3.5 w-3.5" />}
                                <span>{copied ? 'Copied' : 'Copy'}</span>
                              </button>
                            </div>
                            <SyntaxHighlighter
                              style={atomDark}
                              language={match[1]}
                              PreTag="div"
                              customStyle={{
                                margin: '0',
                                padding: '0.5rem 0.75rem', // Adjusted padding
                                background: 'transparent', // Handled by outer div
                                fontSize: '13px', // Slightly smaller
                                lineHeight: '1.5',
                              }}
                              codeTagProps={{ style: { fontFamily: 'inherit', fontSize: 'inherit' }}} // Use monospace from theme potentially
                              wrapLines={false}
                              wrapLongLines={false}
                              className="code-syntax scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-transparent" // Added scrollbar styling
                              {...props}
                            >
                              {codeString}
                            </SyntaxHighlighter>
                          </div>
                        ) : (
                          // Inline code styling
                          <code className={`before:content-[''] after:content-[''] px-1 py-0.5 rounded text-sm ${theme === 'dark' ? 'bg-white/10 text-pink-400' : 'bg-gray-200 text-pink-600'}`} {...props}>
                            {children}
                          </code>
                        );
                      },
                      a: ({ node, ...props }) => {
                        const href = props.href || '';
                        // Check if it's one of the extracted media URLs before skipping
                        const isExtractedMedia = extractedImageUrls.includes(href) || extractedMusicUrls.includes(href);
                        const isOtherMedia = /\.(jpg|jpeg|png|gif|webp|mp3|wav|ogg|m4a)$/i.test(href) ||
                                              href.includes('musicfy.lol') ||
                                              href.includes('replicate');

                        if (isExtractedMedia || isOtherMedia) {
                          return null; // Don't render links for media URLs that will be displayed separately
                        }

                        return (
                          <a {...props} target="_blank" rel="noopener noreferrer" className="text-[#cc2b5e] hover:underline" />
                        );
                      },
                       // Add specific styling for lists
                      ul: ({ node, ordered, ...props }) => <ul className="list-disc list-outside pl-5 space-y-1" {...props} />,
                      ol: ({ node, ordered, ...props }) => <ol className="list-decimal list-outside pl-5 space-y-1" {...props} />,
                      li: ({ node, ordered, ...props }) => <li className="leading-relaxed" {...props} />,
                     // Table styling
                      table: ({ node, ...props }) => (
                        <div className="overflow-x-auto my-4 border rounded-md">
                           <table {...props} className={`w-full border-collapse ${theme === 'dark' ? 'border-gray-700' : 'border-gray-300'}`} />
                        </div>
                      ),
                      thead: ({ node, ...props }) => <thead className={`${theme === 'dark' ? 'bg-gray-800/50' : 'bg-gray-100/80'}`} {...props} />,
                      th: ({ node, isHeader, ...props }) => (
                        <th {...props} className={`border-b ${theme === 'dark' ? 'border-gray-700' : 'border-gray-300'} px-3 py-2 text-left font-semibold text-sm`} />
                      ),
                      td: ({ node, isHeader, ...props }) => (
                        <td {...props} className={`border-b ${theme === 'dark' ? 'border-gray-700' : 'border-gray-300'} px-3 py-2 text-sm`} />
                      ),
                      // Add cursor for streaming effect only if streaming and it's the last bit of text
                      p: ({node, children, ...props}) => {
                        const isLastChild = node === node.parent?.children[node.parent.children.length - 1];
                        const lastChar = typeof children[children.length - 1] === 'string' ? children[children.length - 1].slice(-1) : '';
                        const cursorClass = isStreaming && isLastChild && lastChar !== '\n' ? ' streaming-cursor' : '';
                        return <p {...props} className={`mb-3 last:mb-0${cursorClass}`}>{children}</p>;
                      },
                  }}
              >
                  {/* Add streaming cursor logic here or via CSS if preferred */}
                  {isStreaming && !cleanedText && !agentStatus ? '...' : cleanedText}
              </ReactMarkdown>
               {/* Add explicit streaming cursor if ReactMarkdown renders nothing */}
              {isStreaming && !cleanedText && !agentStatus && <span className="streaming-cursor"></span>}
          </div>
      )}

      {/* Sources dropdown */}
      {sources.length > 0 && !isStreaming && <SourcesDropdown sources={sources} />}

      {/* Media Display */}
      {/* Image display */}
      {imageUrls.length > 0 && (
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
          {imageUrls.map((url, index) => (
            <div key={`img-${index}`} className="relative group aspect-video rounded-lg overflow-hidden border border-gray-700/50">
              <img
                src={url}
                alt={`Image ${index + 1}`}
                className="w-full h-full object-contain bg-black/20" // Changed object-contain
                onLoad={onMediaLoaded} // Call when image is actually loaded
                onError={(e) => {
                  e.target.onerror = null;
                  e.target.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='200' viewBox='0 0 300 200'%3E%3Crect width='300' height='200' fill='%23333'/%3E%3Ctext x='50%25' y='50%25' font-family='Arial' font-size='14' text-anchor='middle' dominant-baseline='middle' fill='%23999'%3EImage Load Error%3C/text%3E%3C/svg%3E";
                  if (onMediaLoaded) onMediaLoaded(); // Also call on error to stop loading state
                }}
              />
              <button
                onClick={() => handleImageDownload(url)}
                 className="absolute bottom-2 right-2 bg-black/50 hover:bg-black/70 text-white rounded-full w-8 h-8 flex items-center justify-center transition-all opacity-0 group-hover:opacity-100 shadow-md"
                title="Download image"
              >
                <FaDownload className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}

       {/* Audio display */}
      {musicUrls.length > 0 && (
        <div className="mt-3 space-y-3">
          {musicUrls.map((url, index) => (
            <ModernAudioPlayer key={`audio-${index}`} url={url} onAudioLoaded={onMediaLoaded}/>
          ))}
        </div>
      )}
    </div>
  );
};

export default MessageContent;

export const sanitizeContent = (content) => {
  if (!content) return '';
  // Keep existing logic, maybe refine slightly if needed
  let sanitized = content.replace(
    /(https?:\/\/\S+\.(jpg|jpeg|png|gif|webp))(\?\S*)?/gi,
    '[image]'
  );
  sanitized = sanitized.replace(
      /(https?:\/\/\S+\.(mp3|wav|ogg|m4a))(\?\S*)?/gi,
      '[audio]'
  );
  sanitized = sanitized.replace(
      /(https?:\/\/(?:api\.musicfy\.lol|replicate\.delivery|replicate\.com|\w+\.(?:r2\.cloudflarestorage|cloudfront|amazonaws))\.com\/\S+)/gi,
      (match) => (/\.(mp3|wav|ogg|m4a)/.test(match) ? '[audio]' : '[media_link]') // Be more specific
  );
  // Remove potential markdown image syntax left over
  sanitized = sanitized.replace(/!\[.*?\]\((?:\[image\]|\[media_link\])\)/g, '[image]');
  return sanitized;
}; 