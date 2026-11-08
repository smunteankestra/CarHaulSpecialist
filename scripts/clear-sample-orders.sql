-- Remove the sample data created by seed-sample-orders.sql.
DELETE FROM order_events WHERE order_id IN (SELECT id FROM orders WHERE token LIKE 'sample-order-%');
DELETE FROM order_photos WHERE order_id IN (SELECT id FROM orders WHERE token LIKE 'sample-order-%');
DELETE FROM invoices WHERE order_id IN (SELECT id FROM orders WHERE token LIKE 'sample-order-%');
DELETE FROM orders WHERE token LIKE 'sample-order-%';
DELETE FROM lead_photos WHERE lead_id IN (SELECT id FROM leads WHERE email LIKE '%@example.com');
DELETE FROM leads WHERE email LIKE '%@example.com';
DELETE FROM sqlite_sequence WHERE name IN ('orders','leads','order_events','order_photos','lead_photos','invoices');
