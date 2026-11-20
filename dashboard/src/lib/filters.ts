import type { Coverage, Down, FilterState, Formation, PassResult } from '../types'

export const DOWN_OPTIONS: readonly Down[] = ['1st', '2nd', '3rd', '4th']
export const FORMATION_OPTIONS: readonly Formation[] = ['SHOTGUN', 'EMPTY', 'SINGLEBACK', 'I_FORM', 'PISTOL', 'JUMBO', 'WILDCAT']
export const COVERAGE_OPTIONS: readonly Coverage[] = [
  'Cover-0', 'Cover-1', 'Cover-2', 'Cover-3', 'Cover-6', 'Quarters', '2-Man', 'Bracket',
  'Goal Line', 'Prevent', 'Red Zone', 'Miscellaneous',
]
export const RESULT_OPTIONS: readonly PassResult[] = ['C', 'I', 'S', 'R', 'IN']

export const EMPTY_FILTERS: FilterState = {
  team: [],
  down: [],
  formation: [],
  coverage: [],
  result: [],
}
