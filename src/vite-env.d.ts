/// <reference types="vite/client" />

// Vite's ?inline suffix — returns the processed CSS as a string (used for Shadow DOM injection)
declare module '*?inline' {
  const content: string;
  export default content;
}