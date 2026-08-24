import type { Metadata } from "next";
import { CreateTaskForm } from "@/features/tasks/create-task-form";

export const metadata: Metadata = { title: "Create task" };

export default function CreateTaskPage() {
  return <><div className="page-heading"><div><p className="eyebrow">Maintainer workflow</p><h1>Create a reproduction task</h1><p>Import an issue, define comparable evidence, then fund the reward on Stellar Testnet.</p></div></div><CreateTaskForm /></>;
}

