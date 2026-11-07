/**
 * Just enough of Cache Storage for the asset checks: `match` answers a
 * response for the URLs the spec put in, anything else is a miss.
 */
export class FakeCacheStorage {
  private readonly urls = new Set<string>()

  put(url: string): void {
    this.urls.add(url)
  }

  async match(request: RequestInfo | URL): Promise<Response | undefined> {
    const url =
      typeof request === 'string' ? request : request instanceof URL ? request.href : request.url
    return this.urls.has(url) ? new Response('{}') : undefined
  }
}
