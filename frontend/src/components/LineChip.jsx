import { Popover } from './Popover';
import styles from './LineChip.module.css';

/** A data-structure line as a chip; press it for what the line does at this station. */
export default function LineChip({ line, station }) {
  return (
    <Popover
      label={`${line.name}: what it does here`}
      triggerClass={styles.chip}
      trigger={
        <>
          <span className={styles.swatch} style={{ background: line.day }} aria-hidden="true" />
          {line.name}
        </>
      }
    >
      <strong>{line.name}</strong> {line.uses[station] ? `${line.uses[station]}.` : line.what}
      <span className={styles.cost}>{line.complexity[0]}</span>
    </Popover>
  );
}
