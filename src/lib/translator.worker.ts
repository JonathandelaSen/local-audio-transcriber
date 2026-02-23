import { pipeline, env } from "@huggingface/transformers";

// Configurations for Transformers.js
env.allowLocalModels = false;
env.useBrowserCache = true;

class TranslatorSingleton {
  static task = "translation" as const;
  static instances: any = {};

  static async getInstance(src: string, tgt: string, progress_callback: any) {
    const modelName = `Xenova/opus-mt-${src}-${tgt}`;
    
    if (!this.instances[modelName]) {
      this.instances[modelName] = await pipeline(this.task, modelName, {
        progress_callback,
        device: "wasm",
        dtype: "q4",
      });
    }
    return this.instances[modelName];
  }
}

self.addEventListener("message", async (event) => {
  const { type, chunks, sourceLanguage, targetLanguage } = event.data;
  
  if (type === "translate") {
    try {
      const translator = await TranslatorSingleton.getInstance(sourceLanguage, targetLanguage, (x: any) => {
        self.postMessage({ status: "progress", data: x });
      });

      self.postMessage({ status: "ready" });
      
      const totalChunks = chunks.length;
      let chunksProcessed = 0;
      const translatedChunks = [];

      for (const chunk of chunks) {
        // opus-mt translates implicitly based on the loaded model
        const output = await translator(chunk.text);
        
        translatedChunks.push({
          ...chunk,
          text: output[0].translation_text,
        });
        
        chunksProcessed++;
        self.postMessage({
          status: "chunk_progress",
          progress: Math.min(100, Math.round((chunksProcessed / totalChunks) * 100)),
        });
      }

      self.postMessage({ status: "complete", output: translatedChunks });
    } catch (error: any) {
      self.postMessage({ status: "error", error: error?.message || String(error) });
    }
  }
});
