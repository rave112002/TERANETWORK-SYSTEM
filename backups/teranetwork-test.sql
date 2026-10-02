-- MySQL dump 10.13  Distrib 8.0.45, for Win64 (x86_64)
--
-- Host: localhost    Database: teranetwork
-- ------------------------------------------------------
-- Server version	8.0.45

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `_migrations`
--

DROP TABLE IF EXISTS `_migrations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `_migrations` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `appliedAt` datetime NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `name` (`name`)
) ENGINE=InnoDB AUTO_INCREMENT=19 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `_migrations`
--

LOCK TABLES `_migrations` WRITE;
/*!40000 ALTER TABLE `_migrations` DISABLE KEYS */;
INSERT INTO `_migrations` VALUES (1,'schema.sql','2026-10-02 21:14:37'),(2,'001_user_branches_and_company_profile.sql','2026-10-02 21:14:37'),(3,'002_create_plans_and_customers.sql','2026-10-02 21:14:37'),(4,'003_create_network_inventory.sql','2026-10-02 21:14:37'),(5,'004_create_subscriptions.sql','2026-10-02 21:14:37'),(6,'005_create_settings_and_jobs.sql','2026-10-02 21:14:37'),(7,'006_create_network_action_logs.sql','2026-10-02 21:14:37'),(8,'007_create_billing.sql','2026-10-02 21:14:37'),(9,'008_payment_gateway.sql','2026-10-02 21:14:37'),(10,'009_create_dunning_exemptions.sql','2026-10-02 21:14:37'),(11,'010_create_discovery.sql','2026-10-02 21:14:37'),(12,'011_billing_schedule_settings.sql','2026-10-02 21:14:37'),(13,'012_email_events_final_notice.sql','2026-10-02 21:14:37'),(14,'013_subscription_recovery.sql','2026-10-02 21:14:37'),(15,'014_branch_payment_provider.sql','2026-10-02 21:14:37'),(16,'015_gcash_statements.sql','2026-10-02 21:14:38'),(17,'016_retire_branch_superadmin.sql','2026-10-02 21:14:38'),(18,'017_onus_unique_ignores_deleted.sql','2026-10-02 21:14:38');
/*!40000 ALTER TABLE `_migrations` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `audit_trail`
--

DROP TABLE IF EXISTS `audit_trail`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `audit_trail` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `auditId` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `companyId` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `branchId` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `accountId` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `action` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `module` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text COLLATE utf8mb4_unicode_ci,
  `metadata` json DEFAULT NULL,
  `ipAddress` varchar(45) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `userAgent` text COLLATE utf8mb4_unicode_ci,
  `dateCreated` datetime NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `auditId` (`auditId`),
  KEY `idx_audit_trail_companyId` (`companyId`),
  KEY `idx_audit_trail_branchId` (`branchId`),
  KEY `idx_audit_trail_accountId` (`accountId`),
  KEY `idx_audit_trail_dateCreated` (`dateCreated`)
) ENGINE=InnoDB AUTO_INCREMENT=33 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `audit_trail`
--

LOCK TABLES `audit_trail` WRITE;
/*!40000 ALTER TABLE `audit_trail` DISABLE KEYS */;
INSERT INTO `audit_trail` VALUES (1,'11caa74c-be68-11f1-8891-088fc3017818','5558814a-be63-11f1-8891-088fc3017818','5559990d-be63-11f1-8891-088fc3017818','system:superadmin:superadmin','settings.update','system','Network features turned OFF — billing only, nobody is disconnected','{\"after\": {\"NETWORK_ENABLED\": \"false\"}, \"before\": {}}','::ffff:100.122.158.28','teranetwork-superadmin/1','2026-10-02 21:49:20'),(2,'324e92aa-be68-11f1-8891-088fc3017818','5558814a-be63-11f1-8891-088fc3017818','5559990d-be63-11f1-8891-088fc3017818','system:superadmin:superadmin','create_login','users','Owner login created from SuperAdmin for ahchilee40@gmail.com','{\"after\": {\"role\": \"Owner\", \"email\": \"ahchilee40@gmail.com\", \"lastName\": \"Owner\", \"accountId\": \"324de890-be68-11f1-8891-088fc3017818\", \"firstName\": \"Test\"}, \"before\": null}','::ffff:100.122.158.28','teranetwork-superadmin/1','2026-10-02 21:50:15'),(3,'8e268be6-be69-11f1-8891-088fc3017818','5558814a-be63-11f1-8891-088fc3017818','5559990d-be63-11f1-8891-088fc3017818','324de890-be68-11f1-8891-088fc3017818','CREATE','users','CREATE users','{\"body\": {\"email\": \"test@billing.com\", \"roleId\": \"555bf257-be63-11f1-8891-088fc3017818\", \"lastName\": \"Billing\", \"firstName\": \"Test\"}, \"createdIds\": {\"accountId\": \"8e1f1195-be69-11f1-8891-088fc3017818\"}}','::ffff:100.122.158.28','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36','2026-10-02 21:59:59'),(4,'9e604f0d-be69-11f1-8891-088fc3017818','5558814a-be63-11f1-8891-088fc3017818','5559990d-be63-11f1-8891-088fc3017818','324de890-be68-11f1-8891-088fc3017818','CREATE','users','CREATE users','{\"body\": {\"email\": \"test@technician.com\", \"roleId\": \"555c7b3c-be63-11f1-8891-088fc3017818\", \"lastName\": \"Technician\", \"firstName\": \"Test\"}, \"createdIds\": {\"accountId\": \"9e59b2eb-be69-11f1-8891-088fc3017818\"}}','::ffff:100.122.158.28','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36','2026-10-02 22:00:26'),(5,'e542c5bc-be69-11f1-8891-088fc3017818','5558814a-be63-11f1-8891-088fc3017818','5559990d-be63-11f1-8891-088fc3017818','324de890-be68-11f1-8891-088fc3017818','DELETE','users','DELETE users (9e59b2eb-be69-11f1-8891-088fc3017818)','{\"params\": {\"userId\": \"9e59b2eb-be69-11f1-8891-088fc3017818\"}}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36','2026-10-02 22:02:25'),(6,'0798ebb6-be6a-11f1-8891-088fc3017818','5558814a-be63-11f1-8891-088fc3017818','5559990d-be63-11f1-8891-088fc3017818','324de890-be68-11f1-8891-088fc3017818','CREATE','users','CREATE users','{\"body\": {\"email\": \"testa@technician.com\", \"roleId\": \"555c7b3c-be63-11f1-8891-088fc3017818\", \"lastName\": \"technician\", \"firstName\": \"test\"}, \"createdIds\": {\"accountId\": \"07901371-be6a-11f1-8891-088fc3017818\"}}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36','2026-10-02 22:03:22'),(7,'63ae1308-be6a-11f1-8891-088fc3017818','5558814a-be63-11f1-8891-088fc3017818','5559990d-be63-11f1-8891-088fc3017818','system:superadmin:superadmin','update_logo','companies','Company logo replaced from SuperAdmin','{\"after\": {\"tin\": null, \"name\": \"TERANETWORK\", \"email\": \"sampletestemail76@gmail.com\", \"phone\": null, \"address\": null, \"logoUrl\": \"/uploads/superadmin/logos/5558814a-be63-11f1-8891-088fc3017818/d019faf453ee5ce7574f14f87bec85f720261002220557.png\", \"website\": null, \"companyId\": \"5558814a-be63-11f1-8891-088fc3017818\"}, \"before\": {\"tin\": null, \"name\": \"TERANETWORK\", \"email\": \"sampletestemail76@gmail.com\", \"phone\": null, \"address\": null, \"logoUrl\": null, \"website\": null, \"companyId\": \"5558814a-be63-11f1-8891-088fc3017818\"}}','::ffff:100.122.158.28','teranetwork-superadmin/1','2026-10-02 22:05:57'),(8,'6a8d4a8a-be6a-11f1-8891-088fc3017818','5558814a-be63-11f1-8891-088fc3017818','5559990d-be63-11f1-8891-088fc3017818','system:superadmin:superadmin','update_profile','companies','Company profile updated from SuperAdmin','{\"after\": {\"tin\": null, \"name\": \"TERANETWORK\", \"email\": \"sampletestemail76@gmail.com\", \"phone\": null, \"address\": \"AAA\", \"logoUrl\": \"/uploads/superadmin/logos/5558814a-be63-11f1-8891-088fc3017818/d019faf453ee5ce7574f14f87bec85f720261002220557.png\", \"website\": null, \"companyId\": \"5558814a-be63-11f1-8891-088fc3017818\"}, \"before\": {\"tin\": null, \"name\": \"TERANETWORK\", \"email\": \"sampletestemail76@gmail.com\", \"phone\": null, \"address\": null, \"logoUrl\": \"/uploads/superadmin/logos/5558814a-be63-11f1-8891-088fc3017818/d019faf453ee5ce7574f14f87bec85f720261002220557.png\", \"website\": null, \"companyId\": \"5558814a-be63-11f1-8891-088fc3017818\"}}','::ffff:100.122.158.28','teranetwork-superadmin/1','2026-10-02 22:06:08'),(9,'841d9790-be6a-11f1-8891-088fc3017818','5558814a-be63-11f1-8891-088fc3017818','5559990d-be63-11f1-8891-088fc3017818','324de890-be68-11f1-8891-088fc3017818','create','plans','Created plan \"FIBER 50MPBS\"','{\"after\": {\"name\": \"FIBER 50MPBS\", \"planId\": \"841d1eae-be6a-11f1-8891-088fc3017818\", \"status\": \"Active\", \"upMbps\": 50, \"currency\": \"PHP\", \"downMbps\": 50, \"companyId\": \"5558814a-be63-11f1-8891-088fc3017818\", \"installFee\": 0, \"description\": null, \"monthlyPrice\": 1500, \"reconnectionFee\": 0}, \"before\": null}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36','2026-10-02 22:06:51'),(10,'841fd118-be6a-11f1-8891-088fc3017818','5558814a-be63-11f1-8891-088fc3017818','5559990d-be63-11f1-8891-088fc3017818','324de890-be68-11f1-8891-088fc3017818','CREATE','plans','CREATE plans','{\"body\": {\"name\": \"FIBER 50MPBS\", \"upMbps\": 50, \"downMbps\": 50, \"installFee\": 0, \"monthlyPrice\": 1500}}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36','2026-10-02 22:06:51'),(11,'9990aa86-be6a-11f1-8891-088fc3017818','5558814a-be63-11f1-8891-088fc3017818','5559990d-be63-11f1-8891-088fc3017818','324de890-be68-11f1-8891-088fc3017818','create','customers','Created subscriber ACC-000001 — RAMOS NEIL','{\"after\": {\"name\": \"RAMOS NEIL\", \"email\": \"ravenbayatan11@gmail.com\", \"notes\": null, \"phone\": null, \"gpsLat\": null, \"gpsLng\": null, \"idType\": null, \"status\": \"Active\", \"address\": null, \"branchId\": \"5559990d-be63-11f1-8891-088fc3017818\", \"idNumber\": null, \"accountNo\": \"ACC-000001\", \"companyId\": \"5558814a-be63-11f1-8891-088fc3017818\", \"customerId\": \"998e8bb5-be6a-11f1-8891-088fc3017818\"}, \"before\": null}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36','2026-10-02 22:07:27'),(12,'9991802d-be6a-11f1-8891-088fc3017818','5558814a-be63-11f1-8891-088fc3017818','5559990d-be63-11f1-8891-088fc3017818','324de890-be68-11f1-8891-088fc3017818','CREATE','customers','CREATE customers','{\"body\": {\"name\": \"RAMOS NEIL\", \"email\": \"ravenbayatan11@gmail.com\"}}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36','2026-10-02 22:07:27'),(13,'a4975f37-be6a-11f1-8891-088fc3017818','5558814a-be63-11f1-8891-088fc3017818','5559990d-be63-11f1-8891-088fc3017818','324de890-be68-11f1-8891-088fc3017818','create','customers','Created subscriber ACC-000002 — BRIAN PATOY','{\"after\": {\"name\": \"BRIAN PATOY\", \"email\": \"johnravenbayatan@gmail.com\", \"notes\": null, \"phone\": null, \"gpsLat\": null, \"gpsLng\": null, \"idType\": null, \"status\": \"Active\", \"address\": null, \"branchId\": \"5559990d-be63-11f1-8891-088fc3017818\", \"idNumber\": null, \"accountNo\": \"ACC-000002\", \"companyId\": \"5558814a-be63-11f1-8891-088fc3017818\", \"customerId\": \"a496c3d3-be6a-11f1-8891-088fc3017818\"}, \"before\": null}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36','2026-10-02 22:07:46'),(14,'a49842f0-be6a-11f1-8891-088fc3017818','5558814a-be63-11f1-8891-088fc3017818','5559990d-be63-11f1-8891-088fc3017818','324de890-be68-11f1-8891-088fc3017818','CREATE','customers','CREATE customers','{\"body\": {\"name\": \"BRIAN PATOY\", \"email\": \"johnravenbayatan@gmail.com\"}}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36','2026-10-02 22:07:46'),(15,'abf96ccf-be6a-11f1-8891-088fc3017818','5558814a-be63-11f1-8891-088fc3017818','5559990d-be63-11f1-8891-088fc3017818','324de890-be68-11f1-8891-088fc3017818','create','subscriptions','Created subscription for ACC-000002 — BRIAN PATOY on plan \"FIBER 50MPBS\"','{\"after\": {\"onuId\": null, \"planId\": \"841d1eae-be6a-11f1-8891-088fc3017818\", \"status\": \"pending\", \"branchId\": \"5559990d-be63-11f1-8891-088fc3017818\", \"companyId\": \"5558814a-be63-11f1-8891-088fc3017818\", \"customerId\": \"a496c3d3-be6a-11f1-8891-088fc3017818\", \"activatedAt\": null, \"subscriptionId\": \"abf90f82-be6a-11f1-8891-088fc3017818\"}, \"before\": null}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36','2026-10-02 22:07:58'),(16,'abfbb589-be6a-11f1-8891-088fc3017818','5558814a-be63-11f1-8891-088fc3017818','5559990d-be63-11f1-8891-088fc3017818','324de890-be68-11f1-8891-088fc3017818','CREATE','subscriptions','CREATE subscriptions','{\"body\": {\"planId\": \"841d1eae-be6a-11f1-8891-088fc3017818\", \"customerId\": \"a496c3d3-be6a-11f1-8891-088fc3017818\"}}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36','2026-10-02 22:07:58'),(17,'b225f233-be6a-11f1-8891-088fc3017818','5558814a-be63-11f1-8891-088fc3017818','5559990d-be63-11f1-8891-088fc3017818','324de890-be68-11f1-8891-088fc3017818','create','subscriptions','Created subscription for ACC-000001 — RAMOS NEIL on plan \"FIBER 50MPBS\"','{\"after\": {\"onuId\": null, \"planId\": \"841d1eae-be6a-11f1-8891-088fc3017818\", \"status\": \"pending\", \"branchId\": \"5559990d-be63-11f1-8891-088fc3017818\", \"companyId\": \"5558814a-be63-11f1-8891-088fc3017818\", \"customerId\": \"998e8bb5-be6a-11f1-8891-088fc3017818\", \"activatedAt\": null, \"subscriptionId\": \"b225a0aa-be6a-11f1-8891-088fc3017818\"}, \"before\": null}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36','2026-10-02 22:08:08'),(18,'b2269522-be6a-11f1-8891-088fc3017818','5558814a-be63-11f1-8891-088fc3017818','5559990d-be63-11f1-8891-088fc3017818','324de890-be68-11f1-8891-088fc3017818','CREATE','subscriptions','CREATE subscriptions','{\"body\": {\"planId\": \"841d1eae-be6a-11f1-8891-088fc3017818\", \"customerId\": \"998e8bb5-be6a-11f1-8891-088fc3017818\"}}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36','2026-10-02 22:08:08'),(19,'b6ca842d-be6a-11f1-8891-088fc3017818','5558814a-be63-11f1-8891-088fc3017818','5559990d-be63-11f1-8891-088fc3017818','324de890-be68-11f1-8891-088fc3017818','activate','subscriptions','Activated subscription — billing begins from this date','{\"after\": {\"onuId\": null, \"planId\": \"841d1eae-be6a-11f1-8891-088fc3017818\", \"status\": \"active\", \"branchId\": \"5559990d-be63-11f1-8891-088fc3017818\", \"companyId\": \"5558814a-be63-11f1-8891-088fc3017818\", \"customerId\": \"998e8bb5-be6a-11f1-8891-088fc3017818\", \"activatedAt\": \"2026-10-02 22:08:16\", \"suspendedAt\": null, \"terminatedAt\": null, \"forRecoveryAt\": null, \"subscriptionId\": \"b225a0aa-be6a-11f1-8891-088fc3017818\", \"recoveryOutcome\": null}, \"before\": {\"onuId\": null, \"planId\": \"841d1eae-be6a-11f1-8891-088fc3017818\", \"status\": \"pending\", \"branchId\": \"5559990d-be63-11f1-8891-088fc3017818\", \"companyId\": \"5558814a-be63-11f1-8891-088fc3017818\", \"customerId\": \"998e8bb5-be6a-11f1-8891-088fc3017818\", \"activatedAt\": null, \"suspendedAt\": null, \"terminatedAt\": null, \"forRecoveryAt\": null, \"subscriptionId\": \"b225a0aa-be6a-11f1-8891-088fc3017818\", \"recoveryOutcome\": null}}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36','2026-10-02 22:08:16'),(20,'b6ccb279-be6a-11f1-8891-088fc3017818','5558814a-be63-11f1-8891-088fc3017818','5559990d-be63-11f1-8891-088fc3017818','324de890-be68-11f1-8891-088fc3017818','CREATE','subscriptions','CREATE subscriptions','{\"body\": {\"action\": \"activate\"}, \"params\": {\"subscriptionId\": \"b225a0aa-be6a-11f1-8891-088fc3017818\"}}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36','2026-10-02 22:08:16'),(21,'b951d193-be6a-11f1-8891-088fc3017818','5558814a-be63-11f1-8891-088fc3017818','5559990d-be63-11f1-8891-088fc3017818','324de890-be68-11f1-8891-088fc3017818','activate','subscriptions','Activated subscription — billing begins from this date','{\"after\": {\"onuId\": null, \"planId\": \"841d1eae-be6a-11f1-8891-088fc3017818\", \"status\": \"active\", \"branchId\": \"5559990d-be63-11f1-8891-088fc3017818\", \"companyId\": \"5558814a-be63-11f1-8891-088fc3017818\", \"customerId\": \"a496c3d3-be6a-11f1-8891-088fc3017818\", \"activatedAt\": \"2026-10-02 22:08:21\", \"suspendedAt\": null, \"terminatedAt\": null, \"forRecoveryAt\": null, \"subscriptionId\": \"abf90f82-be6a-11f1-8891-088fc3017818\", \"recoveryOutcome\": null}, \"before\": {\"onuId\": null, \"planId\": \"841d1eae-be6a-11f1-8891-088fc3017818\", \"status\": \"pending\", \"branchId\": \"5559990d-be63-11f1-8891-088fc3017818\", \"companyId\": \"5558814a-be63-11f1-8891-088fc3017818\", \"customerId\": \"a496c3d3-be6a-11f1-8891-088fc3017818\", \"activatedAt\": null, \"suspendedAt\": null, \"terminatedAt\": null, \"forRecoveryAt\": null, \"subscriptionId\": \"abf90f82-be6a-11f1-8891-088fc3017818\", \"recoveryOutcome\": null}}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36','2026-10-02 22:08:21'),(22,'b953efc9-be6a-11f1-8891-088fc3017818','5558814a-be63-11f1-8891-088fc3017818','5559990d-be63-11f1-8891-088fc3017818','324de890-be68-11f1-8891-088fc3017818','CREATE','subscriptions','CREATE subscriptions','{\"body\": {\"action\": \"activate\"}, \"params\": {\"subscriptionId\": \"abf90f82-be6a-11f1-8891-088fc3017818\"}}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36','2026-10-02 22:08:21'),(23,'003864d2-be6b-11f1-8891-088fc3017818','5558814a-be63-11f1-8891-088fc3017818','5559990d-be63-11f1-8891-088fc3017818','324de890-be68-11f1-8891-088fc3017818','invoice_generated','billing','Invoice INV-2026-000001 for 2026-10-01','{\"after\": {\"total\": \"1451.61\", \"invoiceId\": \"00377167-be6b-11f1-8891-088fc3017818\", \"invoiceNo\": \"INV-2026-000001\", \"periodStart\": \"2026-10-01\", \"serviceDays\": 30}, \"before\": null}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36','2026-10-02 22:10:19'),(24,'003ac748-be6b-11f1-8891-088fc3017818','5558814a-be63-11f1-8891-088fc3017818','5559990d-be63-11f1-8891-088fc3017818','324de890-be68-11f1-8891-088fc3017818','invoice_generated','billing','Invoice INV-2026-000002 for 2026-10-01','{\"after\": {\"total\": \"1451.61\", \"invoiceId\": \"003a523a-be6b-11f1-8891-088fc3017818\", \"invoiceNo\": \"INV-2026-000002\", \"periodStart\": \"2026-10-01\", \"serviceDays\": 30}, \"before\": null}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36','2026-10-02 22:10:19'),(25,'003bd9e2-be6b-11f1-8891-088fc3017818','5558814a-be63-11f1-8891-088fc3017818','5559990d-be63-11f1-8891-088fc3017818','324de890-be68-11f1-8891-088fc3017818','CREATE','billing','CREATE billing',NULL,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36','2026-10-02 22:10:19'),(26,'049d8b99-be6b-11f1-8891-088fc3017818','5558814a-be63-11f1-8891-088fc3017818','5559990d-be63-11f1-8891-088fc3017818','324de890-be68-11f1-8891-088fc3017818','CREATE','billing','CREATE billing',NULL,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36','2026-10-02 22:10:27'),(27,'c7624ca7-be6b-11f1-8891-088fc3017818','5558814a-be63-11f1-8891-088fc3017818','5559990d-be63-11f1-8891-088fc3017818','324de890-be68-11f1-8891-088fc3017818','payment_recorded','billing','GCASH payment for invoice INV-2026-000001','{\"after\": {\"amount\": \"1451.61\", \"status\": \"paid\", \"channel\": \"GCASH\", \"provider\": null, \"paymentId\": \"c761bb48-be6b-11f1-8891-088fc3017818\"}, \"before\": {\"status\": \"issued\"}}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36','2026-10-02 22:15:54'),(28,'c764e057-be6b-11f1-8891-088fc3017818','5558814a-be63-11f1-8891-088fc3017818','5559990d-be63-11f1-8891-088fc3017818','324de890-be68-11f1-8891-088fc3017818','CREATE','billing','CREATE billing','{\"body\": {\"amount\": 1451.61, \"channel\": \"GCASH\", \"invoiceId\": \"00377167-be6b-11f1-8891-088fc3017818\", \"referenceNo\": \"3045631466653\"}}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36','2026-10-02 22:15:54'),(29,'1a9ec64d-be6c-11f1-8891-088fc3017818','5558814a-be63-11f1-8891-088fc3017818','5559990d-be63-11f1-8891-088fc3017818','324de890-be68-11f1-8891-088fc3017818','CREATE','billing','CREATE billing',NULL,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36','2026-10-02 22:18:13'),(30,'3c8e3075-be6c-11f1-8891-088fc3017818','5558814a-be63-11f1-8891-088fc3017818','5559990d-be63-11f1-8891-088fc3017818','324de890-be68-11f1-8891-088fc3017818','payment_recorded','billing','GCASH payment for invoice INV-2026-000002','{\"after\": {\"amount\": \"1451.61\", \"status\": \"paid\", \"channel\": \"GCASH\", \"provider\": null, \"paymentId\": \"3c8d8030-be6c-11f1-8891-088fc3017818\"}, \"before\": {\"status\": \"issued\"}}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36','2026-10-02 22:19:10'),(31,'3c90a85a-be6c-11f1-8891-088fc3017818','5558814a-be63-11f1-8891-088fc3017818','5559990d-be63-11f1-8891-088fc3017818','324de890-be68-11f1-8891-088fc3017818','CREATE','billing','CREATE billing','{\"body\": {\"amount\": 1451.61, \"channel\": \"GCASH\", \"invoiceId\": \"003a523a-be6b-11f1-8891-088fc3017818\", \"referenceNo\": \"1234567890123\"}}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36','2026-10-02 22:19:10'),(32,'72e2936d-be6f-11f1-bea8-088fc3017818','5558814a-be63-11f1-8891-088fc3017818','5559990d-be63-11f1-8891-088fc3017818','system:superadmin:superadmin','reset_password','users','Password reset from SuperAdmin for ahchilee40@gmail.com','{\"meta\": {\"accountId\": \"324de890-be68-11f1-8891-088fc3017818\"}, \"after\": null, \"before\": null}','::ffff:100.122.158.28','teranetwork-superadmin/1','2026-10-02 22:42:10');
/*!40000 ALTER TABLE `audit_trail` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `branches`
--

DROP TABLE IF EXISTS `branches`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `branches` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `branchId` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `companyId` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `email` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `phone` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `address` text COLLATE utf8mb4_unicode_ci,
  `regCode` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `provCode` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `citymunCode` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `brgyCode` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `zipCode` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `logoUrl` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `website` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `paymentProvider` varchar(30) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `isMainBranch` tinyint(1) NOT NULL DEFAULT '0',
  `status` enum('Active','Inactive','Suspended','Deleted') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'Active',
  `dateCreated` datetime NOT NULL,
  `dateUpdated` datetime NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `branchId` (`branchId`),
  KEY `idx_branches_companyId` (`companyId`),
  KEY `idx_branches_tenant` (`companyId`,`status`),
  CONSTRAINT `fk_branches_company` FOREIGN KEY (`companyId`) REFERENCES `companies` (`companyId`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `branches`
--

LOCK TABLES `branches` WRITE;
/*!40000 ALTER TABLE `branches` DISABLE KEYS */;
INSERT INTO `branches` VALUES (1,'5559990d-be63-11f1-8891-088fc3017818','5558814a-be63-11f1-8891-088fc3017818','Test Branch',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,1,'Active','2026-10-02 21:15:26','2026-10-02 21:15:26');
/*!40000 ALTER TABLE `branches` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `companies`
--

DROP TABLE IF EXISTS `companies`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `companies` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `companyId` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `email` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `phone` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `website` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `logoUrl` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `address` text COLLATE utf8mb4_unicode_ci,
  `tin` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `subscriptionPlan` enum('Basic','Standard','Premium','Enterprise') COLLATE utf8mb4_unicode_ci NOT NULL,
  `subscriptionStartDate` date DEFAULT NULL,
  `subscriptionEndDate` date DEFAULT NULL,
  `status` enum('Active','Inactive','Suspended','Pending','Deleted') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'Pending',
  `dateCreated` datetime NOT NULL,
  `dateUpdated` datetime NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `companyId` (`companyId`),
  UNIQUE KEY `email` (`email`),
  KEY `idx_companies_status` (`status`),
  KEY `idx_companies_subscriptionPlan` (`subscriptionPlan`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `companies`
--

LOCK TABLES `companies` WRITE;
/*!40000 ALTER TABLE `companies` DISABLE KEYS */;
INSERT INTO `companies` VALUES (1,'5558814a-be63-11f1-8891-088fc3017818','TERANETWORK','sampletestemail76@gmail.com',NULL,NULL,'/uploads/superadmin/logos/5558814a-be63-11f1-8891-088fc3017818/d019faf453ee5ce7574f14f87bec85f720261002220557.png','AAA',NULL,'Enterprise','2026-10-02',NULL,'Active','2026-10-02 21:15:26','2026-10-02 22:06:08');
/*!40000 ALTER TABLE `companies` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `counters`
--

DROP TABLE IF EXISTS `counters`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `counters` (
  `name` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `nextValue` bigint unsigned NOT NULL DEFAULT '1',
  `dateUpdated` datetime NOT NULL,
  PRIMARY KEY (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `counters`
--

LOCK TABLES `counters` WRITE;
/*!40000 ALTER TABLE `counters` DISABLE KEYS */;
INSERT INTO `counters` VALUES ('customerAccountNo:5558814a-be63-11f1-8891-088fc3017818',3,'2026-10-02 22:07:46'),('invoiceNo:5558814a-be63-11f1-8891-088fc3017818:2026',3,'2026-10-02 22:10:19');
/*!40000 ALTER TABLE `counters` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `credentials`
--

DROP TABLE IF EXISTS `credentials`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `credentials` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `accountId` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `email` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `password` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `type` enum('SUPERADMIN','ADMIN','USER') COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` enum('Active','Inactive','Suspended','Deleted') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'Active',
  `dateCreated` datetime NOT NULL,
  `dateUpdated` datetime NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `accountId` (`accountId`),
  UNIQUE KEY `email` (`email`)
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `credentials`
--

