import { buildDocx, paragraph } from "./docx.ts";

/** Transportation Agreement text, taken from the signed template (F60086). */
export const CONTRACT_TERMS: string[] = [
  `TERMS AND CONDITION BOND AUTO TRANSPORT is a fully licensed and bonded Transport Management Company registered with the USDOT # 4250470. This agreement is between solely the customer and his, her or its duly authorized agents, (hereinafter referred to as “Customer”), and BOND AUTO TRANSPORT. *Cancellation & Refund Policy* The option to cancel a shipping order is available at any time, at no cost and with no cancellation fee, as long as the order has not yet been assigned (dispatched) to a Carrier (transporter). Our services are considered rendered when a Carrier (transporter) is assigned to an order. Refunds will be processed within 48 business hours of the cancellation request. Cancellation of an order must be submitted in writing via email sent to operations@bondautotransportl.com. BOND AUTO TRANSPORT does not accept or honor cancellations made via phone call. Once a Carrier (transporter) has been assigned (dispatched) to a shipping order, BOND AUTO TRANSPORT notifies Customer via email (to the email address provided at service booking). If the Customer decides to cancel the shipping order after a Carrier (transporter) has been assigned (dispatched), a $199 cancellation fee will be applied, as our services have been rendered. This fee does not include any cancellation fees imposed by an oceanic transporter. Any remaining balance will be refunded in full. *Contract Terms and Liability Disclaimer*`,
  `1. The Carrier will pick up and deliver as close to the Customer’s door as legally and safely as possible. A mutually agreed upon place to load or unload the vehicle(s) may be necessary due to low hanging trees, low hanging wires, narrow streets and residential area restrictions.`,
  `2. BOND AUTO TRANSPORT shall provide the Customer with an estimated pickup and estimated delivery date. However, delays may occur prior to, and/or during, transport due to weather, road conditions, mechanical problems, etc. There are absolutely no guarantees regarding pickup or delivery times and dates. BOND AUTO TRANSPORT/Carrier shall not be held responsible for loss or damages occasioned by delays of any kind or for any reason, car rental fees or any accommodation fees. BOND AUTO TRANSPORT/Carrier shall not be held liable for failure of mechanical or operating parts of Customer’s vehicle.`,
  `3. Carriers authorized to operate and transport Customer’s motor vehicle between its pickup location and the destination set forth on the shipping order and Bill of Lading.`,
  `4. The Customer is responsible for preparing the vehicle for transport. All loose parts, fragile accessories, low hanging spoilers, etc. must be removed or secured. The Customer shall remove all non-permanent, outside mounted luggage and other racks prior to shipment. Vehicles must be tendered to the Carrier in good running condition (unless otherwise noted) with no more than a half tank of fuel (preferably 1/4 tank). Any part of the vehicle that falls off during transport is the Customer's responsibility including damages caused by said part to any vehicle(s) and/or person involved.`,
  `5. The Customer must disarm any alarm system installed in the vehicle or provide proper instructions for this matter. In the event said alarm sounds and there are no keys or instructions to turn it off, Carrier may silence the alarm by any means.`,
  `6. Luggage and personal property must be confined to one suitcase OR one bag in the trunk only, with no heavy articles, and is not to exceed 100 lbs. Carrier and BOND AUTO TRANSPORT are not liable for personal items left in the vehicle, nor for damage to vehicle caused by excessive or improper loading of personal items. No personal property shall be transported in customer’s vehicle(s) that includes, but is not limited to, Explosives, Guns, Ammunition, Flammable Products, Narcotics, Negotiable and Legal Papers, Alcoholic Beverages, Jewelry, Furs, Money, Live Pets, Live Plants or any unlawful contraband. Customer agrees that BOND AUTO TRANSPORT/Carrier may confiscate or dispose of said items with no remuneration. BOND AUTO TRANSPORT/Carrier will not be held responsible for delivery of personal property. If the Customer wishes to put items in the vehicle, he does so at his own risk.`,
  `7. International and Ocean Transport Orders: the car must be completely empty except for factory installed equipment. Indicate the VIN number and give the car's approximate value in U.S. dollars. The Customer is responsible for the proper customs paperwork. (Ask the assigned Carrier for help with these documents.) Any order placed on our website that has a pickup and/or delivery location, such as a port, will be subject to an additional charge of $100.`,
  `8. If the vehicle is inoperable or oversized (dual or oversized wheels, extra-large, racks, lifted, limo, etc.) the Customer must inquire as to the extra charges. If BOND AUTO TRANSPORT is not advised of inoperable or oversized/modified vehicles prior to pick up, all extra charges must be paid in cash or money order to the Carrier upon delivery.`,
  `9. The Customer agrees that BOND AUTO TRANSPORT has the right to reject or cancel any order for any reason at any time.`,
  `10. At the time of pickup, Customer and Carrier will carefully inspect the vehicle for pre-existing damage (exterior only) by completing a vehicle inspection report recorded on the Bill of Lading. Carrier and Customer will both acknowledge the condition of the vehicle and Customer will sign and receive a copy of the Bill of Lading. At the time of delivery, The Customer will carefully inspect the vehicle in the presence of the Carrier for possible damages incurred during transit. The Carrier and the Customer will both acknowledge the condition of the vehicle and the Customer will sign and receive a final copy of the Bill of Lading. Damage must be noted in the proper place on the Bill of Lading and signed by the Customer regardless of the weather conditions, time of day or day of week. Signing the Bill of Lading and inspection report without notation of any damage verifies that Customer has received his vehicle(s) in satisfactory condition, and that BOND AUTO TRANSPORT/Carrier and their agents are relieved of any further responsibility. Carrier damage claims are covered by a minimum of $750,000 public liability and property damage. All claims must be submitted in writing within 24 hours of delivery. BOND AUTO TRANSPORT will share the Carrier insurance policy details upon request. Customer agrees that BOND AUTO TRANSPORT is not liable for any property damage claims to Customer’s vehicle and that his, her or its sole remedy is against the Carrier. Customer agrees and understands that BOND AUTO TRANSPORT is a registered transportation and property broker and is acting solely in the capacity of a broker. BOND AUTO TRANSPORT will act as an agent for Customer in arranging for the transportation, however, BOND AUTO TRANSPORT does not itself provide transportation or assume carrier or insurance obligations. Customer allows BOND AUTO TRANSPORT to contract with other licensed and insured Motor Carrier(s), (hereinafter referred to as "Carrier"), to transport the vehicle(s) described in the shipping order. BOND AUTO TRANSPORT and Carrier reserve the right to use multiple modes of transportation, including but not limited to truck, rail and ship. All ocean shipments are subject to the terms and conditions of the Oceanic Transporter. The oceanic transporter assumes limited liability for damages and Customer is hereby advised to inquire with the Carrier about purchasing additional insurance prior shipping. Customer further agrees and understands that BOND AUTO TRANSPORT’s sole responsibility in the transaction between the customer and BOND AUTO TRANSPORT is to procure a carrier for shipment of the customer’s property. Customer understands that BOND AUTO TRANSPORT never takes possession of, transports, or delivers the Customer’s property. Customer agrees and understands that all claims for damage to property arising out or occurring during the taking possession of, transporting, or delivery of Customer’s property falls under the Carmack Amendment, if the transport is interstate. As outlined in Section 10761 of the Interstate Commerce Act (49 USC 10761) the payment of freight charges may not be postponed due to alleged loss or damage. These charges should be paid in full and the portion applicable to the lost or damaged item should be included in the freight claim. The following items are important to remember: • Claims and payment of freight charges are two entirely different transactions. • ICC regulations prohibit withholding the payment of freight bills due to a pending claim. (Administrative Ruling No. 128) • Without payment of the freight charges, payment for transportation has not been made. A valid claim will not be paid until freight charges are made.`,
  `11. The Carrier accepts responsibility for the vehicle after pre-inspection is done and Bill of Lading is signed by the Customer. Carrier responsibility will end when the vehicle is delivered and Customer signs final Bill of Lading inspection.`,
  `12. BOND AUTO TRANSPORT/Carrier will not be responsible for damage caused by acts of God, hail or storm damage, or damage resulting from worn/broken parts of vehicle or added personal items.`,
  `13. The Customer shall, in their absence, designate a person to act as their agent at the point of pickup and/or delivery if for any reason they are unavailable. Customer understands and accepts that all terms and conditions remain applicable when designating such an agent.`,
  `14. Customer warrants that he/she will pay the full transportation price due to BOND AUTO TRANSPORT/Carrier in full and will not try to offset any dispute for damage claims and/or delays etc. from freight (transport) charges. It is the Customer’s responsibility to provide payment when Carrier arrives- unless the balance has been pre-paid in full. All payments to Carrier on orders booked as “Discounted Cash Price” must be in the form of cash, cashier’s check or money order - no exceptions. Certified funds must be made payable to the delivering Carrier and not to BOND AUTO TRANSPORT Personal checks, debit or credit cards for orders booked as “Discounted Cash Price” will NOT be accepted for the remaining balance - no exceptions. Customer agrees that if the payment cannot be made by these methods, the vehicle will be stored, at Customer’s expense, until Customer pays in full all transport charges. Should the Customer be unable to accept delivery for any reason, the vehicle will be placed in storage. Any and all storage and redelivery charges will be the responsibility of the Customer. 15. This Agreement shall be construed in accordance with the laws of the State of Illinois. 16. The parties here agree that all actions or proceedings arising in connection to this agreement shall be tried and litigated exclusively in the State or Federal (if permitted by law and a party elects to file an action in federal court) courts located in San Diego County, in the state of California. This choice of venue is intended by the parties to be mandatory and not permissive in nature, and to preclude the possibility of litigation between the parties with respect to, or arising out of, this Agreement in any jurisdiction other than that specified in this section. Each party waives any right it may have to assert the doctrine of forum non-convenience or similar doctrine or to object to venue with respect to any proceeding brought in accordance with this section. By action of this provision, the parties agree to submit to the personal jurisdiction of the aforementioned court. 17. Customer shall defend, indemnify, and hold harmless BOND AUTO TRANSPORT from any and all actual or alleged claims, demands, causes of action, liability, loss, damage and/or injury (to property or persons, including without limitation wrongful death), whether brought by an individual or other entity, imposed by a court of law or by administrative action of any federal state or local agency, arising out of or incident to any acts, omissions, negligence, or willful misconduct of BOND AUTO TRANSPORT, or the Carrier, its personnel, employees, agents, or contractors in connection with or arising out of BOND AUTO TRANSPORT or the Carrier’s actions. The indemnification includes, without limitation, the payment of all penalties, fines, judgments, awards, attorney’s fees, and related costs or expenses, and any reimbursements to BOND AUTO TRANSPORT for all legal expenses and costs incurred by it. 18. Neither party may assign, directly or indirectly, all or part of its rights or obligations under this Agreement without the prior written consent of the other party, whose consent shall not be unreasonably withheld or delayed. 19. Invalidity or unenforceability of one or more of the provisions in this Agreement shall not affect any other provisions of this Agreement. 20. This agreement and any shipment hereunder are subject to all terms and conditions of Carrier’s tariff and the uniform straight Bill of Lading, copies of which are available at the office of Carrier. This supersedes all prior written or oral representation of BOND AUTO TRANSPORT and constitutes the entire agreement between Customer and BOND AUTO TRANSPORT and may not be changed except in writing signed by an officer of BOND AUTO TRANSPORT. Customer warrants that he, she or it has read this agreement in its entirety and by continuing with the transaction, fully understands and agrees to its terms. Further, Customer waives any claims or defenses based in whole or in part on not reading, knowing, or understanding these terms and conditions and agrees to indemnify and hold harmless BOND AUTO TRANSPORT for any fees or costs, including attorney’s fees and costs, arising out of any claims or defenses asserted based upon not reading, having knowledge of, or understanding these terms and conditions.`,
];

