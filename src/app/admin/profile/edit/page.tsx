"use client";

import { useEffect, useState, ChangeEvent, FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  FaUser,
  FaCalendarAlt,
  FaTransgender,
  FaListAlt,
  FaIdCard,
  FaEnvelope,
  FaLock,
  FaEye,
  FaEyeSlash,
  FaUniversity,
} from "react-icons/fa";

interface Admin {
  id: number;
  fullname: string;
  email: string;
  age?: number | null;
  gender?: string | null;
  course?: string | null;
  year_level?: string | number | null;
  school_id?: string | null;
}

export default function EditProfilePage() {
  const router = useRouter();

  const [admin, setAdmin] = useState<Admin | null>(null);
  const [fullname, setFullname] = useState("");
  const [email, setEmail] = useState("");
  const [age, setAge] = useState<number | "">("");
  const [gender, setGender] = useState("");
  const [course, setCourse] = useState("");
  const [yearLevel, setYearLevel] = useState<string | number>("");
  const [schoolId, setSchoolId] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // Validation patterns (same as signup)
  const schoolIdPattern = /^(ESU-[A-Z]+-\d{4}-\d{5}|\d{4}-\d{5})$/;
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const fullnamePattern = /^[A-Za-z\s.]+$/;
  const agePattern = /^[1-9][0-9]?$/; // 1–99

  const [touched, setTouched] = useState<Record<string, boolean>>({
    fullname: false,
    age: false,
    school_id: false,
    email: false,
    password: false,
    confirmPassword: false,
  });

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const res = await fetch("/api/admins/me");
        if (!res.ok) throw new Error("Failed to load");
        const data = await res.json();
        if (mounted) {
          setAdmin(data);
          setFullname(data.fullname || "");
          setEmail(data.email || "");
          setAge(typeof data.age === "number" ? data.age : "");
          setGender(data.gender ?? "");
          setCourse(data.course ?? "");
          setYearLevel(data.year_level ?? "");
          setSchoolId(data.school_id ?? "");
        }
      } catch (err) {
        // ignore
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, []);

  const handleBlur = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name } = e.target;
    setTouched((prev) => ({ ...prev, [name]: true }));
  };

  // Field validations
  const isFullnameValid =
    fullname.trim() !== "" && fullnamePattern.test(fullname);
  const isAgeValid =
    age === "" || (String(age).trim() !== "" && agePattern.test(String(age)));
  const isEmailValid = email.trim() !== "" && emailPattern.test(email);
  const isSchoolIdValid =
    schoolId.trim() === "" || schoolIdPattern.test(schoolId);

  // Password rules (same as signin)
  const pw = password;
  const passwordRules = {
    length: pw.length >= 8,
    uppercase: /[A-Z]/.test(pw),
    lowercase: /[a-z]/.test(pw),
    number: /\d/.test(pw),
    specialChar: /[\W_]/.test(pw),
  };
  const allPasswordRulesMet = Object.values(passwordRules).every(Boolean);
  const passwordsMatch = password === confirmPassword;

  // For edit: required fields are fullname and email. Password is optional,
  // but if provided it must meet rules and match confirmPassword.
  const baseFieldsValid =
    isFullnameValid && isEmailValid && isAgeValid && isSchoolIdValid;
  const passwordOk =
    password === "" ? true : allPasswordRulesMet && passwordsMatch;
  const isFormValid = baseFieldsValid && passwordOk;

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    setTouched({
      fullname: true,
      age: true,
      school_id: true,
      email: true,
      password: true,
      confirmPassword: true,
    });

    if (!admin) return;
    if (!isFormValid) {
      setMessage("Please fix highlighted fields before saving.");
      return;
    }

    setSaving(true);
    setMessage(null);

    try {
      const body = {
        fullname,
        email,
        age: age === "" ? null : Number(age),
        gender: gender || null,
        course: course || null,
        year_level: yearLevel === "" ? null : yearLevel,
        school_id: schoolId || null,
        password: password || undefined,
      } as Record<string, unknown>;

      const res = await fetch(`/api/admins/${admin.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Failed to save");
      setMessage("Profile updated");
      setTimeout(() => router.push("/admin/profile"), 700);
    } catch (err: unknown) {
      setMessage(err instanceof Error ? err.message : "Failed to update");
    } finally {
      setSaving(false);
    }
  };

  if (!admin) return <div>Loading...</div>;

  return (
    <div className="max-w-2xl mx-auto bg-white p-6 rounded shadow">
      <h3 className="text-lg font-bold mb-4">Edit Profile</h3>
      {message && <div className="mb-4 text-sm text-gray-700">{message}</div>}

      <form onSubmit={handleSave} className="space-y-4">
        <div>
          <label className="block text-sm">Full name</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
              <FaUser />
            </span>
            <input
              name="fullname"
              value={fullname}
              onChange={(e) => setFullname(e.target.value)}
              onBlur={handleBlur}
              className={`w-full pl-10 border px-3 py-2 rounded ${
                touched.fullname && !isFullnameValid
                  ? "border-red-400"
                  : "border-gray-300"
              }`}
              required
            />
            {touched.fullname && !isFullnameValid && (
              <p className="text-sm text-red-500 mt-1">
                Full name may only contain letters, spaces, and periods.
              </p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="block text-sm">Age</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
                <FaCalendarAlt />
              </span>
              <input
                name="age"
                value={age}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === "") setAge("");
                  else setAge(Number(v));
                }}
                onBlur={handleBlur}
                type="number"
                min={0}
                className={`w-full pl-10 border px-3 py-2 rounded ${
                  touched.age && !isAgeValid
                    ? "border-red-400"
                    : "border-gray-300"
                }`}
              />
              {touched.age && !isAgeValid && (
                <p className="text-sm text-red-500 mt-1">
                  Enter a valid age (1–99).
                </p>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm">Gender</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
                <FaTransgender />
              </span>
              <select
                name="gender"
                value={gender}
                onChange={(e) => setGender(e.target.value)}
                className="w-full pl-10 border px-3 py-2 rounded"
              >
                <option value="">Select</option>
                <option value="female">Female</option>
                <option value="male">Male</option>
                <option value="other">Other</option>
                <option value="prefer_not_to_say">Prefer not to say</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm">Course</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
                <FaListAlt />
              </span>
              <select
                name="course"
                value={course}
                onChange={(e) => setCourse(e.target.value)}
                className="w-full pl-10 border px-3 py-2 rounded"
              >
                <option value="">Select Course</option>
                <option value="BSCS">BSCS</option>
                <option value="ACT">ACT</option>
                <option value="BSED English">BSED English</option>
                <option value="BSED Science">BSED Science</option>
                <option value="BEED">BEED</option>
                <option value="BSCrim">BSCrim</option>
                <option value="BSSW">BSSW</option>
              </select>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="block text-sm">Declared year level</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
                <FaUniversity />
              </span>
              <select
                name="year_level"
                value={yearLevel}
                onChange={(e) => setYearLevel(e.target.value)}
                className="w-full pl-10 border px-3 py-2 rounded"
              >
                <option value="">Select Year Level</option>
                <option value="1st Year">1st Year</option>
                <option value="2nd Year">2nd Year</option>
                <option value="3rd Year">3rd Year</option>
                <option value="4th Year">4th Year</option>
              </select>
            </div>
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm">School ID</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
                <FaIdCard />
              </span>
              <input
                name="school_id"
                value={schoolId}
                onChange={(e) => setSchoolId(e.target.value)}
                onBlur={handleBlur}
                className={`w-full pl-10 border px-3 py-2 rounded ${
                  touched.school_id && !isSchoolIdValid
                    ? "border-red-400"
                    : "border-gray-300"
                }`}
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Format examples:{" "}
              <span className="font-medium">ESU-PAGA-2022-03849</span> or{" "}
              <span className="font-medium">2022-03849</span>
            </p>
            {touched.school_id && !isSchoolIdValid && (
              <p className="text-sm text-red-500 mt-1">
                Invalid school ID. Use ESU-AREA-YYYY-XXXXX or YYYY-XXXXX.
              </p>
            )}
          </div>
        </div>

        <div>
          <label className="block text-sm">Email</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
              <FaEnvelope />
            </span>
            <input
              name="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onBlur={handleBlur}
              type="email"
              className={`w-full pl-10 border px-3 py-2 rounded ${
                touched.email && !isEmailValid
                  ? "border-red-400"
                  : "border-gray-300"
              }`}
              required
            />
            {touched.email && !isEmailValid && (
              <p className="text-sm text-red-500 mt-1">
                Enter a valid email address.
              </p>
            )}
          </div>
        </div>

        <div>
          <label className="block text-sm">
            Password (leave blank to keep)
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
              <FaLock />
            </span>
            <input
              name="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onBlur={handleBlur}
              type={showPassword ? "text" : "password"}
              className={`w-full pl-10 border px-3 py-2 rounded ${
                touched.password && password !== "" && !allPasswordRulesMet
                  ? "border-red-400"
                  : "border-gray-300"
              }`}
            />
            <button
              type="button"
              onClick={() => setShowPassword((s) => !s)}
              className="absolute right-10 top-1/2 -translate-y-1/2 text-gray-500"
            >
              {showPassword ? <FaEyeSlash /> : <FaEye />}
            </button>

            <button
              type="button"
              onClick={() => setShowConfirmPassword((s) => !s)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500"
            >
              {showConfirmPassword ? <FaEyeSlash /> : <FaEye />}
            </button>
          </div>

          {/* Confirm password */}
          <div className="mt-2">
            <input
              name="confirmPassword"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              onBlur={handleBlur}
              type={showConfirmPassword ? "text" : "password"}
              placeholder="Confirm password"
              className={`w-full pl-3 border px-3 py-2 rounded ${
                touched.confirmPassword &&
                confirmPassword !== "" &&
                !passwordsMatch
                  ? "border-red-400"
                  : "border-gray-300"
              }`}
            />
            {touched.confirmPassword &&
              confirmPassword !== "" &&
              !passwordsMatch && (
                <p className="text-sm text-red-500 mt-1">
                  Passwords do not match.
                </p>
              )}
          </div>

          <div className="text-sm mt-2">
            <p className="font-semibold text-gray-700 mb-1">
              Password must include:
            </p>
            <ul className="space-y-1">
              {Object.entries(passwordRules).map(([key, valid]) => (
                <li
                  key={key}
                  className={valid ? "text-green-600" : "text-red-500"}
                >
                  {valid ? "✔" : "✖"}{" "}
                  {key === "length"
                    ? "At least 8 characters"
                    : key === "uppercase"
                    ? "One uppercase letter"
                    : key === "lowercase"
                    ? "One lowercase letter"
                    : key === "number"
                    ? "One number"
                    : "One special character"}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button
            type="submit"
            disabled={saving || !isFormValid}
            className="bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save Changes"}
          </button>
          <button
            type="button"
            onClick={() => router.push("/admin/profile")}
            className="px-4 py-2 border rounded"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
