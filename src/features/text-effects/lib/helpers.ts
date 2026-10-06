import { TextEffectDefinition } from "../types/types";

/**
 * Parses hex or rgba/rgb color strings into [r, g, b, a] numeric array.
 * @param color - The input color string.
 * @returns An array representing [r, g, b, a].
 */
export const parseColor = (color: string): number[] => {
  const col = color.trim();
  if (col.startsWith("#")) {
    if (col.length === 4) {
      const r = parseInt(col[1] + col[1], 16);
      const g = parseInt(col[2] + col[2], 16);
      const b = parseInt(col[3] + col[3], 16);
      return [r, g, b, 1];
    }
    const r = parseInt(col.slice(1, 3), 16);
    const g = parseInt(col.slice(3, 5), 16);
    const b = parseInt(col.slice(5, 7), 16);
    const a = col.length === 9 ? parseInt(col.slice(7, 9), 16) / 255 : 1;
    return [r, g, b, a];
  }
  if (col.startsWith("rgba") || col.startsWith("rgb")) {
    const match = col.match(/\d+(\.\d+)?/g);
    if (match) {
      const r = parseInt(match[0], 10);
      const g = parseInt(match[1], 10);
      const b = parseInt(match[2], 10);
      const a = match[3] ? parseFloat(match[3]) : 1;
      return [r, g, b, a];
    }
  }
  return [255, 255, 255, 1];
};

/**
 * Interpolates two color strings linearly by a factor between 0.0 and 1.0.
 * @param color1 - Back/Start color.
 * @param color2 - Front/End color.
 * @param factor - Interpolation step.
 * @returns The interpolated rgba color string.
 */
export const interpolateColor = (color1: string, color2: string, factor: number): string => {
  const c1 = parseColor(color1);
  const c2 = parseColor(color2);

  const r = Math.round(c1[0] + (c2[0] - c1[0]) * factor);
  const g = Math.round(c1[1] + (c2[1] - c1[1]) * factor);
  const b = Math.round(c1[2] + (c2[2] - c1[2]) * factor);
  const a = c1[3] + (c2[3] - c1[3]) * factor;

  return `rgba(${r}, ${g}, ${b}, ${a})`;
};

/**
 * Applies font configuration styles to a CanvasRenderingContext2D.
 * @param ctx - The target rendering context.
 * @param font - Font parameters.
 * @param fontSize - Font size in pixels.
 */
export const applyFontConfig = (ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D, font: TextEffectDefinition["font"], fontSize: number) => {
  const family = getFontFamilyStack(font.family);

  ctx.font = `${font.style} ${font.weight} ${fontSize}px ${family}`;
  ctx.textBaseline = "middle";
  ctx.textAlign = "center";
  if (typeof (ctx as any).letterSpacing !== "undefined") {
    (ctx as any).letterSpacing = `${font.letterSpacing}px`;
  }
};

/**
 * Clips canvas context to text shape so inner shadows and texture fills don't bleed.
 * @param ctx - Canvas rendering context.
 * @param lines - Array of text lines.
 * @param fontSize - Size of font.
 * @param font - Font configuration block.
 * @param x - Center anchor X.
 * @param y - Center anchor Y.
 */
export const clipToText = (ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D, lines: string[], fontSize: number, font: TextEffectDefinition["font"], x: number, y: number) => {
  ctx.globalCompositeOperation = "source-atop";
};

