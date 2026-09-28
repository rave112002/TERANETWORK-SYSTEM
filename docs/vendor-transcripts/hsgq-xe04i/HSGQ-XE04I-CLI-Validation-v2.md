# HSGQ XE04I CLI Validation Report (v2 — Re-test)

**Device:** HSGQ XE04I EPON OLT
**Software Version:** HSGQ-XE04I_I_V3.3.6C_Rel
**System Version:** HSGQ-XE04I_I_V1.5.0_Rel
**Hardware Version:** HSGQ-XE04I-hw-version-v4.0
**Build time:** 2023/12/25 07:53:13
**PON chip FW:** 4.2.7.58
**Test ONU:** Huawei EG8145V5, MAC `30:c5:0f:d8:7f:2c`, PON 1 / ONU 27
**Management Access:** Telnet (PuTTY, session logging enabled)
**Date:** September 24, 2026
**Supersedes:** HSGQ XE04I CLI Validation Report (July 2026)

> **Data handling:** The OLT holds a production subscriber configuration. Customer names, NAP/port locations and customer ONU MAC addresses are redacted from this report. Raw PuTTY logs contain this data and must be stored privately.

---

# 0. Key Findings (Read First)

1. **Never reboot this OLT remotely.** Both the Web GUI reboot (July) and the CLI `reboot` command (today) hang the OLT indefinitely. Only a physical power cycle recovers it. On an in-service OLT this would take every subscriber offline until someone reaches the site.
2. **The OLT holds a production configuration** with 200 bound ONUs across 4 PONs, not a single-ONU lab config. Any saved test change (e.g. a blacklist entry) will affect real subscribers if the unit returns to service.
3. **A July test blacklist entry was never removed.** It was still active in flash and had rejected the lab ONU 52 times. It was found and removed during this re-test.
4. **`blacklist delete` output is unreliable.** It sometimes prints an error even though the delete succeeded. Always verify with `show blacklist onu-info all`.
5. **Event log lines cannot be switched off** in the terminal and appear in the middle of command output. Parsers must filter them.
6. **Several July report details were wrong** (see Section 17).

---

# 1. Test Topology

```text
PC (192.168.50.253, DHCP)
 └─ MikroTik ether4-LAN (192.168.50.1/24)
     └─ routed ─ VLAN88 on ether3-OLT REMOTE (192.168.88.1/24)
         └─ OLT vlanif 88 (192.168.88.10/24, default gw 192.168.88.1)
             └─ PON 1 ── Huawei EG8145V5 (ONU 1/27)
MikroTik ether1-ISP1 ── Converge router (192.168.100.1)
```

- The OLT's default gateway is `192.168.88.1`, so no NAT/masquerade is required for PC → OLT management.
- MikroTik ARP entry for 192.168.88.10 is `98:C7:A4:18:51:9D`; OLT base MAC is `98:c7:a4:18:51:9c`, confirming identity.

## ⚠️ Management IP Conflict

The OLT's out-of-band management port is configured as:

```text
interface manage
ifconfig 192.168.100.1 netmask 255.255.255.0
```

`192.168.100.1` is also the Converge router's LAN address. **Never connect the OLT MGMT port to the Converge network.** Management via VLAN 88 is unaffected.

## Shared Power

