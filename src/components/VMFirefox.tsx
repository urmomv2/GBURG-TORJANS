// src/components/VMFirefox.tsx
// Trojans Proxy Hub — Firefox WASM VM tab
// Self-hosted Gecko browser running entirely in the browser via WebAssembly.

import { useEffect, useState } from "react";
import { Monitor, ExternalLink, Loader2, Sparkles, Maximize2, AlertCircle } from "lucide-react";

export default function VMFirefox() {
  const [ready, setReady] = useState(false);
  const [assetOk, setAssetOk] = useState(true);
  const [launching, setLaunching] = useState(false);

  // Check that the vendored assets exist before showing the launch button
  useEffect(() => {
    let cancelled = false;
    fetch("/firefox-wasm/index.html", { method: "HEAD" })
      .then((r) => {
        if (!cancelled) setAssetOk(r.ok);
      })
      .catch(() => {
        if (!cancelled) setAssetOk(false);
      })
      .finally(() => {
        if (!cancelled) setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function launchVm() {
    if (!ready || launching) return;
    setLaunching(true);
    // Small delay so the loading state renders before navigation
    setTimeout(() => {
      try {
        sessionStorage.setItem("trojans-vm-return", "1");
      } catch {}
      window.location.assign("/firefox-wasm/index.html");
    }, 150);
  }

  if (!ready) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="animate-spin" size={20} style={{ color: "hsl(213 70% 62%)" }} />
      </div>
    );
  }

  if (!assetOk) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-3 px-6 text-center">
        <div
          className="w-14 h-14 rounded-2xl flex items-center justify-center mb-2"
          style={{
            background: "hsl(216 30% 10%)",
            border: "1px solid hsl(213 40% 30%)",
          }}
        >
          <AlertCircle size={22} style={{ color: "hsl(30 80% 65%)" }} />
        </div>
        <p className="text-sm font-semibold" style={{ color: "hsl(0 0% 96%)" }}>
          VM assets not installed
        </p>
        <p className="text-xs max-w-md leading-relaxed" style={{ color: "hsl(216 15% 65%)" }}>
          Run{" "}
          <code
            className="px-1.5 py-0.5 rounded"
            style={{
              background: "hsl(216 30% 12%)",
              color: "hsl(213 75% 78%)",
              fontFamily: "monospace",
            }}
          >
            npm run vendor:firefox-wasm
          </code>{" "}
          then restart the server.
        </p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col items-center justify-center px-6 relative overflow-hidden">
      {/* Radial glow behind the content */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          left: "50%",
          top: "42%",
          transform: "translate(-50%, -50%)",
          width: "min(520px, 92vw)",
          height: 320,
          borderRadius: "50%",
          background:
            "radial-gradient(ellipse at center, hsla(220, 32%, 6%, 0.55) 0%, hsla(220, 30%, 4%, 0.28) 48%, transparent 72%)",
          pointerEvents: "none",
          zIndex: 0,
        }}
      />

      <div className="relative z-10 flex flex-col items-center text-center max-w-md gap-4">
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center mb-1"
          style={{
            background: "hsl(216 30% 10%)",
            border: "1px solid hsl(213 40% 32%)",
          }}
        >
          <Monitor size={26} style={{ color: "hsl(213 80% 80%)" }} />
        </div>

        <div>
          <p
            className="text-[10px] font-bold uppercase tracking-[0.16em] mb-2"
            style={{ color: "hsl(213 75% 68%)" }}
          >
            Trojans VMs
          </p>
          <h1
            className="text-3xl font-extrabold tracking-tight mb-2"
            style={{ color: "hsl(0 0% 100%)" }}
          >
            Firefox VM
          </h1>
          <p className="text-sm leading-relaxed" style={{ color: "hsl(216 15% 72%)" }}>
            A full Gecko browser running in WebAssembly — opens as a full-page app.
          </p>
        </div>

        <button
          onClick={launchVm}
          disabled={launching}
          className="mt-2 inline-flex items-center gap-2 px-7 py-3 rounded-xl text-sm font-semibold text-white disabled:opacity-50 transition"
          style={{
            background: "hsl(213 55% 32%)",
            border: "1px solid hsl(213 45% 42%)",
          }}
          onMouseEnter={(e) => {
            if (!launching) (e.currentTarget as HTMLButtonElement).style.background = "hsl(213 60% 38%)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = "hsl(213 55% 32%)";
          }}
        >
          {launching ? (
            <>
              <Loader2 size={15} className="animate-spin" />
              Starting…
            </>
          ) : (
            <>
              <Maximize2 size={15} />
              Launch VM
            </>
          )}
        </button>

        <p className="text-[11px] mt-1" style={{ color: "hsl(216 15% 58%)" }}>
          WebAssembly · runs locally · credit{" "}
          <a
            href="https://github.com/HeyPuter/firefox-wasm"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-0.5 underline-offset-2 hover:underline"
            style={{ color: "hsl(213 75% 68%)" }}
          >
            Puter / firefox-wasm <ExternalLink size={9} />
          </a>
        </p>

        <p
          className="text-[10px] flex items-center gap-1"
          style={{ color: "hsl(216 15% 52%)" }}
        >
          <Sparkles size={10} />
          Use the Exit button on the VM splash to return here
        </p>
      </div>
    </div>
  );
}