import { ApplicationWorkspace } from "../page";
import styles from "./follower-insights-modern.module.css";

export default function FollowerInsightsPage() {
  return (
    <div className={styles.scope}>
      <ApplicationWorkspace initialSection="follower-insights" />
    </div>
  );
}
