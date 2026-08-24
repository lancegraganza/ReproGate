import Link from "next/link";
export default function TaskNotFound() { return <div className="panel empty-state"><div><p className="eyebrow">404</p><h2>Reproduction task not found.</h2><p className="muted">It may have been removed or the link is incomplete.</p><Link className="button button-primary" href="/app/tasks">Back to tasks</Link></div></div>; }

