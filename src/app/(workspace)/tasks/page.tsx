import Link from "next/link";
import { redirect } from "next/navigation";
import { AutoForm } from "@/components/auto-form";
import { Field, Options, PageIntro, Pill } from "@/components/ui";
import { createTask, updateTaskAssignee, updateTaskStatus } from "@/lib/actions";
import { getCurrentUser, listUsers } from "@/lib/auth";
import { PRIORITIES, TASK_STATUSES } from "@/lib/constants";
import { formatDate } from "@/lib/dates";
import { listCustomers, listTasks } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function TasksPage({ searchParams }: { searchParams: Promise<{ scope?: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const params = await searchParams;
  const team = params.scope === "team";
  const people = listUsers();
  const tasks = listTasks().filter((task) => team || task.assigneeId === user.id);
  const customers = listCustomers({});
  return (
    <>
      <PageIntro
        title="Tasks"
        lede={team ? "Every open and finished task." : "Tasks assigned to you. Changing status moves the card."}
        action={
          <div className="view-switch">
            <Link className={team ? undefined : "active"} href="/tasks">
              Mine
            </Link>
            <Link className={team ? "active" : undefined} href="/tasks?scope=team">
              Team
            </Link>
          </div>
        }
      />
      <section className="card" style={{ marginBottom: 14 }}>
        <h2>Add a task</h2>
        {customers.length === 0 ? (
          <p className="empty">Add an account before creating a task.</p>
        ) : (
          <form action={createTask} className="form-grid">
            <Field label="Task" wide>
              <input name="title" required />
            </Field>
            <Field label="Account">
              <select name="customerId" required defaultValue={customers[0]?.id}>
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Due">
              <input name="dueDate" type="date" />
            </Field>
            <Field label="Priority">
              <select name="priority" defaultValue="Medium">
                <Options values={PRIORITIES} />
              </select>
            </Field>
            <Field label="Assignee">
              <select name="assigneeId" defaultValue={user.id}>
                {people.map((person) => (
                  <option key={person.id} value={person.id}>
                    {person.name}
                  </option>
                ))}
              </select>
            </Field>
            <div className="form-actions wide">
              <button className="btn primary" type="submit">
                Add task
              </button>
            </div>
          </form>
        )}
      </section>
      <div className="board">
        {TASK_STATUSES.map((status) => {
          const cards = tasks.filter((task) => task.status === status);
          return (
            <section className="column" key={status}>
              <h2>
                {status} <span>({cards.length})</span>
              </h2>
              {cards.length === 0 ? <p className="empty">Nothing here.</p> : null}
              {cards.map((task) => (
                <article className="task-card" key={task.id}>
                  <strong>{task.title}</strong>
                  <Link href={`/customers/${task.customerId}?tab=tasks`}>{task.customerName}</Link>
                  <p className={task.daysUntilDue !== null && task.daysUntilDue < 0 && task.status !== "Done" ? "meta overdue" : "meta"}>
                    {formatDate(task.dueDate)}
                    {team ? ` · ${task.assigneeName ?? "Unassigned"}` : ""}
                  </p>
                  <Pill tone={task.priority === "High" ? "bad" : task.priority === "Medium" ? "warn" : "neutral"}>{task.priority}</Pill>
                  <AutoForm action={updateTaskAssignee} className="compact-select">
                    <input type="hidden" name="id" value={task.id} />
                    <select name="assigneeId" defaultValue={task.assigneeId ?? ""} aria-label={`${task.title} assignee`} key={`${task.id}-${task.assigneeId}`}>
                      {people.map((person) => (
                        <option key={person.id} value={person.id}>
                          {person.name}
                        </option>
                      ))}
                    </select>
                  </AutoForm>
                  <AutoForm action={updateTaskStatus} className="compact-select">
                    <input type="hidden" name="id" value={task.id} />
                    <select name="status" defaultValue={task.status} aria-label={`${task.title} status`} key={`${task.id}-${task.status}`}>
                      <Options values={TASK_STATUSES} />
                    </select>
                  </AutoForm>
                </article>
              ))}
            </section>
          );
        })}
      </div>
    </>
  );
}
