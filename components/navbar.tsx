"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, useState } from "react"
import { ThemeToggle } from "./theme-toggle"
import { AuthButton } from "./auth-button"
import { useAuth } from "./auth-provider"

const LINKS = [
  { href: "/competencias", label: "Competencias" },
  { href: "/app",          label: "Ranking"       },
  { href: "/marketplace",  label: "Marketplace"   },
]

export function Navbar() {
  const pathname = usePathname()
  const { isAdmin } = useAuth()
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 16)
    onScroll()
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  const isActive = (href: string) => {
    return pathname === href || pathname.startsWith(href + "/")
  }

  return (
    <nav className={`navbar ${scrolled ? "scrolled" : ""}`}>
      <div className="nav-inner">
        <Link href="/app" className="nav-logo">
          <span className="logo-glyph" />
          <span className="wordmark">UMBRA</span>
        </Link>
        <div className={`nav-links ${menuOpen ? "open" : ""}`}>
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`nav-link ${isActive(link.href) ? "active" : ""}`}
              onClick={() => setMenuOpen(false)}
            >
              {link.label}
            </Link>
          ))}
          {isAdmin && (
            <Link
              href="/admin"
              className={`nav-link nav-link-admin ${isActive("/admin") ? "active" : ""}`}
              onClick={() => setMenuOpen(false)}
            >
              Admin
            </Link>
          )}
        </div>
        <div className="nav-right">
          <ThemeToggle />
          <AuthButton />
        </div>
        <button
          className={`nav-hamburger ${menuOpen ? "open" : ""}`}
          aria-label="Menú"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((v) => !v)}
        >
          <span /><span /><span />
        </button>
      </div>
    </nav>
  )
}