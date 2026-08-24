import Link from "next/link";
import { connection } from "next/server";
import type { Metadata } from "next";
import type { TaskStatus } from "@/types/domain";
import { listTasks } from "@/lib/server/repository";
import { TaskCard } from "@/features/tasks/task-card";

export const metadata: Metadata = { title: "Reproduction tasks" };

export default async function TasksPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  await connection();
  const params = await searchParams;
  const allowed = new Set(["OPEN", "VERIFYING", "VERIFIED", "EXPIRED"]);
  const status = allowed.has(params.status ?? "") ? (params.status as TaskStatus) : undefined;
  const tasks = await listTasks({ status });
  return <><div className="page-heading"><div><p className="eyebrow">Independent work queue</p><h1>Reproduction tasks</h1><p>Choose a real issue, reproduce it locally, and submit structured evidence.</p></div><Link className="button button-primary" href="/app/create">Create a task</Link></div><div className="panel" style={{ marginBottom: 18 }}><div className="task-meta"><Link href="/app/tasks">All</Link><Link href="/app/tasks?status=OPEN">Open</Link><Link href="/app/tasks?status=VERIFYING">Verifying</Link><Link href="/app/tasks?status=VERIFIED">Completed</Link><Link href="/app/tasks?status=EXPIRED">Expired</Link></div></div>{tasks.length ? <div className="task-list">{tasks.map((task) => <TaskCard key={task.id} task={task} />)}</div> : <div className="panel empty-state"><div><p className="eyebrow">No matching tasks</p><h2>The queue is clear.</h2><p className="muted">Create a funded task or choose a different status filter.</p><Link className="button button-primary" href="/app/create">Create the first task</Link></div></div>}</>;
}

