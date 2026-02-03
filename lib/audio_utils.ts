
export function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export function floatTo16BitPCM(input: Float32Array): Int16Array {
  const output = new Int16Array(input.length);
  for (let i = 0; i < input.length; i++) {
    const s = Math.max(-1, Math.min(1, input[i]));
    output[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
  }
  return output;
}

export function pcmToGenAIBlob(data: Int16Array, sampleRate: number): { data: string, mimeType: string } {
    const base64 = arrayBufferToBase64(data.buffer);
    return {
        data: base64,
        mimeType: `audio/pcm;rate=${sampleRate}`
    };
}

export async function decodeAudioData(
  data: ArrayBuffer,
  ctx: AudioContext,
  sampleRate: number = 24000,
  numChannels: number = 1,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data);
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

export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      if (result && typeof result === 'string' && result.includes(',')) {
          resolve(result.split(',')[1]);
      } else {
          resolve("");
      }
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export const audioContext = async (options?: AudioContextOptions): Promise<AudioContext> => {
  const ctx = new (window.AudioContext || (window as any).webkitAudioContext)(options);
  if (ctx.state === 'suspended') {
      await ctx.resume();
  }
  return ctx;
};
