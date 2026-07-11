import fileDownload from 'js-file-download'

export function downloadText(filename: string, text: string, type = 'text/plain;charset=utf-8'): void {
  fileDownload(text, filename, type)
}