export const getFontFamilyStack = (fontFamily: string) => {
  const f = fontFamily?.toLowerCase() || "";

  // Google Web Fonts (Variable)
  if (f.includes("inter")) return '"Inter Variable", sans-serif';
  if (f.includes("montserrat")) return '"Montserrat Variable", sans-serif';
  if (f.includes("geist")) return '"Geist Variable", sans-serif';
  if (f.includes("space grotesk") || f.includes("grotesk")) return '"Space Grotesk Variable", sans-serif';
  if (f.includes("outfit")) return '"Outfit Variable", sans-serif';
  if (f.includes("roboto variable")) return '"Roboto Variable", sans-serif';
  if (f.includes("roboto condensed")) return '"Roboto Condensed", sans-serif';
  if (f === "roboto") return '"Roboto Variable", sans-serif';
  if (f.includes("open sans")) return '"Open Sans Variable", sans-serif';
  if (f.includes("raleway")) return '"Raleway Variable", sans-serif';
  if (f.includes("oswald")) return '"Oswald Variable", sans-serif';
  if (f.includes("playfair display")) return '"Playfair Display Variable", serif';
  if (f.includes("nunito")) return '"Nunito Variable", sans-serif';
  if (f.includes("dancing script")) return '"Dancing Script Variable", cursive';

  // Google Web Fonts (Non-Variable / Static)
  if (f === "lato") return '"Lato", sans-serif';
  if (f === "anton") return '"Anton", sans-serif';
  if (f === "bebas neue") return '"Bebas Neue", sans-serif';
  if (f === "poppins") return '"Poppins", sans-serif';
  if (f === "permanent marker") return '"Permanent Marker", cursive';
  if (f === "bangers") return '"Bangers", cursive';
  if (f === "press start 2p") return '"Press Start 2P", monospace';
  if (f === "pacifico") return '"Pacifico", cursive';

  // System Fonts
  if (f === "arial") return "Arial, sans-serif";
  if (f === "arial black") return '"Arial Black", sans-serif';
  if (f === "arial rounded mt bold") return '"Arial Rounded MT Bold", sans-serif';
  if (f === "georgia") return "Georgia, serif";
  if (f === "times new roman") return '"Times New Roman", serif';
  if (f === "courier new") return '"Courier New", monospace';
  if (f === "impact") return "Impact, sans-serif";
  if (f === "verdana") return "Verdana, sans-serif";
  if (f === "trebuchet ms") return '"Trebuchet MS", sans-serif';
  if (f === "palatino") return "Palatino, serif";

  // Fallbacks
  const isMono = f.includes("mono") || f.includes("courier") || f.includes("press start");
  const isSerif = f.includes("georgia") || f.includes("times") || f.includes("playfair");
  const isCursive = f.includes("script") || f.includes("marker") || f.includes("bangers") || f.includes("pacifico");
  const fallback = isMono ? "monospace" : isSerif ? "serif" : isCursive ? "cursive" : "sans-serif";
  return `"${fontFamily}", ${fallback}`;
};

/**
 * Resolves a font family name to its exact Fontsource-registered name.
 * Returns the BARE name without CSS quotes or fallback stacks.
 *
 * Use this when the caller will add its own quoting (e.g. engine ctx.font strings).
 * Use getFontFamilyStack() when you need a full CSS font-family value with fallbacks.
 *
 * @param fontFamily - Raw font family name from effect definitions (e.g. "Montserrat")
 * @returns Exact registered name (e.g. "Montserrat Variable")
 */
export const resolveFontFamilyName = (fontFamily: string): string => {
  const f = fontFamily?.toLowerCase() || "";

  // Google Web Fonts (Variable) — Fontsource registers these with " Variable" suffix
  if (f.includes("inter")) return "Inter Variable";
  if (f.includes("montserrat")) return "Montserrat Variable";
  if (f.includes("geist")) return "Geist Variable";
  if (f.includes("space grotesk") || f.includes("grotesk")) return "Space Grotesk Variable";
  if (f.includes("outfit")) return "Outfit Variable";
  if (f.includes("roboto variable")) return "Roboto Variable";
  if (f.includes("roboto condensed")) return "Roboto Condensed";
  if (f === "roboto") return "Roboto Variable";
  if (f.includes("open sans")) return "Open Sans Variable";
  if (f.includes("raleway")) return "Raleway Variable";
  if (f.includes("oswald")) return "Oswald Variable";
  if (f.includes("playfair display")) return "Playfair Display Variable";
  if (f.includes("nunito")) return "Nunito Variable";
  if (f.includes("dancing script")) return "Dancing Script Variable";

  // Google Web Fonts (Non-Variable / Static) — name matches registration
  if (f === "lato") return "Lato";
  if (f === "anton") return "Anton";
  if (f === "bebas neue") return "Bebas Neue";
  if (f === "poppins") return "Poppins";
  if (f === "permanent marker") return "Permanent Marker";
  if (f === "bangers") return "Bangers";
  if (f === "press start 2p") return "Press Start 2P";
  if (f === "pacifico") return "Pacifico";

  // System / unknown fonts — return as-is
  return fontFamily;
};

/**
 * Wraps a block of text into multiple lines based on maximum pixel width bounds.
 * Preserves deliberate formatting of short words and splits long sentences elegantly.
 */
export const wrapText = (
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] => {
  const words = text.split(" ");
  const lines: string[] = [];
  let currentLine = "";

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const metrics = ctx.measureText(testLine);

    if (metrics.width > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines.length > 0 ? lines : [text];
};

