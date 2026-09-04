import { redirect } from "next/navigation";

export default async function SetupSettingsRedirect({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/agents/${id}/configure`);
}
