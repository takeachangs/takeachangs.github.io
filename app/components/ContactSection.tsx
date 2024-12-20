export default function ContactSection() {
  return (
    <section className="bg-primary py-24 px-8 md:px-16">
      <div className="max-w-4xl mx-auto">
        <h2 className="font-montserrat text-3xl font-semibold mb-8">CONTACT</h2>
        <div className="flex gap-6">
          <SocialLink href="https://github.com/takeachangs" label="GitHub" />
          <SocialLink href="https://linkedin.com/in/seongminc" label="LinkedIn" />
          <SocialLink href="mailto:seongmin.chang@mail.utoronto.ca" label="Email" />
        </div>
      </div>
    </section>
  );
}

function SocialLink({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-secondary hover:text-white transition-colors"
    >
      {label}
    </a>
  );
}