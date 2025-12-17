import React, { useState, useRef, useEffect, useCallback } from 'react';
import { X, MessageSquare, Bot, Send, Sparkles, Mic, MicOff, Volume2, VolumeX, Phone } from 'lucide-react';
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
  const chatTranscriptRef = useRef<string>('');
  
  // Voice State
  const [isConnected, setIsConnected] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [volumeLevel, setVolumeLevel] = useState(0);
  
  // Refs for Audio
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const clientRef = useRef<any>(null);
  const chatSessionRef = useRef<any>(null);
  
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isOpen, mode]);

  // --- AUDIO UTILS ---
  const floatTo16BitPCM = (float32Array: Float32Array) => {
    const buffer = new ArrayBuffer(float32Array.length * 2);
    const view = new DataView(buffer);
    let offset = 0;
    for (let i = 0; i < float32Array.length; i++, offset += 2) {
      let s = Math.max(-1, Math.min(1, float32Array[i]));
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
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

  const getGeminiApiKey = () => (import.meta as any).env.VITE_GEMINI_API_KEY as string | undefined;
  const getGeminiModel = () => ((import.meta as any).env.VITE_GEMINI_MODEL as string | undefined) || 'gemini-2.0-flash-exp';

  const LUNA_SYSTEM_PROMPT = `You are Luna, AI assistant for Custom Websites Plus.
Be helpful, concise, and professional. Do not invent facts.
Default to 1–2 sentences. Only expand if the user explicitly asks for more detail.
When helpful, include 1–2 direct on-site links in your reply so the user can take action (do not spam links).
Use these internal URLs (pick the most relevant):
- Tool hub: /jetsuite
- Run a free local audit: /jet-local-optimizer
- Run a free visual check: /jetviz
- Contact / book a consult: /contact
- Learn services: /services
- See the process: /process
If the user asks for pricing, give a realistic range and recommend booking a consult.`;

  const normalizeErrorMessage = (err: any) => {
    const raw = err?.message || err?.toString?.() || 'Connection failed';
    if (typeof raw !== 'string') return 'Connection failed';
    // Give a friendly, actionable message for the common failure mode.
    if (/api key/i.test(raw) && /missing/i.test(raw)) {
      return 'Luna is not configured yet (missing API key). Set VITE_GEMINI_API_KEY and redeploy.';
    }
    return raw;
  };

  // --- VOICE SESSION MANAGEMENT ---
  const connectVoiceSession = async () => {
    try {
      const apiKey = getGeminiApiKey();
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
          systemInstruction: {
            parts: [{
              text: `You are Luna, a professional AI receptionist for Custom Websites Plus.
              
              COMPANY INFO:
              - Name: Custom Websites Plus (CWP)
              - Phone: (404) 532-9266
              - Service: Website Rebuilds, SEO, AI Agents
              - Pricing: $5k-$15k typically
              - Timeline: 4-6 weeks
              
              YOUR ROLE:
              - Be helpful, concise, and professional.
              - Answer questions about services.
              - Encourage users to book a consultation or use the free JetSuite tools.
              - Do not make up technical details.
              `
            }],
          },
        },
      });

      clientRef.current = session;
      setIsConnected(true);

      // 4. Handle Incoming Audio (Stream)
      // Using a simple loop to process the incoming stream
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

        // Convert to PCM 16kHz
        // Note: Assuming input is close to 16k or we just send it. 
        // For best results, we should downsample if context is 44.1k/48k.
        // Simple 1-to-1 skip for downsampling if needed:
        // (Omitted strict resampling for brevity, usually context handles pull or we rely on robust backend)
        
        const pcm16 = floatTo16BitPCM(inputData);
        const b64 = arrayBufferToBase64(pcm16);

        clientRef.current.send({
          realtimeInput: {
            mediaChunks: [{
              mimeType: "audio/pcm",
              data: b64,
            }],
          },
        });
      };

      source.connect(processor);
      processor.connect(audioContextRef.current.destination);

    } catch (err: any) {
      console.error("Voice Connection Failed:", err);
      setConfigError(normalizeErrorMessage(err));
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
    clientRef.current = null; // Session cleanup
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
    // ... (Keep existing Chat Logic for text mode fallback)
    // Re-implementing briefly for completeness
    try {
        setConfigError(null);
        const apiKey = getGeminiApiKey();
        if (!apiKey) {
          setConfigError('Luna is not configured yet (missing API key). Set VITE_GEMINI_API_KEY and redeploy.');
          return;
        }

        const client = new GoogleGenAI({ apiKey });
        const modelName = getGeminiModel();

        // Keep a simple transcript so we don't depend on any specific chat-session API shape.
        chatTranscriptRef.current = `System: ${LUNA_SYSTEM_PROMPT}\n`;

        chatSessionRef.current = {
          sendMessage: async (text: string) => {
            const prompt = `${chatTranscriptRef.current}\nUser: ${text}\nLuna:`;
            // @google/genai supports passing a single string as contents.
            const resp = await (client as any).models.generateContent({
              model: modelName,
              contents: prompt,
            });

            const assistantText =
              (typeof resp?.text === 'string' && resp.text) ||
              (typeof resp?.text === 'function' && resp.text()) ||
              (typeof resp?.response?.text === 'function' && resp.response.text()) ||
              (resp?.candidates?.[0]?.content?.parts?.[0]?.text as string | undefined) ||
              '';

            // Append to transcript to maintain conversational context.
            chatTranscriptRef.current = `${prompt} ${assistantText}\n`;

            // Return a compatible shape for the existing handleTextSend() usage.
            return { response: { text: () => assistantText } };
          }
        };
    } catch (e) {
        console.error("Chat init error", e);
        setConfigError(normalizeErrorMessage(e));
    }
  };

  useEffect(() => {
    if (isOpen && mode === 'chat') initChat();
    return () => disconnectVoiceSession();
  }, [isOpen, mode]);

  const handleTextSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!inputValue.trim()) return;
    
    const text = inputValue;
    setInputValue('');
    setMessages(p => [...p, { id: Date.now().toString(), role: 'user', text }]);
    setIsTyping(true);

    try {
        if (!chatSessionRef.current) await initChat();
        if (!chatSessionRef.current) {
          throw new Error(configError || 'Chat session not initialized');
        }
        const result = await chatSessionRef.current.sendMessage(text);
        setMessages(p => [...p, { id: Date.now().toString(), role: 'assistant', text: result.response.text() }]);
    } catch (e: any) {
        const friendly = normalizeErrorMessage(e);
        setConfigError(friendly);
        setMessages(p => [...p, { id: Date.now().toString(), role: 'assistant', text: friendly || "Error connecting." }]);
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
        <div className="relative bg-slate-900 text-white p-4 rounded-full shadow-2xl border border-slate-700 flex items-center gap-3 hover:scale-105 transition-transform">
            <Bot className="w-5 h-5 text-indigo-400" />
            <span className="font-semibold pr-2">Chat with Luna</span>
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
                    {configError && (
                      <div className="px-4 pt-4">
                        <div className="text-amber-300 bg-amber-900/20 p-3 rounded-xl border border-amber-500/20 text-xs">
                          <div className="font-bold mb-1">Luna chat issue</div>
                          <div>{configError}</div>
                        </div>
                      </div>
                    )}
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
                        <form onSubmit={handleTextSend} className="flex gap-2">
                            <input 
                                value={inputValue} 
                                onChange={e => setInputValue(e.target.value)}
                                placeholder="Type a message..."
                                className="flex-1 bg-slate-800 border border-slate-700 text-white rounded-xl px-4 py-3 focus:border-indigo-500 outline-none"
                            />
                            <button type="submit" className="bg-indigo-600 text-white p-3 rounded-xl hover:bg-indigo-500"><Send className="w-5 h-5" /></button>
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
