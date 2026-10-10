import { HomeRoute } from "@/components/HomeRoute";

export default async function Home({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  return <HomeRoute legacyQuery={params.replay !== undefined} />;
}
