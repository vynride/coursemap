from collections import defaultdict

from coursemap.models import CoverageEntry, Moment, Syllabus, Video, VideoAnalysis


def build_coverage(syllabus: Syllabus, videos: list[Video], analyses: list[VideoAnalysis]) -> list[CoverageEntry]:
    by_id = {v.id: v for v in videos}
    moments: dict[str, list[Moment]] = defaultdict(list)
    for analysis in analyses:
        video = by_id.get(analysis.video_id)
        if video is None:
            continue
        for hit in analysis.hits:
            moments[hit.topic_id].append(Moment(
                video_id=video.id,
                video_title=video.title,
                position=video.position,
                start_s=hit.start_s,
                depth=hit.depth,
                key_points=hit.key_points,
            ))
    entries: list[CoverageEntry] = []
    for unit in syllabus.units:
        for topic in unit.topics:
            found = sorted(moments.get(topic.id, []), key=lambda m: (m.depth != "explained", m.position, m.start_s))
            if not found:
                status = "gap"
            elif any(m.depth == "explained" for m in found):
                status = "covered"
            else:
                status = "partial"
            entries.append(CoverageEntry(
                topic_id=topic.id, unit_id=unit.id, topic_name=topic.name, status=status, moments=found,
            ))
    return entries
