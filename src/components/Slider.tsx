import React, { useMemo, useRef, useState } from 'react';
import { PanResponder, StyleSheet, View } from 'react-native';
import { colors } from '../theme';

const THUMB = 28;
const HEIGHT = 56;

/** Taller than it looks, so it is easy to grab. Also operable with TalkBack. */
export function Slider({
  value,
  max = 100,
  step,
  label,
  valueText,
  onChange,
  onComplete,
}: {
  value: number;
  max?: number;
  step: number;
  label: string;
  valueText: string;
  onChange?: (value: number) => void;
  onComplete?: (value: number) => void;
}) {
  const [width, setWidth] = useState(0);
  const [dragging, setDragging] = useState<number | null>(null);
  const latest = useRef({ width, max, onChange, onComplete });
  latest.current = { width, max, onChange, onComplete };
  const start = useRef(0);
  const last = useRef(0);

  const responder = useMemo(() => {
    const toValue = (x: number) => {
      const { width: w, max: m } = latest.current;
      return w > 0 ? Math.min(1, Math.max(0, x / w)) * m : 0;
    };
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: event => {
        start.current = event.nativeEvent.locationX;
        last.current = toValue(start.current);
        setDragging(last.current);
        latest.current.onChange?.(last.current);
      },
      onPanResponderMove: (_, gesture) => {
        last.current = toValue(start.current + gesture.dx);
        setDragging(last.current);
        latest.current.onChange?.(last.current);
      },
      onPanResponderRelease: () => {
        setDragging(null);
        latest.current.onComplete?.(last.current);
      },
      onPanResponderTerminate: () => setDragging(null),
    });
  }, []);

  const shown = dragging ?? value;
  const fraction = max > 0 ? Math.min(1, shown / max) : 0;

  const nudge = (direction: 1 | -1) => {
    const next = Math.min(max, Math.max(0, value + direction * step));
    onChange?.(next);
    onComplete?.(next);
  };

  return (
    <View
      style={styles.container}
      onLayout={event => setWidth(event.nativeEvent.layout.width)}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={label}
      accessibilityValue={{ text: valueText }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={event =>
        nudge(event.nativeEvent.actionName === 'increment' ? 1 : -1)
      }
      {...responder.panHandlers}>
      <View style={styles.track} pointerEvents="none">
        <View style={[styles.fill, { width: `${fraction * 100}%` }]} />
      </View>
      <View
        pointerEvents="none"
        style={[styles.thumb, { left: fraction * width - THUMB / 2 }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { height: HEIGHT, justifyContent: 'center', marginHorizontal: THUMB / 2 },
  track: { height: 8, borderRadius: 4, backgroundColor: colors.sageTrack, overflow: 'hidden' },
  fill: { height: 8, backgroundColor: colors.sage },
  thumb: {
    position: 'absolute',
    width: THUMB,
    height: THUMB,
    borderRadius: THUMB / 2,
    top: (HEIGHT - THUMB) / 2,
    backgroundColor: colors.sage,
  },
});
