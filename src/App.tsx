import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Mic, MicOff, Power, Globe, Sparkles } from 'lucide-react';
import { AudioRecorder, AudioStreamer } from './lib/audio';

type Status = 'disconnected' | 'connecting' | 'connected' | 'speaking' | 'listening';

export default function App() {
  const [status, setStatus] = useState<Status>('disconnected');
  const [error, setError] = useState<string | null>(null);
  
  const wsRef = useRef<WebSocket | null>(null);
  const recorderRef = useRef<AudioRecorder | null>(null);
  const streamerRef = useRef<AudioStreamer | null>(null);
  
  const speakingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const connect = useCallback(async () => {
    try {
      setStatus('connecting');
      setError(null);

      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const ws = new WebSocket(`${protocol}//${window.location.host}/live`);
      wsRef.current = ws;

      const streamer = new AudioStreamer();
      streamer.start();
      streamerRef.current = streamer;

      const recorder = new AudioRecorder((base64) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ audio: base64 }));
        }
      });
      recorderRef.current = recorder;

      ws.onopen = () => {
        setStatus('connected');
        recorder.start().catch(err => {
          console.error("Mic access failed:", err);
          setError("Microphone access denied. Sassy personality needs a mic, babe!");
          disconnect();
        });
      };

      ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);

        // Handle audio data
        if (msg.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data) {
          streamer.playChunk(msg.serverContent.modelTurn.parts[0].inlineData.data);
          setStatus('speaking');
          
          if (speakingTimeoutRef.current) clearTimeout(speakingTimeoutRef.current);
          speakingTimeoutRef.current = setTimeout(() => {
            if (!streamer.isPlaying) {
              setStatus('connected');
            }
          }, 500);
        }

        // Handle interruptions
        if (msg.serverContent?.interrupted) {
          streamer.clearQueue();
          setStatus('connected');
        }

        // Handle tool calls
        if (msg.toolCall?.functionCalls) {
          for (const call of msg.toolCall.functionCalls) {
            if (call.name === 'openWebsite') {
              window.open(call.args.url, '_blank');
              ws.send(JSON.stringify({
                functionResponse: {
                  responses: [{
                    id: call.id,
                    response: { result: "Website opened successfully" }
                  }]
                }
              }));
            }
          }
        }
        
        // Handle audio transcription (optional but helps status)
        if (msg.serverContent?.modelTurn?.parts?.[0]?.text) {
          // We could show text, but prompt says "Audio-to-Audio ONLY (STRICT)"
          // So we won't show it, but we know she's talking.
        }
      };

      ws.onclose = () => {
        disconnect();
      };

      ws.onerror = (e) => {
        console.error("WS Error:", e);
        setError("Connection failed. Maybe I'm too hot for the server?");
        disconnect();
      };

    } catch (err) {
      console.error(err);
      setError("Failed to start session.");
      setStatus('disconnected');
    }
  }, []);

  const disconnect = useCallback(() => {
    wsRef.current?.close();
    wsRef.current = null;
    recorderRef.current?.stop();
    recorderRef.current = null;
    streamerRef.current?.stop();
    streamerRef.current = null;
    setStatus('disconnected');
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      if (status === 'speaking' && streamerRef.current && !streamerRef.current.isPlaying) {
        setStatus('connected');
      }
    }, 200);
    return () => clearInterval(interval);
  }, [status]);

  return (
    <div id="app-container" className="fixed inset-0 bg-[#050505] text-white font-sans overflow-hidden flex flex-col items-center justify-center p-6 select-none">
      {/* Background Ambience */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[150%] h-[150%] bg-[radial-gradient(circle_at_center,rgba(255,99,33,0.05)_0%,transparent_70%)] opacity-50" />
      </div>

      {/* Header */}
      <motion.div 
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="absolute top-12 flex flex-col items-center gap-1"
      >
        <h1 className="text-3xl font-light tracking-[0.2em] font-display uppercase flex items-center gap-2">
          Dipika <Sparkles className="w-5 h-5 text-orange-500 fill-orange-500/20" />
        </h1>
        <p className="text-[10px] uppercase tracking-[0.4em] opacity-40 font-mono">Multimodal Live Session</p>
      </motion.div>

      {/* Main Interaction Area */}
      <div className="relative flex items-center justify-center w-full max-w-md aspect-square">
        {/* Status Rings */}
        <AnimatePresence>
          {status !== 'disconnected' && (
            <>
              {/* Pulsing Outer Ring */}
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ 
                  scale: status === 'speaking' ? [1.1, 1.3, 1.1] : 1.1,
                  opacity: status === 'speaking' ? 0.3 : 0.1,
                }}
                exit={{ scale: 0.8, opacity: 0 }}
                transition={{ repeat: Infinity, duration: 2 }}
                className="absolute inset-0 border border-orange-500 rounded-full"
              />
          {/* Dynamic Ripple for Speaking */}
          {status === 'speaking' && (
            <>
              <motion.div
                initial={{ scale: 1, opacity: 0.5 }}
                animate={{ scale: 2, opacity: 0 }}
                transition={{ repeat: Infinity, duration: 1.5 }}
                className="absolute inset-0 border-2 border-orange-500 rounded-full"
              />
              {/* Waveform visualizer */}
              <div className="absolute inset-0 flex items-center justify-center gap-1">
                {[...Array(5)].map((_, i) => (
                  <motion.div
                    key={i}
                    animate={{ 
                      height: [20, 40, 20],
                      opacity: [0.3, 1, 0.3]
                    }}
                    transition={{ 
                      repeat: Infinity, 
                      duration: 0.6, 
                      delay: i * 0.1 
                    }}
                    className="w-1 bg-orange-500 rounded-full"
                  />
                ))}
              </div>
            </>
          )}
            </>
          )}
        </AnimatePresence>

        {/* Central Button */}
        <motion.button
          id="toggle-btn"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={status === 'disconnected' ? connect : disconnect}
          className={`relative z-10 w-48 h-48 rounded-full flex items-center justify-center transition-colors duration-500 ${
            status === 'disconnected' ? 'bg-zinc-900 border-zinc-800' : 'bg-orange-600 border-orange-400'
          } border-2 shadow-[0_0_50px_rgba(0,0,0,0.5)] group`}
        >
          {status === 'disconnected' ? (
            <Power className="w-16 h-16 text-zinc-600 group-hover:text-white transition-colors" />
          ) : (
            <motion.div
              animate={status === 'speaking' || status === 'listening' ? {
                scale: [1, 1.1, 1],
              } : {}}
              transition={{ repeat: Infinity, duration: 2 }}
            >
              <Mic className="w-16 h-16 text-white" />
            </motion.div>
          )}
          
          {/* Internal Glow */}
          <div className={`absolute inset-0 rounded-full blur-2xl opacity-20 transition-colors duration-500 ${
            status === 'disconnected' ? 'bg-transparent' : 'bg-orange-500'
          }`} />
        </motion.button>

        {/* Status Text Labels */}
        <div className="absolute -bottom-16 w-full text-center">
          <AnimatePresence mode="wait">
            <motion.p
              key={status}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="font-mono text-[11px] uppercase tracking-[0.3em] font-medium"
            >
              {status === 'disconnected' && "Tap to wake me up, darling"}
              {status === 'connecting' && "Connecting to my brain..."}
              {status === 'connected' && "I'm listening, don't be shy"}
              {status === 'speaking' && "Hang on, I'm talking..."}
            </motion.p>
          </AnimatePresence>
        </div>
      </div>

      {/* Error Message */}
      <AnimatePresence>
        {error && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="absolute bottom-24 bg-red-500/10 border border-red-500/50 px-6 py-3 rounded-full text-red-500 text-xs font-medium backdrop-blur-md"
          >
            {error}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom Features / Decorative */}
      <div className="absolute bottom-12 flex gap-12">
        <div className="flex flex-col items-center gap-2 opacity-30">
          <Globe className="w-5 h-5" />
          <span className="text-[7px] uppercase tracking-widest">Global Web Access</span>
        </div>
        <div className="flex flex-col items-center gap-2 opacity-30">
          <MicOff className="w-5 h-5" />
          <span className="text-[7px] uppercase tracking-widest">Low Latency PCM</span>
        </div>
      </div>

      {/* Style Overrides for display font */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&family=JetBrains+Mono:wght@300;400;500&display=swap');
        
        body {
          font-family: 'Space Grotesk', sans-serif;
        }
        
        .font-mono {
          font-family: 'JetBrains Mono', monospace;
        }
      `}</style>
    </div>
  );
}
