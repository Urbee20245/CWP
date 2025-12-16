import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Mic, MicOff, X, Activity, Loader2, Sparkles, MessageSquare, User, Bot, Smartphone } from 'lucide-react';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  isFinal?: boolean;
}

function resampleTo16kHZ(audioData: Float32Array, origSampleRate: number): Float32Array {
  const targetSampleRate = 16000;
  if (origSampleRate === targetSampleRate) return audioData;

  const ratio = origSampleRate / targetSampleRate;
  const newLength = Math.round(audioData.length / ratio);
  const result = new Float32Array(newLength);
  
  for (let i = 0; i < newLength; i++) {
    const originalIndex = i * ratio;
    const index1 = Math.floor(originalIndex);
    const index2 = Math.min(Math.ceil(originalIndex), audioData.length - 1);
    const t = originalIndex - index1;
    /* Linear interpolation */
    const v1 = audioData[index1];
    const v2 = audioData[index2];
    result[i] = v1 * (1 - t) + v2 * t;
  }
  return result;
}

function createBlob(data: Float32Array): { data: string; mimeType: string } {
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
  return {
    data: btoa(binary),
    mimeType: 'audio/pcm;rate=16000',
  };
}

function decodeAudio(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number = 24000,
  numChannels: number = 1
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);
  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

