ALTER TABLE orders ADD COLUMN delivery_eta INTEGER;
UPDATE orders SET status = 'picked_up' WHERE status = 'in_transit';
