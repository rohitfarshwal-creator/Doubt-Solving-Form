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
      sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: 'Imported Data!A2:BG' }) 
    ]);

    const teacherRows = teacherRes.data.values || [];
    const studentRows = dataRes.data.values || [];

    const cohortsSet = new Set<string>();
    const teachersList: any[] = [];
    const studentsList: any[] = [];

    teacherRows.forEach(row => {
        const cohort = (row[0] || '').toString().trim();
        let teacher = (row[1] || '').toString().trim();
        if (cohort && teacher && cohort !== 'English Academy') {
            teacher = toTitleCase(teacher);
            cohortsSet.add(cohort);
            teachersList.push({ cohort, name: teacher });
        }
    });

    studentRows.forEach(row => {
        const cohort = (row[2] || '').toString().trim(); 
        const branch = (row[3] || '').toString().trim(); 
        const name = (row[6] || '').toString().trim(); 
        const status = (row[55] || '').toString().trim().toLowerCase(); 
        const grade = (row[57] || '').toString().trim(); 
        const batch = (row[58] || '').toString().trim(); 
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

// --- POST ROUTE (EXTRA CLASS SESSION) ---
app.post(['/api/session', '/session'], async (req: Request, res: Response) => {
  try {
    const sheets = google.sheets({ version: 'v4', auth: getAuth() });
    const data = req.body;
    
    const studentMeta = data.selectedStudentsData && data.selectedStudentsData.length > 0 ? data.selectedStudentsData[0] : {};
    const totalStudents = data.selectedStudentsData ? data.selectedStudentsData.length : 0;
    const finalBranch = data.branch || studentMeta.branch || '';
    
    const newRow = [
        new Date().toLocaleString('en-GB'), 
        data.cohort || '',                  
        finalBranch,                        
        studentMeta.grade || '',            
        data.batchesList || '',             
        data.teacher || '',                 
        data.date || '',                    
        data.sessionType || '',             
        data.subject || '',                 
        data.studentsList || '',            
        data.topic || '',                   
        data.duration || '',                
        data.notes || '',                   
        totalStudents                       
    ];

    await sheets.spreadsheets.values.append({
        spreadsheetId: SPREADSHEET_ID,
        range: 'Session Logs!A:N', 
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [newRow] },
    });
    res.json({ success: true, message: "Session logged" });
  } catch (e: any) { 
    res.status(500).json({ message: "Google API Error: " + e.message }); 
  }
});

// --- POST ROUTE (DPP FORM) ---
app.post(['/api/dpp', '/dpp'], async (req: Request, res: Response) => {
  try {
    const sheets = google.sheets({ version: 'v4', auth: getAuth() });
    const data = req.body;
    
    // Map the dynamic entries array into multiple Google Sheet rows
    const rowsToInsert = data.entries.map((entry: any) => [
        new Date().toLocaleString('en-GB'), // 1. Timestamp
        data.cohort || '',                  // 2. Cohort
        data.branch || '',                  // 3. Branch (Centre)
        data.teacher || '',                 // 4. Teacher
        data.batchesList || '',             // 5. Batches
        data.subject || '',                 // 6. Subject
        entry.date || '',                   // 7. Date of DPP
        entry.topic || '',                  // 8. Home Work Topic
        entry.notes || '',                  // 9. Additional Notes
        entry.attachment || ''              // 10. Attachment Link
    ]);

    await sheets.spreadsheets.values.append({
        spreadsheetId: SPREADSHEET_ID,
        range: 'DPP Responses!A:J', 
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: rowsToInsert },
    });
    res.json({ success: true, message: `Successfully logged ${rowsToInsert.length} DPP entrie(s)!` });
  } catch (e: any) { 
    res.status(500).json({ message: "Google API Error: " + e.message }); 
  }
});

export default app;