The OLT, the test ONU and the MikroTik share one power source. Power-cycling the OLT also restarts the ONU (logged as `ONU dying gasp`) and the MikroTik (seen as `General failure` in the PC's ping).

---

# 2. Login

Actual prompts (lowercase):

```text
username:
password:
```

After login:

```text
Tera-Network>
```

Login failure messages observed:

```text
The length of the user name is invalid!
Bad username , too many failures!
```

The connection is then closed.

**Automation:** match prompts case-insensitively. Do not store credentials in the report or script source.

---

# 3. CLI Modes and Navigation

| Command | From | To |
|---|---|---|
| `enable` | `Tera-Network>` | `Tera-Network#` (no password) |
| `configure` | `Tera-Network#` | `Tera-Network(config)#` |
| `interface epon 1` | `(config)#` | `Tera-Network(config-epon-1)#` |
| `exit` | any | one level up |
| `end` | any config level | `Tera-Network#` |

Internal node IDs appear in error messages:

| Node ID | Mode |
|---|---|
| 6 | `Tera-Network#` |
| 7 | `Tera-Network(config)#` |
| 32 | `Tera-Network(config-epon-1)#` |

Tab completion works (e.g. `co` + Tab lists `configure  copy`).

---

# 4. Command Availability by Mode

✅ = verified working. ❌ = verified `Unknown command` or absent from that mode's `?` list. Blank = not tested.

| Command | `#` | `(config)#` | `(config-epon-1)#` |
|---|---|---|---|
| `show version` | ✅ | | |
| `show startup-config` | ✅ | ❌ | |
| `show running-config` | ❌ | ✅ | |
| `show onu-info all` | ❌ | ✅ all PONs | ✅ this PON only |
| `show pon-info` | ❌ | ✅ | ❌ |
| `show boot-history` | ❌ | ✅ | |
| `show offline-onu-delete` | ❌ | ✅ | |
| `show optical-info` | ❌ | ❌ | ✅ |
| `show onu-info-alarm <id>` | ❌ | ❌ | ✅ |
| `show blacklist onu-info all` | ❌ | ❌ | ✅ |
| `blacklist add/delete mac <mac>` | | | ✅ |
| `onu-deregister <id>` | | | ✅ |
| `onu-authorize` | | | ✅ |
| `copy running-config startup-config` | ✅ | | |
| `reboot` | ❌ | ✅ | |
| `terminal length` / `terminal no monitor` | ✅ | | |

---

# 5. Terminal Settings

## Paging

Long output pauses at `--More--`. Disable per session:

```text
terminal length 0
```

Verified: full 200-row `show onu-info all` printed without pausing. Send after every login.

## Event Messages

`terminal no monitor` is accepted but **does not** suppress ONU/PON event messages. No per-session method to suppress them was found. Consider `syslog-server` (available in `(config)#`, not tested) to send events to a separate collector.

---

# 6. Error Message Formats

| Situation | Output |
|---|---|
| Unknown command / bad argument | `vty% [VTY] vty[node:<N>],Unknown command: <command>` |
| Missing argument | `vty% Command incomplete.` |
| Duplicate blacklist | `  Error, Blacklist ONU add fail, reason: ONU has existed.` |
| Blacklist delete (see note) | `  Error, No Bind ONU fail, reason: ONU is not exist.` |
| Deregister non-existent ONU | `  Error, Deregister ONU fail, reason: ONU is not exist.` |

Action errors share the pattern `  Error, <action> fail, reason: <reason>.` (two leading spaces). Detect by trimming and matching `^Error,`.

A malformed MAC address returns the generic `Unknown command` error, not an "invalid MAC" message.

---

# 7. Blacklist

## Syntax

```text
blacklist add mac <mac>
blacklist delete mac <mac>
show blacklist onu-info all
show blacklist onu-info onu-id <1-32>
```

Run inside `interface epon <n>`.

## MAC Format

| Format | Result |
|---|---|
| `30:c5:0f:d8:7f:2c` | ✅ Accepted |
| `30:C5:0F:D8:7F:2C` | ✅ Accepted, treated as same MAC |
| `30-c5-0f-d8-7f-2c` | ❌ `Unknown command` |
| `30c5.0fd8.7f2c` | ❌ `Unknown command` |

**Automation:** always normalize to lowercase colon format before sending.

## Blacklist Table

```text
----------------------------------------------------------------------------------------------------
 PON/ONU     Mac-Address        Blacklist_Reject_Count  Reason                  ONU-Name
----------------------------------------------------------------------------------------------------
 1/1         30:c5:0f:d8:7f:2c  2                       Manual                  B_ONU01/01
----------------------------------------------------------------------------------------------------
```

- `PON/ONU` here is the **blacklist entry number**, not the ONU's ID. `onu-id` accepts 1–32, suggesting a limit of 32 entries per PON (not tested).
- `Blacklist_Reject_Count` increments once per rejected registration attempt. This is the most reliable proof that a blacklist is actively blocking an ONU.
- An empty table prints the header and borders with no rows.

## Behavior on Add

- The command prints **nothing** on success.
- The ONU is **removed from the ONU table** (`bind-onu` entry deleted). PON 1 total dropped from 60 to 59.
- The ONU's alarm history is wiped.
- The ONU retries registration approximately **every 60 seconds**; each rejection appears as a PON link up/down pair when it is the only ONU on the PON.

```text
01:08:39  Critical: PON 1 PON link down ...   ← blacklist applied
01:08:40  Info: PON 1 PON link up ...          ← retry 1, rejected
01:08:40  Critical: PON 1 PON link down ...
01:09:40  Info: PON 1 PON link up ...          ← retry 2, rejected
01:09:40  Critical: PON 1 PON link down ...
```

**Important:** the PON link only went down because ONU 27 was the only ONU on PON 1. On a PON with other online ONUs, blacklisting one ONU will not take the link down. Never use PON link state to confirm a blacklist.

## Behavior on Delete

- Output is **inconsistent**. Across three successful deletes, two printed nothing and one printed `Error, No Bind ONU fail, reason: ONU is not exist.` All three removed the entry.
- The ONU re-registers on its next retry (up to ~60 s), then authorizes in ~3 s and links up in ~6 s.
- In MAC/auto authorization mode, the ONU is automatically re-bound (`bind-onu 27 mac ... onu-type 4ge`). It returned with the same ID (27) in all tests; 27 was also the lowest free ID on PON 1, so ID re-use after blacklisting is **not guaranteed** for other ONUs (not verified).
- Any description on the original `bind-onu` line would be lost, because the entry is deleted on blacklist add (lab ONU had no description; not directly verified).

**Automation:** ignore `blacklist delete` output; verify with `show blacklist onu-info all`.

## Stored Form in Config

Inside the `interface epon <n>` section:

```text
blacklist add mac 30:c5:0f:d8:7f:2c "Manual"
```

---

# 8. ONU Deregister

```text
onu-deregister <onu-id>
```

- The command itself prints nothing. Confirmation comes only from the event line:

```text
[2000/01/01 01:12:51]  Info: ONU 1/27 30:c5:0f:d8:7f:2c Onu deregister, Reason:Manual Deregister
```

- The July report showed this split over two lines without the MAC; the actual output is one line.
- A non-blacklisted ONU reconnects in **7–8 seconds**:

| Event | Run 1 | Run 2 |
|---|---|---|
| Deregister | 01:12:51 | 01:13:58 |
| PON link up | 01:12:52 | 01:13:59 |
| Authorization success | 01:12:55 | 01:14:02 |
| ONU link up | 01:12:59 (+8 s) | 01:14:05 (+7 s) |

- The alarm history keeps the event as `Onu deregister` **without the reason**.

---

# 9. ONU Authorization

```text
onu-authorize
```

Output:

```text
----------------------------------------------------------------------------------------------------
 PON-PORT AUTH-MODE AUTH-TYPE
----------------------------------------------------------------------------------------------------
    pon1       mac      auto
----------------------------------------------------------------------------------------------------
```

- Display-only when run with no arguments. Matches July.
- Subcommands `onu-authorize mode` and `onu-authorize type` exist. **Not tested** — they change authorization for every ONU on the PON.
- Auto mode explains why a removed-then-unblacklisted ONU is re-bound without manual action.

---

# 10. show onu-info all

## Layout

```text
----------------------------------------------------------------------------------------------------
 PON/ONU     Mac-Address    Status   Auth  Cfg     Reg-time            ONU-Name     ONU-Desc
----------------------------------------------------------------------------------------------------
 1/26    xx:xx:xx:xx:xx:xx Initial   TRUE  FALSE  1970/01/01 08:00:00      ONU01/26     <redacted>
 1/27    30:c5:0f:d8:7f:2c Online    TRUE  TRUE  2000/01/01 01:00:31      ONU01/27     NO-DESCRIPTI
----------------------------------------------------------------------------------------------------
  Total: 60  Online:1  Offline:59
----------------------------------------------------------------------------------------------------
```

## Parser Rules

- **Scope depends on mode:** `(config)#` lists all PONs (200 total); `(config-epon-1)#` lists only PON 1 (60 total).
- **Summary footer** `Total: N  Online:N  Offline:N` appears in both modes. Use it as an end marker and row-count check.
- **Parse by column position**, not whitespace. `ONU-Desc` is truncated to 12 characters and may contain spaces.
- **Status values seen:** `Online`, `Initial`.
- **`Cfg`** is `TRUE` for online ONUs, `FALSE` otherwise.
- **`Reg-time` `1970/01/01 08:00:00`** means never registered. For online ONUs it records the PON link-up moment, ~3 s before authorization.
- **`NO-DESCRIPTI`** is the truncated default `NO-DESCRIPTION`.
- **ONU IDs have gaps.** Do not assume sequential IDs.
- **Identify ONUs by `PON/ONU`, never by `ONU-Name`.** Names can be overridden: ONU `4/1` is named `ONU01/27` and ONU `1/41` is named `ONU02/02` (`interface onu <p>/<o>` / `name ...` in config).
- Blacklisted ONUs are absent from the table entirely.

---

# 11. show optical-info

## Layout

The July report showed vertical key/value pairs. **The actual output is a table:**

```text
----------------------------------------------------------------------------------------------------
PON/ONU ONU-Name     Mac-address       Temperature  Voltage      Bias         Tx power     Rx power
----------------------------------------------------------------------------------------------------
    1/27 ONU01/27     30:c5:0f:d8:7f:2c  56 °C      3.29 V        10 mA       2.0336 dBm   -11.9860 dBm
----------------------------------------------------------------------------------------------------
```

## Parser Rules

- Values include units (`°C`, `V`, `mA`, `dBm`); strip them.
- `°` is non-ASCII and may be decoded as `Â°`, `?` or a raw byte depending on terminal encoding. Parse the number before it.
- Lists **online ONUs only**.
- With no online ONUs on the PON, the command prints **nothing at all** (no headers). This means "no online ONUs", not specifically "ONU blacklisted".

## Readings

| Test | Temp | Voltage | Bias | TX | RX |
|---|---|---|---|---|---|
| July 2026 | 53 °C | 3.30 V | 9 mA | 2.1439 dBm | −11.8376 dBm |
| Today, baseline | 56 °C | 3.29 V | 10 mA | 2.0336 dBm | −11.9860 dBm |
| Today, after final power cycle | 55 °C | 3.29 V | 9 mA | 2.1476 dBm | −11.7849 dBm |

Optics are stable and healthy.

---

# 12. show onu-info-alarm

```text
show onu-info-alarm 27
```

```text
[2000/01/01 01:14:05]  Info: ONU 1/27 30:c5:0f:d8:7f:2c ONU link up
[2000/01/01 01:14:02]  Info: ONU 1/27 30:c5:0f:d8:7f:2c ONU authorization success
[2000/01/01 01:13:58]  Info: ONU 1/27 30:c5:0f:d8:7f:2c Onu deregister
```

- Newest first.
- Accumulates across deregister cycles.
- **Wiped** when the ONU is blacklisted or the OLT reboots.
- PON link events are not included.
- Lines use the same timestamp format as live event messages, so a generic "drop timestamped lines" filter would delete this command's data. Apply event filtering per command.

---

# 13. Event Message Catalog

Format: `[YYYY/MM/DD HH:MM:SS]  <Level>: <message>` (two spaces after the timestamp).

| Event | Message |
|---|---|
| PON link up | `Info: PON <p> PON link up  find fiber signal` |
| PON link down | `Critical: PON <p> PON link down and all onu will be offline  maybe fiber signal los` |
| ONU authorized | `Info: ONU <p>/<o> <mac> ONU authorization success` |
| ONU link up | `Info: ONU <p>/<o> <mac> ONU link up` |
| ONU deregistered | `Info: ONU <p>/<o> <mac> Onu deregister, Reason:Manual Deregister` |
| UNI port down | `Info: ONU <p>/<o> Port <n> <mac> Uni port link down` |
| ONU power loss | `Info: ONU <p>/<o> <mac> ONU dying gasp` |
| System reboot | `[system]Critical: System reset Reboot Device` |

`Uni port link down` for ports 1–4 is normal when nothing is connected to the ONU's LAN ports.

`ONU dying gasp` distinguishes ONU power loss from fiber faults.

---

# 14. Save Configuration

```text
copy running-config startup-config
```

Output (note leading space):

```text
 Configuration saved successfully
```

- Run at `Tera-Network#`.
- The startup config header records the save time: `! HSGQ-XE04I configuration saved from vty` / `!   2000/01/01 00:05:41`.
- `(config)#` also offers `save` ("Write running configuration to memory, network, or terminal"). **Not tested.**

---

# 15. Persistence Tests

Both directions verified with a power cycle (software reboot is not usable; see Section 16).

## Part A: Blacklist → Save → Power Cycle

| Check before | Result |
|---|---|
| Startup config contains `blacklist add mac 30:c5:0f:d8:7f:2c "Manual"` | ✅ |
| Startup config has no `bind-onu 27` | ✅ |

| Check after boot | Result |
|---|---|
| `show blacklist onu-info all` lists the MAC | ✅ Reject count 2 and rising |
| ONU 1/27 absent from `show onu-info all` | ✅ `Total: 59  Online:0` |
| `show optical-info` | ✅ No output |

## Part B: Delete → Save → Power Cycle

| Check before | Result |
|---|---|
| Blacklist table empty | ✅ |
| Startup config contains `bind-onu 27 mac 30:c5:0f:d8:7f:2c onu-type 4ge`, no `blacklist` line | ✅ |

| Check after boot | Result |
|---|---|
| Blacklist table empty | ✅ |
| ONU 1/27 online | ✅ Reg-time `00:01:21`, `Total: 60  Online:1` |
| `show optical-info` shows 1/27 | ✅ |

## Conclusion

Blacklist additions **and** removals persist across a power cycle once `copy running-config startup-config` has been run. The most direct evidence is the `blacklist add mac ...` line in `show startup-config`, not the absence of the ONU.

`offline-onu-delete` is `Disable`, so ONU absence was not caused by automatic deletion.

---

# 16. Reboot Behavior

## CLI Reboot

```text
Tera-Network(config)# reboot
System will be reboot. Do you want to save current configuration? (y/n)[n]:y System will reboot after 1 miniute
[2000/01/01 01:20:55]  [system]Critical: System reset Reboot Device
```

- Available only in `(config)#`.
- Default answer to the save prompt is **n**.
- The OLT logged the reset and dropped the network, then **never recovered** (no ping after 18+ minutes). A power cycle was required.
- A first `reboot` attempt returned to `Tera-Network#` without a prompt or reboot. Cause not determined.

## Summary

| Method | Save choice | Result |
|---|---|---|
| Web GUI (July 2026) | Don't Save | ❌ Hung; power cycle required |
| CLI `reboot` (today) | Save (y) | ❌ Hung 18+ min; power cycle required |
| Power cycle | — | ✅ Answers ping in ~40 s |

The save choice does not affect the hang. Software reboot is broken on this firmware.

The ~40 s boot figure includes the MikroTik restarting from the shared power source.

## Boot History

`show boot-history` shows only the current boot (`Boot time`, `Running time`). `History booting:` stayed empty after three boots, and the hung reboot left no trace. A reboot can only be detected by a lower-than-expected running time.

The OLT clock resets to `2000/01/01 00:00` on every boot (no NTP/RTC). Timezone is `Asia/Chongqing` (UTC+8). Event timestamps are valid for measuring intervals only.

---

# 17. Corrections to the July 2026 Report

| July report said | Actual |
|---|---|
| Test environment: laboratory with 1 ONU | OLT holds a production config with 200 bound ONUs; 1 lab ONU connected |
| Login prompt `Username:` / `Password:` | `username:` / `password:` (lowercase) |
| `show optical-info` is vertical key/value output | Table with header row and units |
| Deregister prints a two-line message | One line, includes MAC: `... Onu deregister, Reason:Manual Deregister` |
| `show onu-info all` parser validated | Only column headers were captured; full layout, footer and edge cases now documented |
| Empty optical output means ONU never registered | Empty output means no online ONUs on that PON |
| Persistence result showed `1/26` and `1/28` present | These are real subscriber ONUs; persistence now proven via startup config and blacklist table |
| Blacklist entry left in place after persistence test | Entry remained active until today (52 rejections) |
| Software reboot failure specific to GUI | CLI `reboot` also hangs, regardless of save choice |
| Blacklist delete: "ONU automatically registers again" | True, but takes up to ~60 s, and the command may print a misleading error |
| Command modes not documented | See Section 4 |

---

# 18. Automation Guidance

1. Match `username:` / `password:` case-insensitively; detect login failure strings.
2. Send `enable`, then `terminal length 0`, after every login.
3. Track the current mode; several commands exist only in one mode.
4. Normalize MACs to lowercase colon format.
5. Treat any trimmed line starting with `Error,` and any `vty%` line as a failure — **except** for `blacklist delete`, whose result must be verified via `show blacklist onu-info all`.
6. Strip event lines (`^\[\d{4}/\d{2}/\d{2} \d{2}:\d{2}:\d{2}\]`) from all output except `show onu-info-alarm`.
7. Parse tables by column position; use the summary footer as an end marker.
8. Identify ONUs by `PON/ONU`, never by name.
9. Confirm blacklist state via the blacklist table and reject counter, never via PON link state.
10. Confirm saves by matching trimmed `Configuration saved successfully`.
11. **Never issue `reboot`.** If a script must handle the prompt, the default is `n`.
12. Do not run `erase`, `update`, `onu-authorize mode`, or `onu-authorize type`.

---

# 19. Not Tested / Open Items

| Item | Notes |
|---|---|
| GUI reboot with "Save" | Expected to hang, based on CLI result |
| `save` command | Possible alternative to `copy` |
| `copy save-config factory-config` | Not tested (also not tested in July) |
| `onu-authorize mode` / `type` | Would affect all ONUs on the PON |
| `syslog-server` | Candidate for clean event capture |
| `time` / `ntp` | Would fix `2000/01/01` clock; changes live config |
| Blacklist capacity (32 per PON) | Inferred from `onu-id <1-32>` |
| ONU ID and description after blacklist/unblacklist | Only tested on an ONU whose ID was the lowest free slot and had no description |
| Single-ONU form of `show onu-info` | Not tested |
| First `reboot` returning without action | Not reproduced |
| Blacklisting on a PON with other online ONUs | Only one ONU was online during testing |

---

# 20. Final Conclusion

The HSGQ XE04I on firmware **HSGQ-XE04I_I_V3.3.6C_Rel** is suitable for CLI automation of ONU blacklisting, deregistration, status parsing, optical monitoring, alarm retrieval and configuration persistence, provided the script follows Section 18.

Software reboot (GUI and CLI) is **not reliable** on this firmware and must not be used remotely. A physical power cycle is the only verified recovery method.

At the end of testing, the OLT was left in a clean state: no blacklist entries, ONU 1/27 bound and online, configuration saved.
