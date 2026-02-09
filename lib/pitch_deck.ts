import type { PitchDeckAsset } from '../stores/useRhetorStore';
import * as JSZip from 'jszip';
import { pptxToHtml } from '@jvmr/pptx-to-html';

const PDF_MIME_TYPE = 'application/pdf';
const PPT_MIME_TYPE = 'application/vnd.ms-powerpoint';
const PPTX_MIME_TYPE = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
const POWERPOINT_MIME_TYPES = new Set([
  PPT_MIME_TYPE,
  PPTX_MIME_TYPE,
]);
const PDF_EXTENSION_REGEX = /\.pdf$/i;
const POWERPOINT_EXTENSION_REGEX = /\.pptx?$/i;
const PPTX_EXTENSION_REGEX = /\.pptx$/i;
const IMAGE_EXTENSION_REGEX = /\.(png|jpe?g|gif|webp|bmp|svg)$/i;
const PPTX_SLIDE_PATH_REGEX = /^ppt\/slides\/slide(\d+)\.xml$/i;

export const DECK_FILE_ACCEPT =
  'application/pdf,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation,.pdf,.ppt,.pptx,image/*';

const isPowerPointMimeType = (mimeType: string): boolean => POWERPOINT_MIME_TYPES.has(mimeType);

const inferMimeType = (file: File): string => {
  if (file.type) return file.type;
  if (PDF_EXTENSION_REGEX.test(file.name)) return PDF_MIME_TYPE;
  if (POWERPOINT_EXTENSION_REGEX.test(file.name)) {
    return file.name.toLowerCase().endsWith('.ppt') ? PPT_MIME_TYPE : PPTX_MIME_TYPE;
  }
  if (IMAGE_EXTENSION_REGEX.test(file.name)) return 'image/*';
  return 'application/octet-stream';
};

export const isSupportedDeckFile = (file: File): boolean => {
  const mimeType = inferMimeType(file);
  return (
    mimeType === PDF_MIME_TYPE ||
    mimeType.startsWith('image/') ||
    isPowerPointMimeType(mimeType) ||
    PDF_EXTENSION_REGEX.test(file.name) ||
    POWERPOINT_EXTENSION_REGEX.test(file.name) ||
    IMAGE_EXTENSION_REGEX.test(file.name)
  );
};

export const isPdfDeck = (deck: PitchDeckAsset | null | undefined): boolean => {
  if (!deck) return false;
  return deck.mimeType === PDF_MIME_TYPE || PDF_EXTENSION_REGEX.test(deck.fileName);
};

export const isImageDeck = (deck: PitchDeckAsset | null | undefined): boolean => {
  if (!deck) return false;
  return deck.mimeType.startsWith('image/');
};

export const isPowerPointDeck = (deck: PitchDeckAsset | null | undefined): boolean => {
  if (!deck) return false;
  return isPowerPointMimeType(deck.mimeType) || POWERPOINT_EXTENSION_REGEX.test(deck.fileName);
};

export const isPptxDeck = (deck: PitchDeckAsset | null | undefined): boolean => {
  if (!deck) return false;
  return deck.mimeType === PPTX_MIME_TYPE || PPTX_EXTENSION_REGEX.test(deck.fileName);
};

