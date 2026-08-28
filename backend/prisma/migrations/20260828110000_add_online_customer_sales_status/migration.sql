-- Add the explicitly selected online-inquiry state without rewriting
-- existing customer sales statuses or historical records.
ALTER TYPE "CustomerSalesStatus" ADD VALUE IF NOT EXISTS 'ONLINE' BEFORE 'INTERESTED';
