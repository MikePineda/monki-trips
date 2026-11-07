import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core'
import { FormField, form, maxLength, submit } from '@angular/forms/signals'
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco'
import { SyncService } from '../../core/offline/sync.service'
import { MkButtonComponent } from '../../shared/ui/button/button.component'
import { MkEmptyStateComponent } from '../../shared/ui/empty-state/empty-state.component'
import { MkFieldComponent } from '../../shared/ui/field/field.component'
import { MkInputDirective } from '../../shared/ui/field/input.directive'
import { MkIconComponent } from '../../shared/ui/icon/icon.component'
import { MkRowComponent } from '../../shared/ui/layout/row.component'
import { MkSectionComponent } from '../../shared/ui/layout/section.component'
import { MkStackComponent } from '../../shared/ui/layout/stack.component'
import { MkCallRowComponent } from '../../shared/ui/list/call-row.component'
import { MkListComponent } from '../../shared/ui/list/list.component'
import { MkTextComponent } from '../../shared/ui/text/text.component'
import { ToastService } from '../../shared/ui/toast/toast.service'
import { provideEmergencyI18n } from './emergency-i18n'
import {
  hasContent,
  toContent,
  toFormModel,
  type EmergencyFormModel,
  type SlotDefaults,
} from './emergency-form'
import { EmergencyStore } from './emergency.store'

/**
 * Emergency information of the trip, one tap away: the read view puts
 * every phone number on a big `tel:` row for one-handed use, straight
 * from the device's copy (it works offline); "Edit" opens the form on
 * the same screen. Saving queues the changed keys through the outbox.
 */
