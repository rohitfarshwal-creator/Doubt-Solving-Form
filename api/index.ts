import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { google } from 'googleapis';
import { PassThrough } from 'stream';
import nodemailer from 'nodemailer';
import crypto from 'crypto';

dotenv.config();
const app = express();
app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

const getAuth = () => {
  const rawKey = process.env.GOOGLE_PRIVATE_KEY || '';
  const privateKey = rawKey.includes('\\n') ? rawKey.replace(/\\n/g, '\n') : rawKey;
  return new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: privateKey,
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets', 'https://www.googleapis.com/auth/drive'],
  });
};

const SPREADSHEET_ID = process.env.GOOGLE_SHEET_ID;
const DRIVE_FOLDER_ID = '1W5DOjAp3tI2aMBzKpSZ_n5C5g9xs9NE4'; 
const APP_URL = 'https://doubt-solving-form.vercel.app'; 

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
});

let cachedInitData: any = null;
let lastFetchTime = 0;
const CACHE_DURATION_MS = 5 * 60 * 1000;

const toTitleCase = (str: string) => str.toLowerCase().replace(/(?:^|\s)\w/g, match => match.toUpperCase());

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

    cachedInitData = { cohorts: Array.from(cohortsSet).sort(), teachers: teachersList, students: studentsList };
    lastFetchTime = Date.now();
    res.json(cachedInitData);
  } catch (e: any) { res.status(500).json({ message: "Google API Error: " + e.message }); }
});

// --- POST ROUTE (EXTRA CLASS SESSION) ---
app.post(['/api/session', '/session'], async (req: Request, res: Response) => {
  try {
    const sheets = google.sheets({ version: 'v4', auth: getAuth() });
    const data = req.body;
    const studentMeta = data.selectedStudentsData && data.selectedStudentsData.length > 0 ? data.selectedStudentsData[0] : {};
    const finalBranch = data.branch || studentMeta.branch || '';
    
    const newRow = [
        new Date().toLocaleString('en-GB'), data.cohort || '', finalBranch, studentMeta.grade || '',            
        data.batchesList || '', data.teacher || '', data.date || '', data.sessionType || '',             
        data.subject || '', data.studentsList || '', data.topic || '', data.duration || '',                
        data.notes || '', data.selectedStudentsData ? data.selectedStudentsData.length : 0                       
    ];
    await sheets.spreadsheets.values.append({
        spreadsheetId: SPREADSHEET_ID, range: 'Session Logs!A:N', valueInputOption: 'USER_ENTERED', requestBody: { values: [newRow] },
    });
    res.json({ success: true, message: "Session logged" });
  } catch (e: any) { res.status(500).json({ message: "Google API Error: " + e.message }); }
});

// --- POST ROUTE (DPP FORM) ---
app.post(['/api/dpp', '/dpp'], async (req: Request, res: Response) => {
  try {
    const auth = getAuth();
    const sheets = google.sheets({ version: 'v4', auth });
    const drive = google.drive({ version: 'v3', auth });
    const data = req.body;
    
    const rowsToInsert = await Promise.all(data.entries.map(async (entry: any) => {
        let fileLink = '';
        if (entry.attachment && entry.attachment.data) {
            try {
                const bufferStream = new PassThrough();
                bufferStream.end(Buffer.from(entry.attachment.data, 'base64'));
                const driveRes = await drive.files.create({
                    requestBody: { name: entry.attachment.name, parents: [DRIVE_FOLDER_ID] },
                    media: { mimeType: entry.attachment.type, body: bufferStream },
                    fields: 'webViewLink'
                });
                fileLink = driveRes.data.webViewLink || '';
            } catch (err) { fileLink = "Upload Failed"; }
        }
        return [
            new Date().toLocaleString('en-GB'), data.cohort || '', data.branch || '', data.teacher || '',
            data.batchesList || '', data.subject || '', entry.date || '', entry.topic || '', entry.notes || '', fileLink
        ];
    }));

    await sheets.spreadsheets.values.append({
        spreadsheetId: SPREADSHEET_ID, range: 'DPP Responses!A:J', valueInputOption: 'USER_ENTERED', requestBody: { values: rowsToInsert },
    });
    res.json({ success: true, message: `Successfully logged ${rowsToInsert.length} DPP entrie(s)!` });
  } catch (e: any) { res.status(500).json({ message: "Google API Error: " + e.message }); }
});


