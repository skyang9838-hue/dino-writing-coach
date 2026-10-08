import { Fragment } from 'react'
import { diffWords } from 'diff'

// 교사 보드(RevisionBoard)와 학생 화면(RevisionHistory)이 같이 쓰는 회차 표시.

const FLAG_REASON_LABELS = {
  nonsense: '무의미한 글로 판단된 회차예요. (도달도는 변동 없어요)',
  profanity: '선생님이 부적절한 표현으로 판단해 반려했어요. (도달도는 변동 없어요)',
}
export const flagReasonLabel = (reason) => FLAG_REASON_LABELS[reason] ?? '검토가 필요해 코칭하지 않은 회차예요. (도달도는 변동 없어요)'

export const renderWritingDiff = (before, after) =>
  diffWords(before, after).map((part, partIndex) => {
    const lines = part.value.split('\n')
    const content = lines.map((line, lineIndex) => (
      <Fragment key={lineIndex}>
        {lineIndex > 0 && <br />}
        {line}
      </Fragment>
    ))
    const className = part.added ? 'diff-added' : part.removed ? 'diff-removed' : undefined
    return (
      <span className={className} key={partIndex}>
        {content}
      </span>
    )
  })
