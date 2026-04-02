import Database from "better-sqlite3";

function formatSequence(value: number): string {
  return value.toString().padStart(6, "0");
}

export class IdService {
  constructor(
    private readonly db: Database.Database,
    private readonly prefix: string
  ) {}

  nextObjectId(): string {
    return this.db.transaction(() => {
      const nextValue = this.nextSequence("OBJECT");

      return `${this.prefix}-${formatSequence(nextValue)}`;
    })();
  }

  nextPublicationId(channelId: string, channelCode: string): string {
    return this.db.transaction(() => {
      const nextValue = this.nextSequence(`PUBLICATION:${channelId}`);

      return `${this.prefix}-${channelCode}-${formatSequence(nextValue)}`;
    })();
  }

  nextPhotoId(): string {
    return this.db.transaction(() => {
      const nextValue = this.nextSequence("PHOTO");

      return `${this.prefix}-PH-${formatSequence(nextValue)}`;
    })();
  }

  private nextSequence(scope: string): number {
    const current = this.db
      .prepare("SELECT last_value FROM id_counters WHERE scope = ?")
      .get(scope) as { last_value: number } | undefined;

    if (!current) {
      this.db
        .prepare("INSERT INTO id_counters (scope, last_value) VALUES (?, ?)")
        .run(scope, 1);

      return 1;
    }

    const nextValue = current.last_value + 1;

    this.db
      .prepare("UPDATE id_counters SET last_value = ? WHERE scope = ?")
      .run(nextValue, scope);

    return nextValue;
  }
}
