"use client";

import { QRCodeSVG } from "qrcode.react";
import { useState, useSyncExternalStore } from "react";

const noopSubscribe = () => () => {};

/**
 * Always-visible QR code (fixed bottom-right) linking to this room, so people
 * can scan the host's screen to join. Tap to enlarge for scanning across a room.
 */
export default function RoomQr({ code }: { code: string }) {
  const [big, setBig] = useState(false);
  // window.location only exists client-side; render nothing during SSR.
  const origin = useSyncExternalStore(
    noopSubscribe,
    () => window.location.origin,
    () => null,
  );

  if (!origin) return null;
  const url = `${origin}/room/${code}`;

  return (
    <button
      onClick={() => setBig((b) => !b)}
      aria-label={big ? "Shrink QR code" : "Enlarge QR code"}
      className={`fixed right-4 bottom-4 z-40 flex flex-col items-center gap-1 rounded-2xl bg-white p-2 shadow-2xl shadow-black/50 transition-all ${
        big ? "p-4" : ""
      }`}
    >
      <QRCodeSVG
        value={url}
        size={big ? 480 : 180}
        level="M"
        className="h-auto max-h-[calc(100vh-6rem)] max-w-[calc(100vw-4rem)]"
      />
      <span
        className={`font-mono font-black tracking-[0.2em] text-black ${
          big ? "text-3xl" : "text-sm"
        }`}
      >
        {code}
      </span>
    </button>
  );
}
