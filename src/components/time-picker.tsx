import DateTimePicker, { DateTimePickerAndroid } from "@react-native-community/datetimepicker";
import { Button } from "heroui-native";
import { Platform } from "react-native";
import { useApp } from "@/lib/store";

// Edits minutes after midnight with the platform's own time picker.
export function TimePicker({
  label,
  minutes,
  isDisabled = false,
  onChange,
}: {
  label: string;
  minutes: number;
  isDisabled?: boolean;
  onChange: (minutes: number) => void;
}) {
  const { settings, locale } = useApp();
  const value = new Date(2000, 0, 1, 0, minutes);
  const select = (date: Date) => onChange(date.getHours() * 60 + date.getMinutes());
  if (Platform.OS === "ios")
    return (
      <DateTimePicker
        mode="time"
        display="compact"
        value={value}
        locale={locale}
        minuteInterval={5}
        disabled={isDisabled}
        accessibilityLabel={label}
        themeVariant={
          settings.appearance === "light" || settings.appearance === "dark"
            ? settings.appearance
            : undefined
        }
        onValueChange={(_, date) => select(date)}
      />
    );
  return (
    <Button
      size="sm"
      variant="outline"
      isDisabled={isDisabled}
      accessibilityLabel={label}
      onPress={() =>
        DateTimePickerAndroid.open({
          mode: "time",
          value,
          title: label,
          onValueChange: (_, date) => select(date),
        })
      }
    >
      {value.toLocaleTimeString(locale, { hour: "numeric", minute: "2-digit" })}
    </Button>
  );
}
