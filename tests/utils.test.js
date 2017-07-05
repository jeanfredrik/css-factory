import {
  memoize,
} from 'lodash/fp';

import {
  memoizeWith,
} from '../src/utils';

describe('lodash/memoize', () => {
  it('can’t memoize functions with non-scalar argument', () => {
    const func = () => Math.random();
    const memoizedFunc1 = memoize(func);
    const results1 = [
      memoizedFunc1({ foo: 'bar' }),
      memoizedFunc1({ foo: 'bar' }),
    ];
    expect(results1[0]).not.toBe(results1[1]);
  });
});

describe('memoizeWith', () => {
  it('accepts a resolver', () => {
    const func = () => Math.random();
    const memoizedFunc1 = memoizeWith(JSON.stringify)(func);
    const results1 = [
      memoizedFunc1({ foo: 'bar' }),
      memoizedFunc1({ foo: 'bar' }),
    ];
    expect(results1[0]).toBe(results1[1]);
  });
});
