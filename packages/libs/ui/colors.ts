import type { SymbolLayerSpecification } from 'maplibre-gl';

const lightPrimaryTextPaint: SymbolLayerSpecification['paint'] = {
  'text-color': 'hsl(42, 10%, 14%)',
  'text-halo-width': 2,
  'text-halo-color': 'hsl(42, 10%, 100%)',
};

const lightSecondaryTextPaint: SymbolLayerSpecification['paint'] = {
  'text-color': 'hsl(42, 10%, 24%)',
  'text-halo-width': 2,
  'text-halo-color': 'hsl(42, 10%, 100%)',
};

const darkPrimaryTextPaint: SymbolLayerSpecification['paint'] = {
  'text-color': 'hsl(42, 10%, 86%)',
  'text-halo-width': 2,
  'text-halo-color': 'hsl(42, 10%, 0%)',
};

const darkSecondaryTextPaint: SymbolLayerSpecification['paint'] = {
  'text-color': 'hsl(42, 10%, 76%)',
  'text-halo-width': 2,
  'text-halo-color': 'hsl(42, 10%, 0%)',
};

export type Mode = 'light' | 'dark';

export const modeColors = {
  ['light']: {
    // base
    water: '#b2cdfb',
    land: '#f8f8f8',
    stateBorder: '#aaa',
    countryBorder: '#ccc',
    // game
    primaryTextPaint: lightPrimaryTextPaint,
    secondaryTextPaint: lightSecondaryTextPaint,
    hiddenRoad: '#e9e9e8',
    footprint: '#e9e9e8',
    ferryLine: '#6c90ff88',
    ferryLabel: '#6c80ff',
    ferryHalo: '#eeeeffcc',
    trainLine: '#aaa',
    trainLabel: '#555c',
    trainHalo: '#eefc',
    mapAreaOutline: '#999a',
  },
  ['dark']: {
    // base
    water: '#36415d',
    land: '#161616',
    stateBorder: '#555',
    countryBorder: '#333',
    // game
    primaryTextPaint: darkPrimaryTextPaint,
    secondaryTextPaint: darkSecondaryTextPaint,
    hiddenRoad: '#404038',
    footprint: '#30302f88',
    ferryLine: '#6c90ff88',
    ferryLabel: '#6c80ff',
    ferryHalo: '#303028cc',
    trainLine: '#888',
    trainLabel: '#eeec',
    trainHalo: '#303028cc',
    mapAreaOutline: '#777a',
  },
};
