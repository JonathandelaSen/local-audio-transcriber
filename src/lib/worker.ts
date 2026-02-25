import { pipeline, env } from "@huggingface/transformers";

// Configurations for Transformers.js
env.allowLocalModels = false;
env.useBrowserCache = true;

class PipelineSingleton {
  static task = "automatic-speech-recognition" as const;
  static model = "Xenova/whisper-tiny";
  static instance: any = null;

  static async getInstance(progress_callback: any) {
    if (this.instance === null) {
      const device = (navigator as any).gpu ? "webgpu" : "wasm";
      
      // Use FP32 for WebGPU/WASM compatibility
      this.instance = await pipeline(this.task, this.model, {
        progress_callback,
        device,
        dtype: {
          encoder_model: "fp32",
          decoder_model_merged: "q4",
        },
      });
    }
    return this.instance;
  }
}

self.addEventListener("message", async (event) => {
  const { type, audio, duration, language } = event.data;
  
  if (type === "transcribe") {
    try {
      const transcriber = await PipelineSingleton.getInstance((x: any) => {
        self.postMessage({ status: "progress", data: x });
      });

      self.postMessage({ status: "ready" });
      self.postMessage({ status: "info", message: `Starting transcription of ${Math.round(duration)}s audio on ${(navigator as any).gpu ? "WebGPU" : "WASM"}.` });

      // Transformers.js chunking jump is (chunk_length - 2 * stride_length)
      const jump = 30 - (2 * 5); // 20s
      const totalChunks = Math.ceil(duration / jump); 
      let chunksProcessed = 0;
      
      // Monkey-patch generate to track chunk progress
      if (!transcriber.model._original_generate) {
        transcriber.model._original_generate = transcriber.model.generate;
      }
      transcriber.model.generate = async function (...args: any[]) {
        const result = await transcriber.model._original_generate.apply(this, args);
        chunksProcessed++;
        self.postMessage({
          status: "chunk_progress",
          progress: Math.min(100, Math.round((chunksProcessed / totalChunks) * 100)),
        });
        return result;
      };

      const options: any = {
        task: "transcribe",
        chunk_length_s: 30,
        stride_length_s: 5,
        return_timestamps: true,
      };

      if (language) {
        options.language = language;
      }

      const output = await transcriber(audio, options);

      // output is usually an object or an array of objects.
      const detectedLanguage =
        (Array.isArray(output) && output[0]?.language ? output[0].language : output?.language) || language || "unknown";
      self.postMessage({ status: "info", message: `Transcription complete. Language: ${detectedLanguage}` });

      self.postMessage({ status: "complete", output });
    } catch (error: any) {
      self.postMessage({ status: "error", error: error?.message || String(error) });
    }
  }
});
