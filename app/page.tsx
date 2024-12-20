export default function Home() {
  return (
    <main className="min-h-screen">
      {/* Hero Section */}
      <section className="h-screen relative">
        <div className="absolute inset-0 grid grid-cols-[40px_1fr_40px] border-secondary/20 border-x">
          <div className="border-r border-secondary/20" />
          <div className="px-8 md:px-16 flex flex-col justify-center">
            <h1 className="font-montserrat text-5xl md:text-7xl font-semibold mb-4">
              SEONGMIN<br />CHANG
            </h1>
            <p className="font-opensans text-secondary text-xl">
              Mathematician • Developer • Researcher
            </p>
          </div>
          <div className="border-l border-secondary/20" />
        </div>
      </section>

      {/* Projects Section */}
      <section className="min-h-screen bg-secondary px-8 md:px-16 py-24">
        <h2 className="font-montserrat text-3xl md:text-4xl font-semibold mb-12">
          SELECTED WORKS
        </h2>
        <div className="grid gap-8">
          <ProjectCard 
            title="My Only Manager (MOM)"
            tech="Python • MongoDB • Cohere API"
            description="AI chatbot with advanced understanding of time-sensitive inquiries"
          />
          <ProjectCard 
            title="Optimization of Methylphenidate"
            tech="MATLAB"
            description="Mathematical modelling of circadian rhythm and dopamine"
          />
        </div>
      </section>

      {/* Research Section */}
      <section className="min-h-screen grid grid-cols-1 md:grid-cols-2">
        <div className="bg-accent p-8 md:p-16">
          <h2 className="font-montserrat text-3xl md:text-4xl font-semibold mb-8">
            RESEARCH
          </h2>
        </div>
        <div className="bg-primary p-8 md:p-16">
          <p className="font-opensans text-lg">
            Currently working as Undergraduate Quantitative Research Assistant at
            University of Toronto's Quantitative Finance Lab.
          </p>
        </div>
      </section>
    </main>
  );
}

function ProjectCard({ title, tech, description }: { 
  title: string; 
  tech: string; 
  description: string; 
}) {
  return (
    <div className="bg-primary p-8 rounded-sm hover:translate-x-1 transition-transform">
      <h3 className="font-montserrat text-2xl font-semibold mb-2">{title}</h3>
      <p className="font-opensans text-secondary text-sm mb-4">{tech}</p>
      <p className="font-opensans">{description}</p>
    </div>
  );
}