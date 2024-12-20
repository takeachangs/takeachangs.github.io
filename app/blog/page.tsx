import { readdir } from 'fs/promises';
import path from 'path';
import Link from 'next/link';

export default async function Blog() {
  const postsDirectory = path.join(process.cwd(), 'content/blog');
  const filenames = await readdir(postsDirectory);
  
  return (
    <main className="min-h-screen pt-24 px-8 md:px-16">
      <h1 className="font-montserrat text-4xl md:text-5xl font-semibold mb-12">
        BLOG
      </h1>
      <div className="grid gap-8">
        {filenames.map((filename) => {
          const slug = filename.replace('.mdx', '');
          return (
            <Link 
              key={slug} 
              href={`/blog/${slug}`}
              className="border-l-2 border-accent pl-6 py-4 hover:translate-x-1 transition-transform"
            >
              <h2 className="font-montserrat text-2xl font-semibold mb-2">
                {slug.split('-').join(' ')}
              </h2>
            </Link>
          );
        })}
      </div>
    </main>
  );
}