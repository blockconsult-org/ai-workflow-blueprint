/** Wrap at word boundaries; keep characters intact for portable diagram exports. */
export function wrap(value: string, length = 44): string[] {
  const lines: string[] = [];
  for (let paragraph of value.split("\n")) {
    while (paragraph.length > length) {
      const space = paragraph.lastIndexOf(" ", length - 1);
      const end = space >= length / 3 ? space + 1 : length;
      lines.push(paragraph.slice(0, end));
      paragraph = paragraph.slice(end);
    }
    lines.push(paragraph);
  }
  return lines.length ? lines : ["—"];
}