// ==========================================
// NEW LEAVE MANAGEMENT SYSTEM
// ==========================================

// Login Route
app.post(['/api/login', '/login'], async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;
    const sheets = google.sheets({ version: 'v4', auth: getAuth() });
    const sheetData = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: 'Login Credentials!A2:B' });
    const rows = sheetData.data.values || [];
    
    const user = rows.find(r => r[0]?.toString().trim().toLowerCase() === username.toLowerCase() && r[1] === password);
    
    if (!user) return res.status(401).json({ message: "Invalid credentials" });

    const actualName = user[0].toString().trim();
    let role = 'Faculty';
    if (actualName.toLowerCase() === 'tannu verma') role = 'HR';
    if (actualName.toLowerCase() === 'admin') role = 'Admin';

    res.json({ success: true, user: { username: actualName, role } });
  } catch (e: any) { res.status(500).json({ message: e.message }); }
});

// Fetch Leaves
app.get(['/api/leaves', '/leaves'], async (req: Request, res: Response) => {
  try {
    const sheets = google.sheets({ version: 'v4', auth: getAuth() });
    const sheetData = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: 'Leave Requests!A2:K' });
    const rows = sheetData.data.values || [];
    
    const leaves = rows.map(r => ({
      id: r[0], timestamp: r[1], cohort: r[2], clusterHead: r[3], teacher: r[4], 
      fromDate: r[5], toDate: r[6], days: r[7], reason: r[8], comments: r[9], status: r[10]
    })).reverse(); 

    res.json({ leaves });
  } catch (e: any) { res.status(500).json({ message: e.message }); }
});

