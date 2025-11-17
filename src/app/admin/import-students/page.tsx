// src/app/admin/import-students/page.tsx
"use client";

import React, { useState, useRef } from "react";
import { FiUpload, FiFile, FiAlertCircle, FiCheckCircle } from "react-icons/fi";

export default function ImportStudentsPage() {
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<{
    success: boolean;
    message: string;
    imported: number;
    errors: string[];
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      // Check file type
      if (selectedFile.type !== "text/csv" && !selectedFile.name.endsWith(".csv")) {
        setUploadResult({
          success: false,
          message: "Invalid file type",
          imported: 0,
          errors: ["Please upload a CSV file"]
        });
        return;
      }
      
      // Check file size (5MB limit)
      if (selectedFile.size > 5 * 1024 * 1024) {
        setUploadResult({
          success: false,
          message: "File too large",
          imported: 0,
          errors: ["File size must be less than 5MB"]
        });
        return;
      }
      
      setFile(selectedFile);
      setUploadResult(null);
    }
  };

  const handleUpload = async () => {
    if (!file) {
      setUploadResult({
        success: false,
        message: "No file selected",
        imported: 0,
        errors: ["Please select a CSV file to upload"]
      });
      return;
    }

    setIsUploading(true);
    setUploadResult(null);

    const formData = new FormData();
    formData.append("csvFile", file);

    try {
      const response = await fetch("/api/admin/import-students", {
        method: "POST",
        body: formData,
        credentials: "include", // Include cookies (authToken) in the request
      });

      const result = await response.json();
      
      if (response.ok) {
        setUploadResult({
          success: true,
          message: result.message,
          imported: result.imported,
          errors: result.errors
        });
        
        // Clear file input
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
        setFile(null);
      } else {
        setUploadResult({
          success: false,
          message: result.message || "Upload failed",
          imported: 0,
          errors: result.errors || ["An unknown error occurred"]
        });
      }
    } catch (error: unknown) {
      setUploadResult({
        success: false,
        message: "Network error",
        imported: 0,
        errors: [`Failed to connect to the server. Please try again. Error: ${(error as Error).message || 'Unknown error'}`]
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile) {
      if (droppedFile.type === "text/csv" || droppedFile.name.endsWith(".csv")) {
        setFile(droppedFile);
        setUploadResult(null);
      } else {
        setUploadResult({
          success: false,
          message: "Invalid file type",
          imported: 0,
          errors: ["Please upload a CSV file"]
        });
      }
    }
  };

  const sampleCSVContent = `fullname,email,school_id,age,gender,course,year_level
John Doe,john.doe@school.edu,2022-03849,20,male,BSCS,2nd Year
Jane Smith,jane.smith@school.edu,2022-03850,19,female,ACT,1st Year
Robert Johnson,robert.j@school.edu,2022-03851,21,male,BSED English,3rd Year`;

  return (
    <div className="p-4 md:p-6 bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-[#791010] mb-6 bg-white rounded-xl p-4 md:p-6 shadow">
          📤 Import Students
        </h1>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Upload Section */}
          <div className="bg-white rounded-xl shadow-lg p-4 md:p-6">
            <h2 className="text-lg md:text-xl font-bold text-gray-800 mb-3 md:mb-4">Upload CSV File</h2>
            <p className="text-gray-600 mb-4 md:mb-6 text-sm md:text-base">
              Upload a CSV file containing student information. The system will automatically generate passwords and log them to the terminal.
            </p>

            {/* Drag and Drop Area */}
            <div
              className={`border-2 border-dashed rounded-lg p-6 md:p-8 text-center cursor-pointer transition-all ${
                file ? "border-green-500 bg-green-50" : "border-gray-300 hover:border-[#791010]"
              }`}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept=".csv,text/csv"
                className="hidden"
              />
              
              {file ? (
                <div className="flex flex-col items-center">
                  <FiFile className="text-3xl md:text-4xl text-green-500 mb-2 md:mb-3" />
                  <p className="font-medium text-gray-800 text-sm md:text-base">{file.name}</p>
                  <p className="text-xs md:text-sm text-gray-500 mt-1">{(file.size / 1024).toFixed(2)} KB</p>
                  <button
                    type="button"
                    className="mt-3 md:mt-4 text-xs md:text-sm text-[#791010] hover:underline"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (fileInputRef.current) {
                        fileInputRef.current.value = "";
                      }
                      setFile(null);
                    }}
                  >
                    Remove file
                  </button>
                </div>
              ) : (
                <div>
                  <FiUpload className="text-3xl md:text-4xl text-gray-400 mx-auto mb-2 md:mb-3" />
                  <p className="font-medium text-gray-700 text-sm md:text-base">Drag & drop your CSV file here</p>
                  <p className="text-gray-500 text-xs md:text-sm mt-1">or click to browse</p>
                  <p className="text-gray-400 text-xs mt-2">CSV files only, max 5MB</p>
                </div>
              )}
            </div>

            {/* Upload Button */}
            <button
              onClick={handleUpload}
              disabled={!file || isUploading}
              className={`w-full mt-4 md:mt-6 py-2.5 md:py-3 rounded-lg font-semibold transition-all text-sm md:text-base ${
                !file || isUploading
                  ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                  : "bg-[#791010] hover:bg-[#5a0c0c] text-white shadow-lg hover:shadow-xl"
              }`}
            >
              {isUploading ? "Importing Students..." : "Import Students"}
            </button>

            {/* Result Display */}
            {uploadResult && (
              <div
                className={`mt-4 md:mt-6 p-3 md:p-4 rounded-lg border ${
                  uploadResult.success
                    ? "bg-green-50 border-green-200"
                    : "bg-red-50 border-red-200"
                }`}
              >
                <div className="flex items-start">
                  {uploadResult.success ? (
                    <FiCheckCircle className="text-green-500 text-lg md:text-xl mt-0.5 mr-2" />
                  ) : (
                    <FiAlertCircle className="text-red-500 text-lg md:text-xl mt-0.5 mr-2" />
                  )}
                  <div>
                    <h3
                      className={`font-bold text-sm md:text-base ${
                        uploadResult.success ? "text-green-800" : "text-red-800"
                      }`}
                    >
                      {uploadResult.success ? "Success!" : "Error"}
                    </h3>
                    <p
                      className={`text-xs md:text-sm ${
                        uploadResult.success ? "text-green-700" : "text-red-700"
                      }`}
                    >
                      {uploadResult.message}
                    </p>
                    {uploadResult.success && (
                      <p className="text-xs md:text-sm text-green-700 mt-1">
                        Imported {uploadResult.imported} students
                      </p>
                    )}
                    {uploadResult.errors.length > 0 && (
                      <div className="mt-2">
                        <p className="text-xs font-semibold text-gray-600">Details:</p>
                        <ul className="list-disc pl-5 mt-1 space-y-1">
                          {uploadResult.errors.map((error, index) => (
                            <li
                              key={index}
                              className={`text-xs ${
                                uploadResult.success ? "text-green-600" : "text-red-600"
                              }`}
                            >
                              {error}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Instructions Section */}
          <div className="bg-white rounded-xl shadow-lg p-4 md:p-6">
            <h2 className="text-lg md:text-xl font-bold text-gray-800 mb-3 md:mb-4">Instructions</h2>
            
            <div className="space-y-3 md:space-y-4">
              <div>
                <h3 className="font-semibold text-gray-700 mb-2 text-sm md:text-base">1. CSV Format</h3>
                <p className="text-gray-600 text-xs md:text-sm">
                  Your CSV file must include the following columns:
                </p>
                <ul className="list-disc pl-5 mt-2 text-xs md:text-sm text-gray-600 space-y-1">
                  <li>
                    <span className="font-medium">fullname</span> - Student&apos;s full name
                  </li>
                  <li>
                    <span className="font-medium">email</span> - Student&apos;s email address
                  </li>
                  <li>
                    <span className="font-medium">school_id</span> - Unique student ID
                  </li>
                  <li>
                    <span className="font-medium">age</span> - Student&apos;s age (optional)
                  </li>
                  <li>
                    <span className="font-medium">gender</span> - Student&apos;s gender (optional)
                  </li>
                  <li>
                    <span className="font-medium">course</span> - Student&apos;s course (optional)
                  </li>
                  <li>
                    <span className="font-medium">year_level</span> - Student&apos;s year level (optional)
                  </li>
                </ul>
              </div>

              <div>
                <h3 className="font-semibold text-gray-700 mb-2 text-sm md:text-base">2. Sample CSV</h3>
                <pre className="bg-gray-100 p-3 md:p-4 rounded-lg text-xs overflow-x-auto">
                  {sampleCSVContent}
                </pre>
              </div>

              <div>
                <h3 className="font-semibold text-gray-700 mb-2 text-sm md:text-base">3. How It Works</h3>
                <ol className="list-decimal pl-5 space-y-2 text-xs md:text-sm text-gray-600">
                  <li>Upload your CSV file using the form</li>
                  <li>The system generates a random password for each student</li>
                  <li>Student credentials are logged to the terminal (for development)</li>
                  <li>Students can log in using their school_id and generated password</li>
                  <li>After login, they will go through OTP and face verification</li>
                </ol>
              </div>

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 md:p-4">
                <h3 className="font-semibold text-yellow-800 mb-2 text-sm md:text-base">⚠️ Important Note</h3>
                <p className="text-yellow-700 text-xs md:text-sm">
                  In production, student credentials will be sent via email. For development purposes, 
                  they are currently logged to the terminal only.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}