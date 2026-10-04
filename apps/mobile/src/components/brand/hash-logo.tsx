import { Ellipse, G, Path, Svg } from 'react-native-svg';

// The Shiggy Trails mark: the footprints from the brand asset (hash-logo.svg), re-framed
// from the artwork's own viewBox into a 64x64 square with 2px of padding. Each
// shape is stroked in its own ink as well as filled, for a bolder weight.
// Single-colour, so callers pass the theme ink.
export function HashLogo({ size = 32, color = '#171717' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64">
      <G transform="translate(-15.86 -15.51) scale(1.1536)" strokeWidth={0.9} strokeLinejoin="round">
        <G transform="rotate(12 40 40)"><Path d="m34.1 42.12c0-2.56 1.14-4.41 2.35-6.18 0.88-1.29 1.28-2.81 1.28-4.45 0-3.18-1.83-5.38-4.99-5.38-4.3 0-12.35 4.99-12.35 11.31 0 2.26 0.87 4.35 2.18 6.35 1.66 2.54 2.92 5.36 3.41 8.86 0.69 5.11 3.36 7.8 6.49 7.8 3.32 0 5.93-2.67 5.93-6.08 0-1.88-0.65-3.69-1.82-5.45-1.63-2.36-2.48-4.55-2.48-6.78z" fill={color} stroke={color}/>
        <Ellipse cx="33.92" cy="21.15" rx="2.854" ry="3.918" fill={color} stroke={color}/>
        <Ellipse cx="28.41" cy="22.74" rx="1.933" ry="2.865" fill={color} stroke={color}/>
        <Ellipse transform="rotate(-10.5 24.24 25.38)" cx="24.24" cy="25.38" rx="1.755" ry="2.476" fill={color} stroke={color}/>
        <Ellipse transform="rotate(-20.05 21.12 28.56)" cx="21.12" cy="28.56" rx="1.504" ry="2.033" fill={color} stroke={color}/>
        <Ellipse transform="rotate(-28.36 19.11 32.03)" cx="19.11" cy="32.03" rx="1.302" ry="1.763" fill={color} stroke={color}/>
        <Path d="m47.96 30.66c-3.66 0-5.64 2.71-5.64 6.22 0 1.67 0.76 3.35 1.79 4.87 1.19 1.74 1.76 3.38 1.76 5.22 0 2.61-1.07 5.13-2.64 7.34-1.25 1.75-1.83 3.36-1.83 5.04 0 3.32 2.41 5.6 5.37 5.6 3.45 0 6.26-2.96 7-8.09 0.49-3.54 1.51-6.49 3.44-9.41 1.54-2.34 2.26-4.6 2.26-6.68 0-6.29-6.77-10.11-11.51-10.11z" fill={color} stroke={color}/>
        <Ellipse transform="rotate(15 46.68 25.92)" cx="46.68" cy="25.92" rx="2.726" ry="3.911" fill={color} stroke={color}/>
        <Ellipse transform="rotate(15 52.25 27.17)" cx="52.25" cy="27.17" rx="1.863" ry="2.758" fill={color} stroke={color}/>
        <Ellipse transform="rotate(24.32 56.25 29.35)" cx="56.25" cy="29.35" rx="1.644" ry="2.372" fill={color} stroke={color}/>
        <Ellipse transform="rotate(31.57 59.23 32.22)" cx="59.23" cy="32.22" rx="1.457" ry="2.134" fill={color} stroke={color}/>
        <Ellipse transform="rotate(35.18 61.06 35.69)" cx="61.06" cy="35.69" rx="1.263" ry="1.828" fill={color} stroke={color}/></G>
      </G>
    </Svg>
  );
}
