/*
 * Copyright (C) 2026 - present Instructure, Inc.
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

import * as fs from 'node:fs'
import * as path from 'node:path'
import type {Reporter, TestModule} from 'vitest/node'

interface HeapEntry {
  file: string
  event: 'start' | 'end'
  heapUsedMB: number
  heapTotalMB: number
  rssMB: number
  externalMB: number
  ts: number
}

export class HeapReporter implements Reporter {
  private outputPath: string | null = null
  private startHeap: Map<string, NodeJS.MemoryUsage> = new Map()

  onInit() {
    const outputDir = process.env.TEST_RESULT_OUTPUT_DIR
    if (!outputDir) return

    try {
      fs.mkdirSync(outputDir, {recursive: true})
      const nodeIndex = process.env.CI_NODE_INDEX ?? 'local'
      this.outputPath = path.join(outputDir, `heap-${nodeIndex}.jsonl`)
    } catch {
      // best-effort — never fail the test run
    }
  }

  onTestModuleStart(testModule: TestModule) {
    if (!this.outputPath) return
    const mem = process.memoryUsage()
    this.startHeap.set(testModule.moduleId, mem)
    this.write({
      file: testModule.moduleId,
      event: 'start',
      heapUsedMB: toMB(mem.heapUsed),
      heapTotalMB: toMB(mem.heapTotal),
      rssMB: toMB(mem.rss),
      externalMB: toMB(mem.external),
      ts: Date.now(),
    })
  }

  onTestModuleEnd(testModule: TestModule) {
    if (!this.outputPath) return
    const mem = process.memoryUsage()
    const start = this.startHeap.get(testModule.moduleId)
    this.startHeap.delete(testModule.moduleId)
    this.write({
      file: testModule.moduleId,
      event: 'end',
      heapUsedMB: toMB(mem.heapUsed),
      heapTotalMB: toMB(mem.heapTotal),
      rssMB: toMB(mem.rss),
      externalMB: toMB(mem.external),
      ts: Date.now(),
      ...(start
        ? {
            deltaHeapUsedMB: toMB(mem.heapUsed - start.heapUsed),
            deltaRssMB: toMB(mem.rss - start.rss),
          }
        : {}),
    })
  }

  private write(entry: HeapEntry & Record<string, unknown>) {
    if (!this.outputPath) return
    try {
      fs.appendFileSync(this.outputPath, JSON.stringify(entry) + '\n')
    } catch {
      // best-effort — never fail the test run
    }
  }
}

function toMB(bytes: number): number {
  return Math.round((bytes / 1024 / 1024) * 10) / 10
}
