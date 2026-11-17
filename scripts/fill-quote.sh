#!/bin/bash
# Fill and submit a quote with every field set. Change the values you care about.
URL="${1:-https://bondautotransport.muntean2stefan.workers.dev}"
curl -s -m 60 -o /tmp/quote-result.html -w "HTTP %{http_code}\n" -X POST "$URL/get-quote" \
  -F "origin_zip=30301" \
  -F "dest_zip=33101" \
  -F "transport_type=open" \
  -F "vehicle_type=car" \
  -F "vehicle_year=2021" \
  -F "vehicle_make=HONDA" \
  -F "vehicle_model=CIVIC" \
  -F "vin=1HGCM82633A004352" \
  -F "condition=running" \
  -F "available_date=2026-11-20" \
  -F "name=Test Customer" \
  -F "email=test@example.com" \
  -F "phone=3055550134" \
  -F "notes=Filled by script"
grep -o 'form-error">[^<]*' /tmp/quote-result.html | head -2
grep -oE '\$[0-9,]+' /tmp/quote-result.html | head -3
