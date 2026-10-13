import { Plus, Route } from "lucide-react";
import { useEffect, useState } from "react";
import JobView from "./JobView";
import NewJobForm from "./NewJobForm";

function readJobId(): string | null {
  const match = window.location.hash.match(/^#\/job\/([a-z0-9]+)$/);
  return match ? match[1] : null;
}

export default function App() {
  const [jobId, setJobId] = useState<string | null>(readJobId);

  useEffect(() => {
    const onHash = () => setJobId(readJobId());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  return (
    <>
      <header className="topbar">
        <a href="#/" className="brand">
          <span className="brand-mark"><Route size={17} strokeWidth={2.2} /></span>
          <span>
            <span className="brand-name">CourseMap</span>
            <span className="brand-by" style={{ display: "block" }}>Your YouTube playlist, run like a college course</span>
          </span>
        </a>
        {jobId && (
          <a href="#/" className="btn-outline"><Plus size={15} /> New course</a>
        )}
      </header>
      <main className="page" key={jobId ?? "home"}>
        {jobId ? (
          <JobView jobId={jobId} />
        ) : (
          <NewJobForm onCreated={(id) => { window.location.hash = `#/job/${id}`; }} />
        )}
      </main>
    </>
  );
}
