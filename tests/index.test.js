import { parse } from 'postcss';

import {
  stripIndent,
} from 'common-tags';

import {
  generate,
  combineDefs,
  compile,
} from '../src';

describe('parser', () => {
  it('works', () => {
    const input = `
      .<a><b><c>:<state> {
        @media <media> {
          <property>: <value>;
        }
        &:hover {
          <property>: <value>;
        }
      }
    `;
    const ast = parse(input);
    expect(ast).toMatchObject(
      {
        type: 'root',
        nodes: [
          {
            type: 'rule',
            selector: '.<a><b><c>:<state>',
            nodes: [
              {
                type: 'atrule',
                name: 'media',
                params: '<media>',
                nodes: [
                  {
                    type: 'decl',
                    prop: '<property>',
                    value: '<value>',
                  },
                ],
              },
              {
                type: 'rule',
                selector: '&:hover',
                nodes: [
                  {
                    type: 'decl',
                    prop: '<property>',
                    value: '<value>',
                  },
                ],
              },
            ],
          },
        ],
      });
  });
});

describe('generate', () => {
  it('handles css with placeholders', () => {
    const result = generate({
      color: {
        red: 'crimson',
        blue: 'deepskyblue',
      },
    })`
      .<color> {
        color: <color>;
      }
    `;
    const expectedResult = [
      {
        selector: '.red',
        property: 'color',
        value: 'crimson',
        media: '',
      },
      {
        selector: '.blue',
        property: 'color',
        value: 'deepskyblue',
        media: '',
      },
    ];
    expect(result).toEqual(expectedResult);
  });
  it('handles placeholders with prefix', () => {
    const result = generate({
      color: {
        '': 'inherit',
        red: 'crimson',
      },
    })`
      .color<-color> {
        color: <color>;
      }
    `;
    const expectedResult = [
      {
        selector: '.color',
        property: 'color',
        value: 'inherit',
        media: '',
      },
      {
        selector: '.color-red',
        property: 'color',
        value: 'crimson',
        media: '',
      },
    ];
    expect(result).toEqual(expectedResult);
  });
  it('handles nested rules', () => {
    const result = generate({
      color: {
        red: 'crimson',
        blue: 'deepskyblue',
      },
      media: {
        '': '',
        lg: '(min-width: 40em)',
      },
    })`
      .<media-><color> {
        @media <media> {
          color: <color>;
        }
      }
    `;
    const expectedResult = [
      {
        selector: '.red',
        property: 'color',
        value: 'crimson',
        media: '',
      },
      {
        selector: '.lg-red',
        property: 'color',
        value: 'crimson',
        media: '(min-width: 40em)',
      },
      {
        selector: '.blue',
        property: 'color',
        value: 'deepskyblue',
        media: '',
      },
      {
        selector: '.lg-blue',
        property: 'color',
        value: 'deepskyblue',
        media: '(min-width: 40em)',
      },
    ];
    expect(result).toEqual(expectedResult);
  });
  it('handles pseudo-classes', () => {
    const result = generate({
      color: {
        red: 'crimson',
        blue: 'deepskyblue',
      },
      state: {
        '': '',
        hover: 'hover',
      },
    })`
      .<state-><color>:<state> {
        color: <color>;
      }
    `;
    const expectedResult = [
      {
        selector: '.red',
        property: 'color',
        value: 'crimson',
        media: '',
      },
      {
        selector: '.hover-red:hover',
        property: 'color',
        value: 'crimson',
        media: '',
      },
      {
        selector: '.blue',
        property: 'color',
        value: 'deepskyblue',
        media: '',
      },
      {
        selector: '.hover-blue:hover',
        property: 'color',
        value: 'deepskyblue',
        media: '',
      },
    ];
    expect(result).toEqual(expectedResult);
  });
  it('handles non-scalar values', () => {
    const result = generate({
      color: {
        red: [['crimson', 'rgba(220, 20, 60, .5)']],
      },
    })`
      .outline-<color> {
        border-color: <color[0]>;
        box-shadow: 0 0 0 2px <color[1]>;
      }
    `;
    const expectedResult = [
      {
        selector: '.outline-red',
        property: 'border-color',
        value: 'crimson',
        media: '',
      },
      {
        selector: '.outline-red',
        property: 'box-shadow',
        value: '0 0 0 2px rgba(220, 20, 60, .5)',
        media: '',
      },
    ];
    expect(result).toEqual(expectedResult);
  });
});

describe('combineDefs', () => {
  it('handles defs with string-to-string mappings', () => {
    const result = combineDefs({
      direction: {
        t: 'top',
        b: 'bottom',
      },
      space: {
        0: '0',
        1: '.5rem',
      },
    });
    const expectedResult = [
      {
        direction: ['t', 'top'],
        space: ['0', '0'],
      },
      {
        direction: ['t', 'top'],
        space: ['1', '.5rem'],
      },
      {
        direction: ['b', 'bottom'],
        space: ['0', '0'],
      },
      {
        direction: ['b', 'bottom'],
        space: ['1', '.5rem'],
      },
    ];
    expect(result).toEqual(expectedResult);
  });
  it('handles defs with string-to-array mappings', () => {
    const result = combineDefs({
      direction: {
        y: ['top', 'bottom'],
      },
      space: {
        1: '.5rem',
      },
    });
    const expectedResult = [
      {
        direction: ['y', 'top'],
        space: ['1', '.5rem'],
      },
      {
        direction: ['y', 'bottom'],
        space: ['1', '.5rem'],
      },
    ];
    expect(result).toEqual(expectedResult);
  });
});

describe('compile', () => {
  it('compiles items into css', () => {
    const result = compile([
      ...generate({
        color: {
          red: 'crimson',
          blue: 'deepskyblue',
        },
        media: {
          '': '',
          lg: '(min-width: 40em)',
        },
        state: {
          '': '',
          hover: 'hover',
        },
      })`
        @media <media> {
          .<media-><color> {
            color: <color>;
          }
          .<media-><state-><color>:<state> {
            color: <color>;
          }
        }
      `,
    ]);
    expect(result).toEqual(`${stripIndent`
      .red, .hover-red:hover {
        color: crimson;
      }
      .blue, .hover-blue:hover {
        color: deepskyblue;
      }

      (min-width: 40em) {
        .lg-red, .lg-hover-red:hover {
          color: crimson;
        }
        .lg-blue, .lg-hover-blue:hover {
          color: deepskyblue;
        }
      }
    `}\n`);
  });
});
