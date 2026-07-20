import type { Metadata } from "next"
import { AdminClient } from "@/components/admin/admin-client"
import { listCompetitions } from "@/lib/services"
import "./admin.css"

export const metadata: Metadata = {
  title: "Panel de administración — Umbra",
  robots: { index: false, follow: false },
}

export default async function AdminPage() {
  const competitions = await listCompetitions()
  return <AdminClient competitions={competitions} />
}
