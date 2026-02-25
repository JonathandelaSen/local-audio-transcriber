import { FFmpeg } from '@ffmpeg/ffmpeg';

export async function extractAudio(file: File) {
    const ffmpeg = new FFmpeg();
    await ffmpeg.load();
    // try to mount
    console.log("loaded");
}
