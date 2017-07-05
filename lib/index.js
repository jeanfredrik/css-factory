'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.compile = exports.atomify = exports.generate = exports.combineDefs = undefined;

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

var _fp = require('lodash/fp');

var _postcss = require('postcss');

var _commonTags = require('common-tags');

var _decurry = require('decurry');

var _decurry2 = _interopRequireDefault(_decurry);

var _utils = require('./utils');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const combineDefs = exports.combineDefs = (0, _fp.flow)([_fp.entries, (0, _fp.reduce)((combos, [key, mapping]) => (0, _fp.flatMap)(combo => (0, _fp.flow)([_fp.entries, (0, _fp.flatMap)(([alias, values]) => (0, _fp.flow)([_utils.toArray, (0, _fp.map)(value => _extends({}, combo, {
  [key]: [alias, value]
}))])(values))])(mapping), combos), [{}])]);

const toSelectorsRegExp = (0, _utils.memoizeWith)(JSON.stringify, combo => new RegExp(_commonTags.oneLineTrim`
      (:?)
      <
        ([^a-z0-9_]*?)
        (${Object.keys(combo).join('|')})
        ((?:\\.[a-z0-9_]+)*)
        ([^a-z0-9_]*?)
      >`, 'ig'));

const toDefaultRegExp = (0, _utils.memoizeWith)(JSON.stringify, combo => new RegExp(_commonTags.oneLineTrim`
      <
        ([^a-z0-9_]*?)
        (${Object.keys(combo).join('|')})
        ((?:\\[[a-z0-9_]+\\])*)
        ([^a-z0-9_]*?)
      >`, 'ig'));

const getInPattern = (0, _decurry2.default)(2, pathString => {
  const path = pathString.match(/\[([a-z0-9_]+)\]/ig);
  if (path && path.length > 0) {
    return (0, _fp.get)(path.map(part => part.substring(1, part.length - 1)));
  }
  return _fp.identity;
});

const replacePlaceholders = combo => type => {
  switch (type) {
    case 'selector':
      {
        const re = toSelectorsRegExp(combo);
        return pattern => pattern && pattern.replace(re, (match, colon, prefix, key, path, suffix) => {
          const value = combo[key];
          const subValue = value && value[colon ? 1 : 0];
          const subSubValue = subValue && getInPattern(path, subValue);
          if (!subSubValue) {
            return '';
          }
          return `${colon}${prefix}${subSubValue}${suffix}`;
        });
      }
    default:
      {
        const re = toDefaultRegExp(combo);
        return pattern => pattern && pattern.replace(re, (match, prefix, key, path, suffix) => {
          const value = combo[key];
          const subValue = value && value[1];
          const subSubValue = subValue && getInPattern(path, subValue);
          if (!subSubValue) {
            return '';
          }
          return `${prefix}${subSubValue}${suffix}`;
        });
      }
  }
};

const transformAST = topNode => {
  const items = [];
  (0, _utils.walkTree)((node, parents) => {
    if (node.type === 'decl') {
      const item = {
        selector: '',
        media: '',
        property: '',
        value: ''
      };
      parents.forEach(parentNode => {
        if (parentNode.type === 'rule') {
          if (item.selector) {
            if (item.selector.match(/&/)) {
              item.selector = item.selector.replace(/&/g, parentNode.selector);
            } else {
              item.selector = `${parentNode.selector} ${item.selector}`;
            }
          } else {
            item.selector = parentNode.selector;
          }
        }
        if (parentNode.type === 'atrule' && parentNode.name === 'media') {
          if (item.media) {
            item.media = `${item.media} and ${parentNode.params}`;
          } else {
            item.media = parentNode.params;
          }
        }
      });
      item.property = node.prop;
      item.value = node.value;
      items.push(item);
    }
    // console.log(node, parents);
  })('nodes')(topNode);

  return combo => {
    const replace = replacePlaceholders(combo);
    return (0, _fp.map)((0, _utils.mapValuesWithKey)((pattern, key) => replace(key)(pattern)), items);
  };
};

const generate = exports.generate = defs => cssStringParts => {
  const combos = combineDefs(defs);
  const cssString = cssStringParts.join('');
  const ast = (0, _postcss.parse)(cssString);
  const template = transformAST(ast);
  return (0, _fp.flatMap)(template, combos);
};

const atomify = exports.atomify = (0, _fp.flow)([(0, _fp.groupBy)(({ media, property, value }) => `${media}{${property}:${value}`), (0, _fp.map)(items => _extends({}, items[0], {
  selector: items.map(item => item.selector).join(', ')
}))]);

const compile = exports.compile = (0, _fp.flow)((0, _fp.uniqWith)(_fp.isEqual), atomify, (0, _fp.groupBy)('media'), (0, _fp.map)(items => items[0].media ? [`${items[0].media} {`, ...items.map(({ selector, property, value }) => [`  ${selector} {`, `    ${property}: ${value};`, '  }'].join('\n')), '}'].join('\n') : items.map(({ selector, property, value }) => [`${selector} {`, `  ${property}: ${value};`, '}'].join('\n')).join('\n')), (0, _fp.join)('\n\n'), string => `${string}\n`);