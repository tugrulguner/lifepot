import { HomeRoute } from "@/components/HomeRoute";
export const metadata = { title: "LifePot · Deterministic artificial life", alternates: { canonical: "/" } };

export default async function Home({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  return <HomeRoute legacyQuery={params.replay !== undefined} />;
}
