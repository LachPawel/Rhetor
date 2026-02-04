/**
 * Filler Word Detector
 * 
 * Real-time detection of filler words in transcribed speech.
 * Uses regex patterns to identify common fillers and hesitation markers.
 */

import EventEmitter from 'eventemitter3';

// ============================================================================
// TYPES
// ============================================================================

export interface FillerDetection {
  word: string;
  normalizedWord: string;
  category: FillerCategory;
  position: number;
  timestamp: number;
}

export type FillerCategory = 
  | 'hesitation'      // um, uh, er, ah
  | 'filler_word'     // like, basically, actually, literally
  | 'hedge'           // you know, I mean, kind of, sort of
  | 'discourse'       // so, right, okay, well
  | 'repetition'      // repeated words/phrases
  | 'verbal_pause';   // drawn out sounds (uhhhhh)

export interface FillerStats {
  total: number;
  byCategory: Record<FillerCategory, number>;
  byWord: Record<string, number>;
  fillerRate: number; // fillers per 100 words
  recentFillers: FillerDetection[];
}

export interface FillerDetectorEvents {
  filler: (detection: FillerDetection) => void;
  stats: (stats: FillerStats) => void;
}

// ============================================================================
// FILLER PATTERNS
// ============================================================================

// Hesitation sounds (most common fillers)
const HESITATION_PATTERNS = [
  /\b(u+h+m*)\b/gi,           // um, uhm, uhhm, ummm
  /\b(u+h+)\b/gi,              // uh, uhh, uhhh
  /\b(e+r+m*)\b/gi,            // er, erm, errm
  /\b(a+h+)\b/gi,              // ah, ahh, ahhh
  /\b(e+h+)\b/gi,              // eh, ehh
  /\b(m+h+m+)\b/gi,            // mhm, mmhm
  /\b(h+m+)\b/gi,              // hm, hmm, hmmm
];

// Common filler words
const FILLER_WORD_PATTERNS = [
  /\b(like)\b/gi,              // "I was like..."
  /\b(basically)\b/gi,
  /\b(actually)\b/gi,
  /\b(literally)\b/gi,
  /\b(obviously)\b/gi,
  /\b(essentially)\b/gi,
  /\b(totally)\b/gi,
  /\b(honestly)\b/gi,
  /\b(whatever)\b/gi,
];

// Hedge phrases
const HEDGE_PATTERNS = [
  /\b(you know)\b/gi,
  /\b(i mean)\b/gi,
  /\b(kind of)\b/gi,
  /\b(kinda)\b/gi,
  /\b(sort of)\b/gi,
  /\b(sorta)\b/gi,
  /\b(i guess)\b/gi,
  /\b(i think)\b/gi,            // Can be valid, but often filler
  /\b(i suppose)\b/gi,
  /\b(maybe)\b/gi,              // Context-dependent
];

// Discourse markers (often valid, but can be overused)
const DISCOURSE_PATTERNS = [
  /\b(so)\b/gi,                 // At start of sentences
  /\b(right)\b/gi,              // "Right, so..."
  /\b(okay)\b/gi,
  /\b(well)\b/gi,               // "Well, I think..."
  /\b(anyway)\b/gi,
  /\b(anyways)\b/gi,
];

// ============================================================================
// FILLER DETECTOR CLASS
// ============================================================================

export class FillerDetector extends EventEmitter<FillerDetectorEvents> {
  private lastProcessedText: string = '';
  private lastProcessedLength: number = 0;
  private detections: FillerDetection[] = [];
  private wordCount: number = 0;
  private enabled: boolean = true;
  
  // Configuration
  private config = {
    // Threshold for considering discourse markers as fillers
    // (only flag if they appear frequently)
    discourseThreshold: 3,
    // Minimum gap between same filler to not double-count
    minGapMs: 500,
    // How many recent fillers to track
    recentWindow: 10,
  };

  constructor(config?: Partial<typeof FillerDetector.prototype.config>) {
    super();
    if (config) {
      this.config = { ...this.config, ...config };
    }
  }

