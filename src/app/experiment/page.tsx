import { GameCanvas } from "@/components/GameCanvas";
import type { Metadata } from "next";
export const metadata: Metadata = { alternates: { canonical: "/experiment" } };
export default function ExperimentPage() { return <GameCanvas />; }
