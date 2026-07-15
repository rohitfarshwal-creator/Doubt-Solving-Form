import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { google } from 'googleapis';
import { PassThrough } from 'stream';

dotenv.config();
const app = express();
app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '10mb' })); // Increased limit to support file attachments

const getAuth = () => {
  const rawKey = process.env.GOOGLE_PRIVATE_KEY || '';
  const privateKey = rawKey.includes('\\n') ? rawKey.replace(/\\n/g, '\n') : rawKey;
  return new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: privateKey,
    },
    // CRITICAL: Added Google Drive scope so the backend can upload attachments
    scopes: [
      'https://www.googleapis.com/auth/spreadsheets',
      'https://www.googleapis.com/auth/drive'
    ],
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

// --- POST ROUTE (DPP FORM WITH DRIVE FILE UPLOAD) ---
app.post(['/api/dpp', '/dpp'], async (req: Request, res: Response) => {
  try {
    const sheets = google.sheets({ version: 'v4', auth: getAuth() });
    const data = req.body;
    
    const rowsToInsert = [];

    // Process each daily entry and upload attachments to Google Drive
    for (const entry of data.entries) {
      let attachmentLink = 'No Attachment';

      if (entry.attachmentData && entry.attachmentData.fileData) {
        try {
          const drive = google.drive({ version: 'v3', auth: getAuth() });
          const bufferStream = new PassThrough();
          const base64Data = entry.attachmentData.fileData.includes(',') 
            ? entry.attachmentData.fileData.split(',')[1] 
            : entry.attachmentData.fileData;
          
          bufferStream.end(Buffer.from(base64Data, 'base64'));

          // Try uploading directly to your official Drive Folder ID
          const fileRes = await drive.files.create({
            requestBody: {
              name: entry.attachmentData.fileName || `DPP_${Date.now()}`,
              parents: ['1W5DOjAp3tI2aMBzKpSZ_n5C5g9xs9NE4'], // Targets your official folder!
            },
            media: {
              mimeType: entry.attachmentData.mimeType || 'application/octet-stream',
              body: bufferStream,
            },
            fields: 'id, webViewLink',
          });

          const fileId = fileRes.data.id;
          if (fileId) {
            // Make the file publicly viewable so teachers & students can open the link
            await drive.permissions.create({
              fileId: fileId,
              requestBody: { role: 'reader', type: 'anyone' },
            });
          }
          attachmentLink = fileRes.data.webViewLink || `https://drive.google.com/file/d/${fileId}/view`;

        } catch (err: any) {
          console.error("Primary Drive upload error:", err.message);
          // Safety Fallback: If folder is not shared with Service Account, upload to root storage
          try {
            const drive = google.drive({ version: 'v3', auth: getAuth() });
            const bufferStream = new PassThrough();
            const base64Data = entry.attachmentData.fileData.includes(',') 
              ? entry.attachmentData.fileData.split(',')[1] 
              : entry.attachmentData.fileData;
            bufferStream.end(Buffer.from(base64Data, 'base64'));

            const fallbackRes = await drive.files.create({
              requestBody: { name: entry.attachmentData.fileName },
              media: { mimeType: entry.attachmentData.mimeType, body: bufferStream },
              fields: 'id, webViewLink',
            });
            if (fallbackRes.data.id) {
              await drive.permissions.create({
                fileId: fallbackRes.data.id,
                requestBody: { role: 'reader', type: 'anyone' },
              });
            }
            attachmentLink = fallbackRes.data.webViewLink || 'Uploaded (Root)';
          } catch (fallbackErr: any) {
            attachmentLink = 'Upload Failed - Share Drive Folder with Service Account';
          }
        }
      }

      rowsToInsert.push([
        new Date().toLocaleString('en-GB'), // 1. Timestamp
        data.cohort || '',                  // 2. Cohort
        data.branch || '',                  // 3. Branch (Centre)
        data.teacher || '',                 // 4. Teacher
        data.batchesList || '',             // 5. Batches
        data.subject || '',                 // 6. Subject
        entry.date || '',                   // 7. Date of DPP
        entry.topic || '',                  // 8. Home Work Topic
        entry.notes || '',                  // 9. Additional Notes
        attachmentLink                      // 10. Attachment Link (Drive URL)
      ]);
    }

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