/**
 * Saves a DOM node as a PNG, exactly as it renders: the browser draws the
 * node's clone (SVG foreignObject), so Tailwind 4's oklch colors, web fonts
 * and the dark theme come out as they look on screen. The whole node is
 * captured, including what is scrolled out of view.
 *
 * html-to-image is loaded on click so it stays out of the page bundle.
 */
export async function downloadNodeAsPng(node: HTMLElement, fileName: string): Promise<void> {
  const { toPng } = await import("html-to-image");
  const dataUrl = await toPng(node, {
    // 2x keeps small print legible when the image is shared to a phone or printed.
    pixelRatio: 2,
    cacheBust: true,
    backgroundColor: getComputedStyle(document.body).backgroundColor,
    // Breathing room around the card's rounded corners and shadow.
    style: { margin: "0", padding: "16px" },
    width: node.offsetWidth + 32,
    height: node.offsetHeight + 32,
  });
  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
}
