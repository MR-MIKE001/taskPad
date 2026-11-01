export function downloadFile(filename: string, content: string, mime: string): void {
  // A BOM makes Excel open UTF-8 CSV correctly; harmless for JSON consumers that we control.
  const body = mime.startsWith('text/csv') ? `${String.fromCharCode(0xfeff)}${content}` : content;
  const url = URL.createObjectURL(new Blob([body], { type: `${mime};charset=utf-8` }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
