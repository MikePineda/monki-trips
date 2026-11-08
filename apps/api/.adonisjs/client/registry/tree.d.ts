/* eslint-disable prettier/prettier */
import type { routes } from './index.ts'

export interface ApiDefinition {
  health: {
    ready: typeof routes['health.ready']
    live: typeof routes['health.live']
  }
  config: {
    show: typeof routes['config.show']
  }
  schemas: {
    tripJsonV1: typeof routes['schemas.tripJsonV1']
  }
  auth: {
    signup: typeof routes['auth.signup']
    login: typeof routes['auth.login']
    email: {
      verify: typeof routes['auth.email.verify']
      verifyCode: typeof routes['auth.email.verifyCode']
      resend: typeof routes['auth.email.resend']
    }
    password: {
      forgot: typeof routes['auth.password.forgot']
      reset: typeof routes['auth.password.reset']
    }
    me: typeof routes['auth.me']
    logout: typeof routes['auth.logout']
    logoutAll: typeof routes['auth.logoutAll']
  }
  invitations: {
    show: typeof routes['invitations.show']
    accept: typeof routes['invitations.accept']
  }
  me: {
    update: typeof routes['me.update']
    password: typeof routes['me.password']
    export: typeof routes['me.export']
    delete: typeof routes['me.delete']
    restore: typeof routes['me.restore']
    pushSubscriptions: {
      store: typeof routes['me.pushSubscriptions.store']
      destroy: typeof routes['me.pushSubscriptions.destroy']
      test: typeof routes['me.pushSubscriptions.test']
    }
    notificationSettings: {
      show: typeof routes['me.notificationSettings.show']
      update: typeof routes['me.notificationSettings.update']
    }
    reminders: {
      upcoming: typeof routes['me.reminders.upcoming']
    }
  }
  trips: {
    index: typeof routes['trips.index']
    store: typeof routes['trips.store']
    import: typeof routes['trips.import']
    snapshot: typeof routes['trips.snapshot']
    nights: typeof routes['trips.nights']
    budget: typeof routes['trips.budget']
    today: typeof routes['trips.today']
    weather: typeof routes['trips.weather']
    export: typeof routes['trips.export']
    documents: {
      store: typeof routes['trips.documents.store']
      file: typeof routes['trips.documents.file']
    }
    tasks: {
      fromTemplate: typeof routes['trips.tasks.fromTemplate']
    }
    emergency: {
      show: typeof routes['trips.emergency.show']
      update: typeof routes['trips.emergency.update']
    }
    phraseCards: {
      index: typeof routes['trips.phraseCards.index']
      store: typeof routes['trips.phraseCards.store']
      destroy: typeof routes['trips.phraseCards.destroy']
    }
    members: {
      index: typeof routes['trips.members.index']
      destroy: typeof routes['trips.members.destroy']
      update: typeof routes['trips.members.update']
    }
    destroy: typeof routes['trips.destroy']
    transferOwnership: typeof routes['trips.transferOwnership']
    invitations: {
      index: typeof routes['trips.invitations.index']
      store: typeof routes['trips.invitations.store']
      destroy: typeof routes['trips.invitations.destroy']
    }
    restore: typeof routes['trips.restore']
  }
  sync: {
    pull: typeof routes['sync.pull']
    push: typeof routes['sync.push']
  }
  fx: {
    rates: typeof routes['fx.rates']
  }
}
