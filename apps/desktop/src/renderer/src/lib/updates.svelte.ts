import type { UpdateStatus } from '../../../shared/api'

// Auto-update state from main (E7-5), for the banner and Settings → About.

class Updates {
  status = $state.raw<UpdateStatus | undefined>()

  constructor() {
    void window.cyclotron.update.status().then((s) => (this.status = s))
    window.cyclotron.update.onChange((s) => (this.status = s))
  }

  async check(): Promise<void> {
    this.status = await window.cyclotron.update.check()
  }

  async setAuto(on: boolean): Promise<void> {
    this.status = await window.cyclotron.update.setAuto(on)
  }
}

export const updates = new Updates()
