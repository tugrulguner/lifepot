"use client";
import { useSyncExternalStore } from "react";
import dynamic from "next/dynamic";
const GameCanvas = dynamic(() => import("@/components/GameCanvas").then(module => module.GameCanvas));
import { HomeOverview } from "@/components/HomeOverview";
const subscribe = (callback: () => void) => { window.addEventListener("hashchange", callback); return () => window.removeEventListener("hashchange", callback); };
const hasLegacyReplay = () => new URLSearchParams(location.search).has("replay") || new URLSearchParams(location.hash.slice(1)).has("replay");
const serverSnapshot = () => false;
export function HomeRoute() {
  const legacyHash = useSyncExternalStore(subscribe, hasLegacyReplay, serverSnapshot);
  return legacyHash ? <GameCanvas /> : <HomeOverview />;
}
