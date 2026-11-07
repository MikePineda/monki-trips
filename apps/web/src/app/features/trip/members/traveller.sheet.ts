import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog'
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core'
import { form, FormField, maxLength, required, submit } from '@angular/forms/signals'
import { TranslocoPipe } from '@jsverse/transloco'
import { fieldError } from '../../../core/forms/field-error'
import { MkButtonComponent } from '../../../shared/ui/button/button.component'
import { MkFieldComponent } from '../../../shared/ui/field/field.component'
import { MkInputDirective } from '../../../shared/ui/field/input.directive'
import { MkStackComponent } from '../../../shared/ui/layout/stack.component'
import { MkSheetComponent } from '../../../shared/ui/sheet/sheet.component'
import { provideMembersI18n } from './members-i18n'

export interface TravellerSheetData {
  /** Translation key of the title (`members.travellers.addTitle`, `...renameTitle`). */
  titleKey: string
  /** The current name when renaming, empty when adding. */
  name: string
}

/** Longest name the API stores. */
const NAME_MAX_LENGTH = 80

/** One name field in a sheet; closes with the trimmed name. */
@Component({
  selector: 'app-traveller-sheet',
  imports: [
    TranslocoPipe,
    FormField,
    MkSheetComponent,
    MkFieldComponent,
    MkButtonComponent,
    MkInputDirective,
    MkStackComponent,
  ],
  providers: [provideMembersI18n()],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <mk-sheet [title]="data.titleKey | transloco">
      <form novalidate (submit)="save($event)">
        <mk-stack gap="2">
          <mk-field
            [label]="'members.travellers.name' | transloco"
            [required]="true"
            [error]="fieldError(form.name)"
          >
            <input
              mkInput
              type="text"
              autocomplete="off"
              [formField]="form.name"
              data-testid="trip.members.travellerName"
            />
          </mk-field>
          <button mk-button size="block" type="submit" data-testid="trip.members.travellerSave">
            {{ 'members.travellers.save' | transloco }}
          </button>
        </mk-stack>
      </form>
    </mk-sheet>
  `,
})
export class TravellerSheet {
  protected readonly data = inject<TravellerSheetData>(DIALOG_DATA)
  private readonly ref = inject<DialogRef<string>>(DialogRef)

  protected readonly fieldError = fieldError
  protected readonly model = signal({ name: this.data.name })
  protected readonly form = form(this.model, (path) => {
    required(path.name)
    maxLength(path.name, NAME_MAX_LENGTH)
  })

  protected async save(event: Event): Promise<void> {
    event.preventDefault()
    await submit(this.form, async () => {
      this.ref.close(this.model().name.trim())
      return undefined
    })
  }
}
