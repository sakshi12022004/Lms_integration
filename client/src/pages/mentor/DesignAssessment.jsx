import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useAuth } from "../../auth/auth";
import { useTranslation } from "../../context/TranslationContext";
import MentorLayout from "../../components/MentorLayout";
import { toast } from "react-toastify";

const DesignAssessment = () => {
  const { assessmentId } = useParams();
  const { API, token } = useAuth();
  const { t } = useTranslation();

  const [questionType, setQuestionType] = useState("text"); // text | image
  const [questionText, setQuestionText] = useState("");
  const [questionImage, setQuestionImage] = useState(null);
  const [options, setOptions] = useState(["", ""]);
  const [correctIndex, setCorrectIndex] = useState(0);
  const [questions, setQuestions] = useState([]);

  // Load existing questions
  useEffect(() => {
    setQuestions([]); // Reset questions on load
    fetch(`${API}/assessments/questions/${assessmentId}`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => {
        // Handle new response structure { assessment, questions }
        if (data.questions) {
          setQuestions(data.questions);
        } else if (Array.isArray(data)) {
          // Fallback for backward compatibility (if needed)
          setQuestions(data);
        } else {
          setQuestions([]);
        }
      })
      .catch(() => setQuestions([]));
  }, [assessmentId]);

  const addOption = () => {
    setOptions([...options, ""]);
  };

  const updateOption = (i, value) => {
    const updated = [...options];
    updated[i] = value;
    setOptions(updated);
  };

  const resetEditor = () => {
    setQuestionText("");
    setQuestionImage(null);
    setOptions(["", ""]);
    setCorrectIndex(0);
    setQuestionType("text");
  };

  const addQuestion = async () => {
    if (questionType === "text" && !questionText.trim()) {
      toast.error("Question text is required");
      return;
    }
    if (questionType === "image" && !questionImage) {
      toast.error("Question image URL is required");
      return;
    }
    if (options.some(opt => !opt.trim())) {
      toast.error("All options must be filled");
      return;
    }

    try {
      const payload = {
        assessmentId,
        questionText: questionType === "text" ? questionText : "",
        questionImage: questionType === "image" ? questionImage : "",
        options,
        correctOptionIndex: correctIndex
      };

      const res = await fetch(`${API}/assessments/add-question`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      if (!res.ok) throw new Error();

      const data = await res.json();
      setQuestions(prev => [...prev, data.question]);
      resetEditor();
      toast.success("Question added");
    } catch {
      toast.error("Failed to add question");
    }
  };

  const publishAssessment = async () => {
    try {
      const res = await fetch(
        `${API}/assessments/${assessmentId}/publish`,
        {
          method: "PUT",
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      if (!res.ok) throw new Error();
      toast.success("Assessment published");
    } catch {
      toast.error("Publish failed");
    }
  };

  return (
    <MentorLayout>
      <div className="max-w-4xl mx-auto p-6">

        {/* QUESTION LIST */}
        {questions.map((q, idx) => (
          <div
            key={idx}
            className="mb-4 p-4 bg-white border rounded-xl shadow-sm"
          >
            <h4 className="font-semibold mb-2">
              Q{idx + 1}
            </h4>

            {q.questionText && (
              <p className="mb-3">{q.questionText}</p>
            )}

            {q.questionImage && (
              <img
                src={q.questionImage}
                alt="Question"
                className="mb-3 max-h-60 rounded"
              />
            )}

            <ul className="space-y-1">
              {q.options.map((opt, i) => (
                <li
                  key={i}
                  className={`p-2 rounded ${
                    i === q.correctOptionIndex
                      ? "bg-green-50 text-green-700 font-medium"
                      : "bg-gray-50"
                  }`}
                >
                  {opt}
                </li>
              ))}
            </ul>
          </div>
        ))}

        {/* QUESTION EDITOR */}
        <div className="mt-8 p-6 bg-white border rounded-xl shadow">
          <h3 className="text-lg font-bold mb-4">
            Add New Question
          </h3>

          {/* Question Type */}
          <div className="flex gap-4 mb-4">
            <label className="flex items-center gap-2">
              <input
                type="radio"
                checked={questionType === "text"}
                onChange={() => setQuestionType("text")}
              />
              Text Question
            </label>

            <label className="flex items-center gap-2">
              <input
                type="radio"
                checked={questionType === "image"}
                onChange={() => setQuestionType("image")}
              />
              Image Question
            </label>
          </div>

          {/* Question Input */}
          {questionType === "text" ? (
            <textarea
              className="w-full border p-2 rounded mb-4"
              placeholder="Enter question text"
              value={questionText}
              onChange={e => setQuestionText(e.target.value)}
            />
          ) : (
            <input
              type="text"
              placeholder="Paste image URL"
              className="w-full border p-2 rounded mb-4"
              value={questionImage || ""}
              onChange={e => setQuestionImage(e.target.value)}
            />
          )}

          {/* OPTIONS */}
          {options.map((opt, i) => (
            <div key={i} className="flex items-center gap-2 mb-2">
              <input
                type="radio"
                checked={correctIndex === i}
                onChange={() => setCorrectIndex(i)}
              />
              <input
                className="flex-1 border p-2 rounded"
                placeholder={`Option ${i + 1}`}
                value={opt}
                onChange={e => updateOption(i, e.target.value)}
              />
            </div>
          ))}

          <button
            onClick={addOption}
            className="text-sm text-blue-600 mt-2"
          >
            + Add Option
          </button>

          <button
            onClick={addQuestion}
            className="w-full mt-4 py-2 bg-primary text-white rounded"
          >
            Add Question
          </button>
        </div>

        {/* PUBLISH */}
        <button
          onClick={publishAssessment}
          className="w-full mt-8 py-3 bg-green-600 text-white rounded-xl font-semibold"
        >
          Publish Assessment
        </button>

      </div>
    </MentorLayout>
  );
};

export default DesignAssessment;
