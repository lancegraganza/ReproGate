import Link from "next/link";
import type { ReproTask } from "@/types/domain";
import { formatXlm } from "@/lib/stellar/amounts";
import { StatusBadge } from "@/components/status-badge";

export function TaskCard({ task }: { task: ReproTask }) {
  return (
    <Link className="task-card" href={`/app/tasks/${task.id}`}>
      <div>
        <span className="task-card-repo">{task.githubIssue.owner}/{task.githubIssue.repo} #{task.githubIssue.number}</span>
        <h2>{task.githubIssue.title}</h2>
        <div className="task-meta">
          <span><code>{task.targetEnvironment}</code></span>
          <span>{task.submissionCount}/{task.threshold} confirmations</span>
          <span>Due {new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(task.deadline))}</span>
        </div>
      </div>
      <div className="task-reward"><strong>{formatXlm(task.rewardStroops)} XLM</strong><StatusBadge status={task.status} /></div>
    </Link>
  );
}

