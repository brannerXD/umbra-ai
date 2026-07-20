import type { Metadata } from "next"
import "./privacidad.css"
import { PrivacidadClient } from "@/components/privacidad/privacidad-client"

export const metadata: Metadata = {
  title: "Política de Privacidad — Umbra",
  description:
    "Política de Tratamiento de Datos Personales de Umbra, conforme a la Ley 1581 de 2012 y el Decreto 1377 de 2013 de Colombia.",
}

export default function PrivacidadPage() {
  return <PrivacidadClient />
}
