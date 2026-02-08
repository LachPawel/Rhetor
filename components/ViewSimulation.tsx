
import React, { useEffect, useRef, useState } from 'react';
import { FadeTransition } from './FadeTransition.tsx';
import { AgentMode } from '../types.ts';
import { useRhetor } from '../contexts/RhetorContext.tsx';
import { ArrowLeft, Mic, User, Briefcase, Frown, Users, Zap, SkipForward } from 'lucide-react';

interface ViewSimulationProps {
    onBack: () => void;
}

const PERSONAS = [
    { id: 'investor', name: 'Skeptical Investor', description: 'Hard questions. Focuses on numbers, TAM, and defensibility.', icon: <Briefcase className="w-6 h-6" /> },
    { id: 'customer', name: 'Angry Customer', description: 'Impatient. Wants a refund or immediate solution.', icon: <Frown className="w-6 h-6" /> },
    { id: 'novice', name: 'Confused Novice', description: 'Does not understand tech jargon. Needs simple analogies.', icon: <Users className="w-6 h-6" /> },
];

export const ViewSimulation: React.FC<ViewSimulationProps> = ({ onBack }) => {
    const { setMode, isConnected, isSpeaking, aiResponse, lastTranscript, connect } = useRhetor();
    const [selectedPersona, setSelectedPersona] = useState<string | null>(null);
    const [isActive, setIsActive] = useState(false);
    const [stream, setStream] = useState<MediaStream | null>(null);
    const videoRef = useRef<HTMLVideoElement>(null);

    // Ensure connection before starting
    const handleStart = async (personaId: string) => {
        if (!isConnected) await connect();
        setSelectedPersona(personaId);
        setIsActive(true);
    };

    // Set AI mode when active
    const modeSetRef = useRef(false);
    useEffect(() => {
        if (isActive && selectedPersona && !modeSetRef.current) {
            modeSetRef.current = true;
            const persona = PERSONAS.find(p => p.id === selectedPersona)?.name || 'Audience';
            setMode(AgentMode.SIMULATION, { persona });
        } else if (!isActive) {
            modeSetRef.current = false;
        }
    }, [isActive, selectedPersona, setMode]);

    // Track stream in a ref so cleanup always sees the latest value
    const streamRef = useRef<MediaStream | null>(null);

    // Camera setup for self-view
    useEffect(() => {
        if (isActive) {
            navigator.mediaDevices.getUserMedia({ video: true })
                .then(s => {
                    streamRef.current = s;
                    setStream(s);
                })
                .catch(console.error);
        }
        return () => {
            streamRef.current?.getTracks().forEach(t => t.stop());
            streamRef.current = null;
            setStream(null);
        };
    }, [isActive]);

    // Assign srcObject once both the stream and the video element exist
    useEffect(() => {
        if (videoRef.current && stream) {
            videoRef.current.srcObject = stream;
        }
    }, [stream]);

    const persona = PERSONAS.find(p => p.id === selectedPersona);

    return (
        <FadeTransition className="flex flex-col min-h-screen bg-stone-900 text-stone-50 relative">
             {/* Background for "Theater" feel */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-stone-800 via-stone-950 to-stone-950 opacity-80" />

            <button onClick={onBack} className="absolute top-6 left-6 text-stone-500 hover:text-stone-300 transition-colors z-20">
                <ArrowLeft className="w-6 h-6" />
            </button>

            {/* ── SELECTION SCREEN ── */}
            {!isActive && (
                <div className="flex-1 flex flex-col items-center justify-center p-6 z-10 relative">
                    <h2 className="text-3xl serif font-light mb-2">Simulate Audience</h2>
                    <p className="text-stone-400 text-sm tracking-widest uppercase mb-12">Who are you pitching to?</p>

                    <div className="grid gap-4 w-full max-w-md">
                        {PERSONAS.map(p => (
                            <button
                                key={p.id}
                                onClick={() => handleStart(p.id)}
                                className="flex items-center gap-5 p-6 bg-stone-800/50 border border-stone-800 rounded-lg hover:bg-stone-800 hover:border-stone-600 transition-all text-left group"
                            >
                                <div className="p-3 rounded-full bg-stone-900 group-hover:bg-stone-700 transition-colors text-stone-400 group-hover:text-stone-200">
                                    {p.icon}
                                </div>
                                <div>
                                    <h3 className="font-serif text-lg font-medium text-stone-200">{p.name}</h3>
                                    <p className="text-xs text-stone-500">{p.description}</p>
                                </div>
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* ── ACTIVE SIMULATION ── */}
            {isActive && persona && (
                <div className="flex-1 flex flex-col relative z-10">
                    
                    {/* Header */}
                    <div className="p-6 flex justify-center text-stone-500 text-xs font-mono uppercase tracking-widest">
                        Simulation In Progress • {persona.name}
                    </div>

                    {/* Main Stage */}
                    <div className="flex-1 flex items-center justify-center relative">
                        {/* Persona Avatar / Presence */}
                        <div className={`relative w-48 h-48 rounded-full border-4 flex items-center justify-center transition-all duration-500 ${isSpeaking ? 'scale-110 border-emerald-500/50 shadow-[0_0_60px_rgba(16,185,129,0.2)]' : 'scale-100 border-stone-700'}`}>
                            {/* Listening Pulse */}
                             {isSpeaking && (
                                <div className="absolute inset-0 rounded-full border-2 border-emerald-500/30 animate-ping" />
                            )}
                            
                            <div className="flex flex-col items-center gap-2">
                                <div className="text-stone-300">
                                   {persona.icon}
                                </div>
                                {isSpeaking ? (
                                     <span className="text-xs font-mono text-emerald-500 animate-pulse">LISTENING</span>
                                ) : (
                                     <span className="text-xs font-mono text-stone-500">WAITING</span>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* User Self-View (Corner) */}
                    <div className="absolute bottom-24 right-6 w-32 aspect-video bg-black rounded-lg overflow-hidden border border-stone-800 shadow-2xl">
                         <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover transform -scale-x-100" />
                    </div>

                    {/* User Transcript */}
                    {lastTranscript && (
                        <div className="px-8 flex flex-col items-center text-center">
                            <span className="text-[10px] font-mono uppercase tracking-widest text-stone-600 mb-1">You</span>
                            <p className="text-sm text-stone-400 max-w-xl leading-relaxed">
                                {lastTranscript}
                            </p>
                        </div>
                    )}

                    {/* AI Feedback / Subtitles */}
                    <div className="p-8 pb-32 flex flex-col items-center text-center min-h-[160px]">
                         <p className="text-xl serif italic text-stone-300 leading-relaxed max-w-xl transition-opacity duration-300">
                             "{aiResponse || "I'm listening. Convince me."}"
                         </p>
                    </div>

                </div>
            )}

        </FadeTransition>
    );
};
