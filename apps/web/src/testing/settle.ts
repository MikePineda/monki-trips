import type { ComponentFixture } from '@angular/core/testing'

/**
 * Lets async work the fixture started (a submit action, an API fake, a Dexie
 * write) run to completion before the spec looks at the DOM: a few
 * macrotasks, then Angular's own stability and one change detection.
 */
export async function settle(fixture: ComponentFixture<unknown>, turns = 3): Promise<void> {
  for (let i = 0; i < turns; i += 1) {
    await new Promise((resolve) => setTimeout(resolve, 0))
  }
  await fixture.whenStable()
  fixture.detectChanges()
}

/** Types into an input the way a person would: value, `input` event, then `blur`. */
export function typeInto(input: HTMLInputElement, value: string): void {
  input.value = value
  input.dispatchEvent(new Event('input'))
  input.dispatchEvent(new Event('blur'))
}
