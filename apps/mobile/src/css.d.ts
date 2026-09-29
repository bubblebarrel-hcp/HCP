// Type declarations for the CSS imports the Expo web template uses
// (src/global.css, *.module.css). Metro handles the actual bundling.
declare module '*.module.css' {
  const classes: Record<string, string>;
  export default classes;
}

declare module '*.css';
