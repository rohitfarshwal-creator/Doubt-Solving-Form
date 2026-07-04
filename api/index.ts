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

// Server-side cache
let cachedInitData: any = null;
let lastFetchTime = 0;
const CACHE_DURATION_MS = 5 * 60 * 1000;

// Replicate Apps Script TitleCase function
const toTitleCase = (str: string) => {
  return str.toLowerCase().replace(/(?:^|\s)\w/g, match => match.toUpperCase());
};

// --- GET ROUTE (INITIALIZATION) ---
app.get(['/api/init', '/init', '/api/index'], async (req: Request, res: Response) => {
  try {
    if (cachedInitData && (Date.now() - lastFetchTime < CACHE_DURATION_MS)) {
        return res.json(cachedInitData);
    }

    const sheets = google.sheets({ version: 'v4', auth: getAuth() });
    const [teacherRes, dataRes] = await Promise.all([
      sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: 'Teacher List!A2:B' }),
      // CRITICAL FIX: Fetch all the way to column BG (59 columns)
      sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: 'Imported Data!A2:BG' }) 
    ]);

    const teacherRows = teacherRes.data.values || [];
    const studentRows = dataRes.data.values || [];

    const cohortsSet = new Set<string>();
    const teachersList: any[] = [];
    const studentsList: any[] = [];

    // Parse Teachers EXACTLY like Code.gs
    teacherRows.forEach(row => {
        const cohort = (row[0] || '').toString().trim();
        let teacher = (row[1] || '').toString().trim();
        
        if (cohort && teacher && cohort !== 'English Academy') {
            teacher = toTitleCase(teacher);
            cohortsSet.add(cohort);
            teachersList.push({ cohort, name: teacher });
        }
    });

    // Parse Students EXACTLY like Code.gs
    studentRows.forEach(row => {
        const cohort = (row[2] || '').toString().trim(); // Col C
        const branch = (row[3] || '').toString().trim(); // Col D
        const name = (row[6] || '').toString().trim(); // Col G
        const status = (row[55] || '').toString().trim().toLowerCase(); // Col BD
        const grade = (row[57] || '').toString().trim(); // Col BF
        const batch = (row[58] || '').toString().trim(); // Col BG
        const bUpper = batch.toUpperCase();

        if (cohort && batch && bUpper !== 'NA' && bUpper !== '#N/A' && cohort !== 'English Academy') {
            if (status !== 'inactive' && status !== 'discontinued' && name) {
                cohortsSet.add(cohort);
                studentsList.push({ name, cohort, branch, batch, grade });
            }
        }
    });

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
    
    // Extract metadata from the first student (exactly like Code.gs)
    const studentMeta = data.selectedStudentsData && data.selectedStudentsData.length > 0 ? data.selectedStudentsData[0] : {};
    const totalStudents = data.selectedStudentsData ? data.selectedStudentsData.length : 0;
    const finalBranch = data.branch || studentMeta.branch || '';
    
    // Exact 14-column layout from Code.gs
    const newRow = [
        new Date().toLocaleString('en-GB'), // 1. Timestamp
        data.cohort || '',                  // 2. Cohort
        finalBranch,                        // 3. Branch
        studentMeta.grade || '',            // 4. Grade
        data.batchesList || '',             // 5. Batches
        data.teacher || '',                 // 6. Teacher Name
        data.date || '',                    // 7. Date of Session
        data.sessionType || '',             // 8. Session Type
        data.subject || '',                 // 9. Subject
        data.studentsList || '',            // 10. Selected Students
        data.topic || '',                   // 11. Topic
        data.duration || '',                // 12. Class Duration
        data.notes || '',                   // 13. Additional Notes
        totalStudents                       // 14. Total Students
    ];

    await sheets.spreadsheets.values.append({
        spreadsheetId: SPREADSHEET_ID,
        range: 'Session Logs!A:N', // Expanded to N to fit 14 columns
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [newRow] },
    });
    res.json({ success: true, message: "Session logged" });
  } catch (e: any) { 
    res.status(500).json({ message: "Google API Error: " + e.message }); 
  }
});

export default app;