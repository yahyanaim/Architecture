export class AuditLogEntry {
  constructor(
    public readonly id: string,
    public readonly timestamp: Date,
    public readonly event: string,
    public readonly actorId: string,
    public readonly orgId: string | null,
    public readonly details: Record<string, unknown>
  ) {}

  static create(
    event: string,
    actorId: string,
    orgId: string | null,
    details: Record<string, unknown> = {}
  ): AuditLogEntry {
    return new AuditLogEntry(
      globalThis.crypto.randomUUID(),
      new Date(),
      event,
      actorId,
      orgId,
      details
    );
  }
}
