export function generateSrcSet(basePath: string, widths = [320, 640, 768, 1024, 1280, 1920]): string {
  const ext = basePath.split('.').pop();
  const base = basePath.replace(`.${ext}`, '');
  return widths.map(w => `${base}-${w}w.${ext} ${w}w`).join(', ');
}

export function generateSizes(breakpoints: Record<string, string> = {
  '(max-width: 640px)': '100vw',
  '(max-width: 1024px)': '50vw',
  'default': '33vw',
}): string {
  return Object.entries(breakpoints)
    .map(([bp, size]) => bp === 'default' ? size : `${bp} ${size}`)
    .join(', ');
}
