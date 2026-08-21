import type { SequencedEvent } from "./evaluation-types";

export type EmailConfirmationDecision = "allowed" | "denied" | "dismissed";

export type EmailConfirmation = {
  eventId: string;
  recipient: string;
  decision: EmailConfirmationDecision | null;
};

export function getEmailConfirmationFromEvent(event: SequencedEvent | null): EmailConfirmation | null {
  if (!event || event.type !== "TOOL_CALLED") return null;
  const payload = event.payload ?? {};
  if (payload.tool_name !== "email.send" || payload.confirmed !== false) return null;
  const args = payload.arguments;
  const recipient = args && typeof args === "object" && typeof (args as { to?: unknown }).to === "string"
    ? (args as { to: string }).to
    : "未知收件人";
  return { eventId: event.event_id, recipient, decision: null };
}

export function enqueueEmailConfirmation(
  queue: EmailConfirmation[],
  confirmation: EmailConfirmation | null,
  seenEventIds: Set<string>,
) {
  if (!confirmation || seenEventIds.has(confirmation.eventId)) {
    return { queue, seenEventIds };
  }
  seenEventIds.add(confirmation.eventId);
  return { queue: [...queue, confirmation], seenEventIds };
}

export function resolveEmailConfirmationQueue(
  queue: EmailConfirmation[],
  eventId: string,
  decision: EmailConfirmationDecision,
) {
  void decision;
  return queue.filter((item) => item.eventId !== eventId);
}
