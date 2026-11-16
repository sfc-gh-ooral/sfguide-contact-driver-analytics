-- =============================================================================
-- Contact Driver Analytics: cleanup
-- Drops everything sql/setup.sql created. The database drop removes its tables,
-- views, and functions.
-- =============================================================================
USE ROLE ACCOUNTADMIN;

DROP DATABASE IF EXISTS CONTACT_DRIVER_EXAMPLE;
DROP WAREHOUSE IF EXISTS CONTACT_DRIVER_WH;
DROP ROLE IF EXISTS CONTACT_DRIVER_ROLE;
