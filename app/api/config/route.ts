// Tells the client whether the site owner has configured a shared Groq key.
export async function GET() {
  return Response.json({ serverKey: Boolean(process.env.GROQ_API_KEY) });
}
