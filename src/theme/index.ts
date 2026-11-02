// Colours are taken from the Penpot designs. Text sizes and targets are deliberately larger than the
// designs, whose 9-12px labels are too small for the people this app is for.
export const colors = {
  background: '#F4F1E8',
  surface: '#FFFEFA',
  ink: '#26352D',
  // The design's #7D887E only reaches 3.3:1 on the cream background; this one passes WCAG AA.
  muted: '#5A665C',
  sage: '#55745D',
  sageSoft: '#E5EBDD',
  sagePill: '#6E8A73',
  sageTrack: '#D7DCD2',
  onSage: '#FFFFFF',
  onSageSoft: '#E8F0E5',
  onSageLabel: '#DCE8D9',
  divider: '#E6E2D8',
  tipCard: '#E9EDE4',
  artTile: '#DDE6D7',
  artCircle: '#C7D8C2',
  stop: '#F0E4D7',
  stopText: '#8A583E',
};

// Icon circle tints, cycled through list rows as in the Music Library and Playlists designs.
export const tints = ['#E6EAD9', '#F0E5D3', '#DDE8E2'];

export const fonts = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
};

export const spacing = { screen: 18, card: 18, gap: 14 };

export const radius = { hero: 24, card: 18, button: 16, field: 14 };

export const MIN_TOUCH = 56;
