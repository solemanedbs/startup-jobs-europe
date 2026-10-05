/* Lecture d'un CV déposé, entièrement dans le navigateur : .txt/.md, .docx (zip + XML), .pdf (pdf.js).
   Aucun octet ne quitte la machine. pdf.js n'est chargé que si un PDF est effectivement déposé. */
window.CVFile = (() => {
  const dec = new TextDecoder();

  // ---- ZIP minimal : on cherche word/document.xml via le central directory (tailles toujours fiables)
  async function unzipEntry(buf, wanted) {
    const dv = new DataView(buf), u8 = new Uint8Array(buf);
    let eocd = -1;
    for (let i = u8.length - 22; i >= Math.max(0, u8.length - 66000); i--) {
      if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
    }
    if (eocd < 0) throw new Error("zip: end of central directory introuvable");
    const nEntries = dv.getUint16(eocd + 10, true);
    let p = dv.getUint32(eocd + 16, true);
    for (let i = 0; i < nEntries; i++) {
      if (dv.getUint32(p, true) !== 0x02014b50) break;
      const method = dv.getUint16(p + 10, true);
      const compSize = dv.getUint32(p + 20, true);
      const nameLen = dv.getUint16(p + 28, true), extraLen = dv.getUint16(p + 30, true), commLen = dv.getUint16(p + 32, true);
      const lho = dv.getUint32(p + 42, true);
      const name = dec.decode(u8.subarray(p + 46, p + 46 + nameLen));
      if (name === wanted) {
        // en-tête local : les longueurs de nom/extra peuvent différer de celles du central directory
        const lNameLen = dv.getUint16(lho + 26, true), lExtraLen = dv.getUint16(lho + 28, true);
        const start = lho + 30 + lNameLen + lExtraLen;
        const data = u8.subarray(start, start + compSize);
        if (method === 0) return dec.decode(data);
        const ds = new DecompressionStream("deflate-raw");
        const out = await new Response(new Blob([data]).stream().pipeThrough(ds)).arrayBuffer();
        return dec.decode(out);
      }
      p += 46 + nameLen + extraLen + commLen;
    }
    throw new Error("zip: " + wanted + " absent");
  }

  function docxToText(xml) {
    return xml
      .replace(/<w:p[ >][\s\S]*?(?=<w:p[ >]|$)/g, m => m + "\n")   // un paragraphe = une ligne
      .replace(/<\/w:p>/g, "\n")
      .replace(/<w:tab\/?>/g, "\t")
      .replace(/<w:br\/?>/g, "\n")
      .replace(/<[^>]+>/g, "")
      .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'")
      .replace(/\n{3,}/g, "\n\n").replace(/[ \t]+\n/g, "\n").trim();
  }

  let pdfReady = null;
  function loadPdfJs() {
    if (pdfReady) return pdfReady;
    pdfReady = new Promise((ok, ko) => {
      const s = document.createElement("script");
      s.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
      s.onload = () => {
        try { window.pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js"; } catch (e) {}
        ok(window.pdfjsLib);
      };
      s.onerror = () => ko(new Error("pdf.js n'a pas pu être chargé (hors ligne ?)"));
      document.head.appendChild(s);
    });
    return pdfReady;
  }

  async function pdfToText(buf) {
    const lib = await loadPdfJs();
    const doc = await lib.getDocument({ data: buf }).promise;
    const out = [];
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const tc = await page.getTextContent();
      let line = "", lastY = null;
      tc.items.forEach(it => {
        const y = it.transform[5];
        if (lastY !== null && Math.abs(y - lastY) > 2) { out.push(line.trim()); line = ""; }
        line += it.str + (it.hasEOL ? "\n" : " ");
        lastY = y;
      });
      if (line.trim()) out.push(line.trim());
    }
    return out.join("\n").replace(/\n{3,}/g, "\n\n").replace(/[ \t]{2,}/g, " ").trim();
  }

  return {
    accept: ".txt,.md,.docx,.pdf",
    async read(file) {
      const name = (file.name || "").toLowerCase();
      if (file.size > 12 * 1024 * 1024) throw new Error("Fichier trop lourd (12 Mo max).");
      if (name.endsWith(".txt") || name.endsWith(".md")) return (await file.text()).trim();
      const buf = await file.arrayBuffer();
      if (name.endsWith(".docx")) return docxToText(await unzipEntry(buf, "word/document.xml"));
      if (name.endsWith(".pdf")) {
        const t = await pdfToText(buf);
        if (t.replace(/\s/g, "").length < 40) throw new Error("Ce PDF ne contient pas de texte (document scanné ?). Copiez-collez le contenu à la main.");
        return t;
      }
      if (name.endsWith(".doc")) throw new Error("Les .doc anciens ne sont pas lisibles ici. Enregistrez en .docx ou en PDF.");
      throw new Error("Format non reconnu. Déposez un .pdf, .docx, .txt ou .md.");
    }
  };
})();
