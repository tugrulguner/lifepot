"use client";
import { useSyncExternalStore } from "react";
import { GameCanvas } from "@/components/GameCanvas";
import { HomeOverview } from "@/components/HomeOverview";
const subscribe = (callback: () => void) => { window.addEventListener("hashchange", callback); return () => window.removeEventListener("hashchange", callback); };
const hasLegacyReplay = () => new URLSearchParams(location.hash.slice(1)).has("replay");
const serverSnapshot = () => false;
export function HomeRoute({ legacyQuery }: { legacyQuery: boolean }) {
  const legacyHash = useSyncExternalStore(subscribe, hasLegacyReplay, serverSnapshot);
  return legacyQuery || legacyHash ? <GameCanvas /> : <HomeOverview />;
}
