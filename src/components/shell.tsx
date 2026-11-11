"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "@/lib/actions";

const LINKS = [
  { href: "/", label: "Home" },
  { href: "/alerts", label: "Alerts" },
  { href: "/customers", label: "Customers" },
  { href: "/renewals", label: "Renewals" },
  { href: "/tasks", label: "Tasks" },
  { href: "/wins", label: "Wins" },
  { href: "/sync", label: "Sync" },
  { href: "/team", label: "Team" },
];

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Shell({
  user,
  children,
}: {
  user: { name: string; role: "owner" | "member" };
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  return (
    <div className="app">
      <a className="skip" href="#main">
        Skip to content
      </a>
      <aside className="sidebar">
        <Link className="brand" href="/">
          <span className="brand-mark">CS</span>
          <span>
            <strong className="brand-name">Customer Success</strong>
            <small>Daily book of business</small>
          </span>
        </Link>
        <nav className="nav" aria-label="Primary">
          {LINKS.map((link) => (
            <Link key={link.href} href={link.href} className={isActive(pathname, link.href) ? "nav-link active" : "nav-link"} aria-current={isActive(pathname, link.href) ? "page" : undefined}>
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="sidebar-foot">
          <p className="who">
            <strong>{user.name}</strong>
            {user.role === "owner" ? "Owner" : "Teammate"}
          </p>
          <form action={signOut}>
            <button className="sign-out" type="submit">
              Sign out
            </button>
          </form>
        </div>
      </aside>
      <main id="main">{children}</main>
    </div>
  );
}
