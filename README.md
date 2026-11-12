# SubtitleAI — Video Transcript & Subtitle Generator

Free AI transcripts, subtitles and audio tools for movies, videos and audio of **any length** (2–4 hour movies welcome).
English, Sinhala (සිංහල), Tamil (தமிழ்), Spanish and 30+ more languages. Installable as an app on Windows, macOS, Linux, Android, iPhone and iPad.

## Features

- **Video Transcript**: editable, searchable transcript. Click a timestamp to jump the video there. ✏️ edit, 🗑 delete, 💾 save.
- **Subtitles**: auto-timed 2-line cues with a live preview on your video. Download SRT or VTT.
- **Listen & Read**: watch or listen while the current line is highlighted. ▶ plays a single line, 🔊 reads text aloud, with 0.75×–1.5× speed.
- **Translate**: subtitles into Sinhala, Tamil, Spanish, Hindi and 30+ languages.
- **Audio**: extract a movie's soundtrack as MP3, WAV or original quality (no re-encode). Includes a voice recorder and live audio level meter.
- **Voice boost**: cleans and levels dialogue so the AI hears speech better.
- **Download everything**: one ZIP, or every file separately (TXT, SRT, VTT, CSV, JSON, MP3).
- **Online & Offline**:
  - *Cloud AI* (Whisper large-v3 on Groq's free tier) is fastest and most accurate.
  - *On-device AI* (Whisper running in your browser via WebGPU/WASM) is private and works without internet once the model has been downloaded.
- **Resume**: stop a long movie at any time and resume later. Your work is saved automatically.

## How to use

1. Open the app and press **Upload video or movie** (or drag & drop into the box).
2. Choose **Cloud AI** or **On-device**, and pick the spoken language (or Auto-detect).
3. Press **Generate transcript & subtitles**. Lines appear live as each part finishes.
4. Edit or translate if needed, then download **SRT / VTT / TXT**, or use **Download all**.

## Run the project on your computer

Requirements: [Node.js](https://nodejs.org) 20 or newer.

```bash
git clone https://github.com/perera555/video-transcript-.git
cd video-transcript-
npm install          # also copies the ffmpeg.wasm worker into public/ffmpeg
npm run dev          # open http://localhost:3000
```

Production build:

```bash
npm run build
npm start
```

### Optional: enable Cloud AI for everyone

Get a free key at <https://console.groq.com/keys> and create `.env.local`:

```
GROQ_API_KEY=gsk_your_key_here
```

Without it, each user can paste their own free key in **Settings**, or use **On-device** mode, which needs no key.

### Optional: tutorial video on the home page

```
NEXT_PUBLIC_GUIDE_VIDEO_URL=https://www.youtube.com/watch?v=XXXXXXXXXXX
```

## Deploy to Vercel

1. Push this repo to GitHub.
2. Go to <https://vercel.com/new>, import the repo and click **Deploy** (the framework is detected automatically).
3. Optional: in *Project → Settings → Environment Variables*, add `GROQ_API_KEY`, then redeploy.

## Install as an app

- **Windows / Mac / Linux (Chrome or Edge):** click **Install App** at the top, or the ⊕ icon in the address bar.
- **Android (Chrome):** tap **Install App**, or go to ⋮ → *Install app*.
- **iPhone / iPad (Safari):** Share → *Add to Home Screen*.

## Tech

Next.js 16 · React 19 · Tailwind CSS 4 · Transformers.js (Whisper, NLLB-200) · ffmpeg.wasm · Groq API · PWA service worker.

---

© 2026 Porage Thamara Dhanushka Perera. All rights reserved.
