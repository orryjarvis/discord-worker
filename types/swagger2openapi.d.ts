declare module 'swagger2openapi' {
  export function convertObj(input: any, options?: any): Promise<{ openapi: any }>; 
  const _default: { convertObj: typeof convertObj };
  export default _default;
}
