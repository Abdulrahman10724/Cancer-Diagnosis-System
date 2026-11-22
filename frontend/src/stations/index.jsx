import Placeholder from './Placeholder';

const make = (id) =>
  function Station() {
    return <Placeholder id={id} />;
  };

export const STATION_SCREENS = {
  data: make('data'),
  features: make('features'),
  scale: make('scale'),
  split: make('split'),
  train: make('train'),
  predict: make('predict'),
  evaluate: make('evaluate'),
  benchmark: make('benchmark'),
};
