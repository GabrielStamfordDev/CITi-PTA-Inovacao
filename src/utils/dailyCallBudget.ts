/**
 * Lightweight UTC-day circuit breaker to cap external API calls against quota abuse.
 */
export class DailyCallBudget {
  private dateKey = "";
  private count = 0;
  private warned = false;

  constructor(private readonly envVarName: string, private readonly defaultLimit: number) {}

  private resetIfNewDay() {
    const today = new Date().toISOString().slice(0, 10);
    if (this.dateKey !== today) {
      this.dateKey = today;
      this.count = 0;
      this.warned = false;
    }
  }

  getLimit(): number {
    const parsed = Number(process.env[this.envVarName]);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : this.defaultLimit;
  }

  /**
   * Consumes one slot if under the daily ceiling; returns `false` when the cap is reached.
   */
  tryConsume(): boolean {
    this.resetIfNewDay();
    const limit = this.getLimit();
    if (this.count >= limit) {
      if (!this.warned) {
        this.warned = true;
        console.warn(
          `[budget] Limite diário de segurança (${limit} chamadas via ${this.envVarName}) atingido; operando em contingência local.`
        );
      }
      return false;
    }
    this.count += 1;
    return true;
  }

  getRemaining(): number {
    this.resetIfNewDay();
    return Math.max(0, this.getLimit() - this.count);
  }
}
