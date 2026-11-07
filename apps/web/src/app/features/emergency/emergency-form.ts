import {
  EMERGENCY_INFO_KEYS,
  type EmergencyContact,
  type EmergencyInfoContent,
  type EmergencyInfoKey,
} from '@monkitrips/shared'

/** The fixed contact slots of the form; the API keeps them as an ordered `contacts` list. */
export const CONTACT_SLOTS = ['hospital', 'localEmergency', 'other'] as const

export type ContactSlot = (typeof CONTACT_SLOTS)[number]

export interface ContactSlotModel {
  name: string
  phone: string
}

/** What the form edits: every field a string, empty for "not set". */
export interface EmergencyFormModel {
  insurer: string
  policyNumber: string
  assistancePhone: string
  embassyName: string
  embassyPhone: string
  embassyAddress: string
  hospital: ContactSlotModel
  localEmergency: ContactSlotModel
  other: ContactSlotModel
  medicalNotes: string
  notes: string
}

/** The names a contact slot gets when the person typed only the number. */
export type SlotDefaults = Record<ContactSlot, string>

const EMPTY_SLOT: ContactSlotModel = { name: '', phone: '' }

function blank(value: string | null | undefined): string {
  return value ?? ''
}

function orNull(value: string): string | null {
  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

/** The form filled from the stored content: contacts fill the slots in order. Pure. */
export function toFormModel(content: EmergencyInfoContent): EmergencyFormModel {
  const contacts = content.contacts ?? []
  const slot = (index: number): ContactSlotModel => {
    const contact = contacts[index]
    return contact ? { name: contact.name, phone: contact.phone } : { ...EMPTY_SLOT }
  }
  return {
    insurer: blank(content.insurance?.provider),
    policyNumber: blank(content.insurance?.policyNumber),
    assistancePhone: blank(content.insurance?.phone),
    embassyName: blank(content.embassy?.name),
    embassyPhone: blank(content.embassy?.phone),
    embassyAddress: blank(content.embassy?.address),
    hospital: slot(0),
    localEmergency: slot(1),
    other: slot(2),
    medicalNotes: blank(content.medical?.notes),
    notes: blank(content.notes),
  }
}

/**
 * The content the form describes, in the API's shape: a section with no
 * provider or name is absent (the store sends null to clear it); a
 * contact slot without a number is left out,
 * one without a name takes the slot's default name. Pure.
 */
export function toContent(model: EmergencyFormModel, defaults: SlotDefaults): EmergencyInfoContent {
  const contacts: EmergencyContact[] = []
  for (const key of CONTACT_SLOTS) {
    const phone = orNull(model[key].phone)
    if (phone) {
      contacts.push({ name: orNull(model[key].name) ?? defaults[key], phone, note: null })
    }
  }
  const insurer = orNull(model.insurer)
  const embassyName = orNull(model.embassyName)
  const medical = orNull(model.medicalNotes)
  const content: EmergencyInfoContent = { contacts, notes: orNull(model.notes) }
  if (insurer) {
    content.insurance = {
      provider: insurer,
      policyNumber: orNull(model.policyNumber),
      phone: orNull(model.assistancePhone),
    }
  }
  if (embassyName) {
    content.embassy = {
      name: embassyName,
      phone: orNull(model.embassyPhone),
      address: orNull(model.embassyAddress),
    }
  }
  if (medical) {
    content.medical = { notes: medical }
  }
  return content
}

/**
 * The top-level keys whose value differs between what is stored and what
 * the form describes: only those travel as the mutation's changes, so a
 * partner's edit of another key is never overwritten. A key the trip never
 * had stays absent while its new value is empty. Pure.
 */
export function changedKeys(
  stored: EmergencyInfoContent,
  next: EmergencyInfoContent
): EmergencyInfoKey[] {
  return EMERGENCY_INFO_KEYS.filter((key) => {
    const before = stored[key]
    const after = next[key]
    const unset = (value: unknown) =>
      value === undefined || value === null || (Array.isArray(value) && value.length === 0)
    if (unset(before) && unset(after)) {
      return false
    }
    return JSON.stringify(before ?? null) !== JSON.stringify(after ?? null)
  })
}

/** True when the content has anything worth showing. */
export function hasContent(content: EmergencyInfoContent | undefined): boolean {
  if (!content) {
    return false
  }
  return EMERGENCY_INFO_KEYS.some((key) => {
    const value = content[key]
    return Array.isArray(value) ? value.length > 0 : value !== undefined && value !== null
  })
}
