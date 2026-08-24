import Link from "next/link";
import { connection } from "next/server";
import { listTasks } from "@/lib/server/repository";
import { TaskCard } from "@/features/tasks/task-card";
import { BalanceCard } from "@/features/wallet/balance-card";

export default async function ApplicationHome() {
  await connection();
  const tasks = await listTasks();
  const open = tasks.filter((task) => task.status === "OPEN");
  const verifying = tasks.filter((task) => task.status === "VERIFYING");
  const verified = tasks.filter((task) => task.status === "VERIFIED");
  return <><div className="page-heading"><div><p className="eyebrow">Developer verification workspace</p><h1>Make bug reports reproducible.</h1><p>Browse active work or track evidence moving toward an on-chain result.</p></div><Link className="button button-primary" href="/app/create">Create task</Link></div><div className="stat-grid" style={{ marginBottom: 18 }}><div className="stat-card"><span>Open tasks</span><strong>{open.length}</strong><span>accepting independent evidence</span></div><div className="stat-card"><span>At threshold</span><strong>{verifying.length}</strong><span>ready for maintainer finalization</span></div><div className="stat-card"><span>Verified</span><strong>{verified.length}</strong><span>finalized on Stellar</span></div></div><div className="dashboard-grid"><section className="stack"><div className="page-heading" style={{ marginBottom: 0 }}><div><h2>Active queue</h2><p>Highest-priority open tasks.</p></div><Link className="button button-quiet button-small" href="/app/tasks">View all</Link></div>{open.length ? <div className="task-list">{open.slice(0, 5).map((task) => <TaskCard key={task.id} task={task} />)}</div> : <div className="panel empty-state"><div><h2>No funded tasks yet</h2><p className="muted">Create a task to start the first complete reproduction flow.</p></div></div>}</section><aside className="stack"><BalanceCard /><section className="panel"><p className="eyebrow">Safety boundary</p><h2>Evidence, not execution</h2><p className="muted">ReproGate never runs imported repository code or student submissions. Contributors reproduce locally and submit structured evidence.</p></section></aside></div></>;
}

