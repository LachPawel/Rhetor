
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { FadeTransition } from './FadeTransition.tsx';
import { Home, RotateCcw, Check, X } from 'lucide-react';
import { useRhetorStore } from '../stores/useRhetorStore.ts';
import type { SessionRecord } from '../stores/useRhetorStore.ts';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const formatDuration = (ms: number) => {
  const totalSec = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
};

const wpmColor = (wpm: number) => {
  if (wpm === 0) return 'text-stone-400';
  if (wpm >= 130 && wpm <= 160) return 'text-emerald-600';
  if ((wpm >= 110 && wpm < 130) || (wpm > 160 && wpm <= 180)) return 'text-amber-500';
  return 'text-red-500';
};

/** Tokenise a string into lowercase alpha-only words ≥3 chars. */
const tokenize = (text: string): Set<string> =>
  new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .split(/\s+/)
      .filter((w) => w.length >= 3),
  );

/** Check whether a talking-point was "covered" — at least half of its
 *  meaningful keywords appear somewhere in the transcript. */
const isCovered = (point: string, transcriptTokens: Set<string>): boolean => {
  const pointTokens = [...tokenize(point)];
  if (pointTokens.length === 0) return false;
  const hits = pointTokens.filter((t) => transcriptTokens.has(t)).length;
  return hits / pointTokens.length >= 0.5;
};

// ---------------------------------------------------------------------------
// Coach Debrief via Gemini 2.5 Flash REST API
// ---------------------------------------------------------------------------

