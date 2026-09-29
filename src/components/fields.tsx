import type { ReactNode } from "react";
import { View } from "react-native";
import { Choices, Label, Panel, Text, Toggle } from "@/vector";

/** SettingsSection's anatomy (eyebrow over a bordered panel) with a padded panel, for fields and switches. */
export function FormSection({ eyebrow, children }: { eyebrow: string; children: ReactNode }) {
  return (
    <View className="gap-2">
      <Label accessibilityRole="header">{eyebrow}</Label>
      <Panel>
        <Panel.Body className="gap-4">{children}</Panel.Body>
      </Panel>
    </View>
  );
}

/**
 * A labelled native switch among the Fields of a padded FormSection. Kit ListRow (which now takes `disabled`)
 * is the row-panel anatomy, inset 16 with its own rules, so in a padded panel it would sit 16pt in from the
 * Fields beside it; this keeps the switch on their edge. The switch carries the label (or
 * `accessibilityLabel`) for screen readers, and kit Toggle reports `disabled`.
 */
export function SwitchField({
  label,
  value,
  onChange,
  disabled = false,
  accessibilityLabel,
}: {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
  accessibilityLabel?: string;
}) {
  return (
    <View className="min-h-11 flex-row items-center gap-3">
      <Text
        variant="bodyStrong"
        className="flex-1"
        accessibilityElementsHidden
        importantForAccessibility="no"
      >
        {label}
      </Text>
      <Toggle
        value={value}
        onChange={onChange}
        disabled={disabled}
        accessibilityLabel={accessibilityLabel ?? label}
      />
    </View>
  );
}

/**
 * Kit Choices under a Field label (Choices has no `showTitle`, as Select does); the control names itself to
 * screen readers with the same words.
 */
export function ChoicesField<T extends string>({
  title,
  values,
  value,
  onChange,
  label,
  disabled = false,
}: {
  title: string;
  values: readonly T[];
  value: T;
  onChange: (value: T) => void;
  label: (value: T) => string;
  disabled?: boolean;
}) {
  return (
    <View className="gap-2">
      <Text
        variant="fieldLabel"
        tone="secondary"
        accessibilityElementsHidden
        importantForAccessibility="no"
      >
        {title}
      </Text>
      <Choices
        values={values}
        value={value}
        onChange={onChange}
        label={label}
        accessibilityLabel={title}
        disabled={disabled}
      />
    </View>
  );
}
