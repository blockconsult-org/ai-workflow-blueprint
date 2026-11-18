import { copy, errorText } from "./copy";
import { planningIssues } from "./brief";
import { wrap } from "./text";
import type { Model } from "./model";
export function download(name: string, data: string | Blob, type = "text/plain;charset=utf-8") {
  const url = URL.createObjectURL(data instanceof Blob ? data : new Blob([data], { type }));
  const a = document.createElement("a"); a.href = url; a.download = name; a.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
export function serializeSvg(svg: SVGSVGElement): string {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  const originals = [svg, ...svg.querySelectorAll("*")], copies = [clone, ...clone.querySelectorAll("*")];
  originals.forEach((el, i) => {
    const computed = getComputedStyle(el);
    for (const property of ["fill", "stroke", "stroke-width", "stroke-dasharray", "font-family", "font-size", "font-weight"]) {
      const value = computed.getPropertyValue(property);
      (copies[i] as SVGElement).style.setProperty(property, value);
      if (copies[i].hasAttribute(property)) copies[i].setAttribute(property, value);
    }
  });
  clone.removeAttribute("class"); clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  return new XMLSerializer().serializeToString(clone);
}
export async function pngFromSvg(markup: string, width: number, height: number): Promise<Blob> {
  const url = URL.createObjectURL(new Blob([markup], { type: "image/svg+xml" }));
  try {
    const image = new Image();
    await new Promise<void>((resolve, reject) => { image.onload = () => resolve(); image.onerror = () => reject(new Error("image")); image.src = url; });
    const canvas = document.createElement("canvas"); canvas.width = width; canvas.height = height;
    const ctx = canvas.getContext("2d"); if (!ctx) throw new Error("canvas");
    ctx.drawImage(image, 0, 0, width, height);
    return await new Promise<Blob>((resolve, reject) => canvas.toBlob(b => b ? resolve(b) : reject(new Error("png")), "image/png"));
  } finally { URL.revokeObjectURL(url); }
}
function escape(s: string) { return s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&apos;"); }
export function summarySvg(m: Model): { markup: string; width: number; height: number } {
  const c = copy[m.locale], issues = planningIssues(m);
  const paragraphs = [c.title, c.report + " · v1", `${m.steps.length} ${c.steps} · ${m.edges.length} ${c.branches} · ${m.steps.filter(s => s.type === "review").length} ${c.reviews}`,
    issues.length ? `${c.issues}: ${issues.map(i => errorText(i.code, m.locale)).join(" ")}` : c.valid,
    `${c.objective}: ${m.inputs.objective || c.empty}`, `${c.output}: ${m.inputs.output || c.empty}`,
    m.approval === "each" ? c.eachHelp : c.authorizedHelp,
    `${c.assumptions}: ${m.inputs.assumptions || c.empty}`, c.summaryAssumption, c.planning];
  let y = 52;
  const texts = paragraphs.flatMap((p, index) => {
    const lines = wrap(p, index === 0 ? 40 : 88);
    const result = lines.map(line => { const current = y; y += index === 0 ? 46 : 26; return `<text x="44" y="${current}" font-size="${index === 0 ? 32 : 18}" fill="${index === 0 ? "#245be8" : "#1d2433"}">${escape(line)}</text>`; });
    y += 22; return result;
  });
  const height = y + 20;
  return { width: 1060, height, markup: `<svg xmlns="http://www.w3.org/2000/svg" width="1060" height="${height}" viewBox="0 0 1060 ${height}" font-family="Arial, sans-serif"><rect width="1060" height="${height}" fill="#f7f8fa"/>${texts.join("")}</svg>` };
}
