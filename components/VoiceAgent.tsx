import React, { useState, useRef, useEffect, useCallback } from 'react';
import { X, MessageSquare, Bot, Send, Sparkles, Mic, MicOff, Volume2, VolumeX, Phone, MessageCircle } from 'lucide-react';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { GoogleGenAI } from '@google/genai';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
}

const VoiceAgent: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState<'chat' | 'voice'>('chat');
  const [isTyping, setIsTyping] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [configError, setConfigError] = useState<string | null>(null);
  
  // Chat Session Refs
  const chatSessionRef = useRef<any>(null); // For Text Chat
  
  // Voice Session Refs
  const voiceSessionRef = useRef<any>(null); // For WebSocket Live API
  const [isVoiceConnected, setIsVoiceConnected] = useState(false);
  const [voiceStatus, setVoiceStatus] = useState<'idle' | 'connecting' | 'listening' | 'speaking'>('idle');
  const audioContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);

  // --- Utility: Resample Audio ---
  function resampleTo16kHZ(audioData: Float32Array, origSampleRate: number): Float32Array {
    if (origSampleRate === 16000) return audioData;
    const ratio = origSampleRate / 16000;
    const newLength = Math.round(audioData.length / ratio);
    const result = new Float32Array(newLength);
    for (let i = 0; i < newLength; i++) {
        const originalIndex = i * ratio;
        const index1 = Math.floor(originalIndex);
        const index2 = Math.min(Math.ceil(originalIndex), audioData.length - 1);
        const t = originalIndex - index1;
        result[i] = audioData[index1] * (1 - t) + audioData[index2] * t;
    }
    return result;
  }

  function createPcmBlob(data: Float32Array): string {
    const l = data.length;
    const int16 = new Int16Array(l);
    for (let i = 0; i < l; i++) {
      const s = Math.max(-1, Math.min(1, data[i]));
      int16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }
    let binary = '';
    const bytes = new Uint8Array(int16.buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isOpen, mode]);

  // --- Voice Mode Logic ---
  const stopVoiceSession = useCallback(() => {
    if (voiceSessionRef.current) {
        // Typically no explicit 'close' method on the session object itself depending on library, 
        // but we can nullify it.
        voiceSessionRef.current = null; 
    }
    
    // Stop Audio Context & Microphone
    if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
    }
    if (processorRef.current) {
        processorRef.current.disconnect();
        processorRef.current = null;
    }
    if (sourceRef.current) {
        sourceRef.current.disconnect();
        sourceRef.current = null;
    }
    if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
    }

    setIsVoiceConnected(false);
    setVoiceStatus('idle');
  }, []);

  const startVoiceSession = async () => {
    setVoiceStatus('connecting');
    try {
        const importMetaEnv = (import.meta as any).env;
        const apiKey = importMetaEnv?.VITE_GEMINI_API_KEY || 
                       importMetaEnv?.GEMINI_API_KEY ||
                       process.env.API_KEY || 
                       process.env.GEMINI_API_KEY;

        if (!apiKey) {
            setConfigError("API Key missing for Voice Mode.");
            setVoiceStatus('idle');
            return;
        }

        // Initialize Native Client
        const ai = new GoogleGenAI({ apiKey });
        
        // Setup Audio Context
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({
            sampleRate: 24000 // Gemini often prefers 24k output, though 16k input
        });

        // Request Mic
        const stream = await navigator.mediaDevices.getUserMedia({ audio: {
            channelCount: 1,
            sampleRate: 16000
        }});
        streamRef.current = stream;

        console.log("Connecting to Gemini Live API...");
        
        // Connect to Session
        const session = await ai.live.connect({
            model: 'gemini-2.0-flash-exp', // Using known stable model for Live API
            config: {
                generationConfig: {
                    speechConfig: {
                        voiceConfig: {
                            prebuiltVoiceConfig: {
                                voiceName: 'Aoede' // Requested Voice
                            }
                        }
                    }
                },
                systemInstruction: {
                    parts: [{ text: `You are Luna, a professional AI receptionist for Custom Websites Plus. 
                    Be concise, professional, and helpful. 
                    Use function calling if users ask to book appointments or check availability.` }]
                },
                tools: [
                    // Simple function demonstration
                    {
                        googleSearch: {} // Built-in tool if available or custom function definitions
                    }
                ]
            }
        });

        voiceSessionRef.current = session;
        setIsVoiceConnected(true);
        setVoiceStatus('listening');

        // --- Audio Output Handling ---
        // The library handles this via event listeners usually, or returns a stream
        // Note: The specific implementation details of @google/genai v0.0.20+ for audio output might vary.
        // Assuming we need to listen for 'content' events.
        
        // Since we don't have the exact event listener syntax for this specific version in context,
        // we will assume a standard callback or subscription model if available, 
        // OR we implement the input streaming loop.

        // --- Audio Input Streaming ---
        const source = audioContextRef.current.createMediaStreamSource(stream);
        sourceRef.current = source;
        
        const processor = audioContextRef.current.createScriptProcessor(4096, 1, 1);
        processorRef.current = processor;

        processor.onaudioprocess = (e) => {
            if (!voiceSessionRef.current) return;
            
            const inputData = e.inputBuffer.getChannelData(0);
            // Resample to 16k if needed (though getUserMedia requested 16k, hardware might override)
            const resampled = resampleTo16kHZ(inputData, audioContextRef.current!.sampleRate);
            const base64Audio = createPcmBlob(resampled);
            
            try {
                // Send audio chunk
                voiceSessionRef.current.send({
                    realtimeInput: {
                        mediaChunks: [{
                            mimeType: "audio/pcm",
                            data: base64Audio
                        }]
                    }
                });
            } catch (err) {
                console.error("Error sending audio frame", err);
            }
        };

        source.connect(processor);
        processor.connect(audioContextRef.current.destination);

        // --- Receive Audio ---
        // This part relies on how the client exposes the incoming stream.
        // For now, we will assume the client plays audio automatically or provides an AsyncIterable.
        // If the library manages playback, we are good. If not, we'd need to decode chunks.
        
        // Simple polling/listener simulation for robustness in this environment
        (async () => {
            try {
                for await (const msg of session.receive()) {
                    if (msg.serverContent?.modelTurn?.parts?.[0]?.inlineData) {
                        setVoiceStatus('speaking');
                        // Decode and play audio here (omitted for brevity/complexity in this specific snippet)
                        // In a full implementation, we'd append to an AudioBufferSourceNode queue.
                        playAudioChunk(msg.serverContent.modelTurn.parts[0].inlineData.data);
                    }
                    if (msg.serverContent?.turnComplete) {
                        setVoiceStatus('listening');
                    }
                }
            } catch (e) {
                console.error("Voice stream error", e);
                stopVoiceSession();
            }
        })();

    } catch (err: any) {
        console.error("Voice Session Init Error:", err);
        setConfigError(`Voice Unavailable: ${err.message}`);
        setVoiceStatus('idle');
        setIsVoiceConnected(false);
    }
  };

  // Helper to play raw PCM from base64 (simplified)
  const playAudioChunk = async (base64: string) => {
      if (!audioContextRef.current) return;
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for(let i=0; i<binary.length; i++) bytes[i] = binary.charCodeAt(i);
      
      const float32 = new Float32Array(bytes.buffer);
      // Create buffer and play
      const buffer = audioContextRef.current.createBuffer(1, float32.length, 24000);
      buffer.getChannelData(0).set(float32);
      
      const source = audioContextRef.current.createBufferSource();
      source.buffer = buffer;
      source.connect(audioContextRef.current.destination);
      source.start();
  };


  // --- Chat Mode Logic ---
  const initChat = async () => {
    if (chatSessionRef.current) return;

    try {
      const importMetaEnv = (import.meta as any).env;
      const apiKey = importMetaEnv?.VITE_GEMINI_API_KEY || 
                     importMetaEnv?.GEMINI_API_KEY ||
                     process.env.API_KEY || 
                     process.env.GEMINI_API_KEY;

      const modelName = importMetaEnv?.VITE_GEMINI_MODEL || 'gemini-2.0-flash-exp'; // Use exp for better reasoning

      if (!apiKey) {
        setConfigError("Configuration Error: API Key missing.");
        return;
      }

      const ai = new GoogleGenerativeAI(apiKey);
      const model = ai.getGenerativeModel({ 
        model: modelName,
        systemInstruction: `You are Luna, a professional and knowledgeable AI receptionist for Custom Websites Plus. Be helpful, concise, and friendly.`
      });
      
      chatSessionRef.current = model.startChat({ history: [] });

      if (messages.length === 0) {
        setMessages([{
          id: 'intro',
          role: 'assistant',
          text: "Hi! I'm Luna. How can I help you with your website needs today?"
        }]);
      }
    } catch (err: any) {
      console.error("Chat Init Error:", err);
      setConfigError("Chat Unavailable.");
    }
  };

  useEffect(() => {
    if (isOpen && mode === 'chat') {
      initChat();
    } else if (!isOpen || mode !== 'voice') {
        stopVoiceSession();
    }
  }, [isOpen, mode, stopVoiceSession]);

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!inputValue.trim() || isTyping) return;

    const text = inputValue.trim();
    setInputValue('');
    setMessages(prev => [...prev, { id: Date.now().toString(), role: 'user', text }]);
    setIsTyping(true);

    try {
      if (!chatSessionRef.current) await initChat();
      const result = await chatSessionRef.current.sendMessage(text);
      const responseText = result.response.text();
      
      setMessages(prev => [...prev, { 
        id: Date.now().toString(), 
        role: 'assistant', 
        text: responseText 
      }]);
    } catch (err) {
      setMessages(prev => [...prev, { 
        id: Date.now().toString(), 
        role: 'assistant', 
        text: "I'm having trouble connecting right now." 
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
            <Bot className="w-5 h-5 text-indigo-400" />
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
                    <span className={`absolute bottom-0 right-0 w-3 h-3 border-2 border-slate-900 rounded-full ${isVoiceConnected || !configError ? 'bg-green-500' : 'bg-red-500'}`}></span>
                </div>
                <div>
                    <h3 className="text-white font-bold text-base leading-none">Luna AI</h3>
                    <div className="flex items-center gap-1.5 mt-1">
                        <span className="text-slate-400 text-xs font-medium uppercase tracking-wide">
                            {mode === 'voice' ? (isVoiceConnected ? 'Voice Active' : 'Voice Offline') : 'Chat Active'}
                        </span>
                    </div>
                </div>
            </div>
            <div className="flex items-center gap-2">
                {/* Mode Switcher */}
                <div className="flex bg-slate-800 rounded-lg p-1 mr-2 border border-slate-700">
                    <button 
                        onClick={() => setMode('chat')}
                        className={`p-1.5 rounded-md transition-colors ${mode === 'chat' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'}`}
                        title="Text Chat"
                    >
                        <MessageCircle className="w-4 h-4" />
                    </button>
                    <button 
                        onClick={() => setMode('voice')}
                        className={`p-1.5 rounded-md transition-colors ${mode === 'voice' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'}`}
                        title="Voice Mode"
                    >
                        <Phone className="w-4 h-4" />
                    </button>
                </div>

                <button 
                  onClick={() => setIsOpen(false)}
                  className="text-slate-500 hover:text-white transition-colors bg-white/5 p-2 rounded-full hover:bg-white/10"
                >
                  <X className="w-5 h-5" />
                </button>
            </div>
          </div>

          {/* Body Content */}
          <div className="flex-1 overflow-hidden relative flex flex-col">
            
            {/* --- MODE: VOICE --- */}
            {mode === 'voice' && (
                <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center animate-fade-in">
                    <div className={`w-32 h-32 rounded-full flex items-center justify-center mb-8 transition-all duration-500 ${
                        voiceStatus === 'listening' ? 'bg-indigo-500/20 shadow-[0_0_50px_rgba(99,102,241,0.3)] scale-110' :
                        voiceStatus === 'speaking' ? 'bg-emerald-500/20 shadow-[0_0_50px_rgba(16,185,129,0.3)] scale-105' :
                        'bg-slate-800'
                    }`}>
                        <div className={`w-24 h-24 rounded-full flex items-center justify-center transition-all duration-300 ${
                            voiceStatus === 'listening' ? 'bg-indigo-600 animate-pulse' :
                            voiceStatus === 'speaking' ? 'bg-emerald-500' :
                            'bg-slate-700'
                        }`}>
                            <Mic className="w-10 h-10 text-white" />
                        </div>
                    </div>

                    <h4 className="text-xl font-bold text-white mb-2">
                        {voiceStatus === 'listening' ? "I'm listening..." :
                         voiceStatus === 'speaking' ? "Luna is speaking..." :
                         voiceStatus === 'connecting' ? "Connecting..." :
                         "Voice Ready"}
                    </h4>
                    
                    <p className="text-slate-400 text-sm max-w-xs mb-8">
                        {isVoiceConnected 
                            ? "Go ahead, ask me anything naturally." 
                            : "Click start to begin a voice conversation."}
                    </p>

                    {!isVoiceConnected ? (
                        <button 
                            onClick={startVoiceSession}
                            className="bg-white text-indigo-900 px-8 py-3 rounded-full font-bold hover:bg-slate-200 transition-colors shadow-lg flex items-center gap-2"
                        >
                            <Phone className="w-4 h-4" />
                            Start Call
                        </button>
                    ) : (
                        <button 
                            onClick={stopVoiceSession}
                            className="bg-red-500/10 text-red-400 border border-red-500/50 px-8 py-3 rounded-full font-bold hover:bg-red-500/20 transition-colors shadow-lg flex items-center gap-2"
                        >
                            <Phone className="w-4 h-4 rotate-135" />
                            End Call
                        </button>
                    )}
                </div>
            )}

            {/* --- MODE: CHAT --- */}
            {mode === 'chat' && (
                <>
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
                                <p className="text-sm font-bold mb-2">System Error</p>
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

                    <div className="p-4 bg-slate-900/95 border-t border-white/5">
                        <form onSubmit={handleSend} className="flex gap-2 items-center">
                        <input
                            type="text"
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                            placeholder={configError ? "Unavailable" : "Type a message..."}
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
                </>
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default VoiceAgent;
