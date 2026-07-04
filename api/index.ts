import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { google } from 'googleapis';

dotenv.config();
const app = express();

// Standard CORS and JSON parsing setup
app.use(cors({ origin: '*' }));
app.use(express.json());

// Google Auth Helper
const getAuth = () => {
  const rawKey = process.env.GOOGLE_PRIVATE_KEY || '';
  // Ensures line breaks in the Vercel environment variable are parsed correctly
  const privateKey = rawKey.includes('\\n') ? rawKey.replace(/\\n/g, '\n') : rawKey;

  return new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: privateKey,
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
};

const SPREADSHEET_ID = process.env.GOOGLE_SHEET_ID;

// GET Route: Initialization
app.get(['/api/init', '/init', '/api/index'], async (req: Request, res: Response) => {
  try {
    const sheets = google.sheets({ version: 'v4', auth: getAuth() });
    await Promise.all([
      sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: 'Teacher List!A2:B' }),
      sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: 'Imported Data!A2:BG' })
    ]);
    
    res.json({ success: true, message: "Backend connected" });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// POST Route: Logging a session
app.post(['/api/session', '/session', '/api/index'], async (req: Request, res: Response) => {
  try {
    const sheets = google.sheets({ version: 'v4', auth: getAuth() });
    const data = req.body;

    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Session Logs!A:L',
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [[
          new Date().toLocaleString('en-GB'),
          data.date || '', data.cohort || '', data.branch || '',
          data.teacher || '', data.sessionType || '', data.batchesList || '',
          data.subject || '', data.topic || '', data.duration || '',
          data.studentsList || '', data.notes || ''
        ]],
      },
    });
    
    res.json({ success: true, message: "Session logged" });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// CRITICAL: Export the app for Vercel Serverless Functions. Do NOT use app.listen().
export default app;