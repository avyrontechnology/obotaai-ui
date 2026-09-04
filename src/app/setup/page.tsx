import { redirect } from "next/navigation";

export default function SetupRedirect() {
  redirect("/agents/new");
}