const money = (value: number | null) => (value === null ? "—" : `$${value.toLocaleString("en-US", { minimumFractionDigits: 2 })}`);
const dateOnly = (value: number | null) =>
  value === null
    ? "—"
    : new Date(value).toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "numeric", timeZone: "UTC" });
const text = (value: string | null | undefined) => (value && value.trim() ? value.trim() : "—");

export interface ContractUnit {
  position: number;
  vehicle_year: string | null;
  vehicle_make: string | null;
  vehicle_model: string | null;
  vin: string | null;
  vehicle_type: string | null;
  condition: string | null;
  price: number | null;
}

export interface ContractOrder {
  number: string;
  customer_name: string;
  customer_phone: string;
  customer_email: string;
  carrier_name: string | null;
  carrier_company_phone: string | null;
  carrier_email: string | null;
  driver_name: string | null;
  carrier_phone: string | null;
  transport_type: string;
  condition: string;
  vehicle_year: string | null;
  vehicle_make: string | null;
  vehicle_model: string | null;
  vin: string | null;
  pickup_eta: number | null;
  delivery_eta: number | null;
  ready_date: string | null;
  origin_street: string | null;
  origin_city: string | null;
  origin_state: string | null;
  origin_zip: string;
  origin_contact: string | null;
  origin_phone: string | null;
  dest_street: string | null;
  dest_city: string | null;
  dest_state: string | null;
  dest_zip: string;
  dest_contact: string | null;
  dest_phone: string | null;
  price: number;
  final_quote: number | null;
  broker_fee: number | null;
  carrier_fee: number | null;
  client_invoice_amount: number | null;
  payment_method: string | null;
}

