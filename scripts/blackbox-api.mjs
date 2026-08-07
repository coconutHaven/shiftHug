/**
 * Black-box API tests — exercises HTTP endpoints only (no internal imports).
 * Run with: node scripts/blackbox-api.mjs
 * Requires API on BASE_URL (default http://localhost:3001).
 */

const BASE = process.env.API_BASE ?? 'http://localhost:3001/api';

let passed = 0;
let failed = 0;
const failures = [];

function assert(condition, message) {
  if (condition) {
    passed += 1;
    console.log(`  ✓ ${message}`);
  } else {
    failed += 1;
    failures.push(message);
    console.log(`  ✗ ${message}`);
  }
}

async function api(method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: body != null ? { 'Content-Type': 'application/json' } : undefined,
    body: body != null ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }
  return { status: res.status, ok: res.ok, data };
}

/** Mirror frontend calculateShift logic for test payloads. */
function buildShift(overrides = {}) {
  const shift = {
    shift_date: '1/6',
    day_name: 'Mon',
    hours: 3,
    hourly_rate: 50,
    rate_name: 'Saturday',
    reference_number: '04_104_0125_6_3',
    km: 10,
    km_rate: 0.95,
    expenses: [{ name: 'Parking', amount: 5 }],
    expenses_total: 0,
    shift_total: 0,
    invoice_hours: 0,
    invoice_rate: 0,
    invoice_amount: 0,
    sort_order: 0,
    ...overrides,
  };
  const hoursAmount = shift.hours * shift.hourly_rate;
  const kmAmount = shift.km * shift.km_rate;
  const expensesTotal = shift.expenses.reduce((s, e) => s + e.amount, 0);
  const shiftTotal = Math.round((hoursAmount + kmAmount + expensesTotal) * 100) / 100;
  const invoiceRate = shift.hourly_rate;
  const divisor = invoiceRate > 0 ? invoiceRate : 1;
  const invoiceHours = Math.round((shiftTotal / divisor) * 100) / 100;
  const invoiceAmount = Math.round(invoiceHours * invoiceRate * 100) / 100;
  return {
    ...shift,
    expenses_total: expensesTotal,
    shift_total: shiftTotal,
    invoice_hours: invoiceHours,
    invoice_rate: invoiceRate,
    invoice_amount: invoiceAmount,
  };
}