const decodeXmlEntities = (value: string): string => {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;|&#39;/g, "'")
    .replace(/&#(\d+);/g, (_match, dec: string) => String.fromCharCode(Number.parseInt(dec, 10)));
};

const extractSlideTextFromXml = (xml: string): string => {
  const paragraphs = xml.match(/<a:p[\s\S]*?<\/a:p>/g) ?? [];
  const normalized = paragraphs
    .map((paragraph) => {
      const runs = Array.from(paragraph.matchAll(/<a:t[^>]*>([\s\S]*?)<\/a:t>/g))
        .map((match) => decodeXmlEntities(match[1] ?? '').replace(/\s+/g, ' ').trim())
        .filter((value) => value.length > 0);
      return runs.join(' ').trim();
    })
    .filter((value) => value.length > 0);

  // Fallback for uncommon slide markup with no <a:p> wrapper.
  if (normalized.length === 0) {
    const fallbackRuns = Array.from(xml.matchAll(/<a:t[^>]*>([\s\S]*?)<\/a:t>/g))
      .map((match) => decodeXmlEntities(match[1] ?? '').replace(/\s+/g, ' ').trim())
      .filter((value) => value.length > 0);
    return fallbackRuns.join(' ').trim();
  }

  return normalized.join('\n');
};

const parseSlideNumber = (path: string): number => {
  const match = path.match(PPTX_SLIDE_PATH_REGEX);
  return Number.parseInt(match?.[1] ?? '0', 10);
};

const extractPptxSlidesFromBuffer = async (raw: ArrayBuffer): Promise<string[] | null> => {
  try {
    const zip = await JSZip.loadAsync(raw);

    const slidePaths = Object.keys(zip.files)
      .filter((path) => PPTX_SLIDE_PATH_REGEX.test(path))
      .sort((left, right) => parseSlideNumber(left) - parseSlideNumber(right));

    if (slidePaths.length === 0) {
      return null;
    }

    const slideTexts: string[] = [];
    for (const path of slidePaths) {
      const entry = zip.file(path);
      if (!entry) {
        slideTexts.push('');
        continue;
      }
      const xml = await entry.async('text');
      slideTexts.push(extractSlideTextFromXml(xml));
    }

    return slideTexts;
  } catch (error) {
    console.warn('[pitch_deck] Could not parse PPTX slides:', error);
    return null;
  }
};

interface PptxRenderOptions {
  width?: number;
  height?: number;
  scaleToFit?: boolean;
  letterbox?: boolean;
}

export const renderPptxSlidesFromBuffer = async (
  raw: ArrayBuffer,
  options?: PptxRenderOptions,
): Promise<string[] | null> => {
  try {
    const slides = await pptxToHtml(raw, {
      width: options?.width ?? 1280,
      height: options?.height ?? 720,
      scaleToFit: options?.scaleToFit ?? true,
      letterbox: options?.letterbox ?? true,
    });
    return Array.isArray(slides) && slides.length > 0 ? slides : null;
  } catch (error) {
    console.warn('[pitch_deck] Could not render PPTX HTML slides:', error);
    return null;
  }
};

const estimatePdfSlideCountFromBuffer = async (raw: ArrayBuffer): Promise<number | null> => {
  try {
    const text = new TextDecoder('latin1').decode(new Uint8Array(raw));

    const declaredCounts = Array.from(text.matchAll(/\/Count\s+(\d+)/g))
      .map((match) => Number.parseInt(match[1] ?? '', 10))
      .filter((value) => Number.isFinite(value) && value > 0);

    const fromDeclaredCount = declaredCounts.length > 0 ? Math.max(...declaredCounts) : 0;
    const fromPageObjects = (text.match(/\/Type\s*\/Page\b/g) ?? []).length;

    const estimated = Math.max(fromDeclaredCount, fromPageObjects);
    return estimated > 0 ? estimated : null;
  } catch (error) {
    console.warn('[pitch_deck] Could not estimate PDF page count:', error);
    return null;
  }
};

export async function createPitchDeckAsset(file: File): Promise<PitchDeckAsset> {
  const mimeType = inferMimeType(file);
  const isPdf = mimeType === PDF_MIME_TYPE || PDF_EXTENSION_REGEX.test(file.name);
  const isPptx = mimeType === PPTX_MIME_TYPE || PPTX_EXTENSION_REGEX.test(file.name);
  const raw = isPdf || isPptx ? await file.arrayBuffer() : null;
  const slideTexts = isPptx && raw ? await extractPptxSlidesFromBuffer(raw) : null;
  const totalSlides = isPdf
    ? (raw ? await estimatePdfSlideCountFromBuffer(raw) : null)
    : slideTexts && slideTexts.length > 0
      ? slideTexts.length
      : mimeType.startsWith('image/')
      ? 1
      : null;

  const extractedText = slideTexts
    ? slideTexts
        .map((slideText, index) => slideText.trim() ? `Slide ${index + 1}: ${slideText.trim()}` : `Slide ${index + 1}:`)
        .join('\n\n')
        .trim()
    : undefined;

  return {
    fileName: file.name,
    mimeType,
    objectUrl: URL.createObjectURL(file),
    totalSlides,
    uploadedAt: Date.now(),
    slideTexts: slideTexts ?? undefined,
    extractedText: extractedText || undefined,
  };
}

export function disposePitchDeckAsset(deck: PitchDeckAsset | null | undefined): void {
  if (!deck) return;
  try {
    URL.revokeObjectURL(deck.objectUrl);
  } catch (error) {
    console.warn('[pitch_deck] Could not revoke object URL:', error);
  }
}

export function buildDeckPreviewUrl(deck: PitchDeckAsset, slideNumber: number): string {
  if (!isPdfDeck(deck)) return deck.objectUrl;
  const safeSlide = Math.max(1, Math.floor(slideNumber));
  return `${deck.objectUrl}#page=${safeSlide}&view=FitH`;
}