const CONDITION_LABEL: Record<string, string> = {
  running: "operable",
  inoperable_steer_roll: "inoperable (steers and rolls)",
  inoperable_no_steer: "inoperable (no steer / no roll)",
};

function addressLine(street: string | null, city: string | null, state: string | null, zip: string): string {
  return [street, city, state, zip].filter((part) => part && part.trim()).join(", ");
}

/** Orders created before order_units existed still carry one vehicle on the order. */
function orderAsUnit(order: ContractOrder): ContractUnit {
  return {
    position: 1,
    vehicle_year: order.vehicle_year,
    vehicle_make: order.vehicle_make,
    vehicle_model: order.vehicle_model,
    vin: order.vin,
    vehicle_type: order.transport_type,
    condition: order.condition,
    price: order.price,
  };
}

/** Printable Transportation Agreement filled from an order. */
export function contractDocument(order: ContractOrder, units: ContractUnit[]): string {
  const clientAmount = order.client_invoice_amount ?? order.final_quote ?? order.price;
  const carrierAmount = order.carrier_fee;
  const rows = units.length ? units : [orderAsUnit(order)];

  const scheduleRow = (label: string, cells: string[]) =>
    `<tr><th>${label}</th>${cells.map((cell) => `<td>${cell}</td>`).join("")}</tr>`;

  const unitColumns = rows.map((unit) => unit.position);
  const vehicleRows = rows
    .map(
      (unit) =>
        `<tr><td>${unit.position}</td><td>${text(unit.vehicle_year)}</td><td>${text(unit.vehicle_make)}</td><td>${text(unit.vehicle_model)}</td><td>${text(unit.vin)}</td><td>${text(unit.vehicle_type ?? "—")}</td><td>${CONDITION_LABEL[unit.condition ?? "running"] ?? text(unit.condition)}</td></tr>`,
    )
    .join("");

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Transportation Agreement ${text(order.number)}</title>
<style>
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body { margin: 0; padding: 28px 32px 40px; font: 12px/1.45 "Helvetica Neue", Arial, sans-serif; color: #10161c; background: #fff; }
  h1 { font-size: 20px; margin: 0 0 4px; letter-spacing: -0.01em; }
  .doc-id { color: #5b7186; font-size: 11px; margin: 0 0 16px; }
  table { width: 100%; border-collapse: collapse; }
  th, td { border: 1px solid #c9d4de; padding: 5px 7px; vertical-align: top; text-align: left; font-weight: 400; }
  th { background: #f2f6f9; font-weight: 600; }
  .parties { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 14px; }
  .party { border: 1px solid #c9d4de; border-radius: 4px; padding: 8px 10px; }
  .party h2 { font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em; color: #5b7186; margin: 0 0 4px; }
  .party p { margin: 0; }
  .party strong { display: block; font-size: 12.5px; }
  h2.section { font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; color: #5b7186; margin: 18px 0 6px; }
  .terms p { margin: 0 0 8px; text-align: justify; font-size: 10.5px; line-height: 1.4; }
  .sign { margin-top: 22px; display: grid; grid-template-columns: 1fr 1fr; gap: 30px; }
  .sign div { border-top: 1px solid #10161c; padding-top: 5px; font-size: 11px; }
  .muted { color: #5b7186; }
  @media print {
    body { padding: 0; }
    .terms p { font-size: 9.5pt; }
    h2.section { break-after: avoid; }
  }
</style>
</head>
<body>
  <h1>Transportation Agreement</h1>
  <p class="doc-id">Order ${text(order.number)} · MGV Advisors LLC DBA Bond Auto Transport · USDOT # 4250470</p>

  <div class="parties">
    <div class="party">
      <h2>Transport company</h2>
      <strong>MGV Advisors LLC DBA Bond Auto Transport</strong>
      <p>(858) 699-4828 · operations@bondautotransport.com</p>
    </div>
    <div class="party">
      <h2>Customer</h2>
      <strong>${text(order.customer_name)}</strong>
      <p>${text(order.customer_phone)} · ${text(order.customer_email)}</p>
    </div>
    <div class="party">
      <h2>Carrier company</h2>
      <strong>${text(order.carrier_name)}</strong>
      <p>${text(order.carrier_company_phone)} · ${text(order.carrier_email)}</p>
    </div>
    <div class="party">
      <h2>Driver</h2>
      <strong>${text(order.driver_name)}</strong>
      <p>${text(order.carrier_phone)}</p>
    </div>
  </div>

  <h2 class="section">Order information schedule / payment</h2>
  <table>
    <tr><th>Unit #</th>${unitColumns.map((n) => `<td>${n}</td>`).join("")}</tr>
    ${scheduleRow("Pick up ETA", unitColumns.map(() => dateOnly(order.pickup_eta)))}
    ${scheduleRow("Delivery ETA", unitColumns.map(() => dateOnly(order.delivery_eta)))}
    ${scheduleRow(
      "Amount",
      rows.map((unit, index) => money(index === 0 ? clientAmount : unit.price)),
    )}
    ${scheduleRow("Payment method", unitColumns.map(() => text(order.payment_method)))}
    ${scheduleRow("Payee", unitColumns.map(() => "MGV Advisors LLC"))}
    ${scheduleRow("Carrier payment", unitColumns.map(() => `${money(carrierAmount)} to the driver`))}
    ${scheduleRow("Trailer type", unitColumns.map(() => text(order.transport_type)))}
  </table>

  <h2 class="section">Origin / destination</h2>
  <table>
    <tr><th>Origin</th><td>
      <strong>${text(addressLine(order.origin_street, order.origin_city, order.origin_state, order.origin_zip))}</strong><br>
      Contact: ${text(order.origin_contact)} · ${text(order.origin_phone)}
    </td></tr>
    <tr><th>Destination</th><td>
      <strong>${text(addressLine(order.dest_street, order.dest_city, order.dest_state, order.dest_zip))}</strong><br>
      Contact: ${text(order.dest_contact)} · ${text(order.dest_phone)}
    </td></tr>
  </table>

  <h2 class="section">Vehicle information</h2>
  <table>
    <thead><tr><th>Unit #</th><th>Year</th><th>Make</th><th>Model</th><th>VIN</th><th>Type</th><th>Condition</th></tr></thead>
    <tbody>${vehicleRows}</tbody>
  </table>

  <h2 class="section">Terms and condition</h2>
  <div class="terms">${CONTRACT_TERMS.map((paragraph) => `<p>${paragraph}</p>`).join("")}</div>

  <div class="sign">
    <div>Maxim Golovatiuc, President — BOND AUTO TRANSPORT</div>
    <div>${text(order.customer_name)} — Customer</div>
  </div>
</body>
</html>`;
}

/** Same contract as a Word document, laid out like the signed template. */
export function contractDocx(order: ContractOrder, units: ContractUnit[]): Uint8Array {
  const clientAmount = order.client_invoice_amount ?? order.final_quote ?? order.price;
  const rows = units.length ? units : [orderAsUnit(order)];
  const first = rows[0];

  // Measurements taken from the HTML: body 12px, headings 11px grey, terms 10.5px.
  const BODY = 24;
  const HEAD = 22;
  const GREY = "5B7186";
  const BORDER = "C9D4DE";

  const party = (label: string, name: string, contact: string): string[] => [
    paragraph(label.toUpperCase(), { bold: true, size: HEAD, color: GREY, spacing: 12 }),
    paragraph(name || "—", { bold: true, size: 25 }),
    paragraph(contact || "—", { size: BODY }),
  ];

  const section = (text: string) => ({
    kind: "raw" as const,
    xml: paragraph(text.toUpperCase(), { bold: true, size: HEAD, color: GREY, spacing: 16, spaceBefore: 260, spaceAfter: 80, keepNext: true }),
  });

  const infoRows: string[][] = [
    ["Unit #", String(rows.length > 1 ? `1 – ${rows.length}` : first?.position ?? 1)],
    ["Pick up ETA", dateOnly(order.pickup_eta)],
    ["Delivery ETA", dateOnly(order.delivery_eta)],
    ["Amount", money(clientAmount)],
    ["Payment method", text(order.payment_method)],
    ["Payee", "MGV Advisors LLC"],
    ["Carrier payment", `${money(order.carrier_fee)} to the driver`],
    ["Trailer type", text(order.transport_type)],
  ];

  return buildDocx([
    { kind: "raw", xml: paragraph("Transportation Agreement", { bold: true, size: 40, spaceAfter: 40 }) },
    {
      kind: "raw",
      xml: paragraph(`Order ${order.number} · MGV Advisors LLC DBA Bond Auto Transport · USDOT # 4250470`, {
        size: HEAD,
        color: GREY,
        spaceAfter: 240,
      }),
    },

    {
      kind: "richTable",
      borderColor: BORDER,
      widths: [50, 50],
      rows: [
        [
          party("Transport company", "MGV Advisors LLC DBA Bond Auto Transport", "(858) 699-4828 · operations@bondautotransport.com"),
          party("Customer", text(order.customer_name), `${text(order.customer_phone)} · ${text(order.customer_email)}`),
        ],
        [
          party("Carrier company", text(order.carrier_name), `${text(order.carrier_company_phone)} · ${text(order.carrier_email)}`),
          party("Driver", text(order.driver_name), text(order.carrier_phone)),
        ],
      ],
    },
    { kind: "raw", xml: paragraph("", { size: 12 }) },

    section("Order information schedule / payment"),
    {
      kind: "table",
      rows: infoRows,
      boldFirstColumn: true,
      shadedHeader: false,
      borderColor: BORDER,
      padY: 70,
      padX: 105,
      columnSizes: [BODY, BODY],
    },

    section("Origin / destination"),
    {
      kind: "richTable",
      borderColor: BORDER,
      widths: [22, 78],
      rows: [
        [
          [paragraph("Origin", { bold: true, size: BODY })],
          [
            paragraph(addressLine(order.origin_street, order.origin_city, order.origin_state, order.origin_zip), { bold: true, size: BODY }),
            paragraph(`Contact: ${text(order.origin_contact)} · ${text(order.origin_phone)}`, { size: BODY }),
          ],
        ],
        [
          [paragraph("Destination", { bold: true, size: BODY })],
          [
            paragraph(addressLine(order.dest_street, order.dest_city, order.dest_state, order.dest_zip), { bold: true, size: BODY }),
            paragraph(`Contact: ${text(order.dest_contact)} · ${text(order.dest_phone)}`, { size: BODY }),
          ],
        ],
      ],
    },

    section("Vehicle information"),
    {
      kind: "table",
      headerRow: true,
      shadedHeader: true,
      headerShade: "F2F6F9",
      borderColor: BORDER,
      padY: 70,
      padX: 105,
      rows: [
        ["Unit #", "Year", "Make", "Model", "VIN", "Type", "Condition"],
        ...rows.map((unit) => [
          String(unit.position),
          text(unit.vehicle_year),
          text(unit.vehicle_make),
          text(unit.vehicle_model),
          text(unit.vin),
          text(unit.vehicle_type),
          CONDITION_LABEL[unit.condition ?? "running"] ?? text(unit.condition),
        ]),
      ],
      columnSizes: [BODY, BODY, BODY, BODY, 18, BODY, BODY],
    },

    section("Terms and condition"),
    ...CONTRACT_TERMS.map((paragraphText) => ({ kind: "paragraph" as const, text: paragraphText, size: 21, align: "both" as const, spaceAfter: 120 })),

    {
      kind: "richTable",
      borderless: true,
      widths: [50, 50],
      rows: [
        [
          [paragraph("Maxim Golovatiuc, President — BOND AUTO TRANSPORT", { size: HEAD, spaceBefore: 420, ruleAbove: true })],
          [paragraph(`${text(order.customer_name)} — Customer`, { size: HEAD, spaceBefore: 420, ruleAbove: true })],
        ],
      ],
    },
  ]);
}
