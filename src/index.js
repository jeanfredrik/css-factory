import {
  entries,
  flatMap,
  flow,
  get,
  groupBy,
  identity,
  isEqual,
  join,
  map,
  reduce,
  uniqWith,
} from 'lodash/fp';
import { parse } from 'postcss';
import {
  oneLineTrim,
} from 'common-tags';
import decurry from 'decurry';

import {
  mapValuesWithKey,
  memoizeWith,
  toArray,
  walkTree,
} from './utils';

export const combineDefs = flow([
  entries,
  reduce(
    (combos, [key, mapping]) => (
      flatMap(
        combo =>
          flow([
            entries,
            flatMap(
              ([alias, values]) =>
              flow([
                toArray,
                map(
                  value => ({
                    ...combo,
                    [key]: [alias, value],
                  }),
                ),
              ])(values),
            ),
          ])(mapping),
        combos,
      )
    ),
    [{}],
  ),
]);

const toSelectorsRegExp = memoizeWith(
  JSON.stringify,
  combo => new RegExp(
    oneLineTrim`
      (:?)
      <
        ([^a-z0-9_]*?)
        (${Object.keys(combo).join('|')})
        ((?:\\.[a-z0-9_]+)*)
        ([^a-z0-9_]*?)
      >`,
    'ig',
  ),
);

const toDefaultRegExp = memoizeWith(
  JSON.stringify,
  combo => new RegExp(
    oneLineTrim`
      <
        ([^a-z0-9_]*?)
        (${Object.keys(combo).join('|')})
        ((?:\\[[a-z0-9_]+\\])*)
        ([^a-z0-9_]*?)
      >`,
    'ig',
  ),
);

const getInPattern = decurry(
  2,
  (pathString) => {
    const path = pathString.match(/\[([a-z0-9_]+)\]/ig);
    if (path && path.length > 0) {
      return get(path.map(part => part.substring(1, part.length - 1)));
    }
    return identity;
  },
);

const replacePlaceholders = (
  combo =>
  (type) => {
    switch (type) {
      case 'selector': {
        const re = toSelectorsRegExp(combo);
        return pattern => (
          pattern && pattern.replace(
            re,
            (match, colon, prefix, key, path, suffix) => {
              const value = combo[key];
              const subValue = value && value[colon ? 1 : 0];
              const subSubValue = subValue && getInPattern(path, subValue);
              if (!subSubValue) {
                return '';
              }
              return `${colon}${prefix}${subSubValue}${suffix}`;
            },
          )
        );
      }
      default: {
        const re = toDefaultRegExp(combo);
        return pattern => (
          pattern && pattern.replace(
            re,
            (match, prefix, key, path, suffix) => {
              const value = combo[key];
              const subValue = value && value[1];
              const subSubValue = subValue && getInPattern(path, subValue);
              if (!subSubValue) {
                return '';
              }
              return `${prefix}${subSubValue}${suffix}`;
            },
          )
        );
      }
    }
  }
);

const transformAST = (topNode) => {
  const items = [];
  walkTree((node, parents) => {
    if (node.type === 'decl') {
      const item = {
        selector: '',
        media: '',
        property: '',
        value: '',
      };
      parents.forEach((parentNode) => {
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

  return (combo) => {
    const replace = replacePlaceholders(combo);
    return map(
      mapValuesWithKey(
        (pattern, key) => replace(key)(pattern),
      ),
      items,
    );
  };
};

export const generate = defs => (cssStringParts) => {
  const combos = combineDefs(defs);
  const cssString = cssStringParts.join('');
  const ast = parse(cssString);
  const template = transformAST(ast);
  return flatMap(
    template,
    combos,
  );
};

export const atomify = flow([
  groupBy(
    ({ media, property, value }) => `${media}{${property}:${value}`,
  ),
  map(
    items => ({
      ...items[0],
      selector: items.map(item => item.selector).join(', '),
    }),
  ),
]);

export const compile = flow(
  uniqWith(isEqual),
  atomify,
  groupBy('media'),
  map(
    items => (
      items[0].media
      ? [
        `${items[0].media} {`,
        ...items.map(
          ({ selector, property, value }) => [
            `  ${selector} {`,
            `    ${property}: ${value};`,
            '  }',
          ].join('\n'),
        ),
        '}',
      ].join('\n')
      : items.map(
        ({ selector, property, value }) => [
          `${selector} {`,
          `  ${property}: ${value};`,
          '}',
        ].join('\n'),
      ).join('\n')
    ),
  ),
  join('\n\n'),
  string => `${string}\n`,
);
