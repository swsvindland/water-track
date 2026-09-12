import type { PropsWithChildren } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  View,
  type TextInputProps,
} from "react-native";
import { SafeAreaView as NativeSafeAreaView } from "react-native-safe-area-context";
import { withUniwind } from "uniwind";
import { Button, Input, Label, TextField } from "heroui-native";

const SafeAreaView = withUniwind(NativeSafeAreaView);

export function Screen({
  title,
  subtitle,
  children,
}: PropsWithChildren<{ title: string; subtitle?: string }>) {
  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top", "left", "right"]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ padding: 24, paddingBottom: 40 }}
        >
          <View className="w-full max-w-xl self-center gap-6">
            <View className="gap-2 pt-4">
              <Text accessibilityRole="header" className="text-3xl font-semibold text-foreground">
                {title}
              </Text>
              {subtitle && <Text className="text-base text-muted">{subtitle}</Text>}
            </View>
            {children}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
export function Heading({ children }: PropsWithChildren) {
  return (
    <Text accessibilityRole="header" className="text-lg font-semibold text-foreground">
      {children}
    </Text>
  );
}
export function Note({ children, error = false }: PropsWithChildren<{ error?: boolean }>) {
  return (
    <Text
      accessibilityRole={error ? "alert" : undefined}
      className={error ? "text-sm text-danger" : "text-sm leading-5 text-muted"}
    >
      {children}
    </Text>
  );
}
export function Field({ label, ...props }: TextInputProps & { label: string }) {
  return (
    <TextField>
      <Label>{label}</Label>
      <Input
        className="border border-field-border android:border android:border-field-border"
        accessibilityLabel={label}
        {...props}
      />
    </TextField>
  );
}
export function Choices<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <View className="flex-row flex-wrap gap-2">
      {options.map((option) => (
        <Button
          key={option.value}
          variant={value === option.value ? "secondary" : "outline"}
          accessibilityState={{ selected: value === option.value }}
          onPress={() => onChange(option.value)}
        >
          {option.label}
        </Button>
      ))}
    </View>
  );
}
