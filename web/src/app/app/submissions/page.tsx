import type { Metadata } from "next";
import { MySubmissions } from "@/features/submissions/my-submissions";

export const metadata: Metadata = { title: "My evidence" };
export default function SubmissionsPage() { return <><div className="page-heading"><div><p className="eyebrow">Student workspace</p><h1>My evidence</h1><p>Track eligible, flagged, pending, and rewarded reproduction submissions.</p></div></div><MySubmissions /></>; }

