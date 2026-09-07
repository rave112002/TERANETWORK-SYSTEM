# HSGQ XE04I CLI Validation Report

**Device:** HSGQ XE04I EPON OLT  
**Firmware:** HSGQ-XE04I_I_V3.3.6C_Rel  
**Test Environment:** Laboratory (1 Huawei EG8145V5 ONU connected on PON 1 / ONU ID 27)  
**Management Access:** Telnet + Web GUI  
**Date:** July 2026

---

# Objective

Validate the actual CLI behavior of the HSGQ XE04I OLT for automation and parser development.

The following items were verified:

- Login banner
- Enable behavior
- Blacklist add/remove syntax
- ONU deregister behavior
- ONU authorize behavior
- Save configuration
- Blacklist persistence after reboot
- ONU information parser
- Optical information parser
- Alarm/event logs
- Firmware reboot behavior

---

# 1. Login Banner

## Result

Verified.

The device prompts:

```text
Username:
Password:
```

There is **no** `login:` prompt.

After successful login:

```text
Tera-Network>
```

---

# 2. Enable Mode

## Command

```text
enable
```

Result:

```text
Tera-Network#
```

### Observation

No enable password is requested.

---

# 3. Configuration Mode

```text
configure
```

Result:

```text
Tera-Network(config)#
```

Enter EPON interface:

```text
interface epon 1
```

Result:

```text
Tera-Network(config-epon-1)#
```

---

# 4. Blacklist Commands

## Add ONU MAC

Syntax:

```text
blacklist add mac <mac-address>
```

Example:

```text
blacklist add mac 30:c5:0f:d8:7f:2c
```

### Duplicate Entry

Attempting to add an existing blacklist entry returns:

```text
Error, Blacklist ONU add fail, reason: ONU has existed.
```

---

## Remove ONU MAC

Syntax:

```text
blacklist delete mac <mac-address>
```

Example:

```text
blacklist delete mac 30:c5:0f:d8:7f:2c
```

Result:

- ONU automatically registers again.

---

# 5. ONU Deregister

Syntax:

```text
onu-deregister <onu-id>
```

Example:

```text
onu-deregister 27
```

Output:

```text
Info: ONU 1/27 Onu deregister
Reason: Manual Deregister
```

Followed by:

```text
ONU authorization success

ONU link up
```

## Observation

This command **temporarily disconnects** the ONU.

If the ONU is authorized and **not blacklisted**, it automatically reconnects.

---

# 6. ONU Authorize

Command:

```text
onu-authorize
```

Output:

```text
PON-PORT AUTH-MODE AUTH-TYPE

pon1 mac auto
```

## Observation

This command **does not authorize an individual ONU**.

It displays or configures the global authorization mode.

Current mode:

- Authorization Mode: MAC
- Authorization Type: AUTO

---

# 7. show onu-info all

Command:

```text
show onu-info all
```

## Verified Output Layout

| Column | Description |
|---------|-------------|
| PON/ONU | ONU Identifier |
| Mac-Address | ONU MAC Address |
| Status | Registration State |
| Auth | Authorization Status |
| Cfg | Configuration Status |
| Reg-time | Registration Time |
| ONU-Name | ONU Name |
| ONU-Desc | ONU Description |

Example:

```text
PON/ONU
Mac-Address
Status
Auth
Cfg
Reg-time
ONU-Name
ONU-Desc
```

This output has been validated and can be safely used for parser development.

---

# 8. show optical-info

Command

```text
show optical-info
```

When ONU 27 is online:

Example:

```text
PON/ONU      1/27

MAC          30:c5:0f:d8:7f:2c

Temperature 53 C

Voltage     3.30 V

Bias        9 mA

TX Power    2.1439 dBm

RX Power   -11.8376 dBm
```

---

## When ONU is Blacklisted

Output:

```text
show optical-info

(no output)
```

Meaning:

The ONU never completed registration.

---

# 9. show onu-info-alarm

Command

```text
show onu-info-alarm 27
```

Observed Events

```text
ONU authorization success

ONU link up

ONU deregister

UNI port link down
```

These events were captured during testing.

---

# 10. Save Configuration

Command

```text
copy running-config startup-config
```

Output

```text
Configuration saved successfully
```

Equivalent to Cisco:

```text
write memory
```

---

# 11. Configuration Copy Commands

## Running → Startup

```text
copy running-config startup-config
```

Purpose

Save running configuration to flash.

---

## Save → Factory

```text
copy save-config factory-config
```

Purpose

Copies saved configuration into factory defaults.

**Not tested.**

---

# 12. Blacklist Persistence Test

## Procedure

1.

Blacklist ONU

```text
blacklist add mac 30:c5:0f:d8:7f:2c
```

2.

Save

```text
copy running-config startup-config
```

3.

Reboot OLT

(Web GUI reboot failed, manual power cycle used)

4.

Verify

```text
show optical-info

show onu-info all
```

---

## Result

ONU 1/27 remained absent.

Example

```text
1/26

1/28
```

ONU 27 was missing.

Also

```text
show optical-info
```

returned

```text
(no output)
```

---

## Conclusion

Blacklist entries persist after reboot **when**

```text
copy running-config startup-config
```

has been executed.

---

# 13. Firmware Reboot Behavior

Firmware Tested

```text
HSGQ-XE04I_I_V3.3.6C_Rel
```

---

## GUI Reboot Test

Selected

```
Shortcut

→ Reboot
```

GUI prompted

```
Save

Don't Save

Cancel
```

CLI configuration had already been saved.

Selected:

```
Don't Save
```

---

## Result

The OLT never recovered.

Observed

- SYS LED OFF
- Ping timeout
- Web GUI unreachable
- Telnet connection hung
- Waited approximately 15 minutes

Manual power cycle restored the device immediately.

---

## Observation

Software reboot appears unreliable on this firmware version.

This should be considered a firmware-specific issue until verified on another version.

---

# 14. Verified Command Reference

## Enter Configuration

```text
enable

configure

interface epon 1
```

---

## Blacklist

```text
blacklist add mac <MAC>

blacklist delete mac <MAC>
```

---

## Deregister ONU

```text
onu-deregister <ONU-ID>
```

---

## Authorization

```text
onu-authorize
```

---

## ONU Information

```text
show onu-info all
```

---

## Optical Information

```text
show optical-info
```

---

## Alarm Information

```text
show onu-info-alarm <ONU-ID>
```

---

## Save Configuration

```text
copy running-config startup-config
```

---

# 15. Summary

| Item | Status |
|------|--------|
| Login banner | ✅ Verified |
| Enable password | ✅ None required |
| Configuration mode | ✅ Verified |
| Blacklist add | ✅ Verified |
| Blacklist delete | ✅ Verified |
| ONU deregister | ✅ Verified |
| ONU authorize | ✅ Verified |
| show onu-info all | ✅ Parser validated |
| show optical-info | ✅ Verified |
| show onu-info-alarm | ✅ Verified |
| Save configuration | ✅ Verified |
| Blacklist persistence | ✅ Verified |
| GUI reboot behavior | ⚠️ Hangs on tested firmware |

---

# Final Conclusion

The HSGQ XE04I firmware **HSGQ-XE04I_I_V3.3.6C_Rel** was successfully validated for CLI automation.

The following functionality has been confirmed through live testing:

- ONU MAC blacklisting
- ONU deregistration
- ONU status parsing
- Optical diagnostics
- Alarm monitoring
- Configuration persistence
- Blacklist persistence across reboot

The only significant firmware issue observed is that the Web GUI reboot function did not successfully complete in the test environment, requiring a manual power cycle.