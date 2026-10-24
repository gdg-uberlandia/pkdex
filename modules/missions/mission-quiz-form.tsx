"use client"

import { useRouter } from "next/navigation"
import { useId, useState } from "react"

import { Button } from "@/components/ui/button"

import { completeQuizMissionAction } from "./mission.actions"
import type { PublicMissionQuiz } from "./mission-quiz"

export function MissionQuizForm({
  missionId,
  attemptsUsed = 0,
  quiz,
}: {
  attemptsUsed?: number
  missionId: string
  quiz: PublicMissionQuiz
}) {
  const router = useRouter()
  const formId = useId()
  const [answers, setAnswers] = useState<Record<string, number>>({})
  const [pending, setPending] = useState(false)
  const [finished, setFinished] = useState(false)
  const [remaining, setRemaining] = useState(
    Math.max(0, quiz.maxAttempts - attemptsUsed)
  )
  const [message, setMessage] = useState("")
  const [isError, setIsError] = useState(false)
  return (
    <form
      className="space-y-4"
      onSubmit={async (event) => {
        event.preventDefault()
        if (pending || finished) return
        setPending(true)
        try {
          const result = await completeQuizMissionAction({
            missionId,
            revision: quiz.revision,
            answers: quiz.questions.map((question) => ({
              questionId: question.id,
              optionIndex: answers[question.id],
            })),
          })
          setIsError(!result.success)
          if (result.success) {
            setFinished(true)
            setMessage(
              result.code === "MISSION_ALREADY_COMPLETED"
                ? "Você já concluiu esta missão."
                : `Quiz concluído! +${result.xpAwarded} XP`
            )
            router.refresh()
          } else {
            if (
              "attemptsRemaining" in result &&
              result.attemptsRemaining !== undefined
            )
              setRemaining(result.attemptsRemaining)
            if (
              result.code === "ATTEMPTS_EXHAUSTED" ||
              result.code === "QUIZ_NOT_PASSED" ||
              result.code === "INCORRECT_ANSWER"
            )
              router.refresh()
            setMessage(
              result.code === "QUIZ_NOT_PASSED"
                ? "Você ainda não atingiu o mínimo de acertos. Tente novamente."
                : result.code === "ATTEMPTS_EXHAUSTED"
                  ? "Tentativas esgotadas — missão encerrada sem XP."
                  : result.code === "QUIZ_CHANGED"
                    ? "Este quiz foi atualizado. Reabra a missão para responder novamente."
                    : result.code === "PREREQUISITE_MISSING"
                      ? "Conclua os pré-requisitos desta missão."
                      : "Não foi possível enviar o quiz. Confira as respostas e tente novamente."
            )
            if (result.code === "MISSIONS_DISABLED") {
              setMessage("A organização pausou as conclusões de missões.")
              router.refresh()
            }
            if (result.code === "ATTEMPTS_EXHAUSTED") setFinished(true)
            if (result.code === "QUIZ_CHANGED") {
              setFinished(true)
              router.refresh()
            }
          }
        } catch {
          setIsError(true)
          setMessage("Não foi possível enviar o quiz. Tente novamente.")
        } finally {
          setPending(false)
        }
      }}
    >
      <p className="text-sm text-white/70">
        Acerte pelo menos {quiz.minCorrectAnswers} de {quiz.questions.length}{" "}
        perguntas. Tentativas restantes: {remaining}.
      </p>
      {quiz.questions.map((question, index) => (
        <fieldset
          key={question.id}
          disabled={pending || finished}
          className="space-y-2"
        >
          <legend className="mb-2 text-sm font-medium">
            {index + 1}. {question.prompt}
          </legend>
          {question.options.map((option, optionIndex) => (
            <label
              key={optionIndex}
              className="flex cursor-pointer items-start gap-3 rounded-xl border border-white/15 p-3 text-sm has-checked:border-primary has-checked:bg-primary/10"
            >
              <input
                type="radio"
                className="mt-1 accent-primary"
                name={`${formId}-${question.id}`}
                value={optionIndex}
                checked={answers[question.id] === optionIndex}
                onChange={() =>
                  setAnswers((current) => ({
                    ...current,
                    [question.id]: optionIndex,
                  }))
                }
                required
              />
              <span>{option}</span>
            </label>
          ))}
        </fieldset>
      ))}
      <p
        role="status"
        className={`text-sm ${isError ? "text-destructive" : "text-success"}`}
      >
        {message}
      </p>
      <Button
        type="submit"
        className="w-full"
        disabled={
          pending ||
          finished ||
          quiz.questions.some((question) => answers[question.id] === undefined)
        }
      >
        {pending ? "Conferindo…" : "Enviar respostas"}
      </Button>
    </form>
  )
}
