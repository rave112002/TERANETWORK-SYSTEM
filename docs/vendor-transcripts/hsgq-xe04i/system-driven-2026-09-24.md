# HSGQ XE04I: first system-driven suspend and restore

**Date:** 2026-09-24 · **Device:** HSGQ XE04I, firmware HSGQ-XE04I_I_V3.3.6C_Rel
**Test ONU:** Huawei EG8145V5, MAC `30:c5:0f:d8:7f:2c`, PON 1 / ONU 27 (the only ONU online)
**Path:** PC 192.168.50.253 → MikroTik ether4-LAN → VLAN 88 → OLT 192.168.88.10:23 (telnet)
**Driver:** `back/server/src/lib/olt-drivers/hsgq/`, as reworked from
[HSGQ-XE04I-CLI-Validation-v2.md](HSGQ-XE04I-CLI-Validation-v2.md) the same day.

These are the first sessions in which the system, not a person in PuTTY, drove the OLT. Both
were run from Network → ONUs → 1/27 ⋮ with dry-run off (test-branch-guide.md part 6, step D).
The replies are copied verbatim from Device history. Each line starting with `> ` is the
command the system sent. Login, `enable` and the echoes are not shown.

## Discovery (read-only, before the test)

`show onu-info all` on PON 1: 60 ONUs read, matching the OLT's `Total:` footer. Only 1/27 was
online. The listing passed the pager because `terminal length 0` is sent first.

## Suspend: 23:47:09, success, 861 ms

```text
> terminal length 0

> configure

> interface epon 1

> blacklist add mac 30:c5:0f:d8:7f:2c

> show blacklist onu-info all
----------------------------------------------------------------------------------------------------
 PON/ONU     Mac-Address        Blacklist_Reject_Count  Reason                  ONU-Name
----------------------------------------------------------------------------------------------------
 1/1         30:c5:0f:d8:7f:2c  0                       Manual                  B_ONU01/01
----------------------------------------------------------------------------------------------------

> end

> copy running-config startup-config

[2000/01/01 01:01:05]  Critical: PON 1 PON link down and all onu will be offline  maybe fiber signal los

 Configuration saved successfully
```

- `blacklist add` printed nothing, as on the bench.
- The ONU dropped at once: the PON link-down event (the only ONU on the PON) arrived **inside
  the save's reply**. The driver strips event lines before judging output, so this was harmless.
- No `onu-deregister` was needed.

## Restore: 23:52:02, success, 643 ms

```text
> terminal length 0

> configure

> interface epon 1

> blacklist delete mac 30:c5:0f:d8:7f:2c

> show blacklist onu-info all
----------------------------------------------------------------------------------------------------
 PON/ONU     Mac-Address        Blacklist_Reject_Count  Reason                  ONU-Name
----------------------------------------------------------------------------------------------------
----------------------------------------------------------------------------------------------------

> end

> copy running-config startup-config

 Configuration saved successfully
```

- `blacklist delete` printed nothing this time. The misleading `Error, No Bind ONU fail` seen
  once on the bench did not appear. The driver ignores that reply either way and trusts the
  table.

## Status: 23:52:26, success, 447 ms

1/27 was back **online 24 s after the restore**, with the same ID (27), RX −11.69 dBm and
TX 2.21 dBm, consistent with the bench readings (v2 §11).

## Conclusion

On this firmware the driver suspends, restores and reads status end to end. The OLT was left as
found: blacklist empty, 1/27 bound and online, configuration saved.

Still unverified on the real device: an ONU coming back under a **different** ID after a restore,
and blacklisting on a PON with other ONUs online (v2 §19).
