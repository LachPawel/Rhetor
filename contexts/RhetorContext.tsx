
import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { GenAILiveClient, DEFAULT_LIVE_API_MODEL } from '../lib/genai_client.ts';
import { AudioRecorder } from '../lib/audio_recorder.ts';
import { AudioStreamer } from '../lib/audio_streamer.ts';
import { audioContext } from '../lib/audio_utils.ts';
import { Modality, Tool, FunctionDeclaration, Type } from "@google/genai";
import { AgentMode, RhetorContextType, UserProfile } from '../types.ts';
import { RHETOR_SYSTEM_INSTRUCTION } from '../lib/prompts.ts';

const RhetorContext = createContext<RhetorContextType | undefined>(undefined);

// --- TOOLS ---
const savePitchTool: FunctionDeclaration = {
  name: "savePitch",
  description: "Save the generated pitch talking points.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      topic: { type: Type.STRING },
      points: { type: Type.ARRAY, items: { type: Type.STRING } }
    },
    required: ["topic", "points"]
  }
};

const completeLessonTool: FunctionDeclaration = {
    name: "completeLesson",
    description: "Mark a lesson or drill as complete. CALL THIS when the user finishes the drill.",
    parameters: {
        type: Type.OBJECT,
        properties: {
            lessonId: { type: Type.STRING, description: "The ID of the current lesson provided in context" },
            score: { type: Type.NUMBER, description: "Score from 0-100" }
        },
        required: ["lessonId"]
    }
};

const tools: Tool[] = [
  { functionDeclarations: [savePitchTool, completeLessonTool] }
];

// --- INITIAL STATE ---
const INITIAL_USER: UserProfile = {
    name: "Speaker",
    drachmas: 0,
    streak: 0,
    lastPracticeDate: "",
    completedLessons: [],
    badges: []
};

export const RhetorProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // AI State
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [talkingPoints, setTalkingPoints] = useState<string[]>([]);
  const [pitchTopic, setPitchTopic] = useState("");
  const [lastTranscript, setLastTranscript] = useState("");
  const [aiResponse, setAiResponse] = useState("");

  // Gamification State
  const [user, setUser] = useState<UserProfile>(() => {
      const saved = localStorage.getItem('rhetor_user');
      return saved ? JSON.parse(saved) : INITIAL_USER;
  });

  useEffect(() => {
      localStorage.setItem('rhetor_user', JSON.stringify(user));
  }, [user]);

  const clientRef = useRef<GenAILiveClient | null>(null);
  const audioRecorderRef = useRef<AudioRecorder | null>(null);
  const audioStreamerRef = useRef<AudioStreamer | null>(null);
  const currentModeRef = useRef<AgentMode>(AgentMode.IDLE);

  // --- GAMIFICATION ACTIONS ---
  const addDrachmas = (amount: number) => {
      setUser(prev => ({ ...prev, drachmas: prev.drachmas + amount }));
  };

  const updateStreak = () => {
      const today = new Date().toISOString().split('T')[0];
      if (user.lastPracticeDate === today) return;

      const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
      const isConsecutive = user.lastPracticeDate === yesterday;

      setUser(prev => ({
          ...prev,
          lastPracticeDate: today,
          streak: isConsecutive ? prev.streak + 1 : 1
      }));
  };

  const completeLesson = (lessonId: string) => {
      if (!user.completedLessons.includes(lessonId)) {
          console.log("Completing lesson:", lessonId);
          setUser(prev => ({
              ...prev,
              completedLessons: [...prev.completedLessons, lessonId]
          }));
          addDrachmas(50); // Standard reward
          updateStreak();
      }
  };

  // --- AI CONNECTION ---
  const connect = async () => {
    if (isConnected || isConnecting) return;
    setIsConnecting(true);

    try {
      const apiKey = process.env.API_KEY;
      if (!apiKey) throw new Error("API Key missing");

      const client = new GenAILiveClient(apiKey, DEFAULT_LIVE_API_MODEL);
      const ctx = await audioContext({ sampleRate: 24000 });
      const streamer = new AudioStreamer(ctx);
      const recorder = new AudioRecorder(16000);

      clientRef.current = client;
      audioStreamerRef.current = streamer;
      audioRecorderRef.current = recorder;

      client.on('open', async () => {
        setIsConnected(true);
        setIsConnecting(false);
        await recorder.start();
        setMode(AgentMode.WELCOMER);
      });

      client.on('close', () => {
        setIsConnected(false);
        setIsConnecting(false);
      });

      client.on('audio', (data) => {
        streamer.addPCM16(new Uint8Array(data));
        setIsSpeaking(true);
        setTimeout(() => setIsSpeaking(false), 2000);
      });

      client.on('inputTranscription', (text, isFinal) => {
        if (isFinal) setLastTranscript(text);
      });

      client.on('outputTranscription', (text, isFinal) => {
         setAiResponse(prev => isFinal ? text : text);
      });

      client.on('toolcall', (toolCall) => {
          console.log("Tool call received:", toolCall);
          toolCall.functionCalls.forEach(fc => {
              if (fc.name === 'savePitch') {
                  const args = fc.args as any;
                  setPitchTopic(args.topic);
                  setTalkingPoints(args.points);
                  client.sendToolResponse({
                      functionResponses: [{
                          id: fc.id,
                          name: fc.name,
                          response: { result: "Pitch saved." }
                      }]
                  });
              } else if (fc.name === 'completeLesson') {
                  const args = fc.args as any;
                  completeLesson(args.lessonId);
                  client.sendToolResponse({
                      functionResponses: [{
                          id: fc.id,
                          name: fc.name,
                          response: { result: "Lesson marked complete. Congratulate user." }
                      }]
                  });
              }
          });
      });

      recorder.on('data', (base64) => {
        client.sendRealtimeInput([{ mimeType: 'audio/pcm;rate=16000', data: base64 as string }]);
      });

      await client.connect({
        responseModalities: [Modality.AUDIO],
        // Using 'Fenrir' for a deeper, more "Zeus-like" masculine voice
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Fenrir' } } },
        systemInstruction: RHETOR_SYSTEM_INSTRUCTION,
        tools: tools
      });

    } catch (e) {
      console.error(e);
      setIsConnecting(false);
      setIsConnected(false);
    }
  };

  const disconnect = () => {
    clientRef.current?.disconnect();
    audioRecorderRef.current?.stop();
    audioStreamerRef.current?.stop();
    setIsConnected(false);
  };

  const setMode = (mode: AgentMode, contextData?: any) => {
    currentModeRef.current = mode;
    if (clientRef.current && isConnected) {
      const contextPayload = {
          user: { name: user.name, streak: user.streak, drachmas: user.drachmas },
          ...contextData
      };
      clientRef.current.send({ text: `SYSTEM_UPDATE: Switch to mode ${mode}. Context: ${JSON.stringify(contextPayload)}` });
    }
  };

  return (
    <RhetorContext.Provider value={{
      isConnected,
      isConnecting,
      isSpeaking,
      connect,
      disconnect,
      setMode,
      talkingPoints,
      setTalkingPoints,
      pitchTopic,
      setPitchTopic,
      lastTranscript,
      aiResponse,
      user,
      addDrachmas,
      completeLesson,
      updateStreak
    }}>
      {children}
    </RhetorContext.Provider>
  );
};

export const useRhetor = () => {
  const context = useContext(RhetorContext);
  if (!context) throw new Error("useRhetor must be used within RhetorProvider");
  return context;
};
