import { ApplicationWorkspace } from "../page";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function DashboardPage() {
  return <ApplicationWorkspace initialSection="dashboard" />;
}

