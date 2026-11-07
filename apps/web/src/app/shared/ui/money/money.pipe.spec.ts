import { Component } from '@angular/core'
import { TestBed } from '@angular/core/testing'
import { i18nTesting } from '../../../../testing/i18n-testing'
import { LangStore } from '../../../core/i18n/lang.store'
import { MkMoneyPipe } from './money.pipe'

@Component({
  imports: [MkMoneyPipe],
  template: `<p id="eur">{{ 123456 | mkMoney: 'EUR' }}</p>
    <p id="jpy">{{ 1500 | mkMoney: 'JPY' }}</p>
    <p id="aud">{{ -13860 | mkMoney: 'AUD' : true }}</p>
    <p id="none">{{ null | mkMoney: 'AUD' }}</p>`,
})
class Host {}

describe('mkMoney', () => {
  it('formats minor units in the active language, disambiguated on request', () => {
    TestBed.configureTestingModule({ imports: [Host, i18nTesting()] })
    const fixture = TestBed.createComponent(Host)
    fixture.detectChanges()
    const text = (id: string) =>
      (fixture.nativeElement as HTMLElement).querySelector(`#${id}`)?.textContent

    expect(text('eur')).toBe('€1,234.56')
    expect(text('jpy')).toBe('¥1,500')
    expect(text('aud')).toBe('−A$138.60')
    expect(text('none')).toBe('')

    TestBed.inject(LangStore).use('es')
    fixture.detectChanges()
    expect(text('eur')).toMatch(/€1,?234\.56/)
  })
})