// Submit Leave
app.post(['/api/leave', '/leave'], async (req: Request, res: Response) => {
  try {
    const sheets = google.sheets({ version: 'v4', auth: getAuth() });
    const data = req.body;
    const leaveId = crypto.randomUUID();
    
    const newRow = [
      leaveId, new Date().toLocaleString('en-GB'), data.cohort, data.clusterHead || 'N/A', 
      data.teacher, data.fromDate, data.toDate, data.days, data.reason, data.comments, 'Pending'
    ];

    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID, range: 'Leave Requests!A:K', valueInputOption: 'USER_ENTERED', requestBody: { values: [newRow] }
    });

    if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
      const approveUrl = `${APP_URL}/api/leave/action?id=${leaveId}&action=Approve`;
      const rejectUrl = `${APP_URL}/api/leave/action?id=${leaveId}&action=Reject`;
      
      const emailHtml = `
      <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #f8fafc; padding: 20px; border-radius: 12px;">
        <div style="background-color: #0f172a; padding: 24px; border-radius: 12px 12px 0 0; text-align: center;">
          <h2 style="color: #ffffff; margin: 0; font-size: 24px; letter-spacing: 0.5px;">PW Gulf System</h2>
          <p style="color: #94a3b8; margin: 8px 0 0 0; font-size: 14px; text-transform: uppercase; letter-spacing: 1px;">Leave Request Pending</p>
        </div>
        <div style="background-color: #ffffff; padding: 32px; border-radius: 0 0 12px 12px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
          <p style="color: #334155; font-size: 16px; margin-top: 0;">A new leave request requires your attention.</p>
          
          <table style="width: 100%; border-collapse: collapse; margin: 24px 0;">
            <tr>
              <td style="padding: 12px; border-bottom: 1px solid #e2e8f0; color: #64748b; font-size: 14px; width: 120px;"><strong>Faculty</strong></td>
              <td style="padding: 12px; border-bottom: 1px solid #e2e8f0; color: #0f172a; font-size: 15px; font-weight: 600;">${data.teacher} <span style="color: #64748b; font-weight: 400; font-size: 13px;">(${data.cohort})</span></td>
            </tr>
            <tr>
              <td style="padding: 12px; border-bottom: 1px solid #e2e8f0; color: #64748b; font-size: 14px;"><strong>Cluster Head</strong></td>
              <td style="padding: 12px; border-bottom: 1px solid #e2e8f0; color: #0f172a; font-size: 15px;">${data.clusterHead || 'N/A'}</td>
            </tr>
            <tr>
              <td style="padding: 12px; border-bottom: 1px solid #e2e8f0; color: #64748b; font-size: 14px;"><strong>Dates</strong></td>
              <td style="padding: 12px; border-bottom: 1px solid #e2e8f0; color: #0f172a; font-size: 15px;">${data.fromDate} <span style="color: #94a3b8;">to</span> ${data.toDate} <br/><span style="display: inline-block; margin-top: 4px; padding: 4px 8px; background: #e0f2fe; color: #0369a1; border-radius: 4px; font-size: 12px; font-weight: bold;">${data.days} Day(s)</span></td>
            </tr>
            <tr>
              <td style="padding: 12px; border-bottom: 1px solid #e2e8f0; color: #64748b; font-size: 14px;"><strong>Reason</strong></td>
              <td style="padding: 12px; border-bottom: 1px solid #e2e8f0; color: #0f172a; font-size: 15px;">${data.reason}</td>
            </tr>
            <tr>
              <td style="padding: 12px; color: #64748b; font-size: 14px; vertical-align: top;"><strong>Comments</strong></td>
              <td style="padding: 12px; color: #475569; font-size: 14px; background: #f8fafc; border-radius: 8px; font-style: italic;">"${data.comments}"</td>
            </tr>
          </table>

          <div style="text-align: center; margin-top: 32px;">
            <a href="${approveUrl}" style="display: inline-block; background-color: #10b981; color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 15px; margin: 0 8px 12px 8px; border: 1px solid #059669;">Approve Leave</a>
            <a href="${rejectUrl}" style="display: inline-block; background-color: #ef4444; color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 15px; margin: 0 8px 12px 8px; border: 1px solid #dc2626;">Reject Leave</a>
          </div>
        </div>
      </div>
      `;

      await transporter.sendMail({
        from: `"PW Gulf System" <${process.env.EMAIL_USER}>`,
        to: 'rohit.kumar30@pw.live', 
        subject: `[LEAVE REQUEST] ${data.teacher} - ${data.days} Day(s)`,
        html: emailHtml
      });
    }

    res.json({ success: true, message: "Leave requested successfully!" });
  } catch (e: any) { res.status(500).json({ message: "Google API Error: " + e.message }); }
});

