import { redirect } from "next/navigation";

export default function WorkflowsRedirect() {
  redirect("/flows?tab=workflows");
}
