import type { Metadata } from "next";
import { TikTokCallbackStatus } from "../tiktok-callback-validator";
import { TikTokCallbackView } from "../tiktok-callback-view";

export const metadata: Metadata = {
  title: "TikTok Authorization | OPPO Retail TikTok Monitor",
  description: "OAuth authorization result for OPPO Retail TikTok Monitor.",
  robots: {
    index: false,
    follow: false,
  },
};

interface TikTokCallbackResultPageProps {
  searchParams?:
    | Promise<{ [key: string]: string | string[] | undefined }>
    | { [key: string]: string | string[] | undefined };
}

export default async function TikTokCallbackResultPage(props: TikTokCallbackResultPageProps) {
  const resolvedParams = props.searchParams ? await Promise.resolve(props.searchParams) : {};

  const rawStatus = typeof resolvedParams.status === "string" ? resolvedParams.status : null;
  const rawErrorMessage =
    typeof resolvedParams.error_message === "string" ? resolvedParams.error_message : null;

  let status: TikTokCallbackStatus = "INVALID";
  if (rawStatus === "success") {
    status = "SUCCESS";
  } else if (rawStatus === "state_mismatch") {
    status = "STATE_MISMATCH";
  } else if (rawStatus === "error") {
    status = "ERROR";
  }

  return <TikTokCallbackView status={status} errorMessage={rawErrorMessage} />;
}
