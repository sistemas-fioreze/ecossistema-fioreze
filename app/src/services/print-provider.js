export class PrintProvider {
  constructor(env) {
    this.enabled = String(env?.IMPRESSION_ENABLED || "false").toLowerCase() === "true";
  }

  async enqueue() {
    if (!this.enabled) {
      return {
        enabled: false,
        queued: false,
        reason: "impression-disabled",
      };
    }
    throw new Error("PrintProvider real nao implementado nesta fase.");
  }
}
