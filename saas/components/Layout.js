import Link from 'next/link';

/**
 * Shared page layout (top nav + container).
 */
export default function Layout({ children, title }) {
  return (
    <>
      <header className="navbar container">
        <Link href="/" className="logo">SalonStream</Link>
        <nav>
          <Link href="/dashboard">Dashboard</Link>
        </nav>
      </header>
      <main className="container">
        {title ? <h1>{title}</h1> : null}
        {children}
      </main>
    </>
  );
}
