-- ============================================================================
-- 017 — A deleted ONU no longer blocks its MAC, serial or NAP port
--
-- The unique keys on `onus` counted soft-deleted rows. The application's own
-- checks (findIdentifierClash, the NAP-port check) already skip them, so the
-- two disagreed: deleting an ONU and adding it again — by hand or from
-- Discovery — passed the checks and then hit ER_DUP_ENTRY ("An ONU with this
-- MAC or serial number already exists"), and the deleted row held its NAP port
-- forever.
--
-- MySQL has no partial index, so each key moves to a generated column that is
-- NULL once the row is Deleted (NULLs never collide in a unique key). The
-- deleted row itself keeps its MAC, serial and placement, so its history
-- still reads correctly.
-- ============================================================================

ALTER TABLE onus
  ADD COLUMN liveSerialNo VARCHAR(64)
    AS (IF(recordStatus = 'Deleted', NULL, serialNo)) STORED AFTER recordStatus,
  ADD COLUMN liveMac VARCHAR(17)
    AS (IF(recordStatus = 'Deleted', NULL, mac)) STORED AFTER liveSerialNo,
  ADD COLUMN liveNapId VARCHAR(50)
    AS (IF(recordStatus = 'Deleted', NULL, napId)) STORED AFTER liveMac;

ALTER TABLE onus
  DROP INDEX uq_onus_serial,
  DROP INDEX uq_onus_mac,
  DROP INDEX uq_onus_nap_port,
  ADD UNIQUE KEY uq_onus_serial (companyId, liveSerialNo),
  ADD UNIQUE KEY uq_onus_mac (companyId, liveMac),
  ADD UNIQUE KEY uq_onus_nap_port (liveNapId, napPort);
