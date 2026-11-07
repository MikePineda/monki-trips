/**
 * Synthetic data for the style guide's mock screens: invented places,
 * codes and amounts (no real trip ever enters the repo). Money is integer
 * minor units; dates are YYYY-MM-DD; times are the place's local time.
 */
export const DEMO_TRIP = {
  name: 'Harbour and hills',
  day: 4,
  totalDays: 12,
  city: 'Port Vellmar',
  startDate: '2027-05-09',
  endDate: '2027-05-20',
  baseCurrency: 'AUD',
  localCurrency: 'EUR',
  nextEvent: {
    title: 'Train to Aldermoor',
    time: '14:20',
    zone: 'EEST',
    countdown: { hours: 1, minutes: 32 },
    leaveAt: '13:40',
    route: ['PVM', 'ALD'],
    reference: 'ABC123',
  },
  documents: [
    { title: 'Train tickets', reference: 'ABC123', pages: 2 },
    { title: 'Harbour Inn booking', reference: 'HBR-7742', pages: 1 },
  ],
  printFirst: { title: 'Museum voucher', pages: 2 },
  tonight: {
    name: 'Harbour Inn',
    address: '14 Quay Lane, Aldermoor',
    addressLocal: 'Οδός Προκυμαίας 14, Άλντερμουρ',
    addressLocalLang: 'el',
    checkIn: '15:00',
    phone: '+1 555 0100',
  },
  money: {
    leftTodayMinor: 8400,
    leftTodayBaseMinor: 13860,
    pendingCount: 1,
    yesterdayOverMinor: -1800,
  },
  weather: { degrees: 18, ageHours: 3 },
  events: [
    { kind: 'checkout', time: '10:00', zone: 'EEST', title: 'Harbour Inn', night: 1, nights: 2 },
    {
      kind: 'train',
      time: '14:20',
      zone: 'EEST',
      title: 'Train to Aldermoor',
      route: ['PVM', 'ALD'],
    },
    { kind: 'museum', time: '17:30', zone: 'EEST', title: 'Museum of the Tides' },
    {
      kind: 'checkin',
      time: '19:00',
      zone: 'EEST',
      title: 'Lighthouse Rooms',
      night: 1,
      nights: 3,
    },
  ],
  stops: ['PVM', 'ALD', 'KSB'],
  trips: [
    {
      id: 'harbour',
      name: 'Harbour and hills',
      start: '2027-05-09',
      end: '2027-05-20',
      state: 'ongoing',
    },
    { id: 'north', name: 'North loop', start: '2027-09-03', end: '2027-09-14', state: 'upcoming' },
    { id: 'islands', name: 'Two islands', start: '2026-02-11', end: '2026-02-19', state: 'past' },
  ],
  stamps: [
    { code: 'XA', name: 'Xaloa', date: '2026-02-12' },
    { code: 'XB', name: 'Xebria', date: '2026-02-16' },
  ],
  expense: { digits: '18.40', currency: 'EUR', baseMinor: 3036 },
} as const
