import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { google } from 'googleapis';

dotenv.config();
const app = express();
app.use(cors({ origin: '*' }));
app.use(express.json());

const getAuth = () => {
  const privateKey = process.env.GOOGLE_PRIVATE_KEY 
    ? process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n') 
    : '';
    
  return new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: privateKey,
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
};

const SPREADSHEET_ID = process.env.GOOGLE_SHEET_ID;
const toTitleCase = (str: string) => str.toLowerCase().replace(/(?:^|\s)\w/g, m => m.toUpperCase());

app.get('/api/init', async (req: Request, res: Response) => {
  try {
    const sheets = google.sheets({ version: 'v4', auth: getAuth() });
    const [teacherRes, dataRes] = await Promise.all([
      sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: 'Teacher List!A2:B' }),
      sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: 'Imported Data!A2:BG' })
    ]);

    const cohortTeachers: Record<string, string[]> = {};
    const cohorts = new Set<string>();
    
    (teacherRes.data?.values || []).forEach(r => {
      const cohort = (r[0] || '').toString().trim();
      let teacher = (r[1] || '').toString().trim();
      if (cohort && teacher) {
        teacher = toTitleCase(teacher);
        cohorts.add(cohort);
        if (!cohortTeachers[cohort]) cohortTeachers[cohort] = [];
        cohortTeachers[cohort].push(teacher);
      }
    });

    const cohortBatches: Record<string, Set<string>> = {};
    const cohortBranches: Record<string, Set<string>> = {};
    const students: any[] = [];

    (dataRes.data?.values || []).forEach(row => {
      const cohort = (row[2] || '').toString().trim();
      const branch = (row[3] || '').toString().trim();
      const status = (row[55] || '').toString().trim().toLowerCase();
      const name = (row[6] || '').toString().trim();
      const batch = (row[58] || '').toString().trim();
      const grade = (row[57] || '').toString().trim();
      
      if (cohort && batch && batch.toUpperCase() !== 'NA' && batch.toUpperCase() !== '#N/A') {
        if (!cohortBatches[cohort]) cohortBatches[cohort] = new Set();
        cohortBatches[cohort].add(batch);
        if (branch) {
          if (!cohortBranches[cohort]) cohortBranches[cohort] = new Set();
          cohortBranches[cohort].add(branch);
        }
        if (status !== 'inactive' && status !== 'discontinued' && name) {
          students.push({ name, batch, branch, grade });
        }
      }
    });

    for (const c in cohortTeachers) cohortTeachers[c] = [...new Set(cohortTeachers[c])].sort();
    const finalBatches: Record<string, string[]> = {};
    for (const c in cohortBatches) finalBatches[c] = Array.from(cohortBatches[c]).sort();
    const finalBranches: Record<string, string[]> = {};
    for (const c in cohortBranches) finalBranches[c] = Array.from(cohortBranches[c]).sort();

    res.json({
      cohorts: Array.from(cohorts).sort(),
      cohortTeachers,
      cohortBatches: finalBatches,
      cohortBranches: finalBranches,
      students
    });
  } catch (error: any) {
    console.error("\n❌ GOOGLE API ERROR:", error.message);
    res.status(500).json({ message: "Google API Error: " + error.message });
  }
});

app.post('/api/session', async (req: Request, res: Response) => {
  try {
    const data = req.body;
    const studentMeta = data.selectedStudentsData?.length > 0 ? data.selectedStudentsData[0] : {};
    const rowData = [
      new Date().toISOString(), data.cohort, data.branch || studentMeta.branch || '',
      studentMeta.grade || '', data.batchesList, data.teacher, data.date,
      data.sessionType, data.subject, data.studentsList, data.topic || '',
      data.duration || '', data.notes || '', data.selectedStudentsData?.length || 0
    ];

    const sheets = google.sheets({ version: 'v4', auth: getAuth() });
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Session Logs!A:N',
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [rowData] },
    });
    res.json({ success: true, message: 'Session successfully recorded!' });
  } catch (error: any) {
    console.error("\n❌ GOOGLE WRITE ERROR:", error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Start server with anti-ghost checking
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`✅ Server successfully running on port ${PORT}`);
}).on('error', (err: any) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n❌ PORT ${PORT} IS ALREADY IN USE! You have a ghost server running.`);
    console.error(`Please click the trash can icon on ALL terminal tabs to kill the ghost process, then try again.`);
  } else {
    console.error(err);
  }
});