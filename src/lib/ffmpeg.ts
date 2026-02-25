import { FFmpeg } from '@ffmpeg/ffmpeg';
import { toBlobURL } from '@ffmpeg/util';

let ffmpeg: FFmpeg | null = null;
let isReady = false;

export async function getFFmpeg() {
  if (ffmpeg && isReady) return ffmpeg;
  
  ffmpeg = new FFmpeg();
  
  ffmpeg.on('log', ({ message }) => {
    if (process.env.NEXT_PUBLIC_ENABLE_LOGS === "true") {
      console.log('[FFmpeg]', message);
    }
  });
  
  const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd';
  await ffmpeg.load({
    coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
    wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
  });
  
  isReady = true;
  return ffmpeg;
}

export async function extractAudioWithFFmpeg(file: File, onProgress?: (p: number) => void): Promise<Float32Array> {
  const ff = await getFFmpeg();
  
  const progressHandler = ({ progress, time }: { progress: number, time: number }) => {
    if (onProgress) onProgress(progress);
  };
  
  ff.on('progress', progressHandler);
  
  const mntDir = `/mnt_${Date.now()}`;
  const outputName = `output_${Date.now()}.wav`;

  try {
    // Mount the large file using zero-copy WORKERFS
    await ff.createDir(mntDir);
    await ff.mount('WORKERFS' as any, { files: [file] }, mntDir);

    // Run FFmpeg to extract audio as 16kHz mono WAV
    await ff.exec([
      '-i', `${mntDir}/${file.name}`,
      '-ar', '16000',
      '-ac', '1',
      '-f', 'wav',
      outputName
    ]);

    // Read the resulting small WAV file into memory
    const data = await ff.readFile(outputName);
    
    // Cleanup generated file
    await ff.deleteFile(outputName);
    
    // Decode the WAV file using Native AudioContext
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
      sampleRate: 16000,
    });
    
    const arrayBuffer = (data as Uint8Array).buffer as ArrayBuffer;
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    
    return audioBuffer.getChannelData(0);
  } finally {
    // Always cleanup mounts and listeners
    try {
      await ff.unmount(mntDir);
      await ff.deleteDir(mntDir);
    } catch (e) {
      console.error("Cleanup mount error", e);
    }
    ff.off('progress', progressHandler);
  }
}
