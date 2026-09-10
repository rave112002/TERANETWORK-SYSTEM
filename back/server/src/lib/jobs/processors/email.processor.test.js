import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { EMAIL_KINDS } from "./email.processor.js";

/**
 * One test, guarding one mistake.
 *
 * `email_events.type` is an ENUM. A renderer added here without widening that
 * column sends the message and then throws on the row that records it — after
 * the mail server already has it. The job retries, the customer gets the same
 * email again, and it repeats until the job dead-letters.
 *
 * That is not a hypothetical: the `final` notice shipped that way for the
 * length of one commit, and migration 012 is the fix.
 */
describe("email kinds and the email_events ENUM", () => {
  it("every kind the processor can send is a value the column accepts", () => {
    const schema = fs.readFileSync(
      path.resolve(process.cwd(), "database/schema.sql"),
      "utf8"
    );

    // Anchored on the table, not just on "type ENUM(": several tables have a
    // column called `type`, and matching the first one in the file silently
    // tested the wrong table's values.
    const table = schema.match(/CREATE TABLE IF NOT EXISTS email_events \(([\s\S]*?)\n\)/);
    expect(table, "could not find email_events in schema.sql").toBeTruthy();

    const column = table[1].match(/type ENUM\(([^)]+)\)/);
    expect(column, "could not find email_events.type").toBeTruthy();

    const accepted = column[1].match(/'([^']+)'/g).map((v) => v.replaceAll("'", ""));

    expect(EMAIL_KINDS.length).toBeGreaterThan(0);
    for (const kind of EMAIL_KINDS) {
      expect(accepted, `email_events.type has no '${kind}'`).toContain(kind);
    }
  });
});
