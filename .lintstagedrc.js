module.exports = {
  '*.{js,jsx,ts,tsx}': ['oxlint --fix', 'biome format --fix --no-errors-on-unmatched', 'git add'],
  'Jenkinsfile*': () => [], // Skip linting Groovy pipeline files
}
