import { useCallback, useEffect, useRef, useState } from "react";
import { AccessibilityInfo } from "react-native";
import {
  LinkButton,
  ScreenFooter,
  Text,
  useHaptics,
  useKitStrings,
  useScreenReader,
} from "@/vector";

const UNDO_MS = 6000;

type Undo = { key: number; message: string; onUndo: () => void };

/**
 * Undo for Today's static favourite grid. The kit Screen docks its Undo below a static column, so the column
 * (and the flex-1 grid in it) would shrink for 6s and move the tiles under a second tap. Until the kit can draw
 * the strip over a static column, Today keeps the kit's Undo rules here: 6s, held while a screen reader runs,
 * announced once on both platforms, a new show makes the previous action final, and it is dismissed before
 * onUndo runs so a double tap cannot undo twice. The caller places `strip` over the column's bottom edge.
 */
export function useUndoOverlay() {
  const strings = useKitStrings();
  const haptics = useHaptics();
  const reading = useScreenReader();
  const [undo, setUndo] = useState<Undo | null>(null);
  const sequence = useRef(0);
  useEffect(() => {
    if (undo) AccessibilityInfo.announceForAccessibility(undo.message);
  }, [undo]);
  useEffect(() => {
    if (!undo || reading) return;
    const timer = setTimeout(() => setUndo((u) => (u?.key === undo.key ? null : u)), UNDO_MS);
    return () => clearTimeout(timer);
  }, [undo, reading]);
  const show = useCallback(
    (next: Omit<Undo, "key">) => setUndo({ ...next, key: ++sequence.current }),
    []
  );
  const strip = undo ? (
    <ScreenFooter>
      {/* Announced on show, so not a live region too (TalkBack would say it twice). */}
      <Text variant="small" className="flex-1">
        {undo.message}
      </Text>
      <LinkButton
        onPress={() => {
          setUndo(null);
          haptics.selection();
          undo.onUndo();
        }}
      >
        {strings.undo}
      </LinkButton>
    </ScreenFooter>
  ) : null;
  return { show, strip };
}
