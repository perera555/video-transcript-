// Proxies one audio window to Groq's free Whisper large-v3 API.
// The key comes from the GROQ_API_KEY env var, or the user's own key header.
export const maxDuration = 60;

const ALLOWED_MODELS = new Set(["whisper-large-v3", "whisper-large-v3-turbo"]);

export async function POST(req: Request) {
  const key = req.headers.get("x-groq-key") || process.env.GROQ_API_KEY;
  if (!key) {
    return Response.json(
      { error: "Cloud mode needs a free Groq API key. Add one in Settings, or switch to On-device mode." },
      { status: 401 }
    );
  }

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof Blob)) return Response.json({ error: "No audio received" }, { status: 400 });

  const task = form.get("task") === "translate" ? "translate" : "transcribe";
  let model = String(form.get("model") || "whisper-large-v3-turbo");
  if (!ALLOWED_MODELS.has(model)) model = "whisper-large-v3-turbo";
  // Groq's translation endpoint only supports the full large-v3 model.
  if (task === "translate") model = "whisper-large-v3";

  const out = new FormData();
  out.append("file", file, "audio.mp3");
  out.append("model", model);
  out.append("response_format", "verbose_json");
  out.append("temperature", "0");
  const language = form.get("language");
  if (language && task === "transcribe") out.append("language", String(language));

  const url = `https://api.groq.com/openai/v1/audio/${task === "translate" ? "translations" : "transcriptions"}`;
  const res = await fetch(url, { method: "POST", headers: { Authorization: `Bearer ${key}` }, body: out });

  if (!res.ok) {
    const text = await res.text();
    let message = `Groq error ${res.status}`;
    try { message = JSON.parse(text).error?.message || message; } catch {}
    const headers: Record<string, string> = {};
    const retry = res.headers.get("retry-after");
    if (retry) headers["retry-after"] = retry;
    if (res.status === 401) message = "Invalid Groq API key. Check it in Settings.";
    return Response.json({ error: message }, { status: res.status, headers });
  }

  const data = await res.json();
  return Response.json({
    text: data.text,
    language: data.language,
    segments: (data.segments || []).map((s: { start: number; end: number; text: string }) => ({
      start: s.start, end: s.end, text: s.text,
    })),
  });
}
