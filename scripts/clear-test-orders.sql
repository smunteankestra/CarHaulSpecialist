-- Remove every TEST order and its related rows.
DELETE FROM order_events WHERE order_id IN (SELECT id FROM orders WHERE token LIKE 'test-order-%');
DELETE FROM invoices WHERE order_id IN (SELECT id FROM orders WHERE token LIKE 'test-order-%');
DELETE FROM orders WHERE token LIKE 'test-order-%';
