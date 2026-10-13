from fastapi import FastAPI

app = FastAPI(title="CourseMap")


@app.get("/api/health")
async def health() -> dict[str, bool]:
    return {"ok": True}
