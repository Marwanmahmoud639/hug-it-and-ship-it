import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

type Theme = "system" | "light" | "dark";

/**
 * Colour palette, independent of light/dark.
 *
 * `money` is the default: black surfaces with dollar green as the primary.
 * `navy` (off-white grey with dark navy) and `lime` (the original white/black/
 * lime scheme) are retained so either can be switched back to.
 */
export type Palette = "money" | "navy" | "lime";

export const PALETTES: { key: Palette; label: string; description: string; swatch: string[] }[] = [
  {
    key: "money",
    label: "Money",
    description: "Black with dollar green. The default.",
    swatch: ["oklch(0.10 0 0)", "oklch(0.70 0.16 142)", "oklch(0.97 0 0)"],
  },
  {
    key: "navy",
    label: "Navy",
    description: "Off-white grey with dark navy, lime accent.",
    swatch: ["oklch(0.968 0.004 250)", "oklch(0.38 0.10 255)", "oklch(0.85 0.22 130)"],
  },
  {
    key: "lime",
    label: "Lime",
    description: "The original scheme — white and black with lime leading.",
    swatch: ["oklch(1 0 0)", "oklch(0.15 0 0)", "oklch(0.85 0.22 130)"],
  },
];

type Ctx = {
  theme: Theme;
  setTheme: (t: Theme) => void;
  resolved: "light" | "dark";
  palette: Palette;
  setPalette: (p: Palette) => void;
};

const ThemeCtx = createContext<Ctx | null>(null);

const THEME_KEY = "c4d-theme";
const PALETTE_KEY = "c4d-palette";

function applyTheme(theme: Theme) {
  if (typeof document === "undefined") return "light" as const;
  const root = document.documentElement;
  let resolved: "light" | "dark" = "light";
  if (theme === "system") {
    resolved = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  } else {
    resolved = theme;
  }
  root.classList.toggle("dark", resolved === "dark");
  return resolved;
}

function applyPalette(palette: Palette) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  // `money` is what :root already defines, so it carries no attribute — that
  // keeps the default path free of an extra selector and means a corrupted
  // stored value degrades to the default rather than an unstyled page.
  if (palette === "money") root.removeAttribute("data-palette");
  else root.setAttribute("data-palette", palette);
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("system");
  const [resolved, setResolved] = useState<"light" | "dark">("dark");
  const [palette, setPaletteState] = useState<Palette>("money");

  useEffect(() => {
    const storedTheme = (typeof localStorage !== "undefined" && (localStorage.getItem(THEME_KEY) as Theme)) || "system";
    setThemeState(storedTheme);
    setResolved(applyTheme(storedTheme));

    const rawPalette = typeof localStorage !== "undefined" ? localStorage.getItem(PALETTE_KEY) : null;
    const storedPalette: Palette =
      rawPalette === "lime" ? "lime" : rawPalette === "navy" ? "navy" : "money";
    setPaletteState(storedPalette);
    applyPalette(storedPalette);

    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    const listener = () => {
      if ((localStorage.getItem(THEME_KEY) as Theme) === "system") setResolved(applyTheme("system"));
    };
    mql.addEventListener("change", listener);
    return () => mql.removeEventListener("change", listener);
  }, []);

  const setTheme = (t: Theme) => {
    setThemeState(t);
    localStorage.setItem(THEME_KEY, t);
    setResolved(applyTheme(t));
  };

  const setPalette = (p: Palette) => {
    setPaletteState(p);
    localStorage.setItem(PALETTE_KEY, p);
    applyPalette(p);
  };

  return (
    <ThemeCtx.Provider value={{ theme, setTheme, resolved, palette, setPalette }}>
      {children}
    </ThemeCtx.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeCtx);
  if (!ctx) throw new Error("useTheme must be used in ThemeProvider");
  return ctx;
}
