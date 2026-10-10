# NovaMart RAG Knowledge Base — Demo Data

All files in this directory are synthetic demo content created for the RetailPulse AI hackathon. They are not actual NovaMart corporate policies or manufacturer-approved manuals.

## Included documents
- `online_return_policy.md`
- `in_store_return_policy.md`
- `warranty_policy.md`
- `shipping_delivery_policy.md`
- `smartphone_manual.md`
- `refrigerator_manual.md`
- `inventory_replenishment.md`
- `customer_support_sop.md`

## Metadata
Each document contains a metadata section with document ID, version, effective date, region, category, document type, membership tier, status, and owner.

## Ingestion guidance
1. Upload each file through the admin ingestion endpoint.
2. Store the metadata as structured fields, not only as text in the chunk.
3. Preserve section headings and source locators when chunking.
4. Treat the policies as approved *demo* data only.
5. Keep live stock, price, order, and ticket status in operational APIs rather than relying on static RAG documents.

## Consistency conventions
- Standard return window: 14 calendar days.
- Refund target: 5–7 business days after approval, excluding additional payment-provider posting time.
- Standard delivery estimate: 3–7 business days after dispatch.
- Express delivery target: 1–2 business days after dispatch where eligible.
- Demo delivery fees: ₹99 standard and ₹199 express.
- Gold and Platinum: free standard delivery on eligible orders.
- Platinum: free express delivery only when the order and destination qualify.
- Demo warranty periods are fictional and explicitly require product-specific verification.
- Refrigerator error codes are fictional examples and must not be applied to real appliances.

The effective date is 2026-10-01 and the document version is 2026.1 unless stated otherwise.
