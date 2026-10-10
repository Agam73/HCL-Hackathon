# NovaMart Inventory Replenishment Standard Operating Procedure

> **DEMO INTERNAL SOP — fictional content for the RetailPulse AI hackathon. Not an actual NovaMart operational procedure.**

## Document metadata
- **Document ID:** NM-SOP-INV-001
- **Version:** 2026.1
- **Effective date:** 2026-10-01
- **Region:** IN
- **Category:** Store Operations
- **Document type:** INVENTORY_SOP
- **Membership tier:** ALL
- **Status:** APPROVED_DEMO
- **Owner:** Inventory Operations

## 1. Purpose and scope
This SOP describes how store teams identify low stock, validate inventory records, and request replenishment. It is an operational guide, not a source of live inventory quantities. Current stock and order availability must be obtained from the inventory system.

## 2. Roles
- **Store Associate:** Performs shelf checks and reports discrepancies.
- **Store Manager:** Reviews replenishment requests and prioritizes local needs.
- **Inventory Planner:** Reviews demand, stock position, lead time, and replenishment quantities.
- **Warehouse Team:** Confirms pick, pack, and dispatch status.
- **Customer Support:** Communicates confirmed availability and resolves customer-facing stock discrepancies.

## 3. Stock checks
1. Compare physical shelf quantity with the inventory system.
2. Check backroom and designated reserve locations.
3. Confirm whether units are reserved, damaged, in transit, or awaiting put-away.
4. Record SKU, store, observed quantity, system quantity, timestamp, and checker.
5. Escalate unexplained discrepancies instead of manually adjusting records without authorization.

## 4. Demo replenishment threshold
For this demo SOP, a SKU should be reviewed for replenishment when available-to-promise stock is at or below the configured reorder point. The example default reorder point is 5 sellable units per SKU per store. This is a synthetic starting value, not a universal rule. Inventory Planning may configure SKU-specific thresholds based on demand, lead time, shelf capacity, and supplier constraints.

## 5. Replenishment calculation
A planning suggestion may consider:
- Forecast demand during supplier or warehouse lead time.
- Desired safety stock.
- Available-to-promise stock.
- Existing purchase orders or transfers.
- Shelf and storage capacity.
- Minimum order quantities and pack sizes.

A suggested order quantity is not an authorization to place an order. The responsible role must approve the request under the store's configured controls.

## 6. Replenishment workflow
1. Identify a SKU at or below its reorder point.
2. Validate physical and system quantities.
3. Check open transfers, purchase orders, and expected receipts.
4. Create a replenishment request with SKU, store, suggested quantity, reason, and priority.
5. Obtain the required approval.
6. Send the approved request to the warehouse or purchasing workflow.
7. Track fulfillment and confirm receipt.
8. Reconcile discrepancies and close the request.

## 7. Stockout and online availability mismatch
If the storefront shows an item as available but the store cannot locate sellable stock, mark the discrepancy for investigation through the authorized inventory system. Do not promise the customer that an item is available until the live inventory service confirms it. Notify Customer Support when an affected order or customer needs assistance.

## 8. Demand spikes and escalation
Escalate unusual demand, repeated stockouts, suspected inventory loss, and supplier delays to the Inventory Planner and Store Manager. Include SKU, location, observed trend, current system quantity, pending receipts, and business impact. Do not bypass approval controls to force a replenishment.

## 9. Audit trail
Record the person making each adjustment, the previous and new quantities, the reason, timestamp, and approval reference. Inventory adjustments must be traceable.
