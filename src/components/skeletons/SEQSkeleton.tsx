import { motion } from "framer-motion";
import { Skeleton } from "@/components/ui/skeleton";
import { Loader2 } from "lucide-react";

export const SEQQuizSkeleton = () => {
  return (
    <div className="mx-auto w-full max-w-4xl animate-pulse">
      <div className="border-b border-border/40 px-4 py-3 sm:px-6">
        <Skeleton className="mx-auto mb-2 h-2.5 w-28 rounded-full" />
        <Skeleton className="h-1 w-full rounded-full bg-primary/10" />
      </div>

      <section className="space-y-3 px-5 pt-7 sm:px-8">
        <Skeleton className="h-3 w-20 rounded-full bg-primary/10" />
        <Skeleton className="h-6 w-full max-w-3xl rounded-md" />
        <Skeleton className="h-6 w-4/5 max-w-2xl rounded-md" />
      </section>

      <section className="mx-5 mt-10 space-y-3 sm:mx-8">
        <Skeleton className="h-4 w-28 rounded-full bg-primary/10" />
        <Skeleton className="h-[160px] w-full rounded-none border-b-2 border-border bg-transparent" />
      </section>

      <div className="mx-5 mt-6 flex justify-end sm:mx-8">
        <Skeleton className="h-12 w-40 rounded-xl bg-primary/10" />
      </div>
    </div>
  );
};

export const SEQResultSkeleton = () => {
  return (
    <div className="mx-auto max-w-4xl space-y-6 px-5 pb-32 sm:px-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="flex flex-col items-center text-center">
          <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-primary/10">
            <Loader2 className="h-9 w-9 animate-spin text-primary" />
          </div>
          <Skeleton className="mb-2 h-6 w-48 rounded-full" />
          <Skeleton className="h-4 w-64 max-w-full rounded-full" />
        </div>

        <div className="mt-10 space-y-5 border-t border-border/50 pt-5">
          <div className="space-y-2">
            <Skeleton className="h-4 w-36 rounded-full bg-primary/10" />
            <Skeleton className="h-20 w-full rounded-lg" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-32 rounded-full bg-primary/10" />
            <Skeleton className="h-16 w-full rounded-lg" />
          </div>
        </div>
      </motion.div>
    </div>
  );
};

