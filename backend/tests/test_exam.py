from conftest import FakeLLM, make_syllabus
from coursemap.exam import GradeOut, QuestionOut, QuestionsOut, grade_answer, make_questions
from coursemap.models import CoverageEntry, Moment, Question

BANKERS = Moment(video_id="vid3", video_title="L3 Deadlocks", position=2, start_s=300, depth="explained",
                 key_points=["need matrix"])
COVERAGE = [
    CoverageEntry(topic_id="U2.T1", unit_id="U2", topic_name="Banker's algorithm", status="covered", moments=[BANKERS]),
    CoverageEntry(topic_id="U2.T2", unit_id="U2", topic_name="Deadlock recovery", status="gap", moments=[]),
]


async def test_make_questions_links_moments_and_drops_bad_rows():
    llm = FakeLLM({QuestionsOut: QuestionsOut(questions=[
        QuestionOut(marks=7, text=" Explain Banker's algorithm. ", answer_points=["safe state", " "], moment_index=0),
        QuestionOut(marks=2, text="Define deadlock recovery.", answer_points=["kill"], moment_index=-1),
        QuestionOut(marks=5, text="Out of range moment.", answer_points=["x"], moment_index=9),
        QuestionOut(marks=0, text="Zero marks is dropped.", answer_points=[], moment_index=0),
        QuestionOut(marks=2, text="  ", answer_points=[], moment_index=0),
    ])})
    unit = make_syllabus().units[1]
    questions = await make_questions(llm, "Operating Systems", unit, COVERAGE, "Part A 2 marks, Part B 7 marks")
    assert [(q.id, q.marks, q.text, q.moment) for q in questions] == [
        ("U2.Q1", 7, "Explain Banker's algorithm.", BANKERS),
        ("U2.Q2", 2, "Define deadlock recovery.", None),
        ("U2.Q3", 5, "Out of range moment.", None),
    ]
    assert questions[0].answer_points == ["safe state"]
    prompt = llm.calls[0][1][0].text
    assert "[0] Banker's algorithm" in prompt
    assert "Deadlock recovery" in prompt and "NOT taught" in prompt
    assert "Part A 2 marks, Part B 7 marks" in prompt


QUESTION = Question(id="U2.Q1", unit_id="U2", marks=7, text="Explain Banker's algorithm.",
                    answer_points=["safe state", "need matrix"], moment=BANKERS)


async def test_grade_empty_answer_skips_model():
    llm = FakeLLM({})
    grade = await grade_answer(llm, QUESTION, "   ")
    assert (grade.score, grade.max_score, grade.rewatch) == (0, 7, BANKERS)
    assert grade.missing_points == ["safe state", "need matrix"]
    assert llm.calls == []


async def test_grade_clamps_score_and_sets_rewatch():
    llm = FakeLLM({GradeOut: GradeOut(score=12, feedback=" Great. ", missing_points=[])})
    grade = await grade_answer(llm, QUESTION, "A full answer")
    assert (grade.score, grade.feedback, grade.rewatch) == (7, "Great.", None)

    llm = FakeLLM({GradeOut: GradeOut(score=-2, feedback="Weak.", missing_points=["need matrix"])})
    grade = await grade_answer(llm, QUESTION, "A weak answer")
    assert (grade.score, grade.rewatch) == (0, BANKERS)
    assert "A weak answer" in llm.calls[0][1][0].text
