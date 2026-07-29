# Site font sources

`LXGWWenKaiMonoLite-Site-base.woff2` is the previous site subset of the
LXGW WenKai Mono Lite Regular font stored one directory above.

The three `Noto*-SiteSymbols.ttf` files are minimal subsets used only to add
the following symbols to the site font:

- Noto Sans Math: `↻` (U+21BB), `⬡` (U+2B21)
- Noto Sans Symbols: `⌁` (U+2301), `⌕` (U+2315)
- Noto Sans Symbols 2: `✥` (U+2725), `✦` (U+2726), `✧` (U+2727)

They were downloaded from the official Noto build sites and subset with
fonttools. Noto fonts are licensed under the SIL Open Font License 1.1; see
`OFL-Noto.txt`.

Run `npm run font:optimize` to merge these subsets and the three missing
Chinese/full-width glyphs from `LXGWWenKaiMonoLite-Regular.ttf` into the
deployable WOFF2.