  /**
   * Process new transcript text and detect fillers
   */
  processTranscript(fullTranscript: string): FillerDetection[] {
    if (!this.enabled) return [];
    
    const newDetections: FillerDetection[] = [];
    
    // Only process new text (incremental detection)
    const newText = fullTranscript.slice(this.lastProcessedLength);
    const startPosition = this.lastProcessedLength;
    
    if (newText.length === 0) return [];
    
    // Update word count
    const newWords = newText.split(/\s+/).filter(Boolean);
    this.wordCount += newWords.length;
    
    // Check hesitation sounds
    newDetections.push(...this.findMatches(newText, HESITATION_PATTERNS, 'hesitation', startPosition));
    
    // Check filler words
    newDetections.push(...this.findMatches(newText, FILLER_WORD_PATTERNS, 'filler_word', startPosition));
    
    // Check hedges
    newDetections.push(...this.findMatches(newText, HEDGE_PATTERNS, 'hedge', startPosition));
    
    // Check discourse markers (with frequency threshold)
    const discourseMatches = this.findMatches(newText, DISCOURSE_PATTERNS, 'discourse', startPosition);
    // Only include discourse markers if they've been detected multiple times
    const discourseByWord = new Map<string, number>();
    for (const d of [...this.detections, ...discourseMatches].filter(x => x.category === 'discourse')) {
      const count = discourseByWord.get(d.normalizedWord) || 0;
      discourseByWord.set(d.normalizedWord, count + 1);
    }
    for (const match of discourseMatches) {
      if ((discourseByWord.get(match.normalizedWord) || 0) >= this.config.discourseThreshold) {
        newDetections.push(match);
      }
    }
    
    // Check for verbal pauses (extended sounds)
    newDetections.push(...this.detectVerbalPauses(newText, startPosition));
    
    // Check for repetitions
    newDetections.push(...this.detectRepetitions(newText, startPosition));
    
    // Filter duplicates by position
    const uniqueDetections = this.deduplicateDetections(newDetections);
    
    // Add to history
    this.detections.push(...uniqueDetections);
    
    // Emit events for each detection
    for (const detection of uniqueDetections) {
      this.emit('filler', detection);
    }
    
    // Emit updated stats
    if (uniqueDetections.length > 0) {
      this.emit('stats', this.getStats());
    }
    
    // Update tracking
    this.lastProcessedText = fullTranscript;
    this.lastProcessedLength = fullTranscript.length;
    
    return uniqueDetections;
  }

  /**
   * Find pattern matches in text
   */
  private findMatches(
    text: string,
    patterns: RegExp[],
    category: FillerCategory,
    startOffset: number
  ): FillerDetection[] {
    const detections: FillerDetection[] = [];
    const now = Date.now();
    
    for (const pattern of patterns) {
      // Reset lastIndex for global patterns
      pattern.lastIndex = 0;
      
      let match;
      while ((match = pattern.exec(text)) !== null) {
        const word = match[0];
        const normalizedWord = match[1]?.toLowerCase() || word.toLowerCase();
        
        // Check minimum gap to avoid double-counting
        const recentSame = this.detections
          .filter(d => d.normalizedWord === normalizedWord)
          .sort((a, b) => b.timestamp - a.timestamp)[0];
        
        if (recentSame && now - recentSame.timestamp < this.config.minGapMs) {
          continue;
        }
        
        detections.push({
          word,
          normalizedWord,
          category,
          position: startOffset + match.index,
          timestamp: now,
        });
      }
    }
    
    return detections;
  }

  /**
   * Detect extended verbal pauses (uhhhhhhh, soooooo)
   */
  private detectVerbalPauses(text: string, startOffset: number): FillerDetection[] {
    const detections: FillerDetection[] = [];
    const now = Date.now();
    
    // Pattern for extended vowels/sounds (3+ repetitions)
    const extendedPattern = /\b([aeiou])\1{2,}\b/gi;
    
    let match;
    while ((match = extendedPattern.exec(text)) !== null) {
      detections.push({
        word: match[0],
        normalizedWord: match[1].toLowerCase(),
        category: 'verbal_pause',
        position: startOffset + match.index,
        timestamp: now,
      });
    }
    
    return detections;
  }

  /**
   * Detect word/phrase repetitions
   */
  private detectRepetitions(text: string, startOffset: number): FillerDetection[] {
    const detections: FillerDetection[] = [];
    const now = Date.now();
    
    // Pattern for repeated words (the the, I I, we we)
    const repetitionPattern = /\b(\w+)\s+\1\b/gi;
    
    let match;
    while ((match = repetitionPattern.exec(text)) !== null) {
      // Exclude intentional repetitions (very very, really really)
      const word = match[1].toLowerCase();
      if (['very', 'really', 'so'].includes(word)) continue;
      
      detections.push({
        word: match[0],
        normalizedWord: `${word} ${word}`,
        category: 'repetition',
        position: startOffset + match.index,
        timestamp: now,
      });
    }
    
    return detections;
  }

