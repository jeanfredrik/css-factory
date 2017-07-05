'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.walkTree = exports.toArray = exports.memoizeWith = exports.mapValuesWithKey = undefined;

var _fp = require('lodash/fp');

var _decurry = require('decurry');

var _decurry2 = _interopRequireDefault(_decurry);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const mapValuesWithKey = exports.mapValuesWithKey = _fp.mapValues.convert({ cap: false });

const memoizeUnfixed = _fp.memoize.convert({ fixed: false, rearg: false });

const memoizeWith = exports.memoizeWith = (0, _decurry2.default)(2, resolver => func => memoizeUnfixed(func, resolver));

const toArray = exports.toArray = value => (0, _fp.isArray)(value) ? value : [value];

const walkTree = exports.walkTree = (0, _decurry2.default)(2, walker => childKey => {
  const walk = parents => object => {
    const result = walker(object, parents);
    if (result !== false && object[childKey]) {
      object[childKey].forEach(walk([object, ...parents]));
    }
  };
  return walk([]);
});