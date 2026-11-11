export type CalendarEvent = {
  uid: string;
  title: string;
  date: string;
  description: string;
  emails: string[];
};

function unescapeIcs(value: string) {
  return value.replace(/\\n/gi, "\n").replace(/\\,/g, ",").replace(/\\;/g, ";").replace(/\\\\/g, "\\");
}

function extractMail(value: string) {
  const mailto = value.match(/mailto:([^?\s>]+)/i);
  const plain = value.match(/[^\s<>"]+@[^\s<>"]+/);
  return (mailto?.[1] ?? plain?.[0] ?? "").trim().toLowerCase();
}

function icsDate(value: string | undefined) {
  const match = value?.match(/(\d{4})(\d{2})(\d{2})/);
  if (!match) return null;
  return `${match[1]}-${match[2]}-${match[3]}`;
}

export function parseIcs(text: string): CalendarEvent[] {
  const unfolded = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").replace(/\n[ \t]/g, "");
  const events: CalendarEvent[] = [];
  for (const block of unfolded.split("BEGIN:VEVENT").slice(1)) {
    const body = block.split("END:VEVENT")[0] ?? "";
    const props = new Map<string, string[]>();
    for (const line of body.split("\n")) {
      const splitAt = line.indexOf(":");
      if (splitAt <= 0) continue;
      const name = line.slice(0, splitAt).split(";")[0]?.toUpperCase();
      if (!name) continue;
      const value = unescapeIcs(line.slice(splitAt + 1).trim());
      props.set(name, [...(props.get(name) ?? []), value]);
    }
    if ((props.get("STATUS")?.[0] ?? "").toUpperCase() === "CANCELLED") continue;
    const uid = props.get("UID")?.[0]?.trim();
    const date = icsDate(props.get("DTSTART")?.[0]);
    if (!uid || !date) continue;
    const emails = [...(props.get("ATTENDEE") ?? []), ...(props.get("ORGANIZER") ?? [])]
      .map(extractMail)
      .filter((email) => email.includes("@"));
    events.push({
      uid,
      title: (props.get("SUMMARY")?.[0] ?? "Meeting").slice(0, 200),
      date,
      description: (props.get("DESCRIPTION")?.[0] ?? "").slice(0, 500),
      emails: [...new Set(emails)],
    });
  }
  return events;
}
