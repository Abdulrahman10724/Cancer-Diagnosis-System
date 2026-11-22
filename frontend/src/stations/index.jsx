import Data from './Data';
import Features from './Features';
import Scale from './Scale';
import Split from './Split';
import Train from './Train';
import Placeholder from './Placeholder';

const make = (id) =>
  function Station() {
    return <Placeholder id={id} />;
  };

export const STATION_SCREENS = {
  data: Data,
  features: Features,
  scale: Scale,
  split: Split,
  train: Train,
  predict: make('predict'),
  evaluate: make('evaluate'),
  benchmark: make('benchmark'),
};
