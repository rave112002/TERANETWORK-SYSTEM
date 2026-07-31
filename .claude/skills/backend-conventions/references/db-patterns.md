# Database Query & Transaction Patterns

This project uses a custom `Database` class (`server/config/database.js`) that wraps `mysql2/promise`.
`req.db` is the Database instance injected into every request.

---

## Return Shape Reference — MEMORIZE THIS

The return shape differs depending on whether you use `req.db.query` or a transaction connection.

### `req.db.query(sql, params)` — pool query (no transaction)

```js
const rows = await req.db.query(`SELECT * FROM patients WHERE patientId = ?`, [
  id,
]);
// rows → Array of row objects  e.g. [{patientId: '...', ...}, ...]
// rows[0] → first row object
// rows.length → count

// Destructure first row:
const [row] = await req.db.query(`SELECT * FROM t WHERE id = ? LIMIT 1`, [id]);
// row → single object or undefined
```

### `conn.execute(sql, params)` — transaction connection

```js
const conn = await req.db.beginTransaction();
const [rows, fields] = await conn.execute(`SELECT * FROM patients WHERE patientId = ?`, [id]);
// conn.execute returns [rows, fields] — always destructure BOTH
// rows → Array of row objects
// rows[0] → first row object

// For INSERT/UPDATE/DELETE:
const [result] = await conn.execute(`INSERT INTO t (...) VALUES (...)`, [...]);
// result.insertId, result.affectedRows
```

**The critical difference:**

- `req.db.query` → returns `rows` directly (already unwrapped)
- `conn.execute` → returns `[rows, fields]` — you MUST destructure

---

## When to Use Transactions

| Operation                                | Transaction required? |
| ---------------------------------------- | --------------------- |
| Single SELECT                            | No                    |
| Single INSERT                            | No                    |
| Single UPDATE                            | No                    |
| Single DELETE                            | No                    |
| INSERT + UPDATE across 2+ tables         | **Yes**               |
| Duplicate check + INSERT (race-safe)     | **Yes**               |
| Any multi-step write that must be atomic | **Yes**               |

---

## Transaction Pattern (always follow this exactly)

```js
let conn;
try {
  conn = await req.db.beginTransaction();

  // Use conn.execute() inside transaction — NOT req.db.query()
  const [rows] = await conn.execute(
    `SELECT * FROM patients WHERE patientId = ? LIMIT 1 FOR UPDATE`,
    [patientId],
  );

  await conn.execute(`INSERT INTO table_a (col1, col2) VALUES (?, ?)`, [
    val1,
    val2,
  ]);

  await conn.execute(`UPDATE table_b SET col = ? WHERE id = ?`, [val, id]);

  await req.db.commit(conn);
  return res.status(200).json({ success: true });
} catch (err) {
  await req.db.rollback(conn); // ← ALWAYS rollback on error
  console.error(err);
  next(err);
}
```

**Rules:**

- Always declare `let conn;` BEFORE the try block so rollback can access it
- Always call `req.db.rollback(conn)` in the catch — even if conn is undefined (rollback handles it)
- Never use `req.db.query()` inside a transaction — use `conn.execute()` only
- Always call `req.db.commit(conn)` before returning success
- `commit()` and `rollback()` both call `conn.release()` internally — do NOT release manually

---

## Duplicate Check + INSERT — Race-Safe Pattern

The duplicate check and INSERT must be in the same transaction with `FOR UPDATE` to prevent race conditions (two simultaneous requests both passing the check before either inserts).

```js
let conn;
try {
  conn = await req.db.beginTransaction();

  // Lock the rows being checked — prevents race condition
  const [existing] = await conn.execute(
    `SELECT id FROM patients
     WHERE lastName = ? AND firstName = ? AND birthdate = ?
     AND status NOT IN ('Deleted', 'Merged')
     LIMIT 1 FOR UPDATE`,
    [lastName, firstName, birthdate]
  );

  if (existing.length > 0) {
    await req.db.rollback(conn);
    return res.status(409).json({
      success: false,
      message: "Duplicate patient found.",
      code: "DUPLICATE_ENTRY",
    });
  }

  await conn.execute(
    `INSERT INTO patients (...) VALUES (...)`,
    [...]
  );

  await req.db.commit(conn);
  return res.status(201).json({ success: true, data: { patientId } });

} catch (err) {
  await req.db.rollback(conn);
  console.error(err);
  next(err);
}
```

---

## Transaction Checklist

Before shipping any write endpoint, verify:

- [ ] Does this write touch more than one table? → wrap in transaction
- [ ] Does this write do a check-then-insert? → wrap in transaction with `FOR UPDATE`
- [ ] Is `let conn;` declared before the `try` block?
- [ ] Is `conn.execute()` used inside the transaction (not `req.db.query()`)?
- [ ] Is `req.db.rollback(conn)` called in the `catch`?
- [ ] Is `req.db.commit(conn)` called before the success response?
- [ ] Is `conn.release()` NOT called manually (commit/rollback handle it)?

---

## Common Mistakes

```js
// ❌ WRONG — rollback unreachable if conn assignment throws
try {
  const conn = await req.db.beginTransaction(); // conn scoped inside try
  ...
} catch (err) {
  await req.db.rollback(conn); // ReferenceError: conn is not defined
}

// ✅ CORRECT
let conn;
try {
  conn = await req.db.beginTransaction();
  ...
} catch (err) {
  await req.db.rollback(conn);
}
```

```js
// ❌ WRONG — using req.db.query inside a transaction (different connection)
conn = await req.db.beginTransaction();
const rows = await req.db.query(`SELECT ...`); // NOT part of the transaction

// ✅ CORRECT
conn = await req.db.beginTransaction();
const [rows] = await conn.execute(`SELECT ...`); // same connection, same transaction
```

```js
// ❌ WRONG — forgetting to destructure conn.execute result
const rows = await conn.execute(`SELECT * FROM t`);
// rows is [Array, FieldPacket[]] — rows[0] is the first FieldPacket, not a row

// ✅ CORRECT
const [rows] = await conn.execute(`SELECT * FROM t`);
// rows is Array of row objects
```

```js
// ❌ WRONG — duplicate check outside transaction (race condition)
const existing = await req.db.query(`SELECT id FROM t WHERE ...`);
if (existing.length > 0) return 409;
await req.db.query(`INSERT INTO t ...`); // another request can insert between check and insert

// ✅ CORRECT — check and insert in same transaction with FOR UPDATE
conn = await req.db.beginTransaction();
const [existing] = await conn.execute(`SELECT id FROM t WHERE ... FOR UPDATE`);
if (existing.length > 0) {
  await req.db.rollback(conn);
  return 409;
}
await conn.execute(`INSERT INTO t ...`);
await req.db.commit(conn);
```

---

## Soft Delete & Status Filtering

### Default behavior (no status filter)

Exclude Deleted records:

```js
let whereClause = "WHERE t.status != 'Deleted'";
```

### When status filter IS provided

Show only that status (including Deleted if explicitly requested):

```js
if (status) {
  whereClause = "WHERE t.status = ?";
  params.push(status);
} else {
  whereClause = "WHERE t.status != 'Deleted'";
}
```

### Rules

1. No status param → `WHERE status != 'Deleted'`
2. `?status=Active` → `WHERE status = 'Active'`
3. `?status=Deleted` → `WHERE status = 'Deleted'`
4. Never permanently delete rows — always soft delete via `status = 'Deleted'`
