import Data from './Data';
import Features from './Features';
import Scale from './Scale';
import Placeholder from './Placeholder';

const make = (id) =>
  function Station() {
    return <Placeholder id={id} />;
  };

export const STATION_SCREENS = {
  data: Data,
  features: Features,
  scale: Scale,
  split: make('split'),
  train: make('train'),
  predict: make('predict'),
  evaluate: make('evaluate'),
  benchmark: make('benchmark'),
};