async function main() {
  console.log(`\nBlack-box API tests → ${BASE}\n`);

  const cleanup = { clientId: null, invoiceId: null };

  try {
    // --- Settings ---
    console.log('Settings');
    const settings = await api('GET', '/settings');
    assert(settings.status === 200, 'GET /settings returns 200');

    // --- Clients ---
    console.log('\nClients');
    const clientsBefore = await api('GET', '/clients');
    assert(clientsBefore.status === 200 && Array.isArray(clientsBefore.data), 'GET /clients returns array');

    const clientRes = await api('POST', '/clients', {
      name: `BB-Test ${Date.now()}`,
      email: 'bb-test@example.com',
      hourly_rate: 44,
      km_rate: 0.95,
      ref_number: '04_104_0125_6_1',
    });
    assert(clientRes.status === 200 || clientRes.status === 201, 'POST /clients creates client');
    cleanup.clientId = clientRes.data?.id;
    assert(Boolean(cleanup.clientId), 'Created client has id');

    const nextNum = await api('GET', `/invoices/next-number/${cleanup.clientId}`);
    assert(nextNum.status === 200 && typeof nextNum.data?.next === 'number', 'GET next invoice number');

    // --- Invoice create (custom rate math) ---
    console.log('\nInvoices — create & calculations');
    const shift = buildShift();
    assert(shift.shift_total === 164.5, `shift_total is 164.5 (got ${shift.shift_total})`);
    assert(shift.invoice_rate === 50, 'invoice_rate uses shift hourly_rate');
    assert(shift.invoice_hours === 3.29, `invoice_hours is 3.29 (got ${shift.invoice_hours})`);
    assert(shift.invoice_amount === 164.5, `invoice_amount is 3.29 × 50 = 164.5 (got ${shift.invoice_amount})`);

    const createInv = await api('POST', '/invoices', {
      client_id: cleanup.clientId,
      invoice_date: '2026-06-01',
      invoice_number: 9999,
      shifts: [shift],
    });
    assert(createInv.status === 200 || createInv.status === 201, 'POST /invoices creates draft');
    cleanup.invoiceId = createInv.data?.id;
    assert(createInv.data?.invoice_number === 9999, 'Custom invoice_number persisted');
    assert(createInv.data?.total_amount === 164.5, `Invoice total_amount is 164.5 (got ${createInv.data?.total_amount})`);

    const list = await api('GET', '/invoices');
    const found = list.data?.find(i => i.id === cleanup.invoiceId);
    assert(Boolean(found), 'Created invoice appears in GET /invoices');
    const savedShift = found?.invoice_shifts?.[0];
    assert(savedShift?.hourly_rate === 50, 'Saved shift hourly_rate is 50');
    assert(savedShift?.invoice_rate === 50, 'Saved shift invoice_rate matches hourly_rate');
    assert(savedShift?.shift_total === 164.5, 'Saved shift_total is 164.5');
    assert(savedShift?.invoice_amount === 164.5, 'Saved invoice_amount matches hours × rate');

    // --- Draft update: change rate ---
    console.log('\nInvoices — draft update');
    const updatedShift = buildShift({ hourly_rate: 55, hours: 3 });
    assert(updatedShift.shift_total === 179.5, 'Updated shift_total at $55/hr is 179.5');
    assert(updatedShift.invoice_rate === 55, 'Invoice rate follows updated hourly_rate');
    assert(updatedShift.invoice_hours === 3.26, 'Invoice hours is 179.5 / 55 = 3.26');
    assert(updatedShift.invoice_amount === 179.3, 'Invoice amount is 3.26 × 55 = 179.30');

    const draftPut = await api('PUT', `/invoices/${cleanup.invoiceId}/draft`, {
      invoice_date: '2026-06-02',
      invoice_number: 8888,
      shifts: [{ ...updatedShift, sort_order: 0 }],
    });
    assert(draftPut.status === 200, 'PUT /invoices/:id/draft updates draft');
    assert(draftPut.data?.invoice_number === 8888, 'Draft update changes invoice_number');
    assert(draftPut.data?.total_amount === 179.3, 'Draft update recalculates total_amount');

    // --- Publish ---
    console.log('\nInvoices — publish');
    const publish = await api('PUT', `/invoices/${cleanup.invoiceId}/publish`);
    assert(publish.status === 200, 'PUT publish succeeds');
    const afterPub = await api('GET', '/invoices');
    const published = afterPub.data?.find(i => i.id === cleanup.invoiceId);
    assert(published?.status === 'published', 'Invoice status is published');

    const draftEdit = await api('PUT', `/invoices/${cleanup.invoiceId}/draft`, {
      invoice_date: '2026-06-03',
      shifts: [updatedShift],
    });
    assert(draftEdit.status === 400, 'Cannot edit published invoice via draft endpoint');

    // --- Error cases ---
    console.log('\nError handling');
    const badClient = await api('POST', '/invoices', { client_id: 'nope', invoice_date: '2026-01-01', shifts: [shift] });
    assert(badClient.status >= 400, 'Invalid client_id rejected');

    const badDraft = await api('PUT', `/invoices/${cleanup.invoiceId}/draft`, {
      invoice_date: '2026-06-03',
      shifts: [],
    });
    assert(badDraft.status === 400, 'Empty shifts rejected on draft update');
  } finally {
    console.log('\nCleanup');
    if (cleanup.clientId) {
      const delC = await api('DELETE', `/clients/${cleanup.clientId}`);
      assert(delC.status === 200, 'Delete test client (cascades invoices)');
    }
  }

  console.log(`\n${'─'.repeat(40)}`);
  console.log(`Results: ${passed} passed, ${failed} failed`);
  if (failures.length) {
    console.log('\nFailures:');
    failures.forEach(f => console.log(`  - ${f}`));
    process.exit(1);
  }
  console.log('All black-box tests passed.\n');
}

main().catch(err => {
  console.error('\nBlack-box run failed:', err.message);
  console.error('Is the API running? Try: npm run dev:server\n');
  process.exit(1);
});
