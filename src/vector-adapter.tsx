import type { ReactNode } from "react";
import { VectorProvider } from "@/vector";
import { useApp } from "@/lib/store";

// No expo-haptics or expo-symbols in this app yet, so the kit keeps its silent haptics and Ionicons glyphs.
export function VectorAdapter({ children }: { children: ReactNode }) {
  const { language } = useApp();
  return <VectorProvider language={language}>{children}</VectorProvider>;
}
