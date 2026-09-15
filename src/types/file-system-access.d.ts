// showSaveFilePicker isn't in TypeScript's DOM lib yet, even though the
// FileSystemFileHandle/FileSystemWritableFileStream types it returns are.
export {};

declare global {
  interface SaveFilePickerOptions {
    suggestedName?: string;
    types?: { description?: string; accept: Record<string, string[]> }[];
  }

  interface Window {
    showSaveFilePicker?(options?: SaveFilePickerOptions): Promise<FileSystemFileHandle>;
  }
}
