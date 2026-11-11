import { createContext, useContext, type ReactNode } from "react";

import { useNativeSync } from "@/hooks/use-native-sync";

type NativeSyncValue = ReturnType<typeof useNativeSync>;

const NativeSyncContext = createContext<NativeSyncValue | null>(null);

export function NativeSyncProvider({
  userId,
  children,
}: {
  userId: string | undefined;
  children: ReactNode;
}) {
  const value = useNativeSync(userId);
  return <NativeSyncContext.Provider value={value}>{children}</NativeSyncContext.Provider>;
}

export function useNativeSyncContext(): NativeSyncValue {
  const value = useContext(NativeSyncContext);
  if (!value) throw new Error("useNativeSyncContext must be used inside NativeSyncProvider");
  return value;
}
