import { taskTitleKey } from './task-title'

describe('taskTitleKey', () => {
  it('renders the print task of the API through the tasks catalogue', () => {
    expect(taskTitleKey({ titleKey: 'print_document' })).toBe('tasks.titleKey.print_document')
  })

  it('renders a checklist item through its template key', () => {
    expect(taskTitleKey({ titleKey: 'template.gear.esim' })).toBe('tasks.template.gear.esim')
  })

  it('falls back to the stored title for plain and unknown keys', () => {
    expect(taskTitleKey({ titleKey: null })).toBeNull()
    expect(taskTitleKey({ titleKey: 'something_new' })).toBeNull()
  })
})
