# Neural Whisper (Local Audio Transcriber)

<div align="center">
  <img src="./docs/main-screen.png" alt="Main Screen" width="30%" /> <!-- Replace with main screen screenshot -->
  <img src="./docs/results-screen.png" alt="Results Screen" width="30%" /> <!-- Replace with transcription results screenshot -->
  <img src="./docs/history-screen.png" alt="History Page" width="30%" /> <!-- Replace with history page screenshot -->
</div>

A modern, privacy-first web application built with [Next.js](https://nextjs.org) that allows users to seamlessly drag and drop audio files and receive highly accurate transcriptions in Spanish.

The application leverages a local Web Worker and client-side processing via Transformers.js to ensure efficient, private, and fast transcription directly on your device using WebGPU or WASM.

**[Watch a video demo here](./docs/demo.mp4)** <!-- Replace with link to demo video -->

## Key Features

- 🔒 **100% Private (Local Processing)**: Audio transcription is handled directly in your browser. No data is ever sent to a remote server or API. Fast, secure, and zero server-side costs.
- 🇪🇸 **Optimized for Spanish**: Specifically configured to transcribe audio content in Spanish with high accuracy.
- ⚡ **Real-time Progress**: View the transcription status and partial results live while the neural model is processing.
- ⏸️ **Cancellable Jobs**: Safely stop processing large files mid-way using the Stop Transcription button.
- 🗃️ **Persistent History**: Your past transcriptions are automatically saved to `localStorage` so you can review them after refreshing or returning to the app later.
- 💾 **Export & Downloads**: Download your generated transcripts as plain text (`.txt`) or as SubRip Subtitles (`.srt`) out of the box. Both features are available inline and in the History tab.
- 📋 **One-Click Copying**: Easily copy full transcripts or subtitles with integrated clipboard buttons.

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Styling**: Tailwind CSS & shadcn/ui
- **Icons**: Lucide React
- **ML Engine**: Hugging Face Transformers.js (Whisper model)
- **State/Persistence**: React Hooks & LocalStorage

## Getting Started

First, install the dependencies:

```bash
npm install
# or
yarn install
# or
pnpm install
```

Then, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the application.

## Vibe Coding

This project was intentionally built using an AI-assisted development approach, where the architecture, design, and code were **vibe coded with Gemini Pro 3.1**.

## License

This project is open-source and available under the MIT License.
