// Spin tax utilities
// Syntax: {option1|option2|option3} — nesting supported.

type Node = { type: "text"; value: string } | { type: "spin"; options: Node[][] };

function parseNodes(input: string, start = 0, stopAtBrace = false): { nodes: Node[]; end: number } {
  const nodes: Node[] = [];
  let buf = "";
  let i = start;
  const flush = () => { if (buf) { nodes.push({ type: "text", value: buf }); buf = ""; } };
  while (i < input.length) {
    const ch = input[i];
    if (ch === "\\" && i + 1 < input.length) { buf += input[i + 1]; i += 2; continue; }
    if (stopAtBrace && (ch === "|" || ch === "}")) { flush(); return { nodes, end: i }; }
    if (ch === "{") {
      // parse spin block
      flush();
      const options: Node[][] = [];
      let j = i + 1;
      while (true) {
        const seg = parseNodes(input, j, true);
        options.push(seg.nodes);
        j = seg.end;
        if (j >= input.length) break;
        if (input[j] === "|") { j++; continue; }
        if (input[j] === "}") { j++; break; }
      }
      nodes.push({ type: "spin", options });
      i = j;
      continue;
    }
    buf += ch;
    i++;
  }
  flush();
  return { nodes, end: i };
}

function expand(nodes: Node[]): string[] {
  let acc: string[] = [""];
  for (const n of nodes) {
    if (n.type === "text") {
      acc = acc.map(s => s + n.value);
    } else {
      const expansions = n.options.flatMap(opt => expand(opt));
      const next: string[] = [];
      for (const base of acc) for (const ex of expansions) next.push(base + ex);
      acc = next;
    }
  }
  return acc;
}

export function countSpinTaxVariations(template: string): number {
  if (!template) return 0;
  const { nodes } = parseNodes(template);
  const visit = (ns: Node[]): number => ns.reduce((m, n) => {
    if (n.type === "text") return m;
    return m * n.options.reduce((s, o) => s + visit(o), 0);
  }, 1);
  return visit(nodes);
}

export function generateSpinTaxVariations(template: string, max = 500): string[] {
  if (!template) return [];
  const { nodes } = parseNodes(template);
  const all = expand(nodes);
  // dedupe & cap
  return Array.from(new Set(all)).slice(0, max);
}

export function pickSpinTaxVariation(template: string, seed?: number): string {
  const variations = generateSpinTaxVariations(template, 1000);
  if (variations.length === 0) return template;
  const idx = seed === undefined
    ? Math.floor(Math.random() * variations.length)
    : Math.abs(seed) % variations.length;
  return variations[idx];
}
