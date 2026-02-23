export async function decodeAudio(file: File): Promise<Float32Array> {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
      sampleRate: 16000,
    });
  
    const arrayBuffer = await file.arrayBuffer();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    
    // Whisper requires 16kHz mono audio.
    let audioData = audioBuffer.getChannelData(0);
  
    // Average channels if stereo
    if (audioBuffer.numberOfChannels === 2) {
        const channel2 = audioBuffer.getChannelData(1);
        const length = audioData.length;
        const mono = new Float32Array(length);
        for (let i = 0; i < length; i++) {
            mono[i] = (audioData[i] + channel2[i]) / 2;
        }
        audioData = mono;
    }
  
    return audioData;
  }