LOCK TABLES `credentials` WRITE;
/*!40000 ALTER TABLE `credentials` DISABLE KEYS */;
INSERT INTO `credentials` VALUES (1,'324de890-be68-11f1-8891-088fc3017818','ahchilee40@gmail.com','$argon2id$v=19$m=19456,t=3,p=1$lmalsvyytsINClb/uklJ6Q$8t/G8AL9euEmltKKm5BtIJUr2ZHXc+SN6yOwVXSZbRA','ADMIN','Active','2026-10-02 21:50:15','2026-10-02 22:42:10'),(2,'8e1f1195-be69-11f1-8891-088fc3017818','test@billing.com','$argon2id$v=19$m=19456,t=3,p=1$DiR7s+g5Shx+xvRak2kw0Q$pyTEvPHYgLW6VBC2LLMStWJ/eiKNGGu/zS9lOmC+z8Y','ADMIN','Active','2026-10-02 21:59:59','2026-10-02 21:59:59'),(3,'9e59b2eb-be69-11f1-8891-088fc3017818','test@technician.com','$argon2id$v=19$m=19456,t=3,p=1$Obko1imxBRem9IJjSH5dNQ$qFhCn1WsBMjdDhR9ci+MkRwY4XwrKNBKwqlJ7AXyKUY','ADMIN','Deleted','2026-10-02 22:00:26','2026-10-02 22:02:25'),(7,'07901371-be6a-11f1-8891-088fc3017818','testa@technician.com','$argon2id$v=19$m=19456,t=3,p=1$H8eQa+Y91DH5DEDZBhKwAw$XGm0G5hwoh2QeVCMYo95Z0PfHBGNvIaMuDK0KRQe4xU','ADMIN','Active','2026-10-02 22:03:22','2026-10-02 22:03:22');
/*!40000 ALTER TABLE `credentials` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `customers`
--

DROP TABLE IF EXISTS `customers`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `customers` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `customerId` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `companyId` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `branchId` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `accountNo` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(150) COLLATE utf8mb4_unicode_ci NOT NULL,
  `email` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `phone` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `address` text COLLATE utf8mb4_unicode_ci,
  `gpsLat` decimal(10,7) DEFAULT NULL,
  `gpsLng` decimal(10,7) DEFAULT NULL,
  `idType` varchar(40) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `idNumber` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `notes` text COLLATE utf8mb4_unicode_ci,
  `status` enum('Active','Inactive','Deleted') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'Active',
  `dateCreated` datetime NOT NULL,
  `dateUpdated` datetime NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `customerId` (`customerId`),
  UNIQUE KEY `accountNo` (`accountNo`),
  KEY `idx_customers_companyId` (`companyId`),
  KEY `idx_customers_branchId` (`branchId`),
  KEY `idx_customers_tenant` (`companyId`,`branchId`,`status`),
  KEY `idx_customers_email` (`email`),
  CONSTRAINT `fk_customers_branch` FOREIGN KEY (`branchId`) REFERENCES `branches` (`branchId`),
  CONSTRAINT `fk_customers_company` FOREIGN KEY (`companyId`) REFERENCES `companies` (`companyId`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `customers`
--

LOCK TABLES `customers` WRITE;
/*!40000 ALTER TABLE `customers` DISABLE KEYS */;
INSERT INTO `customers` VALUES (1,'998e8bb5-be6a-11f1-8891-088fc3017818','5558814a-be63-11f1-8891-088fc3017818','5559990d-be63-11f1-8891-088fc3017818','ACC-000001','RAMOS NEIL','ravenbayatan11@gmail.com',NULL,NULL,NULL,NULL,NULL,NULL,NULL,'Active','2026-10-02 22:07:27','2026-10-02 22:07:27'),(2,'a496c3d3-be6a-11f1-8891-088fc3017818','5558814a-be63-11f1-8891-088fc3017818','5559990d-be63-11f1-8891-088fc3017818','ACC-000002','BRIAN PATOY','johnravenbayatan@gmail.com',NULL,NULL,NULL,NULL,NULL,NULL,NULL,'Active','2026-10-02 22:07:46','2026-10-02 22:07:46');
/*!40000 ALTER TABLE `customers` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `discovered_items`
--

DROP TABLE IF EXISTS `discovered_items`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `discovered_items` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `discoveredItemId` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `discoveryRunId` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `companyId` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `branchId` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `source` enum('olt','mikrotik') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'olt',
  `externalKey` varchar(190) COLLATE utf8mb4_unicode_ci NOT NULL,
  `matchStatus` enum('matched','new','orphaned') COLLATE utf8mb4_unicode_ci NOT NULL,
  `matchedEntity` enum('onu','subscription') COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `matchedId` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `raw` json DEFAULT NULL,
  `suggested` json DEFAULT NULL,
  `importedAt` datetime DEFAULT NULL,
  `importedBy` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `dateCreated` datetime NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `discoveredItemId` (`discoveredItemId`),
  KEY `idx_discovered_items_run` (`discoveryRunId`,`matchStatus`),
  KEY `idx_discovered_items_key` (`externalKey`),
  KEY `idx_discovered_items_tenant` (`companyId`,`branchId`),
  KEY `fk_discovered_items_branch` (`branchId`),
  CONSTRAINT `fk_discovered_items_branch` FOREIGN KEY (`branchId`) REFERENCES `branches` (`branchId`),
  CONSTRAINT `fk_discovered_items_company` FOREIGN KEY (`companyId`) REFERENCES `companies` (`companyId`),
  CONSTRAINT `fk_discovered_items_run` FOREIGN KEY (`discoveryRunId`) REFERENCES `discovery_runs` (`discoveryRunId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `discovered_items`
--

LOCK TABLES `discovered_items` WRITE;
/*!40000 ALTER TABLE `discovered_items` DISABLE KEYS */;
/*!40000 ALTER TABLE `discovered_items` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `discovery_runs`
--

DROP TABLE IF EXISTS `discovery_runs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `discovery_runs` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `discoveryRunId` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `companyId` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `branchId` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `oltId` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` enum('running','completed','failed') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'running',
  `matchedCount` int NOT NULL DEFAULT '0',
  `newCount` int NOT NULL DEFAULT '0',
  `orphanedCount` int NOT NULL DEFAULT '0',
  `command` text COLLATE utf8mb4_unicode_ci,
  `deviceResponse` mediumtext COLLATE utf8mb4_unicode_ci,
  `error` text COLLATE utf8mb4_unicode_ci,
  `durationMs` int DEFAULT NULL,
  `triggeredBy` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `startedAt` datetime NOT NULL,
  `finishedAt` datetime DEFAULT NULL,
  `dateCreated` datetime NOT NULL,
  `dateUpdated` datetime NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `discoveryRunId` (`discoveryRunId`),
  KEY `idx_discovery_runs_olt` (`oltId`,`dateCreated`),
  KEY `idx_discovery_runs_tenant` (`companyId`,`branchId`,`dateCreated`),
  KEY `fk_discovery_runs_branch` (`branchId`),
  CONSTRAINT `fk_discovery_runs_branch` FOREIGN KEY (`branchId`) REFERENCES `branches` (`branchId`),
  CONSTRAINT `fk_discovery_runs_company` FOREIGN KEY (`companyId`) REFERENCES `companies` (`companyId`),
  CONSTRAINT `fk_discovery_runs_olt` FOREIGN KEY (`oltId`) REFERENCES `olts` (`oltId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `discovery_runs`
--

LOCK TABLES `discovery_runs` WRITE;
/*!40000 ALTER TABLE `discovery_runs` DISABLE KEYS */;
/*!40000 ALTER TABLE `discovery_runs` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `dunning_exemptions`
--

DROP TABLE IF EXISTS `dunning_exemptions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `dunning_exemptions` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `exemptionId` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `companyId` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `branchId` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `subscriptionId` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `reason` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `expiresAt` datetime NOT NULL,
  `createdBy` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `revokedBy` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `revokedAt` datetime DEFAULT NULL,
  `revokeReason` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status` enum('Active','Revoked') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'Active',
  `dateCreated` datetime NOT NULL,
  `dateUpdated` datetime NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `exemptionId` (`exemptionId`),
  KEY `idx_dunning_exemptions_live` (`subscriptionId`,`status`,`expiresAt`),
  KEY `idx_dunning_exemptions_tenant` (`companyId`,`branchId`,`status`),
  KEY `fk_dunning_exemptions_branch` (`branchId`),
  CONSTRAINT `fk_dunning_exemptions_branch` FOREIGN KEY (`branchId`) REFERENCES `branches` (`branchId`),
  CONSTRAINT `fk_dunning_exemptions_company` FOREIGN KEY (`companyId`) REFERENCES `companies` (`companyId`),
  CONSTRAINT `fk_dunning_exemptions_subscription` FOREIGN KEY (`subscriptionId`) REFERENCES `subscriptions` (`subscriptionId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `dunning_exemptions`
--

LOCK TABLES `dunning_exemptions` WRITE;
/*!40000 ALTER TABLE `dunning_exemptions` DISABLE KEYS */;
/*!40000 ALTER TABLE `dunning_exemptions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `email_events`
--

DROP TABLE IF EXISTS `email_events`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `email_events` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `emailEventId` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `companyId` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `invoiceId` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `customerId` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `type` enum('invoice_issued','reminder','final','overdue','suspension','reconnection','payment_received') COLLATE utf8mb4_unicode_ci NOT NULL,
  `recipient` varchar(190) COLLATE utf8mb4_unicode_ci NOT NULL,
  `subject` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `providerMsgId` varchar(128) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `providerStatus` enum('queued','sent','delivered','bounced','opened','failed') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'queued',
  `error` text COLLATE utf8mb4_unicode_ci,
  `dateCreated` datetime NOT NULL,
  `dateUpdated` datetime NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `emailEventId` (`emailEventId`),
  KEY `idx_email_events_invoice` (`invoiceId`),
  KEY `idx_email_events_customer` (`customerId`,`type`),
  KEY `fk_email_events_company` (`companyId`),
  CONSTRAINT `fk_email_events_company` FOREIGN KEY (`companyId`) REFERENCES `companies` (`companyId`),
  CONSTRAINT `fk_email_events_customer` FOREIGN KEY (`customerId`) REFERENCES `customers` (`customerId`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `email_events`
--

LOCK TABLES `email_events` WRITE;
/*!40000 ALTER TABLE `email_events` DISABLE KEYS */;
INSERT INTO `email_events` VALUES (1,'047b93b8-be6b-11f1-8891-088fc3017818','5558814a-be63-11f1-8891-088fc3017818','00377167-be6b-11f1-8891-088fc3017818','a496c3d3-be6a-11f1-8891-088fc3017818','invoice_issued','johnravenbayatan@gmail.com','Invoice INV-2026-000001 — PHP 1,451.61 due 2026-11-02','<9046fbf9-a94f-0549-1c98-f7744abd17a9@gmail.com>','sent',NULL,'2026-10-02 22:10:27','2026-10-02 22:10:27'),(2,'071e4561-be6b-11f1-8891-088fc3017818','5558814a-be63-11f1-8891-088fc3017818','003a523a-be6b-11f1-8891-088fc3017818','998e8bb5-be6a-11f1-8891-088fc3017818','invoice_issued','ravenbayatan11@gmail.com','Invoice INV-2026-000002 — PHP 1,451.61 due 2026-11-02','<6da72576-2c73-7dca-7247-40358202b665@gmail.com>','sent',NULL,'2026-10-02 22:10:31','2026-10-02 22:10:31'),(3,'cadc66a0-be6b-11f1-8891-088fc3017818','5558814a-be63-11f1-8891-088fc3017818','00377167-be6b-11f1-8891-088fc3017818','a496c3d3-be6a-11f1-8891-088fc3017818','payment_received','johnravenbayatan@gmail.com','Payment received — invoice INV-2026-000001','<61e9b28a-85f5-352f-7c32-e16310400904@gmail.com>','sent',NULL,'2026-10-02 22:15:59','2026-10-02 22:15:59'),(4,'3fdb9557-be6c-11f1-8891-088fc3017818','5558814a-be63-11f1-8891-088fc3017818','003a523a-be6b-11f1-8891-088fc3017818','998e8bb5-be6a-11f1-8891-088fc3017818','payment_received','ravenbayatan11@gmail.com','Payment received — invoice INV-2026-000002','<7efdf330-6bf6-03d4-d5b2-73c51dc6137d@gmail.com>','sent',NULL,'2026-10-02 22:19:16','2026-10-02 22:19:16');
/*!40000 ALTER TABLE `email_events` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `gcash_statement_transactions`
--

DROP TABLE IF EXISTS `gcash_statement_transactions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `gcash_statement_transactions` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `transactionId` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `companyId` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `branchId` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `statementId` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `referenceNo` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `transactedAt` datetime NOT NULL,
  `description` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `amount` decimal(12,2) NOT NULL,
  `reviewStatus` enum('open','not_customer') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'open',
  `reviewedBy` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `reviewedAt` datetime DEFAULT NULL,
  `status` enum('Active','Deleted') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'Active',
  `dateCreated` datetime NOT NULL,
  `dateUpdated` datetime NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `transactionId` (`transactionId`),
  UNIQUE KEY `uq_gcash_statement_transactions_ref` (`branchId`,`referenceNo`),
  KEY `idx_gcash_statement_transactions_tenant` (`companyId`,`branchId`,`transactedAt`),
  KEY `idx_gcash_statement_transactions_statement` (`statementId`),
  CONSTRAINT `fk_gcash_statement_transactions_branch` FOREIGN KEY (`branchId`) REFERENCES `branches` (`branchId`),
  CONSTRAINT `fk_gcash_statement_transactions_company` FOREIGN KEY (`companyId`) REFERENCES `companies` (`companyId`),
  CONSTRAINT `fk_gcash_statement_transactions_statement` FOREIGN KEY (`statementId`) REFERENCES `gcash_statements` (`statementId`)
) ENGINE=InnoDB AUTO_INCREMENT=17 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `gcash_statement_transactions`
--

LOCK TABLES `gcash_statement_transactions` WRITE;
/*!40000 ALTER TABLE `gcash_statement_transactions` DISABLE KEYS */;
INSERT INTO `gcash_statement_transactions` VALUES (1,'1a9b186c-be6c-11f1-8891-088fc3017818','5558814a-be63-11f1-8891-088fc3017818','5559990d-be63-11f1-8891-088fc3017818','1a9a8fca-be6c-11f1-8891-088fc3017818','9045436747999','2026-09-25 20:37:00','Transfer from 09457916433 to 09456014056',195.00,'open',NULL,NULL,'Active','2026-10-02 22:18:13','2026-10-02 22:18:13'),(2,'1a9b61de-be6c-11f1-8891-088fc3017818','5558814a-be63-11f1-8891-088fc3017818','5559990d-be63-11f1-8891-088fc3017818','1a9a8fca-be6c-11f1-8891-088fc3017818','9045445613682','2026-09-26 07:04:00','Transfer from 09457916433 to 09456014056',244.00,'open',NULL,NULL,'Active','2026-10-02 22:18:13','2026-10-02 22:18:13'),(3,'1a9b83c1-be6c-11f1-8891-088fc3017818','5558814a-be63-11f1-8891-088fc3017818','5559990d-be63-11f1-8891-088fc3017818','1a9a8fca-be6c-11f1-8891-088fc3017818','6045445844375','2026-09-26 07:17:00','Transfer from 09562788183 to 09456014056',1050.00,'open',NULL,NULL,'Active','2026-10-02 22:18:13','2026-10-02 22:18:13'),(4,'1a9ba7aa-be6c-11f1-8891-088fc3017818','5558814a-be63-11f1-8891-088fc3017818','5559990d-be63-11f1-8891-088fc3017818','1a9a8fca-be6c-11f1-8891-088fc3017818','7045446224817','2026-09-26 07:37:00','Received GCash from MariBank with account ending in 4416 and invno:20260926LAUIPHM2XXXB000000539089945',100.00,'open',NULL,NULL,'Active','2026-10-02 22:18:13','2026-10-02 22:18:13'),(5,'1a9bce59-be6c-11f1-8891-088fc3017818','5558814a-be63-11f1-8891-088fc3017818','5559990d-be63-11f1-8891-088fc3017818','1a9a8fca-be6c-11f1-8891-088fc3017818','7045448701721','2026-09-26 09:18:00','Received GCash from MariBank with account ending in 4651 and invno:20260926LAUIPHM2XXXB000000539221764',510.00,'open',NULL,NULL,'Active','2026-10-02 22:18:13','2026-10-02 22:18:13'),(6,'1a9bf0b4-be6c-11f1-8891-088fc3017818','5558814a-be63-11f1-8891-088fc3017818','5559990d-be63-11f1-8891-088fc3017818','1a9a8fca-be6c-11f1-8891-088fc3017818','9045462466650','2026-09-26 16:29:00','Transfer from 09457916433 to 09456014056',1.00,'open',NULL,NULL,'Active','2026-10-02 22:18:13','2026-10-02 22:18:13'),(7,'1a9c16ce-be6c-11f1-8891-088fc3017818','5558814a-be63-11f1-8891-088fc3017818','5559990d-be63-11f1-8891-088fc3017818','1a9a8fca-be6c-11f1-8891-088fc3017818','2045463036546','2026-09-26 16:45:00','Transfer from 09754989656 to 09456014056',375.00,'open',NULL,NULL,'Active','2026-10-02 22:18:13','2026-10-02 22:18:13'),(8,'1a9c4f94-be6c-11f1-8891-088fc3017818','5558814a-be63-11f1-8891-088fc3017818','5559990d-be63-11f1-8891-088fc3017818','1a9a8fca-be6c-11f1-8891-088fc3017818','6045465600203','2026-09-26 17:52:00','Transfer from 09273744940 to 09456014056',1056.00,'open',NULL,NULL,'Active','2026-10-02 22:18:13','2026-10-02 22:18:13'),(9,'1a9c7109-be6c-11f1-8891-088fc3017818','5558814a-be63-11f1-8891-088fc3017818','5559990d-be63-11f1-8891-088fc3017818','1a9a8fca-be6c-11f1-8891-088fc3017818','9045494763932','2026-09-27 15:29:00','Transfer from 09457916433 to 09456014056',50.00,'open',NULL,NULL,'Active','2026-10-02 22:18:13','2026-10-02 22:18:13'),(10,'1a9c8b19-be6c-11f1-8891-088fc3017818','5558814a-be63-11f1-8891-088fc3017818','5559990d-be63-11f1-8891-088fc3017818','1a9a8fca-be6c-11f1-8891-088fc3017818','7045507612145','2026-09-27 21:47:00','Received GCash from MariBank with account ending in 4416 and invno:20260927LAUIPHM2XXXB000000542513969',500.00,'open',NULL,NULL,'Active','2026-10-02 22:18:13','2026-10-02 22:18:13'),(11,'1a9ca640-be6c-11f1-8891-088fc3017818','5558814a-be63-11f1-8891-088fc3017818','5559990d-be63-11f1-8891-088fc3017818','1a9a8fca-be6c-11f1-8891-088fc3017818','7045522156215','2026-09-28 12:01:00','You have received GCash from lalamove-p3',300.00,'open',NULL,NULL,'Active','2026-10-02 22:18:13','2026-10-02 22:18:13'),(12,'1a9cc107-be6c-11f1-8891-088fc3017818','5558814a-be63-11f1-8891-088fc3017818','5559990d-be63-11f1-8891-088fc3017818','1a9a8fca-be6c-11f1-8891-088fc3017818','42477045529509876','2026-09-28 15:46:00','Received GCash from Union Bank of the Philippines with account ending in and invno:20260928UBPHPHMMXXXB893234044372121',100.00,'open',NULL,NULL,'Active','2026-10-02 22:18:13','2026-10-02 22:18:13'),(13,'1a9cdb08-be6c-11f1-8891-088fc3017818','5558814a-be63-11f1-8891-088fc3017818','5559990d-be63-11f1-8891-088fc3017818','1a9a8fca-be6c-11f1-8891-088fc3017818','6045584033103','2026-09-30 07:50:00','Transfer from 09562788183 to 09456014056',100.00,'open',NULL,NULL,'Active','2026-10-02 22:18:13','2026-10-02 22:18:13'),(14,'1a9cf65a-be6c-11f1-8891-088fc3017818','5558814a-be63-11f1-8891-088fc3017818','5559990d-be63-11f1-8891-088fc3017818','1a9a8fca-be6c-11f1-8891-088fc3017818','7045584654862','2026-09-30 08:14:00','Received GCash from MariBank with account ending in 4416 and invno:20260930LAUIPHM2XXXB000000547120066',800.00,'open',NULL,NULL,'Active','2026-10-02 22:18:13','2026-10-02 22:18:13'),(15,'1a9d0ecb-be6c-11f1-8891-088fc3017818','5558814a-be63-11f1-8891-088fc3017818','5559990d-be63-11f1-8891-088fc3017818','1a9a8fca-be6c-11f1-8891-088fc3017818','7045623646829','2026-10-01 07:25:00','Received GCash from Metropolitan Bank and Trust Co. with account ending in 0638 and invno:20261001MBTCPHMMXXXB200000000576756',2500.00,'open',NULL,NULL,'Active','2026-10-02 22:18:13','2026-10-02 22:18:13'),(16,'1a9d36af-be6c-11f1-8891-088fc3017818','5558814a-be63-11f1-8891-088fc3017818','5559990d-be63-11f1-8891-088fc3017818','1a9a8fca-be6c-11f1-8891-088fc3017818','3045631466653','2026-10-01 11:12:00','Transfer from 09285248720 to 09456014056',1400.00,'open',NULL,NULL,'Active','2026-10-02 22:18:13','2026-10-02 22:18:13');
/*!40000 ALTER TABLE `gcash_statement_transactions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `gcash_statements`
--

DROP TABLE IF EXISTS `gcash_statements`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `gcash_statements` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `statementId` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `companyId` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `branchId` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `fileName` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `periodStart` date NOT NULL,
  `periodEnd` date NOT NULL,
  `creditCount` int NOT NULL DEFAULT '0',
  `newCreditCount` int NOT NULL DEFAULT '0',
  `uploadedBy` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status` enum('Active','Deleted') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'Active',
  `dateCreated` datetime NOT NULL,
  `dateUpdated` datetime NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `statementId` (`statementId`),
  KEY `idx_gcash_statements_tenant` (`companyId`,`branchId`,`periodStart`,`periodEnd`),
  KEY `fk_gcash_statements_branch` (`branchId`),
  CONSTRAINT `fk_gcash_statements_branch` FOREIGN KEY (`branchId`) REFERENCES `branches` (`branchId`),
  CONSTRAINT `fk_gcash_statements_company` FOREIGN KEY (`companyId`) REFERENCES `companies` (`companyId`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `gcash_statements`
--

LOCK TABLES `gcash_statements` WRITE;
/*!40000 ALTER TABLE `gcash_statements` DISABLE KEYS */;
INSERT INTO `gcash_statements` VALUES (1,'1a9a8fca-be6c-11f1-8891-088fc3017818','5558814a-be63-11f1-8891-088fc3017818','5559990d-be63-11f1-8891-088fc3017818','enc-0945601_1790950590972.pdf','2026-09-25','2026-10-01',16,16,'324de890-be68-11f1-8891-088fc3017818','Active','2026-10-02 22:18:13','2026-10-02 22:18:13');
/*!40000 ALTER TABLE `gcash_statements` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `idempotency_keys`
--

DROP TABLE IF EXISTS `idempotency_keys`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `idempotency_keys` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `idempotencyKey` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `requestHash` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `responseCode` int NOT NULL,
  `responseBody` json DEFAULT NULL,
  `dateCreated` datetime NOT NULL,
  `expiresAt` datetime NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idempotencyKey` (`idempotencyKey`),
  KEY `idx_idempotency_keys_expiresAt` (`expiresAt`)
) ENGINE=InnoDB AUTO_INCREMENT=20 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `idempotency_keys`
--

LOCK TABLES `idempotency_keys` WRITE;
/*!40000 ALTER TABLE `idempotency_keys` DISABLE KEYS */;
INSERT INTO `idempotency_keys` VALUES (1,'11b6bd9f0007bfdbbcc04d1df7ba37c10f9cc6008f7e10a29bb690decb54fcb6','e42a582e94d49750879deec83a45be466f19063ed4d859cb51af425b506e3987',200,'{\"data\": {\"user\": {\"type\": \"ADMIN\", \"email\": \"ahchilee40@gmail.com\", \"roleId\": \"555a4ef8-be63-11f1-8891-088fc3017818\", \"status\": \"Active\", \"branchId\": \"5559990d-be63-11f1-8891-088fc3017818\", \"lastName\": \"Owner\", \"roleName\": \"Owner\", \"accountId\": \"324de890-be68-11f1-8891-088fc3017818\", \"companyId\": \"5558814a-be63-11f1-8891-088fc3017818\", \"firstName\": \"Test\"}, \"token\": \"eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIzMjRkZTg5MC1iZTY4LTExZjEtODg5MS0wODhmYzMwMTc4MTgiLCJhY2NvdW50SWQiOiIzMjRkZTg5MC1iZTY4LTExZjEtODg5MS0wODhmYzMwMTc4MTgiLCJlbWFpbCI6ImFoY2hpbGVlNDBAZ21haWwuY29tIiwidHlwZSI6ImFjY2VzcyIsImp0aSI6IjIxODZhMDdiNzMxNjJkOTQ5MmJhNGViOTUxMjNhZWE2ZWQxNjRkMzUzMGQ1M2ZlZTJkMjhlZjQ4MTEzN2E4ZWQiLCJpYXQiOjE3OTA5NDkwMzgsImV4cCI6MTc5MDk3NzgzOCwiYXVkIjoieW91ci1hcHAtdXNlcnMiLCJpc3MiOiJ5b3VyLWFwcC1uYW1lIn0.fpjnvOfNtcQSIIn7zIWsikNGZKigoZAV_wcnr-X3dl74f1TNYka3Hxdd6ikkiEE6FJxOav5PXlthINqA7lr98BTK20QnVViyW0KE-T_7RSL5BXMAZ9JIoteeEHDcEEhaYObw8hxz2Pz9lGxVjhhnupUsM3Cv-gqzgzEz6ddbgF_ztny-ekNqiUaapIcJTiKXENgj2pUpJO5PHYCsI4mpMWfg9qRbtpqy4PIM05ZPhEAKAiRWgrnvx7Ae-QexWHvGKXJVx27vmgbiGgmO5alxAp_WAporBqh-ByYWwrPxgWG-qC7UDtzSjDs1_Dfbt8A4FOxbk3UEy2LWCp10Ffp2dg\", \"accessToken\": {\"token\": \"eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIzMjRkZTg5MC1iZTY4LTExZjEtODg5MS0wODhmYzMwMTc4MTgiLCJhY2NvdW50SWQiOiIzMjRkZTg5MC1iZTY4LTExZjEtODg5MS0wODhmYzMwMTc4MTgiLCJlbWFpbCI6ImFoY2hpbGVlNDBAZ21haWwuY29tIiwidHlwZSI6ImFjY2VzcyIsImp0aSI6IjIxODZhMDdiNzMxNjJkOTQ5MmJhNGViOTUxMjNhZWE2ZWQxNjRkMzUzMGQ1M2ZlZTJkMjhlZjQ4MTEzN2E4ZWQiLCJpYXQiOjE3OTA5NDkwMzgsImV4cCI6MTc5MDk3NzgzOCwiYXVkIjoieW91ci1hcHAtdXNlcnMiLCJpc3MiOiJ5b3VyLWFwcC1uYW1lIn0.fpjnvOfNtcQSIIn7zIWsikNGZKigoZAV_wcnr-X3dl74f1TNYka3Hxdd6ikkiEE6FJxOav5PXlthINqA7lr98BTK20QnVViyW0KE-T_7RSL5BXMAZ9JIoteeEHDcEEhaYObw8hxz2Pz9lGxVjhhnupUsM3Cv-gqzgzEz6ddbgF_ztny-ekNqiUaapIcJTiKXENgj2pUpJO5PHYCsI4mpMWfg9qRbtpqy4PIM05ZPhEAKAiRWgrnvx7Ae-QexWHvGKXJVx27vmgbiGgmO5alxAp_WAporBqh-ByYWwrPxgWG-qC7UDtzSjDs1_Dfbt8A4FOxbk3UEy2LWCp10Ffp2dg\", \"expiresAt\": \"2026-10-02T21:50:38.000Z\", \"expiresIn\": \"8h\"}, \"refreshToken\": {\"token\": \"eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIzMjRkZTg5MC1iZTY4LTExZjEtODg5MS0wODhmYzMwMTc4MTgiLCJhY2NvdW50SWQiOiIzMjRkZTg5MC1iZTY4LTExZjEtODg5MS0wODhmYzMwMTc4MTgiLCJ0eXBlIjoicmVmcmVzaCIsImp0aSI6Ijc0NTA5MWQ3MzFjZWYzNTRjYThmYzI0NTBjYjViODMxMjNkMjdjN2IzYWFhNjQ3YTliNmQ0NzMyYmE5MTBjNzEiLCJpYXQiOjE3OTA5NDkwMzgsImV4cCI6MTc5MzU0MTAzOCwiYXVkIjoieW91ci1hcHAtdXNlcnMiLCJpc3MiOiJ5b3VyLWFwcC1uYW1lIn0.4xX2koV6-2sFIDRhTskZV_Gd5srqhXWiD9taLhU0-Tow24ayaNMVBpR3Vnw8eCmnWdMwqMEWPd9BFa6D_l5wiB8nFfhM5v5VN9uYKqtX432uvMturF9TZruKzBS9vptKz6mqRL3ik4zn_WA31hLdcxn6YuVQ8ca3weFd4emXFFj0UBlytMbF8KUpPq0cH8pik4MDGx1VS10XUIbaSSBUzUHmjHtvr-Bmlq127uS0aPNEyITrgSr_I7_ee-h-L7o6qWdnZ8OLWQbxAR4JwG-_ONSK2yGUMBUBJOa_RvWFi89wKaRGAzb1SG6GNWih1bTj6-jPfLb_zDSMTiZ7lZEKlA\", \"expiresAt\": \"2026-11-01T13:50:38.000Z\", \"expiresIn\": \"30d\"}}, \"message\": \"Login successful\", \"success\": true}','2026-10-02 21:50:38','2026-10-03 21:50:38'),(2,'d261305ac9b5addde733c4272531ca390551471fd98be064b68a21827c2878c3','e42a582e94d49750879deec83a45be466f19063ed4d859cb51af425b506e3987',200,'{\"data\": {\"user\": {\"type\": \"ADMIN\", \"email\": \"ahchilee40@gmail.com\", \"roleId\": \"555a4ef8-be63-11f1-8891-088fc3017818\", \"status\": \"Active\", \"branchId\": \"5559990d-be63-11f1-8891-088fc3017818\", \"lastName\": \"Owner\", \"roleName\": \"Owner\", \"accountId\": \"324de890-be68-11f1-8891-088fc3017818\", \"companyId\": \"5558814a-be63-11f1-8891-088fc3017818\", \"firstName\": \"Test\"}, \"token\": \"eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIzMjRkZTg5MC1iZTY4LTExZjEtODg5MS0wODhmYzMwMTc4MTgiLCJhY2NvdW50SWQiOiIzMjRkZTg5MC1iZTY4LTExZjEtODg5MS0wODhmYzMwMTc4MTgiLCJlbWFpbCI6ImFoY2hpbGVlNDBAZ21haWwuY29tIiwidHlwZSI6ImFjY2VzcyIsImp0aSI6ImE1OWRkMzc4ZTg3NTdhNzUyZjg3YmYwZjlmMWJkZjc5NzQ1NjQ1NDhiNWNkYjcwYjUzNjRmZGE1Yjc2NmRmNjAiLCJpYXQiOjE3OTA5NDkxNzYsImV4cCI6MTc5MDk3Nzk3NiwiYXVkIjoieW91ci1hcHAtdXNlcnMiLCJpc3MiOiJ5b3VyLWFwcC1uYW1lIn0.iJjMKfcglA8FuhDPIFyKSZk675oS167GfREO-jP-CfXIjEnpLqs55sCpnVvujNHK9u8V52PLgWkdXS7BXgBxEUkUJjfNhM3YFKJ0V4eZJgTIs8C6dJvKkIDL5YQCkNX50APNOu9J-0S3bw7dwPpJPr4g-nu190VqJOZfpuKX-rgrcoCZaCDzRX2c0g1f8VBTgE1Ubj_XdYAXEtUUetBA5hgXsoQILVJNqYTNz-iWxnSSNh-o818KNpNKEhIMPwlfim0s_4UicNAiEAwi6kzyc-X1skUIGldw59ejj4gonKOF_eG_XBor40qFd25WWO0oLDSMNnD5hfchQXl8M6FAig\", \"accessToken\": {\"token\": \"eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIzMjRkZTg5MC1iZTY4LTExZjEtODg5MS0wODhmYzMwMTc4MTgiLCJhY2NvdW50SWQiOiIzMjRkZTg5MC1iZTY4LTExZjEtODg5MS0wODhmYzMwMTc4MTgiLCJlbWFpbCI6ImFoY2hpbGVlNDBAZ21haWwuY29tIiwidHlwZSI6ImFjY2VzcyIsImp0aSI6ImE1OWRkMzc4ZTg3NTdhNzUyZjg3YmYwZjlmMWJkZjc5NzQ1NjQ1NDhiNWNkYjcwYjUzNjRmZGE1Yjc2NmRmNjAiLCJpYXQiOjE3OTA5NDkxNzYsImV4cCI6MTc5MDk3Nzk3NiwiYXVkIjoieW91ci1hcHAtdXNlcnMiLCJpc3MiOiJ5b3VyLWFwcC1uYW1lIn0.iJjMKfcglA8FuhDPIFyKSZk675oS167GfREO-jP-CfXIjEnpLqs55sCpnVvujNHK9u8V52PLgWkdXS7BXgBxEUkUJjfNhM3YFKJ0V4eZJgTIs8C6dJvKkIDL5YQCkNX50APNOu9J-0S3bw7dwPpJPr4g-nu190VqJOZfpuKX-rgrcoCZaCDzRX2c0g1f8VBTgE1Ubj_XdYAXEtUUetBA5hgXsoQILVJNqYTNz-iWxnSSNh-o818KNpNKEhIMPwlfim0s_4UicNAiEAwi6kzyc-X1skUIGldw59ejj4gonKOF_eG_XBor40qFd25WWO0oLDSMNnD5hfchQXl8M6FAig\", \"expiresAt\": \"2026-10-02T21:52:56.000Z\", \"expiresIn\": \"8h\"}, \"refreshToken\": {\"token\": \"eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIzMjRkZTg5MC1iZTY4LTExZjEtODg5MS0wODhmYzMwMTc4MTgiLCJhY2NvdW50SWQiOiIzMjRkZTg5MC1iZTY4LTExZjEtODg5MS0wODhmYzMwMTc4MTgiLCJ0eXBlIjoicmVmcmVzaCIsImp0aSI6IjFiZjBiOWNjMzY2YjNhMjM0MGNjMTRhZWI0MzM5ZmU4YTRlNjFjYjU5OTcwZGI0YzU4NDljN2FjZmYzZWIzM2EiLCJpYXQiOjE3OTA5NDkxNzYsImV4cCI6MTc5MzU0MTE3NiwiYXVkIjoieW91ci1hcHAtdXNlcnMiLCJpc3MiOiJ5b3VyLWFwcC1uYW1lIn0.T8vksR83p7PVSdXDSoR3Qfz4_PfL08QQDKW-MzeKh-ahyvV_g_VZW1cR1MKrTcyChCHdSp0cKyfVVeXZDCut6-P2WlUUTw3hnsWgYMcyfsH0EHQlfMeKTOVYlhmQ-Btds_Rb4QMaHTKaBfZxsWX6xwtMQyjNHq5LlfJq8fwvYaBW2WyYa2EWeRNaiQWn57AVlGX-wVQxD7bUTkKXnu3s5tsRcyF6upuMpcoHVBxqlOpy9IlSQd76D4phFxAzfOU094LxQpGGbfgapY2jzqzB3tcvHMyjBBGmbVzRk-1ij2Lrsxb8g5S8f4zy2LrcYNV2v0WyCp9reT21Ig7iJxY3iQ\", \"expiresAt\": \"2026-11-01T13:52:56.000Z\", \"expiresIn\": \"30d\"}}, \"message\": \"Login successful\", \"success\": true}','2026-10-02 21:52:56','2026-10-03 21:52:56'),(3,'e1b913aa3bddb0162502c89ac8051392636af401fdc685b46d3389cdb2089e51','a276bb70940770d856ab260dc5ac21ac747feb35ede0c14035a1321dab9c6657',201,'{\"data\": {\"accountId\": \"8e1f1195-be69-11f1-8891-088fc3017818\"}, \"message\": \"User created successfully\", \"success\": true}','2026-10-02 21:59:59','2026-10-03 21:59:59'),(4,'07be502f2811d9a15ad3f6cf3ce002613a7ff7627a4fa01c546526e2f46b3131','6a95f3a2c5470828f848d1efc55b30595baa46618ffb2d3b330b036e9332277b',201,'{\"data\": {\"accountId\": \"9e59b2eb-be69-11f1-8891-088fc3017818\"}, \"message\": \"User created successfully\", \"success\": true}','2026-10-02 22:00:26','2026-10-03 22:00:26'),(5,'24f043110b4578670519c08c1ccdc5ca200901fd65ce28d064f3f68800485174','0447fe685af90038d4ad4f7874cb8367a6686ff2963925cde237846acac4dc42',200,'{\"data\": {\"user\": {\"type\": \"ADMIN\", \"email\": \"test@billing.com\", \"roleId\": \"555bf257-be63-11f1-8891-088fc3017818\", \"status\": \"Active\", \"branchId\": \"5559990d-be63-11f1-8891-088fc3017818\", \"lastName\": \"Billing\", \"roleName\": \"Billing\", \"accountId\": \"8e1f1195-be69-11f1-8891-088fc3017818\", \"companyId\": \"5558814a-be63-11f1-8891-088fc3017818\", \"firstName\": \"Test\"}, \"token\": \"eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI4ZTFmMTE5NS1iZTY5LTExZjEtODg5MS0wODhmYzMwMTc4MTgiLCJhY2NvdW50SWQiOiI4ZTFmMTE5NS1iZTY5LTExZjEtODg5MS0wODhmYzMwMTc4MTgiLCJlbWFpbCI6InRlc3RAYmlsbGluZy5jb20iLCJ0eXBlIjoiYWNjZXNzIiwianRpIjoiYmNmODg2NzEwYWYzYzRiNDZkMjUwOTFmZDZiZmZmY2VhNWE2ODU3Mjg5OWJmYjE1NDAwYWFlNTc4NDQ3NTNlNiIsImlhdCI6MTc5MDk0OTY1MSwiZXhwIjoxNzkwOTc4NDUxLCJhdWQiOiJ5b3VyLWFwcC11c2VycyIsImlzcyI6InlvdXItYXBwLW5hbWUifQ.D-3OsUwnFliwykMZKKl9UpfNbG3eda6ZldcDIYG5KBMfodn6Ts71Mu2-S7VZNzd_1X8d9UqsEnH8HlCpbJu16YDdJ6OydOkrdBSRZNUWCzKeC5EPA3S-Rg8EK6XnJgBT3Hd5FYCj67nEdTHbewSoeLcgg7qpWCRo9i33QCR5jrdYcUG4FP1K9sOglI4a911yNLh19X0HHdbIkXfTiQMahqqxFeP8RihFAwjdJHlIUhLoeXpEaZzr53e6vc7DNIBHNsd_rJNARfydQvhTnXMOscPmIVHw6h9vX40A2xicDUZ450Z75t-pV0IzLViXOunfseEx5hVEras5h9oQ02IIZA\", \"accessToken\": {\"token\": \"eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI4ZTFmMTE5NS1iZTY5LTExZjEtODg5MS0wODhmYzMwMTc4MTgiLCJhY2NvdW50SWQiOiI4ZTFmMTE5NS1iZTY5LTExZjEtODg5MS0wODhmYzMwMTc4MTgiLCJlbWFpbCI6InRlc3RAYmlsbGluZy5jb20iLCJ0eXBlIjoiYWNjZXNzIiwianRpIjoiYmNmODg2NzEwYWYzYzRiNDZkMjUwOTFmZDZiZmZmY2VhNWE2ODU3Mjg5OWJmYjE1NDAwYWFlNTc4NDQ3NTNlNiIsImlhdCI6MTc5MDk0OTY1MSwiZXhwIjoxNzkwOTc4NDUxLCJhdWQiOiJ5b3VyLWFwcC11c2VycyIsImlzcyI6InlvdXItYXBwLW5hbWUifQ.D-3OsUwnFliwykMZKKl9UpfNbG3eda6ZldcDIYG5KBMfodn6Ts71Mu2-S7VZNzd_1X8d9UqsEnH8HlCpbJu16YDdJ6OydOkrdBSRZNUWCzKeC5EPA3S-Rg8EK6XnJgBT3Hd5FYCj67nEdTHbewSoeLcgg7qpWCRo9i33QCR5jrdYcUG4FP1K9sOglI4a911yNLh19X0HHdbIkXfTiQMahqqxFeP8RihFAwjdJHlIUhLoeXpEaZzr53e6vc7DNIBHNsd_rJNARfydQvhTnXMOscPmIVHw6h9vX40A2xicDUZ450Z75t-pV0IzLViXOunfseEx5hVEras5h9oQ02IIZA\", \"expiresAt\": \"2026-10-02T22:00:51.000Z\", \"expiresIn\": \"8h\"}, \"refreshToken\": {\"token\": \"eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI4ZTFmMTE5NS1iZTY5LTExZjEtODg5MS0wODhmYzMwMTc4MTgiLCJhY2NvdW50SWQiOiI4ZTFmMTE5NS1iZTY5LTExZjEtODg5MS0wODhmYzMwMTc4MTgiLCJ0eXBlIjoicmVmcmVzaCIsImp0aSI6ImFkZmYzZjIyZmVhN2JjM2MzY2VhOTg1NWE3NWIxMGE2OWQwZWQ2NGFhNDY0OTllZmNkYzA2NTE0NGI1ZWJjYTUiLCJpYXQiOjE3OTA5NDk2NTEsImV4cCI6MTc5MzU0MTY1MSwiYXVkIjoieW91ci1hcHAtdXNlcnMiLCJpc3MiOiJ5b3VyLWFwcC1uYW1lIn0.LpIfpXP1tLdRWBZ89jvNWMOiAeg-FyTByiw6JCBDjrql7rJ06IoM9Qs73Jpeg4fsAlANxwwAzvDVJSXTV6ekULk8JR6Gq3nKJWnQmnAozC6yuoEUuQBJL3AAo5b0_tQwnVH10VdFs_SezvnfRmaqF3Guy6QWVoy0px_Djb_M368uQVbqlQ5Rcia5miPJdjo3z7_6pXSsvg1cdHkopAOttpCXrcMNPWvWn7th6sI_8RBOSj9Q25vn1UuOxE-vYXnycn3XBK1Kgi6S41a3DD4yi8tUQW1iNVbQF5qPrfiCGbqlWFG5aD7a3u-WFRDYNUFd7oX5iWC6XKhYjQyMDfLGfQ\", \"expiresAt\": \"2026-11-01T14:00:51.000Z\", \"expiresIn\": \"30d\"}}, \"message\": \"Login successful\", \"success\": true}','2026-10-02 22:00:51','2026-10-03 22:00:51'),(6,'67a933358970e07484d8a983b945c706c3b74909e21e533f473c43000f125fee','44136fa355b3678a1146ad16f7e8649e94fb4fc21fe77e8310c060f61caaff8a',200,'{\"data\": null, \"message\": \"User deleted successfully\", \"success\": true}','2026-10-02 22:02:25','2026-10-03 22:02:25'),(7,'c6b25c2333b6cf79e600c2187818bf35aa026a0171f8f21ecec4180c36a0544c','0363ccfa92f316f87c31b20ddf4b0c643899400c803db24cf9fa1c0e61a9316b',201,'{\"data\": {\"accountId\": \"07901371-be6a-11f1-8891-088fc3017818\"}, \"message\": \"User created successfully\", \"success\": true}','2026-10-02 22:03:22','2026-10-03 22:03:22'),(8,'7a56227db09d0672bfa12703e7cf16468fc71449b766dda2ea304a717f932c82','e2bd653784e1b35a09811b35e20958f0443704a9dd8fd6b35f5c9bb607d93a96',201,'{\"data\": {\"planId\": \"841d1eae-be6a-11f1-8891-088fc3017818\"}, \"message\": \"Plan created successfully\", \"success\": true}','2026-10-02 22:06:51','2026-10-03 22:06:51'),(9,'3823f21d552f2ff824d6579eaad016382cc90a41225dcb20162a9790acb337b8','c0237926fe16a9be6114495b4c5c3a65ee82a6c8b72604fe437d4bfba9207240',201,'{\"data\": {\"accountNo\": \"ACC-000001\", \"customerId\": \"998e8bb5-be6a-11f1-8891-088fc3017818\"}, \"message\": \"Customer created successfully\", \"success\": true}','2026-10-02 22:07:27','2026-10-03 22:07:27'),(10,'e9f52f920bbae3d76250de5137b4622cfd35673c4d36c268ae571c804d691231','50965f3ec4a6e822179f5d0313006340e3190f7203e77de365fff91ab21008fc',201,'{\"data\": {\"accountNo\": \"ACC-000002\", \"customerId\": \"a496c3d3-be6a-11f1-8891-088fc3017818\"}, \"message\": \"Customer created successfully\", \"success\": true}','2026-10-02 22:07:46','2026-10-03 22:07:46'),(11,'1ea82c8acd2e9740dc896da56919b8a14126e1d3a0c5c5f0d4ebeea0f86bf642','27cf034b68b2998f2313e4a2dcfd38cc7a58e77ea997e0608277a2880a74f2fc',201,'{\"data\": {\"subscriptionId\": \"abf90f82-be6a-11f1-8891-088fc3017818\"}, \"message\": \"Subscription created successfully\", \"success\": true}','2026-10-02 22:07:58','2026-10-03 22:07:58'),(12,'0edfab4aa619ba387da4bc7221fb22f0a868b32b98e8f876646e978b86f956f5','ffc4380dcb544047133715f96f2e346ea9e8f9ca26848e9f6fe82ade27ed41db',201,'{\"data\": {\"subscriptionId\": \"b225a0aa-be6a-11f1-8891-088fc3017818\"}, \"message\": \"Subscription created successfully\", \"success\": true}','2026-10-02 22:08:08','2026-10-03 22:08:08'),(13,'a94fc04cddc8ca5de5cd4c4ba7c18e71412f65f40b7387a7d7c018e956acebcf','abd8d356759e206147646f38aad6d519202b02d05256097ff6396ab8468906d0',200,'{\"data\": {\"status\": \"active\"}, \"message\": \"Subscription activated\", \"success\": true}','2026-10-02 22:08:16','2026-10-03 22:08:16'),(14,'fb4e6343f74f17d61d0fae0f37b2908a9f04ab3873992f54a90cacb81db6f83c','abd8d356759e206147646f38aad6d519202b02d05256097ff6396ab8468906d0',200,'{\"data\": {\"status\": \"active\"}, \"message\": \"Subscription activated\", \"success\": true}','2026-10-02 22:08:21','2026-10-03 22:08:21'),(15,'fdb7d786c3fd17d20abcaf6fec88f9dec7424db0977f3cb2de21320256c449f1','44136fa355b3678a1146ad16f7e8649e94fb4fc21fe77e8310c060f61caaff8a',200,'{\"data\": {\"result\": {\"failed\": 0, \"period\": {\"year\": 2026, \"dueDate\": \"2026-11-02\", \"periodEnd\": \"2026-10-31\", \"daysInMonth\": 31, \"periodStart\": \"2026-10-01\", \"statementDate\": \"2026-10-25\"}, \"created\": 2, \"results\": [{\"total\": \"1451.61\", \"status\": \"created\", \"invoiceId\": \"00377167-be6b-11f1-8891-088fc3017818\", \"invoiceNo\": \"INV-2026-000001\", \"subscriptionId\": \"abf90f82-be6a-11f1-8891-088fc3017818\"}, {\"total\": \"1451.61\", \"status\": \"created\", \"invoiceId\": \"003a523a-be6b-11f1-8891-088fc3017818\", \"invoiceNo\": \"INV-2026-000002\", \"subscriptionId\": \"b225a0aa-be6a-11f1-8891-088fc3017818\"}], \"skipped\": 0}}, \"message\": \"Billing cycle completed\", \"success\": true}','2026-10-02 22:10:19','2026-10-03 22:10:19'),(16,'5875b292b163d47614d83092f8fe12f4090d1c83ecc002b3e277d5640269f624','44136fa355b3678a1146ad16f7e8649e94fb4fc21fe77e8310c060f61caaff8a',200,'{\"data\": {\"result\": {\"finals\": {\"found\": 0, \"queued\": 0, \"target\": \"2026-10-02\"}, \"overdue\": {\"found\": 0, \"today\": \"2026-10-02\", \"updated\": 0}, \"reminders\": {\"found\": 0, \"queued\": 0, \"target\": \"2026-10-04\"}}}, \"message\": \"Daily billing run completed\", \"success\": true}','2026-10-02 22:10:27','2026-10-03 22:10:27'),(17,'2636c925841a617f4f20051dbfbfaf70693497c38fbda43704c9b106817f84a1','9c0eea8f8b51b05d0ca6c11e017d3783e6843698e5efe954f524bfc1b063b865',201,'{\"data\": {\"paymentId\": \"c761bb48-be6b-11f1-8891-088fc3017818\", \"reconnectQueued\": false}, \"message\": \"Payment recorded\", \"success\": true}','2026-10-02 22:15:54','2026-10-03 22:15:54'),(18,'5e94fb16fbfbf35a67c70c60c5d9406b605ceb60c40f0815d70cfab3b087a6d0','093dae6c145144f1dadf289cbd3a7a80514a2d9243fe5a36ed9d8a728649df02',201,'{\"data\": {\"paymentId\": \"3c8d8030-be6c-11f1-8891-088fc3017818\", \"reconnectQueued\": false}, \"message\": \"Payment recorded\", \"success\": true}','2026-10-02 22:19:10','2026-10-03 22:19:10'),(19,'c6b98e3284b3c2cb5f1d077d0f39c143b0d1a45e3193ac1948d7fb2ec13abf8f','7046f8d043f113f8d82b2f42366d636c2dbed81e38138d816cc1618b1d53c29b',200,'{\"data\": {\"user\": {\"type\": \"ADMIN\", \"email\": \"ahchilee40@gmail.com\", \"roleId\": \"555a4ef8-be63-11f1-8891-088fc3017818\", \"status\": \"Active\", \"branchId\": \"5559990d-be63-11f1-8891-088fc3017818\", \"lastName\": \"Owner\", \"roleName\": \"Owner\", \"accountId\": \"324de890-be68-11f1-8891-088fc3017818\", \"companyId\": \"5558814a-be63-11f1-8891-088fc3017818\", \"firstName\": \"Test\"}, \"token\": \"eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIzMjRkZTg5MC1iZTY4LTExZjEtODg5MS0wODhmYzMwMTc4MTgiLCJhY2NvdW50SWQiOiIzMjRkZTg5MC1iZTY4LTExZjEtODg5MS0wODhmYzMwMTc4MTgiLCJlbWFpbCI6ImFoY2hpbGVlNDBAZ21haWwuY29tIiwidHlwZSI6ImFjY2VzcyIsImp0aSI6IjM1NTc3NzNlZWFiNDBkNTQwZTE0NWJjYmJiODU0Mjc2MjU1OGU3MjQ4MmZjZGU5MDUwN2IwYWE4OGFiNTVkZjAiLCJpYXQiOjE3OTA5NTIxMzgsImV4cCI6MTc5MDk4MDkzOCwiYXVkIjoieW91ci1hcHAtdXNlcnMiLCJpc3MiOiJ5b3VyLWFwcC1uYW1lIn0.G3mvDrHmbkIOPEYl6DuNz1P1o5ddrFcYmg2chtx61F955NvkxRT10ibfngToCEMi2Gwy3PUr-T7Ty965VdyY4eM_j9VauC7dkS8x_qFGZk5fccaSTtwuvGxEIwR7hblFV2nlvsTVNy-kesCrBYqGqDaXO3qLdYVMnGWuEKQnmwJfuW-3Iau_yi4EjcirQlS0l3klu38Kh1PABVRot4yngZ9LSey4qatVNQnfTcdGaIvvJ9vSQlhXqUSmC7wN9IRaIoKWoGyMPD7FMGIDsmhbzKWG0qzjqN2RbmTTCwJ6B4iZVjTXpoCCO0TeXfpOVg4MnpbiRTHGcPNG2u29v-oulw\", \"accessToken\": {\"token\": \"eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIzMjRkZTg5MC1iZTY4LTExZjEtODg5MS0wODhmYzMwMTc4MTgiLCJhY2NvdW50SWQiOiIzMjRkZTg5MC1iZTY4LTExZjEtODg5MS0wODhmYzMwMTc4MTgiLCJlbWFpbCI6ImFoY2hpbGVlNDBAZ21haWwuY29tIiwidHlwZSI6ImFjY2VzcyIsImp0aSI6IjM1NTc3NzNlZWFiNDBkNTQwZTE0NWJjYmJiODU0Mjc2MjU1OGU3MjQ4MmZjZGU5MDUwN2IwYWE4OGFiNTVkZjAiLCJpYXQiOjE3OTA5NTIxMzgsImV4cCI6MTc5MDk4MDkzOCwiYXVkIjoieW91ci1hcHAtdXNlcnMiLCJpc3MiOiJ5b3VyLWFwcC1uYW1lIn0.G3mvDrHmbkIOPEYl6DuNz1P1o5ddrFcYmg2chtx61F955NvkxRT10ibfngToCEMi2Gwy3PUr-T7Ty965VdyY4eM_j9VauC7dkS8x_qFGZk5fccaSTtwuvGxEIwR7hblFV2nlvsTVNy-kesCrBYqGqDaXO3qLdYVMnGWuEKQnmwJfuW-3Iau_yi4EjcirQlS0l3klu38Kh1PABVRot4yngZ9LSey4qatVNQnfTcdGaIvvJ9vSQlhXqUSmC7wN9IRaIoKWoGyMPD7FMGIDsmhbzKWG0qzjqN2RbmTTCwJ6B4iZVjTXpoCCO0TeXfpOVg4MnpbiRTHGcPNG2u29v-oulw\", \"expiresAt\": \"2026-10-02T22:42:18.000Z\", \"expiresIn\": \"8h\"}, \"refreshToken\": {\"token\": \"eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIzMjRkZTg5MC1iZTY4LTExZjEtODg5MS0wODhmYzMwMTc4MTgiLCJhY2NvdW50SWQiOiIzMjRkZTg5MC1iZTY4LTExZjEtODg5MS0wODhmYzMwMTc4MTgiLCJ0eXBlIjoicmVmcmVzaCIsImp0aSI6IjgyNjQ5N2VmODQ2YmI4ODZlM2JmZmJkYTljY2FhYTg0ZjdlNTJmOTI1YjgxYzVhM2YwNGEzZDA0M2YyOTFkYjMiLCJpYXQiOjE3OTA5NTIxMzgsImV4cCI6MTc5MzU0NDEzOCwiYXVkIjoieW91ci1hcHAtdXNlcnMiLCJpc3MiOiJ5b3VyLWFwcC1uYW1lIn0.sNNZc1EkZTKra8S6byAk-QI7HF_R_1xmAYs4auEbvR58tzDDwXyduNRdPx9sneCZa-M6-it5lPTY2xBQAj6tdl4NJGz2-IfS8D56UAO5N1uPRBSubnbVwO9mFz-7DOVizOMMPXbKZyY7e6WET8ybCzADvdk0fp7ycQTU4DpHzzS4scTjRlq--3uKDIMhszY1G_Hs4KK2ac7VsDL0KC6-BoqvyWnCaRZnAF72Nj1ACwzm7ePcuzpNkmrHl9LBuISnE_9cOxbsu9DsPA5H1whVnnzZAUUON7oNfu--3nUwOy-qpDvy61rQ21kze9P_jQvAjJ8rhVpVFe4suARqT_k4gQ\", \"expiresAt\": \"2026-11-01T14:42:18.000Z\", \"expiresIn\": \"30d\"}}, \"message\": \"Login successful\", \"success\": true}','2026-10-02 22:42:18','2026-10-03 22:42:18');
/*!40000 ALTER TABLE `idempotency_keys` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `invoice_lines`
--

DROP TABLE IF EXISTS `invoice_lines`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `invoice_lines` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `invoiceLineId` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `invoiceId` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `kind` enum('plan','proration','install_fee','reconnection_fee','credit','debit','discount') COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `qty` decimal(8,2) NOT NULL DEFAULT '1.00',
  `unitPrice` decimal(12,2) NOT NULL,
  `amount` decimal(12,2) NOT NULL,
  `sortOrder` int NOT NULL DEFAULT '0',
  `dateCreated` datetime NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `invoiceLineId` (`invoiceLineId`),
  KEY `idx_invoice_lines_invoice` (`invoiceId`,`sortOrder`),
  CONSTRAINT `fk_invoice_lines_invoice` FOREIGN KEY (`invoiceId`) REFERENCES `invoices` (`invoiceId`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `invoice_lines`
--

LOCK TABLES `invoice_lines` WRITE;
/*!40000 ALTER TABLE `invoice_lines` DISABLE KEYS */;
INSERT INTO `invoice_lines` VALUES (1,'0038084f-be6b-11f1-8891-088fc3017818','00377167-be6b-11f1-8891-088fc3017818','proration','FIBER 50MPBS — 30/31 days',30.00,48.39,1451.61,0,'2026-10-02 22:10:19'),(2,'003a9c58-be6b-11f1-8891-088fc3017818','003a523a-be6b-11f1-8891-088fc3017818','proration','FIBER 50MPBS — 30/31 days',30.00,48.39,1451.61,0,'2026-10-02 22:10:19');
/*!40000 ALTER TABLE `invoice_lines` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `invoices`
--

DROP TABLE IF EXISTS `invoices`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `invoices` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `invoiceId` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `companyId` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `branchId` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `subscriptionId` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `customerId` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `invoiceNo` varchar(24) COLLATE utf8mb4_unicode_ci NOT NULL,
  `billingPeriodStart` date NOT NULL,
  `billingPeriodEnd` date NOT NULL,
  `statementDate` date NOT NULL,
  `dueDate` date NOT NULL,
  `subtotal` decimal(12,2) NOT NULL,
  `fees` decimal(12,2) NOT NULL DEFAULT '0.00',
  `tax` decimal(12,2) NOT NULL DEFAULT '0.00',
  `total` decimal(12,2) NOT NULL,
  `amountPaid` decimal(12,2) NOT NULL DEFAULT '0.00',
  `status` enum('draft','issued','paid','overdue','void') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'draft',
  `publicToken` char(32) COLLATE utf8mb4_unicode_ci NOT NULL,
  `pdfPath` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `issuedAt` datetime DEFAULT NULL,
  `paidAt` datetime DEFAULT NULL,
  `voidReason` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `dateCreated` datetime NOT NULL,
  `dateUpdated` datetime NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `invoiceId` (`invoiceId`),
  UNIQUE KEY `invoiceNo` (`invoiceNo`),
  UNIQUE KEY `publicToken` (`publicToken`),
  UNIQUE KEY `uq_invoices_period` (`subscriptionId`,`billingPeriodStart`),
  KEY `idx_invoices_customer` (`customerId`),
  KEY `idx_invoices_due` (`status`,`dueDate`),
  KEY `idx_invoices_tenant` (`companyId`,`branchId`,`status`),
  KEY `fk_invoices_branch` (`branchId`),
  CONSTRAINT `fk_invoices_branch` FOREIGN KEY (`branchId`) REFERENCES `branches` (`branchId`),
  CONSTRAINT `fk_invoices_company` FOREIGN KEY (`companyId`) REFERENCES `companies` (`companyId`),
  CONSTRAINT `fk_invoices_customer` FOREIGN KEY (`customerId`) REFERENCES `customers` (`customerId`),
  CONSTRAINT `fk_invoices_subscription` FOREIGN KEY (`subscriptionId`) REFERENCES `subscriptions` (`subscriptionId`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `invoices`
--

LOCK TABLES `invoices` WRITE;
/*!40000 ALTER TABLE `invoices` DISABLE KEYS */;
INSERT INTO `invoices` VALUES (1,'00377167-be6b-11f1-8891-088fc3017818','5558814a-be63-11f1-8891-088fc3017818','5559990d-be63-11f1-8891-088fc3017818','abf90f82-be6a-11f1-8891-088fc3017818','a496c3d3-be6a-11f1-8891-088fc3017818','INV-2026-000001','2026-10-01','2026-10-31','2026-10-25','2026-11-02',1451.61,0.00,0.00,1451.61,1451.61,'paid','88341b8be89b95d708799b6c459cc217','invoices/5558814a-be63-11f1-8891-088fc3017818/2026/INV-2026-000001.pdf','2026-10-02 22:10:19','2026-10-02 22:15:54',NULL,'2026-10-02 22:10:19','2026-10-02 22:15:54'),(2,'003a523a-be6b-11f1-8891-088fc3017818','5558814a-be63-11f1-8891-088fc3017818','5559990d-be63-11f1-8891-088fc3017818','b225a0aa-be6a-11f1-8891-088fc3017818','998e8bb5-be6a-11f1-8891-088fc3017818','INV-2026-000002','2026-10-01','2026-10-31','2026-10-25','2026-11-02',1451.61,0.00,0.00,1451.61,1451.61,'paid','141a2d6b1cb30dba714cdca1bf486095','invoices/5558814a-be63-11f1-8891-088fc3017818/2026/INV-2026-000002.pdf','2026-10-02 22:10:19','2026-10-02 22:19:10',NULL,'2026-10-02 22:10:19','2026-10-02 22:19:10');
/*!40000 ALTER TABLE `invoices` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `jobs`
--

DROP TABLE IF EXISTS `jobs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `jobs` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `jobId` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `companyId` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `branchId` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `type` enum('deactivate','activate','status','email') COLLATE utf8mb4_unicode_ci NOT NULL,
  `payload` json NOT NULL,
  `status` enum('queued','processing','succeeded','failed','dead','cancelled') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'queued',
  `attempts` int unsigned NOT NULL DEFAULT '0',
  `maxAttempts` int unsigned NOT NULL DEFAULT '5',
  `nextRunAt` datetime NOT NULL,
  `dedupeKey` varchar(120) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `lockedAt` datetime DEFAULT NULL,
  `lockedBy` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `lastError` text COLLATE utf8mb4_unicode_ci,
  `startedAt` datetime DEFAULT NULL,
  `finishedAt` datetime DEFAULT NULL,
  `dateCreated` datetime NOT NULL,
  `dateUpdated` datetime NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `jobId` (`jobId`),
  KEY `idx_jobs_claim` (`status`,`nextRunAt`,`id`),
  KEY `idx_jobs_dedupe` (`dedupeKey`,`status`),
  KEY `idx_jobs_tenant` (`companyId`,`status`),
  CONSTRAINT `fk_jobs_company` FOREIGN KEY (`companyId`) REFERENCES `companies` (`companyId`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `jobs`
--

LOCK TABLES `jobs` WRITE;
/*!40000 ALTER TABLE `jobs` DISABLE KEYS */;
INSERT INTO `jobs` VALUES (1,'0038f31c-be6b-11f1-8891-088fc3017818','5558814a-be63-11f1-8891-088fc3017818','5559990d-be63-11f1-8891-088fc3017818','email','{\"kind\": \"invoice_issued\", \"result\": {\"to\": \"johnravenbayatan@gmail.com\", \"sent\": true, \"subject\": \"Invoice INV-2026-000001 — PHP 1,451.61 due 2026-11-02\"}, \"invoiceId\": \"00377167-be6b-11f1-8891-088fc3017818\", \"customerId\": \"a496c3d3-be6a-11f1-8891-088fc3017818\"}','succeeded',1,5,'2026-10-02 22:10:19','email:invoice_issued:00377167-be6b-11f1-8891-088fc3017818',NULL,NULL,NULL,'2026-10-02 22:10:21','2026-10-02 22:10:27','2026-10-02 22:10:19','2026-10-02 22:10:27'),(2,'003b1c99-be6b-11f1-8891-088fc3017818','5558814a-be63-11f1-8891-088fc3017818','5559990d-be63-11f1-8891-088fc3017818','email','{\"kind\": \"invoice_issued\", \"result\": {\"to\": \"ravenbayatan11@gmail.com\", \"sent\": true, \"subject\": \"Invoice INV-2026-000002 — PHP 1,451.61 due 2026-11-02\"}, \"invoiceId\": \"003a523a-be6b-11f1-8891-088fc3017818\", \"customerId\": \"998e8bb5-be6a-11f1-8891-088fc3017818\"}','succeeded',1,5,'2026-10-02 22:10:19','email:invoice_issued:003a523a-be6b-11f1-8891-088fc3017818',NULL,NULL,NULL,'2026-10-02 22:10:27','2026-10-02 22:10:31','2026-10-02 22:10:19','2026-10-02 22:10:31'),(3,'c76466c8-be6b-11f1-8891-088fc3017818','5558814a-be63-11f1-8891-088fc3017818','5559990d-be63-11f1-8891-088fc3017818','email','{\"kind\": \"payment_received\", \"result\": {\"to\": \"johnravenbayatan@gmail.com\", \"sent\": true, \"subject\": \"Payment received — invoice INV-2026-000001\"}, \"payment\": {\"amount\": 1451.61, \"paidAt\": \"2026-10-02 22:15:54\", \"channel\": \"GCASH\"}, \"invoiceId\": \"00377167-be6b-11f1-8891-088fc3017818\", \"customerId\": \"a496c3d3-be6a-11f1-8891-088fc3017818\", \"reconnecting\": false}','succeeded',1,5,'2026-10-02 22:15:54','email:payment_received:c761bb48-be6b-11f1-8891-088fc3017818',NULL,NULL,NULL,'2026-10-02 22:15:56','2026-10-02 22:15:59','2026-10-02 22:15:54','2026-10-02 22:15:59'),(4,'3c900664-be6c-11f1-8891-088fc3017818','5558814a-be63-11f1-8891-088fc3017818','5559990d-be63-11f1-8891-088fc3017818','email','{\"kind\": \"payment_received\", \"result\": {\"to\": \"ravenbayatan11@gmail.com\", \"sent\": true, \"subject\": \"Payment received — invoice INV-2026-000002\"}, \"payment\": {\"amount\": 1451.61, \"paidAt\": \"2026-10-02 22:19:10\", \"channel\": \"GCASH\"}, \"invoiceId\": \"003a523a-be6b-11f1-8891-088fc3017818\", \"customerId\": \"998e8bb5-be6a-11f1-8891-088fc3017818\", \"reconnecting\": false}','succeeded',1,5,'2026-10-02 22:19:10','email:payment_received:3c8d8030-be6c-11f1-8891-088fc3017818',NULL,NULL,NULL,'2026-10-02 22:19:12','2026-10-02 22:19:16','2026-10-02 22:19:10','2026-10-02 22:19:16');
/*!40000 ALTER TABLE `jobs` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `naps`
--

DROP TABLE IF EXISTS `naps`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `naps` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `napId` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `companyId` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `branchId` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `splitterId` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `label` varchar(120) COLLATE utf8mb4_unicode_ci NOT NULL,
  `totalPorts` tinyint unsigned NOT NULL DEFAULT '8',
  `gpsLat` decimal(10,7) NOT NULL,
  `gpsLng` decimal(10,7) NOT NULL,
  `address` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `notes` text COLLATE utf8mb4_unicode_ci,
  `status` enum('Active','Inactive','Deleted') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'Active',
  `dateCreated` datetime NOT NULL,
  `dateUpdated` datetime NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `napId` (`napId`),
  KEY `idx_naps_splitterId` (`splitterId`),
  KEY `idx_naps_tenant` (`companyId`,`branchId`,`status`),
  KEY `fk_naps_branch` (`branchId`),
  CONSTRAINT `fk_naps_branch` FOREIGN KEY (`branchId`) REFERENCES `branches` (`branchId`),
  CONSTRAINT `fk_naps_company` FOREIGN KEY (`companyId`) REFERENCES `companies` (`companyId`),
  CONSTRAINT `fk_naps_splitter` FOREIGN KEY (`splitterId`) REFERENCES `splitters` (`splitterId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `naps`
--

LOCK TABLES `naps` WRITE;
/*!40000 ALTER TABLE `naps` DISABLE KEYS */;
/*!40000 ALTER TABLE `naps` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `network_action_logs`
--

DROP TABLE IF EXISTS `network_action_logs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `network_action_logs` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `actionLogId` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `companyId` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `branchId` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `onuId` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `oltId` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `action` enum('activate','deactivate','status','dry_run') COLLATE utf8mb4_unicode_ci NOT NULL,
  `triggeredBy` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `jobId` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `command` text COLLATE utf8mb4_unicode_ci,
  `deviceResponse` mediumtext COLLATE utf8mb4_unicode_ci,
  `success` tinyint(1) NOT NULL,
  `error` text COLLATE utf8mb4_unicode_ci,
  `durationMs` int unsigned DEFAULT NULL,
  `dateCreated` datetime NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `actionLogId` (`actionLogId`),
  KEY `idx_nal_onu` (`onuId`,`dateCreated`),
  KEY `idx_nal_tenant` (`companyId`,`branchId`,`dateCreated`),
  KEY `idx_nal_job` (`jobId`),
  KEY `fk_nal_branch` (`branchId`),
  CONSTRAINT `fk_nal_branch` FOREIGN KEY (`branchId`) REFERENCES `branches` (`branchId`),
  CONSTRAINT `fk_nal_company` FOREIGN KEY (`companyId`) REFERENCES `companies` (`companyId`),
  CONSTRAINT `fk_nal_onu` FOREIGN KEY (`onuId`) REFERENCES `onus` (`onuId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `network_action_logs`
--

LOCK TABLES `network_action_logs` WRITE;
/*!40000 ALTER TABLE `network_action_logs` DISABLE KEYS */;
/*!40000 ALTER TABLE `network_action_logs` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `olts`
--

DROP TABLE IF EXISTS `olts`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `olts` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `oltId` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `companyId` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `branchId` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `vendor` enum('hsgq','huawei','zte','fiberhome','vsol','bdcom','mock','other') COLLATE utf8mb4_unicode_ci NOT NULL,
  `ponTechnology` enum('epon','gpon') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'epon',
  `model` varchar(80) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `host` varchar(190) COLLATE utf8mb4_unicode_ci NOT NULL,
  `port` smallint unsigned NOT NULL DEFAULT '23',
  `protocol` enum('ssh','telnet','snmp','tr069') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'telnet',
  `credentialsEnc` varbinary(2048) DEFAULT NULL,
  `site` varchar(120) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `maxConcurrentSessions` tinyint unsigned NOT NULL DEFAULT '1',
  `notes` text COLLATE utf8mb4_unicode_ci,
  `status` enum('Active','Maintenance','Retired','Deleted') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'Active',
  `dateCreated` datetime NOT NULL,
  `dateUpdated` datetime NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `oltId` (`oltId`),
  UNIQUE KEY `uq_olts_name` (`companyId`,`name`),
  KEY `idx_olts_companyId` (`companyId`),
  KEY `idx_olts_branchId` (`branchId`),
  KEY `idx_olts_tenant` (`companyId`,`branchId`,`status`),
  CONSTRAINT `fk_olts_branch` FOREIGN KEY (`branchId`) REFERENCES `branches` (`branchId`),
  CONSTRAINT `fk_olts_company` FOREIGN KEY (`companyId`) REFERENCES `companies` (`companyId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `olts`
--

LOCK TABLES `olts` WRITE;
/*!40000 ALTER TABLE `olts` DISABLE KEYS */;
/*!40000 ALTER TABLE `olts` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `onus`
--

DROP TABLE IF EXISTS `onus`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `onus` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `onuId` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `companyId` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `branchId` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `serialNo` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `mac` varchar(17) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `model` varchar(80) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `napId` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `napPort` tinyint unsigned DEFAULT NULL,
  `oltId` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `ponPortId` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `onuIndex` varchar(32) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `provisioningState` enum('unprovisioned','active','suspended','offline') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'unprovisioned',
  `lastRxDbm` decimal(6,2) DEFAULT NULL,
  `lastTxDbm` decimal(6,2) DEFAULT NULL,
  `lastSeenAt` datetime DEFAULT NULL,
  `description` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `notes` text COLLATE utf8mb4_unicode_ci,
  `recordStatus` enum('Active','Inactive','Deleted') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'Active',
  `liveSerialNo` varchar(64) COLLATE utf8mb4_unicode_ci GENERATED ALWAYS AS (if((`recordStatus` = _utf8mb4'Deleted'),NULL,`serialNo`)) STORED,
  `liveMac` varchar(17) COLLATE utf8mb4_unicode_ci GENERATED ALWAYS AS (if((`recordStatus` = _utf8mb4'Deleted'),NULL,`mac`)) STORED,
  `liveNapId` varchar(50) COLLATE utf8mb4_unicode_ci GENERATED ALWAYS AS (if((`recordStatus` = _utf8mb4'Deleted'),NULL,`napId`)) STORED,
  `dateCreated` datetime NOT NULL,
  `dateUpdated` datetime NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `onuId` (`onuId`),
  UNIQUE KEY `uq_onus_serial` (`companyId`,`liveSerialNo`),
  UNIQUE KEY `uq_onus_mac` (`companyId`,`liveMac`),
  UNIQUE KEY `uq_onus_nap_port` (`liveNapId`,`napPort`),
  KEY `idx_onus_oltId` (`oltId`),
  KEY `idx_onus_napId` (`napId`),
  KEY `idx_onus_state` (`provisioningState`),
  KEY `idx_onus_tenant` (`companyId`,`branchId`,`recordStatus`),
  KEY `fk_onus_branch` (`branchId`),
  KEY `fk_onus_pon_port` (`ponPortId`),
  CONSTRAINT `fk_onus_branch` FOREIGN KEY (`branchId`) REFERENCES `branches` (`branchId`),
  CONSTRAINT `fk_onus_company` FOREIGN KEY (`companyId`) REFERENCES `companies` (`companyId`),
  CONSTRAINT `fk_onus_nap` FOREIGN KEY (`napId`) REFERENCES `naps` (`napId`),
  CONSTRAINT `fk_onus_olt` FOREIGN KEY (`oltId`) REFERENCES `olts` (`oltId`),
  CONSTRAINT `fk_onus_pon_port` FOREIGN KEY (`ponPortId`) REFERENCES `pon_ports` (`ponPortId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `onus`
--

LOCK TABLES `onus` WRITE;
/*!40000 ALTER TABLE `onus` DISABLE KEYS */;
/*!40000 ALTER TABLE `onus` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `password_reset_tokens`
--

DROP TABLE IF EXISTS `password_reset_tokens`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `password_reset_tokens` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `tokenHash` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `accountId` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `expiresAt` datetime NOT NULL,
  `usedAt` datetime DEFAULT NULL,
  `dateCreated` datetime NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `tokenHash` (`tokenHash`),
  KEY `idx_password_reset_tokens_accountId` (`accountId`),
  KEY `idx_password_reset_tokens_expiresAt` (`expiresAt`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `password_reset_tokens`
--

LOCK TABLES `password_reset_tokens` WRITE;
/*!40000 ALTER TABLE `password_reset_tokens` DISABLE KEYS */;
/*!40000 ALTER TABLE `password_reset_tokens` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `payment_attempts`
--

DROP TABLE IF EXISTS `payment_attempts`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `payment_attempts` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `paymentAttemptId` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `companyId` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `branchId` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `invoiceId` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `provider` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL,
  `reference` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `providerRef` varchar(128) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `amount` decimal(12,2) NOT NULL,
  `paymentUrl` varchar(512) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status` enum('pending','paid','failed','expired','cancelled') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pending',
  `expiresAt` datetime DEFAULT NULL,
  `failureReason` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `rawResponse` json DEFAULT NULL,
  `dateCreated` datetime NOT NULL,
  `dateUpdated` datetime NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `paymentAttemptId` (`paymentAttemptId`),
  UNIQUE KEY `uq_payment_attempts_ref` (`provider`,`providerRef`),
  KEY `idx_payment_attempts_invoice` (`invoiceId`,`status`),
  KEY `idx_payment_attempts_tenant` (`companyId`,`branchId`,`dateCreated`),
  KEY `fk_payment_attempts_branch` (`branchId`),
  CONSTRAINT `fk_payment_attempts_branch` FOREIGN KEY (`branchId`) REFERENCES `branches` (`branchId`),
  CONSTRAINT `fk_payment_attempts_company` FOREIGN KEY (`companyId`) REFERENCES `companies` (`companyId`),
  CONSTRAINT `fk_payment_attempts_invoice` FOREIGN KEY (`invoiceId`) REFERENCES `invoices` (`invoiceId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `payment_attempts`
--

LOCK TABLES `payment_attempts` WRITE;
/*!40000 ALTER TABLE `payment_attempts` DISABLE KEYS */;
/*!40000 ALTER TABLE `payment_attempts` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `payments`
--

DROP TABLE IF EXISTS `payments`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `payments` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `paymentId` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `companyId` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `branchId` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `invoiceId` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `customerId` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `amount` decimal(12,2) NOT NULL,
  `channel` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL,
  `provider` varchar(32) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `providerPaymentId` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `recordedBy` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `paidAt` datetime NOT NULL,
  `rawPayload` json DEFAULT NULL,
  `notes` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `dateCreated` datetime NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `paymentId` (`paymentId`),
  UNIQUE KEY `providerPaymentId` (`providerPaymentId`),
  KEY `idx_payments_invoice` (`invoiceId`),
  KEY `idx_payments_tenant` (`companyId`,`branchId`,`paidAt`),
  KEY `fk_payments_branch` (`branchId`),
  KEY `fk_payments_customer` (`customerId`),
  CONSTRAINT `fk_payments_branch` FOREIGN KEY (`branchId`) REFERENCES `branches` (`branchId`),
  CONSTRAINT `fk_payments_company` FOREIGN KEY (`companyId`) REFERENCES `companies` (`companyId`),
  CONSTRAINT `fk_payments_customer` FOREIGN KEY (`customerId`) REFERENCES `customers` (`customerId`),
  CONSTRAINT `fk_payments_invoice` FOREIGN KEY (`invoiceId`) REFERENCES `invoices` (`invoiceId`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `payments`
--

LOCK TABLES `payments` WRITE;
/*!40000 ALTER TABLE `payments` DISABLE KEYS */;
INSERT INTO `payments` VALUES (1,'c761bb48-be6b-11f1-8891-088fc3017818','5558814a-be63-11f1-8891-088fc3017818','5559990d-be63-11f1-8891-088fc3017818','00377167-be6b-11f1-8891-088fc3017818','a496c3d3-be6a-11f1-8891-088fc3017818',1451.61,'GCASH',NULL,'3045631466653','324de890-be68-11f1-8891-088fc3017818','2026-10-02 22:15:54',NULL,NULL,'2026-10-02 22:15:54'),(2,'3c8d8030-be6c-11f1-8891-088fc3017818','5558814a-be63-11f1-8891-088fc3017818','5559990d-be63-11f1-8891-088fc3017818','003a523a-be6b-11f1-8891-088fc3017818','998e8bb5-be6a-11f1-8891-088fc3017818',1451.61,'GCASH',NULL,'1234567890123','324de890-be68-11f1-8891-088fc3017818','2026-10-02 22:19:10',NULL,NULL,'2026-10-02 22:19:10');
/*!40000 ALTER TABLE `payments` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `pending_charges`
--

DROP TABLE IF EXISTS `pending_charges`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `pending_charges` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `pendingChargeId` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `companyId` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `branchId` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `customerId` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `subscriptionId` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `kind` enum('reconnection_fee','install_fee','credit','debit','discount') COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `amount` decimal(12,2) NOT NULL,
  `appliedInvoiceId` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `appliedAt` datetime DEFAULT NULL,
  `createdBy` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status` enum('Active','Deleted') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'Active',
  `dateCreated` datetime NOT NULL,
  `dateUpdated` datetime NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `pendingChargeId` (`pendingChargeId`),
  KEY `idx_pending_charges_open` (`subscriptionId`,`appliedInvoiceId`,`status`),
  KEY `idx_pending_charges_tenant` (`companyId`,`branchId`),
  KEY `fk_pending_charges_branch` (`branchId`),
  KEY `fk_pending_charges_customer` (`customerId`),
  CONSTRAINT `fk_pending_charges_branch` FOREIGN KEY (`branchId`) REFERENCES `branches` (`branchId`),
  CONSTRAINT `fk_pending_charges_company` FOREIGN KEY (`companyId`) REFERENCES `companies` (`companyId`),
  CONSTRAINT `fk_pending_charges_customer` FOREIGN KEY (`customerId`) REFERENCES `customers` (`customerId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `pending_charges`
--

LOCK TABLES `pending_charges` WRITE;
/*!40000 ALTER TABLE `pending_charges` DISABLE KEYS */;
/*!40000 ALTER TABLE `pending_charges` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `permissions`
--

DROP TABLE IF EXISTS `permissions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `permissions` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `permissionId` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `module` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `submodule` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `description` text COLLATE utf8mb4_unicode_ci,
  `portal` enum('ADMIN') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'ADMIN',
  `status` enum('Active','Inactive') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'Active',
  `dateCreated` datetime NOT NULL,
  `dateUpdated` datetime NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `permissionId` (`permissionId`)
) ENGINE=InnoDB AUTO_INCREMENT=24 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `permissions`
--

LOCK TABLES `permissions` WRITE;
/*!40000 ALTER TABLE `permissions` DISABLE KEYS */;
INSERT INTO `permissions` VALUES (1,'3842dc17-be63-11f1-8891-088fc3017818','dashboard',NULL,'Dashboard access','ADMIN','Active','2026-10-02 21:14:38','2026-10-02 21:14:38'),(2,'38434d85-be63-11f1-8891-088fc3017818','users','list','Users list management','ADMIN','Active','2026-10-02 21:14:38','2026-10-02 21:14:38'),(3,'3843e501-be63-11f1-8891-088fc3017818','users','roles','Roles management','ADMIN','Active','2026-10-02 21:14:38','2026-10-02 21:14:38'),(4,'3844444b-be63-11f1-8891-088fc3017818','settings',NULL,'Settings management','ADMIN','Active','2026-10-02 21:14:38','2026-10-02 21:14:38'),(5,'3844c905-be63-11f1-8891-088fc3017818','audit_trail',NULL,'Audit Trail access','ADMIN','Active','2026-10-02 21:14:38','2026-10-02 21:14:38'),(6,'38452107-be63-11f1-8891-088fc3017818','plans',NULL,'Service plans management','ADMIN','Active','2026-10-02 21:14:38','2026-10-02 21:14:38'),(7,'38455c85-be63-11f1-8891-088fc3017818','customers',NULL,'Subscribers management','ADMIN','Active','2026-10-02 21:14:38','2026-10-02 21:14:38'),(8,'3845aa8b-be63-11f1-8891-088fc3017818','network','olts','OLT devices','ADMIN','Active','2026-10-02 21:14:38','2026-10-02 21:14:38'),(9,'384614eb-be63-11f1-8891-088fc3017818','network','pon_ports','PON ports','ADMIN','Active','2026-10-02 21:14:38','2026-10-02 21:14:38'),(10,'384653a8-be63-11f1-8891-088fc3017818','network','splitters','Optical splitters','ADMIN','Active','2026-10-02 21:14:38','2026-10-02 21:14:38'),(11,'38468cff-be63-11f1-8891-088fc3017818','network','naps','Network access points','ADMIN','Active','2026-10-02 21:14:38','2026-10-02 21:14:38'),(12,'3846df73-be63-11f1-8891-088fc3017818','network','onus','Subscriber modems (ONUs)','ADMIN','Active','2026-10-02 21:14:38','2026-10-02 21:14:38'),(13,'3847367a-be63-11f1-8891-088fc3017818','network','provisioning','Activate and deactivate modems at the OLT','ADMIN','Active','2026-10-02 21:14:38','2026-10-02 21:14:38'),(14,'3847729a-be63-11f1-8891-088fc3017818','network','action_logs','Device command history','ADMIN','Active','2026-10-02 21:14:38','2026-10-02 21:14:38'),(15,'3847a9b7-be63-11f1-8891-088fc3017818','network','topology','Network topology and map','ADMIN','Active','2026-10-02 21:14:38','2026-10-02 21:14:38'),(16,'3847ef3f-be63-11f1-8891-088fc3017818','network','discovery','Device discovery and import','ADMIN','Active','2026-10-02 21:14:38','2026-10-02 21:14:38'),(17,'38482acc-be63-11f1-8891-088fc3017818','subscriptions',NULL,'Subscriptions management','ADMIN','Active','2026-10-02 21:14:38','2026-10-02 21:14:38'),(18,'38487176-be63-11f1-8891-088fc3017818','system',NULL,'System settings and job queue','ADMIN','Active','2026-10-02 21:14:38','2026-10-02 21:14:38'),(19,'3848b4cf-be63-11f1-8891-088fc3017818','billing','invoices','Invoices — view, issue, void','ADMIN','Active','2026-10-02 21:14:38','2026-10-02 21:14:38'),(20,'3848fd39-be63-11f1-8891-088fc3017818','billing','payments','Payments — record and reverse','ADMIN','Active','2026-10-02 21:14:38','2026-10-02 21:14:38'),(21,'384939cf-be63-11f1-8891-088fc3017818','billing','adjustments','Credits, discounts and one-off charges','ADMIN','Active','2026-10-02 21:14:38','2026-10-02 21:14:38'),(22,'3849752a-be63-11f1-8891-088fc3017818','billing','cycle','Run the monthly billing cycle','ADMIN','Active','2026-10-02 21:14:38','2026-10-02 21:14:38'),(23,'3849b544-be63-11f1-8891-088fc3017818','billing','dunning','Disconnection sweep and exemptions','ADMIN','Active','2026-10-02 21:14:38','2026-10-02 21:14:38');
/*!40000 ALTER TABLE `permissions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `plans`
--

DROP TABLE IF EXISTS `plans`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `plans` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `planId` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `companyId` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text COLLATE utf8mb4_unicode_ci,
  `downMbps` int unsigned NOT NULL,
  `upMbps` int unsigned NOT NULL,
  `monthlyPrice` decimal(12,2) NOT NULL,
  `currency` char(3) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'PHP',
  `installFee` decimal(12,2) NOT NULL DEFAULT '0.00',
  `reconnectionFee` decimal(12,2) NOT NULL DEFAULT '0.00',
  `status` enum('Active','Inactive','Deleted') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'Active',
  `dateCreated` datetime NOT NULL,
  `dateUpdated` datetime NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `planId` (`planId`),
  KEY `idx_plans_companyId` (`companyId`),
  KEY `idx_plans_tenant` (`companyId`,`status`),
  CONSTRAINT `fk_plans_company` FOREIGN KEY (`companyId`) REFERENCES `companies` (`companyId`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `plans`
--

LOCK TABLES `plans` WRITE;
/*!40000 ALTER TABLE `plans` DISABLE KEYS */;
INSERT INTO `plans` VALUES (1,'841d1eae-be6a-11f1-8891-088fc3017818','5558814a-be63-11f1-8891-088fc3017818','FIBER 50MPBS',NULL,50,50,1500.00,'PHP',0.00,0.00,'Active','2026-10-02 22:06:51','2026-10-02 22:06:51');
/*!40000 ALTER TABLE `plans` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `pon_ports`
--

DROP TABLE IF EXISTS `pon_ports`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `pon_ports` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `ponPortId` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `companyId` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `branchId` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `oltId` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `portIndex` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL,
  `capacity` smallint unsigned NOT NULL DEFAULT '64',
  `description` varchar(190) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status` enum('Active','Down','Reserved','Deleted') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'Active',
  `dateCreated` datetime NOT NULL,
  `dateUpdated` datetime NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `ponPortId` (`ponPortId`),
  UNIQUE KEY `uq_pon_ports` (`oltId`,`portIndex`),
  KEY `idx_pon_ports_oltId` (`oltId`),
  KEY `idx_pon_ports_tenant` (`companyId`,`branchId`,`status`),
  KEY `fk_pon_ports_branch` (`branchId`),
  CONSTRAINT `fk_pon_ports_branch` FOREIGN KEY (`branchId`) REFERENCES `branches` (`branchId`),
  CONSTRAINT `fk_pon_ports_company` FOREIGN KEY (`companyId`) REFERENCES `companies` (`companyId`),
  CONSTRAINT `fk_pon_ports_olt` FOREIGN KEY (`oltId`) REFERENCES `olts` (`oltId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `pon_ports`
--

LOCK TABLES `pon_ports` WRITE;
/*!40000 ALTER TABLE `pon_ports` DISABLE KEYS */;
/*!40000 ALTER TABLE `pon_ports` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `refresh_tokens`
--

DROP TABLE IF EXISTS `refresh_tokens`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `refresh_tokens` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `jti` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `accountId` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `expiresAt` datetime NOT NULL,
  `revokedAt` datetime DEFAULT NULL,
  `replacedByJti` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `dateCreated` datetime NOT NULL,
  `dateUpdated` datetime NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `jti` (`jti`),
  KEY `idx_refresh_tokens_accountId` (`accountId`),
  KEY `idx_refresh_tokens_expiresAt` (`expiresAt`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `refresh_tokens`
--

LOCK TABLES `refresh_tokens` WRITE;
/*!40000 ALTER TABLE `refresh_tokens` DISABLE KEYS */;
INSERT INTO `refresh_tokens` VALUES (1,'745091d731cef354ca8fc2450cb5b83123d27c7b3aaa647a9b6d4732ba910c71','324de890-be68-11f1-8891-088fc3017818','2026-11-01 21:50:38','2026-10-02 22:42:10',NULL,'2026-10-02 21:50:38','2026-10-02 22:42:10'),(2,'1bf0b9cc366b3a2340cc14aeb4339fe8a4e61cb59970db4c5849c7acff3eb33a','324de890-be68-11f1-8891-088fc3017818','2026-11-01 21:52:56','2026-10-02 22:42:10',NULL,'2026-10-02 21:52:56','2026-10-02 22:42:10'),(3,'adff3f22fea7bc3c3cea9855a75b10a69d0ed64aa46499efcdc065144b5ebca5','8e1f1195-be69-11f1-8891-088fc3017818','2026-11-01 22:00:51',NULL,NULL,'2026-10-02 22:00:51','2026-10-02 22:00:51'),(4,'826497ef846bb886e3bffbda9ccaaa84f7e52f925b81c5a3f04a3d043f291db3','324de890-be68-11f1-8891-088fc3017818','2026-11-01 22:42:18',NULL,NULL,'2026-10-02 22:42:18','2026-10-02 22:42:18');
/*!40000 ALTER TABLE `refresh_tokens` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `role_permissions`
--

DROP TABLE IF EXISTS `role_permissions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `role_permissions` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `roleId` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `permissionId` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `accessLevel` enum('read','write') COLLATE utf8mb4_unicode_ci NOT NULL,
  `dateCreated` datetime NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_role_permissions_roleId` (`roleId`),
  KEY `idx_role_permissions_permissionId` (`permissionId`),
  CONSTRAINT `fk_rp_permission` FOREIGN KEY (`permissionId`) REFERENCES `permissions` (`permissionId`),
  CONSTRAINT `fk_rp_role` FOREIGN KEY (`roleId`) REFERENCES `roles` (`roleId`)
) ENGINE=InnoDB AUTO_INCREMENT=77 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `role_permissions`
--

LOCK TABLES `role_permissions` WRITE;
/*!40000 ALTER TABLE `role_permissions` DISABLE KEYS */;
INSERT INTO `role_permissions` VALUES (1,'555a4ef8-be63-11f1-8891-088fc3017818','3842dc17-be63-11f1-8891-088fc3017818','write','2026-10-02 21:15:26'),(2,'555a4ef8-be63-11f1-8891-088fc3017818','38434d85-be63-11f1-8891-088fc3017818','write','2026-10-02 21:15:26'),(3,'555a4ef8-be63-11f1-8891-088fc3017818','3843e501-be63-11f1-8891-088fc3017818','write','2026-10-02 21:15:26'),(4,'555a4ef8-be63-11f1-8891-088fc3017818','3844444b-be63-11f1-8891-088fc3017818','write','2026-10-02 21:15:26'),(5,'555a4ef8-be63-11f1-8891-088fc3017818','3844c905-be63-11f1-8891-088fc3017818','write','2026-10-02 21:15:26'),(6,'555a4ef8-be63-11f1-8891-088fc3017818','38452107-be63-11f1-8891-088fc3017818','write','2026-10-02 21:15:26'),(7,'555a4ef8-be63-11f1-8891-088fc3017818','38455c85-be63-11f1-8891-088fc3017818','write','2026-10-02 21:15:26'),(8,'555a4ef8-be63-11f1-8891-088fc3017818','3845aa8b-be63-11f1-8891-088fc3017818','write','2026-10-02 21:15:26'),(9,'555a4ef8-be63-11f1-8891-088fc3017818','384614eb-be63-11f1-8891-088fc3017818','write','2026-10-02 21:15:26'),(10,'555a4ef8-be63-11f1-8891-088fc3017818','384653a8-be63-11f1-8891-088fc3017818','write','2026-10-02 21:15:26'),(11,'555a4ef8-be63-11f1-8891-088fc3017818','38468cff-be63-11f1-8891-088fc3017818','write','2026-10-02 21:15:26'),(12,'555a4ef8-be63-11f1-8891-088fc3017818','3846df73-be63-11f1-8891-088fc3017818','write','2026-10-02 21:15:26'),(13,'555a4ef8-be63-11f1-8891-088fc3017818','3847367a-be63-11f1-8891-088fc3017818','write','2026-10-02 21:15:26'),(14,'555a4ef8-be63-11f1-8891-088fc3017818','3847729a-be63-11f1-8891-088fc3017818','write','2026-10-02 21:15:26'),(15,'555a4ef8-be63-11f1-8891-088fc3017818','3847a9b7-be63-11f1-8891-088fc3017818','write','2026-10-02 21:15:26'),(16,'555a4ef8-be63-11f1-8891-088fc3017818','3847ef3f-be63-11f1-8891-088fc3017818','write','2026-10-02 21:15:26'),(17,'555a4ef8-be63-11f1-8891-088fc3017818','38482acc-be63-11f1-8891-088fc3017818','write','2026-10-02 21:15:26'),(18,'555a4ef8-be63-11f1-8891-088fc3017818','38487176-be63-11f1-8891-088fc3017818','write','2026-10-02 21:15:26'),(19,'555a4ef8-be63-11f1-8891-088fc3017818','3848b4cf-be63-11f1-8891-088fc3017818','write','2026-10-02 21:15:26'),(20,'555a4ef8-be63-11f1-8891-088fc3017818','3848fd39-be63-11f1-8891-088fc3017818','write','2026-10-02 21:15:26'),(21,'555a4ef8-be63-11f1-8891-088fc3017818','384939cf-be63-11f1-8891-088fc3017818','write','2026-10-02 21:15:26'),(22,'555a4ef8-be63-11f1-8891-088fc3017818','3849752a-be63-11f1-8891-088fc3017818','write','2026-10-02 21:15:26'),(23,'555a4ef8-be63-11f1-8891-088fc3017818','3849b544-be63-11f1-8891-088fc3017818','write','2026-10-02 21:15:26'),(32,'555b5c1b-be63-11f1-8891-088fc3017818','3842dc17-be63-11f1-8891-088fc3017818','write','2026-10-02 21:15:26'),(33,'555b5c1b-be63-11f1-8891-088fc3017818','38455c85-be63-11f1-8891-088fc3017818','write','2026-10-02 21:15:26'),(34,'555b5c1b-be63-11f1-8891-088fc3017818','38482acc-be63-11f1-8891-088fc3017818','write','2026-10-02 21:15:26'),(35,'555b5c1b-be63-11f1-8891-088fc3017818','38452107-be63-11f1-8891-088fc3017818','write','2026-10-02 21:15:26'),(36,'555b5c1b-be63-11f1-8891-088fc3017818','3848b4cf-be63-11f1-8891-088fc3017818','write','2026-10-02 21:15:26'),(37,'555b5c1b-be63-11f1-8891-088fc3017818','3848fd39-be63-11f1-8891-088fc3017818','write','2026-10-02 21:15:26'),(38,'555b5c1b-be63-11f1-8891-088fc3017818','384939cf-be63-11f1-8891-088fc3017818','write','2026-10-02 21:15:26'),(39,'555b5c1b-be63-11f1-8891-088fc3017818','3849752a-be63-11f1-8891-088fc3017818','write','2026-10-02 21:15:26'),(40,'555b5c1b-be63-11f1-8891-088fc3017818','3849b544-be63-11f1-8891-088fc3017818','write','2026-10-02 21:15:26'),(41,'555b5c1b-be63-11f1-8891-088fc3017818','3845aa8b-be63-11f1-8891-088fc3017818','read','2026-10-02 21:15:26'),(42,'555b5c1b-be63-11f1-8891-088fc3017818','384614eb-be63-11f1-8891-088fc3017818','read','2026-10-02 21:15:26'),(43,'555b5c1b-be63-11f1-8891-088fc3017818','384653a8-be63-11f1-8891-088fc3017818','read','2026-10-02 21:15:26'),(44,'555b5c1b-be63-11f1-8891-088fc3017818','38468cff-be63-11f1-8891-088fc3017818','read','2026-10-02 21:15:26'),(45,'555b5c1b-be63-11f1-8891-088fc3017818','3846df73-be63-11f1-8891-088fc3017818','read','2026-10-02 21:15:26'),(46,'555b5c1b-be63-11f1-8891-088fc3017818','3847a9b7-be63-11f1-8891-088fc3017818','read','2026-10-02 21:15:26'),(47,'555b5c1b-be63-11f1-8891-088fc3017818','3847367a-be63-11f1-8891-088fc3017818','write','2026-10-02 21:15:26'),(48,'555b5c1b-be63-11f1-8891-088fc3017818','3847ef3f-be63-11f1-8891-088fc3017818','read','2026-10-02 21:15:26'),(49,'555b5c1b-be63-11f1-8891-088fc3017818','3847729a-be63-11f1-8891-088fc3017818','read','2026-10-02 21:15:26'),(50,'555b5c1b-be63-11f1-8891-088fc3017818','38434d85-be63-11f1-8891-088fc3017818','write','2026-10-02 21:15:26'),(51,'555b5c1b-be63-11f1-8891-088fc3017818','3843e501-be63-11f1-8891-088fc3017818','write','2026-10-02 21:15:26'),(52,'555b5c1b-be63-11f1-8891-088fc3017818','3844444b-be63-11f1-8891-088fc3017818','write','2026-10-02 21:15:26'),(53,'555b5c1b-be63-11f1-8891-088fc3017818','38487176-be63-11f1-8891-088fc3017818','write','2026-10-02 21:15:26'),(54,'555b5c1b-be63-11f1-8891-088fc3017818','3844c905-be63-11f1-8891-088fc3017818','read','2026-10-02 21:15:26'),(55,'555bf257-be63-11f1-8891-088fc3017818','3842dc17-be63-11f1-8891-088fc3017818','read','2026-10-02 21:15:26'),(56,'555bf257-be63-11f1-8891-088fc3017818','38455c85-be63-11f1-8891-088fc3017818','write','2026-10-02 21:15:26'),(57,'555bf257-be63-11f1-8891-088fc3017818','38482acc-be63-11f1-8891-088fc3017818','write','2026-10-02 21:15:26'),(58,'555bf257-be63-11f1-8891-088fc3017818','38452107-be63-11f1-8891-088fc3017818','read','2026-10-02 21:15:26'),(59,'555bf257-be63-11f1-8891-088fc3017818','3848b4cf-be63-11f1-8891-088fc3017818','write','2026-10-02 21:15:26'),(60,'555bf257-be63-11f1-8891-088fc3017818','3848fd39-be63-11f1-8891-088fc3017818','write','2026-10-02 21:15:26'),(61,'555bf257-be63-11f1-8891-088fc3017818','384939cf-be63-11f1-8891-088fc3017818','write','2026-10-02 21:15:26'),(62,'555bf257-be63-11f1-8891-088fc3017818','3849752a-be63-11f1-8891-088fc3017818','write','2026-10-02 21:15:26'),(63,'555bf257-be63-11f1-8891-088fc3017818','3849b544-be63-11f1-8891-088fc3017818','write','2026-10-02 21:15:26'),(64,'555bf257-be63-11f1-8891-088fc3017818','3844c905-be63-11f1-8891-088fc3017818','read','2026-10-02 21:15:26'),(65,'555c7b3c-be63-11f1-8891-088fc3017818','3842dc17-be63-11f1-8891-088fc3017818','read','2026-10-02 21:15:26'),(66,'555c7b3c-be63-11f1-8891-088fc3017818','38455c85-be63-11f1-8891-088fc3017818','read','2026-10-02 21:15:26'),(67,'555c7b3c-be63-11f1-8891-088fc3017818','38482acc-be63-11f1-8891-088fc3017818','read','2026-10-02 21:15:26'),(68,'555c7b3c-be63-11f1-8891-088fc3017818','3845aa8b-be63-11f1-8891-088fc3017818','write','2026-10-02 21:15:26'),(69,'555c7b3c-be63-11f1-8891-088fc3017818','384614eb-be63-11f1-8891-088fc3017818','write','2026-10-02 21:15:26'),(70,'555c7b3c-be63-11f1-8891-088fc3017818','384653a8-be63-11f1-8891-088fc3017818','write','2026-10-02 21:15:26'),(71,'555c7b3c-be63-11f1-8891-088fc3017818','38468cff-be63-11f1-8891-088fc3017818','write','2026-10-02 21:15:26'),(72,'555c7b3c-be63-11f1-8891-088fc3017818','3846df73-be63-11f1-8891-088fc3017818','write','2026-10-02 21:15:26'),(73,'555c7b3c-be63-11f1-8891-088fc3017818','3847a9b7-be63-11f1-8891-088fc3017818','write','2026-10-02 21:15:26'),(74,'555c7b3c-be63-11f1-8891-088fc3017818','3847367a-be63-11f1-8891-088fc3017818','write','2026-10-02 21:15:26'),(75,'555c7b3c-be63-11f1-8891-088fc3017818','3847ef3f-be63-11f1-8891-088fc3017818','write','2026-10-02 21:15:26'),(76,'555c7b3c-be63-11f1-8891-088fc3017818','3847729a-be63-11f1-8891-088fc3017818','write','2026-10-02 21:15:26');
/*!40000 ALTER TABLE `role_permissions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `roles`
--

DROP TABLE IF EXISTS `roles`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `roles` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `roleId` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `companyId` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `branchId` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `roleName` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text COLLATE utf8mb4_unicode_ci,
  `status` enum('Active','Inactive') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'Active',
  `dateCreated` datetime NOT NULL,
  `dateUpdated` datetime NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `roleId` (`roleId`),
  KEY `idx_roles_companyId` (`companyId`),
  KEY `idx_roles_branchId` (`branchId`),
  KEY `idx_roles_roleName` (`roleName`),
  KEY `idx_roles_tenant` (`companyId`,`branchId`,`status`),
  CONSTRAINT `fk_roles_branch` FOREIGN KEY (`branchId`) REFERENCES `branches` (`branchId`),
  CONSTRAINT `fk_roles_company` FOREIGN KEY (`companyId`) REFERENCES `companies` (`companyId`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `roles`
--

LOCK TABLES `roles` WRITE;
/*!40000 ALTER TABLE `roles` DISABLE KEYS */;
INSERT INTO `roles` VALUES (1,'555a4ef8-be63-11f1-8891-088fc3017818','5558814a-be63-11f1-8891-088fc3017818','5559990d-be63-11f1-8891-088fc3017818','Owner','Full access owner role. Not visible in Admin portal.','Active','2026-10-02 21:15:26','2026-10-02 21:15:26'),(2,'555b5c1b-be63-11f1-8891-088fc3017818','5558814a-be63-11f1-8891-088fc3017818','5559990d-be63-11f1-8891-088fc3017818','Admin','Runs the branch: users, roles, settings, billing and subscribers. Reads the network.','Active','2026-10-02 21:15:26','2026-10-02 21:15:26'),(3,'555bf257-be63-11f1-8891-088fc3017818','5558814a-be63-11f1-8891-088fc3017818','5559990d-be63-11f1-8891-088fc3017818','Billing','Invoices, payments, adjustments, the billing cycle and the disconnection sweep.','Active','2026-10-02 21:15:26','2026-10-02 21:15:26'),(4,'555c7b3c-be63-11f1-8891-088fc3017818','5558814a-be63-11f1-8891-088fc3017818','5559990d-be63-11f1-8891-088fc3017818','Technician','Network inventory, provisioning and discovery. Reads subscribers.','Active','2026-10-02 21:15:26','2026-10-02 21:15:26');
/*!40000 ALTER TABLE `roles` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `settings`
--

DROP TABLE IF EXISTS `settings`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `settings` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `companyId` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `branchId` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `settingKey` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `settingValue` text COLLATE utf8mb4_unicode_ci,
  `dateCreated` datetime NOT NULL,
  `dateUpdated` datetime NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_settings_tenant_key` (`companyId`,`branchId`,`settingKey`),
  KEY `fk_settings_branch` (`branchId`),
  CONSTRAINT `fk_settings_branch` FOREIGN KEY (`branchId`) REFERENCES `branches` (`branchId`),
  CONSTRAINT `fk_settings_company` FOREIGN KEY (`companyId`) REFERENCES `companies` (`companyId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `settings`
--

LOCK TABLES `settings` WRITE;
/*!40000 ALTER TABLE `settings` DISABLE KEYS */;
/*!40000 ALTER TABLE `settings` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `splitters`
--

DROP TABLE IF EXISTS `splitters`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `splitters` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `splitterId` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `companyId` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `branchId` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `parentType` enum('pon_port','splitter') COLLATE utf8mb4_unicode_ci NOT NULL,
  `parentId` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `ratio` enum('1:2','1:4','1:8','1:16','1:32','1:64') COLLATE utf8mb4_unicode_ci NOT NULL,
  `label` varchar(120) COLLATE utf8mb4_unicode_ci NOT NULL,
  `location` varchar(190) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status` enum('Active','Inactive','Deleted') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'Active',
  `dateCreated` datetime NOT NULL,
  `dateUpdated` datetime NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `splitterId` (`splitterId`),
  KEY `idx_splitters_parent` (`parentType`,`parentId`),
  KEY `idx_splitters_tenant` (`companyId`,`branchId`,`status`),
  KEY `fk_splitters_branch` (`branchId`),
  CONSTRAINT `fk_splitters_branch` FOREIGN KEY (`branchId`) REFERENCES `branches` (`branchId`),
  CONSTRAINT `fk_splitters_company` FOREIGN KEY (`companyId`) REFERENCES `companies` (`companyId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `splitters`
--

LOCK TABLES `splitters` WRITE;
/*!40000 ALTER TABLE `splitters` DISABLE KEYS */;
/*!40000 ALTER TABLE `splitters` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `subscriptions`
--

DROP TABLE IF EXISTS `subscriptions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `subscriptions` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `subscriptionId` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `companyId` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `branchId` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `customerId` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `planId` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `onuId` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status` enum('pending','active','suspended','for_recovery','terminated') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pending',
  `activatedAt` datetime DEFAULT NULL,
  `suspendedAt` datetime DEFAULT NULL,
  `forRecoveryAt` datetime DEFAULT NULL,
  `recoveryOutcome` enum('recovered','not_recovered') COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `terminatedAt` datetime DEFAULT NULL,
  `notes` text COLLATE utf8mb4_unicode_ci,
  `recordStatus` enum('Active','Deleted') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'Active',
  `dateCreated` datetime NOT NULL,
  `dateUpdated` datetime NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `subscriptionId` (`subscriptionId`),
  UNIQUE KEY `uq_subscriptions_onu` (`onuId`),
  KEY `idx_subscriptions_customerId` (`customerId`),
  KEY `idx_subscriptions_planId` (`planId`),
  KEY `idx_subscriptions_status` (`status`),
  KEY `idx_subscriptions_recovery` (`status`,`suspendedAt`),
  KEY `idx_subscriptions_tenant` (`companyId`,`branchId`,`recordStatus`),
  KEY `fk_subscriptions_branch` (`branchId`),
  CONSTRAINT `fk_subscriptions_branch` FOREIGN KEY (`branchId`) REFERENCES `branches` (`branchId`),
  CONSTRAINT `fk_subscriptions_company` FOREIGN KEY (`companyId`) REFERENCES `companies` (`companyId`),
  CONSTRAINT `fk_subscriptions_customer` FOREIGN KEY (`customerId`) REFERENCES `customers` (`customerId`),
  CONSTRAINT `fk_subscriptions_onu` FOREIGN KEY (`onuId`) REFERENCES `onus` (`onuId`),
  CONSTRAINT `fk_subscriptions_plan` FOREIGN KEY (`planId`) REFERENCES `plans` (`planId`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `subscriptions`
--

LOCK TABLES `subscriptions` WRITE;
/*!40000 ALTER TABLE `subscriptions` DISABLE KEYS */;
INSERT INTO `subscriptions` VALUES (1,'abf90f82-be6a-11f1-8891-088fc3017818','5558814a-be63-11f1-8891-088fc3017818','5559990d-be63-11f1-8891-088fc3017818','a496c3d3-be6a-11f1-8891-088fc3017818','841d1eae-be6a-11f1-8891-088fc3017818',NULL,'active','2026-10-02 22:08:21',NULL,NULL,NULL,NULL,NULL,'Active','2026-10-02 22:07:58','2026-10-02 22:08:21'),(2,'b225a0aa-be6a-11f1-8891-088fc3017818','5558814a-be63-11f1-8891-088fc3017818','5559990d-be63-11f1-8891-088fc3017818','998e8bb5-be6a-11f1-8891-088fc3017818','841d1eae-be6a-11f1-8891-088fc3017818',NULL,'active','2026-10-02 22:08:16',NULL,NULL,NULL,NULL,NULL,'Active','2026-10-02 22:08:08','2026-10-02 22:08:16');
/*!40000 ALTER TABLE `subscriptions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `superadmins`
--

DROP TABLE IF EXISTS `superadmins`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `superadmins` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `accountId` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `firstName` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `lastName` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `phone` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `imageUrl` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status` enum('Active','Inactive','Suspended','Deleted') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'Active',
  `dateCreated` datetime NOT NULL,
  `dateUpdated` datetime NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `accountId` (`accountId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `superadmins`
--

LOCK TABLES `superadmins` WRITE;
/*!40000 ALTER TABLE `superadmins` DISABLE KEYS */;
/*!40000 ALTER TABLE `superadmins` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `system_settings`
--

DROP TABLE IF EXISTS `system_settings`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `system_settings` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `companyId` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `settingKey` varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL,
  `settingValue` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `description` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `updatedBy` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `dateCreated` datetime NOT NULL,
  `dateUpdated` datetime NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_system_settings` (`companyId`,`settingKey`),
  CONSTRAINT `fk_system_settings_company` FOREIGN KEY (`companyId`) REFERENCES `companies` (`companyId`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `system_settings`
--

LOCK TABLES `system_settings` WRITE;
/*!40000 ALTER TABLE `system_settings` DISABLE KEYS */;
INSERT INTO `system_settings` VALUES (1,'5558814a-be63-11f1-8891-088fc3017818','NETWORK_ENABLED','false',NULL,'system:superadmin:superadmin','2026-10-02 21:49:20','2026-10-02 21:49:20');
/*!40000 ALTER TABLE `system_settings` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `user_branches`
--

DROP TABLE IF EXISTS `user_branches`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `user_branches` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `userBranchId` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `accountId` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `branchId` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` enum('Active','Inactive','Deleted') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'Active',
  `dateCreated` datetime NOT NULL,
  `dateUpdated` datetime NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `userBranchId` (`userBranchId`),
  UNIQUE KEY `uq_user_branches` (`accountId`,`branchId`),
  KEY `idx_user_branches_accountId` (`accountId`),
  KEY `idx_user_branches_branchId` (`branchId`),
  CONSTRAINT `fk_user_branches_branch` FOREIGN KEY (`branchId`) REFERENCES `branches` (`branchId`),
  CONSTRAINT `fk_user_branches_user` FOREIGN KEY (`accountId`) REFERENCES `users` (`accountId`)
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `user_branches`
--

LOCK TABLES `user_branches` WRITE;
/*!40000 ALTER TABLE `user_branches` DISABLE KEYS */;
INSERT INTO `user_branches` VALUES (1,'324e25ca-be68-11f1-8891-088fc3017818','324de890-be68-11f1-8891-088fc3017818','5559990d-be63-11f1-8891-088fc3017818','Active','2026-10-02 21:50:15','2026-10-02 21:50:15'),(2,'8e1f41a4-be69-11f1-8891-088fc3017818','8e1f1195-be69-11f1-8891-088fc3017818','5559990d-be63-11f1-8891-088fc3017818','Active','2026-10-02 21:59:59','2026-10-02 21:59:59'),(3,'9e59e6c3-be69-11f1-8891-088fc3017818','9e59b2eb-be69-11f1-8891-088fc3017818','5559990d-be63-11f1-8891-088fc3017818','Deleted','2026-10-02 22:00:26','2026-10-02 22:02:25'),(7,'079041c3-be6a-11f1-8891-088fc3017818','07901371-be6a-11f1-8891-088fc3017818','5559990d-be63-11f1-8891-088fc3017818','Active','2026-10-02 22:03:22','2026-10-02 22:03:22');
/*!40000 ALTER TABLE `user_branches` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `user_permissions`
--

DROP TABLE IF EXISTS `user_permissions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `user_permissions` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `userPermissionId` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `accountId` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `permissionId` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `accessLevel` enum('none','read','write') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'read',
  `dateCreated` datetime NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `userPermissionId` (`userPermissionId`),
  KEY `idx_user_permissions_accountId` (`accountId`),
  KEY `idx_user_permissions_permissionId` (`permissionId`),
  CONSTRAINT `fk_up_permission` FOREIGN KEY (`permissionId`) REFERENCES `permissions` (`permissionId`),
  CONSTRAINT `fk_up_user` FOREIGN KEY (`accountId`) REFERENCES `users` (`accountId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `user_permissions`
--

LOCK TABLES `user_permissions` WRITE;
/*!40000 ALTER TABLE `user_permissions` DISABLE KEYS */;
/*!40000 ALTER TABLE `user_permissions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `users`
--

DROP TABLE IF EXISTS `users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `users` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `accountId` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `companyId` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `branchId` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `firstName` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `lastName` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `phone` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `imageUrl` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `signature` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `roleId` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` enum('Active','Inactive','Suspended','Deleted') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'Active',
  `dateCreated` datetime NOT NULL,
  `dateUpdated` datetime NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `accountId` (`accountId`),
  KEY `idx_users_companyId` (`companyId`),
  KEY `idx_users_branchId` (`branchId`),
  KEY `idx_users_roleId` (`roleId`),
  KEY `idx_users_tenant` (`companyId`,`branchId`,`status`),
  CONSTRAINT `fk_users_branch` FOREIGN KEY (`branchId`) REFERENCES `branches` (`branchId`),
  CONSTRAINT `fk_users_company` FOREIGN KEY (`companyId`) REFERENCES `companies` (`companyId`),
  CONSTRAINT `fk_users_role` FOREIGN KEY (`roleId`) REFERENCES `roles` (`roleId`)
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `users`
--

LOCK TABLES `users` WRITE;
/*!40000 ALTER TABLE `users` DISABLE KEYS */;
INSERT INTO `users` VALUES (1,'324de890-be68-11f1-8891-088fc3017818','5558814a-be63-11f1-8891-088fc3017818','5559990d-be63-11f1-8891-088fc3017818','Test','Owner',NULL,NULL,NULL,'555a4ef8-be63-11f1-8891-088fc3017818','Active','2026-10-02 21:50:15','2026-10-02 21:50:15'),(2,'8e1f1195-be69-11f1-8891-088fc3017818','5558814a-be63-11f1-8891-088fc3017818','5559990d-be63-11f1-8891-088fc3017818','Test','Billing',NULL,NULL,NULL,'555bf257-be63-11f1-8891-088fc3017818','Active','2026-10-02 21:59:59','2026-10-02 21:59:59'),(3,'9e59b2eb-be69-11f1-8891-088fc3017818','5558814a-be63-11f1-8891-088fc3017818','5559990d-be63-11f1-8891-088fc3017818','Test','Technician',NULL,NULL,NULL,'555c7b3c-be63-11f1-8891-088fc3017818','Deleted','2026-10-02 22:00:26','2026-10-02 22:02:25'),(7,'07901371-be6a-11f1-8891-088fc3017818','5558814a-be63-11f1-8891-088fc3017818','5559990d-be63-11f1-8891-088fc3017818','test','technician',NULL,NULL,NULL,'555c7b3c-be63-11f1-8891-088fc3017818','Active','2026-10-02 22:03:22','2026-10-02 22:03:22');
/*!40000 ALTER TABLE `users` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `webhook_events`
--

DROP TABLE IF EXISTS `webhook_events`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `webhook_events` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `webhookEventId` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `provider` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL,
  `eventId` varchar(190) COLLATE utf8mb4_unicode_ci NOT NULL,
  `eventType` varchar(80) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `reference` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `invoiceId` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `signatureVerified` tinyint(1) NOT NULL DEFAULT '0',
  `payload` json DEFAULT NULL,
  `processedAt` datetime DEFAULT NULL,
  `processError` text COLLATE utf8mb4_unicode_ci,
  `dateCreated` datetime NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `webhookEventId` (`webhookEventId`),
  UNIQUE KEY `uq_webhook_events_event` (`provider`,`eventId`),
  KEY `idx_webhook_events_unprocessed` (`processedAt`,`dateCreated`),
  KEY `idx_webhook_events_reference` (`reference`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `webhook_events`
--

LOCK TABLES `webhook_events` WRITE;
/*!40000 ALTER TABLE `webhook_events` DISABLE KEYS */;
/*!40000 ALTER TABLE `webhook_events` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Dumping routines for database 'teranetwork'
--
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-10-02 22:46:15
