// On-device translation with Meta's NLLB-200 (200 languages incl. Sinhala & Tamil).
import { pipeline, env } from "https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1";

env.allowLocalModels = false;
const MODEL = "Xenova/nllb-200-distilled-600M";
let translator = null;

async function load() {
  if (translator) return;
  translator = await pipeline("translation", MODEL, {
    dtype: "q8",
    progress_callback: (p) => {
      if (p.status === "progress") {
        self.postMessage({ type: "download", file: p.file, loaded: p.loaded, total: p.total, progress: p.progress });
      }
    },
  });
}

self.onmessage = async (e) => {
  const msg = e.data;
  try {
    await load();
    if (msg.type === "translate") {
      const out = await translator(msg.texts, { src_lang: msg.src, tgt_lang: msg.tgt, max_length: 400 });
      const list = Array.isArray(out) ? out : [out];
      self.postMessage({ type: "result", id: msg.id, texts: list.map((o) => o.translation_text) });
    } else {
      self.postMessage({ type: "ready" });
    }
  } catch (err) {
    self.postMessage({ type: "error", id: msg.id, message: String(err?.message || err) });
  }
};
