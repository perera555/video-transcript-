// On-device speech recognition (Whisper) running in a Web Worker.
// Uses WebGPU when available, otherwise WebAssembly. Models are downloaded
// once from the Hugging Face Hub and cached by the browser.
import { pipeline, env } from "https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1";

env.allowLocalModels = false;

let transcriber = null;
let loadedKey = "";

async function hasWebGPU() {
  try {
    if (!self.navigator?.gpu) return false;
    const adapter = await self.navigator.gpu.requestAdapter();
    return !!adapter;
  } catch {
    return false;
  }
}

async function load(model) {
  const webgpu = await hasWebGPU();
  const key = `${model}|${webgpu}`;
  if (transcriber && loadedKey === key) return webgpu;
  transcriber = null;
  const options = {
    device: webgpu ? "webgpu" : "wasm",
    dtype: webgpu ? { encoder_model: "fp32", decoder_model_merged: "q4" } : "q8",
    progress_callback: (p) => {
      if (p.status === "progress") {
        self.postMessage({ type: "download", file: p.file, loaded: p.loaded, total: p.total, progress: p.progress });
      }
    },
  };
  try {
    transcriber = await pipeline("automatic-speech-recognition", model, options);
  } catch (err) {
    if (!webgpu) throw err;
    // WebGPU can fail on some drivers — fall back to WASM.
    transcriber = await pipeline("automatic-speech-recognition", model, { ...options, device: "wasm", dtype: "q8" });
  }
  loadedKey = key;
  return webgpu;
}

self.onmessage = async (e) => {
  const msg = e.data;
  try {
    if (msg.type === "load") {
      const webgpu = await load(msg.model);
      self.postMessage({ type: "ready", device: webgpu ? "webgpu" : "wasm" });
    } else if (msg.type === "transcribe") {
      await load(msg.model);
      const opts = {
        chunk_length_s: 30,
        stride_length_s: 5,
        return_timestamps: true,
        task: msg.task || "transcribe",
      };
      if (msg.language && msg.language !== "auto") opts.language = msg.language;
      const out = await transcriber(msg.audio, opts);
      const segments = (out.chunks || []).map((c) => ({
        start: c.timestamp?.[0] ?? 0,
        end: c.timestamp?.[1] ?? null,
        text: c.text,
      }));
      self.postMessage({ type: "result", id: msg.id, segments, text: out.text });
    }
  } catch (err) {
    self.postMessage({ type: "error", id: msg.id, message: String(err?.message || err) });
  }
};
