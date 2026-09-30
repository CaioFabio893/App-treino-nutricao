import { redirect } from "next/navigation";

export default async function LegacyProgramPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/treinos/${encodeURIComponent(id)}`);
}
