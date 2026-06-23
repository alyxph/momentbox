export const frames = [
  {
    id: 'expo-day',
    name: 'EXPO DAY',
    pattern: 'DESIGN SENDIRI',
    bg: '#ffccd5',
    accent: '#ff4cb0',
    patternBg: '#ffeef2',
    btnText: 'white',
    frameUrl: '/frames/expo-day.png',
    frame: { width: 707, height: 2000 },
    boxes: [
      { id: 1, x: 108, y: 293, width: 494, height: 322 },
      { id: 2, x: 108, y: 646, width: 494, height: 324 },
      { id: 3, x: 108, y: 1000, width: 494, height: 324 },
      { id: 4, x: 108, y: 1354, width: 494, height: 324 }
    ],
    layerOrder: ['box-1', 'box-2', 'box-3', 'box-4', 'frame']
  },
  {
    id: 'expo-kbt',
    name: 'EXPO KBT',
    pattern: 'DESIGN SENDIRI',
    bg: '#e9d5ff',
    accent: '#a855f7',
    patternBg: '#f3e8ff',
    btnText: 'white',
    frameUrl: '/frames/expo-kbt.png',
    frame: { width: 706, height: 1998 },
    boxes: [
      { id: 1, x: 45, y: 70, width: 624, height: 377 },
      { id: 2, x: 45, y: 470, width: 624, height: 375 },
      { id: 3, x: 45, y: 870, width: 624, height: 375 },
      { id: 4, x: 45, y: 1268, width: 624, height: 377 }
    ],
    layerOrder: ['box-1', 'box-2', 'box-3', 'box-4', 'frame']
  },
  {
    id: 'beach',
    name: 'BEACH SUMMER',
    pattern: 'WAVES PATTERN',
    bg: '#E0F7FA',
    accent: '#0891B2',
    patternBg: '#BAE8F2',
    btnText: 'white',
  },
  {
    id: 'minimalist',
    name: 'MINIMALIST',
    pattern: 'CLEAN STYLE',
    bg: '#FFFFFF',
    accent: '#111827',
    patternBg: '#F3F4F6',
    btnText: 'white',
  },
];

export const frameConfigs = {
  beach: {
    bg: '#E0F7FA',
    border: '#0891B2',
    headerBg: '#0891B2',
    headerText: '#E0F7FA',
    footerBg: '#BAE8F2',
    footerText: '#0369A1',
  },
  minimalist: {
    bg: '#FFFFFF',
    border: '#111827',
    headerBg: '#111827',
    headerText: '#FFFFFF',
    footerBg: '#F3F4F6',
    footerText: '#374151',
  },
};
