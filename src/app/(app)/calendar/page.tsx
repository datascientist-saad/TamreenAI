import { redirect } from "next/navigation";

/** Calendar is Plan’s month view — keep the route as a stable alias. */
export default function CalendarPage() {
  redirect("/plan?view=month");
}
