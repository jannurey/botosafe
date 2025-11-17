// pages/api/admin/import-students.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/configs/supabase";
import bcrypt from "bcryptjs";
// @ts-expect-error - Multer types are not properly defined in the type definitions, using any to avoid conflicts
import multer from "multer";
import csv from "csv-parser";
import { Readable } from "stream";
import { parse } from "cookie";
import jwt from "jsonwebtoken";
import transporter from "@/lib/nodemailer";

const JWT_SECRET = process.env.JWT_SECRET ?? "changeme";


interface ImportResult {
  success: boolean;
  message: string;
  imported: number;
  errors: string[];
}

// Multer file type definition
interface MulterFile {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
  size: number;
}

interface MulterRequest extends NextApiRequest {
  file: MulterFile;
}

export const config = {
  api: {
    bodyParser: false,
  },
};

// Multer configuration for file upload
// Note: Multer's TypeScript definitions aren't fully compatible with Next.js API routes
// Using callback types that match multer's expected signature
const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (
    _req: unknown,
    file: { mimetype: string },
    cb: (error: Error | null, acceptFile?: boolean) => void
  ) => {
    if (file.mimetype === "text/csv" || file.mimetype === "application/vnd.ms-excel") {
      cb(null, true);
    } else {
      cb(new Error("Only CSV files are allowed"));
    }
  },
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
});

