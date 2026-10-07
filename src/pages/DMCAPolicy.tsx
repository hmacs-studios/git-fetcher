import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import Seo from '@/components/Seo';

const DMCAPolicy = () => {
  return (
    <div className="min-h-screen bg-white text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <Seo
        title="DMCA Copyright Policy"
        description="Review the Medmacs DMCA copyright notice process and contact information for copyright concerns."
        canonical="https://medmacs.app/dmca"
      />

      <header className="sticky top-0 z-50 border-b border-primary/15 bg-white/90 backdrop-blur-xl dark:bg-slate-950/90">
        <div className="container mx-auto flex max-w-4xl items-center justify-between px-4 py-4">
          <Link to="/" className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-primary hover:bg-primary/10">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <span className="text-sm font-black uppercase tracking-[0.28em] text-primary">Medmacs</span>
        </div>
      </header>

      <main className="container mx-auto max-w-4xl px-4 py-12">
        <div className="rounded-2xl border border-primary/15 bg-primary/5 p-6 sm:p-10">
          <p className="text-xs font-black uppercase tracking-[0.28em] text-primary">Copyright Notice</p>
          <h1 className="mt-4 text-3xl font-black tracking-tight sm:text-4xl">DMCA Copyright Policy</h1>
          <p className="mt-4 text-sm leading-7 text-slate-600 dark:text-slate-300">
            Medmacs utilizes automated internal processing to verify medical question accuracy against academic textbook references. 
            Medmacs does not publicly reproduce, display, or distribute copyrighted textbook excerpts or text to end users. 
            Only standard bibliographic metadata (book title, author, edition, and page number) is referenced for verification indexing.
          </p>

          <div className="mt-8 space-y-5 text-sm leading-7 text-slate-700 dark:text-slate-300">
            <section>
              <h2 className="font-black uppercase tracking-wider text-slate-900 dark:text-white">Internal Verification & Fair Use</h2>
              <p className="mt-2 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                All internal indexing operations are performed strictly for non-expressive algorithmic verification and educational accuracy validation. If you are a copyright holder and have concerns regarding any cataloged reference metadata, please submit a inquiry to our legal team.
              </p>
            </section>

            <section>
              <h2 className="font-black uppercase tracking-wider text-slate-900 dark:text-white">Requirements for DMCA Inquiry</h2>
              <p className="mt-2">
                To submit a formal copyright notification or inquiry, your communication must include:
              </p>
              <ul className="mt-2 list-disc pl-5 space-y-1 text-xs">
                <li>Identification of the copyrighted work in question.</li>
                <li>Identification of the specific cataloged book title or metadata entry within Medmacs.</li>
                <li>Your full contact information (name, organization, email address, phone number, and physical address).</li>
                <li>A statement confirming your authority to represent the copyright owner.</li>
                <li>A statement made under penalty of perjury that the provided information is accurate.</li>
              </ul>
            </section>

            <section>
              <h2 className="font-black uppercase tracking-wider text-slate-900 dark:text-white">Designated DMCA Agent Contact</h2>
              <p className="mt-2">
                Send DMCA copyright notices or inquiries to our designated agent at:{' '}
                <a className="font-bold text-primary underline underline-offset-4" href="mailto:legal@medmacs.app">
                  legal@medmacs.app
                </a>
              </p>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
};

export default DMCAPolicy;
