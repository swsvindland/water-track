import { Children, useEffect, useRef, useState, type ReactNode } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { useIsRTL, useKitFormat } from "@/vector";
import { useApp } from "@/lib/store";

/** A horizontal pager whose pages share the available height. */
export function HomeCarousel({
  children,
  label,
  fill = false,
}: {
  children: ReactNode;
  label: string;
  fill?: boolean;
}) {
  const { t } = useApp();
  const format = useKitFormat();
  const isRTL = useIsRTL();
  const slides = Children.toArray(children);
  const scroll = useRef<ScrollView>(null);
  const [width, setWidth] = useState(0);
  const [height, setHeight] = useState(0);
  const [contentHeight, setContentHeight] = useState<number>();
  const pageRef = useRef(0);
  const [page, setPage] = useState(0);
  const current = Math.min(page, slides.length - 1);
  // Pages start at the start edge: in RTL the first page sits at the far end of the content offsets.
  const position = (index: number) => (isRTL ? slides.length - 1 - index : index);

  useEffect(() => {
    const next = Math.max(0, Math.min(pageRef.current, slides.length - 1));
    pageRef.current = next;
    setPage(next);
    scroll.current?.scrollTo({
      x: (isRTL ? slides.length - 1 - next : next) * width,
      animated: false,
    });
  }, [width, slides.length, isRTL]);

  return (
    <View style={fill ? { flex: 1, minHeight: 0 } : { flexShrink: 0 }}>
      <View
        style={fill ? { flex: 1, minHeight: 0 } : { flexShrink: 0 }}
        onLayout={(event) => {
          setWidth(event.nativeEvent.layout.width);
          setHeight(event.nativeEvent.layout.height);
        }}
      >
        <ScrollView
          ref={scroll}
          horizontal
          pagingEnabled
          directionalLockEnabled
          bounces={false}
          showsHorizontalScrollIndicator={false}
          showsVerticalScrollIndicator={false}
          scrollEnabled={slides.length > 1}
          style={fill ? { flex: 1 } : { flexGrow: 0, flexShrink: 0, height: contentHeight }}
          contentContainerStyle={{ alignItems: "stretch" }}
          onContentSizeChange={(_, nextHeight) => {
            if (!fill && nextHeight > 0) setContentHeight(nextHeight);
          }}
          onScroll={(event) => {
            if (width > 0) {
              const at = Math.round(event.nativeEvent.contentOffset.x / width);
              const next = Math.max(0, Math.min(slides.length - 1, position(at)));
              pageRef.current = next;
              setPage(next);
            }
          }}
          scrollEventThrottle={16}
        >
          {width > 0 &&
            slides.map((slide, index) => (
              <View
                key={index}
                style={{ width, ...(fill ? { height } : {}) }}
                accessibilityElementsHidden={index !== current}
                importantForAccessibility={index === current ? "auto" : "no-hide-descendants"}
              >
                {slide}
              </View>
            ))}
        </ScrollView>
      </View>
      {slides.length > 1 && (
        <View className="flex-row items-center justify-center">
          {slides.map((_, index) => (
            <Pressable
              key={index}
              accessibilityRole="button"
              accessibilityLabel={t("pageOf", {
                label,
                page: format.number(index + 1),
                count: format.number(slides.length),
              })}
              accessibilityState={{ selected: index === current }}
              onPress={() =>
                scroll.current?.scrollTo({ x: position(index) * width, animated: true })
              }
              // The row stays 24pt tall; the slop makes each dot a 44pt target.
              hitSlop={{ top: 10, bottom: 10 }}
              className="h-6 w-11 items-center justify-center"
            >
              {/* The current page is a 16pt bar, the others 4pt squares: shape, not only tint. */}
              <View
                className={`h-1 rounded-mark ${index === current ? "w-4 bg-tint" : "w-1 bg-muted"}`}
              />
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}
