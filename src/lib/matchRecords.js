const STOPWORDS = new Set([
  'the', 'and', 'for', 'are', 'what', 'which', 'how', 'has', 'have', 'this',
  'that', 'was', 'were', 'did', 'does', 'any', 'our', 'their', 'with', 'from',
  'about', 'there', 'here', 'not', 'can', 'will', 'should', 'would', 'could',
])

function tokenize(text) {
  return text
    .toLowerCase()
    .split(/\W+/)
    .filter((word) => word.length > 2 && !STOPWORDS.has(word))
}

export function matchRecords(records, question) {
  const questionWords = new Set(tokenize(question))
  if (questionWords.size === 0) return records

  return records
    .map((record) => {
      const haystack = tokenize(`${record.domain} ${record.query} ${record.answerPreview}`)
      const haystackWords = new Set(haystack)
      const score = [...questionWords].filter((word) => haystackWords.has(word)).length
      return { record, score }
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((entry) => entry.record)
}
