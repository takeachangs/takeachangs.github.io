import { readFile } from 'fs/promises';
import path from 'path';

export async function generateStaticParams() {
  return [
    { slug: 'mathematical-modeling' }
  ];
}

export default async function BlogPost({
  params: { slug },
}: {
  params: { slug: string };
}) {
  const filePath = path.join(process.cwd(), 'content/blog', `${slug}.mdx`);
  const source = await readFile(filePath, 'utf-8');
  
  return (
    <article className="pt-24 px-8 md:px-16 max-w-4xl mx-auto mb-16">
      <div className="prose prose-invert max-w-none">
        {source}
      </div>
    </article>
  );
}