<?xml version="1.0" encoding="UTF-8"?>
<!-- Met en forme les flux RSS dans le navigateur. Sans ça, cliquer sur « RSS » affiche
     du XML brut, que les navigateurs ne mettent plus en forme depuis des années. -->
<xsl:stylesheet version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform">
<xsl:output method="html" encoding="UTF-8" indent="yes"/>
<xsl:template match="/">
<html lang="en"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title><xsl:value-of select="rss/channel/title"/></title>
<link rel="icon" href="/favicon.svg" type="image/svg+xml"/>
<style>
:root{--bg:#fbfaf7;--fg:#1a1a1c;--muted:#6b6b72;--line:#e4e2dc;--card:#fff;--acc:#1b4dd8}
@media(prefers-color-scheme:dark){:root{--bg:#121214;--fg:#ececed;--muted:#9a9aa2;--line:#2a2a2f;--card:#18181b;--acc:#8aa9ff}}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--fg);font:16px/1.55 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif}
.wrap{max-width:760px;margin:0 auto;padding:40px 20px 80px}
h1{font-size:1.5rem;margin:0 0 6px;line-height:1.25}
.note{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:16px 18px;margin:24px 0 28px;font-size:.9rem;color:var(--muted)}
.note b{color:var(--fg)}
.note code{background:var(--bg);border:1px solid var(--line);border-radius:5px;padding:1px 6px;font-size:.85em;word-break:break-all}
ol{list-style:none;margin:0;padding:0}
li{border-bottom:1px solid var(--line);padding:14px 0}
li a{color:var(--fg);text-decoration:none;font-weight:600;display:block}
li a:hover{color:var(--acc)}
.m{color:var(--muted);font-size:.85rem;margin-top:3px}
.back{display:inline-block;margin-bottom:22px;color:var(--acc);text-decoration:none;font-size:.9rem}
</style></head>
<body><div class="wrap">
<a class="back" href="/">← All roles on tractionjobs.com</a>
<h1><xsl:value-of select="rss/channel/title"/></h1>
<p class="m"><xsl:value-of select="rss/channel/description"/></p>
<div class="note"><b>This page is a feed, not a normal web page.</b> Paste its address into a
feed reader and new roles appear there on their own, without visiting the site. The address is
the one in your browser bar — it ends in <code>.xml</code>. If you don't use a feed reader,
just <a href="/">browse the site</a> instead.</div>
<ol>
<xsl:for-each select="rss/channel/item">
<li><a href="{link}" target="_blank" rel="noopener"><xsl:value-of select="title"/></a>
<div class="m"><xsl:value-of select="description"/> · <xsl:value-of select="pubDate"/></div></li>
</xsl:for-each>
</ol>
</div></body></html>
</xsl:template>
</xsl:stylesheet>
