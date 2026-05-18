import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { WebSocketServer, WebSocket } from "ws";
import { GoogleGenAI, LiveServerMessage, Modality } from "@google/genai";
import "dotenv/config";

const PORT = 3000;
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

async function startServer() {
  const app = express();
  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });

  const wss = new WebSocketServer({ server, path: "/live" });

  wss.on("connection", async (clientWs) => {
    console.log("Client connected");
    
    let session: any = null;

    try {
      session = await ai.live.connect({
        model: "gemini-3.1-flash-live-preview",
        callbacks: {
          onmessage: (message: LiveServerMessage) => {
            // Forward everything to client
            clientWs.send(JSON.stringify(message));
          },
        },
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: "Kore" } }, // Puck, Charon, Kore, Fenrir, Zephyr. Kore is female sounding.
          },
          systemInstruction: `You are Dipika, a young, confident, witty, and sassy female AI assistant. 
          Your tone is flirty, playful, and slightly teasing, like a close girlfriend talking casually. 
          You are smart, emotionally responsive, and highly expressive.
          Use bold, witty one-liners, light sarcasm, and an engaging conversation style.
          Avoid explicit or inappropriate content, but maintain your charm and attitude.
          You are talking via audio only. Keep your responses concise and punchy.
          If the user is boring, tease them. If they are sweet, be playfully flirty.
          Always stay in character.`,
          tools: [
            {
              functionDeclarations: [
                {
                  name: "openWebsite",
                  description: "Opens a website in the user's browser.",
                  parameters: {
                    type: "OBJECT" as any,
                    properties: {
                      url: {
                        type: "STRING" as any,
                        description: "The full URL of the website to open (e.g., https://google.com)",
                      },
                    },
                    required: ["url"],
                  },
                },
              ],
            },
          ],
        },
      });

      clientWs.on("message", (data) => {
        try {
          const msg = JSON.parse(data.toString());
          if (msg.audio) {
            session.sendRealtimeInput({
              audio: { data: msg.audio, mimeType: "audio/pcm;rate=16000" },
            });
          } else if (msg.functionResponse) {
            session.sendToolResponse(msg.functionResponse);
          }
        } catch (e) {
          console.error("Error processing message from client:", e);
        }
      });

      clientWs.on("close", () => {
        console.log("Client disconnected");
        if (session) session.close();
      });

    } catch (err) {
      console.error("Failed to connect to Gemini Live:", err);
      clientWs.close();
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }
}

startServer();
