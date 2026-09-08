import { Children, useEffect, useRef, useState, type ReactNode } from "react";
import { Pressable, ScrollView, View } from "react-native";

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
  const slides = Children.toArray(children);
  const scroll = useRef<ScrollView>(null);
  const [width, setWidth] = useState(0);
  const [height, setHeight] = useState(0);
  const [contentHeight, setContentHeight] = useState<number>();
  const pageRef = useRef(0);
  const [page, setPage] = useState(0);
  const current = Math.min(page, slides.length - 1);

  useEffect(() => {
    const next = Math.max(0, Math.min(pageRef.current, slides.length - 1));
    pageRef.current = next;
    setPage(next);
    scroll.current?.scrollTo({ x: next * width, animated: false });
  }, [width, slides.length]);

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
              const next = Math.max(
                0,
                Math.min(slides.length - 1, Math.round(event.nativeEvent.contentOffset.x / width))
              );
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
              accessibilityLabel={`${label}: ${index + 1} / ${slides.length}`}
              accessibilityState={{ selected: index === current }}
              onPress={() => scroll.current?.scrollTo({ x: index * width, animated: true })}
              className="h-6 w-11 items-center justify-center"
            >
              <View
                className={`h-1.5 rounded-full ${index === current ? "w-4 bg-accent" : "w-1.5 bg-muted"}`}
              />
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}
