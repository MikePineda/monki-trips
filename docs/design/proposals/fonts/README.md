# Proposal fonts

Self-hosted woff2 files for the design proposals, so every `today-*.html`
renders with zero network requests. Latin subset only, static weights, taken
unchanged from the `@fontsource/*` npm packages (version 5.3.0). Each family
is licensed under the SIL Open Font License 1.1; the licence texts are next
to the files (`LICENSE-<family>.txt`).

| Family                     | Package                                  | Weights       | Used by                     |
| -------------------------- | ---------------------------------------- | ------------- | --------------------------- |
| Fraunces                   | `@fontsource/fraunces`                   | 400, 600      | A Notebook (display)        |
| Inter                      | `@fontsource/inter`                      | 400, 500, 600 | A Notebook (text)           |
| IBM Plex Mono              | `@fontsource/ibm-plex-mono`              | 400, 500      | A Notebook, B Boarding pass |
| IBM Plex Sans              | `@fontsource/ibm-plex-sans`              | 400, 500, 600 | B Boarding pass             |
| Atkinson Hyperlegible Next | `@fontsource/atkinson-hyperlegible-next` | 400, 500, 600 | C Pixel                     |

To refresh a file: `npm pack @fontsource/<family>@<version>` in a scratch
folder, copy `package/files/<family>-latin-<weight>-normal.woff2` and the
package `LICENSE`, and update the table above. Nothing here is a runtime
dependency: the chosen direction's files move to `apps/web/public/fonts/`
in D2 (see `docs/PLAN.md` § Design pipeline). Direction C proposes Silkscreen
(`@fontsource/silkscreen`, OFL) for the text inside pixel stamps; stamps are
not on the Today screen, so that file is added only if C is chosen.
