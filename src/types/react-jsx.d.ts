// تعريف لوحدة react/jsx-runtime
declare module 'react/jsx-runtime' {
  export namespace JSX {
    interface IntrinsicElements {
      [elemName: string]: any;
    }
  }
  
  export const jsx: any;
  export const jsxs: any;
  export const Fragment: any;
}
