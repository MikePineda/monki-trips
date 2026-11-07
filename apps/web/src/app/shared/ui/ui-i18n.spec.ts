import { ChangeDetectionStrategy, Component } from '@angular/core'
import { TestBed } from '@angular/core/testing'
import {
  TranslocoPipe,
  TranslocoService,
  provideTransloco,
  provideTranslocoScope,
  type Translation,
  type TranslocoLoader,
} from '@jsverse/transloco'
import { firstValueFrom } from 'rxjs'
import en from '../../../../public/i18n/en.json'
import es from '../../../../public/i18n/es.json'
import { MkButtonComponent } from './button/button.component'
import { MkFieldComponent } from './field/field.component'

/** Catalogue loads a spec releases by hand, to replay the order a slow device sees. */
class LoadGates {
  private readonly waiting: { path: string; release: () => void }[] = []

  hold(path: string, catalogue: Translation): Promise<Translation> {
    return new Promise((resolve) => {
      this.waiting.push({ path, release: () => resolve(catalogue) })
    })
  }

  release(path: string): void {
    for (const gate of this.waiting.filter((item) => item.path === path)) {
      gate.release()
    }
    this.waiting.splice(
      0,
      this.waiting.length,
      ...this.waiting.filter((item) => item.path !== path)
    )
  }
}

const gates = new LoadGates()
const PROBE: Record<string, Translation> = {
  en: { label: 'Your name', action: 'Sign out' },
  es: { label: 'Tu nombre', action: 'Cerrar sesión' },
}

class GlobalLoader implements TranslocoLoader {
  getTranslation(lang: string): Promise<Translation> {
    return Promise.resolve(lang === 'es' ? es : en)
  }
}

/** A feature with its own lazily loaded scope, using ui-kit components with its copy inside. */
@Component({
  selector: 'app-probe',
  imports: [TranslocoPipe, MkButtonComponent, MkFieldComponent],
  providers: [
    provideTranslocoScope({
      scope: 'probe',
      loader: {
        en: () => gates.hold('probe/en', PROBE['en']),
        es: () => gates.hold('probe/es', PROBE['es']),
      },
    }),
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <mk-field [label]="'probe.label' | transloco"><input /></mk-field>
    <button mk-button type="button">{{ 'probe.action' | transloco }}</button>
  `,
})
class ProbeComponent {}

async function turns(count = 5): Promise<void> {
  for (let i = 0; i < count; i += 1) {
    await new Promise((resolve) => setTimeout(resolve, 0))
  }
}

describe('ui-kit Transloco scope', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideTransloco({
          config: {
            availableLangs: ['en', 'es'],
            defaultLang: 'en',
            fallbackLang: 'en',
            reRenderOnLangChange: true,
            prodMode: true,
            missingHandler: { useFallbackTranslation: true, logMissingKey: false },
          },
          loader: GlobalLoader,
        }),
      ],
    })
  })

  it('a lazy feature scope that loads after the ui scope still re-renders inside ui-kit components on a language switch', async () => {
    const transloco = TestBed.inject(TranslocoService)
    await firstValueFrom(transloco.load('en'))
    const fixture = TestBed.createComponent(ProbeComponent)
    fixture.autoDetectChanges()
    await turns()
    gates.release('probe/en')
    await turns()
    await fixture.whenStable()
    const element = fixture.nativeElement as HTMLElement
    expect(element.querySelector('button')?.textContent).toContain('Sign out')
    expect(element.querySelector('.mk-field__label')?.textContent).toContain('Your name')

    transloco.setActiveLang('es')
    // The ui scope and the global catalogue arrive first; the feature's chunk is slower.
    await turns()
    gates.release('probe/en')
    gates.release('probe/es')
    await turns()
    await fixture.whenStable()

    expect(element.querySelector('button')?.textContent).toContain('Cerrar sesión')
    expect(element.querySelector('.mk-field__label')?.textContent).toContain('Tu nombre')
  })
})
