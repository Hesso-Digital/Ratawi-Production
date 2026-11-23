/// <reference types="vite/client" />

/** File names of the GLB models present in public/models at build time (see vite.config.ts). */
declare module 'virtual:field-models' {
  const files: string[];
  export default files;
}
