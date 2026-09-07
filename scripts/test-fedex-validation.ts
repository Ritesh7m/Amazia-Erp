import { parseFedexCsv } from '../services/fedexParser';
import { isScientificNotation } from '../utils/validation';
import { normalizeAwb } from '../utils/normalization';

async function runTests() {
  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string) {
    if (condition) {
      console.log(`[PASS] ${testName}`);
      passed++;
    } else {
      console.error(`[FAIL] ${testName}`);
      failed++;
    }
  }

  console.log('=== Running isScientificNotation Unit Tests ===');
  assert(isScientificNotation('8.70E+11') === true, 'Detects 8.70E+11');
  assert(isScientificNotation('8.70e+11') === true, 'Detects 8.70e+11');
  assert(isScientificNotation('8.70123456789E+11') === true, 'Detects 8.70123456789E+11');
  assert(isScientificNotation('8.7E11') === true, 'Detects 8.7E11');
  assert(isScientificNotation('8.7e11') === true, 'Detects 8.7e11');
  assert(isScientificNotation(' 8.70E+11 ') === true, 'Detects whitespace padded scientific notation');
  assert(isScientificNotation('"8.70E+11"') === true, 'Detects quoted scientific notation');
  assert(isScientificNotation('871000000000') === false, 'Does not reject valid AWB 871000000000');
  assert(isScientificNotation('873548507840') === false, 'Does not reject valid AWB 873548507840');
  assert(isScientificNotation('874910444981') === false, 'Does not reject valid AWB 874910444981');
  assert(isScientificNotation(' 873548507840 ') === false, 'Does not reject whitespace padded valid AWB');

  console.log('\n=== Running CSV Parser & Validation Tests from plan.md ===');

  // Helper to build CSV buffer
  const buildCsv = (rows: Array<Record<string, string>>) => {
    if (rows.length === 0) return Buffer.from('');
    const headers = Object.keys(rows[0]);
    const headerLine = headers.join(',');
    const dataLines = rows.map(r => headers.map(h => `"${r[h] ?? ''}"`).join(','));
    return Buffer.from([headerLine, ...dataLines].join('\n'));
  };

  // TEST 1 — Valid AWB: 871000000000 -> ACCEPT
  try {
    const csv1 = buildCsv([{
      'Invoice Type': 'Duty',
      'Invoice Date': '01-Apr-26',
      'Due Date': '15-Apr-26',
      'Air Waybill Number': '871000000000',
      'Air Waybill Total Amount': '1500.00',
      'Shipper Reference 1': 'ORDER-101',
      'Recipient Address Country/Territory': 'US'
    }]);
    const res1 = await parseFedexCsv(csv1);
    assert(res1.length === 1 && res1[0].awb_number === '871000000000', 'TEST 1: Valid AWB 871000000000 accepted');
  } catch (err: any) {
    assert(false, `TEST 1 Failed with error: ${err.message}`);
  }

  // TEST 2 — Valid AWB: 873548507840 -> ACCEPT
  try {
    const csv2 = buildCsv([{
      'Invoice Type': 'Duty',
      'Invoice Date': '01-Apr-26',
      'Due Date': '15-Apr-26',
      'Air Waybill Number': '873548507840',
      'Air Waybill Total Amount': '1250.00',
      'Shipper Reference 1': 'ORDER-102',
      'Recipient Address Country/Territory': 'GB'
    }]);
    const res2 = await parseFedexCsv(csv2);
    assert(res2.length === 1 && res2[0].awb_number === '873548507840', 'TEST 2: Valid AWB 873548507840 accepted');
  } catch (err: any) {
    assert(false, `TEST 2 Failed with error: ${err.message}`);
  }

  // TEST 3 — Scientific notation: 8.70E+11 -> REJECT ENTIRE CSV
  try {
    const csv3 = buildCsv([{
      'Invoice Type': 'Duty',
      'Invoice Date': '01-Apr-26',
      'Due Date': '15-Apr-26',
      'Air Waybill Number': '8.70E+11',
      'Air Waybill Total Amount': '1500.00',
      'Shipper Reference 1': 'ORDER-103',
      'Recipient Address Country/Territory': 'US'
    }]);
    await parseFedexCsv(csv3);
    assert(false, 'TEST 3: Should have rejected 8.70E+11 but accepted');
  } catch (err: any) {
    assert(err.message.includes('scientific notation') && err.message.includes('Row 2'), 'TEST 3: Rejected 8.70E+11 with clear error');
  }

  // TEST 4 — Lowercase scientific notation: 8.70e+11 -> REJECT ENTIRE CSV
  try {
    const csv4 = buildCsv([{
      'Invoice Type': 'Duty',
      'Invoice Date': '01-Apr-26',
      'Due Date': '15-Apr-26',
      'Air Waybill Number': '8.70e+11',
      'Air Waybill Total Amount': '1500.00',
      'Shipper Reference 1': 'ORDER-104',
      'Recipient Address Country/Territory': 'US'
    }]);
    await parseFedexCsv(csv4);
    assert(false, 'TEST 4: Should have rejected 8.70e+11 but accepted');
  } catch (err: any) {
    assert(err.message.includes('scientific notation'), 'TEST 4: Rejected lowercase 8.70e+11');
  }

  // TEST 5 — Scientific notation without plus: 8.7E11 -> REJECT ENTIRE CSV
  try {
    const csv5 = buildCsv([{
      'Invoice Type': 'Duty',
      'Invoice Date': '01-Apr-26',
      'Due Date': '15-Apr-26',
      'Air Waybill Number': '8.7E11',
      'Air Waybill Total Amount': '1500.00',
      'Shipper Reference 1': 'ORDER-105',
      'Recipient Address Country/Territory': 'US'
    }]);
    await parseFedexCsv(csv5);
    assert(false, 'TEST 5: Should have rejected 8.7E11 but accepted');
  } catch (err: any) {
    assert(err.message.includes('scientific notation'), 'TEST 5: Rejected 8.7E11 without plus');
  }

  // TEST 6 — Whitespace around valid AWB: " 873548507840 " -> ACCEPT & normalize
  try {
    const csv6 = buildCsv([{
      'Invoice Type': 'Duty',
      'Invoice Date': '01-Apr-26',
      'Due Date': '15-Apr-26',
      'Air Waybill Number': ' 873548507840 ',
      'Air Waybill Total Amount': '1500.00',
      'Shipper Reference 1': 'ORDER-106',
      'Recipient Address Country/Territory': 'US'
    }]);
    const res6 = await parseFedexCsv(csv6);
    assert(res6.length === 1 && res6[0].awb_number === '873548507840', 'TEST 6: Padded AWB normalized to exact text 873548507840');
  } catch (err: any) {
    assert(false, `TEST 6 Failed with error: ${err.message}`);
  }

  // TEST 7 — Mixed CSV: 500 valid AWBs + 1 scientific notation AWB -> REJECT ENTIRE FILE
  try {
    const rows = [];
    for (let i = 1; i <= 500; i++) {
      rows.push({
        'Invoice Type': 'Duty',
        'Invoice Date': '01-Apr-26',
        'Due Date': '15-Apr-26',
        'Air Waybill Number': `8710000000${String(i).padStart(2, '0')}`,
        'Air Waybill Total Amount': '100.00',
        'Shipper Reference 1': `ORDER-${i}`,
        'Recipient Address Country/Territory': 'US'
      });
    }
    // Add 1 invalid row at index 25 (Row 27 in CSV including header)
    rows.splice(25, 0, {
      'Invoice Type': 'Duty',
      'Invoice Date': '01-Apr-26',
      'Due Date': '15-Apr-26',
      'Air Waybill Number': '8.70E+11',
      'Air Waybill Total Amount': '100.00',
      'Shipper Reference 1': 'ORDER-ERR',
      'Recipient Address Country/Territory': 'US'
    });

    const csv7 = buildCsv(rows);
    await parseFedexCsv(csv7);
    assert(false, 'TEST 7: Should have rejected mixed CSV but accepted');
  } catch (err: any) {
    assert(err.message.includes('Row 27') && err.message.includes('8.70E+11'), 'TEST 7: Mixed 501 rows rejected at Row 27 completely');
  }

  // TEST 8 — Missing "Air Waybill Number" column -> REJECT
  try {
    const csv8 = buildCsv([{
      'Invoice Type': 'Duty',
      'Invoice Date': '01-Apr-26',
      'Due Date': '15-Apr-26',
      'Some Other Column': '12345',
      'Air Waybill Total Amount': '1500.00'
    }]);
    await parseFedexCsv(csv8);
    assert(false, 'TEST 8: Should have rejected missing AWB column but accepted');
  } catch (err: any) {
    assert(err.message.includes("Missing required column 'Air Waybill Number'"), 'TEST 8: Rejected missing Air Waybill Number column');
  }

  console.log(`\n=== Test Results: ${passed} passed, ${failed} failed ===`);
  if (failed > 0) process.exit(1);
}

runTests().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
