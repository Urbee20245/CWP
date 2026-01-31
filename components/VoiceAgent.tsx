"use client";

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { X, MessageSquare, Bot, Send, Sparkles, Mic, MicOff, Volume2, VolumeX, Phone, ArrowLeftRight, Gauge, Eye, AlertTriangle } from 'lucide-react';
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
  
  // Voice State
  const [isConnected, setIsConnected] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [volumeLevel, setVolumeLevel] = useState(0);
  
  // Refs for Audio & Chat
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const liveSessionRef = useRef<any>(null); // For live voice session
  const chatSessionRef = useRef<any>(null); // For text chat session
  
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isOpen, mode]);
  
  // --- TIME CONTEXT GENERATOR ---
  const getTimeContext = () => {
    const now = new Date();

    const utcTime = now.toUTCString();
    const estTime = now.toLocaleTimeString('en-US', { timeZone: 'America/New_York', hour: '2-digit', minute: '2-digit', timeZoneName: 'short' });
    const localDate = now.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

    return `CURRENT CONTEXT: The current date is ${localDate}. The current time is ${estTime}. The UTC time is ${utcTime}. Use this information for any time-sensitive responses.`;
  };
  
  // --- SYSTEM INSTRUCTION GENERATOR ---
  const getSystemInstruction = () => {
      const timeContext = getTimeContext();
      
      return {
        parts: [{
          text: `You are Luna, a professional AI receptionist for Custom Websites Plus.
          
          ${timeContext}

          COMPANY INFO:
          - Name: Custom Websites Plus (CWP)
          - Phone: (844) 213-0694
          - Email: hello@customwebsitesplus.com
          - Service Area: Walton County, Gwinnett County, and Metro Atlanta area.
          - Core Services: Custom Website Rebuilds, Local SEO Foundation, Performance Optimization, AI Voice Agents (Add-on).
          - Pricing: Website rebuilds typically range from $5,000 to $15,000.
          - Timeline: Projects are completed in a proven 4-6 week process.
          - Tools: We offer free DIY tools:
              - JetSuite: Complete AI toolkit for local business growth.
              - Jet Local Optimizer: Free technical website audit (speed, SEO, mobile).
              - JetViz: Free visual design assessment (checks for outdated design).
          
          YOUR ROLE:
          - Be helpful, concise, and professional.
          - Encourage users to book a consultation or use the free JetSuite tools.
          - Do not make up technical details.
          `
        }],
      };
  };

  // --- AUDIO UTILS ---
  const floatTo16BitPCM = (float32Array: Float32Array) => {
    const buffer = new ArrayBuffer(float32Array.length * 2);
    const dataView = new DataView(buffer);
    let offset = 0;
    for (let i = 0; i < float32Array.length; i++, offset += 2) {
      let s = Math.max(-1, Math.min(1, float32Array[i]));
      dataView.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
    }
    return buffer;
  };

  const arrayBufferToBase64 = (buffer: ArrayBuffer) => {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
  };

  // --- VOICE SESSION MANAGEMENT ---
  const connectVoiceSession = async () => {
    try {
      const apiKey = (import.meta as any).env.VITE_GEMINI_API_KEY;
      if (!apiKey) throw new Error("API Key missing");

      // 1. Setup Audio Context
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: 24000, // Gemini Output Rate
      });

      // 2. Setup Client
      const client = new GoogleGenAI({ apiKey });
      
      // 3. Connect Live Session
      const session = await client.live.connect({
        model: 'gemini-2.0-flash-exp',
        config: {
          generationConfig: {
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: {
                  voiceName: 'Aoede',
                },
              },
            },
          },
          systemInstruction: getSystemInstruction(), // Use dynamic instruction
        },
      });

      liveSessionRef.current = session;
      setIsConnected(true);

      // 4. Handle Incoming Audio (Stream)
      (async () => {
        try {
          for await (const chunk of session.receive()) {
            if (chunk.serverContent?.modelTurn?.parts?.[0]?.inlineData) {
              const b64Data = chunk.serverContent.modelTurn.parts[0].inlineData.data;
              playAudioChunk(b64Data);
            }
            if (chunk.serverContent?.turnComplete) {
              setIsSpeaking(false);
            }
          }
        } catch (e) {
          console.error("Stream error:", e);
          disconnectVoiceSession();
        }
      })();

      // 5. Setup Microphone Input
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000,
        },
      });
      mediaStreamRef.current = stream;

      if (!audioContextRef.current) return;
      const source = audioContextRef.current.createMediaStreamSource(stream);
      const processor = audioContextRef.current.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;

      processor.onaudioprocess = (e) => {
        const inputData = e.inputBuffer.getChannelData(0);
        
        // Calculate volume for visualizer
        let sum = 0;
        for(let i = 0; i < inputData.length; i += 10) {
            sum += Math.abs(inputData[i]);
        }
        setVolumeLevel(Math.min(100, Math.round(sum * 500)));

        const pcm16 = floatTo16BitPCM(inputData);
        const b64 = arrayBufferToBase64(pcm16);

        liveSessionRef.current.send({
          realtimeInput: {
            mediaChunks: [{
              mimeType: "audio/pcm",
              data: b64,
            }],
          },
        });
      };

      source.connect(processor);
      processor.connect(processorRef.current.context.destination); // Connect to destination
      
    } catch (err: any) {
      console.error("Voice Connection Failed:", err);
      setConfigError(err.message || "Connection failed");
      setIsConnected(false);
    }
  };

  const disconnectVoiceSession = () => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(t => t.stop());
      mediaStreamRef.current = null;
    }
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    liveSessionRef.current = null; // Session cleanup
    setIsConnected(false);
    setIsSpeaking(false);
    setVolumeLevel(0);
  };

  const playAudioChunk = (base64Data: string) => {
    setIsSpeaking(true);
    if (!audioContextRef.current) return;

    try {
      const binaryString = window.atob(base64Data);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const pcmData = new Int16Array(bytes.buffer);
      const floatData = new Float32Array(pcmData.length);
      for (let i = 0; i < pcmData.length; i++) {
        floatData[i] = pcmData[i] / 32768.0;
      }

      const buffer = audioContextRef.current.createBuffer(1, floatData.length, 24000);
      buffer.getChannelData(0).set(floatData);

      const source = audioContextRef.current.createBufferSource();
      source.buffer = buffer;
      source.connect(audioContextRef.current.destination);
      source.start();
      
      source.onended = () => {
          // Typically handled by stream turnComplete, but safe fallback
      };
    } catch (e) {
      console.error("Audio playback error", e);
    }
  };

  // --- CHAT MODE LOGIC ---
  const initChat = async () => {
    try {
        const apiKey = (import.meta as any).env.VITE_GEMINI_API_KEY;
        if (!apiKey) {
            setConfigError("API Key not found for chat.");
            return;
        }
        
        // Correct initialization for @google/genai SDK
        const client = new GoogleGenAI({ apiKey });
        
        // Use client.chats.create for a new chat session
        const chatSession = client.chats.create({ 
            model: 'gemini-2.5-flash', // Using 2.5-flash for chat
            history: [],
            config: {
                systemInstruction: getSystemInstruction(), // Use dynamic instruction
            }
        });
        chatSessionRef.current = chatSession;
        setConfigError(null);
    } catch (e: any) {
        console.error("Chat init error", e);
        setConfigError(e.message || "Failed to initialize AI chat.");
    }
  };

  useEffect(() => {
    if (isOpen && mode === 'chat' && !chatSessionRef.current) {
        initChat();
    }
    return () => disconnectVoiceSession();
  }, [isOpen, mode]);

  const handleTextSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!inputValue.trim() || configError) return;
    
    const text = inputValue;
    setInputValue('');
    setMessages(p => [...p, { id: Date.now().toString(), role: 'user', text }]);
    setIsTyping(true);

    try {
        if (!chatSessionRef.current) {
            await initChat();
            if (!chatSessionRef.current) throw new Error("Chat session failed to initialize.");
        }
        
        // Use the correct method to send message
        const result = await chatSessionRef.current.sendMessage({ message: text });
        
        setMessages(p => [...p, { id: Date.now().toString(), role: 'assistant', text: result.text }]);
    } catch (e) {
        setMessages(p => [...p, { id: Date.now().toString(), role: 'assistant', text: "Error connecting to AI. Please check console." }]);
    } finally {
        setIsTyping(false);
    }
  };

  return (
    <>
      {/* Floating Button */}
      <button
        onClick={() => setIsOpen(true)}
        className={`fixed bottom-8 right-8 z-40 group ${isOpen ? 'translate-y-24 opacity-0 pointer-events-none' : 'translate-y-0 opacity-100'} transition-all duration-500`}
      >
        <div className="absolute inset-0 bg-indigo-500 rounded-full blur opacity-40 group-hover:opacity-60 animate-pulse"></div>
        <div className="relative bg-slate-900 text-white p-4 rounded-full shadow-2xl border border-slate-700 flex items-center justify-center hover:scale-105 transition-transform">
            <Bot className="w-5 h-5 text-indigo-400" />
        </div>
      </button>

      {/* Main Window */}
      {isOpen && (
        <div className="fixed bottom-4 right-4 md:bottom-8 md:right-8 z-50 w-[95vw] md:w-[24rem] h-[36rem] max-h-[85vh] rounded-[2rem] overflow-hidden shadow-2xl glass-dark border border-white/10 flex flex-col font-sans bg-slate-900">
          
          {/* Header */}
          <div className="p-5 border-b border-white/5 flex justify-between items-center bg-slate-900/95 backdrop-blur-md z-10">
            <div className="flex items-center gap-3">
                <div className="relative">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-indigo-500 to-violet-600 flex items-center justify-center border border-white/10">
                        <Bot className="w-6 h-6 text-white" />
                    </div>
                    <span className={`absolute bottom-0 right-0 w-3 h-3 border-2 border-slate-900 rounded-full ${isConnected || mode === 'chat' ? 'bg-green-500' : 'bg-slate-500'}`}></span>
                </div>
                <div>
                    <h3 className="text-white font-bold text-base">Luna AI</h3>
                    <div className="flex items-center gap-1.5 mt-1">
                        <span className="text-slate-400 text-xs font-medium uppercase tracking-wide">
                            {mode === 'voice' ? (isConnected ? 'Live Audio' : 'Voice Ready') : 'Text Chat'}
                        </span>
                    </div>
                </div>
            </div>
            <div className="flex bg-slate-800 rounded-lg p-1 mr-2 border border-slate-700">
                <button onClick={() => setMode('chat')} className={`p-1.5 rounded-md ${mode === 'chat' ? 'bg-indigo-600 text-white' : 'text-slate-400'}`}><MessageSquare className="w-4 h-4" /></button>
                <button onClick={() => setMode('voice')} className={`p-1.5 rounded-md ${mode === 'voice' ? 'bg-indigo-600 text-white' : 'text-slate-400'}`}><Phone className="w-4 h-4" /></button>
            </div>
            <button onClick={() => setIsOpen(false)} className="text-slate-500 hover:text-white"><X className="w-5 h-5" /></button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-hidden relative flex flex-col bg-slate-900">
            
            {/* VOICE INTERFACE */}
            {mode === 'voice' && (
                <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center">
                    {configError ? (
                        <div className="text-red-400 bg-red-900/20 p-4 rounded-xl border border-red-500/20 mb-6">
                            <p className="font-bold mb-1">Connection Error</p>
                            <p className="text-xs">{configError}</p>
                        </div>
                    ) : (
                        <div className={`relative w-40 h-40 rounded-full flex items-center justify-center mb-8 transition-all duration-300 ${isConnected ? 'bg-indigo-500/10' : 'bg-slate-800'}`}>
                            {isConnected && (
                                <>
                                    <div className="absolute inset-0 rounded-full border border-indigo-500/30 animate-ping opacity-20"></div>
                                    {/* Visualizer Rings */}
                                    <div className="absolute inset-0 rounded-full border border-indigo-400/50 transition-all duration-75" style={{ transform: `scale(${1 + (volumeLevel/200)})` }}></div>
                                </>
                            )}
                            <div className={`w-24 h-24 rounded-full flex items-center justify-center transition-all ${isConnected ? 'bg-indigo-600 shadow-[0_0_30px_rgba(99,102,241,0.5)]' : 'bg-slate-700'}`}>
                                {isSpeaking ? <Volume2 className="w-10 h-10 text-white animate-pulse" /> : <Mic className="w-10 h-10 text-white" />}
                            </div>
                        </div>
                    )}

                    <h2 className="text-2xl font-bold text-white mb-2">
                        {isConnected ? (isSpeaking ? "Luna is speaking..." : "Listening...") : "Voice Mode"}
                    </h2>
                    <p className="text-slate-400 text-sm max-w-xs mx-auto mb-10">
                        {isConnected 
                            ? "Go ahead, speak naturally. I'm listening." 
                            : "Start a real-time voice call with Luna using Gemini Live."}
                    </p>

                    {!isConnected ? (
                        <button 
                            onClick={connectVoiceSession}
                            className="bg-white text-indigo-900 px-8 py-4 rounded-full font-bold hover:bg-indigo-50 transition-all shadow-lg hover:scale-105 flex items-center gap-2"
                        >
                            <Phone className="w-5 h-5" />
                            Start Call
                        </button>
                    ) : (
                        <button 
                            onClick={disconnectVoiceSession}
                            className="bg-red-500/10 text-red-400 border border-red-500/50 px-8 py-4 rounded-full font-bold hover:bg-red-500/20 transition-all flex items-center gap-2"
                        >
                            <Phone className="w-5 h-5 rotate-135" />
                            End Call
                        </button>
                    )}
                </div>
            )}

            {/* CHAT INTERFACE */}
            {mode === 'chat' && (
                <>
                    <div className="flex-1 overflow-y-auto p-4 space-y-4">
                        {messages.length === 0 && (
                            <div className="h-full flex flex-col items-center justify-center opacity-50">
                                <Sparkles className="w-12 h-12 text-indigo-400 mb-4" />
                                <p className="text-slate-400 text-sm">How can I help you today?</p>
                            </div>
                        )}
                        {messages.map(m => (
                            <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                <div className={`max-w-[85%] px-4 py-3 rounded-2xl text-sm ${m.role === 'user' ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-200'}`}>
                                    {m.text}
                                </div>
                            </div>
                        ))}
                        {isTyping && <div className="text-slate-500 text-xs px-4">Luna is typing...</div>}
                        <div ref={messagesEndRef} />
                    </div>
                    <div className="p-4 bg-slate-900/95 border-t border-white/5">
                        {configError ? (
                            <div className="p-3 bg-red-900/20 text-red-400 rounded-lg text-sm flex items-center gap-2">
                                <AlertTriangle className="w-4 h-4" />
                                {configError}
                            </div>
                        ) : (
                            <form onSubmit={handleTextSend} className="flex gap-2">
                                <input 
                                    value={inputValue} 
                                    onChange={e => setInputValue(e.target.value)}
                                    placeholder="Type a message..."
                                    className="flex-1 bg-slate-800 border border-slate-700 text-white rounded-xl px-4 py-3 focus:border-indigo-500 outline-none"
                                />
                                <button type="submit" className="bg-indigo-600 text-white p-3 rounded-xl hover:bg-indigo-500"><Send className="w-5 h-5" /></button>
                            </form>
                        )}
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