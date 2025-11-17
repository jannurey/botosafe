# BotoSafe - Secure Student Voting Platform

This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## System Overview

BotoSafe is a secure student voting platform that implements a multi-factor authentication system:
1. Username/Password authentication (using Student ID as username)
2. OTP verification sent to registered email
3. Face recognition verification

## Authentication Flow

### For Students:
1. **Account Creation**: Students cannot register themselves. Accounts are created by administrators through CSV import.
2. **Login**: Students log in using their Student ID and system-generated password
3. **OTP Verification**: After successful login, an OTP is sent to their registered email
4. **Face Verification**: After OTP verification, students must complete face recognition

### For Administrators:
1. **Login**: Admins log in using email and password configured in environment variables
2. **Direct Access**: Admins bypass OTP and face verification steps

## Performance Optimization

### Face Recognition Model Loading
To address memory consumption issues and slow page loads (4-5 seconds per page), we implemented a global model caching mechanism:

1. **Problem**: Face recognition models were loading on every page visit, causing high memory usage and slow performance
2. **Solution**: Created a `FaceModelManager` singleton service that:
   - Loads models only once when needed (first login or vote submission)
   - Caches models for reuse across different pages
   - Prevents redundant model loading on regular page visits
3. **Impact**: 
   - Models now load only when actually needed for security-critical operations
   - Subsequent page visits are much faster (no 4-5 second delays)
   - Memory consumption is significantly reduced

### Affected Pages:
- `/signin/face-register` - First-time face registration
- `/signin/face-scan` - Face verification during login
- `/signin/face-scan-vote` - Face verification during voting
- `/face-scan` - Alternative face verification route

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Student Account Management

### CSV Import Process:
1. Administrators upload a CSV file containing student information
2. The system automatically generates passwords for each student
3. During development, credentials are logged to the terminal
4. In production, credentials would be sent via email

### Required CSV Columns:
- `fullname` - Student's full name
- `email` - Student's email address
- `school_id` - Unique student identifier
- `age` (optional)
- `gender` (optional)
- `course` (optional)
- `year_level` (optional)

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.