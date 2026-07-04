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

// --- GET ROUTE: RESTORED PARSING LOGIC ---
app.get(['/api/init', '/init', '/api/index'], async (req: Request, res: Response) => {
  try {
    const sheets = google.sheets({ version: 'v4', auth: getAuth() });
    const [teacherRes, dataRes] = await Promise.all([
      sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: 'Teacher List!A2:B' }),
      sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: 'Imported Data!A2:BG' })
    ]);

    const teacherRows = teacherRes.data.values || [];
    const studentRows = dataRes.data.values || [];

    const cohortsSet = new Set<string>();
    const cohortTeachers: Record<string, string[]> = {};
    const cohortBranches: Record<string, string[]> = {};
    const cohortBatches: Record<string, string[]> = {};
    const students: any[] = [];

    teacherRows.forEach(row => {
        const cohort = row[0] || 'Unknown Cohort';
        const teacher = row[1];
        cohortsSet.add(cohort);
        if (!cohortTeachers[cohort]) cohortTeachers[cohort] = [];
        if (teacher && !cohortTeachers[cohort].includes(teacher)) {
            cohortTeachers[cohort].push(teacher);
        }
    });

    studentRows.forEach(row => {
        const name = row[1];
        const cohort = row[2] || 'Unknown Cohort';
        const branch = row[3];
        const batch = row[4];
        const grade = row[5];

        if (name && batch) {
            cohortsSet.add(cohort);
            if (branch) {
                if (!cohortBranches[cohort]) cohortBranches[cohort] = [];
                if (!cohortBranches[cohort].includes(branch)) cohortBranches[cohort].push(branch);
            }
            if (batch) {
                if (!cohortBatches[cohort]) cohortBatches[cohort] = [];
                if (!cohortBatches[cohort].includes(batch)) cohortBatches[cohort].push(batch);
            }
            students.push({ name, cohort, branch, batch, grade });
        }
    });

    res.json({
        cohorts: Array.from(cohortsSet).sort(),
        cohortTeachers,
        cohortBranches,
        cohortBatches,
        students
    });

  } catch (e: any) { 
    console.error("Init Error:", e);
    // This will send the exact Google error to your frontend screen
    res.status(500).json({ message: "Google API Error: " + e.message }); 
  }
});

// --- POST ROUTE: SAVE SESSION ---
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
    console.error("Session Error:", e);
    res.status(500).json({ message: "Google API Error: " + e.message }); 
  }
});

export default app;