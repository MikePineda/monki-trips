/**
 * The semantic colour tokens of src/styles.css (mirrored from
 * docs/design/tokens.json; core/theme/tokens.spec keeps them in sync) as the
 * style guide shows them: grouped by role, each with the surfaces its
 * contrast is checked against at runtime. The values live only in CSS.
 */
export interface TokenSwatch {
  name: string
  against: readonly string[]
}

export interface TokenGroup {
  /** `styleguide.roles.<id>` */
  id: 'surface' | 'ink' | 'accent' | 'status' | 'special' | 'chart' | 'series' | 'neutral'
  tokens: readonly TokenSwatch[]
}

const SURFACES = ['surface-0', 'surface-1', 'surface-2'] as const

const on = (name: string): TokenSwatch => ({ name, against: SURFACES })
const plain = (name: string): TokenSwatch => ({ name, against: [] })

export const TOKEN_GROUPS: readonly TokenGroup[] = [
  { id: 'surface', tokens: [plain('surface-0'), plain('surface-1'), plain('surface-2')] },
  {
    id: 'ink',
    tokens: [on('ink-1'), on('ink-2'), on('ink-3'), plain('line'), on('line-strong'), on('icon')],
  },
  {
    id: 'accent',
    tokens: [
      { name: 'accent', against: [...SURFACES, 'accent-soft'] },
      { name: 'accent-ink', against: ['accent'] },
      plain('accent-soft'),
      { name: 'focus', against: [...SURFACES, 'accent-soft'] },
    ],
  },
  {
    id: 'status',
    tokens: [on('status-good'), on('status-warning'), on('status-serious'), on('status-critical')],
  },
  {
    id: 'special',
    tokens: [
      plain('print-warning'),
      { name: 'on-print-warning', against: ['print-warning'] },
      { name: 'on-print-warning-2', against: ['print-warning'] },
      on('offline'),
      on('stamp-ink'),
      on('stamp-ink-1'),
      on('stamp-ink-2'),
      on('stamp-ink-3'),
      on('stamp-ink-4'),
      plain('scrim'),
    ],
  },
  {
    id: 'chart',
    tokens: [
      plain('gridline'),
      plain('baseline'),
      { name: 'mark-neutral', against: ['surface-1'] },
      plain('mark-muted'),
    ],
  },
  {
    id: 'series',
    tokens: Array.from({ length: 8 }, (_, i) => plain(`series-${i + 1}`)),
  },
  {
    id: 'neutral',
    tokens: [100, 200, 300, 400, 500].map((step) => plain(`neutral-${step}`)),
  },
]

/** Every token name, in style-guide order. */
export const COLOR_TOKENS: readonly string[] = TOKEN_GROUPS.flatMap((group) =>
  group.tokens.map((token) => token.name)
)
