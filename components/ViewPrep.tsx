
import React, { useEffect, useRef, useState } from 'react';
import { FadeTransition } from './FadeTransition.tsx';
import { ArrowLeft, Mic, FileText, Upload, Sparkles, Keyboard } from 'lucide-react';
import { useRhetor } from '../contexts/RhetorContext.tsx';
import { AgentMode } from '../types.ts';

interface ViewPrepProps {
  onBegin: (talkingPoints?: string[]) => void;
  onBack: () => void;
}

type PrepMethod = 'menu' | 'interview' | 'paste' | 'upload';

export const ViewPrep: React.FC<ViewPrepProps> = ({ onBegin, onBack }) => {
  const { setMode, isConnected, talkingPoints, aiResponse, isSpeaking } = useRhetor();
  const [method, setMethod] = useState<PrepMethod>('menu');
  const [pastedText, setPastedText] = useState('');

  // Set mode only when entering interview
  const modeSetRef = useRef(false);
  useEffect(() => {
    if (isConnected && method === 'interview' && !modeSetRef.current) {
        modeSetRef.current = true;
        setMode(AgentMode.INTERVIEWER);
    }
  }, [isConnected, setMode, method]);

  // If the AI tool has saved the talking points, we are ready
  useEffect(() => {
      if (talkingPoints.length > 0 && method === 'interview') {
          // Add a small delay so user sees the result before jumping
          const timeout = setTimeout(() => {
              onBegin(talkingPoints);
          }, 3000);
          return () => clearTimeout(timeout);
      }
  }, [talkingPoints, method]);

  const handlePasteSubmit = () => {
    // Basic splitting by newline for now
    const points = pastedText.split('\n').map(p => p.trim()).filter(p => p.length > 0);
    onBegin(points.length > 0 ? points : undefined);
  };

  const MockUpload = () => (
      <div className="flex flex-col items-center justify-center p-12 border-2 border-dashed border-stone-200 rounded-lg bg-stone-50 text-stone-400">
          <Upload className="w-8 h-8 mb-2" />
          <p className="text-sm font-serif">PDF Upload Coming Soon</p>
          <button onClick={() => setMethod('menu')} className="mt-4 text-xs underline">Go Back</button>
      </div>
  );

  return (
    <FadeTransition className="flex flex-col items-center min-h-screen p-6 relative bg-stone-50 text-stone-900">
      <button onClick={() => method === 'menu' ? onBack() : setMethod('menu')} className="absolute top-6 left-6 text-stone-400 hover:text-stone-900 transition-colors z-20">
          <ArrowLeft className="w-6 h-6" />
      </button>

      {/* ── MENU ── */}
      {method === 'menu' && (
        <div className="flex-1 flex flex-col items-center justify-center w-full max-w-lg gap-6">
            <div className="text-center mb-4">
                <h2 className="text-4xl serif font-light text-stone-900 mb-2">Prepare</h2>
                <p className="text-stone-500 text-sm tracking-widest uppercase">Choose your input method</p>
            </div>

            <button onClick={() => setMethod('interview')} className="w-full p-6 bg-white border border-stone-200 rounded-lg shadow-sm hover:border-emerald-500 hover:ring-1 hover:ring-emerald-500 transition-all flex items-center gap-4 group text-left">
                <div className="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600 group-hover:scale-110 transition-transform">
                    <Sparkles className="w-6 h-6" />
                </div>
                <div>
                    <h3 className="font-serif text-lg font-medium text-stone-900">AI Interview</h3>
                    <p className="text-sm text-stone-500">Rhetor interviews you to extract key points.</p>
                </div>
            </button>

            <button onClick={() => setMethod('paste')} className="w-full p-6 bg-white border border-stone-200 rounded-lg shadow-sm hover:border-stone-400 transition-all flex items-center gap-4 group text-left">
                <div className="w-12 h-12 rounded-full bg-stone-100 flex items-center justify-center text-stone-600 group-hover:scale-110 transition-transform">
                    <Keyboard className="w-6 h-6" />
                </div>
                <div>
                    <h3 className="font-serif text-lg font-medium text-stone-900">Paste Script</h3>
                    <p className="text-sm text-stone-500">Paste your talking points manually.</p>
                </div>
            </button>
            
             <button onClick={() => setMethod('upload')} className="w-full p-6 bg-white border border-stone-200 rounded-lg shadow-sm hover:border-stone-400 transition-all flex items-center gap-4 group text-left opacity-60">
                <div className="w-12 h-12 rounded-full bg-stone-100 flex items-center justify-center text-stone-600 group-hover:scale-110 transition-transform">
                    <Upload className="w-6 h-6" />
                </div>
                <div>
                    <h3 className="font-serif text-lg font-medium text-stone-900">Upload PDF</h3>
                    <p className="text-sm text-stone-500">Extract points from a document (Coming Soon).</p>
                </div>
            </button>
        </div>
      )}

      {/* ── INTERVIEW ── */}
      {method === 'interview' && (
        <div className="flex-1 flex flex-col items-center justify-center w-full max-w-2xl text-center">
            <div className="mb-8">
                <h2 className="text-4xl serif font-light text-stone-900 mb-2">Pitch Builder</h2>
                <p className="text-stone-500 text-sm tracking-widest uppercase">AI Interview Mode</p>
            </div>

            <div className="min-h-[200px] flex items-center justify-center p-8 bg-white border border-stone-100 shadow-sm rounded-sm mb-8 w-full">
                <p className="text-2xl serif text-stone-700 leading-relaxed italic">
                    "{aiResponse || "I'm ready. Let's build your pitch. What topic are we covering today?"}"
                </p>
            </div>

            <div className="flex flex-col items-center gap-4">
                {isSpeaking ? (
                    <div className="flex gap-2 items-center text-emerald-600">
                        <Mic className="w-5 h-5 animate-pulse" />
                        <span className="text-xs uppercase tracking-widest">Listening...</span>
                    </div>
                ) : (
                    <div className="text-xs text-stone-400 uppercase tracking-widest">Rhetor is waiting for your answer</div>
                )}
            </div>
            
            <button onClick={() => onBegin()} className="mt-12 text-xs text-stone-300 hover:text-stone-500 uppercase tracking-widest">
                Skip Interview
            </button>
        </div>
      )}

      {/* ── PASTE ── */}
      {method === 'paste' && (
          <div className="flex-1 flex flex-col items-center w-full max-w-2xl pt-10">
              <div className="text-center mb-8">
                  <h2 className="text-3xl serif font-light text-stone-900 mb-2">Paste Script</h2>
                  <p className="text-stone-500 text-sm tracking-widest uppercase">One point per line</p>
              </div>
              
              <textarea 
                  className="w-full h-64 p-4 bg-white border border-stone-200 rounded-lg focus:ring-1 focus:ring-stone-400 focus:outline-none font-serif text-lg leading-relaxed resize-none mb-6"
                  placeholder="Paste your talking points here..."
                  value={pastedText}
                  onChange={(e) => setPastedText(e.target.value)}
              />
              
              <button 
                  onClick={handlePasteSubmit}
                  disabled={pastedText.length === 0}
                  className="px-8 py-3 bg-stone-900 text-stone-50 rounded-full font-serif text-lg hover:bg-stone-800 transition-colors disabled:opacity-50"
              >
                  Start Practice
              </button>
          </div>
      )}

      {/* ── UPLOAD ── */}
      {method === 'upload' && <MockUpload />}

    </FadeTransition>
  );
};
