import { errors as vineErrors, type VineValidator } from '@vinejs/vine'
import type { SchemaTypes } from '@vinejs/vine/types'
import { ToolInputError } from '#services/assistant/assistant_tool'

/**
 * Validates what the model passed to a tool. A failure becomes a
 * `ToolInputError` naming each field and rule (never the value), which the
 * model reads and can correct.
 */
export async function validateToolInput<T>(
  validator: VineValidator<SchemaTypes, undefined>,
  input: Record<string, unknown>
): Promise<T> {
  try {
    return (await validator.validate(input, { meta: undefined })) as T
  } catch (error) {
    if (error instanceof vineErrors.E_VALIDATION_ERROR) {
      const problems = (error.messages as { field: string; rule: string }[])
        .map((problem) => `${problem.field} (${problem.rule})`)
        .join(', ')
      throw new ToolInputError(`Invalid input: ${problems}. Fix these fields and call again.`)
    }
    throw error
  }
}
