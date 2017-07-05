import {
  mapValues,
  isArray,
  memoize,
} from 'lodash/fp';
import decurry from 'decurry';

export const mapValuesWithKey = mapValues.convert({ cap: false });

const memoizeUnfixed = memoize.convert({ fixed: false, rearg: false });

export const memoizeWith = decurry(
  2,
  resolver =>
  func =>
  memoizeUnfixed(func, resolver),
);

export const toArray = value => (
  isArray(value)
  ? value
  : [value]
);

export const walkTree = decurry(
  2,
  walker =>
  (childKey) => {
    const walk = parents => (object) => {
      const result = walker(object, parents);
      if (result !== false && object[childKey]) {
        object[childKey].forEach(walk([object, ...parents]));
      }
    };
    return walk([]);
  },
);
