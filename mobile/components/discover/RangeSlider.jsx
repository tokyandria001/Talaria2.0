import { useRef, useState } from 'react';
import { View, Text, StyleSheet, PanResponder } from 'react-native';
import { Colors } from '../../constants/Colors';

const THUMB = 26;

/** Curseur à deux poignées (budget min / max) */
export default function RangeSlider({ min, max, step = 5, low, high, onChange, format = (v) => v }) {
  const [width, setWidth] = useState(0);

  // Valeurs courantes lues par les PanResponders (créés une seule fois)
  const live = useRef({});
  live.current = { min, max, step, low, high, width, onChange };

  const toX = (v, w = width) => ((v - min) / (max - min)) * w;

  const makeResponder = (which) => {
    let startX = 0;
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        const c = live.current;
        startX = ((c[which] - c.min) / (c.max - c.min)) * c.width;
      },
      onPanResponderMove: (_, g) => {
        const c = live.current;
        const x = Math.min(Math.max(startX + g.dx, 0), c.width);
        const v = Math.round((c.min + (x / c.width) * (c.max - c.min)) / c.step) * c.step;
        if (which === 'low') c.onChange(Math.min(v, c.high - c.step), c.high);
        else                 c.onChange(c.low, Math.max(v, c.low + c.step));
      },
    });
  };

  const lowResponder  = useRef(makeResponder('low')).current;
  const highResponder = useRef(makeResponder('high')).current;

  return (
    <View>
      <View style={s.track} onLayout={(e) => setWidth(e.nativeEvent.layout.width - THUMB)}>
        <View style={s.rail} />
        {width > 0 && (
          <>
            <View style={[s.selected, { left: toX(low) + THUMB / 2, width: toX(high) - toX(low) }]} />
            <View {...lowResponder.panHandlers}  style={[s.thumb, { left: toX(low) }]}  hitSlop={12} />
            <View {...highResponder.panHandlers} style={[s.thumb, { left: toX(high) }]} hitSlop={12} />
          </>
        )}
      </View>
      <View style={s.labels}>
        <Text style={s.label}>{format(low)}</Text>
        <Text style={s.label}>{format(high)}</Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  track: { height: THUMB, justifyContent: 'center' },
  rail:  { position: 'absolute', left: THUMB / 2, right: THUMB / 2, height: 4, borderRadius: 2, backgroundColor: '#e3d6dd' },
  selected: { position: 'absolute', height: 4, borderRadius: 2, backgroundColor: Colors.parme },
  thumb: {
    position: 'absolute', width: THUMB, height: THUMB, borderRadius: THUMB / 2,
    backgroundColor: Colors.white, borderWidth: 2, borderColor: Colors.parme,
  },
  labels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  label:  { fontFamily: 'BricolageGrotesque_400Regular', fontSize: 12, color: Colors.text },
});
