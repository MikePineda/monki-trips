import { readFileSync } from 'node:fs'
import ajv2020, { type ErrorObject, type ValidateFunction } from 'ajv/dist/2020.js'
import app from '@adonisjs/core/services/app'
import type { I18n } from '@adonisjs/i18n'

// ajv is CommonJS: under NodeNext the default import is the module, the class sits on `.default`.
const Ajv2020 = ajv2020.default

/** Where the published schema lives (`GET /schemas/trip-json-v1` serves this file). */
export const TRIP_JSON_SCHEMA_PATH = 'resources/schemas/trip-json-v1.schema.json'

/** A schema failure in the shape of a validation error entry. */
export interface SchemaProblem {
  field: string
  rule: string
  message: string
}

/** JSON Schema keywords worded with the validator catalog's rules where one fits. */
const RULE_OF_KEYWORD: Record<string, string> = {
  required: 'required',
  enum: 'enum',
  const: 'enum',
  pattern: 'regex',
  minLength: 'minLength',
  maxLength: 'maxLength',
  minimum: 'min',
  maximum: 'max',
  uniqueItems: 'distinct',
}
const RULE_OF_TYPE: Record<string, string> = {
  string: 'string',
  integer: 'withoutDecimals',
  number: 'number',
  boolean: 'boolean',
  array: 'array',
  object: 'object',
}

let schema: Record<string, unknown> | undefined
let validate: ValidateFunction | undefined

/** The schema document itself, parsed once. */
export function tripJsonSchema(): Record<string, unknown> {
  schema ??= JSON.parse(readFileSync(app.makePath(TRIP_JSON_SCHEMA_PATH), 'utf8'))
  return schema!
}

function validator(): ValidateFunction {
  if (!validate) {
    const ajv = new Ajv2020({ allErrors: true, strict: true, allowUnionTypes: true })
    validate = ajv.compile(tripJsonSchema())
  }
  return validate!
}

/** `/events/2/stopRef` as the validator catalog writes paths: `events[2].stopRef`. */
function fieldPath(error: ErrorObject): string {
  const segments = error.instancePath.split('/').slice(1).map(decodeURIComponent)
  if (error.keyword === 'required') {
    segments.push(String((error.params as { missingProperty: string }).missingProperty))
  }
  return segments.reduce(
    (path, segment) =>
      /^\d+$/.test(segment) ? `${path}[${segment}]` : path ? `${path}.${segment}` : segment,
    ''
  )
}

/**
 * Checks a parsed document against the trip JSON v1 schema. Problems are
 * worded like VineJS failures (`validator.shared.messages.<rule>`), so a 422
 * reads the same whether the schema or an entity validator refused the file.
 * `oneOf`/`anyOf` wrappers themselves are left out: their branches report.
 */
export function validateTripJson(input: unknown, i18n: I18n): SchemaProblem[] {
  const check = validator()
  if (check(input)) return []
  const seen = new Set<string>()
  const problems: SchemaProblem[] = []
  for (const error of check.errors ?? []) {
    if (error.keyword === 'oneOf' || error.keyword === 'anyOf') continue
    const field = fieldPath(error) || 'document'
    const rule =
      error.keyword === 'type'
        ? (RULE_OF_TYPE[String((error.params as { type: string }).type).split(',')[0]] ?? 'string')
        : (RULE_OF_KEYWORD[error.keyword] ?? 'schema')
    const key = `${field}:${rule}`
    if (seen.has(key)) continue
    seen.add(key)
    const name = field
      .split('.')
      .pop()!
      .replace(/\[\d+\]$/, '')
    const label = i18n.t(`validator.shared.fields.${name}`, {}, name)
    const params = error.params as Record<string, unknown>
    problems.push({
      field,
      rule,
      message: i18n.t(
        `validator.shared.messages.${rule}`,
        {
          field: label,
          min: params['limit'] ?? '',
          max: params['limit'] ?? '',
          choices: Array.isArray(params['allowedValues']) ? params['allowedValues'].join(', ') : '',
        },
        `${label} ${error.message ?? 'does not match the schema'}`
      ),
    })
  }
  return problems
}
