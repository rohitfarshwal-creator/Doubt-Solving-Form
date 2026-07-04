import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { google } from 'googleapis';

dotenv.config();
const app = express();
app.use(cors({ origin: '*' }));
app.use(express.json());

const getAuth = () => {
  const rawKey = process.env.GOOGLE_PRIVATE_KEY || '';
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

// --- GET ROUTE (Initialization Data) ---
app.get('/api/init', async (req: Request, res: Response) => {
  try {
    const sheets = google.sheets({ version: 'v4', auth: getAuth() });
    const [teacherRes, dataRes] = await Promise.all([
      sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: 'Teacher List!A2:B' }),
      sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: 'Imported Data!A2:BG' })
    ]);
    
    // NOTE: If you had custom logic here previously to format 'teacherRes' and 'dataRes' 
    // into the dropdown menus for your frontend, make sure to paste it back in!
    
    res.json({ success: true, message: "Backend is connected to Google Sheets!" });
  } catch (e: any) { 
    res.status(500).json({ error: e.message }); 
  }
});

// --- POST ROUTE (Save Session Data) ---
app.post('/api/session', async (req: Request, res: Response) => {
  try {
    const sheets = google.sheets({ version: 'v4', auth: getAuth() });
    const data = req.body;
    
    // Map the payload from your frontend form into a single Google Sheets row
    const newRow = [
        new Date().toLocaleString('en-GB'), // Column A: Timestamp
        data.date || '',                    // Column B: Date
        data.cohort || '',                  // Column C: Cohort
        data.branch || '',                  // Column D: Centre Name
        data.teacher || '',                 // Column E: Teacher
        data.sessionType || '',             // Column F: Session Type
        data.batchesList || '',             // Column G: Batches
        data.subject || '',                 // Column H: Subject
        data.topic || '',                   // Column I: Topic
        data.duration || '',                // Column J: Duration
        data.studentsList || '',            // Column K: Students
        data.notes || ''                    // Column L: Notes
    ];

    await sheets.spreadsheets.values.append({
        spreadsheetId: SPREADSHEET_ID,
        // IMPORTANT: Change 'Session Logs' to match the exact tab name in your Google Sheet!
        range: 'Session Logs!A:L', 
        valueInputOption: 'USER_ENTERED',
        requestBody: {
            values: [newRow],
        },
    });

    res.json({ success: true, message: "Session logged successfully!" });
  } catch (e: any) { 
    console.error("API Error:", e);
    res.status(500).json({ error: e.message }); 
  }
});

export default app;