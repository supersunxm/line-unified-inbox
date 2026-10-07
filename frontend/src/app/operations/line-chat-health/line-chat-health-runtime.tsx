"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { LineChatOperationsHealth } from "@/lib/api";
import type { RecoverySignal, RecoverySignals } from "./line-chat-core-health";
import { applyRecoveryObservation } from "./line-chat-core-health";

type SignalInput = Omit<RecoverySignal, "observedAt"> & { observedAt?: number };
const Runtime = createContext<{
  report: LineChatOperationsHealth | null;
  now: number;
  recovery: RecoverySignals;
  publishReport: (report: LineChatOperationsHealth) => void;
  publishRecovery: (
    key: string,
    signal: SignalInput | undefined,
    readStartedAt?: number,
  ) => void;
}>({
  report: null,
  now: 0,
  recovery: {},
  publishReport: () => {},
  publishRecovery: () => {},
});
export function LineChatHealthRuntime({ children }: { children: ReactNode }) {
  const [report, setReport] = useState<LineChatOperationsHealth | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [recovery, setRecovery] = useState<RecoverySignals>({});
  const publishReport = useCallback((report: LineChatOperationsHealth) => {
    setNow(Date.now());
    setReport(report);
  }, []);
  const publishRecovery = useCallback(
    (key: string, signal: SignalInput | undefined, readStartedAt?: number) => {
      const observedAt = Date.now();
      setNow(observedAt);
      setRecovery((current) =>
        applyRecoveryObservation(
          current,
          key,
          signal
            ? { ...signal, observedAt: signal.observedAt ?? observedAt }
            : undefined,
          readStartedAt,
        ),
      );
    },
    [],
  );
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);
  const value = useMemo(
    () => ({ report, now, recovery, publishReport, publishRecovery }),
    [report, now, recovery, publishReport, publishRecovery],
  );
  return <Runtime.Provider value={value}>{children}</Runtime.Provider>;
}
export const useLineChatHealthRuntime = () => useContext(Runtime);
