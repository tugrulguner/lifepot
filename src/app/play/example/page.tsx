import { GameCanvas } from "@/components/GameCanvas";

export const metadata = {
  title: "The little pond · LifePot",
  description: "Watch a recorded LifePot world unfold. This exact replay makes no inference calls.",
};

export default function ExamplePlayPage() {
  return <GameCanvas initialEntry="example" />;
}
