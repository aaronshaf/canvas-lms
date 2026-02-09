/*
 * Copyright (C) 2025 - present Instructure, Inc.
 *
 * This file is part of Canvas.
 *
 * Canvas is free software: you can redistribute it and/or modify it under
 * the terms of the GNU Affero General Public License as published by the Free
 * Software Foundation, version 3 of the License.
 *
 * Canvas is distributed in the hope that it will be useful, but WITHOUT ANY
 * WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR
 * A PARTICULAR PURPOSE. See the GNU Affero General Public License for more
 * details.
 *
 * You should have received a copy of the GNU Affero General Public License along
 * with this program. If not, see <http://www.gnu.org/licenses/>.
 */

import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query'
import type {z} from 'zod'
import tryParseJson from './utils/tryParseJson'

function invalidSchemaValue<T>(value: T, schema: z.Schema<T>) {
  return !schema.safeParse(value).success
}

function getSafeLocalStorage(): Storage | null {
  // Some tests stub `window.localStorage` with a plain object.
  // Be defensive and fall back to initial values when Storage is unavailable.
  try {
    const ls: any = window?.localStorage
    if (!ls) return null
    if (typeof ls.getItem !== 'function' || typeof ls.setItem !== 'function') return null
    return ls as Storage
  } catch {
    return null
  }
}

export function getLocalStorageValue<T>(
  key: string,
  initialValue: T,
  schema: z.Schema<T> | undefined = undefined,
): T {
  const ls = getSafeLocalStorage()
  if (!ls) return initialValue

  let item: string | null
  try {
    item = ls.getItem(key)
  } catch {
    return initialValue
  }

  if (item === null) {
    return initialValue
  }

  const {parseError, parsedValue} = tryParseJson(item)
  if (parseError || (schema && invalidSchemaValue(parsedValue, schema))) {
    return initialValue
  }

  return parsedValue as T
}

async function setLocalStorageValue<T>(key: string, value: T): Promise<void> {
  const ls = getSafeLocalStorage()
  if (!ls) return
  try {
    ls.setItem(key, JSON.stringify(value))
  } catch {
    // Ignore write failures (private mode, disabled storage, etc.)
  }
}

function useLocalStorage<T>(
  key: string,
  initialValue: T,
  schema?: z.Schema<T>,
): [T, (value: T) => void, 'error' | 'success' | 'pending'] {
  const queryClient = useQueryClient()

  const {data: maybeStoredValue, status} = useQuery<T, Error>({
    queryKey: [key],
    queryFn: () => getLocalStorageValue<T>(key, initialValue, schema),
    initialData: () => getLocalStorageValue<T>(key, initialValue, schema),
    staleTime: Number.POSITIVE_INFINITY,
    gcTime: Number.POSITIVE_INFINITY,
  })

  // biome-ignore lint/style/noNonNullAssertion: Getting a value from localstorage is synchronous, and we're providing an initialData fn with a default value if nothing is found, so we can safely assert that we'll always have a value here.
  const storedValue = maybeStoredValue!
  const {mutate} = useMutation({
    mutationFn: (value: T) => {
      return setLocalStorageValue<T>(key, value)
    },
    onMutate: (newValue: T) => {
      queryClient.setQueryData([key], newValue)
    },
  })

  return [storedValue, mutate, status]
}

export default useLocalStorage
