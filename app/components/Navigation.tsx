import Link from 'next/link';

export default function Navigation() {
  return (
    <nav className="fixed w-full z-50 px-8 md:px-16 py-6">
      <div className="flex justify-between items-center">
        <Link href="/" className="font-montserrat text-lg">SC</Link>
        <div className="flex gap-8">
          <NavLink href="/projects">Projects</NavLink>
          <NavLink href="/research">Research</NavLink>
          <NavLink href="/blog">Blog</NavLink>
        </div>
      </div>
    </nav>
  );
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link 
      href={href}
      className="font-opensans text-secondary hover:text-white transition-colors"
    >
      {children}
    </Link>
  );
}