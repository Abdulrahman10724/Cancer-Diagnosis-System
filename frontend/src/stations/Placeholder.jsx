import StationLayout from '../components/StationLayout';
import { stationById } from '../lib/metro';
import { useJourney } from '../state/Journey';

// Temporary station body until the real station is built
export default function Placeholder({ id }) {
  const { complete } = useJourney();
  const s = stationById(id);
  return (
    <StationLayout id={id} sentence={s.short} todo="Finish this station to continue.">
      <button type="button" className="btn btn-primary" onClick={() => complete(id)}>
        Mark {s.name} as done
      </button>
    </StationLayout>
  );
}
