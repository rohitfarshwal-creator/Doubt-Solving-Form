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

// --- SERVER-SIDE CACHE FOR LIGHTNING FAST LOADING ---
let cachedInitData: any = null;
let lastFetchTime = 0;
const CACHE_DURATION_MS = 5 * 60 * 1000; // Caches data for 5 minutes

// --- GET ROUTE (INITIALIZATION) ---
app.get(['/api/init', '/init', '/api/index'], async (req: Request, res: Response) => {
  try {
    // Return cached data instantly if it is fresh
    if (cachedInitData && (Date.now() - lastFetchTime < CACHE_DURATION_MS)) {
        return res.json(cachedInitData);
    }

    const sheets = google.sheets({ version: 'v4', auth: getAuth() });
    const [teacherRes, dataRes] = await Promise.all([
      sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: 'Teacher List!A2:B' }),
      sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: 'Imported Data!A2:F' }) 
    ]);

    const teacherRows = teacherRes.data.values || [];
    const studentRows = dataRes.data.values || [];

    const cohortsSet = new Set<string>();
    const teachersList: any[] = [];
    const studentsList: any[] = [];

    // Parse Teachers (Trim spaces and exclude English Academy)
    teacherRows.forEach(row => {
        const cohort = (row[0] || '').trim();
        const teacher = (row[1] || '').trim();
        
        if (cohort && teacher && cohort !== 'English Academy') {
            cohortsSet.add(cohort);
            teachersList.push({ cohort, name: teacher });
        }
    });

    // Parse Students (Trim spaces and exclude English Academy)
    studentRows.forEach(row => {
        const name = (row[1] || '').trim();
        const cohort = (row[2] || '').trim();
        const branch = (row[3] || '').trim();
        const batch = (row[4] || '').trim();
        const grade = (row[5] || '').trim();

        if (name && batch && cohort !== 'English Academy') {
            cohortsSet.add(cohort);
            studentsList.push({ name, cohort, branch, batch, grade });
        }
    });

    // Save to Cache
    cachedInitData = {
        cohorts: Array.from(cohortsSet).sort(),
        teachers: teachersList,
        students: studentsList
    };
    lastFetchTime = Date.now();

    res.json(cachedInitData);
  } catch (e: any) { 
    res.status(500).json({ message: "Google API Error: " + e.message }); 
  }
});

// --- POST ROUTE (SAVE SESSION) ---
app.post(['/api/session', '/session', '/api/index'], async (req: Request, res: Response) => {
  try {
    const sheets = google.sheets({ version: 'v4', auth: getAuth() });
    const data = req.body;
    
    // Formatted exactly like the original Web App logic
    const newRow = [
        new Date().toLocaleString('en-GB'),
        data.date || '', 
        data.cohort || '', 
        data.branch || '',
        data.teacher || '', 
        data.sessionType || '', 
        data.batchesList || '',
        data.subject || '', 
        data.topic || '', 
        data.duration || '',
        data.studentsList || '', 
        data.notes || ''
    ];

    await sheets.spreadsheets.values.append({
        spreadsheetId: SPREADSHEET_ID,
        range: 'Session Logs!A:L', 
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [newRow] },
    });
    res.json({ success: true, message: "Session logged" });
  } catch (e: any) { 
    res.status(500).json({ message: "Google API Error: " + e.message }); 
  }
});

export default app;