import React, { useCallback, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  ClipboardPaste,
  LayoutTemplate,
  Sparkles,
  Loader2,
  Plus,
  Trash2,
  GripVertical,
  Clock,
  ChevronRight,
  Mic,
  Play,
  Upload,
  X,
} from 'lucide-react';
import { FadeTransition } from './FadeTransition.tsx';
import { AppView } from '../types.ts';
import { useRhetor } from '../contexts/RhetorContext.tsx';
import { useRhetorStore } from '../stores/useRhetorStore.ts';
import { PITCH_TEMPLATES, type PitchTemplate } from '../src/data/templates.ts';
import {
  createPitchDeckAsset,
  DECK_FILE_ACCEPT,
  disposePitchDeckAsset,
  isPowerPointDeck,
  isSupportedDeckFile,
} from '../lib/pitch_deck.ts';
import { extractTalkingPointsFromText, type GeneratedTalkingPoints } from '../lib/talking_points.ts';

// ============================================================================
// TYPES
// ============================================================================

type Tab = 'paste' | 'templates' | 'deck' | 'ai';

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

function TabButton({
  active,
  icon: Icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: React.FC<{ className?: string }>;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium tracking-wide transition-all border-b-2 ${
        active
          ? 'border-stone-900 text-stone-900'
          : 'border-transparent text-stone-400 hover:text-stone-600'
      }`}
    >
      <Icon className="w-4 h-4" />
      <span className="hidden xs:inline">{label}</span>
    </button>
  );
}

function BulletEditor({
  bullets,
  onChange,
}: {
  bullets: string[];
  onChange: (bullets: string[]) => void;
}) {
  const updateBullet = (index: number, value: string) => {
    const next = [...bullets];
    next[index] = value;
    onChange(next);
  };

  const removeBullet = (index: number) => {
    onChange(bullets.filter((_, i) => i !== index));
  };

  const addBullet = () => {
    onChange([...bullets, '']);
  };

  return (
    <div className="space-y-2">
      <AnimatePresence initial={false}>
        {bullets.map((bullet, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="flex items-center gap-2 group"
          >
            <GripVertical className="w-4 h-4 text-stone-300 flex-shrink-0" />
            <span className="text-xs text-stone-400 font-mono w-5 flex-shrink-0">
              {i + 1}.
            </span>
            <input
              type="text"
              value={bullet}
              onChange={(e) => updateBullet(i, e.target.value)}
              placeholder="Enter a talking point…"
              className="flex-1 px-3 py-2 border border-stone-200 rounded-lg bg-white text-stone-900 text-sm placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:border-transparent"
            />
            <button
              onClick={() => removeBullet(i)}
              className="p-1.5 text-stone-300 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-all"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>

      {bullets.length < 8 && (
        <button
          onClick={addBullet}
          className="flex items-center gap-2 text-sm text-stone-400 hover:text-stone-600 transition-colors mt-2"
        >
          <Plus className="w-4 h-4" />
          Add talking point
        </button>
      )}
    </div>
  );
}

function TemplateCard({
  template,
  onSelect,
}: {
  template: PitchTemplate;
  onSelect: (t: PitchTemplate) => void;
}) {
  const categoryColors: Record<string, string> = {
    pitch: 'bg-amber-100 text-amber-700',
    presentation: 'bg-slate-100 text-slate-700',
    interview: 'bg-emerald-100 text-emerald-700',
  };

  return (
    <button
      onClick={() => onSelect(template)}
      className="w-full text-left p-4 bg-white border border-stone-200 rounded-lg shadow-sm hover:border-stone-400 hover:shadow-md transition-all group"
    >
      <div className="flex items-start justify-between mb-2">
        <span
          className={`text-[10px] uppercase tracking-widest font-bold px-2 py-0.5 rounded ${
            categoryColors[template.category] ?? 'bg-stone-100 text-stone-600'
          }`}
        >
          {template.category}
        </span>
        <div className="flex items-center gap-1 text-stone-400 text-xs">
          <Clock className="w-3 h-3" />
          {template.duration}s
        </div>
      </div>
      <h4 className="font-serif text-lg text-stone-900 mb-1">{template.name}</h4>
      <p className="text-xs text-stone-500 mb-3">{template.description}</p>
      <div className="flex flex-wrap gap-1">
        {template.bullets.map((b, i) => (
          <span
            key={i}
            className="text-[10px] bg-stone-100 text-stone-500 px-2 py-0.5 rounded-full"
          >
            {b}
          </span>
        ))}
      </div>
      <div className="flex items-center gap-1 mt-3 text-xs font-medium text-stone-400 group-hover:text-stone-700 transition-colors">
        Use this template <ChevronRight className="w-3 h-3" />
      </div>
    </button>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

interface ViewInputProps {
  onChangeView: (view: AppView) => void;
}

export const ViewInput: React.FC<ViewInputProps> = ({ onChangeView }) => {
  const [activeTab, setActiveTab] = useState<Tab>('paste');
  const [pastedText, setPastedText] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [deckError, setDeckError] = useState<string | null>(null);
  const [isDeckUploading, setIsDeckUploading] = useState(false);

  // Editable state
  const [hook, setHook] = useState('');
  const [bullets, setBullets] = useState<string[]>([]);
  const [closing, setClosing] = useState('');
  const [duration, setDuration] = useState(60);
  const [hasContent, setHasContent] = useState(false);

  // Store
  const storedTalkingPoints = useRhetorStore((s) => s.talkingPoints);
  const storedPitchHook = useRhetorStore((s) => s.pitchHook);
  const storedPitchClosing = useRhetorStore((s) => s.pitchClosing);
  const storedDuration = useRhetorStore((s) => s.suggestedDuration);
  const setTalkingPoints = useRhetorStore((s) => s.setTalkingPoints);
  const setPitchHook = useRhetorStore((s) => s.setPitchHook);
  const setPitchClosing = useRhetorStore((s) => s.setPitchClosing);
  const setSuggestedDuration = useRhetorStore((s) => s.setSuggestedDuration);
  const pitchDeck = useRhetorStore((s) => s.pitchDeck);
  const setPitchDeck = useRhetorStore((s) => s.setPitchDeck);
  const clearPitchDeck = useRhetorStore((s) => s.clearPitchDeck);

  // --------------------------------------------------------------------------
  // HANDLERS
  // --------------------------------------------------------------------------

  const applyResult = useCallback(
    (result: GeneratedTalkingPoints) => {
      setHook(result.hook);
      setBullets(result.bullets);
      setClosing(result.closing);
      setDuration(result.suggestedDuration);
      setHasContent(true);
    },
    [],
  );

  const handleGenerate = useCallback(async () => {
    if (!pastedText.trim()) return;
    setIsGenerating(true);
    setGenerateError(null);
    try {
      const result = await extractTalkingPointsFromText(pastedText);
      applyResult(result);
    } catch (err: any) {
      console.error('[ViewInput] generation error', err);
      setGenerateError(err.message ?? 'Failed to generate talking points');
    } finally {
      setIsGenerating(false);
    }
  }, [pastedText, applyResult]);

  const handleTemplateSelect = useCallback(
    (template: PitchTemplate) => {
      applyResult({
        hook: '',
        bullets: [...template.bullets],
        closing: '',
        suggestedDuration: template.duration,
      });
      setActiveTab('paste'); // switch to editor view
    },
    [applyResult],
  );

  const { connect, isConnected } = useRhetor();

  const handleDeckFileChange = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = '';
      if (!file) return;

      if (!isSupportedDeckFile(file)) {
        setDeckError('Please upload a PDF, PowerPoint, or image file.');
        return;
      }

      setDeckError(null);
      setIsDeckUploading(true);
      try {
        const nextDeck = await createPitchDeckAsset(file);
        disposePitchDeckAsset(pitchDeck);
        setPitchDeck(nextDeck);

        if (nextDeck.extractedText?.trim() && !hasContent) {
          try {
            const extracted = await extractTalkingPointsFromText(nextDeck.extractedText);
            applyResult(extracted);
            setActiveTab('paste');
          } catch (extractError) {
            console.warn('[ViewInput] auto-extract from deck failed', extractError);
            setPastedText((prev) => prev || nextDeck.extractedText || '');
            setActiveTab('paste');
          }
        }
      } catch (error) {
        console.error('[ViewInput] deck upload failed', error);
        setDeckError('Could not load this file. Try another PDF, PowerPoint, or image.');
      } finally {
        setIsDeckUploading(false);
      }
    },
    [pitchDeck, setPitchDeck, hasContent, applyResult],
  );

  const handleRemoveDeck = useCallback(() => {
    disposePitchDeckAsset(pitchDeck);
    clearPitchDeck();
    setDeckError(null);
  }, [pitchDeck, clearPitchDeck]);

  const handleStartPractice = useCallback(async () => {
    // Save to store
    setTalkingPoints(bullets);
    setPitchHook(hook);
    setPitchClosing(closing);
    setSuggestedDuration(duration);

    // Ensure Gemini is connected before entering practice
    if (!isConnected) await connect();

    onChangeView(AppView.PRACTICE);
  }, [bullets, hook, closing, duration, setTalkingPoints, setPitchHook, setPitchClosing, setSuggestedDuration, onChangeView, connect, isConnected]);

  useEffect(() => {
    if (!hasContent && (storedTalkingPoints.length > 0 || storedPitchHook || storedPitchClosing)) {
      setHook(storedPitchHook);
      setBullets(storedTalkingPoints);
      setClosing(storedPitchClosing);
      setDuration(storedDuration > 0 ? storedDuration : 60);
      setHasContent(true);
    }
  }, [hasContent, storedTalkingPoints, storedPitchHook, storedPitchClosing, storedDuration]);

  useEffect(() => {
    if (!pastedText && pitchDeck?.extractedText) {
      setPastedText(pitchDeck.extractedText);
    }
  }, [pastedText, pitchDeck]);

  // --------------------------------------------------------------------------
  // RENDER
  // --------------------------------------------------------------------------

  return (
    <FadeTransition className="flex flex-col min-h-screen bg-stone-50 text-stone-900">
      {/* Header */}
      <div className="px-6 pt-6 pb-2 flex items-center gap-4 bg-stone-50/80 backdrop-blur sticky top-0 z-10">
        <button
          onClick={() => onChangeView(AppView.HOME)}
          className="text-stone-400 hover:text-stone-900 transition-colors"
        >
          <ArrowLeft className="w-6 h-6" />
        </button>
        <div>
          <h2 className="text-2xl font-serif font-light">Prepare Content</h2>
          <p className="text-xs text-stone-400 uppercase tracking-widest">Choose how to build your talking points</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex px-6 border-b border-stone-200 sticky top-[72px] bg-stone-50/80 backdrop-blur z-10">
        <TabButton
          active={activeTab === 'paste'}
          icon={ClipboardPaste}
          label="Paste Content"
          onClick={() => setActiveTab('paste')}
        />
        <TabButton
          active={activeTab === 'templates'}
          icon={LayoutTemplate}
          label="Templates"
          onClick={() => setActiveTab('templates')}
        />
        <TabButton
          active={activeTab === 'deck'}
          icon={Upload}
          label="Presentation"
          onClick={() => setActiveTab('deck')}
        />
        <TabButton
          active={activeTab === 'ai'}
          icon={Sparkles}
          label="Build with AI"
          onClick={() => setActiveTab('ai')}
        />
      </div>

      {/* Tab Content */}
      <div className="flex-1 px-6 py-6 overflow-y-auto pb-40">
        <AnimatePresence mode="wait">
          {/* ============================================================= */}
          {/* PASTE CONTENT TAB                                              */}
          {/* ============================================================= */}
          {activeTab === 'paste' && (
            <motion.div
              key="paste"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              transition={{ duration: 0.2 }}
              className="space-y-6"
            >
              {/* Textarea */}
              {!hasContent && (
                <div className="space-y-3">
                  <label className="block text-sm font-medium text-stone-700">
                    Paste your speech or presentation text
                  </label>
                  <textarea
                    value={pastedText}
                    onChange={(e) => setPastedText(e.target.value)}
                    placeholder="Paste your speech, presentation notes, article, or any text you want to turn into talking points…"
                    rows={8}
                    className="w-full px-4 py-3 border border-stone-200 rounded-lg bg-white text-stone-900 text-sm placeholder-stone-400 resize-none focus:outline-none focus:ring-2 focus:ring-slate-500 focus:border-transparent leading-relaxed"
                  />
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-stone-400">
                      {pastedText.length > 0
                        ? `${pastedText.split(/\s+/).filter(Boolean).length} words`
                        : 'Tip: Paste any length of text'}
                    </span>
                    <button
                      onClick={handleGenerate}
                      disabled={!pastedText.trim() || isGenerating}
                      className="flex items-center gap-2 px-5 py-2.5 bg-slate-700 text-white rounded-lg font-medium text-sm hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      {isGenerating ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Extracting…
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4" />
                          Generate Talking Points
                        </>
                      )}
                    </button>
                  </div>
                  {generateError && (
                    <p className="text-sm text-rose-600 mt-1">{generateError}</p>
                  )}
                </div>
              )}

              {/* Editable Results */}
              {hasContent && (
                <div className="space-y-5">
                  {/* Hook */}
                  <div>
                    <label className="block text-xs font-medium text-stone-500 uppercase tracking-widest mb-1">
                      Hook / Opening
                    </label>
                    <input
                      type="text"
                      value={hook}
                      onChange={(e) => setHook(e.target.value)}
                      placeholder="Your compelling opening line…"
                      className="w-full px-4 py-2.5 border border-stone-200 rounded-lg bg-white text-stone-900 text-sm placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:border-transparent"
                    />
                  </div>

                  {/* Talking Points */}
                  <div>
                    <label className="block text-xs font-medium text-stone-500 uppercase tracking-widest mb-2">
                      Talking Points
                    </label>
                    <BulletEditor bullets={bullets} onChange={setBullets} />
                  </div>

                  {/* Closing */}
                  <div>
                    <label className="block text-xs font-medium text-stone-500 uppercase tracking-widest mb-1">
                      Closing
                    </label>
                    <input
                      type="text"
                      value={closing}
                      onChange={(e) => setClosing(e.target.value)}
                      placeholder="Your strong closing line…"
                      className="w-full px-4 py-2.5 border border-stone-200 rounded-lg bg-white text-stone-900 text-sm placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:border-transparent"
                    />
                  </div>

                  {/* Duration */}
                  <div className="flex items-center gap-3">
                    <Clock className="w-4 h-4 text-stone-400" />
                    <label className="text-xs font-medium text-stone-500 uppercase tracking-widest">
                      Duration
                    </label>
                    <select
                      value={duration}
                      onChange={(e) => setDuration(Number(e.target.value))}
                      className="px-3 py-1.5 border border-stone-200 rounded-lg bg-white text-stone-900 text-sm focus:outline-none focus:ring-2 focus:ring-slate-500"
                    >
                      <option value={30}>30s</option>
                      <option value={60}>60s</option>
                      <option value={90}>90s</option>
                      <option value={120}>2 min</option>
                      <option value={180}>3 min</option>
                      <option value={300}>5 min</option>
                    </select>
                  </div>

                  {/* Deck Upload */}
                  <div className="rounded-lg border border-stone-200 bg-white p-4 space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-medium text-stone-500 uppercase tracking-widest">
                          Pitch Deck (Optional)
                        </p>
                        <p className="text-xs text-stone-400 mt-1">
                          Add a PDF, PPT/PPTX, or image to reference during practice.
                        </p>
                      </div>
                      <label className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-stone-900 text-white text-xs font-medium cursor-pointer hover:bg-stone-800 transition-colors">
                        <Upload className="w-3.5 h-3.5" />
                        {isDeckUploading ? 'Loading...' : pitchDeck ? 'Replace Deck' : 'Upload Deck'}
                        <input
                          type="file"
                          accept={DECK_FILE_ACCEPT}
                          onChange={handleDeckFileChange}
                          className="hidden"
                          disabled={isDeckUploading}
                        />
                      </label>
                    </div>

                    {pitchDeck && (
                      <div className="flex items-center justify-between gap-3 rounded-md border border-stone-200 bg-stone-50 px-3 py-2">
                        <div className="min-w-0">
                          <p className="text-sm text-stone-700 truncate">{pitchDeck.fileName}</p>
                          <p className="text-[11px] text-stone-400">
                            {pitchDeck.totalSlides
                              ? `${pitchDeck.totalSlides} slide${pitchDeck.totalSlides === 1 ? '' : 's'}`
                              : isPowerPointDeck(pitchDeck)
                                ? pitchDeck.slideTexts?.length
                                  ? `${pitchDeck.slideTexts.length} slide${pitchDeck.slideTexts.length === 1 ? '' : 's'} parsed from PPTX`
                                  : 'PowerPoint attached'
                                : 'Slide count detected during practice'}
                          </p>
                        </div>
                        <button
                          onClick={handleRemoveDeck}
                          className="p-1.5 text-stone-400 hover:text-rose-600 transition-colors"
                          title="Remove deck"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    )}

                    {deckError && <p className="text-xs text-rose-600">{deckError}</p>}
                  </div>

                  {/* Reset link */}
                  <button
                    onClick={() => {
                      setHasContent(false);
                      setHook('');
                      setBullets([]);
                      setClosing('');
                      setPastedText('');
                      handleRemoveDeck();
                    }}
                    className="text-xs text-stone-400 hover:text-stone-600 uppercase tracking-widest"
                  >
                    ← Start over
                  </button>
                </div>
              )}
            </motion.div>
          )}

          {/* ============================================================= */}
          {/* TEMPLATES TAB                                                  */}
          {/* ============================================================= */}
          {activeTab === 'templates' && (
            <motion.div
              key="templates"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              transition={{ duration: 0.2 }}
              className="space-y-4"
            >
              <p className="text-sm text-stone-500 mb-2">
                Pick a template to start with. You can edit the talking points after.
              </p>
              {PITCH_TEMPLATES.map((t) => (
                <TemplateCard key={t.id} template={t} onSelect={handleTemplateSelect} />
              ))}
            </motion.div>
          )}

          {/* ============================================================= */}
          {/* PRESENTATION TAB                                              */}
          {/* ============================================================= */}
          {activeTab === 'deck' && (
            <motion.div
              key="deck"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              transition={{ duration: 0.2 }}
              className="space-y-4"
            >
              <div className="rounded-lg border border-stone-200 bg-white p-5 space-y-4">
                <div>
                  <p className="text-xs font-medium text-stone-500 uppercase tracking-widest">
                    Start From Presentation
                  </p>
                  <p className="text-sm text-stone-500 mt-2">
                    Upload a PPTX to parse slide text, preview it in practice, and auto-generate talking points.
                  </p>
                </div>

                <label className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-stone-900 text-white text-sm font-medium cursor-pointer hover:bg-stone-800 transition-colors">
                  <Upload className="w-4 h-4" />
                  {isDeckUploading ? 'Processing...' : pitchDeck ? 'Replace Deck' : 'Upload Deck'}
                  <input
                    type="file"
                    accept={DECK_FILE_ACCEPT}
                    onChange={handleDeckFileChange}
                    className="hidden"
                    disabled={isDeckUploading}
                  />
                </label>

                {pitchDeck && (
                  <div className="rounded-md border border-stone-200 bg-stone-50 px-3 py-3 space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm text-stone-700 truncate">{pitchDeck.fileName}</p>
                        <p className="text-[11px] text-stone-400">
                            {pitchDeck.totalSlides
                              ? `${pitchDeck.totalSlides} slide${pitchDeck.totalSlides === 1 ? '' : 's'}`
                              : isPowerPointDeck(pitchDeck)
                                ? pitchDeck.slideHtml?.length
                                  ? `${pitchDeck.slideHtml.length} slide${pitchDeck.slideHtml.length === 1 ? '' : 's'} ready for preview`
                                  : pitchDeck.slideTexts?.length
                                    ? `${pitchDeck.slideTexts.length} slide${pitchDeck.slideTexts.length === 1 ? '' : 's'} parsed from PPTX`
                                    : 'PowerPoint attached'
                                : 'Deck attached'}
                        </p>
                      </div>
                      <button
                        onClick={handleRemoveDeck}
                        className="p-1.5 text-stone-400 hover:text-rose-600 transition-colors"
                        title="Remove deck"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    {pitchDeck.extractedText && (
                      <p className="text-xs text-stone-500 line-clamp-4 whitespace-pre-wrap">
                        {pitchDeck.extractedText}
                      </p>
                    )}
                  </div>
                )}

                {!hasContent && (
                  <p className="text-xs text-stone-400">
                    After upload, we auto-generate talking points from the deck text and open them in Paste Content.
                  </p>
                )}

                {deckError && <p className="text-xs text-rose-600">{deckError}</p>}
              </div>
            </motion.div>
          )}

          {/* ============================================================= */}
          {/* BUILD WITH AI TAB                                              */}
          {/* ============================================================= */}
          {activeTab === 'ai' && (
            <motion.div
              key="ai"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              transition={{ duration: 0.2 }}
              className="flex flex-col items-center justify-center text-center py-16 space-y-6"
            >
              <div className="w-16 h-16 rounded-full bg-stone-900 flex items-center justify-center">
                <Mic className="w-7 h-7 text-white" />
              </div>
              <div>
                <h3 className="font-serif text-2xl text-stone-900 mb-2">
                  Build with AI Interview
                </h3>
                <p className="text-stone-500 text-sm max-w-xs mx-auto leading-relaxed">
                  Have a short conversation with our AI interviewer. It will ask you questions
                  and extract your talking points automatically.
                </p>
              </div>
              <button
                onClick={() => onChangeView(AppView.PREP)}
                className="flex items-center gap-2 px-8 py-3 bg-stone-900 text-white rounded-lg font-medium text-sm hover:bg-stone-800 transition-colors shadow-lg"
              >
                <Sparkles className="w-4 h-4" />
                Start AI Interview
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Bottom CTA — fixed */}
      {hasContent && bullets.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-stone-50/90 backdrop-blur border-t border-stone-200 z-20">
          <button
            onClick={handleStartPractice}
            className="w-full flex items-center justify-center gap-2 py-3.5 bg-slate-700 text-white rounded-xl font-medium text-sm hover:bg-slate-800 transition-colors shadow-lg"
          >
            <Play className="w-4 h-4" />
            Start Practice
          </button>
        </div>
      )}
    </FadeTransition>
  );
};