@Component({
  selector: 'app-emergency-page',
  imports: [
    TranslocoPipe,
    FormField,
    MkButtonComponent,
    MkEmptyStateComponent,
    MkFieldComponent,
    MkInputDirective,
    MkIconComponent,
    MkRowComponent,
    MkSectionComponent,
    MkStackComponent,
    MkCallRowComponent,
    MkListComponent,
    MkTextComponent,
  ],
  providers: [provideEmergencyI18n()],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <mk-stack gap="3">
      <mk-row gap="2" justify="between">
        <h1 mk-text variant="title" data-testid="emergency.title">
          {{ 'emergency.title' | transloco }}
        </h1>
        @if (!editing() && filled()) {
          <button
            mk-button
            variant="secondary"
            size="sm"
            type="button"
            data-testid="emergency.edit"
            (click)="startEditing()"
          >
            <mk-icon name="pencil" [size]="18" />
            {{ 'emergency.read.edit' | transloco }}
          </button>
        }
      </mk-row>

      @if (editing()) {
        <form novalidate (submit)="save($event)" data-testid="emergency.form">
          <mk-stack gap="3">
            <mk-section [eyebrow]="'emergency.form.insurance' | transloco">
              <mk-stack gap="1">
                <mk-field [label]="'emergency.form.insurer' | transloco">
                  <input
                    mkInput
                    type="text"
                    [formField]="form.insurer"
                    data-testid="emergency.form.insurer"
                  />
                </mk-field>
                <mk-field [label]="'emergency.form.policyNumber' | transloco">
                  <input
                    mkInput
                    variant="code"
                    type="text"
                    [formField]="form.policyNumber"
                    data-testid="emergency.form.policyNumber"
                  />
                </mk-field>
                <mk-field [label]="'emergency.form.assistancePhone' | transloco">
                  <input
                    mkInput
                    type="tel"
                    [formField]="form.assistancePhone"
                    data-testid="emergency.form.assistancePhone"
                  />
                </mk-field>
              </mk-stack>
            </mk-section>

            <mk-section [eyebrow]="'emergency.form.embassy' | transloco">
              <mk-stack gap="1">
                <mk-field [label]="'emergency.form.embassyName' | transloco">
                  <input
                    mkInput
                    type="text"
                    [formField]="form.embassyName"
                    data-testid="emergency.form.embassyName"
                  />
                </mk-field>
                <mk-field [label]="'emergency.form.embassyPhone' | transloco">
                  <input
                    mkInput
                    type="tel"
                    [formField]="form.embassyPhone"
                    data-testid="emergency.form.embassyPhone"
                  />
                </mk-field>
                <mk-field [label]="'emergency.form.embassyAddress' | transloco">
                  <textarea
                    mkInput
                    rows="2"
                    [formField]="form.embassyAddress"
                    data-testid="emergency.form.embassyAddress"
                  ></textarea>
                </mk-field>
              </mk-stack>
            </mk-section>

            <mk-section [eyebrow]="'emergency.form.numbers' | transloco">
              <mk-stack gap="1">
                <mk-field [label]="'emergency.form.hospital' | transloco">
                  <input
                    mkInput
                    type="text"
                    [formField]="form.hospital.name"
                    data-testid="emergency.form.hospitalName"
                  />
                </mk-field>
                <mk-field [label]="'emergency.form.hospitalPhone' | transloco">
                  <input
                    mkInput
                    type="tel"
                    [formField]="form.hospital.phone"
                    data-testid="emergency.form.hospitalPhone"
                  />
                </mk-field>
                <mk-field [label]="'emergency.form.localEmergencyPhone' | transloco">
                  <input
                    mkInput
                    type="tel"
                    [formField]="form.localEmergency.phone"
                    data-testid="emergency.form.localEmergencyPhone"
                  />
                </mk-field>
                <mk-field [label]="'emergency.form.otherName' | transloco">
                  <input
                    mkInput
                    type="text"
                    [formField]="form.other.name"
                    data-testid="emergency.form.otherName"
                  />
                </mk-field>
                <mk-field [label]="'emergency.form.otherPhone' | transloco">
                  <input
                    mkInput
                    type="tel"
                    [formField]="form.other.phone"
                    data-testid="emergency.form.otherPhone"
                  />
                </mk-field>
              </mk-stack>
            </mk-section>

            <mk-section [eyebrow]="'emergency.form.medical' | transloco">
              <mk-stack gap="1">
                <mk-field
                  [label]="'emergency.form.medical' | transloco"
                  [hint]="'emergency.form.medicalHint' | transloco"
                >
                  <textarea
                    mkInput
                    rows="3"
                    [formField]="form.medicalNotes"
                    data-testid="emergency.form.medical"
                  ></textarea>
                </mk-field>
                <mk-field [label]="'emergency.form.notes' | transloco">
                  <textarea
                    mkInput
                    rows="3"
                    [formField]="form.notes"
                    data-testid="emergency.form.notes"
                  ></textarea>
                </mk-field>
              </mk-stack>
            </mk-section>

            <mk-row gap="1">
              <button
                mk-button
                variant="ghost"
                type="button"
                [disabled]="saving()"
                data-testid="emergency.form.cancel"
                (click)="editing.set(false)"
              >
                {{ 'emergency.form.cancel' | transloco }}
              </button>
              <button
                mk-button
                size="block"
                type="submit"
                [loading]="saving()"
                data-testid="emergency.form.save"
              >
                {{ 'emergency.form.save' | transloco }}
              </button>
            </mk-row>
          </mk-stack>
        </form>
      } @else if (!filled()) {
        <mk-empty-state
          mascot="worried"
          [title]="'emergency.empty.title' | transloco"
          [body]="'emergency.empty.body' | transloco"
          data-testid="emergency.empty"
        >
          <button
            mkEmptyAction
            mk-button
            type="button"
            data-testid="emergency.add"
            (click)="startEditing()"
          >
            <mk-icon name="plus" [size]="18" />
            {{ 'emergency.empty.add' | transloco }}
          </button>
        </mk-empty-state>
      } @else {
        <mk-stack
          gap="3"
          data-testid="emergency.read"
          [attr.data-sync]="record()?.syncState ?? 'synced'"
        >
          @if (content().insurance; as insurance) {
            <mk-section
              [eyebrow]="'emergency.read.insurance' | transloco"
              data-testid="emergency.insurance"
            >
              <mk-list>
                @if (insurance.phone) {
                  <mk-call-row
                    [name]="insurance.provider"
                    [phone]="insurance.phone"
                    [note]="
                      insurance.policyNumber
                        ? ('emergency.read.policy' | transloco: { number: insurance.policyNumber })
                        : null
                    "
                    testId="emergency.insurance.phone"
                  />
                } @else {
                  <p mk-text variant="body-strong">{{ insurance.provider }}</p>
                  @if (insurance.policyNumber) {
                    <p mk-text variant="code" tone="ink-2">{{ insurance.policyNumber }}</p>
                  }
                }
              </mk-list>
            </mk-section>
          }
          @if (content().embassy; as embassy) {
            <mk-section
              [eyebrow]="'emergency.read.embassy' | transloco"
              data-testid="emergency.embassy"
            >
              <mk-list>
                @if (embassy.phone) {
                  <mk-call-row
                    [name]="embassy.name"
                    [phone]="embassy.phone"
                    [note]="embassy.address"
                    testId="emergency.embassy.phone"
                  />
                } @else {
                  <p mk-text variant="body-strong">{{ embassy.name }}</p>
                  @if (embassy.address) {
                    <p mk-text tone="ink-2">{{ embassy.address }}</p>
                  }
                }
              </mk-list>
            </mk-section>
          }
          @if (contacts().length > 0) {
            <mk-section
              [eyebrow]="'emergency.read.numbers' | transloco"
              data-testid="emergency.numbers"
            >
              <mk-list>
                @for (contact of contacts(); track $index) {
                  <mk-call-row
                    [name]="contact.name"
                    [phone]="contact.phone"
                    [note]="contact.note"
                    testId="emergency.contact"
                  />
                }
              </mk-list>
            </mk-section>
          }
          @if (content().medical?.notes; as medical) {
            <mk-section
              [eyebrow]="'emergency.read.medical' | transloco"
              data-testid="emergency.medical"
            >
              <p mk-text>{{ medical }}</p>
            </mk-section>
          }
          @if (content().notes; as notes) {
            <mk-section
              [eyebrow]="'emergency.read.notes' | transloco"
              data-testid="emergency.notes"
            >
              <p mk-text>{{ notes }}</p>
            </mk-section>
          }
          <p mk-text variant="caption" tone="ink-3">
            {{ 'emergency.read.savedOffline' | transloco }}
          </p>
        </mk-stack>
      }
    </mk-stack>
  `,
})
export default class EmergencyPage {
  /** Bound from the parent route's parameter. */
  readonly tripId = input.required<string>()

  private readonly store = inject(EmergencyStore)
  private readonly sync = inject(SyncService)
  private readonly toasts = inject(ToastService)
  private readonly transloco = inject(TranslocoService)

  protected readonly record = this.store.forTrip(this.tripId)
  protected readonly content = computed(() => this.record()?.content ?? {})
  protected readonly filled = computed(() => hasContent(this.content()))
  protected readonly contacts = computed(() => this.content().contacts ?? [])
  protected readonly editing = signal(false)
  protected readonly saving = signal(false)
  protected readonly model = signal<EmergencyFormModel>(toFormModel({}))
  protected readonly form = form(this.model, (path) => {
    maxLength(path.insurer, 200)
    maxLength(path.policyNumber, 100)
    maxLength(path.assistancePhone, 40)
    maxLength(path.embassyName, 200)
    maxLength(path.embassyPhone, 40)
    maxLength(path.embassyAddress, 2000)
    maxLength(path.hospital.name, 200)
    maxLength(path.hospital.phone, 40)
    maxLength(path.localEmergency.phone, 40)
    maxLength(path.other.name, 200)
    maxLength(path.other.phone, 40)
    maxLength(path.medicalNotes, 2000)
    maxLength(path.notes, 2000)
  })

  constructor() {
    this.sync.requestSync()
  }

  protected startEditing(): void {
    this.model.set(toFormModel(this.content()))
    this.form().reset()
    this.editing.set(true)
  }

  protected async save(event: Event): Promise<void> {
    event.preventDefault()
    await submit(this.form, async () => {
      this.saving.set(true)
      try {
        const defaults: SlotDefaults = {
          hospital: this.transloco.translate('emergency.defaults.hospital'),
          localEmergency: this.transloco.translate('emergency.defaults.localEmergency'),
          other: this.transloco.translate('emergency.defaults.other'),
        }
        const keys = await this.store.save(this.tripId(), toContent(this.model(), defaults))
        this.toasts.show({
          message: this.transloco.translate(
            keys.length > 0 ? 'emergency.toast.saved' : 'emergency.toast.unchanged'
          ),
        })
        this.editing.set(false)
      } finally {
        this.saving.set(false)
      }
      return undefined
    })
  }
}