// HR Dashboard AJAX Update Route
app.post(['/api/leave/update', '/leave/update'], async (req: Request, res: Response) => {
  try {
    const { id, action } = req.body;
    const sheets = google.sheets({ version: 'v4', auth: getAuth() });
    const sheetData = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: 'Leave Requests!A:K' });
    const rows = sheetData.data.values || [];
    
    const rowIndex = rows.findIndex(row => row[0] === id);
    if (rowIndex === -1) return res.status(404).json({ message: 'Leave request not found.' });

    const teacherName = rows[rowIndex][4];
    
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `Leave Requests!K${rowIndex + 1}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [[action]] }
    });

    if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
      const isApproved = action === 'Approve';
      const colorBg = isApproved ? '#d1fae5' : '#fee2e2';
      const colorText = isApproved ? '#065f46' : '#991b1b';
      
      const emailHtml = `
      <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #f8fafc; padding: 20px; border-radius: 12px;">
        <div style="background-color: #0f172a; padding: 24px; border-radius: 12px 12px 0 0; text-align: center;">
          <h2 style="color: #ffffff; margin: 0; font-size: 24px; letter-spacing: 0.5px;">PW Gulf HR</h2>
        </div>
        <div style="background-color: #ffffff; padding: 40px 32px; border-radius: 0 0 12px 12px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); text-align: center;">
          <p style="color: #64748b; font-size: 16px; margin: 0 0 8px 0;">Hello <strong style="color: #0f172a;">${teacherName}</strong>,</p>
          <p style="color: #334155; font-size: 16px; margin: 0 0 24px 0;">Your recent leave request has been processed.</p>
          <span style="display: inline-block; padding: 12px 32px; background-color: ${colorBg}; color: ${colorText}; border-radius: 999px; font-size: 18px; font-weight: bold; letter-spacing: 0.5px;">
            ${action}d
          </span>
          <p style="color: #94a3b8; font-size: 13px; margin-top: 32px;">If you have any questions, please contact your Cluster Head or HR.</p>
        </div>
      </div>
      `;

      await transporter.sendMail({
        from: `"PW Gulf HR" <${process.env.EMAIL_USER}>`,
        to: 'thisisrohithere@gmail.com', 
        subject: `Leave Request ${action}d`,
        html: emailHtml
      });
    }

    res.json({ success: true, message: `Leave ${action}d successfully.` });
  } catch (e: any) { res.status(500).json({ message: "Error updating leave." }); }
});

// Old GET route to support clicking buttons inside emails directly
app.get(['/api/leave/action', '/leave/action'], async (req: Request, res: Response) => {
  try {
    const { id, action } = req.query;
    if (!id || !action) return res.send('Invalid Request');

    const sheets = google.sheets({ version: 'v4', auth: getAuth() });
    const sheetData = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: 'Leave Requests!A:K' });
    const rows = sheetData.data.values || [];
    
    const rowIndex = rows.findIndex(row => row[0] === id);
    if (rowIndex === -1) return res.send('Leave request not found.');

    const teacherName = rows[rowIndex][4];
    
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID, range: `Leave Requests!K${rowIndex + 1}`, valueInputOption: 'USER_ENTERED', requestBody: { values: [[action]] }
    });

    if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
      const isApproved = action === 'Approve';
      const colorBg = isApproved ? '#d1fae5' : '#fee2e2';
      const colorText = isApproved ? '#065f46' : '#991b1b';

      const emailHtml = `
      <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #f8fafc; padding: 20px; border-radius: 12px;">
        <div style="background-color: #0f172a; padding: 24px; border-radius: 12px 12px 0 0; text-align: center;">
          <h2 style="color: #ffffff; margin: 0; font-size: 24px; letter-spacing: 0.5px;">PW Gulf HR</h2>
        </div>
        <div style="background-color: #ffffff; padding: 40px 32px; border-radius: 0 0 12px 12px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); text-align: center;">
          <p style="color: #64748b; font-size: 16px; margin: 0 0 8px 0;">Hello <strong style="color: #0f172a;">${teacherName}</strong>,</p>
          <p style="color: #334155; font-size: 16px; margin: 0 0 24px 0;">Your recent leave request has been processed.</p>
          <span style="display: inline-block; padding: 12px 32px; background-color: ${colorBg}; color: ${colorText}; border-radius: 999px; font-size: 18px; font-weight: bold; letter-spacing: 0.5px;">
            ${action}d
          </span>
          <p style="color: #94a3b8; font-size: 13px; margin-top: 32px;">If you have any questions, please contact your Cluster Head or HR.</p>
        </div>
      </div>
      `;

      await transporter.sendMail({
        from: `"PW Gulf HR" <${process.env.EMAIL_USER}>`,
        to: 'thisisrohithere@gmail.com', 
        subject: `Leave Request ${action}d`,
        html: emailHtml
      });
    }

    res.send(`
      <div style="font-family: sans-serif; text-align: center; margin-top: 50px;">
        <h1 style="color: #0f172a;">Successfully ${action}d leave for ${teacherName}.</h1>
        <p style="color: #64748b;">The Google Sheet has been updated. You may close this window.</p>
      </div>
    `);
  } catch (e: any) { res.status(500).send("Error updating leave."); }
});

export default app;