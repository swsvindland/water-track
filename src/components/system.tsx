import type { ComponentProps } from "react";
import { Platform, Text, View, type TextProps, type ViewProps } from "react-native";
import { Button, Slider } from "heroui-native";

// Native technical-font fallbacks specified by SIBYL; no remote font dependency.
const technicalFont = Platform.select({ ios: "Menlo", default: "monospace" });

export function SystemLabel({
  className = "",
  style,
  ...props
}: TextProps & { className?: string }) {
  return (
    <Text
      {...props}
      className={`text-xs uppercase tracking-wider text-muted ${className}`}
      style={[{ fontFamily: technicalFont }, style]}
    />
  );
}

export function SystemValue({
  className = "",
  style,
  ...props
}: TextProps & { className?: string }) {
  return (
    <Text
      {...props}
      className={`tabular-nums text-foreground ${className}`}
      style={[{ fontFamily: technicalFont }, style]}
    />
  );
}

export function SystemPanel({ className = "", ...props }: ViewProps & { className?: string }) {
  return (
    <View
      {...props}
      className={`rounded-md border border-border bg-surface p-4 gap-4 ${className}`}
    />
  );
}

function SystemButtonRoot({
  className = "",
  children,
  variant = "outline",
  ...props
}: ComponentProps<typeof Button>) {
  return (
    <Button
      {...props}
      variant={variant}
      animation="disable-all"
      className={`min-h-12 rounded-md ${className}`}
    >
      {typeof children === "string" ? (
        <Button.Label className="text-sm font-medium">{children}</Button.Label>
      ) : (
        children
      )}
    </Button>
  );
}
export const SystemButton = Object.assign(SystemButtonRoot, { Label: Button.Label });

export function SystemSlider({
  accessibilityLabel,
  accessibilityValue,
  ...props
}: ComponentProps<typeof Slider>) {
  return (
    <Slider {...props} animation="disable-all">
      <Slider.Track className="my-5 h-1 rounded-sm bg-muted" hitSlop={22}>
        <Slider.Fill className="rounded-sm" />
        <Slider.Thumb
          className="h-6 w-6 rounded-md"
          accessibilityLabel={accessibilityLabel}
          accessibilityValue={accessibilityValue}
        />
      </Slider.Track>
    </Slider>
  );
}
