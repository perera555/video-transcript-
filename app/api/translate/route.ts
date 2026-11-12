// Translates a batch of subtitle lines with a free Groq-hosted LLM,
// preserving line count so timestamps stay aligned.
export const maxDuration = 60;

const MODEL = "llama-3.3-70b-versatile";

export async function POST(req: Request) {
  const key = req.headers.get("x-groq-key") || process.env.GROQ_API_KEY;
  if (!key) {
    return Response.json(
      { error: "Cloud translation needs a free Groq API key. Add one in Settings, or use On-device translation." },
      { status: 401 }
    );
  }
  const { lines, from, to } = (await req.json()) as { lines: string[]; from: string; to: string };
  if (!Array.isArray(lines) || !lines.length || lines.length > 80) {
    return Response.json({ error: "Send 1–80 lines" }, { status: 400 });
  }

  const numbered = Object.fromEntries(lines.map((l, i) => [String(i + 1), l]));
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            `You are a professional movie subtitle translator. Translate each subtitle line from ${from || "the source language"} to ${to}. ` +
            `Write natural, fluent ${to} in its native script, keep the meaning and tone, keep names unchanged, and keep each line short. ` +
            `Return ONLY a JSON object with exactly the same keys as the input, each value being the translated line.`,
        },
        { role: "user", content: JSON.stringify(numbered) },
      ],
    }),
  });

  if (!res.ok) {
    const headers: Record<string, string> = {};
    const retry = res.headers.get("retry-after");
    if (retry) headers["retry-after"] = retry;
    const msg = res.status === 401 ? "Invalid Groq API key. Check it in Settings." : `Groq error ${res.status}`;
    return Response.json({ error: msg }, { status: res.status, headers });
  }

  const data = await res.json();
  let parsed: Record<string, string> = {};
  try {
    parsed = JSON.parse(data.choices?.[0]?.message?.content || "{}");
  } catch {
    return Response.json({ error: "Translator returned an invalid response" }, { status: 502 });
  }
  return Response.json({ lines: lines.map((l, i) => String(parsed[String(i + 1)] ?? l)) });
}
