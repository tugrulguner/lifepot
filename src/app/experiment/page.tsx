import { GameCanvas } from "@/components/GameCanvas";
import type { Metadata } from "next";
export const metadata: Metadata = { alternates: { canonical: "/play" } };
export default function PlayPage() { return <GameCanvas />; }
