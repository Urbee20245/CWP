import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Mic, MicOff, X, Activity, Loader2, Sparkles, MessageSquare, Send, User, Bot } from 'lucide-react';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
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
  
  // Buffers for accumulating transcriptions
  const currentInputTranscriptRef = useRef('');
  const currentOutputTranscriptRef = useRef('');

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
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

  const updateTranscript = (role: 'user' | 'assistant', text: string, isFinal: boolean = false) => {
      setMessages(prev => {
          const lastMsg = prev[prev.length - 1];
          // If the last message is from the same role, update it
          if (lastMsg && lastMsg.role === role) {
              const updated = [...prev];
              updated[updated.length - 1] = { ...lastMsg, text: text };
              return updated;
          } else {
              // Otherwise add a new message
              return [...prev, { id: Date.now().toString(), role, text }];
          }
      });
  };

  const startSession = async () => {
    setError(null);
    setIsConnecting(true);
    // Reset messages on new session? Optional. Let's keep history for now or reset.
    if (messages.length === 0) {
        setMessages([{ id: 'intro', role: 'assistant', text: "Hi! I'm Luna. Ask me anything about our web design or AI services." }]);
    }

    try {
      const apiKey = process.env.API_KEY;
      if (!apiKey) throw new Error("API Key not found");

      const ai = new GoogleGenAI({ apiKey });
      
      inputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      outputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      const outputNode = outputAudioContextRef.current.createGain();
      outputNode.connect(outputAudioContextRef.current.destination);

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const connectPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        config: {
          responseModalities: [Modality.AUDIO],
          inputAudioTranscription: {}, // Enable user transcription
          outputAudioTranscription: {}, // Enable model transcription
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } },
          },
          systemInstruction: "You are a friendly, professional AI receptionist for 'Custom Websites Plus' in Loganville, GA. Your name is 'Luna'. You briefly answer questions about web design, SEO, and AI automation. Keep responses short and conversational. If asked about pricing, mention plans start at $299/mo. If asked to book, say you'll forward the request.",
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
            // Handle Audio Output
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

            // Handle Transcriptions
            if (message.serverContent?.outputTranscription?.text) {
                currentOutputTranscriptRef.current += message.serverContent.outputTranscription.text;
                updateTranscript('assistant', currentOutputTranscriptRef.current);
            }
            if (message.serverContent?.inputTranscription?.text) {
                currentInputTranscriptRef.current += message.serverContent.inputTranscription.text;
                updateTranscript('user', currentInputTranscriptRef.current);
            }

            // Handle Turn Completion (Reset buffers)
            if (message.serverContent?.turnComplete) {
                if (currentInputTranscriptRef.current) {
                    currentInputTranscriptRef.current = '';
                }
                if (currentOutputTranscriptRef.current) {
                    currentOutputTranscriptRef.current = '';
                }
            }

            if (message.serverContent?.interrupted) {
               nextStartTimeRef.current = 0;
               currentOutputTranscriptRef.current = ''; // Clear potentially cut-off text logic if needed
            }
          },
          onclose: () => stopSession(),
          onerror: (e) => {
            console.error(e);
            setError("Connection error.");
            stopSession();
          }
        }
      });
      sessionRef.current = connectPromise;
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to access microphone.");
      setIsConnecting(false);
    }
  };

  useEffect(() => {
    return () => stopSession();
  }, [stopSession]);

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className={`fixed bottom-8 right-8 z-40 group ${
          isOpen ? 'translate-y-24 opacity-0 pointer-events-none' : 'translate-y-0 opacity-100'
        } transition-all duration-500`}
      >
        <div className="absolute inset-0 bg-blue-500 rounded-full blur opacity-40 group-hover:opacity-60 transition-opacity animate-pulse"></div>
        <div className="relative bg-slate-900 text-white p-4 rounded-full shadow-2xl border border-slate-700 flex items-center gap-3 hover:scale-105 transition-transform">
            <div className="relative">
                <Sparkles className="w-5 h-5 text-blue-400" />
                <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500 border border-slate-900"></span>
                </span>
            </div>
            <span className="font-semibold pr-2">Chat with Luna</span>
        </div>
      </button>

      {isOpen && (
        <div className="fixed bottom-8 right-8 z-50 w-[90vw] md:w-[24rem] h-[32rem] rounded-[2rem] overflow-hidden shadow-2xl glass-dark border border-white/10 animate-fade-in-up ring-1 ring-white/10 flex flex-col">
          
          {/* Header */}
          <div className="p-5 border-b border-white/5 flex justify-between items-center bg-slate-900/50 backdrop-blur-md z-10">
            <div className="flex items-center gap-3">
                <div className="relative">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-blue-500 to-purple-600 flex items-center justify-center border border-white/10 shadow-inner">
                        <Bot className="w-6 h-6 text-white" />
                    </div>
                    <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-slate-900 rounded-full"></span>
                </div>
                <div>
                    <h3 className="text-white font-bold text-base leading-none">Luna AI</h3>
                    <span className="text-slate-400 text-xs font-medium">Available Now</span>
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

          {/* Chat Body */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
             {messages.length === 0 && !isConnecting && (
                 <div className="h-full flex flex-col items-center justify-center text-center p-6 opacity-60">
                     <div className="w-16 h-16 rounded-full bg-slate-800/50 flex items-center justify-center mb-4">
                        <Sparkles className="w-8 h-8 text-blue-400" />
                     </div>
                     <p className="text-slate-400 text-sm">Tap the microphone to start a voice conversation with Luna.</p>
                 </div>
             )}
             
             {messages.map((msg, idx) => (
                 <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                     <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                         msg.role === 'user' 
                         ? 'bg-blue-600 text-white rounded-br-none' 
                         : 'bg-slate-800 text-slate-200 border border-slate-700 rounded-bl-none'
                     }`}>
                         {msg.text}
                     </div>
                 </div>
             ))}
             
             {/* Loading / Connecting State */}
             {isConnecting && (
                 <div className="flex justify-start">
                     <div className="bg-slate-800/50 rounded-2xl px-4 py-3 border border-slate-700/50 flex items-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
                        <span className="text-xs text-slate-400">Connecting...</span>
                     </div>
                 </div>
             )}
             
             <div ref={messagesEndRef} />
          </div>

          {/* Footer Control */}
          <div className="p-4 bg-slate-900/80 backdrop-blur-md border-t border-white/5">
             <div className="flex items-center gap-3">
                 <button
                    onClick={isConnected ? stopSession : startSession}
                    className={`flex-1 py-3 rounded-xl font-bold transition-all flex items-center justify-center gap-2 ${
                        isConnected 
                        ? 'bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20' 
                        : 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:shadow-lg hover:shadow-blue-500/20 active:scale-95'
                    }`}
                 >
                    {isConnected ? (
                        <>
                            <div className="relative flex items-center justify-center w-6 h-6">
                                <span className="absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-20 animate-ping"></span>
                                <MicOff className="w-4 h-4 relative z-10" />
                            </div>
                            <span className="mr-1">End Chat</span>
                            {/* Simple Visualizer */}
                            <div className="flex items-end gap-[2px] h-4 ml-2">
                                {[1,2,3,4].map(i => (
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
                            <span>Start Voice Chat</span>
                        </>
                    )}
                 </button>
             </div>
             {error && (
                 <p className="text-red-400 text-xs text-center mt-2">{error}</p>
             )}
          </div>
        </div>
      )}
    </>
  );
};

export default VoiceAgent;