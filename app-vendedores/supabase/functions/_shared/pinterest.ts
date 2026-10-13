// Las fotos de un tablero de Pinterest, leídas de su RSS (público). Sin
// dependencias: lo usa la función ideas-tablero y se prueba suelto.

export type FotoIdea = { foto: string; chica: string; pin: string; titulo: string };

/** "https://ar.pinterest.com/usuario/tablero/" → { usuario, tablero }; null si no es un tablero. */
export function tableroDe(url: string): { usuario: string; tablero: string } | null {
  const m = String(url || "").trim().match(
    /^https:\/\/(?:[a-z]{2,3}\.)?pinterest\.[a-z.]{2,8}\/([A-Za-z0-9_.-]{1,60})\/([A-Za-z0-9_.%-]{1,120})\/?(?:[?#].*)?$/i,
  );
  if (!m || ["pin", "search", "ideas"].indexOf(m[1].toLowerCase()) > -1) return null;
  return { usuario: m[1], tablero: m[2] };
}

function desescapar(t: string): string {
  return t.replace(/<!\[CDATA\[|\]\]>/g, "")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&");
}

/** Las fotos del RSS, sin repetidas (el mismo pin guardado dos veces), hasta 60. */
export function leerRss(xml: string): FotoIdea[] {
  const fotos: FotoIdea[] = [];
  const vistas = new Set<string>();
  for (const item of String(xml || "").split("<item>").slice(1)) {
    const dato = (re: RegExp) => ((item.match(re) || [])[1] || "").trim();
    const desc = desescapar(dato(/<description>([\s\S]*?)<\/description>/));
    const src = (desc.match(/src="(https:\/\/i\.pinimg\.com\/[^"\s]+)"/) || [])[1];
    if (!src) continue;
    // El RSS trae la foto chiquita (236x): para la grilla, la mediana; para verla grande, la de 736.
    const foto = src.replace(/\/\d+x\//, "/736x/");
    if (vistas.has(foto)) continue;
    vistas.add(foto);
    const pin = dato(/<link>([\s\S]*?)<\/link>/);
    fotos.push({
      foto,
      chica: src.replace(/\/\d+x\//, "/474x/"),
      pin: /^https:\/\/(?:[a-z]{2,3}\.)?pinterest\.[a-z.]+\/pin\//.test(pin) ? pin : "",
      titulo: desescapar(dato(/<title>([\s\S]*?)<\/title>/)).slice(0, 120),
    });
    if (fotos.length >= 60) break;
  }
  return fotos;
}
