import { google } from 'googleapis';

export const fetchNewInventoryRows = async (lastProcessedRow: number) => {
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_CLIENT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });

  const sheets = google.sheets({ version: 'v4', auth });
  const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID;
  
  // Start from the next row.
  const startRow = lastProcessedRow + 1;
  
  // EXPANDED RANGE: Fetch from Column A all the way to Column H
  const range = `DB!A${startRow}:H`;

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range,
  });

  const rows = response.data.values || [];
  
  return rows.map((row, index) => ({
    rowIndex: startRow + index,
    date: row[7] || '',         // Column H (Index 7)
    orderId: row[1] || '',      // Column B (Index 1)
    materialType: row[3] || '', // Column D (Index 3)
    category: row[4] || '',     // Column E (Index 4)
    color: row[5] || '',        // Column F (Index 5)
    quantity: row[6] || '',     // Column G (Index 6)
  }));
};