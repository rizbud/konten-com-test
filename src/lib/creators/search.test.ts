import { afterEach, describe, expect, it } from 'vitest'

import { dropFixture, seedFixture, type Fixture } from '@/test/fixtures'

import { searchCreators } from './search'

const fixtures: Fixture[] = []
const seed = async (...args: Parameters<typeof seedFixture>) => {
  const fixture = await seedFixture(...args)
  fixtures.push(fixture)
  return fixture
}

const oneCreator = () =>
  seed({ cpm: 1500, remainingBudget: 1_000, subs: [{ views: 1 }] })

afterEach(async () => {
  await Promise.all(fixtures.splice(0).map(dropFixture))
})

describe('searchCreators', () => {
  it('finds a creator by a fragment from the middle of the username', async () => {
    const { username } = await oneCreator()

    const matches = await searchCreators(username.slice(4, 12))

    expect(matches.map((match) => match.username)).toContain(username)
  })

  it('caps the result set so the typeahead never returns 2 000 names', async () => {
    // 'creator_1' matches 1 111 of the seeded creators.
    expect(await searchCreators('creator_1')).toHaveLength(5)
    expect(await searchCreators('creator_1', 2)).toHaveLength(2)
  })

  it('returns nothing for an empty query instead of the whole table', async () => {
    expect(await searchCreators('')).toEqual([])
    expect(await searchCreators('   ')).toEqual([])
  })

  it('treats LIKE wildcards in the query as literal characters', async () => {
    expect(await searchCreators('%')).toEqual([])
  })

  it('is stable: the same query returns the same rows', async () => {
    const first = await searchCreators('creator_99')
    const second = await searchCreators('creator_99')
    expect(second).toEqual(first)
  })
})
