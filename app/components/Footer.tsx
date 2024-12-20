import ContactSection from './ContactSection';

export default function Footer() {
  return (
    <footer>
      <ContactSection />
      <div className="bg-primary py-6 px-8 md:px-16">
        <p className="font-opensans text-sm text-secondary text-center">
          © {new Date().getFullYear()} Seongmin Chang. Built with Next.js
        </p>
      </div>
    </footer>
  );
}