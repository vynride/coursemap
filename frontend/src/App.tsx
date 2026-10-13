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
    <div className="app">
      <header className="top">
        <a href="#/" className="brand">CourseMap</a>
        <span className="tag">Your YouTube playlist, mapped to your syllabus and your exam</span>
      </header>
      {jobId ? (
        <JobView key={jobId} jobId={jobId} />
      ) : (
        <NewJobForm onCreated={(id) => { window.location.hash = `#/job/${id}`; }} />
      )}
    </div>
  );
}
