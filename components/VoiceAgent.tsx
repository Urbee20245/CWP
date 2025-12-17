import React, { useState, useRef, useEffect } from 'react';
import { X, MessageSquare, Bot, Send, Sparkles } from 'lucide-react';
import { GoogleGenAI } from '@google/genai';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
}

const VoiceAgent: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatSessionRef = useRef<any>(null);
  const [configError, setConfigError] = useState<string | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isOpen]);

  const initChat = async () => {
    if (chatSessionRef.current) return;

    try {
      const importMetaEnv = (import.meta as any).env;
      const apiKey = importMetaEnv?.VITE_GEMINI_API_KEY || 
                     importMetaEnv?.GEMINI_API_KEY ||
                     process.env.API_KEY || 
                     process.env.GEMINI_API_KEY;

      const modelName = importMetaEnv?.VITE_GEMINI_MODEL || 'gemini-2.0-flash-exp';

      console.log('Luna AI: Initializing with model:', modelName);
      console.log('Luna AI: API Key present:', !!apiKey);

      if (!apiKey) {
        const err = "Configuration Error: Google Gemini API Key is missing. Please add VITE_GEMINI_API_KEY to your environment variables.";
        console.error(err);
        setConfigError(err);
        return;
      }

      // Initialize the client
      const ai = new GoogleGenAI({ apiKey });
      
      // Note: @google/genai v1.0+ structure might differ. 
      // If getGenerativeModel is not available, we might need to fallback or check docs.
      // Assuming standard usage for now based on package version.
      
      // Configure the model
      const systemInstruction = `You are Luna, a professional and knowledgeable AI receptionist for Custom Websites Plus.

COMPANY INFO:
- Location: Atlanta, Georgia (serving metro Atlanta area)
- Phone: (404) 532-9266
- Email: hello@customwebsitesplus.com
- Hours: Mon-Fri 9AM-6PM ET, Sat 10AM-4PM ET, Sun Closed

PRIMARY SERVICE - WEBSITE REBUILD:
We transform outdated websites into modern, high-performance digital assets. Includes: modern design, mobile-first development, complete SEO, AI chatbot integration, performance optimization, security, 4-6 week timeline, 90-day support.

PACKAGES:
- Essential: Small businesses, up to 5 pages
- Professional: Established businesses, up to 10 pages (MOST POPULAR)
- Enterprise: Large/multi-location, unlimited pages
Pricing: Custom quotes $5,000-$15,000 based on scope.

FREE TOOLS (at customwebsitesplus.com/jetsuite):
1. Jet Local Optimizer: Complete website health check (Core Web Vitals, mobile, SEO, local relevance)
2. JetViz: Visual website modernization analysis (design era detection, trust signals)

WHY US:
- Data-driven approach (we analyze, not guess)
- Proven results with successful rebuilds
- Local Atlanta expertise
- AI integration specialists
- Built for SEO from day one

YOUR BEHAVIOR:
- Be professional, helpful, and knowledgeable
- Keep responses concise (2-3 sentences)
- Always offer free analysis tools as no-pressure next step
- For pricing: Explain custom nature, give general range if pressed ($5k-$15k), suggest consultation
- For objections: Address concern, relate to expertise, offer free analysis or consultation
- Goal: Qualify leads and schedule consultations

KEY PHRASES:
- "Have you tried our free website analysis tools?"
- "Let me help you schedule a consultation"
- "Every project is unique, so we provide custom quotes"`;

      // Depending on the exact version of @google/genai, the method to start chat might vary.
      // If this throws, we catch it below.
      // Trying the most standard interface for the newer SDKs.
      // If getGenerativeModel is not a function, we might be on a version that uses a different entry point.
      
      let chat;
      
      // Attempt 1: Standard GenerativeAI style (likely what's expected)
      try {
          const model = ai.getGenerativeModel({ 
            model: modelName,
            systemInstruction: systemInstruction
          });
          
          chat = model.startChat({
            history: []
          });
      } catch (e: any) {
          console.warn("Luna AI: Standard init failed, checking alternatives...", e);
          // Fallback or re-throw if critical
          throw e; 
      }

      chatSessionRef.current = chat;

      // Initial message
      if (messages.length === 0) {
        setMessages([{
          id: 'intro',
          role: 'assistant',
          text: "Hi! I'm Luna. I can help with web design questions, pricing, or booking a consultation. How can I help you today?"
        }]);
      }

    } catch (err: any) {
      console.error("Luna AI Init Error:", err);
      setConfigError(`Initialization Failed: ${err.message || 'Unknown error'}`);
    }
  };

  useEffect(() => {
    if (isOpen) {
      initChat();
    }
  }, [isOpen]);

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!inputValue.trim() || isTyping) return;

    const text = inputValue.trim();
    setInputValue('');
    setMessages(prev => [...prev, { id: Date.now().toString(), role: 'user', text }]);
    setIsTyping(true);

    try {
      if (!chatSessionRef.current) {
          await initChat();
          // If still null after retry, we have a hard failure
          if (!chatSessionRef.current) {
              throw new Error(configError || "Failed to initialize chat session. API Key may be invalid or missing.");
          }
      }
      
      const result = await chatSessionRef.current.sendMessage(text);
      const responseText = result.response.text();
      
      setMessages(prev => [...prev, { 
        id: Date.now().toString(), 
        role: 'assistant', 
        text: responseText 
      }]);
    } catch (err: any) {
      console.error("Luna AI Chat Error details:", err);
      
      let errorMessage = "I'm having trouble connecting right now. Please try again later or call us at (404) 532-9266.";
      
      // More specific error messaging
      if (err.message?.includes("API Key")) {
          errorMessage = "Configuration Error: API Key missing or invalid. Please check settings.";
      } else if (err.message?.includes("fetch")) {
          errorMessage = "Network Error: Could not reach AI services. Please check your connection.";
      } else if (err.message) {
          // Log the actual error for debugging in the UI if needed (optional)
          console.warn("Detailed error:", err.message);
      }

      setMessages(prev => [...prev, { 
        id: Date.now().toString(), 
        role: 'assistant', 
        text: errorMessage
      }]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <>
      {/* Floating Launcher */}
      <button
        onClick={() => setIsOpen(true)}
        className={`fixed bottom-8 right-8 z-40 group ${
          isOpen ? 'translate-y-24 opacity-0 pointer-events-none' : 'translate-y-0 opacity-100'
        } transition-all duration-500`}
      >
        <div className="absolute inset-0 bg-indigo-500 rounded-full blur opacity-40 group-hover:opacity-60 transition-opacity animate-pulse"></div>
        <div className="relative bg-slate-900 text-white p-4 rounded-full shadow-2xl border border-slate-700 flex items-center gap-3 hover:scale-105 transition-transform">
            <MessageSquare className="w-5 h-5 text-indigo-400" />
            <span className="font-semibold pr-2 font-sans">Chat with Luna</span>
        </div>
      </button>

      {/* Chat Window */}
      {isOpen && (
        <div className="fixed bottom-4 right-4 md:bottom-8 md:right-8 z-50 w-[95vw] md:w-[24rem] h-[36rem] max-h-[85vh] rounded-[2rem] overflow-hidden shadow-2xl glass-dark border border-white/10 animate-fade-in-up ring-1 ring-white/10 flex flex-col font-sans bg-slate-900">
          
          {/* Header */}
          <div className="p-5 border-b border-white/5 flex justify-between items-center bg-slate-900/95 backdrop-blur-md z-10">
            <div className="flex items-center gap-3">
                <div className="relative">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-indigo-500 to-violet-600 flex items-center justify-center border border-white/10 shadow-inner">
                        <Bot className="w-6 h-6 text-white" />
                    </div>
                    <span className={`absolute bottom-0 right-0 w-3 h-3 border-2 border-slate-900 rounded-full ${configError ? 'bg-red-500' : 'bg-green-500'}`}></span>
                </div>
                <div>
                    <h3 className="text-white font-bold text-base leading-none">Luna AI</h3>
                    <div className="flex items-center gap-1.5 mt-1">
                        {!configError ? (
                            <>
                                <span className="block w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
                                <span className="text-slate-400 text-xs font-medium">Online</span>
                            </>
                        ) : (
                            <span className="text-red-400 text-xs font-medium">Connection Error</span>
                        )}
                    </div>
                </div>
            </div>
            <button 
              onClick={() => setIsOpen(false)}
              className="text-slate-500 hover:text-white transition-colors bg-white/5 p-2 rounded-full hover:bg-white/10"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-slate-700">
             {messages.length === 0 && !isTyping && !configError && (
                 <div className="h-full flex flex-col items-center justify-center text-center p-6 opacity-60">
                     <div className="w-16 h-16 rounded-full bg-slate-800/50 flex items-center justify-center mb-4 border border-slate-700">
                        <Sparkles className="w-8 h-8 text-indigo-400" />
                     </div>
                     <p className="text-slate-400 text-sm">Ask about our services, pricing, or web design process.</p>
                 </div>
             )}

             {configError && messages.length === 0 && (
                 <div className="h-full flex flex-col items-center justify-center text-center p-6 text-red-400">
                     <div className="w-16 h-16 rounded-full bg-red-900/20 flex items-center justify-center mb-4 border border-red-500/20">
                        <X className="w-8 h-8" />
                     </div>
                     <p className="text-sm font-bold mb-2">Setup Required</p>
                     <p className="text-xs opacity-80">{configError}</p>
                 </div>
             )}
             
             {messages.map((msg) => (
               <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-fade-in`}>
                 <div className={`max-w-[85%] px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                   msg.role === 'user' 
                     ? 'bg-indigo-600 text-white rounded-tr-sm' 
                     : 'bg-slate-800 text-slate-200 border border-slate-700 rounded-tl-sm'
                 }`}>
                   {msg.text}
                 </div>
               </div>
             ))}
             
             {isTyping && (
               <div className="flex justify-start animate-fade-in">
                 <div className="bg-slate-800 rounded-2xl rounded-tl-sm px-4 py-4 border border-slate-700 flex items-center gap-2">
                   <div className="w-2 h-2 bg-slate-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                   <div className="w-2 h-2 bg-slate-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                   <div className="w-2 h-2 bg-slate-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                 </div>
               </div>
             )}
             <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="p-4 bg-slate-900/95 border-t border-white/5">
            <form onSubmit={handleSend} className="flex gap-2">
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder={configError ? "Unavailable" : "Ask Luna anything..."}
                disabled={!!configError}
                className="flex-1 bg-slate-800 border border-slate-700 text-white placeholder-slate-500 rounded-xl px-4 py-3 focus:outline-none focus:border-indigo-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              />
              <button
                type="submit"
                disabled={!inputValue.trim() || isTyping || !!configError}
                className="bg-indigo-600 text-white p-3 rounded-xl hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <Send className="w-5 h-5" />
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
};

export default VoiceAgent;
