import { AuthorizedWorkspace } from "../authorized-workspace";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function DashboardPage() {
  return <AuthorizedWorkspace section="dashboard" />;
}
