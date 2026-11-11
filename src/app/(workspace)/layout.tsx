import { redirect } from "next/navigation";
import { Shell } from "@/components/shell";
import { countUsers, getCurrentUser } from "@/lib/auth";

export default async function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect(countUsers() === 0 ? "/setup" : "/login");
  return <Shell user={user}>{children}</Shell>;
}
