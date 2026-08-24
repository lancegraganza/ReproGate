import { connection } from "next/server";
import type { Metadata } from "next";
import { listTasks } from "@/lib/server/repository";
import { TaskCard } from "@/features/tasks/task-card";

export const metadata: Metadata = { title: "Verification history" };
export default async function HistoryPage() { await connection(); const verified = await listTasks({ status: "VERIFIED" }); return <><div className="page-heading"><div><p className="eyebrow">Public result ledger</p><h1>Verification history</h1><p>Completed classifications with their accepted evidence and Stellar transaction references.</p></div></div>{verified.length ? <div className="task-list">{verified.map((task) => <TaskCard key={task.id} task={task} />)}</div> : <div className="panel empty-state"><div><h2>No finalized results yet</h2><p className="muted">History appears only after Registry → Vault finalization confirms.</p></div></div>}</>; }