const VoiceAgent: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [volume, setVolume] = useState(0);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const sessionRef = useRef<any>(null);
  
  // Buffers for accumulating transcriptions during a turn
  const currentInputTranscriptRef = useRef('');
  const currentOutputTranscriptRef = useRef('');

  const scrollToBottom = () => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isOpen]);

  const stopSession = useCallback(() => {
    if (sessionRef.current) sessionRef.current = null;
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
    if (inputAudioContextRef.current) {
      inputAudioContextRef.current.close();
      inputAudioContextRef.current = null;
    }
    if (outputAudioContextRef.current) {
      outputAudioContextRef.current.close();
      outputAudioContextRef.current = null;
    }
    setIsConnected(false);
    setIsConnecting(false);
    setVolume(0);
    currentInputTranscriptRef.current = '';
    currentOutputTranscriptRef.current = '';
  }, []);

  // Helper to update the last message or add a new one if role switched
  const updateTranscriptState = (role: 'user' | 'assistant', textDelta: string) => {
      setMessages(prev => {
          const newMsgs = [...prev];
          const lastMsg = newMsgs[newMsgs.length - 1];
          
          // If the last message is from the same role and not "finalized" (logic simplified here), append
          // Note: The API sends chunks. We append to the current turn.
          if (lastMsg && lastMsg.role === role && !lastMsg.isFinal) {
              const updatedMsg = { ...lastMsg, text: lastMsg.text + textDelta };
              newMsgs[newMsgs.length - 1] = updatedMsg;
              return newMsgs;
          } else {
              // New turn
              return [...prev, { id: Date.now().toString(), role, text: textDelta }];
          }
      });
  };

  const markTurnComplete = () => {
      setMessages(prev => {
          if (prev.length === 0) return prev;
          const newMsgs = [...prev];
          const lastMsg = newMsgs[newMsgs.length - 1];
          newMsgs[newMsgs.length - 1] = { ...lastMsg, isFinal: true };
          return newMsgs;
      });
      currentInputTranscriptRef.current = '';
      currentOutputTranscriptRef.current = '';
  };

  const startSession = async () => {
    setError(null);
    setIsConnecting(true);
    
    // Initial Greeting in Chat
    if (messages.length === 0) {
        setMessages([{ 
            id: 'intro', 
            role: 'assistant', 
            text: "Hi! I'm Luna. I can help with web design questions, pricing, or booking a consultation. How can I help you today?",
            isFinal: true
        }]);
    }

    try {
      // Check microphone permission first
      console.log('🎤 Checking microphone permission...');
      
      const apiKey = process.env.API_KEY;
      
      // Debug logging
      console.log('🔑 API Key check:', apiKey ? 'Present ✅' : 'Missing ❌');
      console.log('🔍 Environment variables available:', Object.keys(process.env || {}).filter(key => key.includes('API') || key.includes('GEMINI')));
      
      if (!apiKey) {
        const errorMsg = "Luna AI is not configured yet. The API key is missing. Please contact support.";
        console.error('❌', errorMsg);
        throw new Error(errorMsg);
      }

      console.log('✅ API Key present, initializing AI...');
      const ai = new GoogleGenAI({ apiKey });
      
      console.log('🎧 Creating audio contexts...');
      inputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      outputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      const outputNode = outputAudioContextRef.current.createGain();
      outputNode.connect(outputAudioContextRef.current.destination);

      console.log('🎤 Requesting microphone access...');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      console.log('✅ Microphone access granted');
      streamRef.current = stream;

      const connectPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        config: {
          responseModalities: [Modality.AUDIO],
          inputAudioTranscription: { model: 'google_default' }, // Enable user speech-to-text
          outputAudioTranscription: { model: 'google_default' }, // Enable model speech-to-text
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } },
          },
          systemInstruction: `You are Luna, a professional and knowledgeable AI receptionist for Custom Websites Plus.

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
- Keep responses concise (2-3 sentences for voice)
- Always offer free analysis tools as no-pressure next step
- For pricing: Explain custom nature, give general range if pressed ($5k-$15k), suggest consultation
- For objections: Address concern, relate to expertise, offer free analysis or consultation
- Goal: Qualify leads and schedule consultations

KEY PHRASES:
- "Have you tried our free website analysis tools?"
- "Let me help you schedule a consultation"
- "Every project is unique, so we provide custom quotes"

OBJECTION HANDLING:
Cost: "Our rebuilds typically range from $5,000-$15,000 depending on complexity. I recommend scheduling a free consultation for an accurate quote."
Time: "Most rebuilds take 4-6 weeks. Urgent projects can sometimes be accommodated."
SEO: "Our rebuilds typically improve rankings. We handle migration carefully with proper redirects."
Updates: "Absolutely! We provide training and you'll have full control."
Already have site: "Try our free analysis tools at /jetsuite to see how your current site performs."`,
        },
        callbacks: {
          onopen: () => {
            setIsConnected(true);
            setIsConnecting(false);
            if (!inputAudioContextRef.current || !streamRef.current) return;
            
            const source = inputAudioContextRef.current.createMediaStreamSource(streamRef.current);
            sourceRef.current = source;
            const scriptProcessor = inputAudioContextRef.current.createScriptProcessor(4096, 1, 1);
            processorRef.current = scriptProcessor;

            scriptProcessor.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0);
              // Simple volume meter logic
              let sum = 0;
              for(let i=0; i<inputData.length; i+=100) sum += Math.abs(inputData[i]);
              setVolume(Math.min(100, (sum / (inputData.length/100)) * 500));

              const resampledData = resampleTo16kHZ(inputData, inputAudioContextRef.current!.sampleRate);
              const pcmBlob = createBlob(resampledData);
              
              connectPromise.then((session) => {
                 session.sendRealtimeInput({ media: pcmBlob });
              });
            };

            source.connect(scriptProcessor);
            scriptProcessor.connect(inputAudioContextRef.current.destination);
          },
          onmessage: async (message: LiveServerMessage) => {
            // 1. Handle Audio Output
            const base64Audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (base64Audio && outputAudioContextRef.current) {
              const ctx = outputAudioContextRef.current;
              nextStartTimeRef.current = Math.max(nextStartTimeRef.current, ctx.currentTime);
              const audioBytes = decodeAudio(base64Audio);
              const audioBuffer = await decodeAudioData(audioBytes, ctx, 24000, 1);
              const source = ctx.createBufferSource();
              source.buffer = audioBuffer;
              source.connect(ctx.destination);
              source.start(nextStartTimeRef.current);
              nextStartTimeRef.current += audioBuffer.duration;
            }

            // 2. Handle Transcription (Chat UI)
            const inputTrans = message.serverContent?.inputTranscription?.text;
            const outputTrans = message.serverContent?.outputTranscription?.text;

            if (inputTrans) {
                updateTranscriptState('user', inputTrans);
            }
            if (outputTrans) {
                updateTranscriptState('assistant', outputTrans);
            }

            // 3. Handle Turn Completion
            if (message.serverContent?.turnComplete) {
                markTurnComplete();
            }

            // 4. Handle Interruption
            if (message.serverContent?.interrupted) {
               nextStartTimeRef.current = 0;
               markTurnComplete(); 
            }
          },
          onclose: () => stopSession(),
          onerror: (e) => {
            console.error(e);
            setError("Connection disrupted. Please try again.");
            stopSession();
          }
        }
      });
      sessionRef.current = connectPromise;
      console.log('✅ Luna AI session started successfully!');
    } catch (err: any) {
      console.error('❌ Luna AI Error:', err);
      
      let userFriendlyError = "Unable to start conversation. ";
      
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        userFriendlyError = "Microphone access denied. Please allow microphone access in your browser settings and try again.";
      } else if (err.name === 'NotFoundError') {
        userFriendlyError = "No microphone found. Please connect a microphone and try again.";
      } else if (err.message.includes('API Key')) {
        userFriendlyError = "Luna AI is not configured yet. Please contact support at (404) 532-9266.";
      } else if (err.message.includes('fetch') || err.message.includes('network')) {
        userFriendlyError = "Network error. Please check your connection and try again.";
      } else {
        userFriendlyError = err.message || "An error occurred. Please try again or contact support.";
      }
      
      setError(userFriendlyError);
      setIsConnecting(false);
      stopSession();
    }
  };

  useEffect(() => {
    return () => stopSession();
  }, [stopSession]);

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
            <div className="relative">
                <Sparkles className="w-5 h-5 text-indigo-400" />
                {/* Available Status Dot */}
                <span className="absolute -top-1 -right-1 flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500 border-2 border-slate-900"></span>
                </span>
            </div>
            <span className="font-semibold pr-2 font-sans">Chat with Luna</span>
        </div>
      </button>

      {/* Chat Window */}
      {isOpen && (
        <div className="fixed bottom-4 right-4 md:bottom-8 md:right-8 z-50 w-[95vw] md:w-[24rem] h-[36rem] max-h-[85vh] rounded-[2rem] overflow-hidden shadow-2xl glass-dark border border-white/10 animate-fade-in-up ring-1 ring-white/10 flex flex-col font-sans">
          
          {/* Header */}
          <div className="p-5 border-b border-white/5 flex justify-between items-center bg-slate-900/50 backdrop-blur-md z-10 shrink-0">
            <div className="flex items-center gap-3">
                <div className="relative">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-indigo-500 to-violet-600 flex items-center justify-center border border-white/10 shadow-inner">
                        <Bot className="w-6 h-6 text-white" />
                    </div>
                    {/* Header Available Status */}
                    <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-slate-900 rounded-full shadow-[0_0_8px_rgba(34,197,94,0.6)]"></span>
                </div>
                <div>
                    <h3 className="text-white font-bold text-base leading-none">Luna AI</h3>
                    <div className="flex items-center gap-1.5 mt-1">
                        <span className="block w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
                        <span className="text-slate-400 text-xs font-medium uppercase tracking-wide">Online Now</span>
                    </div>
                </div>
            </div>
            <button 
              onClick={() => {
                stopSession();
                setIsOpen(false);
              }}
              className="text-slate-500 hover:text-white transition-colors bg-white/5 p-2 rounded-full hover:bg-white/10"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Chat Messages Body */}
          <div className="flex-1 overflow-y-auto p-4 space-y-6 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
             {messages.length === 0 && !isConnecting && !error && (
                 <div className="h-full flex flex-col items-center justify-center text-center p-6 opacity-60">
                     <div className="w-16 h-16 rounded-full bg-slate-800/50 flex items-center justify-center mb-4 border border-slate-700">
                        <Sparkles className="w-8 h-8 text-indigo-400" />
                     </div>
                     <p className="text-slate-400 text-sm">Tap the microphone below to start a voice conversation.</p>
                 </div>
             )}
             
             {error && messages.length === 0 && (
                 <div className="h-full flex flex-col items-center justify-center text-center p-6">
                     <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mb-4 border border-red-500/20">
                        <span className="text-3xl">⚠️</span>
                     </div>
                     <p className="text-slate-300 text-sm font-semibold mb-2">Unable to Connect</p>
                     <p className="text-slate-400 text-xs mb-4">Try refreshing or use one of these options:</p>
                     <div className="flex flex-col gap-2 w-full">
                        <a 
                          href="tel:4045329266" 
                          className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-500 transition-all flex items-center justify-center gap-2"
                        >
                          <Phone className="w-4 h-4" />
                          Call Us: (404) 532-9266
                        </a>
                        <a 
                          href="#/contact" 
                          onClick={() => setIsOpen(false)}
                          className="px-4 py-2 bg-slate-700 text-white rounded-lg text-sm font-semibold hover:bg-slate-600 transition-all flex items-center justify-center gap-2"
                        >
                          <MessageSquare className="w-4 h-4" />
                          Contact Form
                        </a>
                     </div>
                 </div>
             )}
             
             {messages.map((msg, idx) => (
                 <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-fade-in`}>
                     <div className={`flex flex-col gap-1 max-w-[85%]`}>
                        <div className={`flex items-center gap-2 text-xs text-slate-500 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'} px-1`}>
                            {msg.role === 'user' ? 'You' : 'Luna'}
                        </div>
                        <div className={`px-4 py-3 text-sm leading-relaxed shadow-sm ${
                            msg.role === 'user' 
                            ? 'bg-indigo-600 text-white rounded-2xl rounded-tr-sm' 
                            : 'bg-slate-800 text-slate-200 border border-slate-700 rounded-2xl rounded-tl-sm'
                        }`}>
                            {msg.text}
                            {/* Typing cursor effect for assistant if it's the last message and streaming? */}
                            {/* We can add a simple blinking cursor logic if needed, but simple text update is usually fine */}
                        </div>
                     </div>
                 </div>
             ))}
             
             {/* Loading / Connecting State */}
             {isConnecting && (
                 <div className="flex justify-start">
                     <div className="bg-slate-800/50 rounded-2xl px-4 py-3 border border-slate-700/50 flex items-center gap-3">
                        <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
                        <span className="text-xs text-slate-400 font-medium">Connecting to secure line...</span>
                     </div>
                 </div>
             )}
             
             <div ref={messagesEndRef} className="h-4" />
          </div>

          {/* Footer Controls */}
          <div className="p-4 bg-slate-900/80 backdrop-blur-md border-t border-white/5 shrink-0">
             <div className="flex flex-col gap-3">
                 {error && (
                     <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-xl text-sm">
                        <div className="font-bold mb-1 flex items-center gap-2">
                          <span className="text-red-500">⚠️</span> Connection Error
                        </div>
                        <div className="text-xs leading-relaxed">{error}</div>
                        {error.includes('contact support') && (
                          <a 
                            href="tel:4045329266" 
                            className="mt-2 text-xs text-blue-400 hover:text-blue-300 underline block"
                          >
                            Call us: (404) 532-9266
                          </a>
                        )}
                     </div>
                 )}
                 
                 <button
                    onClick={isConnected ? stopSession : startSession}
                    className={`w-full py-4 rounded-xl font-bold transition-all flex items-center justify-center gap-2 shadow-lg ${
                        isConnected 
                        ? 'bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20' 
                        : 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white hover:shadow-indigo-500/25 active:scale-95'
                    }`}
                 >
                    {isConnected ? (
                        <>
                            <div className="relative flex items-center justify-center w-6 h-6">
                                <span className="absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-20 animate-ping"></span>
                                <MicOff className="w-5 h-5 relative z-10" />
                            </div>
                            <span className="mr-1">End Voice Chat</span>
                            {/* Audio Visualizer */}
                            <div className="flex items-center gap-[3px] h-4 ml-2">
                                {[1,2,3,4,5].map(i => (
                                    <div 
                                        key={i} 
                                        className="w-1 bg-current rounded-full transition-all duration-75"
                                        style={{ height: `${Math.max(20, Math.random() * volume)}%` }}
                                    ></div>
                                ))}
                            </div>
                        </>
                    ) : (
                        <>
                            <Mic className="w-5 h-5" />
                            <span>Start Conversation</span>
                        </>
                    )}
                 </button>
             </div>
          </div>
        </div>
      )}
    </>
  );
};

export default VoiceAgent;