import { ApplicationWorkspace } from "../page";
import styles from "./follower-insights-modern.module.css";
import polish from "./follower-insights-polish.module.css";

export default function FollowerInsightsPage() {
  return (
    <div className={`${styles.scope} ${polish.scope}`}>
      <ApplicationWorkspace initialSection="follower-insights" />
    </div>
  );
}
