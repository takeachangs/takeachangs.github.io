import { motion } from 'framer-motion';

export default function Research() {
  return (
    <main className="min-h-screen pt-24">
      <section className="grid grid-cols-1 md:grid-cols-2 min-h-[calc(100vh-6rem)]">
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="bg-accent p-8 md:p-16"
        >
          <h1 className="font-montserrat text-4xl md:text-5xl font-semibold mb-8">
            RESEARCH
          </h1>
        </motion.div>
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="bg-primary p-8 md:p-16"
        >
          <div className="space-y-8">
            <ResearchEntry 
              title="Quantitative Finance Lab"
              role="Undergraduate Research Assistant"
              description="Development of simulator for meta-strategy approach to financial ML algorithms. Implemented Symmetric CUSUM Filter for volatility analysis."
            />
          </div>
        </motion.div>
      </section>
    </main>
  );
}

function ResearchEntry({ title, role, description }: {
  title: string;
  role: string;
  description: string;
}) {
  return (
    <div>
      <h2 className="font-montserrat text-2xl font-semibold">{title}</h2>
      <h3 className="font-opensans text-secondary mt-2 mb-4">{role}</h3>
      <p className="font-opensans">{description}</p>
    </div>
  );
}