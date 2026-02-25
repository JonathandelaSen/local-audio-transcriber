import Link from "next/link";
import {
  ArrowLeft,
  Clapperboard,
  Layers,
  Lightbulb,
  Rocket,
  Sparkles,
  WandSparkles,
} from "lucide-react";

import { Button } from "@/components/ui/button";

export default function CreatorPage() {
  return (
    <main className="min-h-screen px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-[#090909] p-4 sm:p-6 shadow-[0_30px_120px_rgba(0,0,0,0.45)]">
          <div className="pointer-events-none absolute inset-0 opacity-90">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_10%,rgba(251,146,60,0.2),transparent_35%),radial-gradient(circle_at_85%_15%,rgba(34,211,238,0.14),transparent_35%),radial-gradient(circle_at_50%_100%,rgba(250,204,21,0.08),transparent_45%)]" />
            <div className="absolute inset-0 opacity-20 bg-[repeating-linear-gradient(110deg,rgba(255,255,255,0.08)_0px,rgba(255,255,255,0.08)_1px,transparent_1px,transparent_26px)]" />
          </div>

          <div className="relative z-10 flex flex-col gap-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-orange-300/20 bg-orange-400/10 px-3 py-1 text-xs uppercase tracking-[0.24em] text-orange-100/80">
                <Rocket className="h-3.5 w-3.5" />
                Creator Hub
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Link href="/">
                  <Button variant="ghost" className="h-9 rounded-full border border-white/10 bg-white/5 px-4 text-white/85 hover:bg-white/10">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Home
                  </Button>
                </Link>
                <Link href="/history">
                  <Button variant="ghost" className="h-9 rounded-full border border-white/10 bg-white/5 px-4 text-white/85 hover:bg-white/10">
                    <Layers className="mr-2 h-4 w-4" />
                    History
                  </Button>
                </Link>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.3fr_0.7fr]">
              <div className="space-y-4">
                <p className="font-mono text-xs uppercase tracking-[0.28em] text-white/55">
                  Split the workflow. Keep the context clean.
                </p>
                <h1 className="font-black uppercase leading-[0.88] tracking-tight text-white text-5xl sm:text-6xl lg:text-7xl">
                  One Hub.
                  <span className="block text-transparent bg-clip-text bg-gradient-to-r from-orange-200 via-amber-300 to-cyan-200">
                    Two Studios.
                  </span>
                </h1>
                <p className="max-w-3xl text-base sm:text-lg text-white/70 leading-relaxed">
                  Video packaging and shorts production now live on separate pages. The hub is the jump point, not a crowded control panel.
                  Later, we can add cross-tool handoffs that connect a short back to packaging/content generation for that exact cut.
                </p>
              </div>

              <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.03] p-4 sm:p-5 backdrop-blur-xl">
                <div className="font-mono text-[11px] uppercase tracking-[0.24em] text-white/45">Workflow Map</div>
                <div className="mt-4 space-y-3 text-sm">
                  <div className="rounded-xl border border-emerald-300/15 bg-emerald-400/5 p-3 text-emerald-100/90">
                    <div className="font-semibold">1. Video Info Studio</div>
                    <div className="mt-1 text-emerald-100/70">Titles, descriptions, chapters, hooks, SEO, content pack.</div>
                  </div>
                  <div className="rounded-xl border border-orange-300/15 bg-orange-400/5 p-3 text-orange-100/90">
                    <div className="font-semibold">2. Shorts Forge</div>
                    <div className="mt-1 text-orange-100/70">Clip discovery, vertical editor, local MP4 exports, saved shorts lifecycle.</div>
                  </div>
                  <div className="rounded-xl border border-dashed border-cyan-300/20 bg-cyan-400/5 p-3 text-cyan-100/85">
                    <div className="font-semibold">3. Future Bridge</div>
                    <div className="mt-1 text-cyan-100/70">Attach packaging/content generation directly to a selected short.</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_1fr_0.9fr]">
          <article className="relative overflow-hidden rounded-[2rem] border border-emerald-200/15 bg-[#f1fffb] text-zinc-950 shadow-[0_20px_80px_rgba(16,185,129,0.12)]">
            <div className="absolute inset-0 opacity-90">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_88%_12%,rgba(34,211,238,0.18),transparent_40%),radial-gradient(circle_at_10%_90%,rgba(16,185,129,0.16),transparent_45%)]" />
              <div className="absolute inset-0 opacity-20 bg-[repeating-linear-gradient(0deg,rgba(0,0,0,0.18)_0px,rgba(0,0,0,0.18)_1px,transparent_1px,transparent_14px)]" />
            </div>
            <div className="relative z-10 flex h-full flex-col p-5 sm:p-6">
              <div className="mb-4 inline-flex w-fit items-center gap-2 rounded-full border border-emerald-900/15 bg-white/70 px-3 py-1 text-xs uppercase tracking-[0.22em] text-emerald-900/70">
                <Lightbulb className="h-3.5 w-3.5" />
                Video Info Studio
              </div>
                <h2 className="font-black uppercase text-4xl sm:text-5xl leading-[0.9] tracking-tight">
                  Packaging
                  <span className="block text-emerald-700">Without Clip Noise</span>
                </h2>
              <p className="mt-3 text-sm sm:text-base text-zinc-700/85 leading-relaxed">
                Generate only the long-form metadata and content support you need from the transcript, with block-level output control.
              </p>
              <div className="mt-5 grid grid-cols-1 gap-2 text-sm">
                <div className="rounded-xl border border-zinc-900/10 bg-white/70 px-3 py-2">Title ideas + thumbnail hooks</div>
                <div className="rounded-xl border border-zinc-900/10 bg-white/70 px-3 py-2">Descriptions + chapters + pinned comment</div>
                <div className="rounded-xl border border-zinc-900/10 bg-white/70 px-3 py-2">Hashtags/SEO + content pack + insights</div>
              </div>
              <div className="mt-6 flex flex-wrap gap-2">
                <Link href="/creator/video-info">
                  <Button className="rounded-full bg-zinc-950 text-white hover:bg-zinc-800">
                    <WandSparkles className="mr-2 h-4 w-4" />
                    Open Video Info Studio
                  </Button>
                </Link>
              </div>
            </div>
          </article>

          <article className="relative overflow-hidden rounded-[2rem] border border-orange-300/20 bg-[#110b0c] text-white shadow-[0_20px_90px_rgba(251,146,60,0.12)]">
            <div className="absolute inset-0 opacity-95">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_8%,rgba(251,146,60,0.22),transparent_36%),radial-gradient(circle_at_85%_20%,rgba(244,114,182,0.18),transparent_40%),radial-gradient(circle_at_70%_90%,rgba(217,70,239,0.12),transparent_50%)]" />
              <div className="absolute inset-0 opacity-20 bg-[repeating-linear-gradient(135deg,rgba(255,255,255,0.12)_0px,rgba(255,255,255,0.12)_1px,transparent_1px,transparent_20px)]" />
            </div>
            <div className="relative z-10 flex h-full flex-col p-5 sm:p-6">
              <div className="mb-4 inline-flex w-fit items-center gap-2 rounded-full border border-orange-200/15 bg-white/5 px-3 py-1 text-xs uppercase tracking-[0.22em] text-orange-100/85">
                <Clapperboard className="h-3.5 w-3.5" />
                Shorts Forge
              </div>
                <h2 className="font-black uppercase text-4xl sm:text-5xl leading-[0.9] tracking-tight">
                  Vertical
                  <span className="block text-transparent bg-clip-text bg-gradient-to-r from-orange-200 via-rose-200 to-fuchsia-200">
                    Cut Lab
                </span>
              </h2>
              <p className="mt-3 text-sm sm:text-base text-white/75 leading-relaxed">
                Find viral moments, plan platform variants, frame subtitles, and export local MP4 shorts without mixing in long-form packaging controls.
              </p>
              <div className="mt-5 grid grid-cols-1 gap-2 text-sm">
                <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">Viral clip finder + shorts planner</div>
                <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">Vertical framing + subtitle placement editor</div>
                <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">Saved configs + local ffmpeg.wasm export lifecycle</div>
              </div>
              <div className="mt-6 flex flex-wrap gap-2">
                <Link href="/creator/shorts">
                  <Button className="rounded-full bg-gradient-to-r from-orange-400 to-fuchsia-400 text-black hover:from-orange-300 hover:to-fuchsia-300">
                    <Sparkles className="mr-2 h-4 w-4" />
                    Open Shorts Forge
                  </Button>
                </Link>
              </div>
            </div>
          </article>

          <aside className="grid gap-6">
            <div className="relative overflow-hidden rounded-[1.6rem] border border-white/10 bg-black/35 p-5 backdrop-blur-xl">
              <div className="absolute inset-0 opacity-15 bg-[linear-gradient(rgba(255,255,255,0.14)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.14)_1px,transparent_1px)] bg-[size:18px_18px]" />
              <div className="relative z-10">
                <div className="font-mono text-[11px] uppercase tracking-[0.24em] text-white/45">Why This Split</div>
                <ul className="mt-4 space-y-3 text-sm text-white/75">
                  <li className="rounded-xl border border-white/10 bg-white/5 p-3">Cleaner prompts and outputs per task type.</li>
                  <li className="rounded-xl border border-white/10 bg-white/5 p-3">Lower UI cognitive load while editing or packaging.</li>
                  <li className="rounded-xl border border-white/10 bg-white/5 p-3">Future-ready for cross-tool link flows instead of one mega-screen.</li>
                </ul>
              </div>
            </div>

            <div className="relative overflow-hidden rounded-[1.6rem] border border-cyan-300/15 bg-cyan-400/5 p-5">
              <div className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-cyan-300/20 blur-2xl" />
              <div className="relative z-10">
                <div className="font-mono text-[11px] uppercase tracking-[0.24em] text-cyan-100/70">Coming Next</div>
                <h3 className="mt-2 text-lg font-semibold text-white">Short-to-content bridge</h3>
                <p className="mt-2 text-sm text-white/70 leading-relaxed">
                  A follow-up tool can accept a selected short and generate caption variants, hook tests, and post copy specifically for that cut.
                </p>
                <div className="mt-4 rounded-xl border border-dashed border-cyan-200/20 bg-black/20 p-3 text-xs text-cyan-100/80">
                  Hub will become the routing layer for chained workflows.
                </div>
              </div>
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}
