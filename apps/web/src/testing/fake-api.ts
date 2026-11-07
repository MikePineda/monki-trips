/**
 * Base of the in-memory stand-ins specs use in place of the typed client:
 * records every call by name (`'login'`, `'snapshot:trip-1'`) and throws the
 * scripted failure of the next call when a spec set one.
 */
export class FakeApi {
  readonly calls: string[] = []
  /** When set, the next call throws it (an ApiFailure or a network error). */
  failWith: unknown = null

  protected async run<T>(call: string, result: () => T | Promise<T>): Promise<T> {
    this.calls.push(call)
    if (this.failWith !== null) {
      const error = this.failWith
      this.failWith = null
      throw error
    }
    return result()
  }
}
