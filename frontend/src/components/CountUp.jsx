import { animate, useReducedMotion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';

/** Counts from the previous value to `value` (<= 800ms). `format` turns the number into text. */
export default function CountUp({ value, format = (v) => String(Math.round(v)), duration = 0.8, start = true }) {
  const reduce = useReducedMotion();
  const [shown, setShown] = useState(reduce || !start ? value : 0);
  const from = useRef(0);

  useEffect(() => {
    if (!start) return undefined;
    if (reduce) {
      setShown(value);
      from.current = value;
      return undefined;
    }
    const controls = animate(from.current, value, {
      duration,
      ease: [0.22, 0.8, 0.3, 1],
      onUpdate: (v) => setShown(v),
    });
    from.current = value;
    return () => controls.stop();
  }, [value, duration, reduce, start]);

  return <span className="tnum">{format(start ? shown : 0)}</span>;
}