// Helper function to parse CSV from buffer
function parseCSV(buffer: Buffer): Promise<Record<string, string>[]> {
  return new Promise((resolve, reject) => {
    const results: Record<string, string>[] = [];
    const stream = new Readable();
    stream.push(buffer);
    stream.push(null);

    stream
      .pipe(csv())
      .on("data", (data) => results.push(data))
      .on("end", () => resolve(results))
      .on("error", (error) => reject(error));
  });
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ImportResult>
) {
  if (req.method !== "POST") {
    return res.status(405).json({ 
      success: false, 
      message: "Method Not Allowed", 
      imported: 0, 
      errors: ["Only POST method is allowed"] 
    });
  }

  // Check if user is admin using the same authentication method as other admin APIs
  try {
    const cookies = parse(req.headers.cookie || "");
    const token = cookies.authToken;

    if (!token) {
      return res.status(401).json({ 
        success: false, 
        message: "Unauthorized", 
        imported: 0, 
        errors: ["Authentication required"] 
      });
    }

    let payload: jwt.JwtPayload | string;
    try {
      payload = jwt.verify(token, JWT_SECRET);
    } catch (error) {
      return res.status(401).json({ 
        success: false, 
        message: "Invalid token", 
        imported: 0, 
        errors: ["Invalid authentication token"] 
      });
    }

    if (typeof payload !== 'string' && payload.role !== "admin") {
      return res.status(403).json({ 
        success: false, 
        message: "Forbidden", 
        imported: 0, 
        errors: ["Only admins can import students"] 
      });
    }
  } catch (authError: unknown) {
    console.error("Authentication error:", authError);
    return res.status(500).json({ 
      success: false, 
      message: "Authentication error", 
      imported: 0, 
      errors: ["Failed to verify authentication"] 
    });
  }

  // Process file upload
  const uploadMiddleware = upload.single("csvFile");
  
  // Multer middleware requires casting for Next.js API routes compatibility
  uploadMiddleware(
    req as unknown as Parameters<typeof uploadMiddleware>[0],
    res as unknown as Parameters<typeof uploadMiddleware>[1],
    async (error: unknown) => {
    if (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown upload error";
      return res.status(400).json({ 
        success: false, 
        message: "File upload error", 
        imported: 0, 
        errors: [errorMessage] 
      });
    }

    // Cast req to MulterRequest to access the file property
    const multerReq = req as MulterRequest;

    if (!multerReq.file) {
      return res.status(400).json({ 
        success: false, 
        message: "No file uploaded", 
        imported: 0, 
        errors: ["Please upload a CSV file"] 
      });
    }

    try {
      // Parse CSV data
      const records = await parseCSV(multerReq.file.buffer);
      
      if (records.length === 0) {
        return res.status(400).json({ 
          success: false, 
          message: "Empty CSV file", 
          imported: 0, 
          errors: ["The uploaded CSV file is empty"] 
        });
      }

      // Validate required fields
      const requiredFields = ["fullname", "email", "school_id"];
      const missingFields = requiredFields.filter(field => !Object.keys(records[0]).includes(field));
      
      if (missingFields.length > 0) {
        return res.status(400).json({ 
          success: false, 
          message: "Invalid CSV format", 
          imported: 0, 
          errors: [`Missing required columns: ${missingFields.join(", ")}`] 
        });
      }

      let importedCount = 0;
      const errors: string[] = [];

      // Process each record
      for (const record of records) {
        try {
          const { fullname, email, school_id, age, gender, course, year_level } = record;
          
          // Validate required fields
          if (!fullname || !email || !school_id) {
            errors.push(`Row with school_id ${school_id || 'N/A'} is missing required fields`);
            continue;
          }

          // Check if user already exists
          const { data: existingUsers, error: checkError } = await supabaseAdmin
            .from('users')
            .select('id')
            .or(`email.eq.${email},school_id.eq.${school_id}`);

          if (checkError) {
            console.error("Supabase query error:", checkError);
            errors.push(`Database error checking user ${email}: ${checkError.message}`);
            continue;
          }

          if (existingUsers && existingUsers.length > 0) {
            errors.push(`User with email ${email} or school_id ${school_id} already exists`);
            continue;
          }

          // Generate system password
          const systemPassword = Math.random().toString(36).slice(-8);
          const hashedPassword = await bcrypt.hash(systemPassword, 10);

          // Insert user
          const { data: newUser, error: insertError } = await supabaseAdmin
            .from('users')
            .insert({
              fullname,
              email,
              password: hashedPassword,
              role: "voter",
              school_id,
              age: age || null,
              gender: gender || null,
              course: course || null,
              year_level: year_level || null,
              approval_status: "approved", // Auto-approve imported students
              user_status: "active",
              is_verified: false,
              created_at: new Date().toISOString()
            })
            .select()
            .single();

          if (insertError) {
            console.error("Supabase insert error:", insertError);
            errors.push(`Failed to create user ${email}: ${insertError.message}`);
            continue;
          }

          if (newUser) {
            importedCount++;
            
            // Skip sending email if the user's email is the same as the sender email
            if (email === process.env.EMAIL_USER) {
              console.log(`📧 Skipping email send to ${email} (same as sender email)`);
              errors.push(`Skipped sending credentials email to ${email} (same as sender email)`);
            } else {
              // Send credentials via email
              try {
                await transporter.sendMail({
                  from: `"BotoSafe" <${process.env.EMAIL_USER}>`,
                  to: email,
                  subject: "Your BotoSafe Account Credentials",
                  text: `Hello ${fullname},

Your BotoSafe account has been created successfully.

Login Credentials:
Student ID: ${school_id}
Password: ${systemPassword}

Please login at ${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'} and change your password after first login.

Best regards,
The BotoSafe Team`,
                  html: `<p>Hello ${fullname},</p>
<p>Your BotoSafe account has been created successfully.</p>
<p><strong>Login Credentials:</strong></p>
<ul>
  <li><strong>Student ID:</strong> ${school_id}</li>
  <li><strong>Password:</strong> ${systemPassword}</li>
</ul>
<p>Please <a href="${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}">login</a> and change your password after first login.</p>
<p>Best regards,<br>The BotoSafe Team</p>`,
                });
                
                // Log success
                console.log(`📧 Credentials email sent to ${email}`);
              } catch (emailError: unknown) {
                console.error("❌ Email Send Error:", emailError);
                errors.push(`Failed to send credentials email to ${email}: ${(emailError as Error).message}`);
              }
            }
            
            // Log credentials to terminal for development
            console.log(`📧 STUDENT CREDENTIALS (Development Only)`);
            console.log(`Student ID: ${school_id}`);
            console.log(`Name: ${fullname}`);
            console.log(`Email: ${email}`);
            console.log(`System Generated Password: ${systemPassword}`);
            console.log(`---`);
          }
        } catch (recordError: unknown) {
          errors.push(`Error processing row: ${(recordError as Error).message}`);
        }
      }

      return res.status(200).json({
        success: true,
        message: `Successfully imported ${importedCount} students`,
        imported: importedCount,
        errors
      });
    } catch (error: unknown) {
      console.error("❌ CSV Import Error:", error);
      return res.status(500).json({ 
        success: false, 
        message: "Internal server error", 
        imported: 0, 
        errors: [(error as Error).message || "An unexpected error occurred"] 
      });
    }
  });
}