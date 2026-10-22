// Words an error in the UI language: core errors carry a `code` (DESIGN.md D21).
import { t } from './t'

export function errorText(e: unknown): string {
  const code = (e as { code?: unknown } | null)?.code
  const errors: Record<string, string> = t().common.errors
  if (typeof code === 'string' && code in errors) return errors[code]!
  if (e instanceof RangeError && /route is too short/.test(e.message)) return errors.routeTooShort!
  return e instanceof Error ? e.message : String(e)
}