  /**
   * Remove duplicate detections at same position
   */
  private deduplicateDetections(detections: FillerDetection[]): FillerDetection[] {
    const seen = new Set<number>();
    return detections.filter(d => {
      if (seen.has(d.position)) return false;
      seen.add(d.position);
      return true;
    });
  }

  /**
   * Get current statistics
   */
  getStats(): FillerStats {
    const byCategory: Record<FillerCategory, number> = {
      hesitation: 0,
      filler_word: 0,
      hedge: 0,
      discourse: 0,
      repetition: 0,
      verbal_pause: 0,
    };
    
    const byWord: Record<string, number> = {};
    
    for (const detection of this.detections) {
      byCategory[detection.category]++;
      byWord[detection.normalizedWord] = (byWord[detection.normalizedWord] || 0) + 1;
    }
    
    const total = this.detections.length;
    const fillerRate = this.wordCount > 0 
      ? Math.round((total / this.wordCount) * 100 * 10) / 10 
      : 0;
    
    const recentFillers = this.detections
      .slice(-this.config.recentWindow)
      .reverse();
    
    return {
      total,
      byCategory,
      byWord,
      fillerRate,
      recentFillers,
    };
  }

  /**
   * Get most common fillers
   */
  getMostCommon(limit: number = 5): Array<{ word: string; count: number; category: FillerCategory }> {
    const counts = new Map<string, { count: number; category: FillerCategory }>();
    
    for (const detection of this.detections) {
      const existing = counts.get(detection.normalizedWord);
      if (existing) {
        existing.count++;
      } else {
        counts.set(detection.normalizedWord, { count: 1, category: detection.category });
      }
    }
    
    return Array.from(counts.entries())
      .map(([word, data]) => ({ word, ...data }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  }

  /**
   * Reset detector state
   */
  reset(): void {
    this.lastProcessedText = '';
    this.lastProcessedLength = 0;
    this.detections = [];
    this.wordCount = 0;
  }

  /**
   * Enable/disable detection
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  /**
   * Get total filler count
   */
  getTotalFillers(): number {
    return this.detections.length;
  }

  /**
   * Get all detections
   */
  getAllDetections(): FillerDetection[] {
    return [...this.detections];
  }

  /**
   * Get word count
   */
  getWordCount(): number {
    return this.wordCount;
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let fillerDetectorInstance: FillerDetector | null = null;

export function getFillerDetector(): FillerDetector {
  if (!fillerDetectorInstance) {
    fillerDetectorInstance = new FillerDetector();
  }
  return fillerDetectorInstance;
}

export function resetFillerDetector(): void {
  if (fillerDetectorInstance) {
    fillerDetectorInstance.reset();
  }
  fillerDetectorInstance = null;
}

// ============================================================================
// REACT HOOK
// ============================================================================

import { useEffect, useState, useCallback, useRef } from 'react';

export function useFillerDetector() {
  const [stats, setStats] = useState<FillerStats>({
    total: 0,
    byCategory: {
      hesitation: 0,
      filler_word: 0,
      hedge: 0,
      discourse: 0,
      repetition: 0,
      verbal_pause: 0,
    },
    byWord: {},
    fillerRate: 0,
    recentFillers: [],
  });
  const [lastFiller, setLastFiller] = useState<FillerDetection | null>(null);
  const detectorRef = useRef<FillerDetector | null>(null);

  useEffect(() => {
    const detector = getFillerDetector();
    detectorRef.current = detector;

    const handleFiller = (detection: FillerDetection) => {
      setLastFiller(detection);
      // Clear last filler indicator after animation
      setTimeout(() => setLastFiller(null), 1500);
    };

    const handleStats = (newStats: FillerStats) => {
      setStats(newStats);
    };

    detector.on('filler', handleFiller);
    detector.on('stats', handleStats);

    return () => {
      detector.off('filler', handleFiller);
      detector.off('stats', handleStats);
    };
  }, []);

  const processTranscript = useCallback((text: string) => {
    return detectorRef.current?.processTranscript(text) || [];
  }, []);

  const reset = useCallback(() => {
    detectorRef.current?.reset();
    setStats({
      total: 0,
      byCategory: {
        hesitation: 0,
        filler_word: 0,
        hedge: 0,
        discourse: 0,
        repetition: 0,
        verbal_pause: 0,
      },
      byWord: {},
      fillerRate: 0,
      recentFillers: [],
    });
    setLastFiller(null);
  }, []);

  const getMostCommon = useCallback((limit?: number) => {
    return detectorRef.current?.getMostCommon(limit) || [];
  }, []);

  return {
    stats,
    lastFiller,
    processTranscript,
    reset,
    getMostCommon,
  };
}
