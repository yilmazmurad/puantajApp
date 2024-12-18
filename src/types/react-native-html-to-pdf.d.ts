declare module 'react-native-html-to-pdf' {
  export interface Options {
    html: string;
    fileName?: string;
    base64?: boolean;
    directory?: string;
    height?: number;
    width?: number;
    padding?: number;
  }

  export interface PDFFile {
    filePath: string;
    base64?: string;
  }

  export default {
    convert(options: Options): Promise<PDFFile>;
  };
}