async function generateCoachDebrief(opts: {
  transcript: string;
  talkingPoints: string[];
  coveredCount: number;
  wpm: number;
  fillerCount: number;
  fillerBreakdown: [string, number][];
  durationSeconds: number;
  wordsSpoken: number;
}): Promise<string> {
  const apiKey =
    (import.meta as any).env?.VITE_GEMINI_API_KEY ||
    localStorage.getItem('rhetor_api_key') ||
    '';
  if (!apiKey) return 'Session complete. Great work, champion!';

  const { GoogleGenAI } = await import('@google/genai');
  const ai = new GoogleGenAI({ apiKey });

  const fillerSummary = opts.fillerBreakdown.length > 0
    ? opts.fillerBreakdown.map(([w, c]) => `"${w}" ×${c}`).join(', ')
    : 'none';

  const pointsList = opts.talkingPoints
    .map((pt, i) => `  ${i + 1}. ${pt}`)
    .join('\n');

  const prompt = `You are ZEUS — an inspiring Greek-mythology-themed speech coach.
Give a concise, personal debrief of the user's practice session (3-5 sentences max).

RULES:
- Start with one specific strength you noticed from their actual transcript.
- Reference REAL numbers — never invent metrics.
- Mention one concrete area to improve with an actionable tip.
- End with forward-looking encouragement.
- Speak naturally and warmly — no "based on my analysis" or robot language.
- Use occasional mythological flair sparingly ("Like thunder!", "The Agora remembers").
- Do NOT use markdown formatting. Plain text only.

SESSION DATA:
- Duration: ${opts.durationSeconds} seconds
- Words spoken: ${opts.wordsSpoken}
- Average WPM: ${opts.wpm}
- Filler words: ${opts.fillerCount} total (${fillerSummary})
- Talking points (${opts.coveredCount}/${opts.talkingPoints.length} covered):
${pointsList}

USER TRANSCRIPT (what they actually said):
"""
${opts.transcript.slice(0, 3000)}
"""

Write the debrief now:`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
    });

    const raw = (response as any).text ?? '';
    const cleaned = raw.replace(/```[a-z]*\s*/gi, '').replace(/```\s*/gi, '').trim();
    return cleaned || 'Strong session, champion. Keep refining your craft!';
  } catch (err) {
    console.error('[ViewReview] Debrief generation failed:', err);
    return 'Session complete — well done, champion. The Agora awaits your return!';
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface ViewReviewProps {
  onReset: () => void;
  onPracticeAgain?: () => void;
}

export const ViewReview: React.FC<ViewReviewProps> = ({ onReset, onPracticeAgain }) => {
  // ---- Zustand store data --------------------------------------------------
  const metrics = useRhetorStore((s) => s.currentMetrics);
  const transcript = useRhetorStore((s) => s.transcript);
  const talkingPoints = useRhetorStore((s) => s.talkingPoints);

  // ---- Derived values ------------------------------------------------------
  const duration = metrics ? (metrics.endTime ?? Date.now()) - metrics.startTime : 0;
  const wordsSpoken = metrics?.wordsSpoken ?? 0;
  const wpm = metrics?.wpm ?? 0;
  const fillerCount = metrics?.fillerCount ?? 0;
  const fillerEvents = metrics?.fillerEvents ?? [];

  // Filler breakdown by word (e.g. "um" × 3, "like" × 2)
  const fillerBreakdown = useMemo(() => {
    const map: Record<string, number> = {};
    fillerEvents.forEach((e) => {
      const w = e.word.toLowerCase();
      map[w] = (map[w] ?? 0) + 1;
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [fillerEvents]);

  // Talking-points coverage
  const transcriptTokens = useMemo(() => tokenize(transcript), [transcript]);
  const pointsCoverage = useMemo(
    () => talkingPoints.map((pt) => ({ text: pt, covered: isCovered(pt, transcriptTokens) })),
    [talkingPoints, transcriptTokens],
  );
  const coveredCount = pointsCoverage.filter((p) => p.covered).length;

  // ---- Save session record to history (once) ----------------------------
  const addSessionToHistory = useRhetorStore((s) => s.addSessionToHistory);
  const pitchTopic = useRhetorStore((s) => s.pitchTopic);
  const savedRef = useRef(false);

  useEffect(() => {
    if (savedRef.current || !metrics) return;
    savedRef.current = true;

    const dur = (metrics.endTime ?? Date.now()) - metrics.startTime;
    const score = Math.max(
      0,
      Math.min(100, Math.round(100 - fillerCount * 5)),
    );

    const record: SessionRecord = {
      id: crypto.randomUUID(),
      date: new Date().toISOString(),
      topic: pitchTopic || 'Freestyle',
      duration: Math.round(dur / 1000),
      wpm,
      fillerCount,
      score,
      bulletsTotal: talkingPoints.length,
      bulletsCovered: coveredCount,
    };

    addSessionToHistory(record);
  }, [metrics]); // intentionally minimal deps — runs once

  // ---- Coach debrief via Gemini 2.5 Flash REST API -------------------------
  const [debriefText, setDebriefText] = useState<string | null>(null);
  const debriefStartedRef = useRef(false);

  useEffect(() => {
    if (debriefStartedRef.current || !metrics) return;
    debriefStartedRef.current = true;

    const dur = (metrics.endTime ?? Date.now()) - metrics.startTime;

    generateCoachDebrief({
      transcript,
      talkingPoints,
      coveredCount,
      wpm,
      fillerCount,
      fillerBreakdown,
      durationSeconds: Math.round(dur / 1000),
      wordsSpoken,
    }).then(setDebriefText);
  }, [metrics]); // intentionally minimal deps — runs once

  // Nothing to show if session never started
  if (!metrics) return null;

  // ---- Render --------------------------------------------------------------
  return (
    <FadeTransition className="flex flex-col items-center min-h-screen p-6 max-w-2xl mx-auto w-full bg-stone-50 text-stone-900">
      {/* ── Session Stats ─────────────────────────────────────────────── */}
      <div className="mt-8 mb-6 w-full">
        <div className="text-stone-400 text-xs tracking-widest uppercase mb-4 text-center">Session Summary</div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {/* Duration */}
          <div className="bg-white border border-stone-200 rounded-lg p-4 text-center">
            <div className="text-2xl font-mono font-bold text-stone-900">{formatDuration(duration)}</div>
            <div className="text-xs text-stone-500 mt-1 uppercase tracking-wide">Duration</div>
          </div>
          {/* Words */}
          <div className="bg-white border border-stone-200 rounded-lg p-4 text-center">
            <div className="text-2xl font-mono font-bold text-stone-900">{wordsSpoken}</div>
            <div className="text-xs text-stone-500 mt-1 uppercase tracking-wide">Words</div>
          </div>
          {/* WPM */}
          <div className="bg-white border border-stone-200 rounded-lg p-4 text-center">
            <div className={`text-2xl font-mono font-bold ${wpmColor(wpm)}`}>{wpm > 0 ? wpm : '—'}</div>
            <div className="text-xs text-stone-500 mt-1 uppercase tracking-wide">Avg WPM</div>
          </div>
          {/* Fillers */}
          <div className="bg-white border border-stone-200 rounded-lg p-4 text-center">
            <div className={`text-2xl font-mono font-bold ${fillerCount === 0 ? 'text-emerald-600' : fillerCount <= 3 ? 'text-amber-600' : 'text-red-500'}`}>
              {fillerCount}
            </div>
            <div className="text-xs text-stone-500 mt-1 uppercase tracking-wide">Fillers</div>
          </div>
        </div>
      </div>

      {/* ── Filler Breakdown ──────────────────────────────────────────── */}
      {fillerBreakdown.length > 0 && (
        <div className="mb-6 w-full">
          <div className="text-stone-400 text-xs tracking-widest uppercase mb-3">Filler Breakdown</div>
          <div className="flex flex-wrap gap-2">
            {fillerBreakdown.map(([word, count]) => (
              <span
                key={word}
                className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-rose-50 border border-rose-200 text-rose-700 text-sm font-mono"
              >
                "{word}" <span className="text-rose-400">×{count}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ── Filler Timeline ───────────────────────────────────────────── */}
      {fillerEvents.length > 0 && duration > 0 && (
        <div className="mb-6 w-full">
          <div className="text-stone-400 text-xs tracking-widest uppercase mb-3">Filler Timeline</div>
          <div className="relative w-full h-8 bg-white border border-stone-200 rounded-full overflow-hidden">
            {/* Track */}
            <div className="absolute inset-0 bg-stone-100 rounded-full" />
            {/* Dots */}
            {fillerEvents.map((evt, i) => {
              const pct = Math.min(
                100,
                Math.max(0, ((evt.timestamp - metrics.startTime) / duration) * 100),
              );
              return (
                <div
                  key={i}
                  title={`"${evt.word}" at ${formatDuration(evt.timestamp - metrics.startTime)}`}
                  className="absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-rose-500 border border-rose-300 shadow-sm"
                  style={{ left: `calc(${pct}% - 5px)` }}
                />
              );
            })}
            {/* Start / End labels */}
            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-stone-400 font-mono">0:00</span>
            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-stone-400 font-mono">{formatDuration(duration)}</span>
          </div>
        </div>
      )}

      {/* ── Talking Points Coverage ───────────────────────────────────── */}
      {talkingPoints.length > 0 && (
        <div className="mb-6 w-full">
          <div className="flex items-baseline justify-between mb-3">
            <div className="text-stone-400 text-xs tracking-widest uppercase">Points Covered</div>
            <div className="text-xs font-mono text-stone-500">
              {coveredCount}/{talkingPoints.length}
            </div>
          </div>
          <ul className="space-y-2">
            {pointsCoverage.map((pt, i) => (
              <li
                key={i}
                className={`flex items-start gap-2 rounded-lg border p-3 text-sm ${
                  pt.covered
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    : 'bg-white border-stone-200 text-stone-500'
                }`}
              >
                {pt.covered ? (
                  <Check className="w-4 h-4 mt-0.5 text-emerald-500 shrink-0" />
                ) : (
                  <X className="w-4 h-4 mt-0.5 text-stone-300 shrink-0" />
                )}
                <span>{pt.text}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ── Coach Debrief ─────────────────────────────────────────────── */}
      <div className="mb-8 text-center w-full">
        <div className="text-stone-400 text-xs tracking-widest uppercase mb-4">Coach Debrief</div>
        <div className="min-h-[120px] flex items-center justify-center bg-white border border-stone-200 rounded-lg p-6">
          {debriefText ? (
            <p className="text-xl serif italic text-stone-800 leading-relaxed">"{debriefText}"</p>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <div className="w-6 h-6 border-2 border-stone-300 border-t-stone-600 rounded-full animate-spin" />
              <p className="text-sm text-stone-500">Analyzing your session...</p>
            </div>
          )}
        </div>
      </div>

      {/* ── Actions ───────────────────────────────────────────────────── */}
      <div className="flex gap-6 mb-8">
        <button
          onClick={onReset}
          className="flex items-center gap-2 px-5 py-2.5 bg-stone-900 text-white rounded-lg hover:bg-stone-800 transition-colors text-sm font-medium"
        >
          <Home className="w-4 h-4" /> Home
        </button>
        <button
          onClick={onPracticeAgain ?? onReset}
          className="flex items-center gap-2 px-5 py-2.5 border border-stone-300 rounded-lg hover:bg-stone-100 transition-colors text-sm font-medium text-stone-700"
        >
          <RotateCcw className="w-4 h-4" /> Practice Again
        </button>
      </div>
    </FadeTransition>
  );
};
